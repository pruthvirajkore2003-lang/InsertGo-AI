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
import { AdUnit } from "@/components/ads/AdUnit";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import {
  breadcrumbSchema,
  CONTENT_UPDATED,
  faqSchema,
  SITE_URL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "System-Wide AI Writing Assistant for Windows: Guide",
  description:
    "Learn how a floating, system-wide AI writing assistant works on Windows: hotkeys, focus handoff, prompt templates, selected text, providers, clipboard safety, and app compatibility.",
  alternates: { canonical: "/blog/windows-ai-productivity-guide" },
  authors: [{ name: "InsertGo.AI" }],
  openGraph: {
    title: "System-Wide AI Writing Assistant for Windows: Complete Guide",
    description:
      "Architecture, workflows, privacy checks, and buying criteria for a Windows AI desktop assistant.",
    url: "/blog/windows-ai-productivity-guide",
    type: "article",
    publishedTime: CONTENT_UPDATED,
    modifiedTime: CONTENT_UPDATED,
    authors: [SITE_URL],
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Windows AI guide", href: "/blog/windows-ai-productivity-guide" },
];

const faqs = [
  {
    question: "How does a floating AI prompt assistant work on Windows?",
    answer:
      "A global hotkey records the active window and opens an always-on-top prompt surface. You enter or choose a prompt, an AI provider returns text, and the assistant restores and verifies the original window before pasting. A safe implementation also restores the previous clipboard value.",
  },
  {
    question: "What is a system-wide AI writing assistant?",
    answer:
      "A system-wide AI writing assistant can generate, revise, and return text across multiple desktop applications. Unlike a website-only chatbot or one-app plugin, it uses operating-system shortcuts and focus handoff to serve browsers, editors, documents, email, chat, and other text fields.",
  },
  {
    question: "Is a desktop AI overlay safe to use with sensitive text?",
    answer:
      "Safety depends on the product and provider. Check when text is captured, whether requests are explicit, where prompts and credentials are stored, which provider receives content, and whether password fields are blocked. InsertGo reads focused content only after an explicit action and refuses password fields.",
  },
  {
    question: "What should I compare in Windows AI productivity tools?",
    answer:
      "Compare application reach, global shortcuts, selected-text actions, prompt reuse, runtime variables, provider choice, write-back reliability, clipboard behavior, local storage, credential handling, fallback behavior, and whether the tool solves a focused workflow or replaces a broader launcher.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "System-Wide AI Writing Assistant for Windows: Complete Guide",
  description:
    "How floating AI prompt assistants use global hotkeys, focus handoff, dynamic prompt templates, AI providers, and safe text insertion across Windows apps.",
  datePublished: CONTENT_UPDATED,
  dateModified: CONTENT_UPDATED,
  mainEntityOfPage: `${SITE_URL}/blog/windows-ai-productivity-guide`,
  author: {
    "@type": "Organization",
    name: "InsertGo.AI",
    url: SITE_URL,
  },
  publisher: {
    "@type": "Organization",
    name: "InsertGo.AI",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/main-logo.png`,
    },
  },
  about: [
    "Windows AI assistant",
    "System-wide AI writing assistant",
    "Desktop AI overlay",
    "AI prompt library",
  ],
};

const architecture = [
  ["1", "Global hotkey", "Explicit user trigger"],
  ["2", "Focus capture", "Window + cursor context"],
  ["3", "Prompt surface", "Write or choose template"],
  ["4", "AI provider", "Generate reviewed output"],
  ["5", "Verified write-back", "Restore focus + paste"],
];

export default function WindowsAiProductivityGuidePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={articleSchema} />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="Windows AI productivity guide"
        title="System-wide AI writing assistant for Windows"
        sub="How desktop overlays connect global hotkeys, reusable prompts, selected text, AI providers, focus restoration, and safe paste-back into one workflow."
      >
        <FadeUp delay={0.18}>
          <p className="mt-6 text-sm text-muted">
            Published and reviewed {CONTENT_UPDATED} · 9 minute read
          </p>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="How does a floating AI prompt assistant work on Windows?">
            A global hotkey records the active window and opens an always-on-top
            prompt surface. You enter or choose a prompt, an AI provider returns
            text, and the assistant restores and verifies the original window
            before pasting. A safe workflow restores your previous clipboard
            value too.
          </DirectAnswer>
        </Reveal>
      </section>

      <article className="mx-auto max-w-[1080px] px-6">
        <section className="py-[80px]">
          <Reveal className="mb-10 max-w-[760px]">
            <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
              From global hotkey to verified write-back
            </h2>
            <p className="mt-4 text-base leading-[1.75] text-muted">
              A desktop AI assistant is useful only if it preserves the user’s
              place. The central engineering problem is not opening an AI
              window; it is returning approved text to the correct application
              without pasting into a window that gained focus by accident.
            </p>
          </Reveal>

          <Reveal>
            <ol
              aria-label="Floating AI assistant architecture"
              className="glass-panel grid gap-px overflow-hidden md:grid-cols-5"
            >
              {architecture.map(([number, title, detail]) => (
                <li key={number} className="relative bg-surface/40 p-6">
                  <span className="text-xs font-semibold text-brand">{number}</span>
                  <h3 className="mt-3 mb-1 font-serif text-lg font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="m-0 text-sm leading-relaxed text-muted">{detail}</p>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal className="mt-8">
            <div className="grid gap-[18px] md:grid-cols-2">
              <article className="glass-card p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Capture should be explicit
                </h3>
                <p className="mt-3 mb-0 text-[15px] leading-[1.75] text-muted">
                  InsertGo captures focused text only after a hotkey or selection
                  action. It does not run an always-on keyboard hook or
                  continuously inspect accessibility trees. Password and PIN
                  fields are refused before their value is read.
                </p>
              </article>
              <article className="glass-card p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Write-back should fail safely
                </h3>
                <p className="mt-3 mb-0 text-[15px] leading-[1.75] text-muted">
                  Before insertion, InsertGo verifies that the captured window
                  is foreground. If Windows blocks focus or input—for example,
                  when a target runs elevated—the result stays copied and a
                  manual-paste message replaces a silent failure.
                </p>
              </article>
            </div>
          </Reveal>
        </section>

        <section className="py-[70px]">
          <Reveal className="mb-10 max-w-[760px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Workflow fit
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              When system-wide AI beats another chat tab
            </h2>
            <p className="mt-4 text-base leading-[1.75] text-muted">
              Web chat is excellent for long conversations. A system-wide
              assistant wins when the job starts and ends inside another app:
              rewrite the email being drafted, improve a coding prompt, turn a
              selected paragraph into bullets, or insert a reusable response
              without moving the working context.
            </p>
          </Reveal>
          <Reveal>
            <div className="glass-panel overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <caption className="sr-only">
                  Best AI assistant format by Windows workflow
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Workflow
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Best surface
                    </th>
                    <th scope="col" className="p-5 text-sm font-semibold text-ink">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Multi-turn research or planning",
                      "Full AI chat",
                      "History, attachments, tools, and follow-up questions matter.",
                    ],
                    [
                      "Rewrite text already in a field",
                      "Inline desktop action",
                      "Capture, transform, and replace without changing windows.",
                    ],
                    [
                      "Repeat a structured task",
                      "Dynamic prompt template",
                      "Reusable instructions collect only values that change.",
                    ],
                    [
                      "Use webpage content as context",
                      "Browser assistant",
                      "Page-aware tools can read supported tabs directly.",
                    ],
                    [
                      "Deep IDE or document automation",
                      "App-specific plugin",
                      "Native context and commands outweigh cross-app reach.",
                    ],
                  ].map(([workflow, surface, reason]) => (
                    <tr key={workflow} className="border-b border-line last:border-0">
                      <th scope="row" className="p-5 text-sm font-semibold text-ink-soft">
                        {workflow}
                      </th>
                      <td className="p-5 text-sm text-muted">{surface}</td>
                      <td className="p-5 text-sm leading-relaxed text-muted">{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        <section className="py-[70px]">
          <div className="grid gap-[18px] lg:grid-cols-3">
            <Reveal>
              <article className="glass-card h-full p-7">
                <span className="text-xs font-medium tracking-[0.14em] text-brand uppercase">
                  Prompt reuse
                </span>
                <h2 className="mt-3 mb-0 font-serif text-2xl font-semibold text-ink">
                  Build a prompt library, not a prompt pile
                </h2>
                <p className="mt-4 text-[15px] leading-[1.75] text-muted">
                  Save stable instructions—task, constraints, examples, output
                  format—and turn changing values into fields. Categories make
                  retrieval faster; form commands keep one template useful
                  across clients, projects, and apps.
                </p>
                <Link
                  href="/features/prompt-library"
                  className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
                >
                  Dynamic prompt templates →
                </Link>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="glass-card h-full p-7">
                <span className="text-xs font-medium tracking-[0.14em] text-brand uppercase">
                  Selected text
                </span>
                <h2 className="mt-3 mb-0 font-serif text-2xl font-semibold text-ink">
                  Use a floater for short, contextual actions
                </h2>
                <p className="mt-4 text-[15px] leading-[1.75] text-muted">
                  Selection actions fit small transforms: refine, translate,
                  summarize, explain, or apply a saved skill. Review before
                  replacement. Never auto-submit the transformed text to the
                  host application.
                </p>
                <Link
                  href="/features/auto-text-insert"
                  className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
                >
                  Selection and insert flow →
                </Link>
              </article>
            </Reveal>
            <Reveal delay={0.16}>
              <article className="glass-card h-full p-7">
                <span className="text-xs font-medium tracking-[0.14em] text-brand uppercase">
                  Provider choice
                </span>
                <h2 className="mt-3 mb-0 font-serif text-2xl font-semibold text-ink">
                  Separate interface from model
                </h2>
                <p className="mt-4 text-[15px] leading-[1.75] text-muted">
                  A multi-provider assistant lets the desktop workflow remain
                  stable while models change. Compare supported providers,
                  custom keys, credential storage, data routes, per-template
                  model choice, limits, and fallback behavior.
                </p>
                <Link
                  href="/features"
                  className="mt-4 inline-flex text-sm font-medium text-brand hover:underline"
                >
                  See InsertGo features →
                </Link>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="py-[70px]">
          <Reveal className="mb-10 max-w-[760px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              Evaluation checklist
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              Choosing among AI productivity tools for desktop
            </h2>
            <p className="mt-4 text-base leading-[1.75] text-muted">
              “Best” depends on workflow. Score candidates against tasks you
              perform daily, not feature-count screenshots.
            </p>
          </Reveal>
          <Reveal>
            <ol className="grid gap-[18px] md:grid-cols-2">
              {[
                [
                  "Map application reach",
                  "List browsers, native apps, editors, terminals, remote sessions, and elevated tools you need.",
                ],
                [
                  "Test invocation speed",
                  "Confirm global hotkeys are rebindable, reliable, and do not collide with existing shortcuts.",
                ],
                [
                  "Inspect context access",
                  "Know what text, window titles, clipboard content, files, pages, or screens the tool can read—and when.",
                ],
                [
                  "Test write-back failures",
                  "Change focus during generation and try slow or elevated targets. Useful tools explain safe fallbacks.",
                ],
                [
                  "Audit storage and credentials",
                  "Separate local prompt storage, cloud sync, managed AI requests, and OS credential handling.",
                ],
                [
                  "Measure repeated-task time",
                  "Compare a real workflow from trigger to accepted text, including form filling and corrections.",
                ],
              ].map(([title, text], index) => (
                <li key={title} className="glass-card p-7">
                  <span className="text-sm font-semibold text-brand">0{index + 1}</span>
                  <h3 className="mt-3 mb-0 font-serif text-xl font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="mt-3 mb-0 text-[15px] leading-relaxed text-muted">
                    {text}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <section className="py-[70px]">
          <Reveal>
            <div className="glass-panel p-[clamp(26px,4vw,44px)]">
              <h2 className="m-0 font-serif text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.02em] text-ink">
                InsertGo workflow in one minute
              </h2>
              <ol className="mt-6 grid gap-4 md:grid-cols-3">
                <li className="rounded-xl bg-muted/10 p-5 text-[15px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">
                    1. Call the palette
                  </strong>
                  Press {HOTKEYS.primary.label} from the app where text belongs.
                </li>
                <li className="rounded-xl bg-muted/10 p-5 text-[15px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">
                    2. Run the prompt
                  </strong>
                  Type a new instruction or complete a saved template form.
                </li>
                <li className="rounded-xl bg-muted/10 p-5 text-[15px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">
                    3. Review and insert
                  </strong>
                  Accept the result, return to the captured app, and paste at the cursor.
                </li>
              </ol>
            </div>
          </Reveal>
        </section>
      </article>

      {/* In-article slot: after the body, before the FAQ block. Height is
          reserved by the unit itself, so an ad that fills late cannot push the
          FAQ down the page. */}
      <AdUnit className="py-6" />

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Windows AI productivity questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <AdUnit className="pb-10" />

      <SeoCta
        title="Try a focused system-wide AI workflow"
        body="One hotkey. Reusable prompts. Reviewed output returned to the app where you started."
        secondaryHref="/features/desktop-assistant"
        secondaryLabel="Explore desktop assistant"
      />
    </main>
  );
}
