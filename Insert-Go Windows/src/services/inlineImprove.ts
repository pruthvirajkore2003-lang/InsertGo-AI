/**
 * Inline Improve orchestration — the frontend leg of SPEC §4.4/§5.6.
 *
 * Rust owns capture (hotkey → whole-field read → password/empty guards →
 * undo snapshot → `improve:draft` event); this module owns the parts that
 * live in TS: adapter lookup, the placeholder guard, the LLM call through
 * the existing provider lane, output sanitizing, and the `replace_text`
 * write-back. Every terminal outcome reports to Rust via `improve_status`,
 * which drives the progress chip and re-arms the hotkey.
 *
 * Privacy (SPEC §10): the captured draft and the improved text are never
 * logged — errors surface as provider messages only.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  isPlaceholderText,
  resolveImproveAdapter,
} from "@/services/improveAdapters";
import { resolveActiveProvider } from "@/services/lanes";
import { runDynamicRefine } from "@/services/promptRefiner";
import {
  IMPROVE_SYSTEM,
  composeImprovePrompt,
  sanitizeImprovedOutput,
  type ImproveMode,
} from "@/services/skills";
import { useAuthStore } from "@/store/authStore";
import { markFirstImproveDone } from "@/store/settingsStore";

/** Rust command identifiers — must match `#[tauri::command]` fn names. */
export const ImproveCommands = {
  replaceText: "replace_text",
  improveStatus: "improve_status",
} as const;

/** `improve:draft` payload emitted by platform/improve.rs. */
export type ImproveDraftPayload = {
  text: string;
  processName: string;
  windowTitle: string;
};

/** `refine:context` payload emitted by platform/improve.rs (Dynamic Refine):
 *  the focused field's draft plus the window's visible conversation region
 *  (null when the accessibility read yielded nothing). */
export type RefineContextPayload = {
  draft: string;
  conversation: string | null;
  processName: string;
  windowTitle: string;
};

/** Improvement mode used by the hotkey flow. Per-run mode selection (chord /
 *  long-press, SPEC §4.4) is a later slice; enhance is the SPEC default. */
export const DEFAULT_IMPROVE_MODE: ImproveMode = "enhance";

/** Drafts longer than this are too slow/risky to replace inline (§5.6.3). */
const MAX_INLINE_DRAFT_CHARS = 8000;

/** Hard end-to-end timeout for the LLM leg (§5.6.3): on expiry the run is
 *  aborted and the field stays untouched. */
const IMPROVE_TIMEOUT_MS = 15_000;

/** Replace the whole focused field of the captured target with `text`. */
export function replaceText(text: string): Promise<void> {
  return invoke(ImproveCommands.replaceText, { text });
}

/** Report a run outcome to Rust (chip + in-flight bookkeeping). */
export function improveStatus(
  state: "done" | "error" | "aborted",
  message?: string
): Promise<void> {
  return invoke(ImproveCommands.improveStatus, { state, message });
}

/** A captured draft is ready for the improve run. */
export function onImproveDraft(
  cb: (payload: ImproveDraftPayload) => void
): Promise<UnlistenFn> {
  return listen<ImproveDraftPayload>("improve:draft", (e) => cb(e.payload));
}

/** Rust routed a terminal target to the palette (capture unavailable). */
export function onImproveRoutePalette(cb: () => void): Promise<UnlistenFn> {
  return listen("improve:route-palette", () => cb());
}

/** The Improve chord fired while one of InsertGo's own windows was foreground.
 *  Rust performs no capture in that case, but the event still has to exist:
 *  Windows RegisterHotKey swallows the keystroke, so a focused webview never
 *  sees the keydown. First-run sandbox surfaces subscribe so the user can
 *  press the real chord; nothing else listens. */
export function onImproveOwnWindow(cb: () => void): Promise<UnlistenFn> {
  return listen("improve:own-window", () => cb());
}

/** A Dynamic Refine capture is ready for the condense run. */
export function onRefineContext(
  cb: (payload: RefineContextPayload) => void
): Promise<UnlistenFn> {
  return listen<RefineContextPayload>("refine:context", (e) => cb(e.payload));
}

/** Outcome of the LLM leg. A discriminated union, not a throw, because the
 *  two callers map the SAME failure to different surfaces: the hotkey flow
 *  turns it into a chip state, the onboarding sandbox into inline text. */
export type ImproveLegOutcome =
  | { ok: true; text: string }
  | {
      ok: false;
      /** `login` — the proxy lane needs an InsertGo session.
       *  `timeout` — the hard §5.6.3 deadline expired.
       *  `rejected` — the model's answer failed the output sanitizer.
       *  `failed` — anything else (lane misconfigured, network, provider). */
      kind: "login" | "timeout" | "rejected" | "failed";
      message: string;
    };

/**
 * The provider leg of an Improve run: resolve the active lane, send the
 * composed prompt under the hard timeout, sanitize the answer. No OS access
 * at all — no capture, no write-back — so the onboarding sandbox can exercise
 * the exact same pipeline as the hotkey without touching another app's field.
 *
 * Callers own the surrounding contract (placeholder/length guards, status
 * reporting, write-back); this function never mutates anything.
 */
export async function improveDraftLeg(
  draft: string,
  mode: ImproveMode = DEFAULT_IMPROVE_MODE,
  targetProfile?: string
): Promise<ImproveLegOutcome> {
  try {
    // Same resolution as the palette: the managed relay, which needs a
    // login. Resolution throws an actionable message; the catch surfaces it.
    const { provider, requiresLogin } = await resolveActiveProvider("improve");
    if (requiresLogin && !useAuthStore.getState().user) {
      return {
        ok: false,
        kind: "login",
        message: "Log in to InsertGo to use Improve",
      };
    }

    // Hard timeout (§5.6.3): abort the request; nothing is written anywhere.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPROVE_TIMEOUT_MS);
    let text: string;
    try {
      const res = await provider.send(
        {
          prompt: composeImprovePrompt(draft, mode, targetProfile),
          system: IMPROVE_SYSTEM,
          // §15.4: rewrites should be stable and re-runnable. Lanes whose
          // API rejects sampling params (Anthropic, proxy) simply omit it.
          temperature: 0.3,
        },
        { signal: controller.signal }
      );
      text = res.text;
    } catch (e) {
      if (controller.signal.aborted) {
        return { ok: false, kind: "timeout", message: "Improve timed out" };
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const improved = sanitizeImprovedOutput(draft, text, mode);
    if (improved === null) {
      return {
        ok: false,
        kind: "rejected",
        message: "Result didn't look like an improved prompt",
      };
    }
    return { ok: true, text: improved };
  } catch (e) {
    return {
      ok: false,
      kind: "failed",
      message: e instanceof Error ? e.message : "Improve failed",
    };
  }
}

/**
 * Run one Improve turn for a captured draft. Guarantees the SPEC §4.4
 * contract from this side: the field is mutated only after the improved
 * text passed the sanitizer; every abort path reports a status instead of
 * writing back.
 */
export async function runInlineImprove(
  payload: ImproveDraftPayload,
  mode: ImproveMode = DEFAULT_IMPROVE_MODE
): Promise<void> {
  const draft = payload.text;
  const adapter = resolveImproveAdapter(payload.processName, payload.windowTitle);

  try {
    if (isPlaceholderText(adapter, draft)) {
      await improveStatus("aborted", "Nothing to improve");
      return;
    }
    if (draft.length > MAX_INLINE_DRAFT_CHARS) {
      await improveStatus(
        "aborted",
        "Draft too long for inline replace — use the palette"
      );
      return;
    }

    const leg = await improveDraftLeg(draft, mode, adapter.targetProfile);
    if (!leg.ok) {
      // "aborted" is the quiet no-mutation path; a login/timeout/transport
      // problem is a real error the chip should show as one.
      const state = leg.kind === "rejected" ? "aborted" : "error";
      await improveStatus(
        state,
        `${leg.message} — field unchanged`.slice(0, 140)
      );
      return;
    }

    // Write-back. replace_text handles focus restore/verification and falls
    // back to "left on the clipboard" (insert:fallback) on its own.
    await replaceText(leg.text);
    await improveStatus("done", "Improved — Ctrl+Alt+Z to undo");
    // Activation: the chord has now done the thing it exists for in a real
    // app, so the composer's first-run card has nothing left to teach.
    // Best-effort — a failed settings write must not turn a successful
    // improve into an error path.
    void markFirstImproveDone().catch(() => undefined);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Improve failed — field unchanged";
    // Best-effort: improve_status failing too would only leave the chip
    // stale until Rust's watchdog clears it.
    await improveStatus("error", message.slice(0, 140)).catch(() => undefined);
  }
}

/**
 * Run one Dynamic Refine turn for a captured context. Same SPEC §4.4
 * write-back contract as `runInlineImprove`: the field is mutated only after
 * the condensed prompt passed the sanitizer; every abort path reports a
 * status instead of writing back. The "AI apps only" rule is enforced here
 * through the adapter's `supportsDynamicRefine` gate — the second layer over
 * Rust's own-process/password/terminal guards.
 */
export async function runInlineRefine(
  payload: RefineContextPayload
): Promise<void> {
  const adapter = resolveImproveAdapter(payload.processName, payload.windowTitle);

  try {
    if (!adapter.supportsDynamicRefine) {
      await improveStatus(
        "aborted",
        "Dynamic Refine works only in AI app surfaces"
      );
      return;
    }
    // A placeholder-only field is effectively empty: condense the
    // conversation's open thread instead of "refining" placeholder chrome.
    const draft = isPlaceholderText(adapter, payload.draft) ? "" : payload.draft;
    if (draft.length > MAX_INLINE_DRAFT_CHARS) {
      await improveStatus(
        "aborted",
        "Draft too long for inline replace — use the palette"
      );
      return;
    }
    if (!draft.trim() && !payload.conversation?.trim()) {
      await improveStatus("aborted", "Nothing to refine");
      return;
    }
    // Same lane derivation and login rule as Improve (SPEC §16.1).
    const { provider, requiresLogin } = await resolveActiveProvider("improve");
    if (requiresLogin && !useAuthStore.getState().user) {
      await improveStatus("error", "Log in to InsertGo to use Refine");
      return;
    }

    // Hard timeout (§5.6.3): abort the request; the field stays untouched.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPROVE_TIMEOUT_MS);
    let refined: string;
    try {
      refined = await runDynamicRefine(
        provider,
        {
          conversation: payload.conversation,
          draft,
          targetProfile: adapter.targetProfile,
        },
        { signal: controller.signal }
      );
    } catch (e) {
      if (controller.signal.aborted) {
        await improveStatus("error", "Refine timed out — field unchanged");
        return;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    await replaceText(refined);
    // Make a context-less degradation visible: when the accessibility read
    // yielded no transcript, say so instead of silently condensing the
    // draft alone (SPEC §5.6 — no silent degradation).
    if (payload.conversation?.trim()) {
      await improveStatus("done", "Refined — Ctrl+Alt+Z to undo");
    } else {
      await improveStatus(
        "done",
        "Refined from your draft only — open the chat so its text is on screen. Ctrl+Alt+Z to undo"
      );
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Refine failed — field unchanged";
    await improveStatus("error", message.slice(0, 140)).catch(() => undefined);
  }
}
