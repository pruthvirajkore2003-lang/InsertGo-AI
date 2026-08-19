import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, GlowBackdrop } from "@/components/PageHero";
import { Breadcrumbs, JsonLd } from "@/components/SeoContent";
import { FadeUp, Reveal } from "@/components/Reveal";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { LinearShieldTick } from "@/components/icons/LinearShieldTick";
import { LinearHeadphone } from "@/components/icons/LinearHeadphone";
import { LinearMonitor } from "@/components/icons/LinearMonitor";
import { LinearGlobal } from "@/components/icons/LinearGlobal";
import { LinearSms } from "@/components/icons/LinearSms";
import { LinearDocumentText } from "@/components/icons/LinearDocumentText";
import { breadcrumbSchema, faqSchema, SITE_URL } from "@/lib/seo";
import { NOTICE_VERSION } from "@/lib/consent";

/**
 * The self-service cancellation + refund surface.
 *
 * This page RESTATES Terms sections 6 (billing, renewal, cancellation) and 7
 * (refund and cancellation policy) in a form a customer can act on. It is not
 * a second policy: where the two ever read differently, /terms governs, and
 * the fix is to edit both — plus the app's legal mirror
 * (Insert-Go Windows/src/legal/index.ts) when the wording is contractual.
 *
 * Deliberately a server component. Everything interactive here is native
 * (anchor links riding html{scroll-behavior:smooth}, <details> accordions), so
 * the JSON-LD, the FAQ answers and the eligibility matrix are all in the
 * initial HTML — which is the entire point of a page that search engines and
 * payment-provider reviewers read.
 */

const TITLE = "Cancel Subscription & Refund Policy | InsertGo";
const DESCRIPTION =
  "How to cancel an InsertGo Plus or Pro subscription, what cancelling keeps, " +
  "and exactly when a charge is refundable. Billed by Dodo Payments as " +
  "Merchant of Record; approved refunds reach the original payment method in " +
  "five to seven business days.";

export const metadata: Metadata = {
  // `absolute` — the root layout's "%s — InsertGo.AI" template would otherwise
  // brand this title twice.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/cancel" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/cancel",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Cancel any time, keep paid features to the end of the period you paid " +
      "for, and see exactly which charges come back.",
  },
};

const SUPPORT_EMAIL = "support@insertgo.ai";
const GRIEVANCE_EMAIL = "grievance@insertgo.ai";
/** Matches app/terms/page.tsx — bump both together. */
const EFFECTIVE = "8 August 2026";

const breadcrumbs = [
  { name: "Home", href: "/" },
  { name: "Cancellation & refunds", href: "/cancel" },
];

const toc = [
  { id: "difference", label: "Cancellation vs. refund" },
  { id: "how-to-cancel", label: "How to cancel" },
  { id: "refund-matrix", label: "Refund eligibility" },
  { id: "consumer-rights", label: "Your consumer rights" },
  { id: "faq", label: "FAQ" },
];

/* ---------------------------------------------------------------- section 1 */

const compare = [
  {
    icon: LinearTickCircle,
    tile: "var(--color-tile-sky)",
    title: "Cancelling",
    lede: "Stops the next renewal. Always available, no fee, no questions.",
    points: [
      "Plus or Pro features stay on until the last day of the period you have already paid for.",
      "Daily credits keep resetting at 00:00 UTC until that date, then the account returns to the Free plan.",
      "Add-on pack credits never expire and stay on the account through the downgrade.",
      "Nothing is charged again once the cancellation is recorded.",
    ],
  },
  {
    icon: LinearShieldTick,
    tile: "var(--color-tile-stone)",
    title: "Refunding",
    lede: "Reverses a charge you already paid. Needs one of the grounds below.",
    points: [
      "Issued by Dodo Payments, our Merchant of Record, back to the original payment method.",
      "Full refund when no credits were consumed under that charge and you write within seven days.",
      "Credits already spent, and a subscription period already served, are not refundable.",
      "A refunded credit pack has the credits it granted removed from your balance.",
    ],
  },
];

/* ---------------------------------------------------------------- section 2 */

const methods = [
  {
    icon: LinearGlobal,
    tile: "var(--color-tile-sky)",
    title: "Method 1 — Account dashboard",
    meta: "Fastest · self-service",
    steps: [
      "Sign in at insertgo.ai/account. The plan card shows your tier, today's credits and your add-on balance.",
      "Open the Dodo Payments customer portal from the link in any InsertGo receipt email — Dodo is the Merchant of Record and holds the subscription and the payment method.",
      "Choose Cancel subscription. There is no cancellation fee and no exit questionnaire.",
      "Dodo emails a confirmation. Your account page reads Free from the day after the paid period ends.",
    ],
    note: "No receipt email to hand? Use method 2 — one message and we do it for you.",
  },
  {
    icon: LinearSms,
    tile: "var(--color-tile-stone)",
    title: "Method 2 — Email or contact form",
    meta: "Answered within one business day",
    steps: [
      "Write to support@insertgo.ai from the address your account uses, or send the form on the contact page.",
      "Say that you want to cancel. A reason is welcome but never required.",
      "We cancel from our side and confirm in writing, within one business day.",
      "Access still runs to the end of the paid period — a support cancellation is not an early cut-off.",
    ],
    note: "Asking for a refund too? Say so in the same message and quote the charge date.",
  },
  {
    icon: LinearMonitor,
    tile: "var(--color-tile-sand)",
    title: "Method 3 — Windows desktop app",
    meta: "Opens the web flow",
    steps: [
      "Open InsertGo and go to your profile to reach the plan card.",
      "Choose View pricing on the website. It opens insertgo.ai in your default browser, already signed in.",
      "Finish with method 1 or method 2 — the desktop app never charges your card and holds no billing controls of its own.",
      "Uninstalling the app does not cancel a subscription. Cancel first, then uninstall.",
    ],
    note: "Entitlements are server-side, so one cancellation applies to every device signed in to the account.",
  },
];

/* ---------------------------------------------------------------- section 3 */

type Outcome = "full" | "partial" | "none";

const matrix: {
  situation: string;
  outcome: Outcome;
  result: string;
  window: string;
}[] = [
  {
    situation: "Subscription charge, no credits consumed",
    outcome: "full",
    result: "100% refund to the original payment method.",
    window: "Within 7 days of the charge",
  },
  {
    situation: "Subscription in active use, credits consumed",
    outcome: "none",
    result:
      "No refund for the period already served — the service it paid for was supplied. Cancel to stop the next renewal; access runs to the end of the period.",
    window: "Cancel any time",
  },
  {
    situation: "Duplicate or mistaken charge",
    outcome: "full",
    result: "100% refund, in every case, as soon as we can see the charge.",
    window: "Any time",
  },
  {
    situation: "Service error or failed generations on our side",
    outcome: "full",
    result:
      "Credits restored to your balance, or the charge refunded where the plan was unusable. A retried request replays on its idempotency key and is never charged twice.",
    window: "Report any time",
  },
  {
    situation: "Add-on credit pack, unused balance",
    outcome: "partial",
    result:
      "Refund of the pack credits still sitting on the account. Credits already spent are not refundable, and refunded credits are removed from the balance.",
    window: "Within 7 days of purchase",
  },
  {
    situation: "We discontinue a paid plan",
    outcome: "full",
    result: "Unused portion of the prepaid period refunded, without a request.",
    window: "Automatic",
  },
];

const OUTCOME_STYLE: Record<Outcome, { label: string; className: string }> = {
  full: { label: "Refundable", className: "text-success" },
  partial: { label: "Partly refundable", className: "text-ink" },
  none: { label: "Not refundable", className: "text-muted" },
};

/* ---------------------------------------------------------------- section 5 */

const faqs = [
  {
    question: "Does cancelling stop my access straight away?",
    answer:
      "No. Cancellation stops the next renewal only. Plus or Pro features stay on until the end of the billing period you have already paid for, and the account returns to the Free plan the day after.",
  },
  {
    question: "Do I keep my daily credits after I cancel?",
    answer:
      "Yes, until the paid period ends. Daily credits reset at 00:00 UTC and never roll over, so the allowance on your last paid day is the last paid one you get before the account drops to the Free plan's five credits a day.",
  },
  {
    question: "What happens to add-on credit packs when I cancel?",
    answer:
      "Nothing. Pack credits do not expire, they stay on the account through a downgrade, and they are spent once the day's allowance runs out. The one exception is a refunded pack: refunding it removes the credits it granted.",
  },
  {
    question: "Can I get a refund after I have used my credits?",
    answer:
      "Not for what has already been supplied. Once credits have been consumed under a charge, those credits and the subscription period already served are non-refundable. You can still cancel at any time to stop the next renewal, and a duplicate charge or a failure on our side is always refunded.",
  },
  {
    question: "How long does a refund take to reach my bank?",
    answer:
      "Dodo Payments issues an approved refund to the original payment method, normally within five to seven business days of approval. Your bank or card issuer may take a few days more to post it, so allow up to two weeks end to end before chasing it.",
  },
  {
    question: "How do I cancel from the Windows desktop app?",
    answer:
      "The desktop app holds no billing controls. Open your profile, choose View pricing on the website, then cancel from your account or by emailing support@insertgo.ai. Uninstalling the app does not cancel a subscription.",
  },
  {
    question: "Who charges my card, InsertGo or Dodo Payments?",
    answer:
      "Dodo Payments. They are our payment processor and the Merchant of Record for every purchase, so their hosted checkout collects the card details, calculates the tax for your country, and is the name that appears on your statement. We never receive or store your card number.",
  },
  {
    question: "I was charged twice for the same month. What now?",
    answer:
      "Write to support@insertgo.ai with the charge dates. Duplicate and mistaken charges are refunded in full in every case — you do not have to argue eligibility, and you do not need to raise a chargeback first.",
  },
];

/* ------------------------------------------------------------------ schemas */

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/cancel#webpage`,
  url: `${SITE_URL}/cancel`,
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: "en",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  publisher: { "@id": `${SITE_URL}/#organization` },
  about: { "@id": `${SITE_URL}/#software` },
  breadcrumb: { "@id": `${SITE_URL}/cancel#breadcrumb` },
  significantLink: [`${SITE_URL}/terms`, `${SITE_URL}/account`],
};

const cancelHowToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to cancel an InsertGo subscription",
  description:
    "Cancel an InsertGo Plus or Pro subscription from the account dashboard, by email, or from the Windows desktop app. Paid features stay active until the end of the period already paid for.",
  totalTime: "PT3M",
  estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Sign in to your InsertGo account",
      text: "Open insertgo.ai/account and check the plan card for your current tier and credit balances.",
      url: `${SITE_URL}/cancel#how-to-cancel`,
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Open the Dodo Payments customer portal",
      text: "Follow the portal link in any InsertGo receipt email. Dodo Payments is the Merchant of Record and holds the subscription and payment method.",
      url: `${SITE_URL}/cancel#how-to-cancel`,
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Cancel the subscription",
      text: "Choose Cancel subscription in the portal. There is no cancellation fee, and Plus or Pro features stay active until the end of the period already paid for.",
      url: `${SITE_URL}/cancel#how-to-cancel`,
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Or ask support to cancel for you",
      text: "Email support@insertgo.ai from the address on the account, or use the contact form. Cancellation requests are actioned within one business day.",
      url: `${SITE_URL}/contact`,
    },
  ],
};

const refundHowToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to request an InsertGo refund",
  description:
    "Request a refund of an InsertGo subscription charge or credit pack. Approved refunds are issued by Dodo Payments to the original payment method within five to seven business days.",
  totalTime: "PT5M",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Check the eligibility matrix",
      text: "Confirm the charge is refundable: unused within seven days, a duplicate or mistaken charge, a failure on our side, or an unused credit-pack balance within seven days of purchase.",
      url: `${SITE_URL}/cancel#refund-matrix`,
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Email support with the charge details",
      text: "Write to support@insertgo.ai from the address on the account, or use the contact form, giving the charge date, the amount, and what went wrong.",
      url: `${SITE_URL}/contact`,
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Get a decision within one business day",
      text: "We reply within one business day. If more information is needed we ask for it in that reply rather than closing the request.",
      url: `${SITE_URL}/cancel#refund-matrix`,
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Receive the refund",
      text: "Dodo Payments returns approved refunds to the original payment method, normally within five to seven business days of approval; your bank may take a few days more to post it.",
      url: `${SITE_URL}/cancel#refund-matrix`,
    },
  ],
};

/* --------------------------------------------------------------------- page */

const PRIMARY_BTN =
  "inline-flex h-12 items-center gap-2.5 rounded-btn bg-brand px-7 text-base font-medium text-on-accent shadow-cta transition-[transform,background-color,box-shadow] duration-200 ease-standard hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-cta-hover active:translate-y-0 active:scale-[0.97] active:duration-75";
const GHOST_BTN =
  "glass-chip inline-flex h-12 items-center gap-2.5 rounded-btn px-7 text-base font-medium text-ink transition-[background-color,border-color,transform] duration-200 ease-standard hover:bg-surface-hover active:scale-[0.97] active:duration-75";
const EYEBROW =
  "mb-3 text-xs font-medium tracking-[0.16em] text-brand uppercase";
const H2 =
  "m-0 font-serif text-[clamp(27px,3.6vw,40px)] font-semibold tracking-[-0.02em] text-ink";
const TILE =
  "mb-5 flex h-11 w-11 items-center justify-center rounded-card text-brand";

export default function CancelPage() {
  return (
    <main className="relative overflow-hidden">
      <JsonLd
        data={{
          ...breadcrumbSchema(breadcrumbs),
          "@id": `${SITE_URL}/cancel#breadcrumb`,
        }}
      />
      <JsonLd data={webPageSchema} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={cancelHowToSchema} />
      <JsonLd data={refundHowToSchema} />

      <GlowBackdrop />
      <Breadcrumbs items={breadcrumbs} />

      <PageHero
        compact
        kicker="Billing & subscriptions"
        title="Cancel subscription & refund policy"
        sub={
          <>
            Cancel in a minute, keep what you paid for until the period ends,
            and see exactly which charges come back. This page restates
            sections 6 and 7 of the{" "}
            <Link
              href="/terms"
              className="font-medium text-brand no-underline hover:underline"
            >
              Terms &amp; Conditions
            </Link>{" "}
            as steps you can follow.
          </>
        }
      >
        <FadeUp delay={0.18}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/account" className={PRIMARY_BTN}>
              Manage in Account
            </Link>
            <Link href="/contact" className={GHOST_BTN}>
              <LinearHeadphone size={18} />
              Contact support
            </Link>
          </div>
        </FadeUp>
        <FadeUp delay={0.24}>
          <p className="mt-6 mb-0 text-[13px] text-muted">
            Version {NOTICE_VERSION} · Effective {EFFECTIVE} · No cancellation
            fee, ever
          </p>
        </FadeUp>
      </PageHero>

      {/* Table of contents. Plain anchors: html{scroll-behavior:smooth} in
          globals.css does the easing and its prefers-reduced-motion reset
          turns it off — a JS scroller would have to reimplement both. */}
      <section className="mx-auto max-w-[820px] px-6 pt-6 pb-2">
        <Reveal>
          <nav aria-labelledby="toc-heading" className="glass-panel p-6 sm:p-7">
            <h2
              id="toc-heading"
              className="m-0 mb-4 text-xs font-medium tracking-[0.12em] text-muted uppercase"
            >
              On this page
            </h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5 p-0">
              {toc.map((item, i) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="glass-chip flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-ink no-underline transition-colors duration-200 hover:bg-surface-hover"
                  >
                    <span
                      aria-hidden
                      className="text-xs font-semibold text-brand tabular-nums"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Reveal>
      </section>

      {/* ---------------------------------------------------- 1. difference */}
      <section
        id="difference"
        aria-labelledby="difference-heading"
        className="mx-auto max-w-[1080px] scroll-mt-28 px-6 py-[70px]"
      >
        <Reveal className="mx-auto mb-10 max-w-[700px] text-center">
          <p className={EYEBROW}>Section 1</p>
          <h2 id="difference-heading" className={H2}>
            Cancellation is not a refund
          </h2>
          <p className="mx-auto mt-4 mb-0 max-w-[600px] text-[15px] leading-[1.7] text-muted">
            Two different requests, two different outcomes. Most people want
            the first one: stop the renewal, keep using what is already paid
            for.
          </p>
        </Reveal>

        <div className="grid gap-[18px] md:grid-cols-2">
          {compare.map((card, i) => (
            <Reveal key={card.title} delay={i * 0.06} hoverLift>
              <article className="glass-card h-full p-7">
                <span aria-hidden className={TILE} style={{ background: card.tile }}>
                  <card.icon size={22} />
                </span>
                <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                  {card.title}
                </h3>
                <p className="mt-2 mb-4 text-[15px] leading-[1.7] text-ink-soft">
                  {card.lede}
                </p>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {card.points.map((p) => (
                    <li
                      key={p}
                      className="flex gap-3 text-[15px] leading-[1.65] text-muted"
                    >
                      <span aria-hidden className="mt-0.5 shrink-0 text-brand">
                        <LinearTickCircle size={17} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- 2. how to cancel */}
      <section
        id="how-to-cancel"
        aria-labelledby="how-to-cancel-heading"
        className="mx-auto max-w-[1080px] scroll-mt-28 px-6 py-[70px]"
      >
        <Reveal className="mx-auto mb-10 max-w-[700px] text-center">
          <p className={EYEBROW}>Section 2</p>
          <h2 id="how-to-cancel-heading" className={H2}>
            How to cancel your subscription
          </h2>
          <p className="mx-auto mt-4 mb-0 max-w-[620px] text-[15px] leading-[1.7] text-muted">
            Three routes to the same result. Pick whichever is in front of you
            — none of them costs a fee or shortens the period you paid for.
          </p>
        </Reveal>

        <div className="grid gap-[18px] lg:grid-cols-3">
          {methods.map((m, i) => (
            <Reveal key={m.title} delay={i * 0.06} hoverLift>
              <article className="glass-card flex h-full flex-col p-7">
                <span aria-hidden className={TILE} style={{ background: m.tile }}>
                  <m.icon size={22} />
                </span>
                <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                  {m.title}
                </h3>
                <p className="mt-1.5 mb-5 text-xs font-medium tracking-[0.08em] text-brand uppercase">
                  {m.meta}
                </p>
                <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
                  {m.steps.map((s, si) => (
                    <li
                      key={s}
                      className="flex gap-3 text-[15px] leading-[1.65] text-muted"
                    >
                      <span
                        aria-hidden
                        className="glass-chip mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-ink tabular-nums"
                      >
                        {si + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
                <p className="mt-auto mb-0 pt-5 text-[13px] leading-[1.6] text-ink-soft">
                  {m.note}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-8 max-w-[720px] text-center text-[15px] leading-[1.7] text-muted">
            Prefer to write?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-brand no-underline hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            or the{" "}
            <Link
              href="/contact"
              className="font-medium text-brand no-underline hover:underline"
            >
              contact form
            </Link>
            . Every cancellation request is actioned within one business day.
          </p>
        </Reveal>
      </section>

      {/* -------------------------------------------------- 3. refund matrix */}
      <section
        id="refund-matrix"
        aria-labelledby="refund-matrix-heading"
        className="mx-auto max-w-[1080px] scroll-mt-28 px-6 py-[70px]"
      >
        <Reveal className="mx-auto mb-10 max-w-[700px] text-center">
          <p className={EYEBROW}>Section 3</p>
          <h2 id="refund-matrix-heading" className={H2}>
            Refund policy &amp; eligibility
          </h2>
          <p className="mx-auto mt-4 mb-0 max-w-[620px] text-[15px] leading-[1.7] text-muted">
            InsertGo sells digital goods delivered instantly — a subscription
            is live, and pack credits are on the account, the moment payment
            succeeds. There is nothing to ship, return or exchange, so
            eligibility turns on what was consumed.
          </p>
        </Reveal>

        <Reveal>
          <div className="glass-panel overflow-hidden">
            {/* The table is the normative layout; the list below is the same
                six rows restacked for narrow screens. Only one is in the
                accessibility tree at a time, or a screen reader reads the
                whole matrix twice. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Refund eligibility by situation, with the outcome and the
                  window in which to ask
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th
                      scope="col"
                      className="px-6 py-4 text-xs font-medium tracking-[0.12em] text-muted uppercase"
                    >
                      Situation
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-xs font-medium tracking-[0.12em] text-muted uppercase"
                    >
                      Outcome
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-xs font-medium tracking-[0.12em] text-muted uppercase"
                    >
                      What happens
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-xs font-medium tracking-[0.12em] text-muted uppercase"
                    >
                      Window
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr
                      key={row.situation}
                      className="border-b border-line last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="px-6 py-5 align-top text-[15px] leading-[1.6] font-medium text-ink"
                      >
                        {row.situation}
                      </th>
                      <td className="px-6 py-5 align-top">
                        <span
                          className={`glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap ${OUTCOME_STYLE[row.outcome].className}`}
                        >
                          {row.outcome !== "none" && <LinearTickCircle size={14} />}
                          {OUTCOME_STYLE[row.outcome].label}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-top text-[15px] leading-[1.65] text-muted">
                        {row.result}
                      </td>
                      <td className="px-6 py-5 align-top text-[14px] leading-[1.6] whitespace-nowrap text-ink-soft">
                        {row.window}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul
              aria-label="Refund eligibility by situation"
              className="m-0 flex list-none flex-col p-0 md:hidden"
            >
              {matrix.map((row) => (
                <li
                  key={row.situation}
                  className="border-b border-line p-6 last:border-b-0"
                >
                  <p className="m-0 text-[15px] leading-[1.5] font-medium text-ink">
                    {row.situation}
                  </p>
                  <span
                    className={`glass-chip mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium ${OUTCOME_STYLE[row.outcome].className}`}
                  >
                    {row.outcome !== "none" && <LinearTickCircle size={14} />}
                    {OUTCOME_STYLE[row.outcome].label}
                  </span>
                  <p className="mt-3 mb-0 text-[15px] leading-[1.65] text-muted">
                    {row.result}
                  </p>
                  <p className="mt-2 mb-0 text-[13px] text-ink-soft">
                    {row.window}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <div className="mt-[18px] grid gap-[18px] md:grid-cols-2">
          <Reveal delay={0.06}>
            <article className="glass-card h-full p-7">
              <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                How the money comes back
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
                Approved refunds are issued by Dodo Payments as Merchant of
                Record, to the original payment method, normally within five to
                seven business days of approval. Your bank or card issuer may
                take a few days more to post it. A refund cannot be redirected
                to a different card or account — the reversal has to follow the
                original charge.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.12}>
            <article className="glass-card h-full p-7">
              <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                Before you raise a chargeback
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
                Write to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-brand no-underline hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                first. A duplicate or mistaken charge is refunded without
                argument, and usually faster than a bank dispute resolves. A
                chargeback also suspends paid features on the account until it
                is settled, which is rarely what anyone wants.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------- 4. consumer rights */}
      <section
        id="consumer-rights"
        aria-labelledby="consumer-rights-heading"
        className="mx-auto max-w-[1080px] scroll-mt-28 px-6 py-[70px]"
      >
        <Reveal className="mx-auto mb-10 max-w-[700px] text-center">
          <p className={EYEBROW}>Section 4</p>
          <h2 id="consumer-rights-heading" className={H2}>
            Consumer rights &amp; Merchant of Record
          </h2>
          <p className="mx-auto mt-4 mb-0 max-w-[620px] text-[15px] leading-[1.7] text-muted">
            Nothing on this page takes away a right the law gives you. Where a
            statutory right is wider than this policy, the statutory right
            wins.
          </p>
        </Reveal>

        <div className="grid gap-[18px] lg:grid-cols-3">
          <Reveal hoverLift>
            <article className="glass-card h-full p-7">
              <span
                aria-hidden
                className={TILE}
                style={{ background: "var(--color-tile-sky)" }}
              >
                <LinearDocumentText size={22} />
              </span>
              <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                Dodo Payments is the Merchant of Record
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
                Every subscription and credit pack is sold and billed through
                Dodo Payments, our payment processor and Merchant of Record.
                Their hosted checkout takes the payment details and works out
                the tax that applies where you are — Indian GST, EU or UK VAT,
                US sales tax — adding it to the listed price before you
                confirm. We never receive or store your card number, and Dodo
                is the name on your statement.
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.06} hoverLift>
            <article className="glass-card h-full p-7">
              <span
                aria-hidden
                className={TILE}
                style={{ background: "var(--color-tile-stone)" }}
              >
                <LinearGlobal size={22} />
              </span>
              <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                EU, EEA and UK — 14-day withdrawal
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
                Consumers in the EU, EEA and UK have a statutory fourteen-day
                right to withdraw from a distance purchase. It applies in
                addition to this policy and we honour it. Note that the right
                can end once digital content has been supplied with your
                express consent — which is what happens the moment a
                subscription goes live or pack credits land on the account. If
                you have not used the service, tell us within fourteen days and
                we refund in full.
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.12} hoverLift>
            <article className="glass-card h-full p-7">
              <span
                aria-hidden
                className={TILE}
                style={{ background: "var(--color-tile-sand)" }}
              >
                <LinearShieldTick size={22} />
              </span>
              <h3 className="m-0 font-serif text-lg font-semibold text-ink">
                India — grievance redressal
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
                Under the Consumer Protection (E-Commerce) Rules, 2020 we have
                appointed a Grievance Officer for complaints about a charge,
                refund or cancellation:{" "}
                <a
                  href={`mailto:${GRIEVANCE_EMAIL}`}
                  className="font-medium text-brand no-underline hover:underline"
                >
                  {GRIEVANCE_EMAIL}
                </a>
                . Every complaint is acknowledged within forty-eight hours and
                resolved within one month. Nothing here limits your right to
                approach a consumer forum or the National Consumer Helpline
                directly.
              </p>
            </article>
          </Reveal>
        </div>

        <Reveal delay={0.16}>
          <p className="mx-auto mt-8 max-w-[720px] text-center text-[14px] leading-[1.7] text-muted">
            The binding text is section 7 of the{" "}
            <Link
              href="/terms"
              className="font-medium text-brand no-underline hover:underline"
            >
              Terms &amp; Conditions
            </Link>
            , with the grievance procedure in section 23. Where this page and
            the Terms ever differ, the Terms govern.
          </p>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------- 5. FAQ */}
      <section
        id="faq"
        aria-labelledby="faq-heading"
        className="mx-auto max-w-[820px] scroll-mt-28 px-6 py-[70px]"
      >
        <Reveal className="mx-auto mb-10 max-w-[700px] text-center">
          <p className={EYEBROW}>Section 5</p>
          <h2 id="faq-heading" className={H2}>
            Frequently asked questions
          </h2>
        </Reveal>

        {/* Native <details>: keyboard-operable, findable by in-page search and
            open when printed — none of which a JS accordion gets for free. The
            answers are also in the DOM unconditionally, which is what the
            FAQPage schema above claims. */}
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <Reveal key={f.question} delay={Math.min(i, 4) * 0.04}>
              <details className="glass-card group overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-base font-medium text-ink transition-colors duration-200 hover:bg-muted/5 [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span
                    aria-hidden
                    className="shrink-0 text-brand transition-transform duration-300 group-open:rotate-45"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      <path d="M6 12h12M12 6v12" />
                    </svg>
                  </span>
                </summary>
                <p className="m-0 px-[22px] pb-5 text-[15px] leading-[1.7] text-muted">
                  {f.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ support CTA */}
      <section className="px-6 pt-5 pb-[110px]">
        <Reveal>
          <div className="glass-panel mx-auto max-w-[900px] px-7 py-14 text-center">
            <span
              aria-hidden
              className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-card text-brand"
              style={{ background: "var(--color-tile-sky)" }}
            >
              <LinearHeadphone size={24} />
            </span>
            <h2 className="m-0 font-serif text-[clamp(26px,3.5vw,38px)] font-semibold tracking-[-0.02em] text-ink">
              Still stuck? A person answers.
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed text-muted">
              Cancellations, refunds, duplicate charges, invoices — one message
              covers all of it. We reply within one business day, and there is
              no bot to argue with first.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/contact" className={PRIMARY_BTN}>
                Contact support
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={GHOST_BTN}>
                <LinearSms size={18} />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
