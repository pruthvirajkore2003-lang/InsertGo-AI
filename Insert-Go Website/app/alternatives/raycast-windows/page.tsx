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
import { CONTENT_UPDATED, HOTKEY_WORKFLOW_STEPS, pageGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Raycast Alternative for Windows AI Prompts",
  description:
    "Compare InsertGo and Raycast for Windows AI prompt workflows: global hotkeys, reusable prompts, dynamic fields, selected-text actions, direct insertion, privacy, and product scope.",
  alternates: { canonical: "/alternatives/raycast-windows" },
  openGraph: {
    title: "InsertGo vs Raycast for Windows AI Prompts",
    description:
      "A current, source-backed comparison for people choosing a Windows AI prompt workflow.",
    url: "/alternatives/raycast-windows",
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  {
    name: "Raycast for Windows alternative",
    href: "/alternatives/raycast-windows",
  },
];

const faqs = [
  {
    question: "What is the best Raycast alternative for Windows AI prompts?",
    answer:
      "InsertGo is a focused Raycast alternative when your priority is reusable, form-driven AI prompts and direct insertion into Windows apps. Raycast is the broader choice when you also want app and file search, extensions, notes, window management, and a general productivity launcher.",
  },
  {
    question: "Does Raycast work on Windows?",
    answer:
      "Yes. Raycast has a native Windows 10-or-later beta. Its Windows app includes launcher features, AI Commands, snippets, dynamic placeholders, global shortcuts, and selected-text replacement. Any comparison claiming Raycast is Mac-only is outdated.",
  },
  {
    question: "Is InsertGo an AI Blaze alternative for Windows?",
    answer:
      "InsertGo is an AI Blaze alternative for workflows that must reach native Windows apps, not only websites. AI Blaze is a Chrome extension built around browser page context and shared prompt folders; InsertGo uses Windows-level focus handoff and standard paste behavior.",
  },
  {
    question: "Which tool is better for dynamic prompt forms?",
    answer:
      "InsertGo supports AI Blaze-style form commands such as text fields, paragraphs, menus, toggles, and clipboard values. Raycast supports arguments and option lists through Dynamic Placeholders. Choose based on whether you want a dedicated form dialog or a launcher-wide command system.",
  },
];

const comparison = [
  {
    criterion: "Primary job",
    ours:
      "Focused AI prompt assistant: compose, reuse, improve, generate, and insert text.",
    theirs:
      "General productivity launcher: apps, files, commands, extensions, snippets, and AI.",
  },
  {
    criterion: "Windows availability",
    ours: "Native Windows 10 and 11 app.",
    theirs: "Native Windows 10+ beta.",
  },
  {
    criterion: "Reusable AI prompts",
    ours:
      "Prompt library grouped by category, with fill-in forms before a prompt runs.",
    theirs:
      "AI Commands with tags, models, creativity controls, sharing, and imports.",
  },
  {
    criterion: "Runtime inputs",
    ours:
      "Text fields, paragraphs, menus, toggles, clipboard content, and legacy selected-text placeholders.",
    theirs:
      "Arguments, option lists, selected text, clipboard, dates, browser tabs, and other Dynamic Placeholders.",
  },
  {
    criterion: "Write-back",
    ours:
      "Insert generated text at the cursor in the app active before the overlay; restore prior clipboard content after a successful paste.",
    theirs:
      "Replace selected text in place with AI Command output; snippets can paste into the active app.",
  },
  {
    criterion: "Clipboard safety",
    ours:
      "Generated text is staged on the clipboard for the paste only, then the previous clipboard value is restored.",
    theirs:
      "Clipboard History is a stored, searchable list; AI Commands replace the selection rather than staging a paste.",
  },
  {
    criterion: "Pricing",
    ours:
      "Free tier, paid plans, and non-expiring credit packs — see the pricing page.",
    theirs:
      "Free tier with paid Pro and Team plans that carry the AI and Cloud Sync limits.",
  },
  {
    criterion: "Data model",
    ours:
      "Prompt library and settings stored locally; secrets use Windows credential storage.",
    theirs:
      "Account-based product with optional Pro Cloud Sync across supported platforms.",
  },
  {
    criterion: "Best fit",
    ours:
      "People wanting a small, purpose-built AI prompt and insertion layer.",
    theirs:
      "People wanting one broad launcher and automation platform with AI included.",
  },
];

export default function RaycastWindowsAlternativePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: "/alternatives/raycast-windows",
          name: "Raycast alternative for Windows AI prompts",
          description:
            "How InsertGo compares with Raycast on Windows: focused prompt-to-text workflow versus a general launcher, runtime inputs, write-back, clipboard handling, and pricing.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to run a reusable AI prompt on Windows",
            description:
              "Open InsertGo over the active app, fill in the template fields, review the generated text, and insert it at the cursor.",
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
        title="Raycast alternative for Windows AI prompts"
        sub="Raycast now runs on Windows. The useful question is no longer “What replaces Raycast?” but “Do you need a full launcher or a focused AI prompt workflow?”"
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
          <DirectAnswer title="What is the best Raycast alternative for Windows AI prompts?">
            InsertGo is a focused alternative when reusable, form-driven AI
            prompts and direct insertion into Windows apps matter most: a hotkey
            over the active window, a fill-in dialog, a verified paste at the
            cursor. Raycast is broader — choose it when app search, file search,
            extensions, notes, and window management belong in the same launcher.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[700px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            InsertGo vs Raycast
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Different scope, overlapping AI workflows
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Both products now support Windows, global keyboard access, reusable
            AI commands, runtime inputs, and text write-back. Main difference:
            InsertGo specializes in prompt-to-text flow; Raycast bundles that
            flow into a larger launcher.
          </p>
        </Reveal>

        <Reveal>
          <ComparisonTable
            caption="InsertGo and Raycast Windows AI feature comparison"
            theirs="Raycast"
            rows={comparison}
          />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mx-auto mb-12 max-w-[700px] text-center">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            From hotkey to cursor
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            The InsertGo path, in four steps.
          </p>
        </Reveal>
        <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
      </section>

      <section className="section-tint px-6 py-[80px]">
        <div className="mx-auto max-w-[1080px]">
          <Reveal className="mb-10 max-w-[720px]">
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
              AI Blaze Windows alternative
            </p>
            <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
              Browser page context or native Windows reach?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              AI Blaze works through a Chrome extension and can use webpage
              context, insert generated text into a page, and sync shared prompt
              folders. InsertGo targets native Windows workflows: it captures
              the active app, opens a floating prompt surface, and returns text
              through standard Windows paste behavior.
            </p>
          </Reveal>
          <div className="grid gap-[18px] md:grid-cols-2">
            <Reveal>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Choose InsertGo when
                </h3>
                <ul className="mt-5 space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
                  <li>You work across native apps, browsers, editors, and terminals.</li>
                  <li>You want clipboard restoration after successful insertion.</li>
                  <li>You prefer locally stored prompt templates and settings.</li>
                </ul>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="glass-card h-full p-7">
                <h3 className="m-0 font-serif text-2xl font-semibold text-ink">
                  Choose AI Blaze when
                </h3>
                <ul className="mt-5 space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
                  <li>Your workflow lives mainly inside Chrome websites.</li>
                  <li>Automatic webpage context is central to your prompts.</li>
                  <li>Shared, synchronized prompt folders matter now.</li>
                </ul>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Frequently asked comparison questions
          </h2>
        </Reveal>
        <FaqBlocks items={faqs} />
      </section>

      <SourceNote>
            Raycast facts:{" "}
            <a
              href="https://manual.raycast.com/quickstart"
              className="text-brand hover:underline"
            >
              Windows requirements
            </a>
            ,{" "}
            <a
              href="https://manual.raycast.com/ai/ai-commands"
              className="text-brand hover:underline"
            >
              AI Commands
            </a>
            ,{" "}
            <a
              href="https://manual.raycast.com/dynamic-placeholders"
              className="text-brand hover:underline"
            >
              Dynamic Placeholders
            </a>
            , and{" "}
            <a
              href="https://manual.raycast.com/billing"
              className="text-brand hover:underline"
            >
              plans and Cloud Sync
            </a>
            . AI Blaze facts:{" "}
            <a
              href="https://blaze.today/aiblaze/docs/quickstart/"
              className="text-brand hover:underline"
            >
              official quickstart
            </a>
            . InsertGo details:{" "}
            <Link href="/how-it-works" className="text-brand hover:underline">
              insertion workflow
            </Link>{" "}
            and{" "}
            <Link
              href="/features/prompt-library"
              className="text-brand hover:underline"
            >
              dynamic prompt library
            </Link>
            .
      </SourceNote>

      {/* End-of-article slot. Below the comparison the reader came for,
          above the CTA — and height-reserved, so it cannot shift either. */}
      <AdUnit className="pb-10" />

      <SeoCta
        title="Want prompt insertion, not another launcher?"
        body="Open InsertGo with one global hotkey, run a reusable prompt, and put the result back where you were typing."
        secondaryHref="/features/auto-text-insert"
        secondaryLabel="See auto-insert workflow"
      />
    </main>
  );
}
