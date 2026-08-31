import type { Metadata } from "next";
import Link from "@/components/Link";
import { LinearKeyboard } from "@/components/icons/LinearKeyboard";
import { LinearNote2 } from "@/components/icons/LinearNote2";
import { LinearSend2 } from "@/components/icons/LinearSend2";
import { LinearFlash } from "@/components/icons/LinearFlash";
import { LinearCpu } from "@/components/icons/LinearCpu";
import { LinearGlobal } from "@/components/icons/LinearGlobal";
import { LinearShieldTick } from "@/components/icons/LinearShieldTick";
import { LinearCode } from "@/components/icons/LinearCode";
import { LinearDocumentText } from "@/components/icons/LinearDocumentText";
import { LinearMessageText } from "@/components/icons/LinearMessageText";
import { LinearSms } from "@/components/icons/LinearSms";
import { LinearMonitor } from "@/components/icons/LinearMonitor";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { Reveal, FadeUp } from "@/components/Reveal";
import { SkillBarShowcase } from "@/components/demos/SkillBarShowcase";
import { CustomSkillBuilderShowcase } from "@/components/demos/CustomSkillBuilderShowcase";
import { AppChip } from "@/components/AppChip";
import { WindowsLogo } from "@/components/icons/WindowsLogo";
import { HeroSection } from "@/components/HeroSection";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { DirectAnswer, FaqBlocks, JsonLd } from "@/components/SeoContent";
import { HOTKEYS } from "@/lib/constants/hotkeys";
// The daily allowances quoted in the feature copy come from the constant the
// generation gate actually enforces, not from a number retyped into prose.
import { TIER_DAILY_CREDITS } from "@/lib/entitlements";
import { toLocale } from "@/i18n-config";
import { pageGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Free AI Vibe Coding Prompt Writer for Windows | InsertGo AI",
  },
  description:
    "InsertGo is a free AI vibe coding prompt writer for Windows: turn a rough idea into a specific instruction, then insert it at the cursor in any app. No card.",
};

// Icon files live in public/app-icons — self-hosted copies of the Iconify
// originals, so the marquee costs zero third-party requests.
const marqueeApps: [string, string][] = [
  ["Claude", "claude-icon"],
  ["Claude Code", "claude-icon"],
  ["ChatGPT", "openai-icon"],
  ["Codex", "openai-icon"],
  ["Cursor", "cursor"],
  ["GitHub Copilot", "github-copilot"],
  ["Perplexity", "perplexity-icon"],
  ["Gemini", "google-gemini"],
  ["VS Code", "visual-studio-code"],
  ["IntelliJ", "intellij-idea"],
  ["Windows Terminal", "windowsterminal"],
  ["Chrome", "chrome"],
  ["Edge", "microsoft-edge"],
  ["Firefox", "firefox"],
  ["Brave", "brave"],
  ["Outlook", "file-type-outlook"],
];

const steps = [
  {
    num: "01",
    icon: LinearKeyboard,
    tile: "var(--color-tile-sand)",
    title: "Press the hotkey",
    // "appears instantly" was a timing claim with nothing measuring it, which
    // docs/seo-aeo-strategy.md rules out in prose as well as in schema.
    desc: "InsertGo opens as a floating window above whatever you're doing, and records which app had focus — no window switching, no lost focus.",
  },
  {
    num: "02",
    icon: LinearNote2,
    tile: "var(--color-tile-sky)",
    title: "Pick a prompt spec",
    desc: "Type the instruction or grab a saved spec from your library. Dynamic prompts open a quick fill-in form — scope, constraint, idiom, done condition — before they run.",
  },
  {
    num: "03",
    icon: LinearSend2,
    tile: "var(--color-tile-stone)",
    title: "Watch it land",
    desc: "Hit Insert and the text is pasted straight into the app you came from — focus restored, clipboard returned to exactly what it was.",
  },
];

const features = [
  {
    icon: LinearFlash,
    tile: "var(--color-tile-sand)",
    title: "One hotkey, everywhere",
    desc: `${HOTKEYS.primary.label} summons the InsertGo overlay above any app. It remembers exactly where you were, so the result goes straight back there. Two more hotkeys rewrite the focused field in place (${HOTKEYS.improve.label}) and undo that rewrite (${HOTKEYS.undo.label}) without opening the window at all.`,
  },
  {
    icon: LinearNote2,
    tile: "var(--color-tile-mist)",
    title: "Reusable prompt specs",
    desc: "Save the instructions you hand agents daily — refactor, review the diff, write the test — organized by category. Dynamic prompts use 5 form commands — {formtext}, {formparagraph}, {formmenu}, {formtoggle}, {clipboard} — and open a fill-in form before they run, so only the fully expanded prompt is sent.",
  },
  {
    icon: LinearCpu,
    tile: "var(--color-tile-sky)",
    title: "Managed AI, zero setup",
    desc: `No API keys, no provider accounts, no model config. Sign in once and every prompt runs through the managed InsertGo relay on a fast default model. Free includes ${TIER_DAILY_CREDITS.free} credits every day; Plus and Pro raise that to ${TIER_DAILY_CREDITS.plus} and ${TIER_DAILY_CREDITS.pro}.`,
  },
  {
    icon: LinearSend2,
    tile: "var(--color-tile-stone)",
    title: "Zero copy-paste",
    desc: "Insert pastes the result directly into the app that was in focus — then quietly restores whatever was on your clipboard.",
  },
  {
    icon: LinearGlobal,
    tile: "var(--color-tile-clay)",
    title: "Universally compatible",
    desc: "Runs at the OS level on Windows 10 and 11, not as a per-app plugin, so it works with every application that accepts a standard Ctrl+V paste — browsers, editors, documents, chat, email, terminals.",
  },
  {
    icon: LinearShieldTick,
    tile: "var(--color-tile-dusk)",
    title: "Private by design",
    desc: "Prompts, templates, and settings live in plain local files on your machine. Nothing leaves it except the prompts you explicitly run through the managed relay.",
  },
  {
    icon: LinearMagicStar,
    tile: "var(--color-tile-clay)",
    title: "Custom skills in plain English",
    desc: "Describe a skill in a sentence and the AI Skill Generator builds the prompt template for you. Run it from the Skill Bar in any app — still zero API keys.",
  },
];

const categories = [
  { icon: LinearGlobal, tile: "var(--color-tile-sand)", name: "Web browsers", apps: ["Chrome", "Edge", "Firefox"] },
  { icon: LinearCode, tile: "var(--color-tile-sky)", name: "Code editors", apps: ["VS Code", "IntelliJ", "Sublime Text"] },
  { icon: LinearDocumentText, tile: "var(--color-tile-mist)", name: "Documents", apps: ["Microsoft Word", "Notion", "Google Docs"] },
  { icon: LinearMessageText, tile: "var(--color-tile-stone)", name: "Communication", apps: ["Slack", "Teams", "Discord", "WhatsApp Web"] },
  { icon: LinearSms, tile: "var(--color-tile-clay)", name: "Email", apps: ["Outlook", "Thunderbird"] },
  { icon: LinearMonitor, tile: "var(--color-tile-stone)", name: "Everything else", apps: ["Any app with Ctrl+V"] },
];

/**
 * The extractable definition of the product, in one paragraph, written once.
 * It is rendered as the visible answer capsule below the hero AND supplied as
 * the first FAQ answer, because docs/seo-aeo-strategy.md requires the same
 * answer in page content and structured data — two hand-maintained copies is
 * how those two drift apart.
 *
 * Every number in it is checkable against a source of truth in this repo:
 * three hotkeys from lib/constants/hotkeys.ts, the five form commands from the
 * prompt-library reference, Windows 10/11 from the SoftwareApplication node.
 */
const HOME_ANSWER =
  `InsertGo AI is a free, floating prompt assistant for Windows 10 and 11, ` +
  `built for vibe coding. Press ${HOTKEYS.primary.label} over Cursor, Claude Code, a terminal ` +
  `or any other app, turn a rough idea into a specific instruction, then ` +
  `insert it at your cursor. ${Object.keys(HOTKEYS).length} global hotkeys, 5 form commands, ` +
  `${TIER_DAILY_CREDITS.free} free credits every day, no API key, no browser tab.`;

/**
 * The category definition, kept separate from the product definition above.
 * Same two-consumer rule: rendered as the second answer capsule AND supplied
 * verbatim as the matching FAQ answer, so the page text and the FAQPage node
 * cannot drift. It describes the practice, not the product — an answer engine
 * asked "what is vibe coding prompt writing" gets a definition, not a pitch.
 */
const VIBE_ANSWER =
  "Vibe coding prompt writing is specifying the change before the agent " +
  "writes it: name the files in scope, the constraint, the idiom to follow, " +
  "and the condition that means it is done. InsertGo keeps those specs as " +
  "reusable templates with fill-in fields and inserts the expanded prompt " +
  "into whichever coding agent has focus.";

const homeFaqs = [
  {
    question: "What is InsertGo AI?",
    answer: HOME_ANSWER,
  },
  {
    question: "What is vibe coding prompt writing?",
    answer: VIBE_ANSWER,
  },
  {
    // The "free" modifier is a search intent of its own ("free AI prompt
    // assistant windows", "free alternative to X"), and the answer has to be
    // checkable: the allowances come from TIER_DAILY_CREDITS, which is what
    // the generation gate enforces, and the prices stay on /pricing rather
    // than being retyped into an answer that would drift the day they move.
    question: "Is InsertGo AI free?",
    answer:
      `Yes. The Free plan is ${TIER_DAILY_CREDITS.free} AI credits every day, forever, with the full ` +
      `overlay, all ${Object.keys(HOTKEYS).length} hotkeys and every Windows paste target — no credit card, ` +
      `no API key, no trial clock. Plus and Pro raise the daily allowance to ` +
      `${TIER_DAILY_CREDITS.plus} and ${TIER_DAILY_CREDITS.pro}, and add-on credit packs never expire; the pricing page ` +
      `carries the current amounts.`,
  },
  {
    question: "How do I write better prompts for vibe coding workflows?",
    answer:
      "Replace the vibe with four fixed slots: scope (which files or module), constraint (what must not change), idiom (the pattern already used in this codebase), and done condition (the test or behaviour that proves it). Save that shape once as a dynamic prompt — {formtext} for scope, {formmenu} for the idiom, {clipboard} for the diff or stack trace — and refill it per task instead of retyping it.",
  },
  {
    question: "Does InsertGo work with Cursor, Claude Code, and GitHub Copilot?",
    answer:
      "Yes. InsertGo runs at the Windows OS level rather than as an editor extension, so it inserts into any agent chat box or editor that accepts a standard Ctrl+V paste — Cursor, Claude Code, Copilot Chat, VS Code, JetBrains IDEs, Windows Terminal. If Windows blocks the target window, InsertGo leaves the result on the clipboard and asks you to paste it yourself.",
  },
  {
    question: "How is InsertGo different from web-based AI tools?",
    answer:
      "Web AI tools live in a browser tab. InsertGo is a native Windows workflow layer: open it above the active app, use saved prompt templates with runtime fields, then return generated text to the original cursor while preserving prior clipboard contents.",
  },
  {
    question: "Does InsertGo work in every Windows app?",
    answer:
      "InsertGo works with applications that accept standard paste input, including most browsers, editors, documents, chat apps, email clients, and terminals. If Windows blocks a target, InsertGo keeps the result copied and asks you to paste manually.",
  },
  {
    // Shortened to one sentence and pointed at the page that owns the query.
    // docs/seo-aeo-strategy.md assigns "Raycast alternative for Windows AI
    // prompts" to /alternatives/raycast-windows; the long answer that used to
    // sit here answered it well enough to compete with its own comparison
    // page, and did so undated and unsourced where that page is both.
    question: "Is InsertGo a Raycast alternative for Windows AI prompts?",
    answer:
      "Yes, when what you want is a focused AI prompt and text-insertion workflow rather than a full launcher. InsertGo concentrates on dynamic prompt templates, selection actions and verified write-back into the app you were using. The dated side-by-side comparison lives on the Raycast alternative page.",
  },
  {
    question: "Can I build my own AI skills without API keys?",
    answer:
      "Yes. Describe the skill in plain English and the AI Skill Generator writes the prompt template, with a [PASTE …] placeholder for your text. The skill runs on the managed InsertGo relay — no provider accounts or keys — and works from the Skill Bar in any Windows app.",
  },
];

const workflowLinks = [
  {
    title: "AI text auto-insert",
    text: "Generate, review, and return text to the Windows app where you started.",
    href: "/features/auto-text-insert",
  },
  {
    title: "Dynamic prompt library",
    text: "Build reusable templates with fields, menus, toggles, and clipboard values.",
    href: "/features/prompt-library",
  },
  {
    title: "Raycast comparison",
    text: "Choose between a focused AI prompt workflow and a broad productivity launcher.",
    href: "/alternatives/raycast-windows",
  },
  {
    title: "Windows AI guide",
    text: "Understand overlays, focus handoff, selected text, privacy, and providers.",
    href: "/blog/windows-ai-productivity-guide",
  },
];

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  return (
    <main className="relative overflow-hidden">
      {/* One @graph, not two standalone nodes. The homepage published a
          SoftwareApplication and an FAQPage that referenced neither the WebSite
          emitted by app/layout.tsx nor each other, and no WebPage node at all —
          the same orphan shape docs/seo-aeo-strategy.md records fixing on /faq,
          left in place on the one page every other route links up to. */}
      <JsonLd
        data={pageGraph({
          locale,
          path: "",
          name: "InsertGo AI — AI vibe coding prompt writer for Windows",
          description: HOME_ANSWER,
          breadcrumbs: [{ name: "Home", href: "/" }],
          faqs: homeFaqs,
        })}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-300px] left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--color-surface) 45%, transparent), transparent 70%)",
        }}
      />

      {/* HERO */}
      <HeroSection>
        <FadeUp>
          <Link
            href="/features"
            className="glass-chip mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors duration-200 hover:border-brand"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-brand/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            New — dynamic prompts with fill-in forms
            <span className="text-muted">→</span>
          </Link>
        </FadeUp>

        <FadeUp delay={0.05}>
          <h1 className="m-0 max-w-[900px] font-serif text-[clamp(44px,7vw,84px)] leading-[1.06] font-semibold tracking-[-0.03em] text-ink">
            AI Vibe coding prompt writer
            <br />
            <span className="rounded-xl bg-accent px-4 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
              for Windows.
            </span>
          </h1>
        </FadeUp>

        <FadeUp delay={0.12}>
          <p className="mt-[26px] max-w-[620px] text-[clamp(16px,2vw,20px)] leading-relaxed text-muted">
            Vibe coding is only as good as the instruction you hand the agent.
            InsertGo floats above Cursor, Claude Code, your terminal or any
            other Windows app: press a global hotkey, turn a rough idea into a
            specific prompt with a reusable template, then insert it back at
            your cursor without losing your place or your clipboard.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <DownloadButton />
            <GhostButton href="/how-it-works">See how AI insertion works</GhostButton>
          </div>
          <p className="mt-4 text-[13px] text-muted">
            Free forever — {TIER_DAILY_CREDITS.free} AI credits every day, no credit card.
          </p>
        </FadeUp>

        <FadeUp delay={0.28}>
          <div className="mt-[26px] flex items-center gap-2.5">
            <span className="text-[13px] text-muted">Press</span>
            <span className="inline-flex items-center gap-[5px]">
              {HOTKEYS.primary.keys.map((k) => (
                <span
                  key={k}
                  className="glass-chip rounded-md border-b-2 px-[9px] py-1 text-xs font-medium text-ink"
                >
                  {k}
                </span>
              ))}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              in any app ·
              <WindowsLogo size={12} className="opacity-90" />
              Windows 10 &amp; 11
            </span>
          </div>
        </FadeUp>
      </HeroSection>

      {/* MARQUEE */}
      <section className="pt-[70px] pb-[30px]">
        <Reveal>
          <p className="mb-[26px] text-center text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Insert prompts into the AI tools and editors you already use
          </p>
        </Reveal>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          {/* pausing on hover is what makes a 36s track readable rather than
              decorative — the row is the only place the app names live */}
          {/* The track is the list twice over so the -50% loop is seamless.
              The second copy is presentational only — left exposed, a screen
              reader announces all sixteen app names a second time. */}
          <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
            {marqueeApps.map(([name, icon]) => (
              <AppChip key={name} name={name} icon={icon} />
            ))}
            <span aria-hidden className="flex gap-3">
              {marqueeApps.map(([name, icon]) => (
                <AppChip key={`dup-${name}`} name={name} icon={icon} />
              ))}
            </span>
          </div>
        </div>
      </section>

      {/* DIRECT ANSWERS — third block of twelve, so both extractable
          definitions sit inside the top third of the document rather than in
          the FAQ at the bottom. The strings are homeFaqs[0] and homeFaqs[1]
          verbatim, which is what the FAQPage node carries. */}
      <section className="flex flex-col gap-[18px] px-6 pt-6 pb-4">
        <Reveal>
          <DirectAnswer title="What is InsertGo AI?">{HOME_ANSWER}</DirectAnswer>
        </Reveal>
        {/* Second capsule, same rule as the first: the string is homeFaqs[1]'s
            answer, not a paraphrase of it. The category question ("what is
            vibe coding prompt writing") is answered before the product one is
            elaborated, because that is the query order an answer engine walks. */}
        <Reveal delay={0.06}>
          <DirectAnswer title="What is vibe coding prompt writing?">
            {VIBE_ANSWER}
          </DirectAnswer>
        </Reveal>
        <Reveal delay={0.12} className="text-center">
          <Link
            href="/use-cases/developers"
            className="text-[15px] font-medium text-brand hover:underline"
          >
            See the prompt templates for VS Code and Windows Terminal →
          </Link>
        </Reveal>
      </section>

      {/* 3 STEPS */}
      <section className="mx-auto max-w-[1080px] px-6 py-[90px]">
        <Reveal className="mx-auto mb-14 max-w-[640px] text-center">
          <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            From rough idea to specific instruction in three keystrokes
          </h2>
        </Reveal>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.1} hoverLift>
              <div className="glass-card flex h-full flex-col gap-3.5 p-7">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink"
                  style={{ background: s.tile }}
                >
                  <s.icon size={22} />
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-medium text-brand">
                    {s.num}
                  </span>
                  <h3 className="m-0 font-serif text-xl font-semibold tracking-[-0.01em] text-ink">
                    {s.title}
                  </h3>
                </div>
                <p className="m-0 text-[15px] leading-relaxed text-muted">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-9 text-center">
          <Link
            href="/how-it-works"
            className="text-[15px] font-medium text-brand hover:underline"
          >
            See the full walkthrough →
          </Link>
        </Reveal>
      </section>

      {/* SKILL BAR DEMO */}
      <section className="mx-auto max-w-[1080px] px-6 pb-[90px]">
        <Reveal className="mx-auto mb-12 max-w-[660px] text-center">
          <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Selection actions
          </p>
          <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            Select text. Fix it in one click.
          </h2>
          <p className="mt-[18px] text-[17px] leading-relaxed text-muted">
            The Skill Bar appears the moment you select text in any Windows app
            — no hotkey, no palette, no copy-paste. Try it on the draft below.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <SkillBarShowcase />
        </Reveal>
      </section>

      {/* CUSTOM SKILL BUILDER */}
      <section className="mx-auto max-w-[1080px] px-6 pb-[90px]">
        <Reveal className="mx-auto mb-12 max-w-[680px] text-center">
          <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Custom skills &amp; automation
          </p>
          <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            Describe a skill in plain English. Run it anywhere in one click.
          </h2>
          <p className="mt-[18px] text-[17px] leading-relaxed text-muted">
            The AI Skill Generator turns a sentence into a working prompt
            template — no API keys, no setup — and the skill lands on your
            Skill Bar for every Windows app: turn a diff into a PR description,
            a stack trace into a triage note, a rough idea into a scoped
            instruction. Build one below.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <CustomSkillBuilderShowcase />
        </Reveal>
        <Reveal className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <DownloadButton />
          <Link
            href="/features"
            className="text-[15px] font-medium text-brand hover:underline"
          >
            Explore all features →
          </Link>
        </Reveal>
      </section>

      {/* FEATURE GRID */}
      <section className="section-tint px-6 py-[90px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-14 max-w-[600px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Why InsertGo
            </p>
            <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
              A prompt workbench over your editor, terminal, and browser
            </h2>
          </Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[18px]">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08} hoverLift>
                <div className="glass-card group flex h-full flex-col gap-3 p-7">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-ink transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{ background: f.tile }}
                  >
                    <f.icon size={22} />
                  </span>
                  <h3 className="mt-1.5 mb-0 font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink">
                    {f.title}
                  </h3>
                  <p className="m-0 text-[15px] leading-relaxed text-muted">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-9 text-center">
            <Link
              href="/features"
              className="text-[15px] font-medium text-brand hover:underline"
            >
              Explore all features →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* COMPATIBILITY */}
      <section className="mx-auto max-w-[1080px] px-6 py-[90px]">
        <Reveal className="mx-auto mb-14 max-w-[680px] text-center">
          <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Universal compatibility
          </p>
          <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            If it can paste, it works.
          </h2>
          <p className="mt-[18px] text-[17px] leading-relaxed text-muted">
            InsertGo operates at the operating-system level, so any Windows app
            that supports Ctrl+V is supported. No plugins, no extensions, no
            per-app setup.
          </p>
        </Reveal>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[18px]">
          {categories.map((c, i) => (
            <Reveal key={c.name} delay={(i % 3) * 0.08} hoverLift>
              <div className="glass-card flex h-full flex-col gap-3.5 p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-ink"
                    style={{ background: c.tile }}
                  >
                    <c.icon size={18} />
                  </span>
                  <h3 className="m-0 font-serif text-base font-semibold text-ink">
                    {c.name}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.apps.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-muted/10 px-[11px] py-[5px] text-xs font-medium text-ink"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SEARCH-INTENT WORKFLOWS */}
      <section className="section-tint px-6 py-[90px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-12 max-w-[680px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Explore the workflow
            </p>
            <h2 className="m-0 font-serif text-[clamp(30px,4.5vw,46px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
              One assistant, four ways to go deeper
            </h2>
          </Reveal>
          <div className="grid gap-[18px] md:grid-cols-2">
            {workflowLinks.map((item, index) => (
              <Reveal key={item.href} delay={(index % 2) * 0.08}>
                <Link
                  href={item.href}
                  className="glass-card group flex h-full items-start justify-between gap-5 p-7"
                >
                  <span>
                    <span className="font-serif text-xl font-semibold text-ink">
                      {item.title}
                    </span>
                    <span className="mt-2 block text-[15px] leading-relaxed text-muted">
                      {item.text}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="text-xl text-brand transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WEB AI COMPARISON */}
      <section className="mx-auto max-w-[1080px] px-6 py-[90px]">
        <Reveal className="mb-11 max-w-[720px]">
          <h2 className="m-0 font-serif text-[clamp(30px,4.5vw,46px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            InsertGo vs web-based AI tools
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Browser chat remains useful for long conversations. InsertGo removes
            transfer work when AI text belongs inside another Windows app.
          </p>
        </Reveal>
        <Reveal>
          <div className="glass-panel overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">
                InsertGo and typical web AI chat workflow comparison
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    Workflow
                  </th>
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    InsertGo
                  </th>
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    Typical web AI chat
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Access", "Global hotkey over active app", "Open or switch to browser tab"],
                  ["Prompt reuse", "Local dynamic templates with fill-in forms", "Saved chats or provider-specific prompt features"],
                  ["Return text", "Verified paste-back at original cursor", "Copy, switch apps, and paste"],
                  ["App reach", "Any standard Windows paste target", "Browser and supported integrations"],
                  ["Provider model", "Managed path", "Provider tied to that website"],
                ].map(([label, insertgo, web]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <th scope="row" className="p-5 text-sm font-semibold text-ink-soft">
                      {label}
                    </th>
                    <td className="p-5 text-sm leading-relaxed text-muted">{insertgo}</td>
                    <td className="p-5 text-sm leading-relaxed text-muted">{web}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* DIRECT QUESTIONS */}
      <section className="section-tint px-6 py-[90px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-11 max-w-[700px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Direct answers
            </p>
            <h2 className="m-0 font-serif text-[clamp(30px,4.5vw,46px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
              InsertGo AI questions
            </h2>
          </Reveal>
          <FaqBlocks items={homeFaqs} />
        </div>
      </section>

      {/* CTA BAND */}
      <section className="px-6 pt-[60px] pb-[110px]">
        <Reveal>
          <div className="glass-panel mx-auto max-w-[1080px] overflow-hidden px-8 py-[clamp(48px,7vw,88px)] text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute top-[-140px] right-[-100px] h-[360px] w-[360px] rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in srgb, var(--color-surface) 35%, transparent), transparent 70%)",
              }}
            />
            <h2 className="m-0 font-serif text-[clamp(34px,5vw,56px)] leading-[1.08] font-semibold tracking-[-0.025em] text-brand">
              Stop copy-pasting.
              <br />
              <span className="text-accent-hover">Start inserting.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[480px] text-[17px] leading-relaxed text-muted">
              {/* "installed in under a minute" was a timing claim with nothing
                  measuring it. The per-user, no-admin install is the same
                  promise stated as a fact that can be checked. */}
              The floating AI vibe coding prompt writer for Windows. Free to
              download, installs per-user with no admin rights, ready the
              moment you press the hotkey.
            </p>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
              <DownloadButton>Download for Windows</DownloadButton>
              <Link
                href="/pricing"
                className="glass-chip inline-flex h-12 items-center rounded-3xl px-[30px] text-base font-medium text-on-accent transition-colors duration-200 hover:bg-paper/5"
              >
                View pricing
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
