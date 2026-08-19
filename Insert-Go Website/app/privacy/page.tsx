import type { Metadata } from "next";
import Link from "next/link";
import { FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { NOTICE_VERSION, PURPOSES } from "@/lib/consent";

/**
 * Canonical Privacy Policy. The identical text is mirrored inside the Windows
 * app (Insert-Go Windows/src/legal/index.ts) so it stays readable offline.
 *
 * The two copies are hand-kept: edit BOTH, and bump LEGAL_VERSION in the app,
 * or it records consent to wording this page no longer states.
 *
 * R-15 (2026-08-08): BYOK — user-supplied API keys and local models — is a
 * decided NON-feature, not an unshipped one. Nothing here may describe a lane
 * where text bypasses our relay; the relay is the only path that exists.
 */

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What InsertGo reads, what stays on your PC, what our managed AI service " +
    "sends to Google, how long anything is kept, and the rights you have over " +
    "it. The identical text ships inside the app.",
  alternates: { canonical: "/privacy" },
};

/**
 * R-13: the version is imported, not declared here.
 *
 * `lib/consent.ts` owns it because that is what `consentRecord.noticeVersion`
 * stores. When they were two constants, a consent row could name a version this
 * page no longer rendered — which makes the stored version worthless, since its
 * only job is to identify text we can still produce.
 */
const VERSION = NOTICE_VERSION;
const EFFECTIVE = "8 August 2026";

/** Same officer as Terms section 23 — the mailbox is live, the name is a
 *  placeholder. Fill it in HERE, in app/terms, and in the app's mirror. */
const GRIEVANCE_OFFICER = {
  name: "[Name to be appointed]",
  email: "grievance@insertgo.ai",
};

const sections: Array<{ heading: string; body: string }> = [
  {
    heading: "The short version",
    body:
      "InsertGo is built so that your text stays yours. Your drafts, prompt " +
      "library, run history, settings and skills live on your PC, not on our " +
      "servers. Every AI feature runs through our managed service: the text " +
      "you asked us to improve is sent to us over TLS and on to Google's " +
      "Gemini models to produce a response; it is not logged, not sold, and " +
      "not used to train models — we keep counts, not content, apart from the " +
      "short-lived cache described below. There is no way to point InsertGo " +
      "at your own API key or at a model on your machine, so this is the only " +
      "path your text can take. The desktop application contains no analytics " +
      `and no telemetry. The rest of this policy is the detail. This version, ${VERSION}, ` +
      `takes effect on ${EFFECTIVE}.`,
  },
  {
    heading: "Who is responsible for your data",
    body:
      "InsertGo.AI (\"we\", \"us\") is the controller of the personal data " +
      "described here, and you can reach us about anything in this policy at " +
      "support@insertgo.ai. We are the controller for every AI request the " +
      "product makes: all of them run through our managed service, and there " +
      "is no configuration in which your text reaches a provider without " +
      "passing through us.",
  },
  {
    heading: "What never leaves your device",
    body:
      "Held on your PC only: your drafts and prompts, your prompt library and " +
      "skills, your local run history, your settings and application " +
      "allowlist, and your window layout. The only credential the application " +
      "stores is your InsertGo session token, held by Windows Credential " +
      "Manager — never in a settings file, never in a log. The application " +
      "holds no AI provider key, because it never talks to a provider " +
      "directly. The application's log records error " +
      "conditions, not content: no prompt, response, key or token is ever " +
      "written to it. Uninstalling removes this local data from the device, " +
      "and you can clear history or delete stored keys from inside the " +
      "application at any time.",
  },
  {
    heading: "What InsertGo reads on your device, and when",
    body:
      "InsertGo reads the contents of the focused text field only at the " +
      "moment you press its hotkey, and reads the current selection only " +
      "while the selection skill bar is switched on. Both use Windows " +
      "accessibility interfaces and are limited to the applications on the " +
      "allowlist you control in Settings. Password and credential fields are " +
      "always refused: their contents are never read into memory, so they can " +
      "never be sent anywhere. When a field cannot be read or written " +
      "directly, InsertGo falls back to the clipboard — it saves what was on " +
      "your clipboard, uses it to move the text, then puts the original " +
      "contents back — and your clipboard is not read at any other time. " +
      "InsertGo does not take screenshots, does not log keystrokes, does not " +
      "record audio, and does not watch what you type between invocations.",
  },
  {
    heading: "What happens when you use the managed AI service",
    body:
      "On the free, Plus and Pro plans the text you invoke InsertGo on is " +
      "sent over TLS to our service and from there to Google's Gemini API, " +
      "which generates the response written back into your field. Google " +
      "processes it as our service provider under the Gemini API terms and " +
      "does not use it to train its models. Request and response bodies are " +
      "never written to our logs; we record only token counts and the fact " +
      "that a request happened. To keep the service fast and affordable, a " +
      "copy of the generated response is held in an expiring cache — " +
      "twenty-four hours by default — in a partition keyed to your account " +
      "together with the exact model and instruction used, so that repeating " +
      "the same request can be answered without regenerating it; a response " +
      "stored for your account can never be served to another account. If you " +
      "switch on grounded mode, a short topic distilled from your text is " +
      "also sent to Google Search, and the public findings for that topic — " +
      "not your text — are cached for up to twenty-four hours and may be " +
      "reused for anyone asking about the same topic.",
  },
  {
    heading: "Account and sign-in data",
    body:
      "If you create an account we process your email address, the name and " +
      "avatar your sign-in provider supplies when it supplies them, the " +
      "identifier that provider uses for you, and the session records that " +
      "keep you signed in. Sign-in happens by one-time email code delivered " +
      "through Resend, by Google OAuth, or through an enterprise SSO provider " +
      "chosen by your organisation; we never see or store a password, because " +
      "we do not use them. On the desktop, sign-in runs in your system " +
      "browser using Authorization Code with PKCE, and the resulting session " +
      "token is held in your operating system's credential storage rather " +
      "than in the application's files.",
  },
  {
    heading: "Plan, credit and device data",
    body:
      "To operate plans and quotas we store your subscription tier and " +
      "status, your daily credit usage, your purchased credit balance, a " +
      "ledger of the credits each request consumed, and the timestamps for " +
      "those. InsertGo also reads the device identifier Windows already " +
      "assigns to your PC and shows it to you in Settings so you can see " +
      "which machine you are on; it is sent to us only where a licence has to " +
      "be bound to a specific device, and it identifies a machine rather than " +
      "a person.",
  },
  {
    heading: "Payments",
    body:
      "Paid plans and credit packs are sold through Dodo Payments, which acts " +
      "as Merchant of Record and takes payment on its own hosted checkout. " +
      "Your card number and payment credentials go to them, never to us: we " +
      "receive the outcome of the transaction — which product was bought, " +
      "when, its status, and an identifier we can use to reconcile it with " +
      "your account. What they hold, including the billing address and tax " +
      "details their checkout requires, is governed by their privacy policy.",
  },
  {
    heading: "When you contact us",
    body:
      "If you use the contact form or email us, we process your name, email " +
      "address, the topic you chose and the message you wrote, in order to " +
      "answer you; the message reaches our support inbox through Resend. We " +
      "keep support correspondence for as long as we need it to handle the " +
      "issue and to keep a record of what was said. The form also uses your " +
      "IP address transiently to rate-limit submissions and blunt spam.",
  },
  {
    heading: "The website",
    body:
      "The website sets cookies to keep you signed in, to protect the sign-in " +
      "flow, and to remember your privacy choices. It also carries advertising " +
      "on our public articles and comparison pages — never on sign-in, account " +
      "or app-authorisation screens — and measures how the site is used. " +
      "Neither is switched on by default: until you grant the matching " +
      "purpose, Google's consent signals are all set to denied, no advertising " +
      "cookie is written, personalisation is off, and our product analytics " +
      "run without any persistent identifier. Granting ‘measure how I use " +
      "InsertGo’ turns on analytics storage; granting the marketing " +
      "purpose turns on advertising cookies and personalisation. You can " +
      "withdraw either at any time from your privacy settings, in one click. " +
      "Our hosting and infrastructure providers keep ordinary server logs — " +
      "IP address, timestamp, request path, user agent and response status — " +
      "for security, abuse prevention and debugging, under their own short " +
      "retention schedules.",
  },
  {
    heading: "What we do not do",
    body:
      "We do not sell personal data. We do not share it for cross-context " +
      "behavioural advertising unless you have granted the marketing purpose, " +
      "which is what lets Google personalise the adverts on our public " +
      "articles; withdraw it and personalisation stops. We do not use your " +
      "prompts, drafts or " +
      "generated output to train models, ours or anyone else's. We do not " +
      "read your content, except where you send it to us yourself in a " +
      "support message or where the law compels us. There is no advertising " +
      "inside the InsertGo application, and none on any signed-in page: the " +
      "adverts on our public articles are Google AdSense, and they never see " +
      "your prompts, your documents or anything you type into the app.",
  },
  {
    heading: "Who we share data with",
    body:
      "A small set of processors runs the service on our instructions: Google " +
      "for the Gemini models and, in grounded mode, Search; Vercel for " +
      "hosting the website and API; Supabase and its PostgreSQL database for " +
      "accounts, plans and usage; Upstash for the expiring caches described " +
      "above; Resend for one-time codes, support and transactional email; and " +
      "Dodo Payments for checkout. If you grant the matching purpose, PostHog " +
      "and Google Analytics receive website usage events, and Google AdSense " +
      "and Google Ads receive the advertising and conversion signals described " +
      "under ‘The website’. Each receives only what its function " +
      "needs. We may also disclose data where we are legally required to, or " +
      "where it is necessary to establish, exercise or defend legal claims, " +
      "and we may transfer account data to a successor if the business is " +
      "acquired.",
  },
  {
    heading: "Where your data is processed",
    body:
      "We operate from India, and our providers run in data centres in " +
      "several countries, including the United States and the European Union, " +
      "so your data may be processed outside the country you live in. Where " +
      "personal data belonging to people in the EEA or the UK leaves those " +
      "areas, we rely on the European Commission's Standard Contractual " +
      "Clauses with the UK Addendum where relevant, or on another lawful " +
      "transfer mechanism offered by the provider concerned.",
  },
  {
    heading: "How long we keep things",
    body:
      "Account, plan and billing records are kept while your account exists " +
      "and afterwards for as long as tax, accounting and legal-claim rules " +
      "require. Usage counters and the credit ledger are kept for the current " +
      "and recent billing periods so quotas and invoices can be reconciled. " +
      "Cached generations expire automatically, by default within twenty-four " +
      "hours. Support messages are kept for as long as resolving the matter " +
      "and keeping a record needs. Content sent through the managed AI " +
      "service is not retained beyond the request and that expiring cache. " +
      "Anything held only on your PC stays until you delete it or uninstall.",
  },
  {
    heading: "Our legal bases for processing",
    body:
      "Where the GDPR or UK GDPR applies, we process your account, plan and " +
      "in-transit content data to perform the contract you entered into when " +
      "you accepted the Terms; usage, security-log and rate-limit data for " +
      "our legitimate interest in keeping the Service working, safe and paid " +
      "for; support correspondence to answer you and to perform that " +
      "contract; and billing records to comply with legal obligations. Where " +
      "we rely on consent — for example if we ask to send you product email — " +
      "you can withdraw it at any time, without affecting what was done " +
      "beforehand. Where India's Digital Personal Data Protection Act, 2023 " +
      "applies, we process personal data for the lawful purposes described " +
      "above, on the basis of the consent you give by accepting these " +
      "documents or of the legitimate uses that Act recognises.",
  },
  {
    heading: "India: Information Technology Act disclosures",
    body:
      "This document is also the privacy policy required by Rule 4 of the " +
      "Information Technology (Reasonable Security Practices and Procedures " +
      "and Sensitive Personal Data or Information) Rules, 2011, made under " +
      "section 43A of the Information Technology Act, 2000. We collect and " +
      "process the personal information described above for the lawful " +
      "purposes connected with our functions that this policy sets out, with " +
      "the consent you give by accepting it and the Terms, and we do not " +
      "keep it longer than those purposes need. Of the categories those " +
      "Rules treat as sensitive personal data or information, the only one " +
      "in play is financial information — and it is collected and held by " +
      "Dodo Payments on its own checkout, never received or stored by us; we " +
      "do not collect passwords, health, biometric, medical or " +
      "sexual-orientation data at all. Providing your information is " +
      "voluntary and you may withdraw the consent you gave from your privacy " +
      "settings at insertgo.ai/account/privacy — one click, no email — or by " +
      "writing to the Grievance Officer named below; in either case we may " +
      "be unable to " +
      "continue providing the Service to you, which is the only consequence. " +
      "We follow reasonable security practices and procedures proportionate " +
      "to the information we hold, as described under Security below, and we " +
      "transfer personal information to the processors listed above, in " +
      "India and abroad, only where the same standard of protection is " +
      "maintained and the transfer is necessary to perform the contract with " +
      "you. We do not disclose sensitive personal data to a third party " +
      "without your consent, except to a government agency lawfully entitled " +
      "to it or where disclosure is required by law. As an intermediary " +
      "under section 79 of the Act we also observe the due-diligence and " +
      "grievance obligations of the Information Technology (Intermediary " +
      "Guidelines and Digital Media Ethics Code) Rules, 2021.",
  },
  {
    heading: "Your rights",
    body:
      "Subject to your local law, you can ask us for a copy of the personal " +
      "data we hold about you, have it corrected or deleted, restrict or " +
      "object to how we use it, take it elsewhere in a portable form, and " +
      "tell us to stop sending you marketing. In the EEA and the UK these are " +
      "GDPR rights; in India they are your rights as a Data Principal under " +
      "the DPDP Act, including the right to nominate someone to exercise them " +
      "if you die or become incapacitated; in California and comparable US " +
      "states you have equivalent rights to know, delete, correct and opt " +
      "out, and we will not treat you worse for using them. Write to " +
      "support@insertgo.ai — we will verify who you are and answer within the " +
      "period your law sets, which is one month under the GDPR unless the " +
      "request is complex. If you think we have got it wrong, you can " +
      "complain to your data protection authority: the Data Protection Board " +
      "of India, your EEA supervisory authority, or the UK Information " +
      "Commissioner's Office.",
  },
  {
    heading: "Grievance Officer (India)",
    body:
      "Complaints about how we handle your personal data, and requests to " +
      "exercise the rights above, can be sent to our Grievance Officer, " +
      `${GRIEVANCE_OFFICER.name}, at ${GRIEVANCE_OFFICER.email}; our postal ` +
      "address is available on request from that mailbox. The officer is " +
      "appointed under the Information Technology (Reasonable Security " +
      "Practices and Procedures and Sensitive Personal Data or Information) " +
      "Rules, 2011 and the Information Technology (Intermediary Guidelines " +
      "and Digital Media Ethics Code) Rules, 2021, and is our point of " +
      "contact for questions and grievances under India's Digital Personal " +
      "Data Protection Act, 2023. We acknowledge every grievance within " +
      "forty-eight hours of receiving it and aim to resolve it within one " +
      "month, and in any event within the period the applicable rules " +
      "require. If you are not satisfied with the outcome you may complain " +
      "to the Data Protection Board of India. The same officer handles " +
      "complaints under the Terms, including about charges, refunds and " +
      "cancellations.",
  },
  {
    heading: "Security",
    body:
      "Everything in transit uses TLS; secrets stay out of client-visible " +
      "code; prompt and response bodies are kept out of logs by design; " +
      "desktop sign-in requires PKCE with short-lived, single-use " +
      "authorization codes; and every request is scoped to the authenticated " +
      "account. Your session token is protected by Windows Credential " +
      "Manager on your own device rather than by us. No system is perfectly " +
      "secure — if a breach affects your personal data, we will notify you " +
      "and the relevant authority where the law requires it.",
  },
  {
    heading: "Children",
    body:
      "InsertGo is not intended for anyone under 18, and we do not knowingly " +
      "collect personal data from children. If you believe a child has given " +
      "us personal data, write to support@insertgo.ai and we will delete it.",
  },
  {
    heading: "Automated decisions",
    body:
      "We do not make decisions about you by automated means that produce " +
      "legal or similarly significant effects. AI models generate text on " +
      "your instruction; they do not profile you, and they are not used to " +
      "score, rank or judge you.",
  },
  {
    heading: "Changes to this policy",
    body:
      "We update this policy when what we do changes. A substantive change " +
      "raises the version number, the desktop application asks you to read " +
      "and accept the new version before it continues, and the current text " +
      "is always published at insertgo.ai/privacy. The version and date tell " +
      "you which text you are reading.",
  },
  {
    heading: "Contact",
    body:
      "Questions, requests and complaints about privacy go to " +
      "support@insertgo.ai. We answer every one.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-10 text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Legal
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[700px] font-serif text-[clamp(40px,6vw,64px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            Privacy Policy
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-[22px] max-w-[540px] text-[17px] leading-relaxed text-muted">
            Version {VERSION} · Effective {EFFECTIVE}. You choose each purpose
            below separately when you sign in, and can change any of them at{" "}
            <Link
              href="/account/privacy"
              className="font-medium text-brand no-underline hover:underline"
            >
              Account → Privacy
            </Link>
            . See also our{" "}
            <Link
              href="/terms"
              className="font-medium text-brand no-underline hover:underline"
            >
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </FadeUp>
      </section>

      <section className="mx-auto max-w-[760px] px-6 pt-6 pb-[110px]">
        {/*
          R-13: the itemised notice required by §5.

          The prose below is the "plain language" limb and is kept as-is. This
          table is the operative notice: §6(1) requires consent that is
          *specific*, and consent can only be specific about something itemised
          — data item → purpose → retention → recipient and country.

          It is GENERATED from `PURPOSES` in lib/consent.ts, the same array the
          consent checkboxes and /account/privacy render. That is the point: a
          hand-written table drifts from the checkboxes, and the drift is
          invisible — a purpose in the notice with no checkbox is consent nobody
          gave, and a checkbox with no notice entry is consent to something
          undisclosed. Both are §6 failures that look like working software.
        */}
        <article className="glass-panel mb-7 p-[clamp(26px,4vw,44px)]">
          <h2 className="mt-0 mb-2.5 font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink">
            What we process, and why
          </h2>
          <p className="mt-0 mb-4 text-[15px] leading-[1.75] text-muted">
            Each row is a separate choice. The two marked optional can be
            withdrawn at any time without affecting your account; withdrawing
            takes exactly one click, the same as giving it.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium text-ink">
                    Purpose
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium text-ink">
                    Data
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium text-ink">
                    Recipients (country)
                  </th>
                  <th scope="col" className="py-2 font-medium text-ink">
                    Retention
                  </th>
                </tr>
              </thead>
              <tbody>
                {PURPOSES.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top">
                    <th
                      scope="row"
                      className="py-3 pr-3 font-normal text-ink"
                    >
                      {p.label}
                      <span className="mt-0.5 block text-xs text-muted">
                        {p.required ? "Required" : "Optional"}
                      </span>
                    </th>
                    <td className="py-3 pr-3 text-muted">
                      {p.dataItems.join(", ")}
                    </td>
                    <td className="py-3 pr-3 text-muted">
                      {p.recipients.length === 0
                        ? "Not shared"
                        : p.recipients
                            .map((r) => `${r.name} (${r.country})`)
                            .join("; ")}
                    </td>
                    <td className="py-3 text-muted">
                      {p.retention}
                      {p.retentionClass === "B" && (
                        <span className="mt-0.5 block text-xs">
                          Kept after account deletion — see below.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            R-12's second-order requirement, and the reason R-13 could not be
            written before the retention classifier existed. A subject told "we
            erase everything" who then finds a retained ledger has been misled;
            one whose notice itemises the statutory-retention class has been
            informed. Discovering it in a refusal is the outcome this paragraph
            exists to prevent.
          */}
          <h3 className="mt-6 mb-2 font-serif text-[16px] font-semibold text-ink">
            What survives deleting your account
          </h3>
          <p className="m-0 text-[15px] leading-[1.75] text-muted">
            When you delete your account we erase your name, email address,
            profile image, sign-in records and usage history, and we keep the{" "}
            <em>account row itself</em> only as an anonymous identifier so the
            records below stay meaningful. Two categories are retained because
            the law requires it and we are not permitted to delete them on
            request: <strong>billing ledger entries</strong>, which are books of
            account under the Companies Act, GST and income-tax rules; and{" "}
            <strong>security logs</strong>, which CERT-In Direction 4 requires us
            to hold for a rolling 180 days. We also keep your{" "}
            <strong>consent history</strong> — that is the evidence that we
            asked properly, and deleting it on request would destroy the only
            proof that your rights were respected. All three keep an account
            identifier and never your name or address again.
          </p>
        </article>

        <article className="glass-panel flex flex-col gap-7 p-[clamp(26px,4vw,44px)]">
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="mt-0 mb-2.5 font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink">
                {s.heading}
              </h2>
              <p className="m-0 text-[15px] leading-[1.75] text-muted">
                {s.body}
              </p>
            </div>
          ))}
        </article>

        <p className="mt-8 text-center text-[13px] text-muted">
          Questions?{" "}
          <Link
            href="/contact"
            className="font-medium text-brand no-underline hover:underline"
          >
            Contact us
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
