"use client";

import { Fragment, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING } from "@/components/Reveal";
import { LinearDocumentText } from "@/components/icons/LinearDocumentText";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export type StepNum = "01" | "02" | "03" | "04";

// Shown as-is when the OS asks for reduced motion — the same one-line summary
// the page used before, minus the retired features.
const FALLBACK: Record<StepNum, string> = {
  "01": `${HOTKEYS.primary.label}  →  overlay appears in 40 ms`,
  "02": "select text  →  Skill Bar: Improve this · Fix mistakes · Summarize",
  "03": "streaming…  ▍  response ready to accept",
  "04": "inserted into Slack ✓  overlay closed",
};

// Cycles 0..timings.length-1, dwelling timings[i] ms on phase i, then wraps.
// Timings live at module scope so the effect never re-subscribes.
export function usePhase(timings: readonly number[]) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        i = (i + 1) % timings.length;
        setPhase(i);
        tick();
      }, timings[i]);
    };
    tick();
    return () => clearTimeout(t);
  }, [timings]);
  return phase;
}

/* fa-ellipsis stand-in from the app's icon set style — three solid dots. */
function EllipsisIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/* 01 — keycaps land, floater card springs in above them (same entrance the
   Skill Components floater uses: rise + settle, no CSS keyframes) */
const T1 = [800, 2600];
function HotkeyDemo() {
  const phase = usePhase(T1);
  return (
    <div className="flex h-[52px] w-full items-center gap-3">
      <motion.span
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="flex items-center gap-1.5"
      >
        {HOTKEYS.primary.keys.map((k, i) => (
          <Fragment key={k}>
            {i > 0 && <span className="text-xs text-muted">+</span>}
            <span className="glass-chip rounded-md px-[9px] py-1 text-xs font-medium text-on-accent">
              {k}
            </span>
          </Fragment>
        ))}
      </motion.span>
      <AnimatePresence>
        {phase === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={SPRING}
            className="ig-floater-card flex items-center p-2"
          >
            {/* invoked-skill pill: accent tint + top specular, as in the app */}
            <span className="ig-floater-skill inline-flex min-h-6 items-center gap-1 px-2 text-[11px] leading-[1.55] text-ig-fg">
              <LinearMagicStar size={12} className="text-accent-primary" />
              InsertGo · ask anything
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* 02 — selection highlight, then the Selection Bar pill springs in above it
   (shell → toolbar → icon-only skill buttons + caret, as in SelectionBar.tsx) */
const T2 = [1000, 1400, 2200];
const SKILLS = [
  { label: "Improve this", Icon: LinearMagicStar },
  { label: "Fix mistakes", Icon: LinearTickCircle },
  { label: "Summarize", Icon: LinearDocumentText },
] as const;
function SkillBarDemo() {
  const phase = usePhase(T2);
  return (
    <div className="flex h-[52px] w-full flex-col justify-center gap-0.5">
      {/* ig-selbar-shell: centers the pill over the selection anchor */}
      <div className="flex items-start justify-center">
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              key="selbar"
              role="toolbar"
              aria-label="Selection skills"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="ig-selbar-pill relative flex flex-nowrap items-center gap-1 px-2 py-[3px]"
            >
              {/* caret: rotated square sharing the pill fill, half overlapped
                  so the protruding half reads as a solid triangle */}
              <span
                aria-hidden="true"
                className="absolute bottom-[-5px] left-1/2 h-[10px] w-[10px] -translate-x-1/2 rotate-45 bg-[#0b0f14]"
              />
              {SKILLS.map(({ label, Icon }, i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ ...SPRING, delay: i * 0.07 }}
                  title={label}
                  className={`ig-skillbtn-app ${
                    phase === 2 && i === 0
                      ? "bg-[rgba(244,247,251,0.09)] text-accent-hover"
                      : ""
                  }`}
                >
                  <Icon size={15} />
                  <span className="sr-only">{label}</span>
                </motion.span>
              ))}
              {/* "More" — opens the floater's skill picker in the real app */}
              <motion.span
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ ...SPRING, delay: SKILLS.length * 0.07 }}
                title="More — pick a skill in the floater"
                className="ig-skillbtn-app"
              >
                <EllipsisIcon size={15} />
                <span className="sr-only">More</span>
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="text-[13px] leading-none text-on-accent">
        <span className="rounded-sm bg-white/15 px-1">
          Thanks for the update, I&rsquo;ll review it tomorrow.
        </span>
      </div>
    </div>
  );
}

/* 03 — the run streams into the floater's result well, holds, restarts */
const RESPONSE =
  "Here's a shorter, friendlier version of your reply — same meaning, warmer tone.";
function StreamDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    // extra ticks past the end hold the full response before restarting
    const t = setInterval(() => {
      i += 1;
      if (i > RESPONSE.length + 45) i = 0;
      setN(i);
    }, 38);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-[52px] w-full items-center">
      <div className="ig-floater-card flex max-h-[52px] w-full items-center gap-2 overflow-hidden p-2">
        <span className="ig-floater-skill inline-flex min-h-6 shrink-0 items-center gap-1 px-2 text-[11px] leading-[1.55] text-ig-fg">
          <LinearMagicStar size={12} className="text-accent-primary" />
          Improve this
        </span>
        {/* sunken deliverable well, mid-stream */}
        <div className="ig-floater-well min-w-0 flex-1 px-3 py-1 text-[12px] font-semibold leading-[1.55] text-ig-fg">
          {RESPONSE.slice(0, Math.min(n, RESPONSE.length))}
          <span className="text-accent-hover">▍</span>
        </div>
      </div>
    </div>
  );
}

/* 04 — the floater holds the ready response, then it lands at the cursor in Slack */
const T4 = [1500, 2800];
function InsertDemo() {
  const phase = usePhase(T4);
  return (
    <div className="flex h-[52px] w-full flex-col justify-center gap-2">
      <div className="flex h-[22px] items-center gap-2 text-[12px]">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
          Slack · #general
        </span>
        {phase === 0 && <span className="text-accent-hover">▍</span>}
        <AnimatePresence>
          {phase === 1 && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="text-on-accent"
            >
              Here&rsquo;s the shorter, friendlier version ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {phase === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={SPRING}
            className="ig-floater-card flex w-fit items-center gap-2 px-3 py-2 text-[12px] font-medium text-ig-fg"
          >
            response ready
            {/* the app's trailing primary action (Apply) as an accent pill */}
            <span className="ig-btn-app-primary min-h-6 px-3 text-[11px]">↵ Apply</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AnimatedDemo({ stepNum }: { stepNum: StepNum }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <span className="flex h-[52px] w-full items-center text-[13px] leading-normal text-on-accent">
        {FALLBACK[stepNum]}
      </span>
    );
  }
  switch (stepNum) {
    case "01":
      return <HotkeyDemo />;
    case "02":
      return <SkillBarDemo />;
    case "03":
      return <StreamDemo />;
    case "04":
      return <InsertDemo />;
  }
}
