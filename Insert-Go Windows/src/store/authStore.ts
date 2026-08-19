import { create } from "zustand";
import { openUrl } from "@tauri-apps/plugin-opener";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as bridge from "@/services/tauriBridge";
import { toast } from "@/store/toastStore";
import { API_URL } from "@/services/apiConfig";
import { http } from "@/services/http";
import { createPkce } from "@/services/pkce";
import { hideWindow, showWindow } from "@/services/windowChrome";
import { safeError } from "@/services/safeLog";

/**
 * Auth via the InsertGo.AI website (Better Auth server).
 *
 * Desktop sign-in is OAuth 2.0 Authorization Code + PKCE over a custom URI
 * scheme — the flow RFC 8252 prescribes for native apps:
 *   1. Generate a code_verifier + state; open the system browser on
 *      /desktop/authorize?code_challenge=…  (Google blocks OAuth inside
 *      embedded webviews, so the system browser is the only secure host).
 *   2. The user approves there; the browser hands back
 *      insertgo://auth/callback?code=…&state=… through the deep-link plugin.
 *   3. Validate state, then POST code + code_verifier to /api/desktop/token →
 *      session token. The code alone is worthless: any local app can claim the
 *      URI scheme on Windows, and PKCE is what stops it redeeming an
 *      intercepted code.
 *   4. All later calls send `Authorization: Bearer <token>` (bearer plugin).
 *
 * The deep link needs a registered scheme, so sign-in only works in the real
 * app (`npm run tauri:dev` or a packaged build), never browser dev mode.
 */

const CLIENT_ID = "insertgo-desktop";
const REDIRECT_URI = "insertgo://auth/callback";
/** Matches the server's authorization-code TTL — after this the code is dead
 *  anyway, so stop waiting rather than leaving the UI pinned. */
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export type Tier = "free" | "plus" | "pro";

type User = {
  name: string;
  email: string;
  image?: string | null;
  /**
   * Server-authoritative (customSession plugin on the website stamps both
   * onto get-session; the Dodo webhook updates them). Local defaults apply
   * only when talking to a pre-billing server build.
   */
  subscriptionStatus: "trial" | "subscribed" | "expired";
  credits: number;
  /**
   * 3-tier model fields (customSession stamps all six). Optional so a
   * pre-3-tier server build degrades to the legacy fields above — the
   * predicates below own the fallback mapping in ONE place.
   */
  tier?: Tier;
  dailyCreditsRemaining?: number;
  dailyCreditsMax?: number;
  addOnCredits?: number;
  historyAllowed?: boolean;
};

/** THE Pro-entitlement rule — every paid-feature gate must go through this
 *  one predicate so an entitlement change (grace period, team plans) lands
 *  everywhere at once. */
export const isPro = (user: User | null | undefined): boolean =>
  user?.subscriptionStatus === "subscribed";

/** The user's plan tier; legacy sessions map subscribed → pro, else free. */
export const tierOf = (user: User | null | undefined): Tier =>
  user?.tier ?? (user?.subscriptionStatus === "subscribed" ? "pro" : "free");

/** Server-stamped history entitlement; legacy sessions fall back to isPro. */
export const historyAllowedFor = (user: User | null | undefined): boolean =>
  user?.historyAllowed ?? isPro(user);

/** Total spendable credits right now: daily remaining + non-expiring add-on.
 *  Legacy sessions carry only the flat `credits` total. */
export const totalCredits = (user: User | null | undefined): number =>
  user?.dailyCreditsRemaining !== undefined || user?.addOnCredits !== undefined
    ? (user?.dailyCreditsRemaining ?? 0) + (user?.addOnCredits ?? 0)
    : (user?.credits ?? 0);

type BrowserPrompt = {
  /** The authorize URL — shown copyable so a failed hand-off isn't a dead end. */
  authorizeUrl: string;
  /** Set when opening the system browser threw — the panel then leans on the
   *  copyable URL + "open this manually" hint instead of "a window opened". */
  browserOpenFailed: boolean;
};

type AuthState = {
  token: string | null;
  user: User | null;
  hardwareId: string | null;
  isLoading: boolean;
  /** Set while a sign-in is waiting for approval in the system browser. */
  browserPrompt: BrowserPrompt | null;
  error: string | null;

  init: () => Promise<void>;
  /** Starts the PKCE flow: opens the browser, waits for the deep-link callback. */
  signInWithBrowser: () => Promise<boolean>;
  cancelSignIn: () => void;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  /** Apply a server-reported credit balance (rides back on generate
   *  responses) without a get-session round-trip. The server ledger is the
   *  source of truth — this only mirrors it into the UI. */
  applyCredits: (credits: number) => void;
  /** Same, but with the daily/add-on breakdown from the x-credits-daily /
   *  x-credits-addon headers (or a 402 body) on newer server builds. */
  applyBalance: (balance: { daily: number; addOn: number }) => void;
};

// --- Session-token persistence (SECURITY.md "Secrets at rest") -------------
// Packaged app: the token lives in the OS credential store (keyring account
// "session") — never localStorage, which any XSS could read. Browser dev mode
// (!isTauri()) falls back to sessionStorage with a 1-hour TTL — session-scoped,
// never on disk. The write timestamp (auth_token_ts, not a secret) stays in
// localStorage so freshness checks are synchronous.

const TOKEN_KEY = "auth_token";
const TOKEN_TS_KEY = "auth_token_ts";
/** A token older than this is re-validated before use. Server sessions are a
 *  30-day SLIDING window now (website lib/auth.ts `session.expiresIn` /
 *  `updateAge`), so this is no longer a margin under an expiry — it is a
 *  revocation-liveness check: it bounds how long a session revoked on the
 *  website can still ride a generate request, and it is the request that keeps
 *  the sliding window sliding. */
export const TOKEN_FRESH_MS = 55 * 60 * 1000;
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

// Browser-dev-only token fallback.
const DEV_TOKEN_TTL_MS = 60 * 60 * 1000;

type DevTokenEntry = { v: string; exp: number };

function devTokenWrite(token: string): void {
  const entry: DevTokenEntry = { v: token, exp: Date.now() + DEV_TOKEN_TTL_MS };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(entry));
}

function devTokenRead(): string | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as DevTokenEntry;
    if (typeof entry.v !== "string" || Date.now() > entry.exp) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return entry.v;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

async function persistToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
  if (bridge.isTauri()) {
    await bridge.sessionTokenSet(token);
  } else {
    devTokenWrite(token);
  }
}

async function loadPersistedToken(): Promise<string | null> {
  if (!bridge.isTauri()) {
    // One-time cleanup: earlier dev builds kept the token in localStorage.
    localStorage.removeItem(TOKEN_KEY);
    return devTokenRead();
  }
  // One-time migration: pre-keyring builds stored the token in localStorage.
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) {
    try {
      await bridge.sessionTokenSet(legacy);
      localStorage.removeItem(TOKEN_KEY);
      return legacy;
    } catch (e) {
      safeError("Failed to migrate session token to the credential store", e);
      return legacy;
    }
  }
  try {
    return await bridge.sessionTokenGet();
  } catch (e) {
    safeError("Failed to read session token from the credential store", e);
    return null;
  }
}

async function clearPersistedToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_TS_KEY);
  if (bridge.isTauri()) {
    try {
      await bridge.sessionTokenDelete();
    } catch (e) {
      safeError("Failed to delete session token from the credential store", e);
    }
  }
}

/**
 * Token for outgoing authorized requests. Re-validates a stale (>55 min)
 * session via refreshStatus() first, so an expired token is caught client-side
 * before it rides a generate request (H-4).
 */
export async function getFreshToken(): Promise<string | null> {
  const store = useAuthStore.getState();
  let token = store.token;
  // Dev fallback: the store may not have been init()ed in this window yet.
  if (!token && !bridge.isTauri()) token = devTokenRead();
  if (!token) return null;
  const ts = Number(localStorage.getItem(TOKEN_TS_KEY));
  if (ts && Date.now() - ts > TOKEN_FRESH_MS) {
    await store.refreshStatus();
    token = useAuthStore.getState().token ?? token;
  }
  return token;
}

// PII (name, email) is session-scoped — sessionStorage, never on disk.
const getSavedUser = (): User | null => {
  // One-time cleanup: earlier builds persisted the profile in localStorage.
  localStorage.removeItem("auth_user");
  try {
    const saved = sessionStorage.getItem("auth_user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    sessionStorage.removeItem("auth_user");
    return null;
  }
};

/**
 * Parse a token-exchange response body, tolerating non-JSON (a proxy's 502/503
 * HTML page, an empty body). The raw SyntaxError is a developer detail — log
 * it with the HTTP status (the body is already consumed, so status is the
 * only context left) and surface a friendly message via the catch block.
 */
async function parseJsonSafe(res: Response, what: string): Promise<any> {
  try {
    return await res.json();
  } catch (e) {
    safeError(
      `Non-JSON ${what} response (HTTP ${res.status} ${res.statusText})`,
      e,
    );
    throw new Error(
      "The authentication service is temporarily unavailable. Please try again later.",
    );
  }
}

/**
 * The sign-in waiting on a deep-link callback, if any. Module-level (not store
 * state) because the code_verifier is a secret that must never be persisted or
 * broadcast — it lives in memory for one exchange and dies with it.
 */
type PendingSignIn = {
  verifier: string;
  state: string;
  settle: (signedIn: boolean) => void;
};
let pending: PendingSignIn | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Ends the current sign-in attempt exactly once. */
function settlePending(signedIn: boolean): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  const settle = pending?.settle;
  pending = null;
  settle?.(signedIn);
}

// Periodic session re-validation, one timer per JS context (window).
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Cross-window auth sync: each webview is a fresh JS context, so a login or
// logout in the main window must be broadcast for the floating windows to
// react. The event carries no secret — receivers re-read the token from the
// OS credential store.
let authSyncStarted = false;

function broadcastAuthChanged(): void {
  if (bridge.isTauri()) void emit("auth:changed");
}

// Deep-link callback listener, installed once per JS context (the plugin emits
// a global event, so every window hears it — only the one holding the verifier
// can act on it).
let deepLinkStarted = false;

async function startDeepLinkListener(): Promise<void> {
  if (deepLinkStarted) return;
  deepLinkStarted = true;
  try {
    await onOpenUrl((urls) => urls.forEach((url) => void handleCallback(url)));
  } catch (e) {
    deepLinkStarted = false;
    throw new Error(
      `Couldn't listen for the browser hand-off: ${e instanceof Error ? e.message : e}`,
    );
  }
}

/**
 * Handle `insertgo://auth/callback?code=…&state=…`: validate state (CSRF —
 * RFC 6749 §10.12), then trade the code + verifier for a session token.
 *
 * Anything that isn't the callback this window is waiting for is ignored
 * rather than surfaced: a stale link, another window's flow, or a forged deep
 * link must never cancel or hijack a live sign-in. The URL is never logged —
 * it carries the authorization code.
 */
async function handleCallback(rawUrl: string): Promise<void> {
  const active = pending;
  if (!active) return;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (`${url.protocol}//${url.host}${url.pathname}` !== REDIRECT_URI) return;
  if (url.searchParams.get("state") !== active.state) {
    safeError("Ignored a sign-in callback with an unexpected state");
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) return;

  try {
    const res = await http(`${API_URL}/api/desktop/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: active.verifier,
      }),
    });
    const data = await parseJsonSafe(res, "token");
    const token = data.access_token;
    if (!res.ok || !token) {
      throw new Error(
        data.error_description || data.error || "Sign-in failed",
      );
    }

    await persistToken(token);
    useAuthStore.setState({
      token,
      browserPrompt: null,
      isLoading: false,
      error: null,
    });
    broadcastAuthChanged();
    await useAuthStore.getState().refreshStatus();
    settlePending(true);
    toast.success("Signed in!");
    // Bring the palette back after the browser stole focus — but only when
    // the palette started the flow. From the floating skillbar the user stays
    // in their external app; showing the off-screen, non-focusable skillbar
    // (or yanking the palette up) would be wrong — the bar simply flips to
    // the skills via the token subscription.
    if (getCurrentWindow().label === "main") void showWindow();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    useAuthStore.setState({
      error: message,
      isLoading: false,
      browserPrompt: null,
    });
    settlePending(false);
    toast.error(message);
    // The palette hid itself when the browser opened — bring it back so the
    // error isn't sitting on an invisible window.
    if (getCurrentWindow().label === "main") void showWindow();
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // The keyring read is async — Tauri starts at null and init() hydrates.
  // Browser dev mode keeps a synchronous sessionStorage read (1h TTL).
  token: bridge.isTauri() ? null : devTokenRead(),
  user: getSavedUser(),
  hardwareId: null,
  isLoading: false,
  browserPrompt: null,
  error: null,

  init: async () => {
    try {
      let hwId = "web-dev-mode";
      if (bridge.isTauri()) {
        hwId = await bridge.getHardwareId();
      }
      set({ hardwareId: hwId });
    } catch (e) {
      safeError("Failed to load hardware ID", e);
      set({ hardwareId: "failed-to-load-hardware-id" });
    }
    // Hydrate the session from the OS credential store (migrating any legacy
    // localStorage token), then validate it on startup.
    const token = await loadPersistedToken();
    if (token && !get().token) set({ token });
    if (get().token) void get().refreshStatus();
    // Re-validate periodically so a long-running app notices server-side
    // expiry/revocation instead of failing on the next generate (H-4).
    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        if (get().token) void get().refreshStatus();
      }, REFRESH_INTERVAL_MS);
    }
    // React to login/logout performed in another window: re-hydrate the
    // token from the credential store (never trust event payloads).
    if (bridge.isTauri() && !authSyncStarted) {
      authSyncStarted = true;
      void listen("auth:changed", async () => {
        const token = await loadPersistedToken();
        set({ token, user: token ? get().user : null });
        if (token) void get().refreshStatus();
      });
    }
  },

  signInWithBrowser: async () => {
    if (pending) return false; // one attempt at a time
    if (!bridge.isTauri()) {
      // Browser dev mode has no `insertgo://` handler, so the callback could
      // never arrive — say so instead of hanging for five minutes.
      const message =
        "Sign-in needs the desktop app — run `npm run tauri:dev` or use a packaged build.";
      set({ error: message });
      toast.error(message);
      return false;
    }
    set({ isLoading: true, error: null });
    try {
      // Listen BEFORE opening the browser: the callback can land the moment
      // the user approves, and a missed event means a dead five-minute wait.
      await startDeepLinkListener();

      const { verifier, challenge, state } = await createPkce();
      const authorizeUrl = `${API_URL}/desktop/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      })}`;
      set({ browserPrompt: { authorizeUrl, browserOpenFailed: false } });

      const signedIn = new Promise<boolean>((resolve) => {
        pending = { verifier, state, settle: resolve };
        pendingTimer = setTimeout(() => {
          set({
            isLoading: false,
            browserPrompt: null,
            error: "Timed out waiting for browser approval. Try again.",
          });
          settlePending(false);
          // Same as the callback-error path: surface the timeout on a
          // visible window, not one hidden behind the browser.
          if (getCurrentWindow().label === "main") void showWindow();
        }, SIGN_IN_TIMEOUT_MS);
      });

      // If the opener is blocked by scope or otherwise throws, flip
      // browserOpenFailed so the panel foregrounds the copyable URL instead of
      // silently dead-ending. The wait continues either way — and the window
      // stays VISIBLE on failure, since the copyable URL lives on it.
      try {
        await openUrl(authorizeUrl);
        // Browser is up — get the palette out of its way. It stays hidden
        // until the deep-link callback lands (showWindow in handleCallback)
        // or the user summons it with the global hotkey. Hiding only on
        // success keeps the manual copy-link fallback on screen when the
        // hand-off never happened.
        void hideWindow();
      } catch (e) {
        safeError("Failed to open browser; user can visit manually", e);
        set((s) =>
          s.browserPrompt
            ? { browserPrompt: { ...s.browserPrompt, browserOpenFailed: true } }
            : {},
        );
      }

      return await signedIn;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg, isLoading: false, browserPrompt: null });
      settlePending(false);
      toast.error(errorMsg);
      return false;
    }
  },

  cancelSignIn: () => {
    settlePending(false);
    set({ isLoading: false, browserPrompt: null });
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      // Revoke the session server-side; ignore network failures.
      try {
        await http(`${API_URL}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: "{}",
        });
      } catch (e) {
        safeError("Server sign-out failed (session revoked locally)", e);
      }
    }
    await clearPersistedToken();
    sessionStorage.removeItem("auth_user");
    set({ token: null, user: null });
    broadcastAuthChanged();
    toast.success("Logged out successfully");
  },

  applyCredits: (credits) => {
    const user = get().user;
    if (!user || !Number.isFinite(credits) || user.credits === credits) return;
    const next = { ...user, credits };
    sessionStorage.setItem("auth_user", JSON.stringify(next));
    set({ user: next });
  },

  applyBalance: ({ daily, addOn }) => {
    const user = get().user;
    if (!user || !Number.isFinite(daily) || !Number.isFinite(addOn)) return;
    if (
      user.dailyCreditsRemaining === daily &&
      user.addOnCredits === addOn &&
      user.credits === daily + addOn
    )
      return;
    const next: User = {
      ...user,
      dailyCreditsRemaining: daily,
      addOnCredits: addOn,
      // Legacy total stays in step for anything still reading `credits`.
      credits: daily + addOn,
    };
    sessionStorage.setItem("auth_user", JSON.stringify(next));
    set({ user: next });
  },

  refreshStatus: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await http(`${API_URL}/api/auth/get-session`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        // Logging out ERASES the keyring entry, and the only way back is a full
        // system-browser re-auth — so it takes a definitive answer from Better
        // Auth itself, not merely a 401-shaped response. Captive portals, WAFs
        // and corporate proxies answer HTML (or nothing at all); that reply
        // never reached the API, so it is network interference, not revocation.
        //
        // 403 is deliberately NOT here: `/get-session` answers 401 for an
        // invalid or expired session, so a JSON 403 comes from something in
        // front of the API (a WAF rule, a geo block) and is not evidence about
        // this session at all. `http()` also manufactures a bodiless 401 for
        // its own signed-out gate, which has no Content-Type and so cannot
        // reach this branch either.
        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.toLowerCase().includes("application/json")) {
          void get().logout();
        }
        return;
      }
      if (response.status === 403) return; // see above — not a session verdict
      const data = await response.json();
      if (!response.ok || !data?.user) {
        // Null body = session expired/revoked.
        if (data === null) {
          void get().logout();
        }
        return;
      }
      const prev = getSavedUser();
      // Prefer the server-reported entitlements (customSession fields); keep
      // the previous local values only when talking to a pre-billing server.
      const status = data.user.subscriptionStatus;
      const validStatus =
        status === "trial" || status === "subscribed" || status === "expired";
      const tier = data.user.tier;
      const validTier = tier === "free" || tier === "plus" || tier === "pro";
      const num = (v: unknown): number | undefined =>
        typeof v === "number" && Number.isFinite(v) ? v : undefined;
      const user: User = {
        name: data.user.name ?? "",
        email: data.user.email,
        image: data.user.image ?? null,
        subscriptionStatus: validStatus
          ? status
          : (prev?.subscriptionStatus ?? "trial"),
        credits:
          typeof data.user.credits === "number"
            ? data.user.credits
            : (prev?.credits ?? 50),
        // 3-tier fields — absent (pre-3-tier server) stays absent so the
        // predicate fallbacks in this module keep deciding.
        tier: validTier ? tier : prev?.tier,
        dailyCreditsRemaining:
          num(data.user.dailyCreditsRemaining) ?? prev?.dailyCreditsRemaining,
        dailyCreditsMax:
          num(data.user.dailyCreditsMax) ?? prev?.dailyCreditsMax,
        addOnCredits: num(data.user.addOnCredits) ?? prev?.addOnCredits,
        historyAllowed:
          typeof data.user.historyAllowed === "boolean"
            ? data.user.historyAllowed
            : prev?.historyAllowed,
      };
      sessionStorage.setItem("auth_user", JSON.stringify(user));
      // Successful server validation — the token is fresh again.
      localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
      set({ user });
    } catch (e) {
      safeError("Failed to refresh session", e);
    }
  },
}));
