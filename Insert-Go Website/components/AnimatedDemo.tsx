"use client";

import { Fragment, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING } from "@/components/Reveal";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export type StepNum = "01" | "02" | "03" | "04";

// Shown as-is when the OS asks for reduced motion — the same one-line summary
// the page used before, minus the retired features.
const FALLBACK: Record<StepNum, string> = {
  "01": `${HOTKEYS.primary.label}  →  overlay appears in 40 ms`,
  "02": "select text  →  Skill Bar: Refine · Fix grammar · Shorten",
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

const CHIP = "glass-chip rounded-md px-2 py-[3px] text-[11px] font-medium";

/* 01 — keycaps land, palette overlay springs in above them */
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
            className="glass-chip flex items-center gap-2 rounded-lg px-3 py-[7px] text-[12px] text-on-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            InsertGo · ask anything
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* 02 — selection highlight, Skill Bar chips stagger in above it, one runs */
const T2 = [1000, 1400, 2200];
const CHIPS = ["Refine", "Fix grammar", "Shorten"];
function SkillBarDemo() {
  const phase = usePhase(T2);
  return (
    <div className="flex h-[52px] w-full flex-col justify-center gap-2">
      <div className="flex h-[24px] items-center gap-1.5">
        <AnimatePresence>
          {phase >= 1 && (
            <motion.span
              key="label"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="mr-1 text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Skill Bar
            </motion.span>
          )}
          {phase >= 1 &&
            CHIPS.map((chip, i) => (
              <motion.span
                key={chip}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ ...SPRING, delay: i * 0.07 }}
                className={`${CHIP} ${
                  phase === 2 && i === 0 ? "text-accent-hover" : "text-on-accent"
                }`}
              >
                {chip}
              </motion.span>
            ))}
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

/* 03 — response streams into the overlay, holds, restarts */
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
    <div className="flex h-[52px] w-full items-center gap-2 overflow-hidden text-[13px] text-on-accent">
      <span className="flex shrink-0 text-accent-hover">
        <LinearMagicStar size={15} />
      </span>
      <span className="leading-snug">
        {RESPONSE.slice(0, Math.min(n, RESPONSE.length))}
        <span className="text-accent-hover">▍</span>
      </span>
    </div>
  );
}

/* 04 — overlay holds the ready response, then it lands at the cursor in Slack */
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
            className="glass-chip flex w-fit items-center gap-2 rounded-lg px-3 py-[6px] text-[12px] text-on-accent"
          >
            response ready
            <span className="glass-chip rounded px-1.5 py-0.5 text-[10px] font-medium">
              ↵ insert
            </span>
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
