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

const PATH = "/alternatives/textexpander-windows";

export const metadata: Metadata = {
  title: "TextExpander Alternative for Windows with AI Fill-Ins",
  description:
    "TextExpander expands saved snippets with fill-in fields. InsertGo feeds the same fields to an AI prompt and inserts generated text at your cursor in any Windows app.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "TextExpander Alternative for Windows with AI Fill-Ins",
    description:
      "Static snippet expansion versus generative prompts on Windows — criteria-by-criteria.",
    url: PATH,
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "TextExpander Windows alternative", href: PATH },
];

const faqs = [
  {
    question: "What is the best TextExpander alternative for Windows?",
    answer:
      "InsertGo is the better fit when the wording has to change with every message: its fill-in fields feed an AI prompt instead of a saved snippet. TextExpander stays stronger for shared team libraries, cross-device sync, and text that must come out identical every time.",
  },
  {
    question: "Does InsertGo sync snippets across devices like TextExpander?",
    answer:
      "No. InsertGo stores prompt templates and settings in local Windows application data, and there is no macOS, iOS, or Android client. If cross-device snippet sync and a shared team library are requirements, TextExpander covers those and InsertGo does not.",
  },
  {
    question: "Can a static snippet become an AI prompt?",
    answer:
      "Yes. Keep the fill-in fields, then add the instruction line that describes what to write with them. InsertGo parses {formtext}, {formparagraph}, {formmenu}, {formtoggle}, and {clipboard}, collects those values in a dialog, and sends the assembled prompt to the managed relay.",
  },
  {
    question: "Does an AI text expander cost more than a snippet manager?",
    answer:
      "Generated text costs model credits, so InsertGo runs a free tier plus paid plans and non-expiring credit packs. Snippet managers charge a flat per-user subscription because expansion is local string substitution with no model call behind it.",
  },
];

const rows = [
  {
    criterion: "Platform scope",
    ours: "Windows 10 and 11 only, but system-wide: any app that accepts a paste is a target.",
    theirs:
      "Mac, Windows, Chrome, iOS, and Android clients with account-based snippet sync between them.",
  },
  {
    criterion: "What gets inserted",
    ours: "Newly generated text, reviewed in the floating window before insertion.",
    theirs: "The saved snippet, with fill-in values and macros substituted.",
  },
  {
    criterion: "Dynamic forms",
    ours: "{formtext}, {formparagraph}, {formmenu}, {formtoggle}, and {clipboard} collect runtime values that feed the AI prompt.",
    theirs:
      "Fill-in fields — single-line, multi-line, optional sections, and pop-up menus — that substitute into the stored snippet.",
  },
  {
    criterion: "Trigger",
    ours: `${HOTKEYS.primary.label} opens the palette above the active app; ${HOTKEYS.improve.label} rewrites the focused field in place; ${HOTKEYS.undo.label} restores the pre-rewrite draft.`,
    theirs: "Typing an abbreviation, or searching the snippet library inline.",
  },
  {
    criterion: "Cursor write-back",
    ours: "Restores the captured window, verifies it is foreground, then pastes at the cursor. Falls back to manual paste if the check fails.",
    theirs: "Expands in place where the abbreviation was typed.",
  },
  {
    criterion: "Clipboard safety",
    ours: "Text is staged on the clipboard for the paste only, then the previous clipboard value is restored.",
    theirs: "Expansion writes into the field directly; the clipboard is untouched.",
  },
  {
    criterion: "Team and sync",
    ours: "Local prompt library per machine. No shared team library, no cross-device sync.",
    theirs:
      "Shared snippet libraries, permissions, and instant updates across a team.",
  },
  {
    criterion: "Pricing",
    ours: "Free tier, paid plans, and non-expiring credit packs, because each run costs model credits.",
    theirs: "Per-user subscription across individual and team tiers.",
  },
  {
    criterion: "Best fit",
    ours: "Replies, drafts, and rewrites whose wording changes every time.",
    theirs: "Approved wording that must stay identical across a team and across devices.",
  },
];

export default function TextExpanderWindowsAlternativePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: PATH,
          name: "TextExpander alternative for Windows with AI fill-ins",
          description:
            "How InsertGo compares with TextExpander on Windows: generative prompts versus static snippet expansion, fill-in fields, cursor write-back, sync, and pricing model.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to turn a fill-in snippet into an AI prompt on Windows",
            description:
              "Keep the fill-in fields, add an instruction line, and let the model write the text that gets inserted.",
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
        title="TextExpander alternative for Windows with AI fill-ins"
        sub="Same fill-in fields, different engine behind them: a stored snippet resolves, an AI prompt writes."
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
          <DirectAnswer title="What is the best TextExpander alternative for Windows?">
            TextExpander stores snippets and syncs them across Mac, Windows,
            Chrome, iOS, and Android, expanding the same saved text with fill-in
            fields. InsertGo is Windows-only and generative: the same fields feed
            an AI prompt, the model writes fresh text on each run, and InsertGo
            pastes it at your cursor.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            InsertGo vs TextExpander
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Substitution or generation
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            A snippet manager is a lookup: abbreviation in, stored string out,
            fill-ins substituted. InsertGo keeps the fill-in dialog and replaces
            the lookup with a model call, which is the right trade only when the
            wording genuinely has to differ each time.
          </p>
        </Reveal>
        <Reveal>
          <ComparisonTable
            caption="InsertGo and TextExpander feature comparison for Windows"
            theirs="TextExpander"
            rows={rows}
          />
        </Reveal>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-10 max-w-[720px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Migration example
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              One instruction line turns a snippet generative
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The fields stay where they are. What changes is that the assembled
              text becomes the prompt rather than the output.
            </p>
          </Reveal>
          <div className="grid gap-[18px] md:grid-cols-2">
            <Reveal>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                  Snippet (static)
                </h3>
                <pre className="mt-4 overflow-x-auto text-[13px] leading-relaxed text-muted">
                  <code>{`Hi {formtext: name=First name},

Thanks for reaching out about {formtext: name=Topic}.
I will follow up by {formtext: name=Date}.`}</code>
                </pre>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                  Prompt template (generative)
                </h3>
                <pre className="mt-4 overflow-x-auto text-[13px] leading-relaxed text-muted">
                  <code>{`Write a short reply in my voice. Acknowledge the
issue, commit to a follow-up date, no apology padding.

First name: {formtext: name=First name}
Their message: {clipboard}
Follow-up: {formtext: name=Date}
Register: {formmenu: default=Warm; Neutral; Formal}`}</code>
                </pre>
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
            The insertion path is the same one a snippet takes, with a review
            step in the middle.
          </p>
        </Reveal>
        <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            TextExpander comparison questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SourceNote>
        TextExpander facts:{" "}
        <a
          href="https://textexpander.com/features"
          className="text-brand hover:underline"
        >
          features
        </a>{" "}
        and{" "}
        <a
          href="https://textexpander.com/pricing"
          className="text-brand hover:underline"
        >
          plans
        </a>
        . InsertGo details:{" "}
        <Link
          href="/features/prompt-library"
          className="text-brand hover:underline"
        >
          dynamic prompt library
        </Link>{" "}
        and{" "}
        <Link href="/pricing" className="text-brand hover:underline">
          pricing
        </Link>
        .
      </SourceNote>

      {/* End-of-article slot. Below the comparison the reader came for,
          above the CTA — and height-reserved, so it cannot shift either. */}
      <AdUnit className="pb-10" />

      <SeoCta
        title="Keep the fill-ins, drop the fixed wording"
        body="Run the template, answer the fields, review what the model wrote, and send it to your cursor."
        secondaryHref="/features/ai-text-expander"
        secondaryLabel="See the AI text expander"
      />
    </main>
  );
}
