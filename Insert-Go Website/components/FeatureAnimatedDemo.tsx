"use client";

import { Fragment, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING } from "@/components/Reveal";
import { usePhase } from "@/components/AnimatedDemo";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export type FeatureDemoId =
  | "hotkey"
  | "templates"
  | "skillbar"
  | "insert"
  | "os"
  | "privacy";

// Shown as-is when the OS asks for reduced motion — one accurate static line
// per feature, same role the old demo strings played.
const FALLBACK: Record<FeatureDemoId, string> = {
  hotkey: "waiting for your prompt…",
  templates: "/rewrite-politely {clipboard}",
  skillbar: "select text → Skill Bar → review → apply",
  insert: "inserted into VS Code ✓",
  os: "target: any focused window",
  privacy: "prompt library: local app data",
};

const CHIP = "glass-chip rounded-md px-2 py-[3px] text-[11px] font-medium";

/* hotkey — keycaps land, palette overlay springs in above them */
const T_HOTKEY = [900, 2600];
function HotkeyDemo() {
  const phase = usePhase(T_HOTKEY);
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
      <div className="flex items-center gap-2.5">
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
              InsertGo · ready
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="h-2 w-[88%] rounded bg-dark-2" />
      <span className="h-2 w-[64%] rounded bg-dark-2" />
    </div>
  );
}

/* templates — slash command types out, then its {clipboard} token appears */
const COMMAND = "/rewrite-politely";
function TemplatesDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    // extra ticks past the end hold the command + token before restarting
    const t = setInterval(() => {
      i += 1;
      if (i > COMMAND.length + 45) i = 0;
      setN(i);
    }, 55);
    return () => clearInterval(t);
  }, []);
  const done = n >= COMMAND.length;
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
      <span className="text-xs leading-normal text-on-accent">
        {COMMAND.slice(0, Math.min(n, COMMAND.length))}
        <span className="ml-0.5 inline-block h-3 w-0.5 animate-blink bg-accent-hover align-[-1px]" />
      </span>
      <div className="flex h-[22px] items-center gap-1.5">
        <AnimatePresence>
          {done && (
            <motion.span
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING}
              className={`${CHIP} text-accent-hover`}
            >
              {"{clipboard}"}
            </motion.span>
          )}
          {done && (
            <motion.span
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ ...SPRING, delay: 0.08 }}
              className={`${CHIP} text-on-accent`}
            >
              tone: friendly
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="h-2 w-[64%] rounded bg-dark-2" />
    </div>
  );
}

/* skillbar — selection highlight, Skill Bar chips stagger in, one runs */
const T_SKILLBAR = [1000, 1400, 2200];
const SKILLS = ["Refine", "Translate", "Summarize"];
function SkillBarDemo() {
  const phase = usePhase(T_SKILLBAR);
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
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
            SKILLS.map((chip, i) => (
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
      <div className="text-xs leading-normal text-on-accent">
        <span className="rounded-sm bg-white/15 px-1">
          Thanks for the update, I&rsquo;ll review it tomorrow.
        </span>
      </div>
      <span className="h-2 w-[64%] rounded bg-dark-2" />
    </div>
  );
}

/* insert — target app holds a cursor, then the response lands in it */
const T_INSERT = [1500, 2800];
function InsertDemo() {
  const phase = usePhase(T_INSERT);
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
      <div className="flex h-[22px] items-center gap-2 text-xs">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
          VS Code · main.ts
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
              response inserted ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="h-2 w-[88%] rounded bg-dark-2" />
      <AnimatePresence>
        {phase === 1 && (
          <motion.span
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="h-2 w-[52%] origin-left rounded bg-accent-hover/40"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* os — focus target hops across everyday apps, one after another */
const APPS = ["Word", "Slack", "VS Code", "Chrome"];
function OsDemo() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % APPS.length), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {APPS.map((app, i) => (
          <motion.span
            key={app}
            animate={{ scale: i === active ? 1.08 : 1 }}
            transition={SPRING}
            className={`${CHIP} ${
              i === active ? "text-accent-hover" : "text-on-accent"
            }`}
          >
            {app}
          </motion.span>
        ))}
      </div>
      <span className="text-xs leading-normal text-muted">
        target: any focused window
      </span>
      <span className="h-2 w-[64%] rounded bg-dark-2" />
    </div>
  );
}

/* privacy — local-storage assurances tick in one by one */
const T_PRIVACY = [700, 700, 700, 2400];
const ASSURANCES = [
  "templates — local app data",
  "session token — credential store",
  "AI calls — only when you run them",
];
function PrivacyDemo() {
  const phase = usePhase(T_PRIVACY);
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
      <AnimatePresence>
        {ASSURANCES.map(
          (line, i) =>
            phase > i && (
              <motion.span
                key={line}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
                className="flex items-center gap-1.5 text-xs leading-normal text-on-accent"
              >
                <span className="text-accent-hover">✓</span>
                {line}
              </motion.span>
            ),
        )}
      </AnimatePresence>
    </div>
  );
}

export function FeatureAnimatedDemo({ demoId }: { demoId: FeatureDemoId }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className="flex min-h-[96px] w-full flex-col justify-center gap-[9px] p-3.5">
        <span className="text-xs leading-normal text-on-accent">
          {FALLBACK[demoId]}
        </span>
        <span className="h-2 w-[88%] rounded bg-dark-2" />
        <span className="h-2 w-[64%] rounded bg-dark-2" />
      </div>
    );
  }
  switch (demoId) {
    case "hotkey":
      return <HotkeyDemo />;
    case "templates":
      return <TemplatesDemo />;
    case "skillbar":
      return <SkillBarDemo />;
    case "insert":
      return <InsertDemo />;
    case "os":
      return <OsDemo />;
    case "privacy":
      return <PrivacyDemo />;
  }
}
