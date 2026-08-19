import { createHash } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer, customSession, emailOTP } from "better-auth/plugins";
import { sso } from "@better-auth/sso";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { Resend } from "resend";
import { audit } from "./auditLog";
import { pool } from "./pgPool";
import { withHashedSessionTokens } from "./sessionTokenHash";
import { pgPoolConfig } from "./pgSsl";
import { safeError } from "./safeLog";
import {
  dailyRemaining,
  normalizeTier,
  TIER_DAILY_CREDITS,
  tierAllowsHistory,
  type Tier,
} from "./entitlements";

/**
 * Server-side Better Auth instance.
 *
 * Sign-in lanes:
 *  1. Google OAuth        — socialProviders.google
 *  2. Enterprise SSO      — @better-auth/sso (OIDC providers registered per org)
 *  3. Email OTP           — emailOTP plugin, codes delivered via Resend
 *
 * Desktop (Tauri) clients authenticate with Authorization Code + PKCE over the
 * `insertgo://` URI scheme (app/desktop/authorize + app/api/desktop/token, see
 * lib/desktopAuth.ts) and then call the API with `Authorization: Bearer
 * <session-token>` (bearer plugin).
 */

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

/** Operators allowed to register enterprise SSO providers (see `sso()` below).
 *  Comma-separated in SSO_ADMIN_EMAILS; empty means nobody can register one. */
const SSO_ADMIN_EMAILS = new Set(
  (process.env.SSO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Origins allowed to reach the auth API cross-origin.
 *
 * The two `tauri://`-family entries are the PACKAGED app and belong in every
 * build. `localhost:1420` (Vite dev server) and `localhost:3005` (preview
 * harness) are development-only and must never ship: trustedOrigins feeds Better
 * Auth's originCheckMiddleware, which validates the Origin header AND any
 * `callbackURL`, so a trusted localhost port is a post-sign-in redirect target
 * for anything listening on the user's machine.
 */
const DESKTOP_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:1420", "http://localhost:3005"]
    : []),
];

// Belt and braces: the entry above was already dev-gated once and a second one
// was added beside it without the gate. Fail the build/boot instead of shipping
// it a third time.
if (
  process.env.NODE_ENV === "production" &&
  DESKTOP_ORIGINS.some((o) => /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(o))
) {
  throw new Error(
    "A localhost origin is in trustedOrigins for a production build.",
  );
}

/**
 * Endpoints that actually ESTABLISH a session — the ones whose outcome is a
 * CERT-In Annexure I "unauthorised access" / "identity theft" signal (R-03).
 * These are route TEMPLATES (`ctx.path`), not request URLs, so no identifier
 * from the request ever reaches the audit store through this set.
 *
 * `/sign-in/social` and `/sign-in/sso` are deliberately absent: they only hand
 * back a provider redirect and have authenticated nothing yet, so counting them
 * would inflate every rate rule with traffic that cannot possibly be an attack.
 * The event that matters lands on the callback.
 */
const SIGN_IN_PATHS = new Set([
  "/sign-in/email-otp",
  "/callback/:id", // Google OAuth
  "/sso/callback",
  "/sso/callback/:providerId",
]);

/**
 * Stable pseudonym for the account a failed sign-in was aimed at, so R-03's
 * per-account rule can count attempts against one target without an email
 * address ever entering the 180-day store (R-06 — a log is a place addresses
 * leak from, not a place they belong). Truncated to 64 bits: plenty to keep
 * distinct accounts apart inside a 10-minute window.
 */
function accountSubject(email: unknown): string | null {
  if (typeof email !== "string" || !email.trim()) return null;
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

/**
 * Deliver a sign-in code (R-06).
 *
 * Exported only so a test can reach it: the plugin option it backs is closed
 * over inside `betterAuth()`, and the regression it guards — an address or a
 * live code reaching a production log — has no other symptom.
 *
 * Three rules, in priority order:
 *
 *  1. **The code never reaches a production log.** A logged OTP is not a
 *     privacy finding, it is an authentication bypass: anyone with log access
 *     (project members, a support export, a future log drain) signs in as that
 *     user without touching their mailbox. The guard is `NODE_ENV`, which is
 *     the question being asked. The previous guard was `!resend` — whether a
 *     Resend key happened to be configured — so a production deploy that lost
 *     its key started printing live codes while still looking healthy.
 *  2. **No transport in production fails the request.** Returning quietly told
 *     the client a code had been sent and left the user waiting for mail that
 *     was never sent, while the code sat in the log. Fails closed now, the same
 *     way `app/api/contact/route.ts` already handles the identical case.
 *  3. **Only the pseudonym is logged, never the address** — `accountSubject`,
 *     the same helper the sign-in failure rule uses.
 */
export async function deliverOtp({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: string;
}): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";
  const account = accountSubject(email);
  // R-06 / CERT-In "identity theft": a code request is the first half of every
  // passwordless sign-in, so a burst against one account is credential-stuffing
  // with the password step removed. Pseudonym + type only — the address itself
  // never reaches the table (rule 3 above), and the OTP never leaves this
  // function. No `req`: Better Auth calls this from inside its own handler.
  const record = (outcome: "success" | "failure") =>
    audit("auth.otp.request", {
      outcome,
      detail: { type, subject: account },
    });
  const mailSubject =
    type === "sign-in"
      ? `${otp} is your InsertGo sign-in code`
      : `${otp} is your InsertGo verification code`;

  if (!resend) {
    if (!isDev) {
      safeError("[auth] RESEND_API_KEY is not set — code not sent", {
        account,
        type,
      });
      record("failure");
      throw new Error("Could not send the sign-in code. Please try again.");
    }
    // DEV_SETUP.md's local sign-in reads the code from this line. Not
    // reachable with NODE_ENV=production — the branch above throws first.
    console.log(`[auth][dev] OTP for ${email} (${type}): ${otp}`); // log-hygiene: dev only
    record("success");
    return;
  }

  // The Resend SDK reports API failures in `error` instead of throwing, so an
  // unchecked call returns `{ success: true }` to the client while no mail was
  // ever sent — the user then waits for a code that does not exist. The shared
  // `onboarding@resend.dev` sender in particular only delivers to the Resend
  // account owner's own address.
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "InsertGo <onboarding@resend.dev>",
    to: email,
    subject: mailSubject,
    text: `Your InsertGo code is ${otp}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
  });
  if (!error) {
    record("success");
    return;
  }

  // Through safeError, and never into the thrown message: provider errors quote
  // the request they failed on ("You can only send testing emails to your own
  // address (x@y.com)"), and that string used to be interpolated into an
  // exception Better Auth renders back to an unauthenticated caller.
  safeError(`[auth] OTP delivery failed (account=${account})`, error);
  record("failure");
  if (isDev) {
    // An unverified sending domain shouldn't block local work.
    console.log(`[auth][dev] OTP for ${email} (${type}): ${otp}`); // log-hygiene: dev only
    return;
  }
  throw new Error("Could not send the sign-in code. Please try again.");
}

/**
 * Fixed-vocabulary failure code, or "" when the response carries none.
 * Non-redirect errors carry `body.code` ("INVALID_OTP"); OAuth failures come
 * back as a 302 whose Location has `?error=<code>` (better-auth's
 * `redirectOnError`). Neither is user-supplied text — but this crosses into a
 * bounded column, so cap it regardless.
 */
function failureReason(err: {
  body?: { code?: string } | null;
  headers?: unknown;
}): string {
  const code = err.body?.code;
  if (typeof code === "string" && code) return code.slice(0, 64);
  const location =
    err.headers instanceof Headers ? err.headers.get("location") : null;
  if (!location) return "";
  try {
    return (
      new URL(location, "https://insertgo.ai").searchParams
        .get("error")
        ?.slice(0, 64) ?? ""
    );
  } catch {
    return "";
  }
}

// Cached on `globalThis` for the same reason lib/db.ts is: Next dev HMR
// re-evaluates this module on every edit, and an uncached `new Pool()` here
// strands the previous pool's sockets on the Supabase pooler and makes the next
// request pay a cold TLS handshake (~1.9 s measured against ap-northeast-1).
const g = globalThis as unknown as { __igAuthPool?: Pool };
const authPool = g.__igAuthPool ?? new Pool(pgPoolConfig({ max: 10 }));
if (process.env.NODE_ENV !== "production") g.__igAuthPool = authPool;

export const auth = betterAuth({
  appName: "InsertGo.AI",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // TLS owned by the `ssl` object via pgPoolConfig (see lib/pgSsl.ts), not the
  // connection string — Supabase's chain needs the pinned CA to verify.
  //
  // Passing an adapter rather than the Pool itself is what lets R-04 store
  // `session.token` hashed: this is exactly the adapter Better Auth would build
  // from a `pg` Pool on its own (createKyselyAdapter resolves a Pool to
  // `PostgresDialect` with `databaseType: "postgres"` and no transaction
  // override), wrapped so the raw token never reaches the database. See
  // lib/sessionTokenHash.ts for the invariant and the one known divergence.
  database: (options: BetterAuthOptions) =>
    withHashedSessionTokens(
      kyselyAdapter(
        new Kysely({ dialect: new PostgresDialect({ pool: authPool }) }),
        { type: "postgres" },
      )(options),
    ),

  // Password auth intentionally disabled — OTP / OAuth / SSO only. Nothing
  // writes `account.password`, which is what keeps SPDI under IT Rules 2011
  // Rule 3 out of this database entirely; a CHECK constraint in
  // supabase-session-hardening.sql pins that so it cannot regress silently.
  emailAndPassword: { enabled: false },

  account: {
    // Google's access / refresh / id tokens are credentials for a THIRD PARTY's
    // account, so a database disclosure would reach past this app into the
    // user's Google data. Better Auth encrypts them with AES-256-GCM under
    // BETTER_AUTH_SECRET when this is on, and reads legacy cleartext rows
    // through unchanged — so enabling it needs no migration.
    //
    // The cost is real and belongs in the rotation runbook: rotating
    // BETTER_AUTH_SECRET now orphans every stored OAuth token. See
    // compliance/secret-rotation.md.
    encryptOAuthTokens: true,
  },

  // Both endpoints read sessions by user id, which is the one lookup that
  // cannot recover a raw token from its hash (lib/sessionTokenHash.ts). Left
  // enabled, `/list-sessions` would hand a client hashes it might treat as
  // credentials and `/revoke-other-sessions` would answer `{status: true}`
  // having revoked nothing. Neither has a UI here; 404 beats a silent lie.
  // `/sign-out`, `/revoke-session` and `/revoke-sessions` are unaffected.
  disabledPaths: ["/list-sessions", "/revoke-other-sessions"],

  // Desktop (Tauri) app origins — allowed to hit the auth API cross-origin.
  // trustedOrigins gates originCheckMiddleware, which validates BOTH the Origin
  // header and any `callbackURL`, so a dev origin left in a production build
  // widens the set of post-sign-in redirect targets to whatever answers on that
  // localhost port on the victim's machine.
  trustedOrigins: DESKTOP_ORIGINS,

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  /**
   * A 30-day SLIDING window, not a 30-day fixed one.
   *
   * `updateAge` is what makes it sliding: on the first request more than 24h
   * after the last extension, `/get-session` pushes `expiresAt` back out to
   * now + `expiresIn` and re-issues the cookie. So the window only ever runs
   * down while nobody is using the account — an active user is never signed
   * out, and an abandoned session still dies 30 days after its last use. That
   * is the property the old 7-day value was reaching for and got wrong: it
   * capped the ACTIVE user too, and the desktop client turns any expiry into a
   * full re-auth through the system browser (authStore.ts `refreshStatus`).
   *
   * Why 24h and not shorter: every extension is a database write on the hot
   * path of every request. At 24h the write amortises to once per user per
   * day; at, say, an hour it would be 24× that for no security gain, because
   * revocation does not run through expiry at all — `/sign-out` and
   * `/revoke-session` delete the row, and the next lookup misses immediately.
   *
   * The 5-minute `cookieCache` is the read-side counterpart: it serves the
   * session from a signed cookie so the 30-day window costs a database read
   * only once per 5 minutes per client. It is deliberately short — a
   * server-side revocation is invisible for at most that long, and
   * customSession entitlement fields are never cached in it at all.
   */
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, refreshed on use — see above
    updateAge: 60 * 60 * 24, // extend at most once a day (one write/user/day)
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    // Never expose whether an email exists beyond what the flow requires.
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20, // global default; auth endpoints have stricter built-ins
  },

  hooks: {
    /**
     * Sign-in evidence for the audit log (R-03). This is the highest-volume
     * Annexure I signal the estate produces, and until now none of it was
     * recorded anywhere that survives a week.
     *
     * Why the request-level hook and not `databaseHooks`: a session row is
     * written only when authentication SUCCEEDS, so a database hook can never
     * see a failure — and failures are the entire input to the
     * credential-stuffing rule. `dispatchAuthEndpoint` catches a thrown
     * APIError, parks it on `context.returned`, and then runs the after-hooks,
     * so this seam sees both outcomes.
     *
     * Never awaited by the caller and never able to fail the request: `audit()`
     * is fire-and-forget and swallows its own errors, so a broken audit sink
     * degrades sign-in logging, not sign-in.
     */
    after: createAuthMiddleware(async (ctx) => {
      if (!SIGN_IN_PATHS.has(ctx.path)) return;

      // A new session is the unambiguous success signal, and the only one:
      // a successful OAuth callback ALSO leaves as a 302 APIError, so the
      // presence of an error object proves nothing on its own.
      const userId = ctx.context.newSession?.user?.id;
      if (userId) {
        audit("auth.signin", {
          outcome: "success",
          req: ctx.request,
          userId,
          detail: { path: ctx.path },
        });
        return;
      }

      const returned = ctx.context.returned;
      // No session and no error: an account-link callback, or a lane that
      // authenticated nothing. Recording an outcome we cannot determine would
      // put noise into a threshold rule — leave it out.
      if (!isAPIError(returned)) return;
      const status =
        typeof returned.statusCode === "number" ? returned.statusCode : 0;
      const reason = failureReason(returned);
      // 302 is how BOTH outcomes leave the OAuth callback; only the failure
      // redirect carries `?error=`. Without this, every account-link callback
      // reads as a failed sign-in and inflates the rule watching them.
      if (status === 302 && !reason) return;

      audit("auth.signin", {
        outcome: "failure",
        req: ctx.request,
        detail: {
          path: ctx.path,
          status,
          reason: reason || "unspecified",
          // Present only on the OTP lane, where the request names the account.
          // R-03's per-account rule reads this key; the address itself never
          // reaches the table.
          subject: accountSubject(
            (ctx.body as { email?: unknown } | undefined)?.email,
          ),
        },
      });
    }),
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5, // 5 minutes
      allowedAttempts: 3,
      sendVerificationOTP: deliverOtp,
    }),

    // OIDC providers are registered at runtime via /api/auth/sso/register.
    // Better Auth gates that endpoint on a session ALONE: without the limit
    // below, any signed-in user could register a provider claiming any email
    // domain. Domain verification is off (the `ssoProvider` table has no
    // `domainVerified` column, see supabase-auth-schema.sql), so a claimed
    // domain would route that domain's real employees straight to an
    // attacker-controlled IdP on our sign-in flow. A limit of 0 makes the
    // endpoint return 403 for everyone not on the operator allowlist.
    sso({
      providersLimit: (user) =>
        SSO_ADMIN_EMAILS.has((user.email ?? "").toLowerCase()) ? 10 : 0,
    }),

    bearer(), // lets the desktop app use `Authorization: Bearer <session-token>`

    // Adds billing entitlements to every get-session response. New desktop
    // builds read `tier` / `dailyCreditsRemaining` / `dailyCreditsMax` /
    // `addOnCredits` / `historyAllowed`; pre-3-tier builds
    // still read the legacy `subscriptionStatus` / `credits` stamps (mapped
    // from the tier model so nothing breaks mid-rollout). customSession
    // fields are never cookie-cached, so a webhook-driven change is visible
    // on the next fetch. On a DB blip we fall back to free-tier defaults
    // rather than failing the whole session read.
    customSession(async ({ user, session }) => {
      let tier: Tier = "free";
      let addOnCredits = 0;
      let remaining = TIER_DAILY_CREDITS.free;
      try {
        const { rows } = await pool.query(
          `select "tier", "subscriptionStatus", "addOnCredits",
                  "dailyCreditsUsed",
                  to_char("dailyCreditsDate", 'YYYY-MM-DD') as "dailyDate"
             from "user" where "id" = $1`,
          [user.id],
        );
        const row = (rows[0] ?? {}) as Record<string, unknown>;
        tier = normalizeTier(row);
        addOnCredits =
          typeof row.addOnCredits === "number" &&
          Number.isFinite(row.addOnCredits)
            ? row.addOnCredits
            : 0;
        remaining = dailyRemaining(row, tier);
      } catch (e) {
        // safeError, not console.error: a pg error's `detail` quotes the row it
        // failed on, and this query's row is the user's.
        safeError("[auth] entitlement lookup failed; using defaults", e);
      }
      return {
        user: {
          ...user,
          tier,
          dailyCreditsRemaining: remaining,
          dailyCreditsMax: TIER_DAILY_CREDITS[tier],
          addOnCredits,
          historyAllowed: tierAllowsHistory(tier),
          // Legacy stamps for pre-3-tier clients: paid tiers read as
          // "subscribed", free as "trial"; credits = total spendable now.
          subscriptionStatus: tier === "free" ? "trial" : "subscribed",
          credits: remaining + addOnCredits,
        },
        session,
      };
    }),

    // Must be last: writes Set-Cookie headers in Next.js server actions.
    nextCookies(),
  ],
});
