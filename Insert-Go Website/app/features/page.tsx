/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { LinearFlash } from "@/components/icons/LinearFlash";
import { LinearNote2 } from "@/components/icons/LinearNote2";
import { LinearMouse } from "@/components/icons/LinearMouse";
import { LinearSend2 } from "@/components/icons/LinearSend2";
import { LinearGlobal } from "@/components/icons/LinearGlobal";
import { LinearShieldTick } from "@/components/icons/LinearShieldTick";
import { LinearMagicStar } from "@/components/icons/LinearMagicStar";
import { LinearCode } from "@/components/icons/LinearCode";
import { LinearHeadphone } from "@/components/icons/LinearHeadphone";
import { Reveal } from "@/components/Reveal";
import { CustomSkillBuilderShowcase } from "@/components/demos/CustomSkillBuilderShowcase";
import { FeatureAnimatedDemo } from "@/components/FeatureAnimatedDemo";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export const metadata: Metadata = {
  title: "Features — Prompt Library, Skill Bar & Auto-Insert",
  description:
    "Save reusable prompt templates, run dynamic prompts with fill-in forms, and transform selected text with the Skill Bar — global hotkey, OS-level insertion, managed AI with no API key setup.",
  alternates: { canonical: "/features" },
};

const blocks = [
  {
    icon: LinearFlash,
    tile: "var(--color-tile-sand)",
    kicker: "Global hotkey",
    title: "Summoned in a keystroke, gone in one more",
    desc: `${HOTKEYS.primary.label} records the active Windows app, then opens InsertGo above it. Press Esc to close and InsertGo hands focus straight back to what you were doing.`,
    points: [
      "Customizable shortcut",
      "Focus restored on close",
      "Launches at startup",
    ],
    chip: HOTKEYS.primary.label,
    demoId: "hotkey",
    href: "/features/desktop-assistant",
  },
  {
    icon: LinearNote2,
    tile: "var(--color-tile-mist)",
    kicker: "Prompt templates",
    title: "Your best prompts, one click away",
    desc: "Save the prompts you reach for every day, group them by category, and turn changing details into fill-in forms. Text fields, paragraphs, menus, toggles, and clipboard values expand before the AI call.",
    points: ["Categories", "Dynamic form commands", "Local prompt storage"],
    chip: "templates",
    demoId: "templates",
    href: "/features/prompt-library",
  },
  {
    icon: LinearMouse,
    tile: "var(--color-tile-sky)",
    kicker: "Skill Bar",
    title: "A floating toolbar for the text in front of you",
    desc: "Highlight text anywhere and the Skill Bar appears beside your selection — an in-situ floating toolbar of one-click prompt chips. Refine, translate, summarize, or run another skill, review the result, then apply it back over the original selection.",
    points: ["Chips appear on selection", "Review before apply", "No auto-submit"],
    chip: "skill bar",
    demoId: "skillbar",
    href: "/features/auto-text-insert",
  },
  {
    icon: LinearSend2,
    tile: "var(--color-tile-stone)",
    kicker: "Auto-insert",
    title: "The response lands where your cursor is",
    desc: "When the AI finishes, InsertGo restores the captured app, verifies that it is foreground, pastes the text at the cursor, then restores your previous clipboard content.",
    points: [
      "Foreground verification",
      "Clipboard restoration",
      "Manual-paste fallback",
    ],
    chip: "auto-insert",
    demoId: "insert",
    href: "/features/auto-text-insert",
  },
  {
    icon: LinearGlobal,
    tile: "var(--color-tile-clay)",
    kicker: "OS-level integration",
    title: "Works with every app on your PC",
    desc: "InsertGo runs at the Windows operating-system level, not as a plugin. If an application accepts Ctrl+V, it's compatible — browsers, editors, chat apps, email, terminals, all of it.",
    points: ["No plugins needed", "No per-app setup", "Windows 10 & 11"],
    chip: "os-level",
    demoId: "os",
    href: "/features/desktop-assistant",
  },
  {
    icon: LinearShieldTick,
    tile: "var(--color-tile-dusk)",
    kicker: "Privacy",
    title: "Your prompts are yours",
    desc: "Prompt templates and settings live in local application data. The app holds no AI key — only your InsertGo session token, in the Windows credential store. Requests leave the device only when you explicitly run a prompt.",
    points: ["Local prompt storage", "No AI key on device", "Explicit AI calls"],
    chip: "private",
    demoId: "privacy",
    href: "/faq",
  },
] as const;

const customPersonas = [
  {
    icon: LinearCode,
    tile: "var(--color-tile-sky)",
    persona: "Developer",
    recipe: "Git Diff → Clean PR Description",
    desc: "A raw diff becomes a structured PR: one-sentence summary, key changes, testing notes.",
  },
  {
    icon: LinearMagicStar,
    tile: "var(--color-tile-mist)",
    persona: "Writer",
    recipe: "De-AI Buzzword Stripper",
    desc: "Cuts the tells — 'leverage', 'delve', 'seamless' — so the draft reads like a person wrote it.",
  },
  {
    icon: LinearHeadphone,
    tile: "var(--color-tile-clay)",
    persona: "Support",
    recipe: "Angry Customer Ticket → Empathetic Resolution",
    desc: "Acknowledges the frustration, owns the issue, ends with one concrete next step.",
  },
  {
    icon: LinearNote2,
    tile: "var(--color-tile-stone)",
    persona: "Ops",
    recipe: "Messy Meeting Notes → Action Items & Slack Recap",
    desc: "Chaotic notes become owners, deadlines, and a channel-ready recap.",
  },
] as const;

const customApps = [
  "VS Code",
  "Chrome",
  "Outlook",
  "Slack",
  "Discord",
  "Terminal",
  "Any app with Ctrl+V",
];

export default function FeaturesPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <PageHero
        kicker="Features"
        title="Everything between your idea and the insert"
        sub="Six capabilities, one floating window. Built so the AI meets you where you work — not the other way around."
      >
        <p className="mt-6 text-sm text-muted">
          Looking for the{" "}
          <Link
            href="/features/ai-text-expander"
            className="text-brand hover:underline"
          >
            AI text expander
          </Link>{" "}
          workflow, or a walkthrough for{" "}
          <Link
            href="/use-cases/developers"
            className="text-brand hover:underline"
          >
            developers
          </Link>{" "}
          and{" "}
          <Link
            href="/use-cases/customer-support"
            className="text-brand hover:underline"
          >
            customer support
          </Link>
          ?
        </p>
      </PageHero>

      <section className="mx-auto flex max-w-[1000px] flex-col gap-[26px] px-6 pt-[60px] pb-10">
        {blocks.map((b) => (
          <Reveal key={b.kicker}>
            <div className="glass-panel grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] overflow-hidden">
              <div className="flex flex-col justify-center gap-3.5 p-[clamp(28px,4vw,44px)]">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink"
                  style={{ background: b.tile }}
                >
                  <b.icon size={22} />
                </span>
                <span className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
                  {b.kicker}
                </span>
                <h2 className="m-0 font-serif text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-[-0.02em] text-ink">
                  {b.title}
                </h2>
                <p className="m-0 text-base leading-[1.65] text-muted">
                  {b.desc}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {b.points.map((pt) => (
                    <span
                      key={pt}
                      className="rounded-full bg-muted/10 px-[11px] py-[5px] text-xs font-medium text-ink"
                    >
                      {pt}
                    </span>
                  ))}
                </div>
                <Link
                  href={b.href}
                  className="mt-2 text-sm font-medium text-brand hover:underline"
                >
                  Learn more →
                </Link>
              </div>
              <div className="flex min-h-[240px] items-center justify-center border-l border-line bg-muted/5 p-7">
                <div className="glass-solid w-full max-w-[340px] overflow-hidden rounded-[var(--radius-glass)]">
                  <div className="flex items-center justify-between border-b border-dark-2 px-3.5 py-2.5">
                    <span className="flex items-center gap-[7px]">
                      <img
                        src="/main-logo.png"
                        alt=""
                        width={16}
                        height={16}
                        className="block h-4 w-4 object-contain [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.35))]"
                      />
                      <span className="text-xs font-semibold text-cream">
                        InsertGo
                      </span>
                    </span>
                    <span className="glass-chip rounded px-[7px] py-[3px] text-[9px] font-medium text-muted">
                      {b.chip}
                    </span>
                  </div>
                  <FeatureAnimatedDemo demoId={b.demoId} />
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* CUSTOM SKILLS & AUTOMATION */}
      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1000px]">
          <Reveal className="mb-12 max-w-[720px]">
            <p className="mb-3.5 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Custom skills &amp; automation
            </p>
            <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
              Describe the skill in plain English — the AI builds it
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Two steps: type what you want — &ldquo;turn a git diff into a PR
              description&rdquo; — and the AI Skill Generator composes the full
              prompt template, with a dynamic [PASTE …] placeholder where your
              text goes on every run. Or write it yourself in the Manual Prompt
              Studio. Skills get their own floating chips and hotkeys, run on
              the managed relay with zero API keys, and work OS-wide.
            </p>
          </Reveal>
          <div className="grid gap-[18px] md:grid-cols-2">
            {customPersonas.map((p, i) => (
              <Reveal key={p.persona} delay={(i % 2) * 0.08}>
                <div className="glass-card flex h-full flex-col gap-3 p-7">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-ink"
                      style={{ background: p.tile }}
                    >
                      <p.icon size={20} />
                    </span>
                    <span className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
                      {p.persona}
                    </span>
                  </div>
                  <h3 className="m-0 font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink">
                    {p.recipe}
                  </h3>
                  <p className="m-0 text-[15px] leading-relaxed text-muted">
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-muted">
                One skill, every Windows app:
              </span>
              {customApps.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-muted/10 px-[11px] py-[5px] text-xs font-medium text-ink"
                >
                  {a}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal className="mt-10" delay={0.08}>
            <CustomSkillBuilderShowcase />
          </Reveal>
        </div>
      </section>

      <section className="px-6 pt-20 pb-[110px] text-center">
        <Reveal>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Feel it for yourself
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-base leading-relaxed text-muted">
            The fastest way to understand InsertGo is to press the hotkey once.
          </p>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3.5">
            <DownloadButton />
            <GhostButton href="/how-it-works">How it works</GhostButton>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
