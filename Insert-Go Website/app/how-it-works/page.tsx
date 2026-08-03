import type { Metadata } from "next";
import { LinearKeyboard } from "@/components/icons/LinearKeyboard";
import { LinearMicrophone2 } from "@/components/icons/LinearMicrophone2";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { LinearSend2 } from "@/components/icons/LinearSend2";
import { LinearCpu } from "@/components/icons/LinearCpu";
import { LinearMouse } from "@/components/icons/LinearMouse";
import { LinearCopy } from "@/components/icons/LinearCopy";
import { Reveal } from "@/components/Reveal";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export const metadata: Metadata = {
  title: "How It Works — AI in Any Windows App, No Copy-Paste",
  description:
    "How to use AI in any Windows app without copy-paste: press a global hotkey, pick a prompt, and the response inserts where you were typing — clipboard restored.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  {
    num: "01",
    icon: LinearKeyboard,
    tile: "var(--color-tile-sand)",
    line: true,
    title: "Press the global hotkey",
    desc: `Wherever you are — drafting an email, deep in code, mid-chat — press ${HOTKEYS.primary.label} (the backquote/~ key under Esc). InsertGo's floating window appears above everything, and the app underneath keeps its state.`,
    demo: `${HOTKEYS.primary.label}  →  overlay appears in 40 ms`,
  },
  {
    num: "02",
    icon: LinearMicrophone2,
    tile: "var(--color-tile-sky)",
    line: true,
    title: "Compose, pick, or speak your prompt",
    desc: "Type freely, run a saved template on your selected text, or hold the mic key and dictate. InsertGo captures your current selection automatically so the AI has context.",
    demo: '"make this reply shorter and friendlier"',
  },
  {
    num: "03",
    icon: LinearMagicStar,
    tile: "var(--color-tile-mist)",
    line: true,
    title: "The AI generates your response",
    desc: "Your prompt goes straight to the managed InsertGo relay. You watch the response stream into the overlay — edit it, regenerate, or accept as-is.",
    demo: "streaming…  ▍  1.2 s average response",
  },
  {
    num: "04",
    icon: LinearSend2,
    tile: "var(--color-tile-stone)",
    line: false,
    title: "It's inserted. You're already back.",
    desc: "Press Enter and the text is injected at your cursor in the app that was in focus — Word, Slack, VS Code, anywhere. The overlay closes itself. No copy, no paste, no window juggling.",
    demo: "inserted into Slack ✓  overlay closed",
  },
];

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
    icon: LinearCopy,
    tile: "var(--color-tile-clay)",
    title: "Clipboard-safe",
    desc: "Your clipboard contents are preserved through every insert. Whatever you copied ten minutes ago is still there afterwards.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <PageHero
        kicker="How it works"
        title="Four seconds, start to inserted"
        sub="InsertGo lives quietly in your system tray until you call it. Here's the whole loop, step by step."
      />

      <section className="mx-auto flex max-w-[880px] flex-col px-6 py-[60px]">
        {steps.map((s) => (
          <Reveal key={s.num}>
            <div className="grid grid-cols-[64px_1fr] gap-x-6">
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
                <div className="glass-floating mt-5 flex max-w-[560px] items-center gap-3 rounded-lg px-[18px] py-4">
                  <span className="flex shrink-0 text-accent-hover">
                    <LinearMagicStar size={15} />
                  </span>
                  <span className="text-[13px] leading-normal text-on-accent">
                    {s.demo}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

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
