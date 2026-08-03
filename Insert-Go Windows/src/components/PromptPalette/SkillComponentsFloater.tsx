/**
 * "Skill Components" floater — the review surface for one-click skill runs
 * (SPEC §4.1 extension). Hosted in TWO places: as an in-app overlay over the
 * main panel for editor-source runs (same dialog pattern as
 * TemplateFillDialog), and as the entire surface of the dedicated selection
 * review floater window (`selfloater`) for selection-bar runs — the main
 * palette never opens for those. Shows the invoked skill, streams the
 * generated prompt into a read-only screen, and offers Apply (commit the
 * draft into the composer / paste over the selection) plus an iterative Edit
 * loop that refines the draft via composeRefinePrompt/REFINE_SYSTEM through
 * the shared send path (useProviderRun).
 *
 * SECURITY: the draft is model output and renders exclusively through React
 * text nodes (like ResultView) — no `dangerouslySetInnerHTML`, no
 * markdown-to-DOM. In the refine loop the draft travels inside a <draft>
 * data boundary and is treated as data, never instructions (REFINE_SYSTEM;
 * OWASP LLM01).
 */
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { AUTO_HEIGHT_TRANSITION } from "@/hooks/useAutoWindowHeight";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { REFINE_SYSTEM, composeRefinePrompt } from "@/services/skills";
import { copyToClipboard } from "@/services/clipboard";
import { openExternal } from "@/services/openExternal";
import { selectionFloaterInsert } from "@/services/selectionBar";
import { isTauri } from "@/services/tauriBridge";
import { startWindowDrag } from "@/services/windowChrome";
import { usePromptStore } from "@/store/promptStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "@/store/toastStore";
import { ThinkingOrb } from "@/components/ui/ThinkingOrb";
import { ProxyOverloadCard, isOverloadError } from "./ProxyOverloadCard";

type Props = {
  /** The palette's provider-send callback (same contract as SkillButtons). */
  onRun: (
    promptText: string,
    system?: string,
    transform?: (text: string) => string,
    visible?: (accumulated: string) => string | null,
    getThinking?: (accumulated: string) => string | null,
  ) => void | Promise<void>;
  editorRef: RefObject<HTMLTextAreaElement>;
  /** Selfloater window only (useAutoWindowHeight wiring): the card is the
   *  edge-to-edge window surface there, so its height animates to the target
   *  OS-window height and the screen/probe refs feed the measurement. Absent
   *  for the in-app overlay — the card renders exactly as before. */
  autoHeight?: {
    height: number | null;
    onAnimationComplete: () => void;
    screenRef: RefObject<HTMLDivElement>;
    contentRef: RefObject<HTMLDivElement>;
  };
};

export function SkillComponentsFloater({ onRun, editorRef, autoHeight }: Props) {
  const activeSkill = usePromptStore((s) => s.activeSkill);
  const result = usePromptStore((s) => s.result);
  const thinking = usePromptStore((s) => s.thinking);
  const grounding = usePromptStore((s) => s.grounding);
  const isSending = usePromptStore((s) => s.isSending);
  const error = usePromptStore((s) => s.error);
  const metrics = usePromptStore((s) => s.metrics);
  const setBody = usePromptStore((s) => s.setBody);
  const retryRun = usePromptStore((s) => s.retryRun);
  const closeSkillFloater = usePromptStore((s) => s.closeSkillFloater);
  const activeProvider = useSettingsStore((s) => s.activeProvider);

  const cardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState("");
  // Reasoning auto-expands while streaming. Collapse only after the run ends,
  // not when the first result token lands: that avoids shrinking the measured
  // window mid-stream while leaving the finished artifact visually primary.
  // The user can toggle it freely after this one state transition.
  const [thinkingOpen, setThinkingOpen] = useState(true);
  // Copy-button feedback: swap to "Copied!" / fa-check for 2s. One timer ref,
  // cleared before each re-arm so rapid clicks don't flicker, and on unmount.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Citations are relayed model/web data, so only http(s) links are offered:
  // a `javascript:`/`file:` uri must never reach openExternal. Also the "has
  // chunks" gate — a grounded run that surfaced no usable source renders no
  // Sources block at all.
  const sources = (grounding?.chunks ?? []).filter((c) =>
    /^https?:\/\//i.test(c.uri),
  );

  // A non-empty `result` is the deliverable; "" is the transient gap between
  // </analysis> and the first <final> token (visibleStreamText yields "" there)
  // — treat it as not-ready so the screen doesn't flash empty mid-run.
  const hasDeliverable = result !== null && result.length > 0;

  useEffect(() => {
    if (!hasDeliverable) setThinkingOpen(true);
    else if (!isSending) setThinkingOpen(false);
  }, [hasDeliverable, isSending]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Copy the deliverable to the system clipboard (copyToClipboard handles the
  // Tauri-plugin / Web-API fallback). On success flash "Copied!"; on failure
  // (locked-down webview) toast the error and leave the label untouched.
  const onCopy = useCallback(async () => {
    if (!result) return;
    try {
      await copyToClipboard(result);
      toast.success("Copied to clipboard");
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [result]);

  // Esc closes the floater (and aborts any in-flight run via
  // closeSkillFloater) without the Rust global-Esc hiding the whole window.
  useAppShortcuts({
    onClose: () => {
      closeSkillFloater();
    },
  });

  // Click-outside closes. There is no scrim wrapper anymore (the card's
  // glass must frost the real panel content, not a tinted overlay), so the
  // dismiss surface is a document-level mousedown: anything outside the card
  // closes it. mousedown, not click — a drag that starts inside and ends
  // outside must not dismiss.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        closeSkillFloater();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [closeSkillFloater]);

  // Apply the reviewed draft. source "editor": commit it as the composer
  // body (mirrors ResultView's "Replace editor") and close. source
  // "selection" (bar handoff, floater window): paste it over the original
  // selection via the shared insert pipeline — Rust hides the FLOATER
  // window, refocuses the captured target and pastes. On a landed paste the
  // floater state is cleared; on failure the text stays on the clipboard,
  // the floater window is re-shown (insert:fallback toast) and the card
  // stays up so Apply is retryable.
  const onApply = useCallback(() => {
    if (result === null || !activeSkill) return;
    setBody(result);
    if (activeSkill.source === "selection") {
      if (!isTauri()) {
        closeSkillFloater();
        return;
      }
      void selectionFloaterInsert(result)
        .then((pasted) => {
          if (pasted) closeSkillFloater();
        })
        .catch((e) => toast.error(`Insert failed: ${e}`));
      return;
    }
    closeSkillFloater();
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [result, activeSkill, setBody, closeSkillFloater, editorRef]);

  const onSubmitRefine = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = instruction.trim();
      if (!trimmed || result === null || isSending) return;
      // REFINE_SYSTEM returns only the revised prompt, so no transform /
      // visible gate — the revision streams straight into `result`.
      void onRun(composeRefinePrompt(result, trimmed), REFINE_SYSTEM);
      setInstruction("");
    },
    [instruction, result, isSending, onRun],
  );

  if (!activeSkill) return null;
  const provider = activeProvider();

  // In the dedicated floater window the card IS the window surface, and the
  // design's grab-the-glass affordance maps to a native window drag. Manual
  // startWindowDrag instead of `data-tauri-drag-region`: the injected
  // attribute handler only fires when the mousedown TARGET itself carries
  // the attribute, so the title/skill-row children never dragged — the
  // React handler bubbles from them. Interactive children and the screen
  // (text selection) are excluded; startWindowDrag also flags
  // isManipulatingWindow so useAutoWindowHeight holds off mid-drag. Never
  // set for the in-app overlay — it would drag the whole palette window.
  const onDragStart =
    activeSkill.source === "selection" && isTauri()
      ? (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (
            target.closest(
              "button, input, textarea, select, a, summary, .ig-skillfloater__screen",
            )
          )
            return;
          void startWindowDrag();
        }
      : undefined;

  return (
    <motion.div
      ref={cardRef}
      className="ig-modal__card ig-skillfloater"
      role="dialog"
      aria-label="Skill Components"
      initial={false}
      animate={
        autoHeight?.height == null ? undefined : { height: autoHeight.height }
      }
      transition={AUTO_HEIGHT_TRANSITION}
      onAnimationComplete={autoHeight?.onAnimationComplete}
      onMouseDown={onDragStart}
    >
      <div className="ig-skillfloater__head">
        <div className="ig-modal__title">Skill Components</div>
        <button
          type="button"
          className="ig-btn ig-skillfloater__close"
          onClick={closeSkillFloater}
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div className="ig-skillfloater__skill">
        <i className={`fa-solid ${activeSkill.icon}`} aria-hidden="true" />
        <span>{activeSkill.label}</span>
        {/* Result streaming in: small composing orb in the skill chip. */}
        {isSending && result !== null && (
          <ThinkingOrb state="composing" size={20} />
        )}
      </div>

      {/* Elapsed time only — TTFT / tok/s stay in RunMetrics for history
          logging, but the review card shows no token shower. */}
      {metrics && (
        <div className="ig-chips" aria-label="Latency metrics">
          <span className="ig-chip">
            {(metrics.totalMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {thinking && (
        <details
          className="ig-thinking"
          open={thinkingOpen}
          onToggle={(e) => setThinkingOpen(e.currentTarget.open)}
        >
          <summary className="ig-thinking__summary">
            {isSending && <ThinkingOrb state="searching" size={20} />}
            Thinking
          </summary>
          <div className="ig-thinking__text">{thinking}</div>
        </details>
      )}

      <div className="ig-skillfloater__screen" ref={autoHeight?.screenRef}>
        {/* Probe div: unconstrained inside the scroll cell, so its height is
            the deliverable's natural height (useAutoWindowHeight target). */}
        <div ref={autoHeight?.contentRef}>
          {hasDeliverable ? (
            <div className="ig-result__text">{result}</div>
          ) : isSending && !thinking ? (
            // Pre-analysis (or a run with no reasoning): the thinking orb.
            // Once thinking streams, the reasoning area above is the cue.
            <div className="ig-working" role="status" aria-label="Working">
              <ThinkingOrb state="working" size={64} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Web sources behind a grounded run (learn-more / answer-this-question).
          Same collapsible treatment as Thinking, closed by default — the
          deliverable stays primary. Google's searchSuggestionHtml is
          deliberately NOT rendered: this surface has a no-innerHTML rule. */}
      {sources.length > 0 && (
        <details className="ig-thinking">
          <summary className="ig-thinking__summary">
            <i className="fa-solid fa-globe" aria-hidden="true" />
            Sources ({sources.length})
          </summary>
          <ul className="ig-thinking__text ig-sources">
            {sources.map((c) => (
              <li key={c.uri}>
                <a
                  href={c.uri}
                  title={c.uri}
                  onClick={(e) => {
                    // Open in the system browser, never in this webview.
                    e.preventDefault();
                    void openExternal(c.uri).catch(() =>
                      toast.error("Couldn't open the link"),
                    );
                  }}
                >
                  {c.title || c.uri}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Every run type reviews here, so this is where a relay capacity 503
          actually lands — same cooldown/retry card as the composer. */}
      {error &&
        (isOverloadError(error) && retryRun ? (
          <ProxyOverloadCard onRetry={retryRun} busy={isSending} />
        ) : (
          <div className="ig-error">{error}</div>
        ))}

      {editing && provider && (
        <form className="ig-skillfloater__refine" onSubmit={onSubmitRefine}>
          <input
            className="ig-input"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Describe the change… (Enter to refine)"
            aria-label="Refine instruction"
            autoFocus
          />
          <button
            type="submit"
            className="ig-btn"
            disabled={isSending || !instruction.trim() || result === null}
          >
            Refine
          </button>
        </form>
      )}

      <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="ig-btn"
          onClick={onCopy}
          disabled={!result || isSending}
          aria-label="Copy output"
        >
          <i
            className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}
            aria-hidden="true"
          />
          {copied ? "Copied!" : "Copy"}
        </button>
        {provider && (
          <button
            type="button"
            className="ig-btn"
            onClick={() => setEditing((v) => !v)}
            disabled={result === null}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          className="ig-btn ig-btn--primary"
          onClick={onApply}
          disabled={isSending || !result}
        >
          Apply
        </button>
      </div>
    </motion.div>
  );
}
