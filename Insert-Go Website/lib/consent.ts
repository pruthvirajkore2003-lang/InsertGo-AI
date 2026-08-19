/**
 * Consent purposes, the notice version, and the read/write helpers over
 * `consentRecord` (supabase-consent-dsr.sql).
 *
 * Remediation items R-09 (artifact), R-10 (withdrawal), R-13 (itemised notice),
 * R-14 (age declaration).
 *
 * **This module is the single source of truth for what we ask consent FOR.**
 * The consent gate renders it, `/account/privacy` renders it, the §5 notice
 * table on /privacy renders it, and the SQL CHECK constraint mirrors it. That
 * matters because of the specific way this fails otherwise: §6(1) requires
 * consent that is *specific*, which means the notice and the checkboxes have to
 * enumerate the same purposes. Two hand-kept lists drift, and the drift is
 * invisible — a purpose in the notice with no checkbox is a purpose nobody
 * consented to, and a checkbox with no notice entry is consent to something
 * undisclosed. Both are §6 failures that read as working software.
 *
 * The two things §6 makes non-negotiable, both enforced below rather than by
 * convention:
 *
 *  1. **Optional purposes are never preconditions.** `required: false` purposes
 *     start unticked (a pre-ticked box is not "clear affirmative action") and
 *     can be withdrawn while the account keeps working. Bundling them into one
 *     "I agree to the Terms and Privacy Policy" checkbox — which is what the
 *     desktop app's dead `CONSENT_LABEL` did — is the single most common and
 *     most expensive way to get this wrong: it makes analytics a condition of
 *     service, which §6(1) forbids outright.
 *  2. **Withdrawal is symmetric.** §6(4) requires withdrawal to be *as easy as*
 *     giving, which is a mechanical test: count the clicks each way. One
 *     checkbox to opt in and an email to support to opt out fails, however fast
 *     support answers.
 */

import { rpc } from "./db";

/**
 * Version of the §5 notice these decisions are recorded against.
 *
 * Exported here rather than declared in `app/privacy/page.tsx` so a consent row
 * can never point at a version string that no longer exists. The page imports
 * this; the desktop's `LEGAL_VERSION` (Insert-Go Windows/src/legal/index.ts) is
 * a hand-kept mirror and must be bumped with it.
 *
 * Bump on any substantive wording change. Every consent recorded before the
 * bump stays valid *for the text it named* — that is the entire reason the
 * version is stored per row rather than assumed to be "current".
 */
export const NOTICE_VERSION = "1.4.0";

export type PurposeId =
  | "account"
  | "billing"
  | "ai_processing"
  | "analytics"
  | "marketing"
  | "age_18_plus";

export interface Purpose {
  id: PurposeId;
  /** Checkbox label. Written as a first-person statement of the decision. */
  label: string;
  /** What is actually done, in plain language (§5 "plain language" limb). */
  description: string;
  /**
   * True when the purpose is genuinely a precondition of providing the service
   * at all. Keep this list short and defensible: every `true` here is a purpose
   * the user cannot decline while keeping the account, so an over-broad one
   * re-imposes exactly the conditionality §6(1) prohibits.
   */
  required: boolean;
  /** Data items processed for this purpose — the §5 itemisation, and R-21's
   *  RoPA input. Column names, so a schema change makes the drift visible. */
  dataItems: string[];
  /** Who receives it, and where they are. Empty = stays in our estate. */
  recipients: Array<{ name: string; country: string }>;
  /** Plain-language retention, and which R-12 class it lands in. */
  retention: string;
  /** R-12 class. "B" survives withdrawal and erasure — say so in the notice. */
  retentionClass: "A" | "B";
}

/**
 * The catalogue. Order is the order the gate and the settings page render in:
 * required purposes first, so the optional ones read as genuinely optional
 * rather than as more of the same list.
 */
export const PURPOSES: readonly Purpose[] = [
  {
    id: "account",
    label: "Create and run my InsertGo account",
    description:
      "Sign you in, keep you signed in, and show your plan and credit balance.",
    required: true,
    dataItems: ["user.name", "user.email", "user.image", "session", "account"],
    recipients: [{ name: "Supabase (hosting)", country: "Japan" }],
    retention: "Until you delete your account.",
    retentionClass: "A",
  },
  {
    id: "billing",
    label: "Process my payments and keep the required accounting records",
    description:
      "Take payment for plans and credit packs through Dodo Payments, our " +
      "merchant of record, and keep the ledger entries that tax and company " +
      "law require us to retain.",
    required: true,
    dataItems: ["creditLedger", "user.tier", "user.addOnCredits"],
    recipients: [{ name: "Dodo Payments (merchant of record)", country: "See subprocessor register" }],
    // The honest half of this: an erasure request does NOT clear the ledger.
    // A subject who reads this beforehand is informed; one who discovers it in
    // a refusal has been misled (R-12's second-order requirement).
    retention:
      "Ledger entries are kept for the period tax and company law require, " +
      "and survive account deletion. Nothing else here does.",
    retentionClass: "B",
  },
  {
    id: "ai_processing",
    label: "Send my text to AI providers so InsertGo can rewrite it",
    // NOT mentioning "or use your own API key": there is no BYOK lane, and
    // there will not be one (R-15, decided 2026-08-08). `createProvider()`
    // throws for any host that is not Gemini's, `ProviderConfig.apiKey` is
    // deprecated and always empty, and even the Gemini lane posts to our own
    // relay rather than to Google. Both published policies were corrected to
    // match in NOTICE_VERSION 1.3.0 — keep all three in agreement.
    description:
      "When you use InsertGo's AI features, the text you asked us to improve " +
      "is sent to our servers and on to Google's Gemini models to produce a " +
      "response. We keep counts, not content.",
    required: true,
    dataItems: ["prompt text (in transit)", "apiUsage.count"],
    recipients: [
      { name: "Google (Gemini API)", country: "Outside India" },
      { name: "Upstash (semantic cache)", country: "See subprocessor register" },
    ],
    retention:
      "Not stored as content. Cached responses expire within 24 hours; usage " +
      "counts are kept while the account exists.",
    retentionClass: "A",
  },
  {
    id: "analytics",
    // Reworded in 1.4.0. It used to say "anonymous ... aggregate counts", which
    // stopped being true the moment the website gained product analytics: an
    // analytics cookie that follows one browser between pages is not anonymous,
    // whatever the dashboard shows. Until this is granted, the website's
    // analytics run cookie-less — no persistent identifier, no session replay —
    // which is the state a visitor who never signs in stays in.
    label: "Measure how I use InsertGo, so it can be improved",
    description:
      "Which features and pages are used, on the website and in the app. " +
      "Never your text, and never the content of what you type — website " +
      "session replays mask every input field, including passwords. " +
      "Declining changes nothing about how InsertGo works for you.",
    required: false,
    dataItems: [
      "page and feature event counts",
      "device, browser and referrer",
      "approximate location derived from IP",
      "input-masked website session replay",
    ],
    recipients: [
      { name: "PostHog (product analytics)", country: "United States" },
      { name: "Google (Analytics 4)", country: "Outside India" },
      { name: "Vercel (web analytics and Core Web Vitals)", country: "United States" },
    ],
    retention:
      "Held by the analytics providers on rolling retention (12 months or " +
      "less) and deleted with your account.",
    retentionClass: "A",
  },
  {
    id: "marketing",
    // 1.4.0 widened this from email to marketing generally, because the public
    // website now carries advertising and Google Ads conversion measurement,
    // and both are marketing uses of personal data. Consent Mode v2 holds every
    // advertising signal at `denied` until this purpose is granted
    // (components/analytics/ConsentSync.tsx).
    //
    // ponytail: one purpose covers promotional email AND advertising. That is
    // defensible — both are marketing, both are declinable, neither is a
    // precondition — but the more specific reading of §6(1) would split them.
    // Upgrade path: add an `advertising` purpose here, add it to
    // `consentRecord_purpose_ck` (supabase-consent-dsr.sql) with an ALTER on
    // deployed databases, and map it in ConsentSync instead of `marketing`.
    label: "Send me product email, and let advertising be measured and personalised",
    description:
      "Occasional product email — separate from the sign-in codes and receipts " +
      "we have to send you, which are not marketing and continue either way. " +
      "It also lets Google measure which advert brought you to us and " +
      "personalise the ads on our public articles. Decline and the ads stay, " +
      "but they are not personalised and no advertising cookie is set.",
    required: false,
    dataItems: [
      "user.email",
      "advertising cookies and identifiers",
      "order id and order value (conversion measurement)",
    ],
    recipients: [
      { name: "Resend (email delivery)", country: "United States" },
      { name: "Google (Ads and AdSense)", country: "Outside India" },
    ],
    retention: "Until you withdraw.",
    retentionClass: "A",
  },
  {
    id: "age_18_plus",
    // R-14. Recorded in this table rather than as a new column: §9 carries a
    // ₹150 crore penalty band, and the cheapest defence is a recorded
    // self-declaration rather than a policy sentence nobody can prove was
    // shown. If under-18 users ever come into scope, this row is where the
    // enforcement hook attaches — and `analytics` must then be hard-disabled
    // for those accounts. Building verifiable parental consent now, with no
    // under-18 users, would be speculative machinery.
    label: "I am 18 years old or older",
    description:
      "InsertGo is not intended for under-18s. We ask you to confirm rather " +
      "than assume it.",
    required: true,
    dataItems: ["self-declaration only — no date of birth is collected"],
    recipients: [],
    retention: "Kept as evidence of the declaration.",
    retentionClass: "B",
  },
] as const;

export const REQUIRED_PURPOSES: readonly PurposeId[] = PURPOSES.filter(
  (p) => p.required,
).map((p) => p.id);

export const OPTIONAL_PURPOSES: readonly PurposeId[] = PURPOSES.filter(
  (p) => !p.required,
).map((p) => p.id);

export function purpose(id: PurposeId): Purpose {
  const found = PURPOSES.find((p) => p.id === id);
  if (!found) throw new Error(`unknown consent purpose: ${id}`);
  return found;
}

/** How a decision was collected. Mirrors `consentRecord_method_ck`. */
export type ConsentMethod =
  | "web_consent_gate"
  | "web_account_settings"
  | "desktop_onboarding"
  | "operator";

export interface ConsentState {
  purpose: PurposeId;
  granted: boolean;
  noticeVersion: string;
  at: string;
}

/**
 * Record one decision. A withdrawal is this call with `granted: false` — there
 * is deliberately no separate `withdraw()`, because two entry points is how one
 * of them eventually does an UPDATE and destroys the evidence that consent was
 * validly obtained (the table's trigger would reject it, loudly, which is the
 * belt to this brace).
 *
 * Throws on failure. Unlike `audit()`, this must NOT be fire-and-forget: a
 * consent decision the user believes they made and we did not store is worse
 * than an error they can retry, because it is invisible to both sides until a
 * regulator asks for the record.
 */
export async function recordConsent(args: {
  userId: string;
  purpose: PurposeId;
  granted: boolean;
  method: ConsentMethod;
  language?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await rpc<{ id: number }>("consent_write", {
    p_user_id: args.userId,
    p_purpose: args.purpose,
    p_granted: args.granted,
    p_notice_version: NOTICE_VERSION,
    p_method: args.method,
    p_language: args.language ?? "en",
    p_ip: args.ip ?? null,
    p_user_agent: args.userAgent ?? null,
  });
}

/** Latest decision per purpose. Absent purpose = never asked. */
export async function currentConsent(
  userId: string,
): Promise<Map<PurposeId, ConsentState>> {
  const rows = await rpc<{
    purpose: PurposeId;
    granted: boolean;
    noticeVersion: string;
    at: string;
  }>("consent_current", { p_user_id: userId });
  return new Map(rows.map((r) => [r.purpose, r]));
}

/**
 * True when the consent gate must be shown before anything else.
 *
 * Two triggers, and the second is the one that makes the version column earn
 * its place: a required purpose that was never answered, OR any decision
 * recorded against an older notice version. Re-asking on a version bump is what
 * makes "consent to v1.2.0" a statement about text we can produce, rather than
 * about whatever the page happens to say today.
 *
 * Optional purposes deliberately do NOT trigger the gate. Nagging someone who
 * declined marketing every time they sign in is the asymmetric friction §6(4)
 * exists to stop.
 */
export function needsConsentGate(
  state: Map<PurposeId, ConsentState>,
): boolean {
  return REQUIRED_PURPOSES.some((id) => {
    const s = state.get(id);
    return !s || !s.granted || s.noticeVersion !== NOTICE_VERSION;
  });
}
