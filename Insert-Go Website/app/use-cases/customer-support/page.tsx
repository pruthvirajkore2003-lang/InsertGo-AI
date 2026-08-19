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

const PATH = "/use-cases/customer-support";

export const metadata: Metadata = {
  title: "AI Canned Response Assistant for Outlook and Zendesk",
  description:
    "Draft support replies in Outlook, Zendesk, Freshdesk, or Intercom from one Windows hotkey. Form fields set tone and optional clauses; the reply pastes at your cursor for review.",
  alternates: { canonical: PATH },
  openGraph: {
    title: "AI Canned Response Assistant for Outlook and Zendesk",
    description:
      "Macros give the same paragraph. A prompt template gives the reply this ticket needs.",
    url: PATH,
    type: "article",
  },
};

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Customer support", href: PATH },
];

const templates = [
  {
    title: "Refund decision reply",
    where: "Zendesk, Freshdesk, Outlook",
    code: `Reply to this customer. Lead with the decision, give one reason,
end with the next step. No apology padding, no policy quoting.

Decision: {formmenu: default=Approved; Partial; Declined}
Their message: {clipboard}
Order reference: {formtext: name=Order}
{formtoggle: name=Offer store credit; default=no}Offer store credit as an alternative.{endformtoggle}`,
  },
  {
    title: "Escalation acknowledgement",
    where: "Intercom, Outlook, Teams",
    code: `Acknowledge an escalation. Confirm what we understand is broken,
name the owner, commit to a specific update time. Keep it under 90 words.

Severity: {formmenu: default=Blocking; Degraded; Cosmetic}
Ticket summary: {formparagraph: name=What is broken}
Next update: {formtext: name=When}
Owner: {formtext: name=Owner}`,
  },
  {
    title: "Rewrite a macro for this ticket",
    where: "Any reply box, over the pasted macro",
    code: `Rewrite the canned response below so it answers this specific
customer. Keep every factual claim, drop anything that does not apply.

Canned response: {clipboard}
What they actually asked: {formparagraph: name=Their question}
Register: {formmenu: default=Warm; Neutral; Formal}`,
  },
];

const faqs = [
  {
    question: "How do I write AI canned responses for Outlook and Zendesk?",
    answer:
      "Save one prompt template per reply type, with tone and optional clauses declared as form fields. Copy the customer message, press the InsertGo hotkey over the reply box, fill in the dialog, review the draft, and insert it at your cursor. Nothing is sent for you.",
  },
  {
    question: "Is this better than the macros already in my helpdesk?",
    answer:
      "They solve different problems. A macro guarantees identical approved wording, which is what compliance-sensitive replies need. A prompt template adapts the wording to the ticket in front of you and can rewrite an existing macro so it answers the question actually asked.",
  },
  {
    question: "Does it work in a browser-based helpdesk?",
    answer:
      "Yes. Zendesk, Freshdesk, Intercom, and Help Scout run in the browser, and the browser accepts a standard paste like any other Windows app. The same templates also work in the Outlook desktop client, Teams, and Slack, with no per-tool setup.",
  },
  {
    question: "What happens to the customer data I paste in?",
    answer:
      "Prompt templates and settings stay in local Windows application data, and the app stores no AI key — only your session token, in the Windows credential store. Text leaves the device only when you explicitly run a prompt. Follow your own policy before pasting customer records.",
  },
];

const rows = [
  {
    criterion: "Platform scope",
    ours: "One Windows hotkey over Outlook, Teams, and any browser-based helpdesk.",
    theirs:
      "Inside the helpdesk that owns them; a second tool needs a second macro set.",
  },
  {
    criterion: "What gets inserted",
    ours: "A reply drafted for this ticket, reviewable before it is inserted.",
    theirs: "The approved paragraph, with placeholders filled from ticket fields.",
  },
  {
    criterion: "Dynamic forms",
    ours: "{formmenu} for tone and decision, {formtoggle} for optional clauses, {clipboard} for the customer message.",
    theirs: "Ticket-field variables such as requester name and order number.",
  },
  {
    criterion: "Cursor write-back",
    ours: "Restores the captured window, verifies foreground, pastes into the reply box; aborts to manual paste on mismatch.",
    theirs: "Inserted by the helpdesk itself into its own composer.",
  },
  {
    criterion: "Clipboard safety",
    ours: "Staged for the paste only, previous clipboard value restored afterwards.",
    theirs: "Not applicable.",
  },
  {
    criterion: "Consistency",
    ours: "Structure is fixed by the template; wording varies per ticket.",
    theirs: "Wording is identical every time, which is the point for legal text.",
  },
  {
    criterion: "Pricing",
    ours: "Free tier, paid plans, and non-expiring credit packs.",
    theirs: "Included with the helpdesk seat.",
  },
];

export default function CustomerSupportUseCasePage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={pageGraph({
          path: PATH,
          name: "AI canned response assistant for Outlook and Zendesk",
          description:
            "How support teams use InsertGo to draft replies in Outlook, Zendesk, Freshdesk, and Intercom with form-driven prompt templates and verified cursor insertion.",
          breadcrumbs,
          faqs,
          howTo: {
            name: "How to draft an AI support reply in Outlook or Zendesk",
            description:
              "Copy the customer message, open InsertGo over the reply box, set tone and optional clauses, review the draft, and insert it at the cursor.",
            totalTime: "PT1M",
            steps: HOTKEY_WORKFLOW_STEPS,
          },
        })}
      />
      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="For customer support"
        title="AI canned response assistant for Outlook and Zendesk"
        sub="Macros keep the wording identical. Prompt templates keep the structure identical and let the wording match the ticket."
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex justify-center">
            <span className="glass-chip rounded-lg px-4 py-2 text-sm font-medium text-ink">
              Copy the ticket · {HOTKEYS.primary.label} · Insert
            </span>
          </div>
        </FadeUp>
      </PageHero>

      <section className="px-6 py-10">
        <Reveal>
          <DirectAnswer title="How do you write AI canned responses on Windows?">
            Support replies need the same structure with different facts every
            time. InsertGo opens over Outlook, Zendesk, Freshdesk, or Intercom on
            one hotkey, pulls the customer message from your clipboard, collects
            tone and optional clauses as form fields, then pastes the drafted
            reply at your cursor for review.
          </DirectAnswer>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[70px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Templates worth saving
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Three replies that repeat every shift
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Paste these into the prompt library. A{" "}
            <code className="text-ink-soft">{"{formtoggle}"}</code> that is left
            off is removed from the prompt entirely, so the refund template
            covers both the credit and the no-credit reply without a second
            version.
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
              From ticket to reply box
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The draft is reviewed in the floating window first. InsertGo never
              sends the reply for you.
            </p>
          </Reveal>
          <HowToSteps steps={HOTKEY_WORKFLOW_STEPS} />
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-[80px]">
        <Reveal className="mb-10 max-w-[720px]">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Macros or prompts
          </p>
          <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
            Keep the macros that must not change
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Legal, billing, and policy text should stay word-for-word, and a
            helpdesk macro is the right home for it. Everything else — the
            acknowledgement, the explanation, the apology that has to sound
            written — is where a prompt template earns its place.
          </p>
        </Reveal>
        <Reveal>
          <ComparisonTable
            caption="InsertGo prompt templates compared with helpdesk macros"
            theirs="Helpdesk macros"
            rows={rows}
          />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-[70px]">
        <Reveal className="mb-10">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Support workflow questions
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
              href="/alternatives/textexpander-windows"
              className="text-brand hover:underline"
            >
              TextExpander alternative
            </Link>
            , and{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              how data is handled
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <SeoCta
        title="Same structure, right words, every ticket"
        body="Copy the message, press the hotkey, pick the tone, and review the draft before it goes anywhere."
        secondaryHref="/alternatives/windows-copilot"
        secondaryLabel="Compare with Windows Copilot"
      />
    </main>
  );
}
