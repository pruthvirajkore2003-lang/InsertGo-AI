/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
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
import { Reveal, FadeUp } from "@/components/Reveal";
import { HeroSection } from "@/components/HeroSection";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { FaqBlocks, JsonLd } from "@/components/SeoContent";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { faqSchema, softwareApplicationSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Floating AI Prompt Assistant for Windows | InsertGo.AI",
  },
  description:
    "InsertGo is a floating AI prompt assistant for Windows with global hotkeys, dynamic templates, selected-text actions, managed AI with no API key setup, and direct text insertion.",
  alternates: { canonical: "/" },
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
    desc: "InsertGo appears instantly as a sleek floating window above whatever you're doing — no window switching, no lost focus.",
  },
  {
    num: "02",
    icon: LinearNote2,
    tile: "var(--color-tile-sky)",
    title: "Ask or pick a prompt",
    desc: "Type a prompt or grab one from your library. Dynamic prompts open a quick fill-in form — text fields, menus, toggles — before they run.",
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
    desc: "One global hotkey summons the InsertGo overlay above any app. It remembers exactly where you were, so the result goes straight back there.",
  },
  {
    icon: LinearNote2,
    tile: "var(--color-tile-mist)",
    title: "Dynamic prompt library",
    desc: "Save the prompts you use daily, organized by category. Dynamic prompts use AI Blaze form-commands — menus, toggles, text fields — and open a fill-in form before they run.",
  },
  {
    icon: LinearCpu,
    tile: "var(--color-tile-sky)",
    title: "Managed AI, zero setup",
    desc: "No API keys, no provider accounts, no model config. Sign in once and every prompt runs through the managed InsertGo relay on a fast default model.",
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
    desc: "Runs at the OS level on Windows, so it works with every application that supports standard pasting.",
  },
  {
    icon: LinearShieldTick,
    tile: "var(--color-tile-dusk)",
    title: "Private by design",
    desc: "Prompts, templates, and settings live in plain local files on your machine. Nothing leaves it except the prompts you explicitly run through the managed relay.",
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

const homeFaqs = [
  {
    question: "What is InsertGo AI?",
    answer:
      "InsertGo is a floating, always-on-top AI prompt assistant for Windows. A global hotkey opens it above any app, reusable or custom prompts run through the managed InsertGo relay, and approved text returns to the cursor where you started.",
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
    question: "Is InsertGo a Raycast alternative for Windows AI prompts?",
    answer:
      "Yes, when you want a focused AI prompt and text-insertion workflow. Raycast now has a Windows beta and offers a broader launcher with file search, extensions, snippets, and AI. InsertGo concentrates on dynamic prompts, selection actions, and safe write-back.",
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

function AppChip({ name, icon }: { name: string; icon: string }) {
  return (
    <span className="glass-chip inline-flex items-center gap-[9px] rounded-full py-[9px] pr-[18px] pl-3.5 text-sm font-medium whitespace-nowrap text-ink">
      <img
        src={`/app-icons/${icon}.svg`}
        alt=""
        width={18}
        height={18}
        loading="lazy"
        className="block h-[18px] w-[18px] object-contain"
      />
      {name}
    </span>
  );
}

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={faqSchema(homeFaqs)} />
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
            Floating AI prompt assistant
            <br />
            <span className="rounded-xl bg-accent px-4 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
              for Windows.
            </span>
          </h1>
        </FadeUp>

        <FadeUp delay={0.12}>
          <p className="mt-[26px] max-w-[620px] text-[clamp(16px,2vw,20px)] leading-relaxed text-muted">
            InsertGo is a floating, always-on-top AI prompt assistant for
            Windows. Press a global hotkey from any app, run a reusable or
            custom prompt, then insert the result back at your cursor without
            losing your place or previous clipboard contents.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <DownloadButton />
            <GhostButton href="/how-it-works">See how AI insertion works</GhostButton>
          </div>
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
            <span className="text-[13px] text-muted">
              in any app · Windows 10 &amp; 11
            </span>
          </div>
        </FadeUp>
      </HeroSection>

      {/* MARQUEE */}
      <section className="pt-[70px] pb-[30px]">
        <Reveal>
          <p className="mb-[26px] text-center text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Works alongside the AI tools you already use
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

      {/* 3 STEPS */}
      <section className="mx-auto max-w-[1080px] px-6 py-[90px]">
        <Reveal className="mx-auto mb-14 max-w-[640px] text-center">
          <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
            From thought to text in three keystrokes
          </h2>
        </Reveal>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.1}>
              <div className="glass-card flex h-full flex-col gap-3.5 p-7 hover:-translate-y-1">
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

      {/* FEATURE GRID */}
      <section className="section-tint px-6 py-[90px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-14 max-w-[600px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Why InsertGo
            </p>
            <h2 className="m-0 font-serif text-[clamp(32px,4.5vw,48px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
              An AI layer over your entire Windows desktop
            </h2>
          </Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[18px]">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <div className="glass-card group flex h-full flex-col gap-3 p-7 hover:-translate-y-1">
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
            <Reveal key={c.name} delay={(i % 3) * 0.08}>
              <div className="glass-card flex h-full flex-col gap-3.5 p-6 hover:-translate-y-1">
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
              The floating AI assistant for Windows. Free to download,
              installed in under a minute, ready the moment you press the
              hotkey.
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
