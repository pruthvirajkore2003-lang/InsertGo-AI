import type { Metadata } from "next";
import { LinearKeyboard } from "@/components/icons/LinearKeyboard";
import { LinearFlash } from "@/components/icons/LinearFlash";
import { LinearMessageText } from "@/components/icons/LinearMessageText";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { LinearSend2 } from "@/components/icons/LinearSend2";
import { LinearCpu } from "@/components/icons/LinearCpu";
import { LinearMouse } from "@/components/icons/LinearMouse";
import { LinearCopy } from "@/components/icons/LinearCopy";
import { Reveal } from "@/components/Reveal";
import { AnimatedDemo } from "@/components/AnimatedDemo";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import { Breadcrumbs, DirectAnswer, JsonLd } from "@/components/SeoContent";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { pageGraph } from "@/lib/seo";

const DESCRIPTION =
  "How to use AI in any Windows app without copy-paste: press a global hotkey, pick a prompt, and the response inserts where you were typing — clipboard restored.";

export const metadata: Metadata = {
  // Kept under ~60 characters once the " — InsertGo.AI" template is appended;
  // the previous title rendered at 65 and was truncated in results.
  title: "How InsertGo Works — AI in Any Windows App",
  description: DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How InsertGo Works — AI in Any Windows App",
    description:
      "The whole loop: global hotkey, prompt, review, insert at the cursor with the clipboard restored.",
    url: "/how-it-works",
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "How it works", href: "/how-it-works" },
];

const steps = [
  {
    num: "01",
    icon: LinearKeyboard,
    tile: "var(--color-tile-sand)",
    line: true,
    title: "Press the global hotkey",
    desc: `Wherever you are — drafting an email, deep in code, mid-chat — press ${HOTKEYS.primary.label} (the backquote/~ key under Esc). InsertGo's floating window appears above everything, and the app underneath keeps its state.`,
  },
  {
    num: "02",
    icon: LinearFlash,
    tile: "var(--color-tile-sky)",
    line: true,
    title: "Type a prompt — or just select text",
    desc: "Type freely in the palette or fire a saved template. Or skip the palette entirely: select text in any app and the Skill Bar floats up beside your selection with one-click transformation chips — Refine, Fix grammar, Shorten. Either way your selection is captured automatically, so the AI has context.",
  },
  {
    num: "03",
    icon: LinearMagicStar,
    tile: "var(--color-tile-mist)",
    line: true,
    title: "The AI generates your response",
    desc: "Your prompt goes straight to the managed InsertGo relay. You watch the response stream into the overlay — edit it, regenerate, or accept as-is.",
  },
  {
    num: "04",
    icon: LinearSend2,
    tile: "var(--color-tile-stone)",
    line: false,
    title: "It's inserted. You're already back.",
    desc: "Press Enter and the text is injected at your cursor in the app that was in focus — Word, Slack, VS Code, anywhere. The overlay closes itself. No copy, no paste, no window juggling.",
  },
] as const;

const tech = [
  {
    icon: LinearCpu,
    tile: "var(--color-tile-sand)",
    title: "OS-level injection",
    desc: "InsertGo uses the same native Windows input pathways as your keyboard. To the target app, the response looks like you typed it.",
  },
  {
    icon: LinearMouse,
    tile: "var(--color-tile-stone)",
    title: "Focus-aware targeting",
    desc: "The moment you press the hotkey, InsertGo remembers exactly which window and cursor position was active — and returns there on insert.",
  },
  {
    icon: LinearKeyboard,
    tile: "var(--color-tile-mist)",
    title: "Palette-free rewriting",
    desc: `${HOTKEYS.improve.name} — ${HOTKEYS.improve.label} — rewrites the text field you are already typing in, without opening the palette. ${HOTKEYS.undo.name} — ${HOTKEYS.undo.label} — puts the original draft back.`,
  },
  {
    icon: LinearMessageText,
    tile: "var(--color-tile-sky)",
    title: "Skill Bar on selection",
    desc: "Highlight text in any app and a small floating toolbar appears beside the selection. One click on a chip — Refine, Fix grammar, Shorten, or your own saved skills — transforms the text right where it sits.",
  },
  {
    icon: LinearCopy,
    tile: "var(--color-tile-clay)",
    title: "Clipboard-safe",
    desc: "Your clipboard contents are preserved through every insert. Whatever you copied ten minutes ago is still there afterwards.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative overflow-hidden">
      {/* The SoftwareApplication node names this page as the product's
          `softwareHelp` resource, but the page itself published no structured
          data at all — an entity the graph points at and that says nothing
          back. `pageGraph` supplies the WebPage, the BreadcrumbList and a
          HowTo built from the very steps rendered below, so the markup and
          the visible walkthrough cannot drift. */}
      <JsonLd
        data={pageGraph({
          path: "/how-it-works",
          name: "How InsertGo inserts AI text into any Windows app",
          description: DESCRIPTION,
          breadcrumbs,
          howTo: {
            name: "How to insert AI-generated text into any Windows app",
            description:
              "Press a global hotkey, run a prompt, review the response, and insert it at the cursor in the app you were already using.",
            steps: steps.map((s) => ({ name: s.title, text: s.desc })),
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        kicker="How it works"
        // Was "Four seconds, start to inserted" — a quantified speed claim on
        // the page's primary heading with nothing behind it. docs/seo-aeo-strategy.md
        // is explicit that answer engines trust falsifiable text over absolute
        // marketing claims, so the h1 now describes the walkthrough instead.
        title="From hotkey to inserted text, step by step"
        sub="InsertGo lives quietly in your system tray until you call it. Here's the whole loop, step by step."
      />

      <section className="mx-auto max-w-[900px] px-6 pt-2 pb-6">
        <Reveal>
          {/* Deliberately NOT "how do you insert AI text into a Windows app" —
              /features/auto-text-insert owns that query. This one asks about
              the mechanism, which is what this page is the authority on. */}
          <DirectAnswer title="What happens between pressing the hotkey and the text appearing?">
            InsertGo captures which window had focus, opens a floating palette
            above it, sends your prompt to the managed relay, and streams the
            response back for review. On accept it restores that window,
            verifies it is foreground, pastes at the cursor, then puts your
            previous clipboard value back.
          </DirectAnswer>
        </Reveal>
      </section>

      {/* An ordered list, not a stack of divs: the HowTo schema above numbers
          these steps and anchors each one at #step-N, which only means
          something if the document agrees. */}
      <ol className="mx-auto flex max-w-[880px] list-none flex-col px-6 py-[60px]">
        {steps.map((s, i) => (
          // `Reveal` renders a div, so it goes INSIDE the li — an <ol> whose
          // children are divs is not an ordered list to a parser, which is the
          // only reason this markup changed at all.
          <li key={s.num} id={`step-${i + 1}`} className="scroll-mt-28">
            <Reveal className="grid grid-cols-[64px_1fr] gap-x-6">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink"
                  style={{ background: s.tile }}
                >
                  <s.icon size={22} />
                </span>
                {s.line && (
                  <span className="min-h-10 w-px flex-1 bg-gradient-to-b from-brand to-line" />
                )}
              </div>
              <div className="pb-14">
                <div className="mt-2 flex items-center gap-2.5">
                  <span className="text-[13px] font-medium text-brand">
                    {s.num}
                  </span>
                  <h2 className="m-0 font-serif text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.02em] text-ink">
                    {s.title}
                  </h2>
                </div>
                <p className="mt-3 mb-0 max-w-[560px] text-base leading-[1.65] text-muted">
                  {s.desc}
                </p>
                <div className="glass-floating mt-5 max-w-[560px] rounded-lg px-[18px] py-4">
                  <AnimatedDemo stepNum={s.num} />
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>

      <section className="section-tint px-6 pt-[60px] pb-[90px]">
        <div className="mx-auto max-w-[1000px]">
          <Reveal className="mb-11 max-w-[600px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Under the hood
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] leading-[1.12] font-semibold tracking-[-0.02em] text-ink">
              Why it works with everything
            </h2>
          </Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
            {tech.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.08}>
                <div className="glass-card flex h-full flex-col gap-3 p-[26px]">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink"
                    style={{ background: t.tile }}
                  >
                    <t.icon size={20} />
                  </span>
                  <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                    {t.title}
                  </h3>
                  <p className="m-0 text-[15px] leading-relaxed text-muted">
                    {t.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pt-[60px] pb-[110px] text-center">
        <Reveal>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Try the loop yourself
          </h2>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3.5">
            <DownloadButton />
            <GhostButton href="/faq">Read the FAQ</GhostButton>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
