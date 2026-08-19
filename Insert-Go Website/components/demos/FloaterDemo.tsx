"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LinearAdd } from "../icons/LinearAdd";
import { LinearMagicStar } from "../icons/LinearMagicStar";
import { LinearTickCircle } from "../icons/LinearTickCircle";
import { SPRING } from "../Reveal";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import {
  FLOATER_INITIAL,
  FLOATER_PROMPTS,
  floaterReducer,
  type PromptId,
} from "@/lib/floaterDemoMachine";
import { trackDemo } from "@/lib/demoAnalytics";
import { useDemoView } from "./useDemoView";
import { arrowNav } from "./arrowNav";

const DOC_BASE =
  "Q3 revenue grew 18% quarter over quarter, driven almost entirely by the new self-serve tier.";

/* Streams `text` visually, character by character. The animated layer is
   aria-hidden — assistive tech gets the full sentence once, from the demo's
   live region, never 150 DOM mutations. */
function StreamText({
  text,
  instant,
  onDone,
}: {
  text: string;
  instant: boolean;
  onDone: () => void;
}) {
  const [n, setN] = useState(instant ? text.length : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (instant) {
      setN(text.length);
      doneRef.current();
      return;
    }
    setN(0);
    const t = setInterval(() => {
      setN((cur) => {
        const next = Math.min(cur + 2, text.length);
        if (next === text.length) {
          clearInterval(t);
          // let the last characters paint before the phase flips
          setTimeout(() => doneRef.current(), 120);
        }
        return next;
      });
    }, 24);
    return () => clearInterval(t);
  }, [text, instant]);
  return <span aria-hidden="true">{text.slice(0, n)}</span>;
}

function Keycaps({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-[5px] align-middle">
      {keys.map((k) => (
        <span
          key={k}
          className="glass-chip rounded-md border-b-2 px-[8px] py-[3px] font-sans text-[11px] font-medium text-ink"
        >
          {k}
        </span>
      ))}
    </span>
  );
}

export function FloaterDemo() {
  const reduce = useReducedMotion() ?? false;
  const [state, dispatch] = useReducer(floaterReducer, FLOATER_INITIAL);
  const { phase, promptId } = state;
  const [streaming, setStreaming] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstChipRef = useRef<HTMLButtonElement>(null);
  const insertRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const prevPhase = useRef(phase);

  useDemoView(rootRef, "floater_view");

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const prompt = FLOATER_PROMPTS.find((p) => p.id === promptId) ?? null;
  const paletteOpen =
    phase === "summoned" || phase === "chosen" || (phase === "inserting" && !streaming);
  const showPill = phase === "idle" || phase === "done";

  /* "Generating…" beat, then the palette gets out of the way and text lands. */
  useEffect(() => {
    if (phase !== "inserting") {
      setStreaming(false);
      return;
    }
    const t = setTimeout(() => setStreaming(true), reduce ? 150 : 550);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  /* Focus choreography. rAF twice so AnimatePresence has mounted the target. */
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = phase;
    const focus = (el: HTMLElement | null) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => el?.focus({ preventScroll: true }))
      );
    };
    if (phase === "summoned" && was === "idle") focus(firstChipRef.current);
    else if (phase === "chosen" && was === "summoned") focus(insertRef.current);
    else if (phase === "done") focus(replayRef.current);
    else if (phase === "idle" && was !== "idle") focus(triggerRef.current);
  }, [phase]);

  const summon = useCallback(
    (method: "click" | "hotkey" | "tap") => {
      dispatch({ type: "SUMMON" });
      trackDemo("floater_summon", { method });
    },
    []
  );

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // The real hotkey toggles the palette; mirror it while the demo has focus.
    if (e.ctrlKey && e.code === "Backquote") {
      e.preventDefault();
      if (phase === "idle") summon("hotkey");
      else dispatch({ type: "RESET" });
      return;
    }
    if (e.key === "Escape" && phase !== "idle") {
      e.preventDefault();
      dispatch({ type: "RESET" });
      return;
    }
    if (e.key === "Enter" && phase === "chosen") {
      e.preventDefault();
      dispatch({ type: "INSERT" });
      trackDemo("floater_insert");
    }
  };

  const choose = (id: PromptId) => {
    dispatch({ type: "CHOOSE", promptId: id });
    trackDemo("floater_prompt_select", { promptId: id });
  };

  const announcement =
    phase === "summoned"
      ? "Palette opened over the document. Choose a prompt."
      : phase === "chosen" && prompt
        ? `Prompt selected: ${prompt.label}. Activate Insert to continue.`
        : phase === "done" && prompt
          ? `Response inserted into the document at the cursor: ${prompt.response.trim()} Clipboard preserved.`
          : "";

  const hint =
    phase === "idle" ? (
      coarse ? (
        <>Tap the floating pill to summon InsertGo.</>
      ) : (
        <>
          Click the floating pill — or press <Keycaps keys={HOTKEYS.primary.keys} /> for
          real.
        </>
      )
    ) : phase === "summoned" ? (
      <>Pick a prompt — the palette floats over your document.</>
    ) : phase === "chosen" ? (
      <>
        Hit <span className="font-medium text-ink">Insert ↵</span> and watch it land at
        the caret.
      </>
    ) : (
      <>Inserting…</>
    );

  return (
    <div ref={rootRef} className="relative" onKeyDown={onRootKeyDown}>
      {/* status for assistive tech — the visual stream stays aria-hidden */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* window + floating layer share this anchor so the palette's
          percentage offset never counts the caption below */}
      <div className="relative">
      <span className="glass-chip absolute -top-3 right-5 z-10 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium text-ink">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute h-full w-full animate-ping rounded-full bg-brand/60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        Live demo — no sign-up
      </span>

      {/* fake document window */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line bg-muted/5 px-4 py-3">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="ml-2.5 text-xs text-muted">
            quarterly-update.docx — Microsoft Word
          </span>
          <AnimatePresence>
            {(streaming || phase === "done") && (
              <motion.span
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={reduce ? { duration: 0.12 } : SPRING}
                className="glass-chip ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-medium text-success"
              >
                <LinearTickCircle size={12} />
                Clipboard restored
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          animate={{ opacity: paletteOpen ? 0.45 : 1 }}
          transition={{ duration: reduce ? 0.12 : 0.25 }}
          className="flex flex-col gap-3.5 px-6 pt-8 pb-[130px] sm:px-10"
        >
          <span aria-hidden="true" className="h-3 w-[42%] rounded-md bg-muted/30" />
          <p className="m-0 max-w-[64ch] text-left font-sans text-[13.5px] leading-[1.85] text-ink-soft">
            {DOC_BASE}
            {(streaming || phase === "done") && prompt && (
              <span
                className={
                  phase === "done"
                    ? reduce
                      ? "rounded-[3px] bg-accent [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                      : "demo-wash rounded-[3px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                    : ""
                }
              >
                <StreamText
                  text={prompt.response}
                  instant={reduce}
                  onDone={() => {
                    dispatch({ type: "INSERTED" });
                    trackDemo("floater_complete");
                  }}
                />
                {phase === "done" && <span className="sr-only">{prompt.response}</span>}
              </span>
            )}
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-3.5 w-0.5 animate-blink bg-accent-hover align-[-2px]"
            />
          </p>
          <span aria-hidden="true" className="h-[9px] w-[92%] rounded-[5px] bg-muted/15" />
          <span aria-hidden="true" className="h-[9px] w-[86%] rounded-[5px] bg-muted/15" />
          <span aria-hidden="true" className="h-[9px] w-[60%] rounded-[5px] bg-muted/15" />
        </motion.div>
      </div>

      {/* floating InsertGo layer */}
      <div className="hero-parallax absolute top-[52%] left-1/2 w-[min(360px,92%)] -translate-x-1/2 -translate-y-1/2">
        <div className={showPill && !reduce ? "animate-float" : undefined}>
          <AnimatePresence mode="popLayout" initial={false}>
            {showPill && (
              <motion.div
                key="pill"
                layoutId={reduce ? undefined : "ig-floater"}
                initial={{ opacity: 0, ...(reduce ? {} : { y: 8 }) }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0.12 } : SPRING}
                className="flex justify-center"
              >
                <button
                  ref={triggerRef}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    if (phase === "done") {
                      dispatch({ type: "RESET" });
                      trackDemo("floater_replay");
                    } else {
                      summon(coarse ? "tap" : "click");
                    }
                  }}
                  className="glass-floating group flex cursor-pointer items-center gap-2.5 rounded-2xl px-4 py-3"
                >
                  <Image
                    src="/main-logo.png"
                    alt=""
                    width={20}
                    height={20}
                    className="block h-5 w-5 object-contain [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.35))]"
                  />
                  <span className="text-[13px] font-semibold text-cream">InsertGo</span>
                  <Keycaps keys={HOTKEYS.primary.keys} />
                  <span className="text-[11px] text-muted transition-colors duration-200 group-hover:text-ink">
                    {phase === "done" ? "Run it again" : coarse ? "Tap to summon" : "Click to summon"}
                  </span>
                </button>
              </motion.div>
            )}

            {paletteOpen && (
              <motion.div
                key="palette"
                layoutId={reduce ? undefined : "ig-floater"}
                role="dialog"
                aria-label="InsertGo palette — interactive demo"
                initial={{ opacity: reduce ? 0 : 0.6 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  ...(reduce ? {} : { y: -12, scale: 0.97 }),
                  transition: { duration: 0.22 },
                }}
                transition={reduce ? { duration: 0.12 } : SPRING}
                className="ig-floater-card flex flex-col gap-3 p-4 text-left"
              >
                {/* __head — serif dialog title + close control, exactly the
                    real floater's header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-serif text-base font-semibold tracking-[-0.01em] text-ig-fg">
                    Skill Components
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => dispatch({ type: "RESET" })}
                    className="ig-btn-app h-6 min-h-0 w-6 cursor-pointer gap-0 rounded-[7px] p-0 text-[12px] leading-none text-ig-muted hover:text-ig-fg"
                  >
                    <LinearAdd size={12} className="rotate-45" />
                  </button>
                </div>

                {/* __skill — accent-tint pill with the top specular highlight;
                    the chosen prompt streams in as the invoked skill's label */}
                <div className="ig-floater-skill inline-flex min-h-6 items-center gap-1 self-start px-2 text-xs leading-[1.55] text-ig-fg">
                  <span className="flex text-accent-primary" aria-hidden="true">
                    <LinearMagicStar size={12} />
                  </span>
                  <span>
                    {prompt ? (
                      <StreamText
                        key={prompt.id}
                        text={prompt.label}
                        instant={reduce}
                        onDone={() => {}}
                      />
                    ) : (
                      <span className="text-ig-muted">Choose a skill…</span>
                    )}
                  </span>
                </div>

                {/* skill picker — the demo's prompt choice, wearing the same
                    accent-tint pill material as the invoked-skill chip */}
                <div
                  role="group"
                  aria-label="Sample prompts"
                  onKeyDown={arrowNav}
                  className="flex flex-wrap gap-2"
                >
                  {FLOATER_PROMPTS.map((p, i) => (
                    <button
                      key={p.id}
                      ref={i === 0 ? firstChipRef : undefined}
                      type="button"
                      aria-pressed={promptId === p.id}
                      onClick={() => choose(p.id)}
                      className={`ig-floater-skill inline-flex min-h-6 cursor-pointer items-center px-2.5 text-xs leading-[1.55] text-ig-fg transition-[background-color] duration-150 hover:bg-[rgba(47,107,255,0.26)] ${
                        promptId === p.id ? "bg-[rgba(47,107,255,0.3)]" : ""
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* __screen — the generated draft streams into the sunken
                    result well before Apply lands it in the document */}
                {prompt && (
                  <div className="max-h-[190px] overflow-auto overscroll-contain">
                    <div className="ig-floater-well p-4 text-sm font-semibold leading-[1.55] text-ig-fg">
                      <StreamText
                        key={`${prompt.id}-screen`}
                        text={prompt.response.trim()}
                        instant={reduce}
                        onDone={() => {}}
                      />
                      <span className="sr-only">{prompt.response.trim()}</span>
                    </div>
                  </div>
                )}

                {/* ig-actions — trailing-aligned; the primary lands under the
                    cursor, mirroring the app's Apply row */}
                <div className="mt-1 flex min-h-[28px] flex-wrap items-center justify-end gap-2">
                  <span className="mr-auto text-[11px] text-ig-muted">
                    3 sample prompts — the real app takes anything
                  </span>
                  {phase === "inserting" ? (
                    <span className="skeleton rounded-md px-2.5 py-1 text-[11px] font-medium text-ink">
                      Generating…
                    </span>
                  ) : phase === "chosen" ? (
                    <button
                      ref={insertRef}
                      type="button"
                      onClick={() => {
                        dispatch({ type: "INSERT" });
                        trackDemo("floater_insert");
                      }}
                      className="ig-btn-app-primary cursor-pointer"
                    >
                      Insert ↵
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-accent-hover">
                      Enter ↵ to insert
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      {/* caption + payoff */}
      <div className="mt-6 flex min-h-[56px] items-start justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "done" ? (
            <motion.div
              key="payoff"
              initial={{ opacity: 0, ...(reduce ? {} : { y: 8 }) }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.12 } : SPRING}
              className="flex flex-col items-center gap-3.5"
            >
              <p className="m-0 text-[15px] text-ink">
                Inserted at your cursor.{" "}
                <span className="text-muted">
                  Clipboard untouched. Focus never left Word.
                </span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  href="/download"
                  onClick={() =>
                    trackDemo("demo_cta_click", { source: "floater", cta: "download" })
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-btn bg-accent-primary px-5 text-sm font-medium text-on-accent shadow-cta transition-[background-color,transform] duration-200 ease-standard hover:-translate-y-0.5 hover:bg-accent-hover"
                >
                  Download for Windows
                </Link>
                <button
                  ref={replayRef}
                  type="button"
                  onClick={() => {
                    dispatch({ type: "RESET" });
                    trackDemo("floater_replay");
                  }}
                  className="glass-chip inline-flex h-10 cursor-pointer items-center rounded-btn px-5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-hover"
                >
                  Replay
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key={phase}
              initial={{ opacity: 0, ...(reduce ? {} : { y: 4 }) }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18 }}
              className="m-0 text-[13px] text-muted"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
