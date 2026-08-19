"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ComponentType,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LinearMagicStar } from "../icons/LinearMagicStar";
import { LinearTickCircle } from "../icons/LinearTickCircle";
import { LinearFlash } from "../icons/LinearFlash";
import { LinearSms } from "../icons/LinearSms";
import { LinearAdd } from "../icons/LinearAdd";
import { LinearCode } from "../icons/LinearCode";
import { LinearHeadphone } from "../icons/LinearHeadphone";
import { LinearNote2 } from "../icons/LinearNote2";
import type { IconProps } from "../icons/types";
import { SPRING } from "../Reveal";
import { trackDemo } from "@/lib/demoAnalytics";
import { useDemoView } from "./useDemoView";
import { arrowNav } from "./arrowNav";

type PhraseId = "s1" | "s2";
type SkillId = "refine" | "grammar" | "shorten" | "friendlier";
type Status = "idle" | "selected" | "working" | "replaced";

type TabId = "builtin" | "custom";
type CustomSkillId = "diff-pr" | "angry-ticket" | "deai" | "notes";
type CustomSelection = CustomSkillId | "builder";
type CustomStatus = "idle" | "working" | "done";

/* Canonical categories mirror the desktop app's SkillCategory union
   (writing | coding | research | ops | custom). */
type Category = "writing" | "coding" | "research" | "ops" | "custom";

const PHRASES: Record<PhraseId, string> = {
  s1: "I had a look at it and I think it is mostly fine but some parts are maybe a bit confusing.",
  s2: "Let me know when you are free for a call sometime soon, whenever works really.",
};

const OUTPUTS: Record<PhraseId, Record<SkillId, string>> = {
  s1: {
    refine:
      "I've been through the deck — the story lands, though a few sections would benefit from a clearer read.",
    grammar:
      "I had a look at it, and I think it's mostly fine, but some parts may be a bit confusing.",
    shorten: "Reviewed the deck — solid overall, a few sections need clarifying.",
    friendlier:
      "I went through the deck and really liked where it's heading — just a couple of sections we could sharpen together.",
  },
  s2: {
    refine: "Could you share a few times this week that suit you for a short call?",
    grammar: "Let me know when you're free for a call soon — whenever works.",
    shorten: "When works for a quick call?",
    friendlier:
      "Whenever suits you, I'd love to jump on a quick call — just say the word!",
  },
};

const SKILLS: { id: SkillId; label: string; Icon: ComponentType<IconProps> }[] = [
  { id: "refine", label: "Refine", Icon: LinearMagicStar },
  { id: "grammar", label: "Fix grammar", Icon: LinearTickCircle },
  { id: "shorten", label: "Shorten", Icon: LinearFlash },
  { id: "friendlier", label: "Friendlier", Icon: LinearSms },
];

const CATEGORY_TILE: Record<Category, string> = {
  writing: "var(--color-tile-sky)",
  coding: "var(--color-tile-sand)",
  research: "var(--color-tile-clay)",
  ops: "var(--color-tile-stone)",
  custom: "var(--color-tile-dusk)",
};

type CustomItem = {
  label: string;
  category: Category;
  Icon: ComponentType<IconProps>;
  app: string;
  input: string;
  output: string;
};

const CUSTOM_SKILLS: Record<CustomSkillId, CustomItem> = {
  "diff-pr": {
    label: "Git Diff → PR",
    category: "coding",
    Icon: LinearCode,
    app: "VS Code — changes.patch",
    input:
      "diff --git a/src/auth.ts b/src/auth.ts\n@@ -12,6 +12,9 @@ export async function GET\n- // TODO: check session\n+ const session = await auth();\n+ if (!session?.user) {\n+   redirect(\"/login\");\n+ }",
    output:
      "Summary: Enforces sign-in before the dashboard renders.\n\nKey changes\n• Adds an auth() session check at the route entry\n• Redirects anonymous visitors to /login\n• Drops the stale TODO comment\n\nTesting: signed-out visit redirects, signed-in visit renders.",
  },
  "angry-ticket": {
    label: "Angry Ticket → Solution",
    category: "ops",
    Icon: LinearHeadphone,
    app: "Helpdesk — ticket #4821",
    input:
      "This is the SECOND time you've charged me after I cancelled. Your support is a joke. Fix this NOW or I'm disputing with my bank.",
    output:
      "You're right to be frustrated — being charged after cancelling, twice, is on us. I've refunded both charges today; you'll see them within 3–5 business days. I've also flagged your account so billing stays stopped, and I'll personally email you tomorrow to confirm no renewal is scheduled.",
  },
  deai: {
    label: "De-AI Fluff",
    category: "writing",
    Icon: LinearMagicStar,
    app: "Notion — launch-draft",
    input:
      "Leverage our cutting-edge platform to seamlessly synergize cross-functional workflows and unlock unprecedented productivity gains across your entire organization.",
    output:
      "Our platform helps teams work together without the busywork — so the whole company gets more done.",
  },
  notes: {
    label: "Notes → Action Items",
    category: "ops",
    Icon: LinearNote2,
    app: "Notes — retro.txt",
    input:
      "onboarding drop-off is brutal, step 3 kills everyone. jin: make it skippable. also tooltips — new users don't know what the bar does. priya: i'll take tooltips, you take skip. thursday.",
    output:
      "Action items\n• Jin — make onboarding step 3 skippable (Thu)\n• Priya — add first-run Skill Bar tooltips (Thu)\n\nSlack recap: Onboarding drop-off traced to step 3. Jin owns the skip control, Priya owns tooltips — both land Thursday.",
  },
};

const CUSTOM_ORDER: CustomSkillId[] = ["diff-pr", "angry-ticket", "deai", "notes"];

/** Fixed sample the visitor-built skill runs on — the instruction is theirs,
 *  the transform is simulated. */
const BUILDER_SAMPLE = {
  app: "Any Windows app",
  input:
    "hey team, standup moved to 9:30 tomorrow, also bring your sprint notes and dont forget the retro doc is due",
  output:
    "Hi team — standup moves to 9:30 tomorrow. Please bring your sprint notes, and remember the retro doc is due.",
};

const BAR_HALF = 200; // half of the floating bar's max width, for clamping

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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-[10px] py-[3px] text-[10px] font-medium text-ink">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: CATEGORY_TILE[category] }}
      />
      {category}
    </span>
  );
}

/** Title-case + truncate a plain-English instruction into a chip label. */
function builderTitle(text: string): string {
  const trimmed = text.trim();
  const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return titled.length > 30 ? `${titled.slice(0, 30).trimEnd()}…` : titled;
}

export function SkillBarShowcase() {
  const reduce = useReducedMotion() ?? false;
  const [coarse, setCoarse] = useState(false);
  const [selectedId, setSelectedId] = useState<PhraseId | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [activeSkill, setActiveSkill] = useState<SkillId | null>(null);
  const [replaced, setReplaced] = useState<Partial<Record<PhraseId, SkillId>>>({});
  const [anchor, setAnchor] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const [announce, setAnnounce] = useState("");

  const [tab, setTab] = useState<TabId>("builtin");
  const [customSel, setCustomSel] = useState<CustomSelection>("diff-pr");
  const [customStatus, setCustomStatus] = useState<CustomStatus>("idle");
  const [builderText, setBuilderText] = useState("");

  const sceneRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const phraseRefs = useRef<Partial<Record<PhraseId, HTMLButtonElement>>>({});
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const workTimer = useRef<number | undefined>(undefined);
  const customTimer = useRef<number | undefined>(undefined);
  const resultCount = useRef(0);

  useDemoView(sceneRef, "skillbar_view");

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(workTimer.current);
      window.clearTimeout(customTimer.current);
    },
    []
  );

  const positionFor = useCallback((id: PhraseId) => {
    const scene = sceneRef.current;
    const btn = phraseRefs.current[id];
    if (!scene || !btn) return null;
    const s = scene.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const below = b.top - s.top < 72;
    const center = b.left - s.left + b.width / 2;
    const left = Math.min(Math.max(center, BAR_HALF + 10), s.width - BAR_HALF - 10);
    const top = below ? b.bottom - s.top + 10 : b.top - s.top - 10;
    return { left, top, below };
  }, []);

  const deselect = useCallback(() => {
    window.clearTimeout(workTimer.current);
    setSelectedId(null);
    setStatus("idle");
    setActiveSkill(null);
    setAnchor(null);
  }, []);

  const select = useCallback(
    (id: PhraseId, method: "drag" | "guided" | "tap") => {
      window.clearTimeout(workTimer.current);
      setSelectedId(id);
      setStatus("selected");
      setActiveSkill(null);
      setAnchor(positionFor(id));
      setAnnounce(`Sentence selected. ${SKILLS.length} actions available.`);
      trackDemo("skillbar_select", { method, phraseId: id });
      if (method !== "drag") {
        // keyboard/click users get their focus carried into the toolbar
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            barRef.current
              ?.querySelector<HTMLButtonElement>("button")
              ?.focus({ preventScroll: true })
          )
        );
      }
    },
    [positionFor]
  );

  /* keep the floating bar pinned through resizes */
  useEffect(() => {
    if (!selectedId || coarse || tab !== "builtin") return;
    const onResize = () => setAnchor(positionFor(selectedId));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [selectedId, coarse, tab, positionFor]);

  /* dismiss on any press outside the scene's interactive parts */
  useEffect(() => {
    if (!selectedId) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const inBar = barRef.current?.contains(t);
      const inPhrase = Object.values(phraseRefs.current).some((b) => b?.contains(t));
      if (!inBar && !inPhrase) deselect();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [selectedId, deselect]);

  /* real drag-selection (fine pointers): snap any selection that touches a
     hinted sentence to that sentence, then run the same synthetic path */
  const onPassagePointerUp = () => {
    if (coarse) return;
    window.setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const toEl = (n: Node | null) =>
        n ? (n instanceof Element ? n : n.parentElement) : null;
      const hit =
        toEl(sel.anchorNode)?.closest<HTMLElement>("[data-phrase-id]") ??
        toEl(sel.focusNode)?.closest<HTMLElement>("[data-phrase-id]");
      if (!hit) return;
      sel.removeAllRanges();
      select(hit.dataset.phraseId as PhraseId, "drag");
    }, 140);
  };

  const runSkill = (skillId: SkillId) => {
    if (!selectedId || status === "working") return;
    const id = selectedId;
    setStatus("working");
    setActiveSkill(skillId);
    trackDemo("skillbar_skill_click", { skillId });
    const hadFocusInBar = !!barRef.current?.contains(document.activeElement);
    workTimer.current = window.setTimeout(
      () => {
        setReplaced((r) => ({ ...r, [id]: skillId }));
        setStatus("replaced");
        resultCount.current += 1;
        trackDemo("skillbar_result", { skillId });
        if (resultCount.current === 2) trackDemo("skillbar_repeat");
        const skill = SKILLS.find((s) => s.id === skillId);
        setAnnounce(`Rewritten with ${skill?.label}: ${OUTPUTS[id][skillId]}`);
        if (hadFocusInBar) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              barRef.current
                ?.querySelector<HTMLButtonElement>("[data-undo]")
                ?.focus({ preventScroll: true })
            )
          );
        }
      },
      reduce ? 200 : 550
    );
  };

  const undo = () => {
    if (!selectedId) return;
    setReplaced((r) => {
      const next = { ...r };
      delete next[selectedId];
      return next;
    });
    setStatus("selected");
    setActiveSkill(null);
    setAnnounce("Original sentence restored.");
    trackDemo("skillbar_undo");
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        barRef.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus({ preventScroll: true })
      )
    );
  };

  const onSceneKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && selectedId) {
      e.preventDefault();
      const btn = phraseRefs.current[selectedId];
      deselect();
      btn?.focus({ preventScroll: true });
    }
  };

  /* ── tab switcher ─────────────────────────────────────────────── */

  const selectTab = (next: TabId) => {
    if (next === tab) return;
    deselect();
    window.clearTimeout(customTimer.current);
    setCustomStatus("idle");
    setTab(next);
    setAnnounce(
      next === "builtin"
        ? "Built-in Skills tab. Click an underlined sentence, then pick an action."
        : "Custom Automation Skills tab. Pick a skill to load its sample, then run it from the Skill Bar."
    );
  };

  const onTabListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const order: TabId[] = ["builtin", "custom"];
    const i = order.indexOf(tab);
    const next =
      order[(i + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
    selectTab(next);
    tabRefs.current[next]?.focus({ preventScroll: true });
  };

  /* ── custom automation tab ────────────────────────────────────── */

  const trimmedBuilder = builderText.trim();
  const builderActive = customSel === "builder" && trimmedBuilder.length > 0;
  const activeCustom: CustomItem = builderActive
    ? {
        label: builderTitle(builderText),
        category: "custom",
        Icon: LinearAdd,
        app: BUILDER_SAMPLE.app,
        input: BUILDER_SAMPLE.input,
        output: BUILDER_SAMPLE.output,
      }
    : CUSTOM_SKILLS[customSel === "builder" ? "diff-pr" : customSel];

  const pickCustom = (id: CustomSkillId) => {
    window.clearTimeout(customTimer.current);
    setCustomSel(id);
    setCustomStatus("idle");
    const item = CUSTOM_SKILLS[id];
    trackDemo("skillbuilder_recipe", { recipe: id });
    setAnnounce(`${item.label} selected — sample loaded. Run it from the Skill Bar.`);
  };

  const runCustom = (label: string) => {
    if (customStatus === "working") return;
    trackDemo("skillbuilder_run", { recipe: customSel });
    setCustomStatus("working");
    setAnnounce(`Running ${label} on the sample input.`);
    customTimer.current = window.setTimeout(
      () => {
        setCustomStatus("done");
        setAnnounce(`Done — ${label} transformed the input. Compare before and after.`);
      },
      reduce ? 200 : 800
    );
  };

  const phraseText = (id: PhraseId) => {
    const skill = replaced[id];
    return skill ? OUTPUTS[id][skill] : PHRASES[id];
  };

  const barBody = (
    <AnimatePresence mode="wait" initial={false}>
      {status === "working" ? (
        <motion.div
          key="working"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="flex h-9 items-center justify-center gap-2 px-4 text-xs font-medium text-muted"
        >
          <Spinner />
          Working…
        </motion.div>
      ) : status === "replaced" ? (
        <motion.div
          key="replaced"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="flex h-9 items-center gap-1.5 px-1.5"
        >
          <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-success">
            <LinearTickCircle size={14} />
            Replaced
          </span>
          <span aria-hidden="true" className="h-4 w-px bg-dark-2" />
          <button
            type="button"
            data-undo
            onClick={undo}
            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-on-accent transition-colors duration-150 hover:bg-surface-hover"
          >
            Undo
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="skills"
          role="toolbar"
          aria-label="Text actions"
          onKeyDown={arrowNav}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="flex items-center gap-0.5 p-0.5"
        >
          {SKILLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => runSkill(id)}
              className={`flex ${coarse ? "min-h-[44px] px-3.5" : "h-9 px-3"} cursor-pointer items-center gap-1.5 rounded-[10px] text-xs font-medium text-on-accent transition-colors duration-150 hover:bg-surface-hover ${
                activeSkill === id ? "bg-surface-hover" : ""
              }`}
            >
              <span className="text-accent-hover">
                <Icon size={14} />
              </span>
              {label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const barVisible = selectedId !== null;

  return (
    <div ref={sceneRef} onKeyDown={onSceneKeyDown} className="relative">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* segmented switcher — real tabs, arrow keys move and select */}
      <div
        role="tablist"
        aria-label="Skill Bar demos"
        onKeyDown={onTabListKeyDown}
        className="glass-chip mx-auto mb-6 flex w-fit max-w-full items-center gap-1 rounded-full p-1"
      >
        {(
          [
            ["builtin", "Built-in Skills"],
            ["custom", "Custom Automation Skills"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`skillbar-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`skillbar-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            className={`ease-apple cursor-pointer rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-300 ${
              tab === id
                ? "bg-white/[0.11] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "builtin" ? (
        <div
          role="tabpanel"
          id="skillbar-panel-builtin"
          aria-labelledby="skillbar-tab-builtin"
        >
          {/* fake email window */}
          <div className="glass-panel mx-auto max-w-[860px] overflow-hidden text-left">
            <div className="flex items-center gap-2 border-b border-line bg-muted/5 px-4 py-3">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="ml-2.5 text-xs text-muted">New message — Outlook</span>
            </div>
            <div className="border-b border-line px-6 py-2.5 text-[12px] text-muted sm:px-8">
              <span className="text-ink-soft">To:</span> priya@northbeam.io
            </div>
            <div className="border-b border-line px-6 py-2.5 text-[12px] text-muted sm:px-8">
              <span className="text-ink-soft">Subject:</span> Deck feedback — next steps
            </div>

            <div
              className="px-6 py-7 font-sans text-[14px] leading-[1.9] text-ink-soft sm:px-8"
              onPointerUp={onPassagePointerUp}
            >
              <p className="m-0">Hi Priya,</p>
              <p className="m-0 mt-4 max-w-[68ch]">
                Thanks for sending the deck over.{" "}
                {(["s1", "s2"] as const).map((id, i) => (
                  <span key={id}>
                    {i === 1 && <> We&rsquo;re aiming to lock scope by Friday. </>}
                    <button
                      ref={(el) => {
                        if (el) phraseRefs.current[id] = el;
                      }}
                      type="button"
                      data-phrase-id={id}
                      data-selected={selectedId === id}
                      aria-expanded={selectedId === id}
                      aria-label={`Try it: select the sentence “${phraseText(id)}”`}
                      onClick={() =>
                        selectedId === id && status !== "working"
                          ? deselect()
                          : select(id, coarse ? "tap" : "guided")
                      }
                      className="demo-phrase"
                    >
                      <motion.span
                        key={phraseText(id)}
                        initial={
                          reduce ? false : { opacity: 0, filter: "blur(3px)" }
                        }
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        transition={{ duration: 0.25 }}
                        className={
                          replaced[id] && selectedId === id && status === "replaced" && !reduce
                            ? "demo-wash rounded-[3px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                            : undefined
                        }
                      >
                        {phraseText(id)}
                      </motion.span>
                    </button>
                  </span>
                ))}
              </p>
              <p className="m-0 mt-4">— Arjun</p>

              {/* docked bar on touch — no floating anchor to fight the native UI */}
              {coarse && (
                <AnimatePresence>
                  {barVisible && (
                    <motion.div
                      ref={barRef}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={reduce ? { duration: 0.12 } : SPRING}
                      className="glass-solid mt-5 flex flex-wrap items-center justify-center gap-1 rounded-[14px] p-1.5"
                    >
                      {barBody}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 sm:px-8">
              <span className="text-[11px] text-muted">
                {coarse
                  ? "Tap an underlined sentence."
                  : "Click an underlined sentence — drag-selecting it works too."}
              </span>
              <span className="hidden text-[11px] font-medium text-accent-hover sm:inline">
                Skill Bar — live demo
              </span>
            </div>
          </div>

          {/* floating bar on fine pointers, anchored to the selection */}
          {!coarse && (
            <AnimatePresence>
              {barVisible && anchor && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: anchor.left,
                    top: anchor.top,
                    transform: `translateX(-50%) translateY(${anchor.below ? "0" : "-100%"})`,
                  }}
                >
                  <motion.div
                    ref={barRef}
                    layout
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, y: anchor.below ? -6 : 6, scale: 0.95 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={
                      reduce ? { duration: 0.12 } : { ...SPRING, stiffness: 500, damping: 32 }
                    }
                    className="glass-solid pointer-events-auto rounded-[14px] shadow-overlay"
                  >
                    {barBody}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="skillbar-panel-custom"
          aria-labelledby="skillbar-tab-custom"
          className="mx-auto max-w-[860px]"
        >
          {/* preset picker — selecting one swaps the sample in the window */}
          <div
            role="group"
            aria-label="Custom skill presets"
            onKeyDown={arrowNav}
            className="mb-4 flex flex-wrap justify-center gap-2"
          >
            {CUSTOM_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={customSel === id}
                onClick={() => pickCustom(id)}
                className={`cursor-pointer rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-colors duration-150 ${
                  customSel === id
                    ? "bg-brand/25 text-ink"
                    : "bg-muted/10 text-muted hover:text-ink"
                }`}
              >
                {CUSTOM_SKILLS[id].label}
              </button>
            ))}
          </div>

          {/* fake app window holding the sample input */}
          <div className="glass-panel overflow-hidden text-left">
            <div className="flex items-center gap-2 border-b border-line bg-muted/5 px-4 py-3">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={activeCustom.app}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="ml-2.5 text-xs text-muted"
                >
                  {activeCustom.app}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b border-line p-6 sm:p-7 md:border-r md:border-b-0">
                <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                  Before — your raw text
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={activeCustom.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.25 }}
                    className="m-0 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted"
                  >
                    {activeCustom.input}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="p-6 sm:p-7">
                <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                  After — one click later
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {customStatus === "working" ? (
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
                  ) : customStatus === "done" ? (
                    <motion.p
                      key={`done-${activeCustom.label}`}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.25 }}
                      className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft"
                    >
                      {activeCustom.output}
                    </motion.p>
                  ) : (
                    <motion.p
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="m-0 text-xs leading-relaxed text-muted"
                    >
                      Press the skill on the Skill Bar below to transform the input.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* the Skill Bar — one chip per available custom skill */}
            <div className="border-t border-line px-6 py-4 sm:px-7">
              <div
                role="toolbar"
                aria-label="Skill Bar"
                onKeyDown={arrowNav}
                className="glass-solid flex flex-wrap items-center justify-center gap-1 rounded-[14px] p-1.5"
              >
                <span className="px-2 text-[11px] font-medium text-muted">
                  Skill Bar
                </span>
                <button
                  type="button"
                  onClick={() => runCustom(activeCustom.label)}
                  disabled={customStatus === "working"}
                  className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium text-on-accent transition-colors duration-150 hover:bg-surface-hover disabled:cursor-wait ${
                    customStatus !== "idle" ? "bg-surface-hover" : ""
                  }`}
                >
                  <span className="text-accent-hover">
                    {customStatus === "working" ? (
                      <Spinner />
                    ) : (
                      <activeCustom.Icon size={14} />
                    )}
                  </span>
                  {activeCustom.label}
                </button>
                {/* a typed instruction instantly becomes a 1-click chip */}
                {trimmedBuilder.length > 0 && !builderActive && (
                  <motion.button
                    type="button"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduce ? { duration: 0.12 } : SPRING}
                    onClick={() => {
                      setCustomSel("builder");
                      runCustom(builderTitle(builderText));
                    }}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium text-on-accent transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span className="text-accent-hover">
                      <LinearAdd size={14} />
                    </span>
                    {builderTitle(builderText)}
                  </motion.button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 sm:px-7">
              <span className="text-[11px] text-muted">
                Simulated demo — the real app runs your skills on the managed relay.
              </span>
              <span className="hidden text-[11px] font-medium text-accent-hover sm:inline">
                Skill Bar — live demo
              </span>
            </div>
          </div>

          {/* + Build Custom Skill preview card */}
          <div className="glass-card mt-4 flex flex-col gap-3 p-5 sm:p-6">
            <label
              htmlFor="skillbar-builder-input"
              className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase"
            >
              + Build Custom Skill
            </label>
            <input
              id="skillbar-builder-input"
              type="text"
              value={builderText}
              onChange={(e) => {
                setBuilderText(e.target.value);
                if (customSel === "builder" && e.target.value.trim().length === 0) {
                  setCustomSel("diff-pr");
                }
              }}
              placeholder="e.g. Convert customer complaint into a polite resolution"
              className="glass-chip w-full rounded-lg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted"
            />
            <div className="flex min-h-[34px] flex-wrap items-center gap-2.5">
              {trimmedBuilder.length > 0 ? (
                <motion.span
                  key={builderTitle(builderText)}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0.12 } : SPRING}
                  className="inline-flex items-center gap-2"
                >
                  <span className="glass-solid inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium text-on-accent">
                    <span className="text-accent-hover">
                      <LinearAdd size={14} />
                    </span>
                    {builderTitle(builderText)}
                  </span>
                  <CategoryBadge category="custom" />
                </motion.span>
              ) : (
                <span className="text-xs leading-relaxed text-muted">
                  Type an instruction — it becomes a 1-click skill chip on the
                  bar above, ready for any Windows app.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
