import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import {
  Breadcrumbs,
  ComparisonTable,
  DirectAnswer,
  FaqBlocks,
  HowToSteps,
  JsonLd,
  SeoCta,
  SourceNote,
} from "@/components/SeoContent";
import { FadeUp, Reveal } from "@/components/Reveal";
import { AdUnit } from "@/components/ads/AdUnit";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { CONTENT_UPDATED, HOTKEY_WORKFLOW_STEPS, pageGraph } from "@/lib/seo";

const PATH = "/alternatives/windows-copilot";

export const metadata: Metadata = {
  title: "Windows Copilot Alternative for Reusable AI Prompts",
  description:
    "Copilot answers in a sidebar you copy from. InsertGo runs saved prompt templates with fill-in fields over the active Windows app and pastes the result at your cursor.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "Windows Copilot Alternative for Reusable AI Prompts",
    description:
      "Sidebar chat versus reusable templates and direct cursor write-back on Windows.",
    url: PATH,
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Windows Copilot alternative", href: PATH },
];

const faqs = [
  {
    question: "What is a good Windows Copilot alternative for writing tasks?",
    answer:
      "InsertGo covers the repeat-writing half of the job: saved prompt templates with fill-in fields, opened over whatever app has focus, with the result pasted at your cursor. It is not a replacement for Copilot as a general assistant for questions, settings, or system tasks.",
  },
  {
    question: "Does Windows Copilot type into the app I am using?",
    answer:
      "Copilot answers in its own window or docked sidebar, so moving text into a document or message is a manual copy and paste. Microsoft 365 Copilot does write inside Word and Outlook, but that is a separate licence and only covers those apps.",
  },
  {
    question: "Can I save reusable prompts in Copilot?",
    answer:
      "Copilot is conversational: you retype or paste the instruction each session. InsertGo keeps a categorised prompt library where the parts that change are declared as form fields, so the same template runs with different values instead of being rewritten.",
  },
  {
    question: "Can InsertGo and Copilot run side by side?",
    answer:
      "Yes. They occupy different surfaces and do not compete for a shortcut: Copilot uses its own key or taskbar entry, while InsertGo opens with " +
      HOTKEYS.primary.label +
      " and closes on Esc, handing focus straight back to the app underneath.",
  },
];

const rows = [
  {
    criterion: "Platform scope",
    ours: "Standalone Windows 10 and 11 app; the palette opens above whichever app has focus.",
    theirs:
      "Bundled with Windows 11 as an app that can dock as a sidebar; also reachable from the Copilot key on newer keyboards.",
  },
  {
    criterion: "Interaction model",
    ours: "One-shot task: run a template, review the text, insert it, palette closes.",
    theirs: "Ongoing chat thread you read from and copy out of.",
  },
  {
    criterion: "Reusable prompt templates",
    ours: "Categorised local prompt library; each template stores the instruction and its fields.",
    theirs:
      "No saved template library with typed fields — the instruction is retyped or pasted per conversation.",
  },
  {
    criterion: "Dynamic forms",
    ours: "{formtext}, {formparagraph}, {formmenu}, {formtoggle}, and {clipboard} collect values in a dialog before the model call.",
    theirs: "Free-text chat input.",
  },
  {
    criterion: "Cursor write-back",
    ours: "Restores the captured window, verifies it is foreground, then pastes at the cursor; aborts to manual paste on mismatch.",
    theirs:
      "Manual copy from the chat pane. Microsoft 365 Copilot writes inside Word and Outlook under a separate licence.",
  },
  {
    criterion: "Clipboard safety",
    ours: "Staged on the clipboard for the paste only, then your previous clipboard value is restored.",
    theirs: "You manage the clipboard yourself; the copied answer stays on it.",
  },
  {
    criterion: "Screen context",
    ours: "Sees the selection or clipboard text you pass it, nothing else.",
    theirs:
      "Copilot Vision can read what is on screen when you turn it on for a session.",
  },
  {
    criterion: "Pricing",
    ours: "Free tier, paid plans, and non-expiring credit packs.",
    theirs: "Included with Windows, with paid Copilot tiers for higher limits.",
  },
  {
    criterion: "Best fit",
    ours: "The same writing task, many times a day, ending at your cursor.",
    theirs: "Open-ended questions, system help, and screen-aware assistance.",
  },
];

export default function WindowsCopilotAlternativePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: PATH,
          name: "Windows Copilot alternative for reusable AI prompts",
          description:
            "How InsertGo compares with Windows Copilot: reusable prompt templates and direct cursor write-back versus sidebar chat you copy from.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to run a reusable AI prompt without leaving the app",
            description:
              "Open a saved template over the active Windows app, fill in what changes, and insert the result at the cursor.",
            totalTime: "PT1M",
            steps: HOTKEY_WORKFLOW_STEPS,
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="Current comparison · August 2026"
        title="Windows Copilot alternative for reusable AI prompts"
        sub="Copilot is a place you go to ask. InsertGo is a step inside the work you were already doing."
      >
        <FadeUp delay={0.18}>
          <p className="mt-5 text-sm text-muted">
            Reviewed {CONTENT_UPDATED}. Product capabilities change; official
            sources linked below.
          </p>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="What is a good Windows Copilot alternative for writing?">
            Windows Copilot is a chat surface: you ask in the sidebar, then copy
            the answer back into your work by hand. InsertGo skips that round
            trip — a hotkey over the active app, a saved prompt template with
            fill-in fields, and a verified paste at the cursor with your
            clipboard restored.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            InsertGo vs Windows Copilot
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            The copy-paste round trip is the difference
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Both call a model. The cost is in what happens after the answer
            arrives: a sidebar hands you text to move yourself, while InsertGo
            already knows which window and which caret the text belongs to,
            because it recorded them before it opened.
          </p>
        </Reveal>
        <Reveal>
          <ComparisonTable
            caption="InsertGo and Windows Copilot feature comparison"
            theirs="Windows Copilot"
            rows={rows}
          />
        </Reveal>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-10 max-w-[720px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Honest scope
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              What InsertGo does not replace
            </h2>
          </Reveal>
          <div className="grid gap-[18px] md:grid-cols-2">
            <Reveal>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Keep Copilot for
                </h3>
                <ul className="mt-5 space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
                  <li>Open-ended questions and multi-turn research threads.</li>
                  <li>Windows settings, troubleshooting, and system tasks.</li>
                  <li>Screen-aware help, where Vision reads what is in front of you.</li>
                </ul>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Reach for InsertGo when
                </h3>
                <ul className="mt-5 space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
                  <li>You run the same writing task dozens of times a day.</li>
                  <li>
                    The output belongs in a field, not a chat log — and{" "}
                    {HOTKEYS.improve.label} can rewrite that field in place.
                  </li>
                  <li>
                    The variable parts should be a form, not a retyped sentence.
                  </li>
                </ul>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            From hotkey to cursor
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            No window switching, no manual copy, no clipboard casualties.
          </p>
        </Reveal>
        <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Windows Copilot comparison questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SourceNote>
        Copilot facts:{" "}
        <a
          href="https://support.microsoft.com/en-us/windows/welcome-to-copilot-on-windows-675708af-8c16-4675-afeb-85a5a476ccb0"
          className="text-brand hover:underline"
        >
          Copilot on Windows
        </a>{" "}
        and{" "}
        <a
          href="https://support.microsoft.com/en-us/copilot"
          className="text-brand hover:underline"
        >
          Copilot help and learning
        </a>
        . InsertGo details:{" "}
        <Link
          href="/features/desktop-assistant"
          className="text-brand hover:underline"
        >
          desktop assistant
        </Link>{" "}
        and{" "}
        <Link
          href="/features/auto-text-insert"
          className="text-brand hover:underline"
        >
          auto text insert
        </Link>
        .
      </SourceNote>

      {/* End-of-article slot. Below the comparison the reader came for,
          above the CTA — and height-reserved, so it cannot shift either. */}
      <AdUnit className="pb-10" />

      <SeoCta
        title="Stop ferrying text out of a chat pane"
        body="Run the prompt where the work is. InsertGo restores focus, verifies the window, and pastes at your cursor."
        secondaryHref="/use-cases/customer-support"
        secondaryLabel="See a support workflow"
      />
    </main>
  );
}
