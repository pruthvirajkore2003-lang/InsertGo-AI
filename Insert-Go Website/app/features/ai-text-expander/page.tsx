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
} from "@/components/SeoContent";
import { FadeUp, Reveal } from "@/components/Reveal";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { HOTKEY_WORKFLOW_STEPS, pageGraph } from "@/lib/seo";

const PATH = "/features/ai-text-expander";

export const metadata: Metadata = {
  title: "AI Text Expander for Windows — Prompts, Not Snippets",
  description:
    "An AI text expander for Windows: form-driven prompt templates open on a global hotkey, generate text through the managed relay, and paste at your cursor with clipboard restore.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "AI Text Expander for Windows — Prompts, Not Snippets",
    description:
      "Form commands, generated output, and verified insertion into any Windows app.",
    url: PATH,
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/features" },
  { name: "AI text expander", href: PATH },
];

const commands = [
  {
    syntax: "{formtext: name=Customer}",
    field: "Single-line input",
    use: "Names, order numbers, subject lines — anything short that changes per run.",
  },
  {
    syntax: "{formparagraph: name=Context}",
    field: "Multi-line input",
    use: "Pasted context: the message you are replying to, an error log, a spec extract.",
  },
  {
    syntax: "{formmenu: default=Warm; Neutral; Firm}",
    field: "Dropdown, or multi-select with multiple=yes",
    use: "Fixed choices such as tone, language, audience, or output length.",
  },
  {
    syntax: "{formtoggle: name=Add refund line; default=no}…{endformtoggle}",
    field: "Conditional span",
    use: "Optional clauses. When the toggle is off the whole span is dropped from the prompt, including any commands nested inside it.",
  },
  {
    syntax: "{clipboard}",
    field: "No field — reads the clipboard",
    use: "Pull in whatever you just copied without pasting it into a box first.",
  },
];

const faqs = [
  {
    question: "What is an AI text expander for Windows?",
    answer:
      "A text expander turns a short trigger into longer text. An AI text expander turns that trigger into a prompt instead: the stored template describes what to write, form fields collect what changes, and the model produces the wording, so the output differs on every run.",
  },
  {
    question: "Which Windows apps does it work in?",
    answer:
      "Any application that accepts a standard paste: browsers, VS Code and other editors, Word and Outlook, Slack and Teams, Notion, Windows Terminal. Applications running elevated can refuse input from a normal-permission process, in which case InsertGo leaves the text copied for a manual paste.",
  },
  {
    question: "Does the expansion overwrite my clipboard?",
    answer:
      "Only for the duration of the paste. InsertGo stages the generated text, completes the insertion, waits for the target app to consume it, then restores the clipboard value you had before. If focus verification fails, the text stays copied and InsertGo tells you to paste manually.",
  },
  {
    question: "Can it rewrite text that is already in a field?",
    answer:
      HOTKEYS.improve.label +
      " rewrites the focused text field in place without opening the palette, and " +
      HOTKEYS.undo.label +
      " restores the previous draft. Nothing is submitted for you — InsertGo replaces the text and stops there.",
  },
];

const rows = [
  {
    criterion: "Platform scope",
    ours: "Native Windows 10 and 11 app; one global hotkey covers every app that accepts a paste.",
    theirs:
      "Varies: browser extensions cover web fields only, desktop expanders cover apps but not the browser DOM equally.",
  },
  {
    criterion: "Output",
    ours: "Generated per run from your instruction plus the field values.",
    theirs: "The stored string, byte for byte, with fill-ins substituted.",
  },
  {
    criterion: "Dynamic forms",
    ours: "Five brace commands, resolved in a fill-in dialog before the model call.",
    theirs:
      "Fill-in fields and macros resolved at expansion time; no model in the path.",
  },
  {
    criterion: "Cursor write-back",
    ours: "Captured window is restored and verified as foreground before the paste; mismatch aborts to manual paste.",
    theirs: "Expands wherever the trigger was typed.",
  },
  {
    criterion: "Clipboard safety",
    ours: "Staged for the paste only, previous value restored afterwards.",
    theirs:
      "Usually untouched, because expansion is keystroke substitution rather than a paste.",
  },
  {
    criterion: "Latency",
    ours: "A model call — seconds, with a review step before anything is written.",
    theirs: "Instant, because nothing leaves the machine.",
  },
  {
    criterion: "Pricing",
    ours: "Free tier, paid plans, and non-expiring credit packs, since each run costs credits.",
    theirs: "Flat per-user subscription, or free for the open-source ones.",
  },
];

export default function AiTextExpanderPage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: PATH,
          name: "AI text expander for Windows",
          description:
            "InsertGo as an AI text expander for Windows: form-driven prompt templates, generated output, verified cursor insertion, and clipboard restore.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to expand a prompt into AI text on Windows",
            description:
              "Open a saved template over the active app, fill in what changes, review the generated text, and insert it at the cursor.",
            totalTime: "PT1M",
            steps: HOTKEY_WORKFLOW_STEPS,
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="AI text expander"
        title="AI text expander for Windows"
        sub="A snippet gives back what you stored. A prompt template gives back what the moment needs — in the same keystroke, at the same cursor."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex justify-center">
            <span className="glass-chip rounded-lg px-4 py-2 text-sm font-medium text-ink">
              {HOTKEYS.primary.label} · fill in · Insert
            </span>
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="What is an AI text expander for Windows?">
            An AI text expander for Windows replaces stored snippets with
            prompts. InsertGo opens over the active app on a global hotkey,
            collects the values that change through form commands, sends the
            assembled prompt to the managed relay, then pastes the generated text
            at your cursor and restores your previous clipboard.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Form commands
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Five commands cover everything that changes
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Write them anywhere inside a template. InsertGo parses the braces,
            builds a fill-in dialog in the order the commands appear, and
            substitutes your answers before the prompt is sent.
          </p>
        </Reveal>
        <Reveal>
          <div className="glass-panel overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <caption className="sr-only">
                InsertGo prompt template form command reference
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    Command
                  </th>
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    Field
                  </th>
                  <th scope="col" className="p-5 text-sm font-semibold text-ink">
                    Use it for
                  </th>
                </tr>
              </thead>
              <tbody>
                {commands.map((row) => (
                  <tr
                    key={row.syntax}
                    className="border-b border-line last:border-0"
                  >
                    <th scope="row" className="w-[34%] p-5 align-top">
                      <code className="text-[13px] leading-relaxed font-semibold text-ink-soft">
                        {row.syntax}
                      </code>
                    </th>
                    <td className="w-[22%] p-5 align-top text-sm leading-relaxed text-muted">
                      {row.field}
                    </td>
                    <td className="p-5 align-top text-sm leading-relaxed text-muted">
                      {row.use}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal className="mt-6">
          <p className="max-w-[760px] text-[15px] leading-relaxed text-muted">
            Legacy <code className="text-ink-soft">{"{{selected_text}}"}</code>{" "}
            and <code className="text-ink-soft">{"{{clipboard}}"}</code> tokens
            still expand from clipboard content, so older templates keep working
            unchanged.
          </p>
        </Reveal>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              From hotkey to cursor
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The window you started in is recorded before the palette opens, so
              the text has somewhere definite to go back to.
            </p>
          </Reveal>
          <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            AI expander vs static expander
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Pick by whether the wording must change
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Static expansion wins on latency and on text that must stay
            identical — legal wording, addresses, code boilerplate. Generation
            wins when every instance is slightly different and rewriting it by
            hand is the actual cost.
          </p>
        </Reveal>
        <Reveal>
          <ComparisonTable
            caption="AI text expander compared with a static text expander"
            theirs="Static text expander"
            rows={rows}
          />
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-[1080px] gap-[18px] px-6 pb-[70px] md:grid-cols-2">
        <Reveal>
          <article className="glass-card h-full p-7">
            <h2 className="m-0 font-serif text-2xl font-semibold text-ink">
              Where the templates live
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Prompt templates and settings are stored in local Windows
              application data and grouped by category. The app holds no AI key —
              only your InsertGo session token, in the Windows credential store.
            </p>
            <Link
              href="/features/prompt-library"
              className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
            >
              Explore the prompt library →
            </Link>
          </article>
        </Reveal>
        <Reveal delay={0.08}>
          <article className="glass-card h-full p-7">
            <h2 className="m-0 font-serif text-2xl font-semibold text-ink">
              Expanding over a selection
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Highlight text and the Skill Bar appears beside it with one-click
              chips: refine, translate, summarize. Review the result, then apply
              it back over the original range.
            </p>
            <Link
              href="/features/auto-text-insert"
              className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
            >
              See the insertion path →
            </Link>
          </article>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            AI text expander questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SeoCta
        title="Expand a prompt, not a paragraph you already wrote"
        body="Save the instruction once, declare what changes, and let the result land at your cursor."
        secondaryHref="/alternatives/text-blaze-windows"
        secondaryLabel="Compare with Text Blaze"
      />
    </main>
  );
}
