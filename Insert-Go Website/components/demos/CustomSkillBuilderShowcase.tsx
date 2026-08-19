"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LinearAdd } from "../icons/LinearAdd";
import { LinearCode } from "../icons/LinearCode";
import { LinearHeadphone } from "../icons/LinearHeadphone";
import { LinearMagicStar } from "../icons/LinearMagicStar";
import { LinearNote2 } from "../icons/LinearNote2";
import { LinearTickCircle } from "../icons/LinearTickCircle";
import type { IconProps } from "../icons/types";
import { trackDemo } from "@/lib/demoAnalytics";
import { useDemoView } from "./useDemoView";
import { arrowNav } from "./arrowNav";

/* Canonical categories mirror the desktop app's SkillCategory union
   (writing | coding | research | ops | custom). */
type Category = "writing" | "coding" | "research" | "ops" | "custom";
type RecipeId = "diff-pr" | "empathy" | "deai" | "jira";
type Pick = RecipeId | "custom";
type Phase = "pick" | "generating" | "built";
type RunStatus = "idle" | "working" | "done";

type Sample = { label: string; input: string; output: string };

type BuiltSkill = {
  title: string;
  category: Category;
  Icon: ComponentType<IconProps>;
  template: string;
  samples: Sample[];
};

const CATEGORY_TILE: Record<Category, string> = {
  writing: "var(--color-tile-sky)",
  coding: "var(--color-tile-sand)",
  research: "var(--color-tile-clay)",
  ops: "var(--color-tile-stone)",
  custom: "var(--color-tile-dusk)",
};

const RECIPES: Record<RecipeId, BuiltSkill & { intent: string }> = {
  "diff-pr": {
    title: "Diff to PR Description",
    category: "coding",
    Icon: LinearCode,
    intent:
      "Turn a raw git diff into a structured PR description with a summary, key changes, and testing notes.",
    template:
      "You are a senior engineer writing a pull request description.\n\nFrom the diff below produce:\n1. Summary — one sentence\n2. Key changes — bulleted list\n3. Testing notes\n\n[PASTE DIFF HERE]",
    samples: [
      {
        label: "Auth guard fix",
        input:
          "+ const session = await auth();\n+ if (!session?.user) {\n+   redirect(\"/login\");\n+ }\n- // TODO: add auth check",
        output:
          "Summary: Enforces sign-in before the dashboard renders.\n\nKey changes\n• Adds an auth() session check at the top of the route\n• Redirects anonymous visitors to /login\n• Removes the stale TODO comment\n\nTesting notes: Verified a signed-out visit redirects and a signed-in visit renders.",
      },
      {
        label: "Off-by-one fix",
        input:
          "- for (let i = 0; i <= items.length; i++) {\n+ for (let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }",
        output:
          "Summary: Fixes an off-by-one that read one element past the cart.\n\nKey changes\n• Loop bound changed from <= to < items.length\n• Stops the undefined-price NaN in the order total\n\nTesting notes: Cart totals now match line items across 20 fixtures.",
      },
    ],
  },
  empathy: {
    title: "Angry Ticket to Empathy Reply",
    category: "ops",
    Icon: LinearHeadphone,
    intent:
      "Reply to an angry support ticket: acknowledge the frustration, own the issue, and give one concrete next step.",
    template:
      "You are a support lead. Reply to the ticket below.\n\nRules:\n• Open by acknowledging the frustration\n• Own the issue — no blaming, no \"policy\"\n• End with one concrete next step and a timeframe\n• Under 120 words\n\n[PASTE TICKET HERE]",
    samples: [
      {
        label: "Billing complaint",
        input:
          "This is the SECOND time you've charged me after I cancelled. Your support is a joke. Fix this NOW or I'm disputing with my bank.",
        output:
          "You're right to be frustrated — being charged after cancelling, twice, is on us. I've refunded both charges today; you'll see them within 3–5 business days. I've also flagged your account so billing stays stopped, and I'll personally confirm by email tomorrow that no renewal is scheduled.",
      },
      {
        label: "Broken export",
        input:
          "Export has been broken for a week and nobody replies. We're evaluating competitors.",
        output:
          "A week without export — and without a reply from us — isn't acceptable, and I'm sorry. The bug is fixed in today's release; please update and retry your export. If anything still fails, reply here and it comes straight to me. I'm also crediting this month to your account.",
      },
    ],
  },
  deai: {
    title: "De-AI Fluff",
    category: "writing",
    Icon: LinearMagicStar,
    intent:
      "Strip AI-sounding filler and corporate jargon from a draft so it reads like a person wrote it.",
    template:
      "Rewrite the text below so a human could have written it.\n\n• Cut filler: \"leverage\", \"cutting-edge\", \"delve\", \"seamless\"\n• One idea per sentence, plain verbs\n• Keep every fact; change only the wording\n\n[PASTE TEXT HERE]",
    samples: [
      {
        label: "Marketing blurb",
        input:
          "Leverage our cutting-edge platform to seamlessly synergize cross-functional workflows and unlock unprecedented productivity gains across your entire organization.",
        output:
          "Our platform helps teams work together without the busywork — so the whole company gets more done.",
      },
      {
        label: "LinkedIn opener",
        input:
          "I'm thrilled to announce that I'm embarking on an exciting new chapter, leveraging my passion for innovation to drive impactful change.",
        output:
          "I started a new job this week. Looking forward to building things that matter.",
      },
    ],
  },
  jira: {
    title: "Transcript to Jira Spec",
    category: "ops",
    Icon: LinearNote2,
    intent:
      "Turn a messy meeting transcript into a scoped Jira spec: problem, requirements, acceptance criteria.",
    template:
      "Turn the transcript below into a Jira-ready spec.\n\nFormat:\nProblem — one sentence\nRequirements — numbered\nAcceptance criteria — testable bullets\nOut of scope — one line\n\n[PASTE TRANSCRIPT HERE]",
    samples: [
      {
        label: "Sprint planning clip",
        input:
          "so the export thing— people keep asking for PDF. sarah: can we do it friday? maybe just invoices first. tom: pdf lib is heavy, use the print stylesheet. ok invoices PDF by friday, rest later.",
        output:
          "Problem: Customers need invoices as PDFs; the export only ships CSV.\n\nRequirements:\n1. Add a \"Download PDF\" action on invoices\n2. Render via the print stylesheet (no new PDF dependency)\n\nAcceptance criteria:\n• PDF downloads in one click from any invoice\n• Totals match the on-screen invoice\n\nOut of scope: PDFs for other export types.",
      },
      {
        label: "Retro clip",
        input:
          "onboarding drop-off is brutal, step 3 kills everyone. jin: make it skippable. also tooltips — new users don't know what the bar does. priya: i'll take tooltips, you take skip. thursday.",
        output:
          "Problem: New users abandon onboarding at step 3.\n\nRequirements:\n1. Make step 3 skippable\n2. Add first-run tooltips to the Skill Bar\n\nAcceptance criteria:\n• Step 3 shows a \"Skip\" control and the flow completes without it\n• Tooltips appear once per install and can be dismissed\n\nOut of scope: Redesigning earlier onboarding steps.",
      },
    ],
  },
};

const RECIPE_ORDER: RecipeId[] = ["diff-pr", "empathy", "deai", "jira"];

const CUSTOM_SAMPLE: Sample = {
  label: "Team note",
  input:
    "hey team, standup moved to 9:30 tomorrow, also bring your sprint notes and dont forget the retro doc is due",
  output:
    "Hi team — standup moves to 9:30 tomorrow. Please bring your sprint notes, and remember the retro doc is due.",
};

function buildCustomSkill(instruction: string): BuiltSkill {
  const trimmed = instruction.trim();
  const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return {
    title: titled.length > 34 ? `${titled.slice(0, 34).trimEnd()}…` : titled,
    category: "custom",
    Icon: LinearAdd,
    template: `${trimmed}\n\nApply this to:\n\n[PASTE TEXT HERE]`,
    samples: [CUSTOM_SAMPLE],
  };
}

const GEN_STEPS = ["Understanding your intent", "Composing prompt template"];

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-[11px] py-[5px] text-xs font-medium text-ink">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: CATEGORY_TILE[category] }}
      />
      {category}
    </span>
  );
}

/** Prompt template with the dynamic `[PASTE …]` placeholders highlighted —
 *  the desktop app swaps that marker for the user's text at run time. */
function TemplateText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <p className="m-0 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className="rounded bg-brand/20 px-1 py-px text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

/** Word-staggered reveal for the transformed output; instant under reduced motion. */
function StaggeredOutput({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft">
      {text.split(" ").map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={reduce ? false : { opacity: 0, filter: "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.18, delay: reduce ? 0 : i * 0.018 }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </p>
  );
}

export function CustomSkillBuilderShowcase() {
  const reduce = useReducedMotion() ?? false;
  const [pick, setPick] = useState<Pick>("diff-pr");
  const [customText, setCustomText] = useState("");
  const [phase, setPhase] = useState<Phase>("pick");
  const [genStep, setGenStep] = useState(0);
  const [skill, setSkill] = useState<BuiltSkill | null>(null);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [announce, setAnnounce] = useState("");

  const sceneRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const runChipRef = useRef<HTMLButtonElement>(null);

  useDemoView(sceneRef, "skillbuilder_view");

  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    []
  );

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const choose = (id: Pick) => {
    clearTimers();
    setPick(id);
    setPhase("pick");
    setGenStep(0);
    setSkill(null);
    setRunStatus("idle");
    setSampleIdx(0);
    trackDemo("skillbuilder_recipe", { recipe: id });
    setAnnounce(
      id === "custom"
        ? "Custom idea selected. Describe your skill in plain English, then generate it."
        : `Recipe selected: ${RECIPES[id].title}. Press Generate skill to build it.`
    );
  };

  const generate = () => {
    if (phase === "generating") return;
    if (pick === "custom" && customText.trim().length === 0) return;
    clearTimers();
    trackDemo("skillbuilder_generate", { recipe: pick });
    setPhase("generating");
    setGenStep(1);
    setRunStatus("idle");
    setSampleIdx(0);
    setAnnounce("Generating skill — understanding your intent.");
    const beat = reduce ? 140 : 650;
    later(() => {
      setGenStep(2);
      setAnnounce("Composing the prompt template.");
    }, beat);
    later(() => {
      const built =
        pick === "custom" ? buildCustomSkill(customText) : RECIPES[pick];
      setSkill(built);
      setPhase("built");
      setGenStep(0);
      setAnnounce(
        `Skill created: ${built.title}, category ${built.category}. Prompt template ready — try it in the playground below.`
      );
      // carry keyboard users to the run chip, same handoff as the Skill Bar demo
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          runChipRef.current?.focus({ preventScroll: true })
        )
      );
    }, beat * 2);
  };

  const run = () => {
    if (!skill || runStatus === "working") return;
    trackDemo("skillbuilder_run", { recipe: pick });
    setRunStatus("working");
    setAnnounce(`Running ${skill.title} on the sample input.`);
    later(
      () => {
        setRunStatus("done");
        setAnnounce(
          `Done — ${skill.title} transformed the input. Compare the before and after panels.`
        );
      },
      reduce ? 200 : 850
    );
  };

  const pickSample = (i: number) => {
    setSampleIdx(i);
    setRunStatus("idle");
    if (skill) {
      setAnnounce(
        `Sample input: ${skill.samples[i].label}. Run the skill to transform it.`
      );
    }
  };

  const generateDisabled =
    phase === "generating" || (pick === "custom" && customText.trim().length === 0);

  const currentSample = skill?.samples[sampleIdx] ?? null;

  return (
    <div ref={sceneRef} className="relative">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="glass-panel mx-auto max-w-[980px] overflow-hidden text-left">
        {/* window chrome, same language as the Skill Bar demo's fake Outlook */}
        <div className="flex items-center gap-2 border-b border-line bg-muted/5 px-4 py-3">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="ml-2.5 text-xs text-muted">
            Custom Skill Builder — InsertGo
          </span>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
          {/* step 1 — describe */}
          <div className="flex flex-col gap-4">
            <span className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
              1 · Describe the skill in plain English
            </span>
            <div
              role="group"
              aria-label="Recipe presets"
              onKeyDown={arrowNav}
              className="flex flex-wrap gap-2"
            >
              {RECIPE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={pick === id}
                  onClick={() => choose(id)}
                  className={`cursor-pointer rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-colors duration-150 ${
                    pick === id
                      ? "bg-brand/25 text-ink"
                      : "bg-muted/10 text-muted hover:text-ink"
                  }`}
                >
                  {RECIPES[id].title}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={pick === "custom"}
                onClick={() => choose("custom")}
                className={`cursor-pointer rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-colors duration-150 ${
                  pick === "custom"
                    ? "bg-brand/25 text-ink"
                    : "bg-muted/10 text-muted hover:text-ink"
                }`}
              >
                Your own idea…
              </button>
            </div>

            {pick === "custom" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="custom-skill-intent" className="text-xs text-muted">
                  Your instruction
                </label>
                <input
                  id="custom-skill-intent"
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="e.g. Rewrite my standup notes as a Slack update"
                  className="glass-chip w-full rounded-lg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted"
                />
              </div>
            ) : (
              <p className="m-0 text-sm leading-relaxed text-muted">
                {RECIPES[pick].intent}
              </p>
            )}

            <div>
              <button
                type="button"
                onClick={generate}
                disabled={generateDisabled}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-medium text-on-accent transition-[transform,opacity] duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LinearMagicStar size={15} />
                Generate skill
              </button>
            </div>

            <AnimatePresence>
              {phase === "generating" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="flex flex-col gap-2"
                  aria-hidden="true"
                >
                  {GEN_STEPS.map((label, i) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-2 text-xs font-medium ${
                        genStep > i ? "text-ink" : "text-muted"
                      }`}
                    >
                      {genStep > i + 1 ? (
                        <span className="text-success">
                          <LinearTickCircle size={14} />
                        </span>
                      ) : genStep === i + 1 ? (
                        <Spinner />
                      ) : (
                        <span className="inline-block h-[14px] w-[14px] rounded-full border border-line" />
                      )}
                      {label}…
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* step 2 — generated skill card */}
          <div className="flex flex-col gap-4">
            <span className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
              2 · The AI builds the skill
            </span>
            <AnimatePresence mode="wait" initial={false}>
              {skill ? (
                <motion.article
                  key={skill.title}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                  className="glass-card flex h-full flex-col gap-3.5 p-6"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-ink"
                      style={{ background: CATEGORY_TILE[skill.category] }}
                    >
                      <skill.Icon size={20} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="m-0 font-serif text-[17px] font-semibold tracking-[-0.01em] text-ink">
                        {skill.title}
                      </h3>
                      <CategoryBadge category={skill.category} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-muted/5 p-4">
                    <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                      Prompt template
                    </span>
                    <TemplateText text={skill.template} />
                  </div>
                  <p className="m-0 text-[12px] leading-relaxed text-muted">
                    Saved to your Skill Bar — one click, in any app.
                  </p>
                </motion.article>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="glass-card flex h-full min-h-[180px] flex-col items-center justify-center gap-2 p-6 text-center"
                >
                  <span className="text-muted">
                    <LinearMagicStar size={22} />
                  </span>
                  <p className="m-0 max-w-[280px] text-sm leading-relaxed text-muted">
                    {phase === "generating"
                      ? "The generator is composing your skill…"
                      : "Pick a recipe and press Generate skill — the AI writes the prompt template for you."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* step 3 — playground */}
        <AnimatePresence>
          {skill && (
            <motion.div
              key="playground"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
              className="border-t border-line p-6 sm:p-8"
            >
              <span className="mb-4 block text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
                3 · Run it from the Skill Bar
              </span>

              <div
                role="group"
                aria-label="Sample inputs"
                onKeyDown={arrowNav}
                className="mb-4 flex flex-wrap gap-2"
              >
                {skill.samples.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    aria-pressed={sampleIdx === i}
                    onClick={() => pickSample(i)}
                    className={`cursor-pointer rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-colors duration-150 ${
                      sampleIdx === i
                        ? "bg-brand/25 text-ink"
                        : "bg-muted/10 text-muted hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* floating skill bar — the run trigger */}
              <div
                role="toolbar"
                aria-label="Skill Bar"
                onKeyDown={arrowNav}
                className="glass-solid mb-5 flex flex-wrap items-center justify-center gap-1 rounded-[14px] p-1.5"
              >
                <span className="px-2 text-[11px] font-medium text-muted">
                  Skill Bar
                </span>
                <button
                  ref={runChipRef}
                  type="button"
                  onClick={run}
                  disabled={runStatus === "working"}
                  className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium text-on-accent transition-colors duration-150 hover:bg-surface-hover disabled:cursor-wait ${
                    runStatus !== "idle" ? "bg-surface-hover" : ""
                  }`}
                >
                  <span className="text-accent-hover">
                    {runStatus === "working" ? <Spinner /> : <skill.Icon size={14} />}
                  </span>
                  {skill.title}
                </button>
              </div>

              {/* before / after */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-line bg-muted/5 p-4">
                  <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                    Before — your raw text
                  </span>
                  <p className="m-0 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
                    {currentSample?.input}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-muted/5 p-4">
                  <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                    After — one click later
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {runStatus === "working" ? (
                      <motion.span
                        key="working"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        className="inline-flex items-center gap-2 text-xs font-medium text-muted"
                      >
                        <Spinner />
                        Working…
                      </motion.span>
                    ) : runStatus === "done" && currentSample ? (
                      <motion.div
                        key={`done-${skill.title}-${sampleIdx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <StaggeredOutput text={currentSample.output} reduce={reduce} />
                      </motion.div>
                    ) : (
                      <motion.p
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        className="m-0 text-xs leading-relaxed text-muted"
                      >
                        Press the skill on the Skill Bar to transform the input.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 sm:px-8">
          <span className="text-[11px] text-muted">
            Simulated demo — the real app runs your skills on the managed relay.
          </span>
          <span className="hidden text-[11px] font-medium text-accent-hover sm:inline">
            Skill Builder — live demo
          </span>
        </div>
      </div>
    </div>
  );
}
