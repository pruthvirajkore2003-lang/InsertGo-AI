import type { Metadata } from "next";
import Link from "next/link";
import { FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { NOTICE_VERSION } from "@/lib/consent";

/**
 * Canonical Terms & Conditions. The identical text is mirrored inside the
 * Windows app (Insert-Go Windows/src/legal/index.ts) so it stays readable
 * offline.
 *
 * The two copies are hand-kept: edit BOTH, and bump LEGAL_VERSION in the app,
 * or it records consent to wording this page no longer states.
 *
 * R-15 (2026-08-08): BYOK — user-supplied API keys and local models — is a
 * decided NON-feature. Section 9 states that; do not reintroduce a clause
 * describing a lane that does not exist.
 */

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms you accept when you install and use InsertGo for Windows — " +
    "licence, plans and credits, billing and refunds, acceptable use, and " +
    "liability. The identical text ships inside the app.",
  alternates: { canonical: "/terms" },
};

/** One version string across Terms, Privacy and the desktop mirror. When these
 *  were separate constants the three drifted, and a consent row named a version
 *  no page could still render. */
const VERSION = NOTICE_VERSION;
const EFFECTIVE = "8 August 2026";

/** Appointed under the Consumer Protection (E-Commerce) Rules, 2020 and the
 *  IT (Intermediary Guidelines) Rules, 2021. The mailbox is live; the name is
 *  a placeholder — fill it in HERE and in the app's legal/index.ts mirror. */
const GRIEVANCE_OFFICER = {
  name: "[Name to be appointed]",
  email: "grievance@insertgo.ai",
};

const sections: Array<{ heading: string; body: string }> = [
  {
    heading: "1. Who we are and what these terms cover",
    body:
      "InsertGo.AI (\"InsertGo\", \"we\", \"us\") operates the InsertGo desktop " +
      "application for Windows, the insertgo.ai website, and the accounts, " +
      "licensing and AI services behind them (together, the \"Service\"). These " +
      "Terms & Conditions form a binding agreement between you and " +
      "InsertGo.AI, and they apply every time you install, launch or use the " +
      "Service. If you do not accept them, do not use the Service. You are " +
      "asked to accept them, and to choose your privacy purposes, when you " +
      `sign in to your InsertGo account. This version, ${VERSION}, takes ` +
      `effect on ${EFFECTIVE} and replaces every ` +
      "earlier version. Our Privacy Policy is part of this agreement and is " +
      "incorporated by reference; the current text of both is always " +
      "published at insertgo.ai/terms and insertgo.ai/privacy.",
  },
  {
    heading: "2. What InsertGo does",
    body:
      "InsertGo is a Windows desktop application that improves and generates " +
      "text where you are already working. When you press its global hotkey, " +
      "it reads the text in the field you are focused on, or the text you " +
      "have selected, sends that text to an AI model together with the " +
      "instruction you chose, and writes the result back into the same place. " +
      "It never presses Enter, submits a form, or sends a message on your " +
      "behalf, and it replaces only the text it read — the undo hotkey " +
      "restores the previous contents. Features described on the website or " +
      "inside the application may change as the product develops.",
  },
  {
    heading: "3. Eligibility and your account",
    body:
      "You must be at least 18 years old and legally able to enter into a " +
      "contract to use the Service. Accounts are created with a one-time " +
      "email code, a Google sign-in, or an enterprise SSO provider — we do " +
      "not use passwords. You are responsible for everything done through " +
      "your account and for keeping your email and sign-in provider secure; " +
      "write to support@insertgo.ai as soon as you believe your account has " +
      "been used without your permission. One account is for one person: do " +
      "not share access, and do not create accounts by automated means or to " +
      "evade limits, suspensions or free-plan quotas.",
  },
  {
    heading: "4. The licence you get",
    body:
      "Subject to these terms, and to payment where a paid plan applies, we " +
      "grant you a personal, non-exclusive, non-transferable, revocable " +
      "licence to install and use InsertGo on Windows devices you own or " +
      "control, for your own use — or, on a team purchase, for the number of " +
      "named users bought. You may not resell, rent, lend, sublicense, " +
      "publish or redistribute the application; you may not modify, " +
      "decompile, disassemble or reverse engineer it, except where applicable " +
      "law expressly permits that despite this restriction; you may not " +
      "remove, disable or work around its licensing, entitlement or quota " +
      "checks; and you may not use it to build a competing product. Every " +
      "right not expressly granted here is reserved.",
  },
  {
    heading: "5. Plans, credits, and what you are buying",
    body:
      "The Service is offered on a free plan and on paid Plus and Pro " +
      "subscriptions, each carrying an allowance of generation credits that " +
      "resets daily, plus optional credit packs that do not expire. A credit " +
      "is an internal unit of account for use of our managed AI service. It " +
      "is not money, carries no cash value, cannot be transferred between " +
      "accounts, and is redeemable only as use of the Service. Daily credits " +
      "do not roll over; purchased pack credits stay on your account and are " +
      "spent after the day's allowance is used. The plan contents, allowances " +
      "and prices that apply to you are the ones published at " +
      "insertgo.ai/pricing when you buy, and we may change them for future " +
      "billing periods with notice.",
  },
  {
    heading: "6. Billing, renewal and cancellation",
    body:
      "Paid plans and credit packs are sold and billed through Dodo Payments, " +
      "our payment processor and Merchant of Record for the transaction. " +
      "Their hosted checkout collects and processes your payment details and " +
      "calculates the tax for your country; we never receive or store your " +
      "card number. The prices shown on insertgo.ai/pricing and inside the " +
      "application exclude tax: the tax that applies where you are — Indian " +
      "GST, EU or UK VAT, US sales tax and the like — is calculated and added " +
      "at that checkout before you confirm, and the total shown there is what " +
      "you pay. Subscriptions renew automatically each month at the " +
      "then-current price until you cancel. Cancellation takes effect at the " +
      "end of the period you have already paid for: you keep paid features " +
      "until then, after which the account returns to the free plan. Credit " +
      "packs are one-off charges. If a payment fails, is reversed or is " +
      "charged back, we may suspend paid features until it is settled.",
  },
  {
    heading: "7. Refund and cancellation policy",
    body:
      "InsertGo sells digital goods that are delivered instantly: a " +
      "subscription is active, and pack credits are on your account, the " +
      "moment payment succeeds. There is nothing to ship, return or exchange. " +
      "Cancellation: you may cancel a subscription at any time, from your " +
      "account or by writing to support@insertgo.ai, at no cancellation fee; " +
      "it stops the next renewal and takes effect at the end of the period " +
      "you have already paid for. Refunds: if you have not consumed any " +
      "credits under a charge, write to us within seven days of that charge " +
      "and we will refund it in full. Once credits have been used, the " +
      "credits consumed and the subscription period already served are not " +
      "refundable, because the service they paid for has been supplied. We " +
      "refund in every case a duplicate or mistaken charge, a charge for " +
      "something we failed to supply, and the unused portion of a prepaid " +
      "period if we discontinue a paid plan. Approved refunds are issued by " +
      "Dodo Payments as Merchant of Record to the original payment method, " +
      "normally within five to seven business days of approval, after which " +
      "your bank or card issuer may take a few days more to post it. Where " +
      "the law gives you a statutory right to cancel a distance purchase — " +
      "such as the fourteen-day withdrawal right for consumers in the EU, EEA " +
      "and UK — that right applies in addition to this policy, although it " +
      "may end once digital content has been supplied with your express " +
      "consent. Send refund and cancellation requests to " +
      "support@insertgo.ai; if you are not satisfied with the outcome, the " +
      "grievance procedure in section 23 is open to you.",
  },
  {
    heading: "8. Free plan and fair use",
    body:
      "The free plan and any trial allowance exist so you can evaluate the " +
      "Service; they end automatically and never convert into a paid plan " +
      "without a purchase made by you. Every plan is subject to fair-use " +
      "protections — request rate limits, payload size limits and abuse " +
      "detection — that keep the Service available for everyone. We may " +
      "reduce, throttle or withdraw free access, and may refuse requests that " +
      "are abusive, automated at machine scale, or aimed at extracting or " +
      "replicating the underlying model rather than using the product.",
  },
  {
    heading: "9. One managed AI service",
    body:
      "Every AI feature in InsertGo runs through our managed service. You " +
      "cannot configure the product with your own API key for a third-party " +
      "provider, and you cannot point it at a model running on your own " +
      "machine: both were considered and are not features of InsertGo. The " +
      "practical consequences are that your AI usage is always metered " +
      "against the plan and credits described in section 5, that the desktop " +
      "application holds no AI provider key, and that we — not you — are the " +
      "customer of the model provider. If we ever add a route that sends your " +
      "text anywhere other than through our service, it will be described " +
      "here and in the Privacy Policy before it ships, not after.",
  },
  {
    heading: "10. AI output carries no guarantee",
    body:
      "Everything InsertGo writes back is generated by a language model. It " +
      "can be wrong, biased, out of date, offensive or unsuitable for your " +
      "purpose, and it may resemble output produced for other people. We do " +
      "not verify it. You must read what has been inserted before you send, " +
      "publish, submit or rely on it, and you must not treat it as a " +
      "substitute for professional advice, legal, medical, financial or " +
      "otherwise. Because InsertGo replaces the entire contents of the field " +
      "it read, check the result before moving on; the undo hotkey restores " +
      "the previous text.",
  },
  {
    heading: "11. Reading and writing text on your device",
    body:
      "To do its job, InsertGo uses Windows accessibility interfaces to read " +
      "the focused field or current selection at the moment you invoke it, " +
      "and writes the result back the same way, falling back to the clipboard " +
      "— saving and restoring your existing clipboard contents — when direct " +
      "insertion is not possible. It refuses password and credential fields, " +
      "and it reads only from applications within the scope you allow in " +
      "Settings. What you point it at is your responsibility: do not invoke " +
      "it on text you are not permitted to disclose to an AI provider, " +
      "including other people's confidential information, regulated personal " +
      "data, or material covered by a duty of confidence.",
  },
  {
    heading: "12. Acceptable use",
    body:
      "You agree not to use the Service to break any law or regulation; to " +
      "create or distribute malware, spam, phishing or fraudulent content; to " +
      "harass, threaten, defame or sexualise any person, or to generate " +
      "sexual content involving minors; to impersonate a person or " +
      "organisation, or to present AI-generated text as someone else's work " +
      "where that would deceive; to infringe intellectual property or " +
      "misappropriate trade secrets; to process personal data you have no " +
      "lawful basis to process; to capture text from applications belonging " +
      "to other people without their knowledge; or to probe, overload, or " +
      "circumvent the security, quotas and rate limits of the Service or of " +
      "any provider behind it. We may investigate suspected misuse and " +
      "cooperate with lawful requests from authorities.",
  },
  {
    heading: "13. Your content",
    body:
      "You keep every right you have in the text you send through InsertGo " +
      "and in the output you receive, so far as that output is capable of " +
      "ownership at all. You grant us only the limited licence needed to run " +
      "the Service on your instruction: to transmit your text to the model " +
      "provider, generate a response, return it to you, and hold it briefly " +
      "in the operational caches described in the Privacy Policy. We do not " +
      "use your prompts or outputs to train models, we do not sell them, and " +
      "we do not read them except in the narrow cases set out in the Privacy " +
      "Policy. Having the rights to the text you submit is your " +
      "responsibility.",
  },
  {
    heading: "14. Our intellectual property",
    body:
      "InsertGo — its software, interface, bundled prompt templates and " +
      "skills, documentation, name and logo — belongs to us or our licensors " +
      "and is protected by copyright, trade mark and other laws. These terms " +
      "license the application to you; they do not transfer ownership of any " +
      "part of it. Feedback and suggestions you send us may be used freely to " +
      "improve the Service, without obligation, compensation or any claim by " +
      "you to what we build with them.",
  },
  {
    heading: "15. Availability, support and changes to the Service",
    body:
      "We aim to keep the Service available, but we do not promise " +
      "uninterrupted or error-free operation: it depends on your device, your " +
      "network and third-party providers, and it may be interrupted for " +
      "maintenance, capacity or security. We may add, change or remove " +
      "features, and may discontinue the Service or a plan; if we discontinue " +
      "a paid plan we will give reasonable notice and refund the unused " +
      "portion of any prepaid period. Support is provided by email at " +
      "support@insertgo.ai on a commercially reasonable basis.",
  },
  {
    heading: "16. Third-party services",
    body:
      "The Service depends on third parties: Google's Gemini models power the " +
      "managed AI service and, for grounded requests, Google Search supplies " +
      "public findings; Dodo Payments handles checkout and billing; sign-in " +
      "can run through Google or your organisation's SSO provider; and " +
      "hosting, database, email and caching providers run the infrastructure. " +
      "Their availability, terms and policies are outside our control, and we " +
      "are not responsible for their acts or omissions. You have no contract " +
      "with the model provider: we do, and section 9 explains why that cannot " +
      "be swapped for one of your own.",
  },
  {
    heading: "17. Disclaimer of warranties",
    body:
      "To the fullest extent permitted by law, the Service is provided \"as " +
      "is\" and \"as available\", without warranties of any kind, express or " +
      "implied, including implied warranties of merchantability, fitness for " +
      "a particular purpose, accuracy, title and non-infringement. We do not " +
      "warrant that the Service will meet your requirements, that AI output " +
      "will be accurate or fit for your purpose, that defects will be " +
      "corrected, or that reading and insertion will succeed in every " +
      "application. Some jurisdictions do not allow certain warranties to be " +
      "excluded, so parts of this section may not apply to you, and nothing " +
      "here affects rights that consumers cannot waive.",
  },
  {
    heading: "18. Limitation of liability",
    body:
      "To the fullest extent permitted by law, we are not liable for " +
      "indirect, incidental, special, consequential, exemplary or punitive " +
      "damages, nor for lost profits, revenue, business or goodwill, nor for " +
      "lost, corrupted or overwritten data or work product, arising out of or " +
      "relating to the Service, whether the claim is framed in contract, tort " +
      "including negligence, or otherwise, and even if we were told such loss " +
      "was possible. Our total aggregate liability for all claims arising in " +
      "any twelve-month period is limited to the greater of what you actually " +
      "paid us for the Service in the twelve months before the event giving " +
      "rise to the claim, or fifty United States dollars. Nothing in these " +
      "terms excludes or limits liability for death or personal injury caused " +
      "by negligence, for fraud or fraudulent misrepresentation, or for " +
      "anything else that cannot lawfully be excluded, including the " +
      "statutory rights of consumers.",
  },
  {
    heading: "19. Indemnity",
    body:
      "If you use the Service in a business or professional capacity, you " +
      "agree to indemnify us and hold us harmless against claims, damages, " +
      "losses and reasonable legal costs arising from your breach of these " +
      "terms, your misuse of the Service, the text you submit, or your use of " +
      "output in a way that infringes someone's rights or breaks the law. " +
      "This section does not apply to consumers acting outside a trade, " +
      "business or profession, to the extent applicable law says it cannot.",
  },
  {
    heading: "20. Suspension and termination",
    body:
      "You may stop using InsertGo and uninstall it at any time; uninstalling " +
      "removes the application's local data from that device, and you can ask " +
      "us to delete your account by writing to support@insertgo.ai. We may " +
      "suspend or terminate your access, with notice where practicable, if " +
      "you breach these terms, if your use puts the Service, another user or " +
      "a provider at risk, if payment fails, or if the law requires it. On " +
      "termination your licence ends immediately and you must stop using the " +
      "application. The sections that by their nature should outlive the " +
      "agreement — licence restrictions, your content, our intellectual " +
      "property, disclaimers, limitation of liability, indemnity, and " +
      "governing law — survive it.",
  },
  {
    heading: "21. Changes to these terms",
    body:
      "We may revise these terms. A substantive revision raises the version " +
      "number, and the desktop application will ask you to read and accept " +
      "the new version before it continues, so what you agreed to, and when, " +
      "is always recorded. Revisions take effect for the desktop application " +
      "on acceptance, and for the website when published there. If you do not " +
      "accept a new version, your remedy is to stop using the Service; where " +
      "you have prepaid for a period, you may ask us to refund the unused " +
      "part of it.",
  },
  {
    heading: "22. Governing law and disputes",
    body:
      "These terms, and any dispute arising out of them or out of the " +
      "Service, are governed by the laws of India without regard to " +
      "conflict-of-law rules, and the competent courts in India have " +
      "exclusive jurisdiction. If you are a consumer resident elsewhere, you " +
      "keep the benefit of any mandatory protections of your local law, and " +
      "any right that law gives you to bring proceedings in the courts of " +
      "your country of residence. Before filing anything, please write to " +
      "support@insertgo.ai: nearly everything is resolved in a single email.",
  },
  {
    heading: "23. Grievance redressal (India)",
    body:
      "As required by the Consumer Protection (E-Commerce) Rules, 2020 and " +
      "the Information Technology (Intermediary Guidelines and Digital Media " +
      "Ethics Code) Rules, 2021, we have appointed a Grievance Officer to " +
      `receive complaints about the Service, about a charge, refund or ` +
      `cancellation, about content, or about anything in these terms or the ` +
      `Privacy Policy: ${GRIEVANCE_OFFICER.name}, Grievance Officer, ` +
      `InsertGo.AI, reachable at ${GRIEVANCE_OFFICER.email}; our postal ` +
      "address is available on request from that mailbox. Tell us your name, " +
      "the email your account uses, what happened and what you would like " +
      "done. We acknowledge every complaint within forty-eight hours of " +
      "receiving it and aim to resolve it within one month, and in any event " +
      "within the period the applicable rules require. The same officer is " +
      "the point of contact for questions and grievances about personal data " +
      "under India's Digital Personal Data Protection Act, 2023. If you are " +
      "not satisfied with the outcome, you may escalate to the Data " +
      "Protection Board of India, and nothing in this section limits your " +
      "right to approach a consumer forum, the National Consumer Helpline, " +
      "or any other authority directly.",
  },
  {
    heading: "24. General",
    body:
      "These terms, with the Privacy Policy and any plan or purchase terms " +
      "shown at checkout, are the entire agreement between us about the " +
      "Service and replace any earlier understanding. If a provision is held " +
      "unenforceable, the rest stays in force and that provision is read down " +
      "to the minimum extent needed to make it valid. A failure to enforce a " +
      "right is not a waiver of it. You may not assign your rights under " +
      "these terms without our consent; we may assign ours to a successor in " +
      "a merger, acquisition or sale of assets. There are no third-party " +
      "beneficiaries. Questions about these terms go to support@insertgo.ai.",
  },
];

export default function TermsPage() {
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
            Terms &amp; Conditions
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-[22px] max-w-[540px] text-[17px] leading-relaxed text-muted">
            Version {VERSION} · Effective {EFFECTIVE}. The same text is
            mirrored inside the Windows app; you accept it at sign-in. See also
            our{" "}
            <Link
              href="/privacy"
              className="font-medium text-brand no-underline hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </FadeUp>
      </section>

      <section className="mx-auto max-w-[760px] px-6 pt-6 pb-[110px]">
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
