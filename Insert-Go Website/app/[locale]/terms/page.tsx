import type { Metadata } from "next";
import Link from "@/components/Link";
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
};

/** One version string across Terms, Privacy and the desktop mirror. When these
 *  were separate constants the three drifted, and a consent row named a version
 *  no page could still render. */
const VERSION = NOTICE_VERSION;
const EFFECTIVE = "19 August 2026";

/** Appointed under the Consumer Protection (E-Commerce) Rules, 2020 rule 4(5)
 *  and the IT (Intermediary Guidelines) Rules, 2021 rule 3(2)(a), and the same
 *  person is the DPDP Act 2023 §13(3) contact for data-principal grievances.
 *  Rule 3(2)(a) expects a NAMED individual, not an office — a placeholder here
 *  is a compliance gap, not a formatting one, so this stays filled in.
 *
 *  Mirrored verbatim in app/privacy/page.tsx and the app's legal/index.ts.
 *  The postal address is disclosed on request from the mailbox until a
 *  registered office address exists to publish. */
const GRIEVANCE_OFFICER = {
  name: "Pruthviraj Kore",
  designation: "Grievance Officer & Data Protection Officer",
  email: "support@insertgo.com",
};

/** `emphasis` boxes a section out of the uniform run of prose. Used for the
 *  arbitration clause only: "clear and conspicuous" is an enforceability
 *  condition for that section (Berman v. Freedom Financial Network, 30 F.4th
 *  849), not styling — a waiver that reads as ordinary boilerplate is the one
 *  courts decline to enforce. */
const sections: Array<{
  heading: string;
  body: string;
  emphasis?: boolean;
}> = [
  {
    heading: "1. Who we are and what these terms cover",
    body:
      "InsertGo AI (\"InsertGo\", \"we\", \"us\") operates the InsertGo desktop " +
      "application for Windows, the insertgo.com website, and the accounts, " +
      "licensing and AI services behind them (together, the \"Service\"). These " +
      "Terms & Conditions form a binding agreement between you and " +
      "InsertGo AI, and they apply every time you install, launch or use the " +
      "Service. If you do not accept them, do not use the Service. You are " +
      "asked to accept them, and to choose your privacy purposes, when you " +
      `sign in to your InsertGo account. This version, ${VERSION}, takes ` +
      `effect on ${EFFECTIVE} and replaces every ` +
      "earlier version. Our Privacy Policy is part of this agreement and is " +
      "incorporated by reference; the current text of both is always " +
      "published at insertgo.com/terms and insertgo.com/privacy. PLEASE READ " +
      "SECTION 23 CAREFULLY: IF YOU LIVE IN THE UNITED STATES IT REQUIRES " +
      "YOU AND US TO RESOLVE DISPUTES BY BINDING INDIVIDUAL ARBITRATION, AND " +
      "IT WAIVES YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS " +
      "ACTION. You may opt out of that section within 30 days, as it explains.",
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
      "write to support@insertgo.com as soon as you believe your account has " +
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
      "insertgo.com/pricing when you buy, and we may change them for future " +
      "billing periods with notice.",
  },
  {
    heading: "6. Billing, renewal and cancellation",
    body:
      "Paid plans and credit packs are sold and billed through Dodo Payments, " +
      "our payment processor and Merchant of Record for the transaction. " +
      "Their hosted checkout collects and processes your payment details and " +
      "calculates the tax for your country; we never receive or store your " +
      "card number. The prices shown on insertgo.com/pricing and inside the " +
      "application exclude tax: the tax that applies where you are — Indian " +
      "GST, EU or UK VAT, US sales tax and the like — is calculated and added " +
      "at that checkout before you confirm, and the total shown there is what " +
      "you pay. AUTOMATIC RENEWAL: when you subscribe you authorise a " +
      "recurring charge, and subscriptions renew automatically each month at " +
      "the then-current price, charged to the payment method you gave at " +
      "checkout, UNTIL YOU CANCEL. The amount, the monthly billing period " +
      "and this renewal term are shown next to the button before you buy, " +
      "you confirm them at Dodo's checkout, and we email you a receipt " +
      "recording them that you can keep. You may cancel at any time, online " +
      "and by yourself, from Account → Cancel subscription at " +
      "insertgo.com/account — one click and one confirmation, which is fewer " +
      "steps than signing up took; no email, phone call or support ticket is " +
      "required, and none will be asked of you. Cancellation takes effect at the " +
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
      "Cancellation: you may cancel a subscription at any time and without " +
      "giving a reason, yourself and online, from Account → Cancel " +
      "subscription at insertgo.com/account, at no cancellation fee; writing " +
      "to support@insertgo.com also works but is never required. It stops the " +
      "next renewal and takes effect at the end of the period " +
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
      "support@insertgo.com; if you are not satisfied with the outcome, the " +
      "grievance procedure in section 24 is open to you.",
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
      "not verify it, and no human reviews it before it reaches you. You are " +
      "the only reviewer: you must read what has been inserted before you " +
      "send, publish, submit or rely on it, and you alone are responsible " +
      "for verifying it. InsertGo is a general-purpose writing aid. It is " +
      "NOT designed, tested, licensed or authorised for medical, clinical or " +
      "diagnostic use, for legal advice or the drafting of legal " +
      "instruments, for financial, investment, tax or accounting advice, for " +
      "insurance, lending or employment decisions, for regulatory or " +
      "safety-critical filings, or for any life-critical, emergency or " +
      "life-sustaining application; do not use it for those purposes, and do " +
      "not treat its output as professional advice of any kind. Output that " +
      "names or describes a real person may be inaccurate or defamatory, and " +
      "publishing it is your act, not ours. Because InsertGo REPLACES THE " +
      "ENTIRE CONTENTS of the field or selection it read — the active input " +
      "buffer of another application, which we do not control — check the " +
      "result before moving on; the undo hotkey restores the previous text " +
      "in the same session, and section 18 sets out that we are not liable " +
      "for text, drafts or work product lost or overwritten in third-party " +
      "applications.",
  },
  {
    heading: "11. Reading and writing text on your device, and your consent to it",
    body:
      "To do its job, InsertGo uses Windows accessibility interfaces to read " +
      "the focused field or current selection at the moment you invoke it, " +
      "and writes the result back the same way, falling back to the clipboard " +
      "— saving and restoring your existing clipboard contents — when direct " +
      "insertion is not possible. To know when you have made a selection it " +
      "also registers a global hotkey and low-level Windows keyboard and " +
      "mouse hooks; those hooks match only Shift, the eight navigation keys " +
      "and Escape, and mouse press and release positions. They never inspect " +
      "character keys, so nothing you type is captured, stored, transmitted " +
      "or logged, and InsertGo takes no screenshots and records no audio. " +
      "YOUR EXPRESS CONSENT COMES FIRST: the desktop application asks you to " +
      "read these terms and the Privacy Policy and to tick a separate " +
      "authorisation box before it installs any of those hooks, registers " +
      "the hotkey, or reads or writes a single character, and until you do, " +
      "none of them run. You can withdraw that authorisation at any time — " +
      "turn the selection skill bar off in Settings, or uninstall the " +
      "application, which removes its local data from that device — and your " +
      "optional privacy choices are separate again, granular, and revocable " +
      "at insertgo.com/account/privacy. Withdrawing costs nothing and is not " +
      "a breach of these terms. It refuses password and credential fields, " +
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
      "support@insertgo.com on a commercially reasonable basis.",
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
      "will be accurate, current, non-infringing, non-defamatory or fit for " +
      "your purpose, that defects will be corrected, or that reading and " +
      "insertion will succeed in every application or leave every " +
      "third-party application's contents intact. We specifically disclaim " +
      "any warranty that the Service is fit for medical, legal, financial, " +
      "accounting, insurance, employment, regulatory, safety-critical or " +
      "life-critical use; it is not offered for those purposes. Some " +
      "jurisdictions do not allow certain warranties to be excluded, so " +
      "parts of this section may not apply to you, and nothing here affects " +
      "rights that consumers cannot waive.",
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
      "was possible. Without limiting that, we are not liable for text, " +
      "drafts, messages or work product altered, overwritten or lost inside " +
      "any third-party application into which InsertGo inserted text, nor " +
      "for any decision, publication, filing, transaction or reliance based " +
      "on AI output — including any use of the Service for a purpose section " +
      "10 says it is not designed for. Our total aggregate liability for all claims arising in " +
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
      "us to delete your account by writing to support@insertgo.com. We may " +
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
    heading: "22. Governing law and disputes (outside the United States)",
    body:
      "Informal resolution first, wherever you live: write to " +
      "support@insertgo.com and give us 30 days. Nearly everything is " +
      "resolved in a single email, and it costs you nothing. If you are " +
      "resident in India or anywhere other than the United States, these " +
      "terms and any dispute arising out of them or out of the Service are " +
      "governed by the laws of India without regard to conflict-of-law " +
      "rules, and the competent courts at Pune, Maharashtra, India have " +
      "exclusive jurisdiction. If you are a consumer, you keep the benefit " +
      "of every mandatory protection of your local law, including your " +
      "statutory remedies under the Consumer Protection Act, 2019 and the " +
      "Digital Personal Data Protection Act, 2023, your right to approach a " +
      "District, State or National Consumer Disputes Redressal Commission, " +
      "the National Consumer Helpline or the Data Protection Board of India, " +
      "and any right your local law gives you to bring proceedings in the " +
      "courts of your country of residence. Nothing in this section or in " +
      "section 23 requires you to give up a statutory remedy that cannot " +
      "lawfully be waived. If you are resident in the United States, section " +
      "23 governs your dispute instead of this one.",
  },
  {
    emphasis: true,
    heading:
      "23. United States residents: binding individual arbitration, class " +
      "action waiver and jury trial waiver",
    body:
      "PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR LEGAL RIGHTS, " +
      "INCLUDING YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS " +
      "ACTION. It applies only if you are resident in the United States or " +
      "bring a claim in a United States court. (a) Agreement to arbitrate. " +
      "You and InsertGo AI agree that any dispute, claim or controversy " +
      "arising out of or relating to these terms, the Service, our " +
      "advertising, your subscription or any charge — whether based in " +
      "contract, tort, statute, fraud, misrepresentation or any other legal " +
      "theory, and whether arising before, during or after the end of this " +
      "agreement — will be resolved by BINDING INDIVIDUAL ARBITRATION rather " +
      "than in court, except as stated in (e) and (f). This agreement to " +
      "arbitrate is governed by the Federal Arbitration Act, 9 U.S.C. § 1 et " +
      "seq., which applies to and preempts any inconsistent state law. (b) " +
      "How arbitration works. The arbitration is administered by the " +
      "American Arbitration Association (AAA) under its Consumer Arbitration " +
      "Rules, in effect when the claim is filed, as modified by this " +
      "section; the rules and forms are at adr.org or 1-800-778-7879. One " +
      "neutral arbitrator decides the case, may award any individual relief " +
      "a court could award to you individually, and must issue a written " +
      "decision explaining the award. The arbitration is held in the county " +
      "of your residence, or by telephone, videoconference or on documents " +
      "alone, at your choice. AAA's Consumer Arbitration Rules govern who " +
      "pays the fees; where those rules would leave you paying more than you " +
      "would to file the same claim in your local court, we pay the " +
      "difference, and we will not seek our attorneys' fees from you unless " +
      "the arbitrator finds your claim frivolous. (c) CLASS ACTION WAIVER. " +
      "YOU AND WE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN " +
      "AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY " +
      "PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, PRIVATE ATTORNEY GENERAL " +
      "OR REPRESENTATIVE PROCEEDING. The arbitrator may not consolidate more " +
      "than one person's claims or preside over any form of representative " +
      "or class proceeding. If a court decides this waiver is unenforceable " +
      "as to a particular claim or request for relief, that claim or request " +
      "— and only that one — is severed from the arbitration and may proceed " +
      "in court, with the rest staying in arbitration. (d) JURY TRIAL " +
      "WAIVER. TO THE EXTENT ANY CLAIM PROCEEDS IN COURT RATHER THAN " +
      "ARBITRATION, YOU AND WE EACH KNOWINGLY AND VOLUNTARILY WAIVE ANY " +
      "RIGHT TO A TRIAL BY JURY. (e) 30-DAY RIGHT TO OPT OUT. You may reject " +
      "this entire section by sending written notice within 30 days of the " +
      "date you first accept these terms — or, if you already had an " +
      "account, within 30 days of the date this version takes effect — to " +
      `support@insertgo.com with the subject line "Arbitration Opt-Out", ` +
      "stating your name and the email address on your account. Opting out " +
      "costs you nothing, is not a breach, and changes nothing else about " +
      "your account or these terms; if you opt out, section 22 governs your " +
      "disputes instead. If you do not opt out within those 30 days, you " +
      "agree to this section. (f) What is not covered. Either of us may " +
      "bring an individual claim in a small-claims court with jurisdiction, " +
      "and either of us may seek injunctive relief in court to stop " +
      "infringement or misuse of intellectual property. Nothing here " +
      "prevents you from reporting a matter to, or seeking relief from, a " +
      "government agency, and nothing here waives a right that federal or " +
      "state law says cannot be waived. (g) Survival and severability. This " +
      "section survives the end of this agreement. If any part of it other " +
      "than (c) is found unenforceable, that part is severed and the rest " +
      "continues; if (c) is found unenforceable in its entirety, this whole " +
      "section is void and section 22 applies. (h) Changes. If we materially " +
      "change this section, the change applies only to claims arising after " +
      "the change takes effect, and you get a fresh 30-day opt-out.",
  },
  {
    heading: "24. Grievance redressal (India)",
    body:
      "As required by the Consumer Protection (E-Commerce) Rules, 2020 and " +
      "the Information Technology (Intermediary Guidelines and Digital Media " +
      "Ethics Code) Rules, 2021, we have appointed a Grievance Officer to " +
      `receive complaints about the Service, about a charge, refund or ` +
      `cancellation, about content, or about anything in these terms or the ` +
      `Privacy Policy: ${GRIEVANCE_OFFICER.name}, ` +
      `${GRIEVANCE_OFFICER.designation}, InsertGo AI, Pune, Maharashtra, ` +
      `India, reachable at ${GRIEVANCE_OFFICER.email}; our full postal ` +
      "address is provided on request from that mailbox. Tell us your name, " +
      "the email your account uses, what happened and what you would like " +
      "done. We acknowledge every complaint within forty-eight hours of " +
      "receiving it and aim to resolve it within one month, and in any event " +
      "within the period the applicable rules require. The same officer is " +
      "the Data Protection Officer and the point of contact for questions " +
      "and grievances about personal data under India's Digital Personal " +
      "Data Protection Act, 2023, §13. If you are " +
      "not satisfied with the outcome, you may escalate to the Data " +
      "Protection Board of India, and nothing in this section limits your " +
      "right to approach a consumer forum, the National Consumer Helpline, " +
      "or any other authority directly.",
  },
  {
    heading: "25. General",
    body:
      "These terms, with the Privacy Policy and any plan or purchase terms " +
      "shown at checkout, are the entire agreement between us about the " +
      "Service and replace any earlier understanding. If a provision is held " +
      "unenforceable, the rest stays in force and that provision is read down " +
      "to the minimum extent needed to make it valid. A failure to enforce a " +
      "right is not a waiver of it. You may not assign your rights under " +
      "these terms without our consent; we may assign ours to a successor in " +
      "a merger, acquisition or sale of assets. There are no third-party " +
      "beneficiaries. Questions about these terms go to support@insertgo.com.",
  },
];

export default function TermsPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-24 pb-6 text-center sm:pt-28 sm:pb-8">
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

      <section className="mx-auto max-w-[760px] px-6 pt-2 pb-[110px] sm:pt-4">
        <article className="glass-panel flex flex-col gap-7 p-[clamp(26px,4vw,44px)]">
          {sections.map((s) => (
            <div
              key={s.heading}
              className={
                s.emphasis
                  ? "rounded-2xl border-2 border-brand/40 bg-brand/5 p-5"
                  : undefined
              }
            >
              <h2 className="mt-0 mb-2.5 font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink">
                {s.heading}
              </h2>
              <p
                className={`m-0 text-[15px] leading-[1.75] ${
                  s.emphasis ? "text-ink-soft" : "text-muted"
                }`}
              >
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
