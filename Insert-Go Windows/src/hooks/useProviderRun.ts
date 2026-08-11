/**
 * Shared provider-send path, extracted from PromptPalette so the selection
 * review floater window (a separate webview) can run skills through the
 * exact same pipeline: lane resolution (SPEC §16.1), abort-on-supersede,
 * ~20 fps stream coalescing (SPEC §11) and the authoritative completion
 * write. All run state lands in the caller's own promptStore instance
 * (stores are per-JS-context, i.e. per window).
 */
import { useCallback, useEffect, useRef } from "react";
import { resolveActiveProvider } from "@/services/aiProviders";
import { usePromptStore } from "@/store/promptStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

/** Coalesce streamed store writes to ~20 fps (SPEC §11 latency work). Gemini
 *  emits deltas far faster than that; one setResult/setMetrics per token means
 *  a React render per token, thrashing the main thread on a long response and
 *  making the text paint *slower*, not faster. The authoritative completion
 *  write always repaints the full final, so dropping intermediate frames is
 *  invisible — the visible text just updates smoothly instead of per token. */
const STREAM_PAINT_MS = 50;

export type ProviderRun = (
  promptText: string,
  system?: string,
  transform?: (text: string) => string,
  visible?: (accumulated: string) => string | null,
  getThinking?: (accumulated: string) => string | null,
  /** Ask the relay for a web-grounded two-pass run (resolveSkillGrounding).
   *  Its citations arrive after the stream and land in `grounding`. */
  grounded?: boolean
) => Promise<void>;

export function useProviderRun(): ProviderRun {
  const user = useAuthStore((s) => s.user);
  // Setters are read via getState() inside the run, NOT subscribed to.
  // `usePromptStore()` with no selector subscribes to the whole store, so
  // every streamed setResult/setThinking/setMetrics (~60/s at 20 fps) would
  // re-render this hook's owner — i.e. the entire composer tree — per delta.

  // One controller per run: starting a new run (or reset()/unmount) aborts
  // the previous stream, so a stale delta can never write into the store.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // `system` lets a skill override the provider's default refiner,
  // `transform` post-processes the complete response (strip <analysis> tags),
  // and `visible` gates what a partially streamed response may show (null =
  // keep the working state). The completion-time setResult is authoritative:
  // whatever streamed, the final text is recomputed from the full response,
  // guaranteeing byte-parity with the pre-streaming pipeline.
  const run = useCallback<ProviderRun>(
    async (promptText, system, transform, visible, getThinking, grounded) => {
      const {
        setResult,
        setThinking,
        setGrounding,
        setSending,
        setError,
        setMetrics,
        setAbortRun,
        setRetryRun,
      } = usePromptStore.getState();
      // Resolve the provider before touching run state. The managed relay
      // needs an InsertGo login.
      let resolved;
      try {
        resolved = await resolveActiveProvider("chat");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      if (resolved.requiresLogin && !user) {
        setError("You must be logged in to use the AI assistant.");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAbortRun(() => controller.abort());
      // Replay handle for retryable failures (relay capacity 503). Registered
      // once per dispatch so every surface — composer, skill floater, the
      // selection floater window — retries the SAME run, transforms included.
      setRetryRun(() =>
        void run(promptText, system, transform, visible, getThinking, grounded)
      );
      // A run is stale once it is no longer the current run or its signal
      // fired (new run started, reset() cleared the store, unmount).
      const isStale = () =>
        abortRef.current !== controller || controller.signal.aborted;

      const startedAt = performance.now();
      let ttftMs: number | null = null;
      let chars = 0;
      let lastPaintAt = 0;

      setSending(true);
      setError(null);
      setResult(null);
      setThinking(null);
      // Citations belong to exactly one run: clearing here means an aborted or
      // superseded grounded run can never leave its Sources block behind.
      setGrounding(null);
      setMetrics(null);
      try {
        const res = await resolved.provider.send(
          { prompt: promptText, system, grounded },
          {
            signal: controller.signal,
            onText: (delta, snapshot) => {
              if (isStale()) return;
              const now = performance.now();
              if (ttftMs === null) ttftMs = now - startedAt;
              chars += delta.length;
              // First delta always paints (TTFT chip + first visible text);
              // later deltas at most once per STREAM_PAINT_MS. `chars` still
              // accumulates every delta, so the next paint's metrics are exact.
              if (lastPaintAt !== 0 && now - lastPaintAt < STREAM_PAINT_MS) {
                return;
              }
              lastPaintAt = now;
              setMetrics({
                ttftMs,
                totalMs: now - startedAt,
                chars,
                outputTokens: null,
              });
              // Thinking (skill <analysis>) and the deliverable (<final>) are
              // separate channels: the reasoning shows live so TTFT is the
              // first analysis token, while `result` still only ever holds the
              // artifact from `visible`. null leaves the prior value untouched.
              if (getThinking) {
                const t = getThinking(snapshot);
                if (t !== null) setThinking(t);
              }
              const shown = visible ? visible(snapshot) : snapshot;
              if (shown !== null) setResult(shown);
            },
          }
        );
        if (isStale()) return;
        setResult(transform ? transform(res.text) : res.text);
        if (res.grounding) setGrounding(res.grounding);
        setMetrics({
          ttftMs,
          totalMs: performance.now() - startedAt,
          chars,
          outputTokens: res.outputTokens ?? null,
        });
      } catch (e) {
        // An aborted run was superseded or cleared — its error is noise.
        if (isStale()) return;
        setError(String(e));
        toast.error(`Provider call failed: ${e}`);
      } finally {
        if (!isStale()) {
          setSending(false);
          setAbortRun(null);
        }
      }
    },
    [user]
  );
  return run;
}
