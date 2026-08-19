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

const PATH = "/use-cases/developers";

export const metadata: Metadata = {
  title: "AI Prompt Assistant for VS Code and Windows Terminal",
  description:
    "Run saved AI prompts in VS Code, Windows Terminal, JetBrains IDEs, and the browser from one Windows hotkey. Form fields collect the diff or error; the result pastes at your caret.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "AI Prompt Assistant for VS Code and Windows Terminal",
    description:
      "One system-wide hotkey instead of one AI extension per tool.",
    url: PATH,
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Developers", href: PATH },
];

const templates = [
  {
    title: "Conventional commit message",
    where: "Windows Terminal, VS Code source control box, GitHub web",
    code: `Write a Conventional Commits message. One subject line under 72
characters, imperative mood, then a body only if the change needs it.

Type: {formmenu: default=feat; fix; refactor; chore; docs; test; perf}
Scope: {formtext: name=Scope}
Diff or summary: {clipboard}
{formtoggle: name=Breaking change; default=no}Add a BREAKING CHANGE footer.{endformtoggle}`,
  },
  {
    title: "Stack trace triage",
    where: "Terminal output, CI logs, browser console",
    code: `Explain this failure in three lines: what broke, the most likely cause,
and the first thing to check. No restating the trace.

Language or runtime: {formmenu: default=TypeScript; Rust; Python; Go}
Trace: {clipboard}
Suspected area: {formtext: name=Area}`,
  },
  {
    title: "Pull request description",
    where: "GitHub, Azure DevOps, GitLab in the browser",
    code: `Write a PR description: one-paragraph summary, a bullet list of the
behavioural changes, and a Testing section. Skip anything the diff does not show.

Branch summary: {formparagraph: name=What changed}
Commit log: {clipboard}
Risk: {formmenu: default=Low; Medium; High}
{formtoggle: name=Needs migration note; default=no}Call out the migration step first.{endformtoggle}`,
  },
];

const faqs = [
  {
    question: "How is this different from an AI extension inside my editor?",
    answer:
      "An editor extension only exists inside that editor. InsertGo runs at the Windows level, so the same prompt library works in VS Code, Windows Terminal, a JetBrains IDE, the browser, and a Slack thread — one shortcut, one set of templates, no per-tool configuration.",
  },
  {
    question: "Does it work in Windows Terminal?",
    answer:
      "Yes. Windows Terminal accepts a standard paste, which is all InsertGo needs. The generated text lands at the shell prompt rather than executing — nothing is submitted for you, so a generated command is reviewed on the command line before you press Enter.",
  },
  {
    question: "Can it read my repository or open files?",
    answer:
      "No. InsertGo sees only what you pass it: the selection, the clipboard, and the values you type into the form fields. There is no workspace indexing and no background file access, which is also why the pasted diff is the unit of context on this page.",
  },
  {
    question: "Can I fix an existing comment or commit message in place?",
    answer:
      HOTKEYS.improve.label +
      " rewrites the focused text field without opening the palette, so a commit message box or a code comment can be tightened where it sits. " +
      HOTKEYS.undo.label +
      " puts the previous draft back.",
  },
];

const rows = [
  {
    criterion: "Platform scope",
    ours: "One Windows hotkey across every editor, terminal, browser, and chat app.",
    theirs: "The one editor the extension was written for.",
  },
  {
    criterion: "Prompt reuse",
    ours: "A local, categorised template library shared by every app on the machine.",
    theirs: "Prompts or custom instructions configured per editor, per profile.",
  },
  {
    criterion: "Dynamic forms",
    ours: "{formmenu} for commit types, {formtoggle} for optional footers, {clipboard} for the diff.",
    theirs: "Chat input, or a fixed command palette entry.",
  },
  {
    criterion: "Cursor write-back",
    ours: "Restores the captured window, verifies foreground, pastes at the caret — including the terminal prompt.",
    theirs: "Usually inserts into the editor buffer only; terminals are out of reach.",
  },
  {
    criterion: "Clipboard safety",
    ours: "Staged for the paste only, previous clipboard value restored afterwards.",
    theirs: "Not applicable — insertion happens through the editor API.",
  },
  {
    criterion: "Repository context",
    ours: "Only what you pass: selection, clipboard, form fields. No indexing.",
    theirs: "Often reads open files and the workspace index for context.",
  },
  {
    criterion: "Best fit",
    ours: "Repeated writing tasks that cross tools: commits, PRs, triage notes, replies.",
    theirs: "In-file code completion and refactors that need whole-project context.",
  },
];

export default function DevelopersUseCasePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: PATH,
          name: "AI prompt assistant for VS Code and Windows Terminal",
          description:
            "How developers use InsertGo across editors, terminals, and browsers: reusable prompt templates with form commands and verified insertion at the caret.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to run an AI prompt from VS Code or Windows Terminal",
            description:
              "Copy the diff or trace, open InsertGo over the editor or terminal, fill in the form fields, and insert the result at the caret.",
            totalTime: "PT1M",
            steps: HOTKEY_WORKFLOW_STEPS,
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="For developers"
        title="AI prompt assistant for VS Code and Windows Terminal"
        sub="One shortcut that follows you from the editor to the terminal to the pull request, instead of one AI extension per tool."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex justify-center">
            <span className="glass-chip rounded-lg px-4 py-2 text-sm font-medium text-ink">
              {HOTKEYS.primary.label} · template · Insert
            </span>
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="How do you run AI prompts in VS Code and Windows Terminal?">
            InsertGo runs saved AI prompts inside VS Code, Windows Terminal,
            JetBrains IDEs, and the browser, because it works at the Windows
            level rather than as an editor extension. A hotkey opens it over the
            editor, form fields collect the diff or error, and the result pastes
            at your caret.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Templates worth saving
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Three prompts that pay for themselves daily
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Paste these into the prompt library as-is. The brace commands become
            a fill-in dialog; <code className="text-ink-soft">{"{clipboard}"}</code>{" "}
            picks up whatever you copied last, so the diff never has to be
            retyped into a chat box.
          </p>
        </Reveal>
        <div className="grid gap-[18px]">
          {templates.map((template, index) => (
            <Reveal key={template.title} delay={index * 0.06}>
              <article className="glass-card p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                    {template.title}
                  </h3>
                  <span className="text-xs text-muted">{template.where}</span>
                </div>
                <pre className="mt-4 overflow-x-auto text-[13px] leading-relaxed text-muted">
                  <code>{template.code}</code>
                </pre>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              From hotkey to caret
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The terminal, the commit box, and the PR field are all the same
              target: a window that accepts a paste.
            </p>
          </Reveal>
          <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Scope check
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            System-wide prompts, not a coding agent
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            InsertGo does not index your repository or complete code as you
            type — that is what an in-editor assistant is for. It covers the
            writing that surrounds the code and keeps happening outside the
            editor window.
          </p>
        </Reveal>
        <Reveal>
          <ComparisonTable
            caption="InsertGo compared with an editor-bound AI extension"
            theirs="Editor-bound AI extension"
            rows={rows}
          />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Developer workflow questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <section className="mx-auto max-w-[900px] px-6 pb-8">
        <Reveal>
          <p className="text-sm leading-relaxed text-muted">
            Related:{" "}
            <Link
              href="/features/ai-text-expander"
              className="text-brand hover:underline"
            >
              AI text expander
            </Link>
            ,{" "}
            <Link
              href="/features/prompt-library"
              className="text-brand hover:underline"
            >
              prompt library
            </Link>
            , and{" "}
            <Link
              href="/alternatives/raycast-windows"
              className="text-brand hover:underline"
            >
              InsertGo vs Raycast on Windows
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <SeoCta
        title="Stop retyping the same prompt into a chat box"
        body="Save it once with the variable parts as fields, then run it from whichever window you are in."
        secondaryHref="/features/prompt-library"
        secondaryLabel="See the prompt library"
      />
    </main>
  );
}
