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
import { pageGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Prompt Library Software with Dynamic Templates",
  description:
    "Save, organize, and run reusable AI prompts on Windows. InsertGo templates support form fields, paragraphs, menus, toggles, clipboard values, and direct insertion.",
  alternates: { canonical: "/features/prompt-library" },
  openGraph: {
    title: "Dynamic AI Prompt Library for Windows",
    description:
      "Turn repeated AI instructions into reusable templates with fill-in forms.",
    url: "/features/prompt-library",
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/features" },
  { name: "Prompt library", href: "/features/prompt-library" },
];

const steps = [
  {
    title: "Write the reusable instruction",
    text: "Start with the task, constraints, context, and output format you want the AI to follow.",
  },
  {
    title: "Replace changing details with commands",
    text: "Add formtext, formparagraph, formmenu, formtoggle, or clipboard commands where each run needs new input.",
  },
  {
    title: "Save and organize the template",
    text: "Give the prompt a clear title and category so it is easy to find from the floating library.",
  },
  {
    title: "Run, fill, and insert",
    text: "Choose the template, complete the generated form, send the expanded prompt, then insert the result into the original Windows app.",
  },
];

const faqs = [
  {
    question: "How do I create dynamic AI prompt templates with form fields?",
    answer:
      "Write a reusable prompt, replace changing details with commands such as {formtext}, {formparagraph}, {formmenu}, {formtoggle}, or {clipboard}, then save it. When you run the template, InsertGo builds a fill-in form and sends only the fully expanded prompt to the managed InsertGo relay.",
  },
  {
    question: "What is an AI prompt library?",
    answer:
      "An AI prompt library is an organized collection of reusable instructions for language models. A useful library stores task, context, constraints, and output format together, then lets you supply the variables that change from one run to the next.",
  },
  {
    question: "Where does InsertGo store saved prompts?",
    answer:
      "InsertGo stores prompt templates and settings as local application data on your Windows device. No AI key is stored at all — the operating-system credential store holds only your InsertGo session token. Prompt content is sent out only when you explicitly run it.",
  },
  {
    question: "Can a template use selected text or clipboard content?",
    answer:
      "Yes. Add {clipboard} to place current clipboard text into a template. InsertGo also supports the legacy {{selected_text}} and {{clipboard}} placeholders for existing prompt sets. Selection actions can process highlighted text and apply a reviewed result back to the source app.",
  },
];

const commandRows = [
  ["{formtext: name=topic}", "Single-line text field"],
  ["{formparagraph: name=context}", "Multi-line text area"],
  [
    "{formmenu: default=Professional; Friendly; Concise}",
    "Single-choice menu",
  ],
  [
    "{formtoggle: name=Add example; default=yes}…{endformtoggle}",
    "Conditional content",
  ],
  ["{clipboard}", "Current clipboard text"],
];

export default function PromptLibraryPage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: "/features/prompt-library",
          name: "Dynamic AI prompt template library for Windows",
          description:
            "Build reusable InsertGo prompt templates whose changing values are collected by a generated fill-in form before the AI call.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to create a dynamic AI prompt template with form fields",
            description:
              "Build a reusable InsertGo prompt that collects changing values through a generated form.",
            steps: steps.map((step) => ({ name: step.title, text: step.text })),
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="Reusable prompt workflows"
        title="AI prompt library software with dynamic templates"
        sub="Save the instructions that work, replace changing details with form commands, and run the finished prompt from any Windows app."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {["formtext", "formmenu", "formtoggle", "clipboard"].map((command) => (
              <code
                key={command}
                className="glass-chip rounded-lg px-3 py-1.5 text-sm text-ink"
              >
                {"{"}
                {command}
                {"}"}
              </code>
            ))}
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="How do you create dynamic AI prompt templates with form fields?">
            Write a reusable prompt, replace the changing details with commands
            such as formtext, formparagraph, formmenu, formtoggle, or clipboard,
            then save it under a category. When the template is selected,
            InsertGo builds a fill-in form from those commands and sends only the
            fully expanded prompt to the managed InsertGo relay.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <div className="grid items-start gap-[18px] lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div>
              <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
                Working template
              </p>
              <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
                One prompt, new inputs every run
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Commands become controls in a short form. InsertGo expands them
                locally, so the model receives normal, readable instructions
                without template tokens.
              </p>
              <Link
                href="/features/auto-text-insert"
                className="mt-3 inline-flex text-sm font-medium text-brand hover:underline"
              >
                See where the result goes →
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="glass-solid overflow-hidden rounded-[var(--radius-glass)]">
              <div className="border-b border-line px-5 py-3 text-xs font-medium tracking-[0.12em] text-muted uppercase">
                Polite reply template
              </div>
              <pre className="m-0 overflow-x-auto p-6 text-sm leading-[1.8] text-ink-soft">
                <code>{`Write a {formmenu: default=polite; friendly; firm}
reply to the following message.

Keep it {formmenu: default=short; medium; detailed}.
Mention: {formtext: name=key point; default=next steps}

{clipboard}`}</code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-10 max-w-[680px]">
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              Supported dynamic prompt commands
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              InsertGo uses AI Blaze-style command syntax for portable,
              form-driven prompt templates.
            </p>
          </Reveal>
          <Reveal>
            <div className="glass-panel overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <caption className="sr-only">
                  InsertGo dynamic prompt command reference
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Command example
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Form behavior
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {commandRows.map(([command, behavior]) => (
                    <tr key={command} className="border-b border-line last:border-0">
                      <td className="p-5">
                        <code className="text-sm text-ink-soft">{command}</code>
                      </td>
                      <td className="p-5 text-sm text-muted">{behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Build a template in four steps
          </h2>
        </Reveal>
        <ol className="grid gap-[18px] md:grid-cols-2">
          {steps.map((step, index) => (
            <li
              id={`step-${index + 1}`}
              key={step.title}
              className="scroll-mt-28"
            >
              <Reveal delay={(index % 2) * 0.08}>
                <article className="glass-card h-full p-7">
                  <span className="text-sm font-semibold text-brand">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 mb-0 font-serif text-xl font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 mb-0 text-[15px] leading-relaxed text-muted">
                    {step.text}
                  </p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Prompt library questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SeoCta
        title="Turn your best prompt into a reusable tool"
        body="Save it once. Fill only what changes. Insert the result wherever you work."
        secondaryHref="/alternatives/raycast-windows"
        secondaryLabel="Compare prompt systems"
      />
    </main>
  );
}
