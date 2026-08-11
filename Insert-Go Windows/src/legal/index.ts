/**
 * Offline mirror of the Terms & Privacy text published at insertgo.ai/terms and
 * insertgo.ai/privacy (Insert-Go Website/app/terms and app/privacy). The two
 * copies are hand-kept — edit BOTH or they drift.
 *
 * STATUS (R-09, restated 2026-08-08): **nothing in the app imports this module.**
 * Consent is collected on the website at sign-in, against `NOTICE_VERSION`; the
 * desktop consent screen this was written for was removed with the old setup
 * flow, so `acceptedTermsVersion` is never written and `needsConsent()` has no
 * caller. Kept as the offline copy the policies say ships with the app — but it
 * is unreferenced code, which is exactly how it came to describe a BYOK feature
 * that does not exist (R-15). Anything asserted here must be re-verified against
 * the website copy, not trusted because it is in the repo.
 *
 * Bump `LEGAL_VERSION` on any substantive edit, together with the website's
 * `NOTICE_VERSION` — they are one document set with two homes.
 */

/** Version pinned into settings when the user accepts. Semver: bump minor+
 *  for substantive changes, patch for typo fixes that don't change meaning.
 *
 *  Mirrors `NOTICE_VERSION` in the website's `lib/consent.ts` — the two are
 *  hand-kept and must move together, or a consent row names text one side can
 *  no longer render.
 *
 *  1.3.0 (2026-08-08, R-15): every claim that InsertGo supports a user-supplied
 *  API key or a local model was removed. BYOK is a decided non-feature, and
 *  both documents had described it as though it shipped. */
export const LEGAL_VERSION = "1.3.0";

/** Effective date rendered in both documents. Kept beside the version because
 *  they only ever change together. */
export const LEGAL_EFFECTIVE = "8 August 2026";

/** Appointed under the Consumer Protection (E-Commerce) Rules, 2020 and the
 *  IT (Intermediary Guidelines) Rules, 2021. The mailbox is live; the name is
 *  a placeholder — fill it in HERE and in the website's terms and privacy
 *  pages, which carry the identical text. */
const GRIEVANCE_OFFICER = {
  name: "[Name to be appointed]",
  email: "grievance@insertgo.ai",
};

/** Consent checkbox label. Single source — the store's gate, the UI's label
 *  and the test all read this constant, so the version can never drift
 *  between what was shown and what was recorded. */
export const CONSENT_LABEL =
  `I accept the Terms & Conditions and Privacy Policy v${LEGAL_VERSION}`;

/** True when the user has not accepted the currently shipped version. */
export function needsConsent(acceptedVersion: string | null): boolean {
  return acceptedVersion !== LEGAL_VERSION;
}

export type LegalDocument = {
  id: "terms" | "privacy";
  title: string;
  /** Section heading + body paragraphs, rendered into a scrollable region. */
  sections: Array<{ heading: string; body: string }>;
};

export const TERMS: LegalDocument = {
  id: "terms",
  title: "Terms & Conditions",
  sections: [
    {
      heading: "1. Who we are and what these terms cover",
      body:
        "InsertGo.AI (\"InsertGo\", \"we\", \"us\") operates the InsertGo desktop " +
        "application for Windows, the insertgo.ai website, and the accounts, " +
        "licensing and AI services behind them (together, the \"Service\"). " +
        "These Terms & Conditions form a binding agreement between you and " +
        "InsertGo.AI, and they apply every time you install, launch or use " +
        "the Service. If you do not accept them, do not use the Service. You " +
        "are asked to accept them, and to choose your privacy purposes, when " +
        `you sign in to your InsertGo account. This version, ${LEGAL_VERSION}, ` +
        `takes effect on ${LEGAL_EFFECTIVE} and replaces ` +
        "every earlier version. Our Privacy Policy is part of this agreement " +
        "and is incorporated by reference; the current text of both is always " +
        "published at insertgo.ai/terms and insertgo.ai/privacy.",
    },
    {
      heading: "2. What InsertGo does",
      body:
        "InsertGo is a Windows desktop application that improves and " +
        "generates text where you are already working. When you press its " +
        "global hotkey, it reads the text in the field you are focused on, or " +
        "the text you have selected, sends that text to an AI model together " +
        "with the instruction you chose, and writes the result back into the " +
        "same place. It never presses Enter, submits a form, or sends a " +
        "message on your behalf, and it replaces only the text it read — the " +
        "undo hotkey restores the previous contents. Features described on " +
        "the website or inside the application may change as the product " +
        "develops.",
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
        "not share access, and do not create accounts by automated means or " +
        "to evade limits, suspensions or free-plan quotas.",
    },
    {
      heading: "4. The licence you get",
      body:
        "Subject to these terms, and to payment where a paid plan applies, we " +
        "grant you a personal, non-exclusive, non-transferable, revocable " +
        "licence to install and use InsertGo on Windows devices you own or " +
        "control, for your own use — or, on a team purchase, for the number " +
        "of named users bought. You may not resell, rent, lend, sublicense, " +
        "publish or redistribute the application; you may not modify, " +
        "decompile, disassemble or reverse engineer it, except where " +
        "applicable law expressly permits that despite this restriction; you " +
        "may not remove, disable or work around its licensing, entitlement or " +
        "quota checks; and you may not use it to build a competing product. " +
        "Every right not expressly granted here is reserved.",
    },
    {
      heading: "5. Plans, credits, and what you are buying",
      body:
        "The Service is offered on a free plan and on paid Plus and Pro " +
        "subscriptions, each carrying an allowance of generation credits that " +
        "resets daily, plus optional credit packs that do not expire. A " +
        "credit is an internal unit of account for use of our managed AI " +
        "service. It is not money, carries no cash value, cannot be " +
        "transferred between accounts, and is redeemable only as use of the " +
        "Service. Daily credits do not roll over; purchased pack credits stay " +
        "on your account and are spent after the day's allowance is used. The " +
        "plan contents, allowances and prices that apply to you are the ones " +
        "published at insertgo.ai/pricing when you buy, and we may change " +
        "them for future billing periods with notice.",
    },
    {
      heading: "6. Billing, renewal and cancellation",
      body:
        "Paid plans and credit packs are sold and billed through Dodo " +
        "Payments, our payment processor and Merchant of Record for the " +
        "transaction. Their hosted checkout collects and processes your " +
        "payment details and calculates the tax for your country; we never " +
        "receive or store your card number. The prices shown on " +
        "insertgo.ai/pricing and inside the application exclude tax: the tax " +
        "that applies where you are — Indian GST, EU or UK VAT, US sales tax " +
        "and the like — is calculated and added at that checkout before you " +
        "confirm, and the total shown there is what you pay. " +
        "Subscriptions renew automatically " +
        "each month at the then-current price until you cancel. Cancellation " +
        "takes effect at the end of the period you have already paid for: you " +
        "keep paid features until then, after which the account returns to " +
        "the free plan. Credit packs are one-off charges. If a payment fails, " +
        "is reversed or is charged back, we may suspend paid features until " +
        "it is settled.",
    },
    {
      heading: "7. Refund and cancellation policy",
      body:
        "InsertGo sells digital goods that are delivered instantly: a " +
        "subscription is active, and pack credits are on your account, the " +
        "moment payment succeeds. There is nothing to ship, return or " +
        "exchange. Cancellation: you may cancel a subscription at any time, " +
        "from your account or by writing to support@insertgo.ai, at no " +
        "cancellation fee; it stops the next renewal and takes effect at the " +
        "end of the period you have already paid for. Refunds: if you have " +
        "not consumed any credits under a charge, write to us within seven " +
        "days of that charge and we will refund it in full. Once credits have " +
        "been used, the credits consumed and the subscription period already " +
        "served are not refundable, because the service they paid for has " +
        "been supplied. We refund in every case a duplicate or mistaken " +
        "charge, a charge for something we failed to supply, and the unused " +
        "portion of a prepaid period if we discontinue a paid plan. Approved " +
        "refunds are issued by Dodo Payments as Merchant of Record to the " +
        "original payment method, normally within five to seven business days " +
        "of approval, after which your bank or card issuer may take a few " +
        "days more to post it. Where the law gives you a statutory right to " +
        "cancel a distance purchase — such as the fourteen-day withdrawal " +
        "right for consumers in the EU, EEA and UK — that right applies in " +
        "addition to this policy, although it may end once digital content " +
        "has been supplied with your express consent. Send refund and " +
        "cancellation requests to support@insertgo.ai; if you are not " +
        "satisfied with the outcome, the grievance procedure in section 23 is " +
        "open to you.",
    },
    {
      heading: "8. Free plan and fair use",
      body:
        "The free plan and any trial allowance exist so you can evaluate the " +
        "Service; they end automatically and never convert into a paid plan " +
        "without a purchase made by you. Every plan is subject to fair-use " +
        "protections — request rate limits, payload size limits and abuse " +
        "detection — that keep the Service available for everyone. We may " +
        "reduce, throttle or withdraw free access, and may refuse requests " +
        "that are abusive, automated at machine scale, or aimed at extracting " +
        "or replicating the underlying model rather than using the product.",
    },
    {
      heading: "9. One managed AI service",
      body:
        "Every AI feature in InsertGo runs through our managed service. You " +
        "cannot configure the product with your own API key for a " +
        "third-party provider, and you cannot point it at a model running on " +
        "your own machine: both were considered and are not features of " +
        "InsertGo. The practical consequences are that your AI usage is " +
        "always metered against the plan and credits described in section 5, " +
        "that the desktop application holds no AI provider key, and that we " +
        "— not you — are the customer of the model provider. If we ever add " +
        "a route that sends your text anywhere other than through our " +
        "service, it will be described here and in the Privacy Policy before " +
        "it ships, not after.",
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
        "otherwise. Because InsertGo replaces the entire contents of the " +
        "field it read, check the result before moving on; the undo hotkey " +
        "restores the previous text.",
    },
    {
      heading: "11. Reading and writing text on your device",
      body:
        "To do its job, InsertGo uses Windows accessibility interfaces to " +
        "read the focused field or current selection at the moment you invoke " +
        "it, and writes the result back the same way, falling back to the " +
        "clipboard — saving and restoring your existing clipboard contents — " +
        "when direct insertion is not possible. It refuses password and " +
        "credential fields, and it reads only from applications within the " +
        "scope you allow in Settings. What you point it at is your " +
        "responsibility: do not invoke it on text you are not permitted to " +
        "disclose to an AI provider, including other people's confidential " +
        "information, regulated personal data, or material covered by a duty " +
        "of confidence.",
    },
    {
      heading: "12. Acceptable use",
      body:
        "You agree not to use the Service to break any law or regulation; to " +
        "create or distribute malware, spam, phishing or fraudulent content; " +
        "to harass, threaten, defame or sexualise any person, or to generate " +
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
        "ownership at all. You grant us only the limited licence needed to " +
        "run the Service on your instruction: to transmit your text to the " +
        "model provider, generate a response, return it to you, and hold it " +
        "briefly in the operational caches described in the Privacy Policy. " +
        "We do not use your prompts or outputs to train models, we do not " +
        "sell them, and we do not read them except in the narrow cases set " +
        "out in the Privacy Policy. Having the rights to the text you submit " +
        "is your responsibility.",
    },
    {
      heading: "14. Our intellectual property",
      body:
        "InsertGo — its software, interface, bundled prompt templates and " +
        "skills, documentation, name and logo — belongs to us or our " +
        "licensors and is protected by copyright, trade mark and other laws. " +
        "These terms license the application to you; they do not transfer " +
        "ownership of any part of it. Feedback and suggestions you send us " +
        "may be used freely to improve the Service, without obligation, " +
        "compensation or any claim by you to what we build with them.",
    },
    {
      heading: "15. Availability, support and changes to the Service",
      body:
        "We aim to keep the Service available, but we do not promise " +
        "uninterrupted or error-free operation: it depends on your device, " +
        "your network and third-party providers, and it may be interrupted " +
        "for maintenance, capacity or security. We may add, change or remove " +
        "features, and may discontinue the Service or a plan; if we " +
        "discontinue a paid plan we will give reasonable notice and refund " +
        "the unused portion of any prepaid period. Support is provided by " +
        "email at support@insertgo.ai on a commercially reasonable basis.",
    },
    {
      heading: "16. Third-party services",
      body:
        "The Service depends on third parties: Google's Gemini models power " +
        "the managed AI service and, for grounded requests, Google Search " +
        "supplies public findings; Dodo Payments handles checkout and " +
        "billing; sign-in can run through Google or your organisation's SSO " +
        "provider; and hosting, database, email and caching providers run the " +
        "infrastructure. Their availability, terms and policies are outside " +
        "our control, and we are not responsible for their acts or omissions. " +
        "If you use your own provider key, that provider is your " +
        "counterparty, not ours.",
    },
    {
      heading: "17. Disclaimer of warranties",
      body:
        "To the fullest extent permitted by law, the Service is provided \"as " +
        "is\" and \"as available\", without warranties of any kind, express or " +
        "implied, including implied warranties of merchantability, fitness " +
        "for a particular purpose, accuracy, title and non-infringement. We " +
        "do not warrant that the Service will meet your requirements, that AI " +
        "output will be accurate or fit for your purpose, that defects will " +
        "be corrected, or that reading and insertion will succeed in every " +
        "application. Some jurisdictions do not allow certain warranties to " +
        "be excluded, so parts of this section may not apply to you, and " +
        "nothing here affects rights that consumers cannot waive.",
    },
    {
      heading: "18. Limitation of liability",
      body:
        "To the fullest extent permitted by law, we are not liable for " +
        "indirect, incidental, special, consequential, exemplary or punitive " +
        "damages, nor for lost profits, revenue, business or goodwill, nor " +
        "for lost, corrupted or overwritten data or work product, arising out " +
        "of or relating to the Service, whether the claim is framed in " +
        "contract, tort including negligence, or otherwise, and even if we " +
        "were told such loss was possible. Our total aggregate liability for " +
        "all claims arising in any twelve-month period is limited to the " +
        "greater of what you actually paid us for the Service in the twelve " +
        "months before the event giving rise to the claim, or fifty United " +
        "States dollars. Nothing in these terms excludes or limits liability " +
        "for death or personal injury caused by negligence, for fraud or " +
        "fraudulent misrepresentation, or for anything else that cannot " +
        "lawfully be excluded, including the statutory rights of consumers.",
    },
    {
      heading: "19. Indemnity",
      body:
        "If you use the Service in a business or professional capacity, you " +
        "agree to indemnify us and hold us harmless against claims, damages, " +
        "losses and reasonable legal costs arising from your breach of these " +
        "terms, your misuse of the Service, the text you submit, or your use " +
        "of output in a way that infringes someone's rights or breaks the " +
        "law. This section does not apply to consumers acting outside a " +
        "trade, business or profession, to the extent applicable law says it " +
        "cannot.",
    },
    {
      heading: "20. Suspension and termination",
      body:
        "You may stop using InsertGo and uninstall it at any time; " +
        "uninstalling removes the application's local data from that device, " +
        "and you can ask us to delete your account by writing to " +
        "support@insertgo.ai. We may suspend or terminate your access, with " +
        "notice where practicable, if you breach these terms, if your use " +
        "puts the Service, another user or a provider at risk, if payment " +
        "fails, or if the law requires it. On termination your licence ends " +
        "immediately and you must stop using the application. The sections " +
        "that by their nature should outlive the agreement — licence " +
        "restrictions, your content, our intellectual property, disclaimers, " +
        "limitation of liability, indemnity, and governing law — survive it.",
    },
    {
      heading: "21. Changes to these terms",
      body:
        "We may revise these terms. A substantive revision raises the version " +
        "number, and the desktop application will ask you to read and accept " +
        "the new version before it continues, so what you agreed to, and " +
        "when, is always recorded. Revisions take effect for the desktop " +
        "application on acceptance, and for the website when published there. " +
        "If you do not accept a new version, your remedy is to stop using the " +
        "Service; where you have prepaid for a period, you may ask us to " +
        "refund the unused part of it.",
    },
    {
      heading: "22. Governing law and disputes",
      body:
        "These terms, and any dispute arising out of them or out of the " +
        "Service, are governed by the laws of India without regard to " +
        "conflict-of-law rules, and the competent courts in India have " +
        "exclusive jurisdiction. If you are a consumer resident elsewhere, " +
        "you keep the benefit of any mandatory protections of your local law, " +
        "and any right that law gives you to bring proceedings in the courts " +
        "of your country of residence. Before filing anything, please write " +
        "to support@insertgo.ai: nearly everything is resolved in a single " +
        "email.",
    },
    {
      heading: "23. Grievance redressal (India)",
      body:
        "As required by the Consumer Protection (E-Commerce) Rules, 2020 and " +
        "the Information Technology (Intermediary Guidelines and Digital " +
        "Media Ethics Code) Rules, 2021, we have appointed a Grievance " +
        "Officer to receive complaints about the Service, about a charge, " +
        "refund or cancellation, about content, or about anything in these " +
        `terms or the Privacy Policy: ${GRIEVANCE_OFFICER.name}, Grievance ` +
        `Officer, InsertGo.AI, reachable at ${GRIEVANCE_OFFICER.email}; our ` +
        "postal address is available on request from that mailbox. Tell us " +
        "your name, the email your account uses, what happened and what you " +
        "would like done. We acknowledge every complaint within forty-eight " +
        "hours of receiving it and aim to resolve it within one month, and in " +
        "any event within the period the applicable rules require. The same " +
        "officer is the point of contact for questions and grievances about " +
        "personal data under India's Digital Personal Data Protection Act, " +
        "2023. If you are not satisfied with the outcome, you may escalate to " +
        "the Data Protection Board of India, and nothing in this section " +
        "limits your right to approach a consumer forum, the National " +
        "Consumer Helpline, or any other authority directly.",
    },
    {
      heading: "24. General",
      body:
        "These terms, with the Privacy Policy and any plan or purchase terms " +
        "shown at checkout, are the entire agreement between us about the " +
        "Service and replace any earlier understanding. If a provision is " +
        "held unenforceable, the rest stays in force and that provision is " +
        "read down to the minimum extent needed to make it valid. A failure " +
        "to enforce a right is not a waiver of it. You may not assign your " +
        "rights under these terms without our consent; we may assign ours to " +
        "a successor in a merger, acquisition or sale of assets. There are no " +
        "third-party beneficiaries. Questions about these terms go to " +
        "support@insertgo.ai.",
    },
  ],
};

export const PRIVACY: LegalDocument = {
  id: "privacy",
  title: "Privacy Policy",
  sections: [
    {
      heading: "The short version",
      body:
        "InsertGo is built so that your text stays yours. Your drafts, prompt " +
        "library, run history, settings and skills live on your PC, not on " +
        "our servers. Every AI feature runs through our managed service: the " +
        "text you asked us to improve is sent to us over TLS and on to " +
        "Google's Gemini models to produce a response; it is not logged, not " +
        "sold, and not used to train models — we keep counts, not content, " +
        "apart from the short-lived cache described below. There is no way " +
        "to point InsertGo at your own API key or at a model on your " +
        "machine, so this is the only path your text can take. The desktop " +
        "application contains no analytics and no telemetry. The rest of " +
        `this policy is the detail. This version, ${LEGAL_VERSION}, takes ` +
        `effect on ${LEGAL_EFFECTIVE}.`,
    },
    {
      heading: "Who is responsible for your data",
      body:
        "InsertGo.AI (\"we\", \"us\") is the controller of the personal data " +
        "described here, and you can reach us about anything in this policy " +
        "at support@insertgo.ai. We are the controller for every " +
        "AI request the product makes: all of them run through our managed " +
        "service, and there is no configuration in which your text reaches a " +
        "provider without passing through us.",
    },
    {
      heading: "What never leaves your device",
      body:
        "Held on your PC only: your drafts and prompts, your prompt library " +
        "and skills, your local run history, your settings and application " +
        "allowlist, and your window layout. The only credential the " +
        "application stores is your InsertGo session token, held by Windows " +
        "Credential Manager — never in a settings file, never in a log. The " +
        "application holds no AI provider key, because it never talks to a " +
        "provider directly. The application's log records " +
        "error conditions, not content: no prompt, response, key or token is " +
        "ever written to it. Uninstalling removes this local data from the " +
        "device, and you can clear your history from inside " +
        "the application at any time.",
    },
    {
      heading: "What InsertGo reads on your device, and when",
      body:
        "InsertGo reads the contents of the focused text field only at the " +
        "moment you press its hotkey, and reads the current selection only " +
        "while the selection skill bar is switched on. Both use Windows " +
        "accessibility interfaces and are limited to the applications on the " +
        "allowlist you control in Settings. Password and credential fields " +
        "are always refused: their contents are never read into memory, so " +
        "they can never be sent anywhere. When a field cannot be read or " +
        "written directly, InsertGo falls back to the clipboard — it saves " +
        "what was on your clipboard, uses it to move the text, then puts the " +
        "original contents back — and your clipboard is not read at any other " +
        "time. InsertGo does not take screenshots, does not log keystrokes, " +
        "does not record audio, and does not watch what you type between " +
        "invocations.",
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
        "together with the exact model and instruction used, so that " +
        "repeating the same request can be answered without regenerating it; " +
        "a response stored for your account can never be served to another " +
        "account. If you switch on grounded mode, a short topic distilled " +
        "from your text is also sent to Google Search, and the public " +
        "findings for that topic — not your text — are cached for up to " +
        "twenty-four hours and may be reused for anyone asking about the same " +
        "topic.",
    },
    {
      heading: "Account and sign-in data",
      body:
        "If you create an account we process your email address, the name and " +
        "avatar your sign-in provider supplies when it supplies them, the " +
        "identifier that provider uses for you, and the session records that " +
        "keep you signed in. Sign-in happens by one-time email code delivered " +
        "through Resend, by Google OAuth, or through an enterprise SSO " +
        "provider chosen by your organisation; we never see or store a " +
        "password, because we do not use them. On the desktop, sign-in runs " +
        "in your system browser using Authorization Code with PKCE, and the " +
        "resulting session token is held in your operating system's " +
        "credential storage rather than in the application's files.",
    },
    {
      heading: "Plan, credit and device data",
      body:
        "To operate plans and quotas we store your subscription tier and " +
        "status, your daily credit usage, your purchased credit balance, a " +
        "ledger of the credits each request consumed, and the timestamps for " +
        "those. InsertGo also reads the device identifier Windows already " +
        "assigns to your PC and shows it to you in Settings so you can see " +
        "which machine you are on; it is sent to us only where a licence has " +
        "to be bound to a specific device, and it identifies a machine rather " +
        "than a person.",
    },
    {
      heading: "Payments",
      body:
        "Paid plans and credit packs are sold through Dodo Payments, which " +
        "acts as Merchant of Record and takes payment on its own hosted " +
        "checkout. Your card number and payment credentials go to them, never " +
        "to us: we receive the outcome of the transaction — which product was " +
        "bought, when, its status, and an identifier we can use to reconcile " +
        "it with your account. What they hold, including the billing address " +
        "and tax details their checkout requires, is governed by their " +
        "privacy policy.",
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
        "The website sets cookies only to keep you signed in and to protect " +
        "the sign-in flow. There are no advertising cookies and no " +
        "third-party analytics or tracking scripts on it. Our hosting and " +
        "infrastructure providers keep ordinary server logs — IP address, " +
        "timestamp, request path, user agent and response status — for " +
        "security, abuse prevention and debugging, under their own short " +
        "retention schedules.",
    },
    {
      heading: "What we do not do",
      body:
        "We do not sell personal data, and we do not share it for " +
        "cross-context behavioural advertising. We do not use your prompts, " +
        "drafts or generated output to train models, ours or anyone else's. " +
        "We do not read your content, except where you send it to us yourself " +
        "in a support message or where the law compels us. There is no " +
        "advertising inside InsertGo.",
    },
    {
      heading: "Who we share data with",
      body:
        "A small set of processors runs the service on our instructions: " +
        "Google for the Gemini models and, in grounded mode, Search; Vercel " +
        "for hosting the website and API; Supabase and its PostgreSQL " +
        "database for accounts, plans and usage; Upstash for the expiring " +
        "caches described above; Resend for one-time codes, support and " +
        "transactional email; and Dodo Payments for checkout. Each receives " +
        "only what its function needs. We may also disclose data where we are " +
        "legally required to, or where it is necessary to establish, exercise " +
        "or defend legal claims, and we may transfer account data to a " +
        "successor if the business is acquired.",
    },
    {
      heading: "Where your data is processed",
      body:
        "We operate from India, and our providers run in data centres in " +
        "several countries, including the United States and the European " +
        "Union, so your data may be processed outside the country you live " +
        "in. Where personal data belonging to people in the EEA or the UK " +
        "leaves those areas, we rely on the European Commission's Standard " +
        "Contractual Clauses with the UK Addendum where relevant, or on " +
        "another lawful transfer mechanism offered by the provider concerned.",
    },
    {
      heading: "How long we keep things",
      body:
        "Account, plan and billing records are kept while your account exists " +
        "and afterwards for as long as tax, accounting and legal-claim rules " +
        "require. Usage counters and the credit ledger are kept for the " +
        "current and recent billing periods so quotas and invoices can be " +
        "reconciled. Cached generations expire automatically, by default " +
        "within twenty-four hours. Support messages are kept for as long as " +
        "resolving the matter and keeping a record needs. Content sent " +
        "through the managed AI service is not retained beyond the request " +
        "and that expiring cache. Anything held only on your PC stays until " +
        "you delete it or uninstall.",
    },
    {
      heading: "Our legal bases for processing",
      body:
        "Where the GDPR or UK GDPR applies, we process your account, plan and " +
        "in-transit content data to perform the contract you entered into " +
        "when you accepted the Terms; usage, security-log and rate-limit data " +
        "for our legitimate interest in keeping the Service working, safe and " +
        "paid for; support correspondence to answer you and to perform that " +
        "contract; and billing records to comply with legal obligations. " +
        "Where we rely on consent — for example if we ask to send you product " +
        "email — you can withdraw it at any time, without affecting what was " +
        "done beforehand. Where India's Digital Personal Data Protection Act, " +
        "2023 applies, we process personal data for the lawful purposes " +
        "described above, on the basis of the consent you give by accepting " +
        "these documents or of the legitimate uses that Act recognises.",
    },
    {
      heading: "India: Information Technology Act disclosures",
      body:
        "This document is also the privacy policy required by Rule 4 of the " +
        "Information Technology (Reasonable Security Practices and Procedures " +
        "and Sensitive Personal Data or Information) Rules, 2011, made under " +
        "section 43A of the Information Technology Act, 2000. We collect and " +
        "process the personal information described above for the lawful " +
        "purposes connected with our functions that this policy sets out, " +
        "with the consent you give by accepting it and the Terms, and we do " +
        "not keep it longer than those purposes need. Of the categories those " +
        "Rules treat as sensitive personal data or information, the only one " +
        "in play is financial information — and it is collected and held by " +
        "Dodo Payments on its own checkout, never received or stored by us; " +
        "we do not collect passwords, health, biometric, medical or " +
        "sexual-orientation data at all. Providing your information is " +
        "voluntary and you may withdraw the consent you gave from your " +
        "privacy settings at insertgo.ai/account/privacy — one click, no " +
        "email — or by writing to " +
        "the Grievance Officer named below; in either case we may be unable " +
        "to continue providing the Service to you, which is the only " +
        "consequence. We follow reasonable security practices and procedures " +
        "proportionate to the information we hold, as described under " +
        "Security below, and we transfer personal information to the " +
        "processors listed above, in India and abroad, only where the same " +
        "standard of protection is maintained and the transfer is necessary " +
        "to perform the contract with you. We do not disclose sensitive " +
        "personal data to a third party without your consent, except to a " +
        "government agency lawfully entitled to it or where disclosure is " +
        "required by law. As an intermediary under section 79 of the Act we " +
        "also observe the due-diligence and grievance obligations of the " +
        "Information Technology (Intermediary Guidelines and Digital Media " +
        "Ethics Code) Rules, 2021.",
    },
    {
      heading: "Your rights",
      body:
        "Subject to your local law, you can ask us for a copy of the personal " +
        "data we hold about you, have it corrected or deleted, restrict or " +
        "object to how we use it, take it elsewhere in a portable form, and " +
        "tell us to stop sending you marketing. In the EEA and the UK these " +
        "are GDPR rights; in India they are your rights as a Data Principal " +
        "under the DPDP Act, including the right to nominate someone to " +
        "exercise them if you die or become incapacitated; in California and " +
        "comparable US states you have equivalent rights to know, delete, " +
        "correct and opt out, and we will not treat you worse for using them. " +
        "Write to support@insertgo.ai — we will verify who you are and answer " +
        "within the period your law sets, which is one month under the GDPR " +
        "unless the request is complex. If you think we have got it wrong, " +
        "you can complain to your data protection authority: the Data " +
        "Protection Board of India, your EEA supervisory authority, or the UK " +
        "Information Commissioner's Office.",
    },
    {
      heading: "Grievance Officer (India)",
      body:
        "Complaints about how we handle your personal data, and requests to " +
        "exercise the rights above, can be sent to our Grievance Officer, " +
        `${GRIEVANCE_OFFICER.name}, at ${GRIEVANCE_OFFICER.email}; our ` +
        "postal address is available on request from that mailbox. The " +
        "officer is appointed under the Information Technology (Reasonable " +
        "Security Practices and Procedures and Sensitive Personal Data or " +
        "Information) Rules, 2011 and the Information Technology " +
        "(Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, " +
        "and is our point of contact for questions and grievances under " +
        "India's Digital Personal Data Protection Act, 2023. We acknowledge " +
        "every grievance within forty-eight hours of receiving it and aim to " +
        "resolve it within one month, and in any event within the period the " +
        "applicable rules require. If you are not satisfied with the outcome " +
        "you may complain to the Data Protection Board of India. The same " +
        "officer handles complaints under the Terms, including about charges, " +
        "refunds and cancellations.",
    },
    {
      heading: "Security",
      body:
        "Everything in transit uses TLS; secrets stay out of client-visible " +
        "code; prompt and response bodies are kept out of logs by design; " +
        "desktop sign-in requires PKCE with short-lived, single-use " +
        "authorization codes; and every request is scoped to the " +
        "authenticated account. Your session token is protected by Windows " +
        "Credential Manager on your own device rather than by us. No system " +
        "is perfectly secure — if a breach affects your personal data, we " +
        "will notify you and the relevant authority where the law requires " +
        "it.",
    },
    {
      heading: "Children",
      body:
        "InsertGo is not intended for anyone under 18, and we do not " +
        "knowingly collect personal data from children. If you believe a " +
        "child has given us personal data, write to support@insertgo.ai and " +
        "we will delete it.",
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
        "is always published at insertgo.ai/privacy. The version and date " +
        "tell you which text you are reading.",
    },
    {
      heading: "Contact",
      body:
        "Questions, requests and complaints about privacy go to " +
        "support@insertgo.ai. We answer every one.",
    },
  ],
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS, PRIVACY];
