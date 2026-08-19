import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import {
  Breadcrumbs,
  DirectAnswer,
  FaqBlocks,
  JsonLd,
  SeoCta,
} from "@/components/SeoContent";
import { FadeUp, Reveal } from "@/components/Reveal";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { pageGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Text Auto-Insert for Windows Desktop Apps",
  description:
    "Insert AI-generated text into Windows apps from one floating workflow. InsertGo restores focus, verifies the target, pastes at the cursor, and restores your clipboard.",
  alternates: { canonical: "/features/auto-text-insert" },
  openGraph: {
    title: "AI Text Auto-Insert for Windows Desktop Apps",
    description:
      "Press a hotkey, run a prompt, and insert AI text into the Windows app you were using.",
    url: "/features/auto-text-insert",
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/features" },
  { name: "Auto text insert", href: "/features/auto-text-insert" },
];

const steps = [
  {
    title: "Press the global hotkey",
    text: `${HOTKEYS.primary.label} captures the active Windows app and opens InsertGo above it.`,
  },
  {
    title: "Write or choose a prompt",
    text: "Type an instruction or run a saved dynamic template with its form fields filled in.",
  },
  {
    title: "Generate and review",
    text: "Send the prompt through the managed InsertGo relay, then edit or accept the returned text.",
  },
  {
    title: "Insert into the original app",
    text: "InsertGo hides, restores the captured window, verifies it is foreground, pastes at the cursor, then restores your previous clipboard content.",
  },
];

const faqs = [
  {
    question: "How do I insert AI-generated text into any Windows app automatically?",
    answer:
      "Press the InsertGo global hotkey, write or select a prompt, run it, review the response, and choose Insert. InsertGo returns focus to the app you were using, verifies the target window, pastes the text at your cursor, and restores your previous clipboard contents.",
  },
  {
    question: "Does InsertGo work with every Windows app?",
    answer:
      "InsertGo works with Windows applications that accept standard paste input. That includes most browsers, editors, document tools, messaging apps, email clients, and terminals. Elevated apps can block input from a normal-permission process, so InsertGo falls back to copying the result for manual paste.",
  },
  {
    question: "Will AI text insertion overwrite my clipboard?",
    answer:
      "InsertGo temporarily stages generated text on the clipboard, completes the paste, waits for the target app to consume it, and restores the previous clipboard value. If focus verification or insertion fails, it leaves the generated text copied and tells you to paste manually.",
  },
  {
    question: "Can InsertGo rewrite selected text in place?",
    answer:
      `Yes. Selection actions can process highlighted text, and ${HOTKEYS.improve.label} rewrites the focused text field without opening the main palette. ${HOTKEYS.undo.label} restores the pre-improvement draft. InsertGo never submits the rewritten text for you.`,
  },
];

export default function AutoTextInsertPage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: "/features/auto-text-insert",
          name: "AI text auto-insert for Windows desktop apps",
          description:
            "Generate text in a floating assistant and insert it at the cursor of the Windows app you started in, with focus verification and clipboard restore.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to insert AI-generated text into a Windows app",
            description:
              "Use InsertGo to generate and insert AI text into the Windows application you were already using.",
            totalTime: "PT1M",
            steps: steps.map((step) => ({ name: step.title, text: step.text })),
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="System-wide AI writing workflow"
        title="AI text auto-insert for Windows desktop apps"
        sub="Generate text in a floating assistant, then send it back to the browser, editor, document, chat, email, or terminal where you started."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex justify-center">
            <span className="glass-chip rounded-lg px-4 py-2 text-sm font-medium text-ink">
              {HOTKEYS.primary.label} · prompt · Insert
            </span>
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="How do you insert AI-generated text into any Windows app?">
            Press the InsertGo global hotkey, write or choose a prompt, run it,
            review the response, and select Insert. InsertGo restores the
            original app, verifies that window is foreground, pastes at your
            cursor, then restores the clipboard value you had before.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Four steps from prompt to cursor
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            No extension per app. No manual window switching. No permanent
            clipboard replacement.
          </p>
        </Reveal>
        <ol className="grid gap-[18px] md:grid-cols-2">
          {steps.map((step, index) => (
            <li
              id={`step-${index + 1}`}
              key={step.title}
              className="scroll-mt-28"
            >
              <Reveal delay={(index % 2) * 0.08}>
                <article className="glass-card flex h-full gap-4 p-7">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-ink">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">
                      {step.text}
                    </p>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-11 max-w-[720px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Focus-safe insertion
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              What happens after you click Insert
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              InsertGo treats the target window as a safety boundary. It will
              not paste into a different window just because focus changed
              during generation.
            </p>
          </Reveal>

          <Reveal>
            <ol
              aria-label="InsertGo focus and clipboard handoff"
              className="glass-panel grid gap-px overflow-hidden md:grid-cols-5"
            >
              {[
                ["1", "Stage result", "Temporary clipboard value"],
                ["2", "Hide overlay", "Return desktop control"],
                ["3", "Restore focus", "Captured window only"],
                ["4", "Verify + paste", "Abort on mismatch"],
                ["5", "Restore clipboard", "Previous value returns"],
              ].map(([number, title, text]) => (
                <li key={number} className="bg-surface/40 p-6">
                  <span className="text-xs font-semibold text-brand">{number}</span>
                  <h3 className="mt-3 mb-1 font-serif text-lg font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="m-0 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1080px] gap-[18px] px-6 py-[80px] md:grid-cols-2">
        <Reveal>
          <article className="glass-card h-full p-7">
            <h2 className="m-0 font-serif text-2xl font-semibold text-ink">
              Global hotkey AI prompt manager
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Open the prompt palette from any app with {HOTKEYS.primary.label}.
              Saved templates can collect runtime values before the AI call, so
              one reusable prompt adapts to each message, draft, or code task.
            </p>
            <Link
              href="/features/prompt-library"
              className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
            >
              Explore dynamic prompt templates →
            </Link>
          </article>
        </Reveal>
        <Reveal delay={0.08}>
          <article className="glass-card h-full p-7">
            <h2 className="m-0 font-serif text-2xl font-semibold text-ink">
              Text selection floating AI tool
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Highlight text to open contextual actions near the selection.
              Refine, summarize, translate, or run another skill, review the
              result, then apply it back over the selected range.
            </p>
            <Link
              href="/how-it-works"
              className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
            >
              See full workflow →
            </Link>
          </article>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            AI text insertion questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SeoCta
        title="Move AI text without moving windows"
        body="Keep your cursor, workflow, and clipboard. InsertGo handles the handoff."
        secondaryHref="/alternatives/raycast-windows"
        secondaryLabel="Compare Windows AI tools"
      />
    </main>
  );
}
