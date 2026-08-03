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
import { breadcrumbSchema, faqSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Windows Desktop AI Assistant and Overlay App",
  description:
    "Use a keyboard-first AI assistant across Windows apps. InsertGo floats above your work, runs reusable prompts, improves selected text, and inserts results back at the cursor.",
  alternates: { canonical: "/features/desktop-assistant" },
  openGraph: {
    title: "Windows Desktop AI Assistant and Overlay App",
    description:
      "A system-wide AI prompt layer for browsers, editors, documents, email, chat, and terminals.",
    url: "/features/desktop-assistant",
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/features" },
  { name: "Desktop assistant", href: "/features/desktop-assistant" },
];

const faqs = [
  {
    question: "What is a Windows desktop AI assistant?",
    answer:
      "A Windows desktop AI assistant is an application you can invoke across other programs, rather than only inside one website or editor. InsertGo opens as a floating prompt window, sends an explicit request to the managed InsertGo relay, then returns approved text to the app you were using.",
  },
  {
    question: "What is an AI desktop overlay app?",
    answer:
      "An AI desktop overlay app is a small always-on-top interface that appears over the current workspace. It can provide AI actions without requiring a browser tab, sidebar, or plugin in every application. InsertGo opens from a global shortcut and closes after the workflow.",
  },
  {
    question: "How does a floating AI prompt assistant work on Windows?",
    answer:
      "A global hotkey captures the active window and opens the overlay. You enter or select a saved prompt, the managed InsertGo relay generates a response, and InsertGo restores and verifies the original window before pasting. Clipboard contents are restored after a successful insertion.",
  },
  {
    question: "Do I need my own API key?",
    answer:
      "No. Every prompt runs through the managed InsertGo relay, so the desktop app never holds an AI provider key. The only credential it stores is your InsertGo session token, kept in the Windows credential store in the packaged app.",
  },
];

const workflows = [
  {
    title: "Draft in any text box",
    text: "Open the palette above email, chat, documents, code, or a browser; generate a response; insert it at the cursor.",
    href: "/features/auto-text-insert",
    label: "AI text auto-insert",
  },
  {
    title: "Reuse structured prompts",
    text: "Turn repeated instructions into templates with text fields, menus, toggles, paragraphs, and clipboard values.",
    href: "/features/prompt-library",
    label: "Dynamic prompt library",
  },
  {
    title: "Improve text in place",
    text: `Press ${HOTKEYS.improve.label} to rewrite the focused field without opening the palette; ${HOTKEYS.undo.label} restores the draft.`,
    href: "/how-it-works",
    label: "Inline Improve workflow",
  },
  {
    title: "Act on a selection",
    text: "Highlight text, choose a contextual skill near the selection, review the output, then apply it back to the source app.",
    href: "/features/auto-text-insert",
    label: "Selection actions",
  },
];

export default function DesktopAssistantPage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={faqSchema(faqs)} />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="AI desktop overlay app"
        title="Windows desktop AI assistant for every text workflow"
        sub="One global shortcut opens InsertGo above the app you are using. Run a prompt, review the response, and return it to the same workspace."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex justify-center">
            <span className="glass-chip rounded-lg px-4 py-2 text-sm font-medium text-ink">
              Windows 10 &amp; 11 · {HOTKEYS.primary.label}
            </span>
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="What is a Windows desktop AI assistant?">
            A Windows desktop AI assistant works across programs instead of
            living inside one website or editor. InsertGo appears as a floating
            prompt window, runs an explicit request through the managed
            InsertGo relay, then returns approved text to the app you were using.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-11 max-w-[700px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Four desktop workflows
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            AI meets you where the text already is
          </h2>
        </Reveal>
        <div className="grid gap-[18px] md:grid-cols-2">
          {workflows.map((workflow, index) => (
            <Reveal key={workflow.title} delay={(index % 2) * 0.08}>
              <article className="glass-card flex h-full flex-col p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  {workflow.title}
                </h3>
                <p className="mt-3 mb-5 flex-1 text-[15px] leading-relaxed text-muted">
                  {workflow.text}
                </p>
                <Link
                  href={workflow.href}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  {workflow.label} →
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mx-auto mb-11 max-w-[700px] text-center">
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              Overlay, browser assistant, or app plugin?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Right architecture depends on how many applications your work
              crosses.
            </p>
          </Reveal>
          <Reveal>
            <div className="glass-panel overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <caption className="sr-only">
                  AI assistant architecture comparison
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Model
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Reach
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Best for
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Main tradeoff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Desktop overlay",
                      "Apps accepting standard Windows paste input",
                      "Cross-app prompt and writing workflows",
                      "Needs OS focus and input permissions",
                    ],
                    [
                      "Browser assistant",
                      "Supported pages inside its browser",
                      "Webpage-aware research and writing",
                      "Native desktop apps sit outside its scope",
                    ],
                    [
                      "App-specific plugin",
                      "One editor, document tool, or service",
                      "Deep context and native commands",
                      "Separate setup and behavior per app",
                    ],
                  ].map(([model, reach, best, tradeoff]) => (
                    <tr key={model} className="border-b border-line last:border-0">
                      <th scope="row" className="p-5 text-sm font-semibold text-ink-soft">
                        {model}
                      </th>
                      <td className="p-5 text-sm leading-relaxed text-muted">{reach}</td>
                      <td className="p-5 text-sm leading-relaxed text-muted">{best}</td>
                      <td className="p-5 text-sm leading-relaxed text-muted">
                        {tradeoff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Windows AI assistant questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SeoCta
        title="Add one AI layer across your Windows desktop"
        body="Use the same prompt library, providers, and insertion workflow wherever text accepts a paste."
        secondaryHref="/blog/windows-ai-productivity-guide"
        secondaryLabel="Read Windows AI guide"
      />
    </main>
  );
}
