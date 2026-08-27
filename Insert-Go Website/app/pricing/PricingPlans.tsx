"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { FadeUp } from "@/components/Reveal";
import { packs, plans, type Currency } from "@/lib/pricing";
import {
  detectClientCurrency,
  writeCurrencyCookie,
} from "@/lib/currency";
import { CurrencySelector } from "./CurrencySelector";
import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";

/**
 * 3-tier pricing + non-expiring add-on credit packs.
 *
 * Conversion layout: Plus is the visual anchor ("Most popular", dark card,
 * middle position) so Free reads as the on-ramp and Pro as headroom. Packs
 * carry per-credit unit pricing so the larger packs sell themselves; the
 * comparison matrix answers "what exactly do I get" without leaving the page.
 * Checkout goes through /api/billing/checkout (server-pinned products —
 * nothing money-shaped leaves this file).
 *
 * The plans/packs catalog lives in lib/pricing.ts because the desktop app
 * reads the same data over /api/desktop/pricing — this page is one renderer of
 * it, not the source of truth. The comparison matrix stays here: it is page
 * layout, not catalog.
 */

export type { Currency };

const SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

/** The tiers a session can be on — `plans[].tier` widened with the free row. */
type Tier = "free" | "plus" | "pro";

/**
 * Plan ordering, so "you already pay for something that covers this" is one
 * comparison instead of a table of special cases. Ranks, not prices: what a
 * card offers a visitor depends on where the tier sits above or below theirs,
 * and prices are per-currency display values that must not drive logic.
 */
const RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

/** "$0", "$7.99", "₹499" — decimals only when the price actually has them. */
function money(amount: number, currency: Currency): string {
  return `${SYMBOL[currency]}${
    Number.isInteger(amount) ? amount : amount.toFixed(2)
  }`;
}

const matrix: { label: string; values: [string, string, string] }[] = [
  { label: "Daily credits", values: ["5", "50", "150"] },
  { label: "Inline prompt optimization", values: ["✓", "✓", "✓"] },
  { label: "Works in every Windows app", values: ["✓", "✓", "✓"] },
  { label: "Managed AI — no API key setup", values: ["✓", "✓", "✓"] },
  { label: "Interaction history", values: ["—", "✓", "✓"] },
  { label: "Add-on credit packs", values: ["✓", "✓", "✓"] },
  { label: "High-volume capacity", values: ["—", "—", "✓"] },
  { label: "Support", values: ["Community", "Standard", "Priority"] },
];

/**
 * India's standard GST rate on software services. Prices in the catalogue are
 * tax-EXCLUSIVE (Dodo's products are, and it adds the regional tax at its
 * hosted checkout), so an INR shopper who sees only "₹499" is being shown a
 * price they cannot actually pay — which is drip pricing under the CCPA's
 * Guidelines for Prevention and Regulation of Dark Patterns, 2023. Stating the
 * rate and the resulting total up front is the fix.
 *
 * Deliberately NOT phrased as tax-INCLUSIVE: that would be false here, and a
 * false statement about money is a worse problem than the one it papers over.
 * (The disclosures test asserts the tax-inclusive phrasing appears nowhere in
 * this file, so keep it out of comments too.)
 */
const GST_RATE = 0.18;

/** "₹499 + 18% GST = ₹588.82 total". Rendered next to every INR price. */
function gstNote(amount: number): string {
  if (amount === 0) return "";
  const total = amount * (1 + GST_RATE);
  return `₹${amount} + ${Math.round(GST_RATE * 100)}% GST = ₹${total.toFixed(
    2,
  )} total`;
}

/**
 * The California ARL / FTC ROSCA disclosure, rendered immediately beneath the
 * subscribe button rather than in a page footer.
 *
 * Cal. Bus. & Prof. Code §17601(c) requires the automatic-renewal terms to be
 * presented "in visual proximity" to the request for consent — the button —
 * and §17602 makes a charge taken without that disclosure an unconditional
 * gift to the consumer. So this component lives at the call site of the
 * checkout button, and every future checkout button must carry one too.
 */
function RenewalTerms({
  amount,
  currency,
}: {
  amount: number;
  currency: Currency;
}) {
  return (
    <p className="mt-2.5 mb-0 text-left text-[12px] leading-[1.5] text-muted">
      By subscribing, you authorize a recurring charge of{" "}
      <strong className="font-medium text-ink-soft">
        {money(amount, currency)}
        {currency === "INR" ? " + GST" : " plus tax"}
      </strong>{" "}
      to your payment method every month until you cancel. Your first charge is
      today.{" "}
      <Link
        href="/account"
        className="font-medium text-brand no-underline hover:underline"
      >
        Cancel anytime online in Account settings
      </Link>{" "}
      — one click, no email or phone call. Cancelling stops the next renewal
      and you keep the plan until the period you have paid for ends. See the{" "}
      <Link
        href="/terms"
        className="font-medium text-brand no-underline hover:underline"
      >
        Terms
      </Link>{" "}
      and{" "}
      <Link
        href="/cancel"
        className="font-medium text-brand no-underline hover:underline"
      >
        cancellation &amp; refund policy
      </Link>
      .
    </p>
  );
}

/**
 * The already-subscribed counterpart to RenewalTerms, shown on the card of the
 * plan the visitor is currently on.
 *
 * §17601(c)'s "visual proximity" limb attaches to a request for consent to a
 * NEW charge, and this card no longer makes one — but the renewal it already
 * authorised is still live, and §17602(c)'s one-click cancellation still has
 * to be one click from wherever the subscriber happens to be standing. So the
 * pre-purchase terms give way to the state of the subscription plus the same
 * cancel route, not to silence.
 *
 * Deliberately states no amount: this is an existing subscription, and the
 * catalogue figure above is a display price in one of two currencies, not
 * necessarily what this person is charged. The account page reads the real
 * one. Runs the same handful of lines as the terms it replaces, so the swap
 * when the session resolves moves nothing on the page.
 */
function ActivePlanNote({ name }: { name: string }) {
  return (
    <p className="mt-2.5 mb-0 text-left text-[12px] leading-[1.5] text-muted">
      Your <strong className="font-medium text-ink-soft">{name}</strong>{" "}
      subscription is active and renews automatically each month until you
      cancel.{" "}
      <Link
        href="/account"
        className="font-medium text-brand no-underline hover:underline"
      >
        Cancel anytime online in Account settings
      </Link>{" "}
      — one click, no email or phone call. Cancelling stops the next renewal
      and you keep the plan until the period you have paid for ends. See the{" "}
      <Link
        href="/terms"
        className="font-medium text-brand no-underline hover:underline"
      >
        Terms
      </Link>{" "}
      and{" "}
      <Link
        href="/cancel"
        className="font-medium text-brand no-underline hover:underline"
      >
        cancellation &amp; refund policy
      </Link>
      . Add-on credit packs never expire and are used after your daily credits.
    </p>
  );
}

/** Cents read naturally for USD; rupee sub-units don't, so INR stays in ₹. */
function perCredit(
  amount: number,
  credits: number,
  currency: Currency
): string {
  return currency === "INR"
    ? `₹${(amount / credits).toFixed(2)} / credit`
    : `${((amount / credits) * 100).toFixed(1)}¢ / credit`;
}

/** Rendered directly beneath whichever grid the failed button lives in. */
function CheckoutError({ text }: { text: string }) {
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      className="mx-auto mt-5 max-w-[420px] rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-center text-sm text-danger"
    >
      {text}
    </motion.p>
  );
}

export function PricingPlans({
  currency: initialCurrency,
  /** False when the server resolved neither a cookie nor a geo header — the
   *  only case the client's timezone/locale guess is allowed to overrule. */
  geoResolved = true,
}: {
  currency: Currency;
  geoResolved?: boolean;
}) {
  // Server-detected column is the first render, on both sides of hydration —
  // any client-side guess happens in an effect BELOW, after React has matched
  // the markup. Reading Intl/navigator during render is exactly how a pricing
  // page hydrates as "$7.99" over a server-rendered "₹499".
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  useEffect(() => {
    if (geoResolved) return;
    // No cookie and no edge geolocation: localhost, a VPN, or a CDN that
    // strips the header. Timezone/UI language is the last signal available,
    // and it only ever answers "INR" — a null leaves the server's USD alone.
    const guess = detectClientCurrency();
    if (guess) setCurrency(guess);
  }, [geoResolved]);

  /** Persist the choice so the next server render paints it directly — a
   *  cookie-less switch would flash the old column on every navigation. */
  const chooseCurrency = (next: Currency) => {
    setCurrency(next);
    writeCurrencyCookie(next);
  };

  // customSession (lib/auth.ts) stamps the server-authoritative plan tier onto
  // the session user — the same value /account and the nav badge read. The
  // auth client's type doesn't carry it, hence the narrow cast, and an
  // unrecognised string falls back to free rather than being trusted.
  const { data: session, isPending } = useSession();
  const rawTier = (session?.user as { tier?: string } | undefined)?.tier;
  // null means "not resolved or not signed in" — both render the public page.
  const userTier: Tier | null = session
    ? rawTier === "plus" || rawTier === "pro"
      ? rawTier
      : "free"
    : null;
  const currentPlanName =
    plans.find((p) => (p.tier ?? "free") === userTier)?.name ?? "your plan";
  const [busy, setBusy] = useState<string | null>(null);
  // Which control the failure belongs to. A single alert pinned under the
  // plans meant a failed pack purchase reported itself two sections above the
  // button that was pressed — off-screen, so the click looked like a no-op.
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null
  );
  const isPack = (key: string) => key.startsWith("pack-");

  /** POST the catalog selector; the server owns products and prices. */
  const checkout = async (
    key: string,
    body: { tier: "plus" | "pro" } | { pack: number }
  ) => {
    setBusy(key);
    setError(null);
    const fail = (message: string) => setError({ key, message });
    // Fired on intent, before the gateway round trip: the drop-off between
    // this and the `purchase` event on the return page IS the checkout funnel,
    // and an event fired after the redirect would never reach the browser.
    trackEvent(AnalyticsEvent.CheckoutStarted, {
      item: "tier" in body ? `plan:${body.tier}` : `pack:${body.pack}`,
      currency,
    });
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.url) {
        fail(data?.error ?? "Could not start checkout — please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      fail("Could not start checkout — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* ── Plans ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1080px] px-6 pt-[50px] pb-10">
        {/* Above the cards, not buried in a footer: geolocation is a guess,
            and the visitor it guessed wrong for needs the fix before they
            read a price, not after. */}
        <FadeUp>
          <div className="mb-9 flex justify-center">
            <CurrencySelector value={currency} onChange={chooseCurrency} />
          </div>
        </FadeUp>
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] items-stretch gap-5"
          // The cards restate themselves once the session lands; announcing
          // the region as busy is what stops a screen reader presenting the
          // public wording as final.
          aria-busy={isPending}
        >
          {plans.map((p, i) => {
            // Where this card's tier sits relative to the visitor's. While the
            // session is unresolved `userTier` is null and every flag is
            // false, which is exactly the signed-out page.
            const planTier: Tier = p.tier ?? "free";
            const isCurrentPlan = userTier === planTier;
            const isIncluded =
              userTier !== null && RANK[planTier] < RANK[userTier];
            const isUpgrade =
              userTier !== null && RANK[planTier] > RANK[userTier];
            return (
            <FadeUp key={p.name} delay={0.22 + i * 0.08}>
              <div className={`h-full ${p.popular ? "lg:scale-[1.03]" : ""}`}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className={`relative flex h-full flex-col overflow-visible p-8 px-7 ${
                    p.dark ? "glass-floating" : "glass-card"
                  } ${
                    p.popular || isCurrentPlan
                      ? "z-10 border border-accent-primary/50 shadow-[0_24px_90px_-24px_rgba(47,107,255,0.45)] ring-1 ring-accent-primary/40"
                      : ""
                  }`}
                >
                  {(p.popular || isCurrentPlan) && (
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-x-8 top-0 h-28 rounded-full blur-2xl ${
                        isCurrentPlan && planTier === "pro"
                          ? "bg-sky-400/15"
                          : "bg-accent-primary/15"
                      }`}
                    />
                  )}
                  {/* One badge slot, two audiences: a prospect gets the
                      persuasion mark, a subscriber gets the recognition one.
                      Both at once would overlap in the same 3px of card. The
                      card above is overflow-visible, so the pill at -top-3
                      floats over the top border instead of being clipped by
                      .glass-card's overflow:hidden. */}
                  {p.popular && !isCurrentPlan && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-primary px-3 py-[5px] text-[11px] font-medium tracking-[0.1em] whitespace-nowrap text-on-accent uppercase shadow-[0_6px_24px_rgba(47,107,255,0.5)]">
                      Most popular
                    </span>
                  )}
                  {isCurrentPlan && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 22,
                      }}
                      className={`absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-[5px] text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase ${
                        planTier === "pro"
                          ? "border border-sky-400/40 bg-sky-500/20 text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.35)]"
                          : planTier === "plus"
                            ? "border border-brand/40 bg-brand/20 text-indigo-200 shadow-[0_0_16px_rgba(47,107,255,0.35)]"
                            : "glass-chip border border-white/20 text-ink-soft"
                      }`}
                    >
                      {/* Live-membership dot; currentColor keeps it on-tier. */}
                      <span
                        aria-hidden
                        className="size-1.5 animate-pulse rounded-full bg-current"
                      />
                      Current plan
                    </motion.span>
                  )}
                <h2
                  className={`m-0 font-serif text-xl font-semibold ${
                    p.dark ? "text-on-accent" : "text-ink"
                  }`}
                >
                  {p.name}
                </h2>
                <p className="mt-1.5 mb-0 text-sm leading-normal text-muted">
                  {p.tagline}
                </p>
                <div className="mt-[22px] flex items-baseline gap-1.5">
                  <span
                    className={`text-[44px] font-semibold tracking-[-0.03em] ${
                      p.dark ? "text-on-accent" : "text-ink"
                    }`}
                  >
                    {money(p.price[currency], currency)}
                  </span>
                  <span className="text-sm text-muted">{p.per}</span>
                </div>
                {currency === "INR" && p.price.INR > 0 && (
                  <p className="mt-1 mb-0 text-[12px] text-muted">
                    {gstNote(p.price.INR)}
                  </p>
                )}
                {/* Cross-fades rather than hard-swapping when the session
                    lands. Rendered VISIBLE while it is still pending, on
                    purpose: a subscriber briefly seeing the public wording
                    self-corrects in a few hundred ms, whereas a checkout
                    button held behind a session request that never settles
                    does not. Every state runs the same height — the h-12
                    control plus a note the length of the renewal terms — so
                    the swap moves nothing below it. */}
                <motion.div
                  key={userTier ?? "guest"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col"
                >
                {isCurrentPlan && p.tier ? (
                  /* Already paying for this tier. Selling it again is how a
                     second subscription gets bought by accident, so the only
                     control left is the one that manages the live one. */
                  <>
                    <Link
                      href="/account"
                      className="mt-[22px] flex h-12 items-center justify-center rounded-3xl bg-accent-primary text-[15px] font-medium text-on-accent shadow-[0_8px_28px_rgba(47,107,255,0.4)] transition-[transform,filter] duration-200 hover:-translate-y-px hover:bg-accent-hover hover:brightness-105"
                    >
                      Manage in Account
                    </Link>
                    <ActivePlanNote name={p.name} />
                  </>
                ) : isCurrentPlan || isIncluded ? (
                  /* Free while signed in, or a tier the visitor's plan already
                     covers: nothing to buy here, so nothing that looks
                     buyable. Free keeps its download route either way. */
                  <>
                    <span
                      aria-current={isCurrentPlan ? "true" : undefined}
                      className="glass-chip mt-[22px] flex h-12 items-center justify-center rounded-3xl text-[15px] font-medium text-muted ring-1 ring-white/10"
                    >
                      {isCurrentPlan
                        ? "Current plan"
                        : planTier === "free"
                          ? "Included in your plan"
                          : `Included with ${currentPlanName}`}
                    </span>
                    {planTier === "free" && (
                      <p className="mt-2.5 mb-0 text-left text-[12px] leading-[1.5] text-muted">
                        <Link
                          href="/download"
                          className="font-medium text-brand no-underline hover:underline"
                        >
                          Download for Windows
                        </Link>{" "}
                        — nothing to renew, nothing to cancel.
                      </p>
                    )}
                  </>
                ) : p.tier ? (
                  <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void checkout(p.tier!, { tier: p.tier! })}
                    className={`mt-[22px] flex h-12 cursor-pointer items-center justify-center rounded-3xl text-[15px] font-medium transition-[transform,filter,opacity,background-color] duration-200 hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70 ${
                      p.dark
                        ? "bg-accent-primary text-on-accent hover:bg-accent-hover"
                        : "glass-chip text-ink ring-1 ring-white/15 hover:ring-accent-primary/60"
                    }`}
                  >
                    {busy === p.tier
                      ? "Opening checkout…"
                      : isUpgrade
                        ? `Upgrade to ${p.name}`
                        : p.cta}
                  </button>
                  {/* Immediately below the button, never in a footer — see
                      RenewalTerms. */}
                  <RenewalTerms amount={p.price[currency]} currency={currency} />
                  </>
                ) : (
                  <Link
                    href="/download"
                    className="glass-chip mt-[22px] flex h-12 items-center justify-center rounded-3xl text-[15px] font-medium text-ink ring-1 ring-white/15 transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-105 hover:ring-accent-primary/60"
                  >
                    {p.cta}
                  </Link>
                )}
                </motion.div>
                <div
                  className={`my-6 mb-5 h-px ${p.dark ? "bg-dark-2" : "bg-line"}`}
                />
                <div className="flex flex-col gap-3">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex shrink-0 text-brand">
                        <LinearTickCircle size={15} />
                      </span>
                      <span
                        className={`text-sm leading-normal ${
                          p.dark ? "text-ink/85" : "text-ink-soft"
                        }`}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
                </motion.div>
              </div>
            </FadeUp>
            );
          })}
        </div>
        {/* Dodo's products are tax-exclusive, so its hosted checkout adds the
            regional tax on top of every figure above. Stating it here is
            cheaper than the "why is it more than the price?" support ticket. */}
        <p className="mt-6 text-center text-[13px] text-muted">
          Prices exclude tax — taxes (e.g. VAT/GST) are calculated at checkout.
        </p>
        {error && !isPack(error.key) && <CheckoutError text={error.message} />}
      </section>

      {/* ── Add-on credit packs ───────────────────────────────────────── */}
      <section id="packs" className="mx-auto max-w-[1080px] px-6 pt-10 pb-10">
        <FadeUp>
          <p className="mb-3 text-center text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Top up anytime
          </p>
          <h2 className="m-0 text-center font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
            Add-on credit packs
          </h2>
          <p className="mx-auto mt-2 mb-8 max-w-[480px] text-center text-[15px] leading-relaxed text-muted">
            Top up any plan. Pack credits never expire and are only used after
            your daily credits run out. Prices exclude tax — taxes (e.g.
            VAT/GST) are calculated at checkout.
          </p>
        </FadeUp>
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack, i) => {
            const best = i === packs.length - 1;
            const savePct = best
              ? Math.round(
                  (1 -
                    pack.price[currency] /
                      pack.credits /
                      (packs[0].price[currency] / packs[0].credits)) *
                    100,
                )
              : 0;
            return (
              <FadeUp key={pack.credits} delay={0.1 + i * 0.06}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className={`relative flex h-full flex-col items-center text-center ${
                    best
                      ? "glass-floating z-10 border-accent-primary/40 p-7 pt-8 ring-1 ring-accent-primary/30"
                      : "glass-card p-6"
                  }`}
                >
                  {best && (
                    <>
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-primary px-3 py-[5px] text-[11px] font-medium tracking-[0.1em] whitespace-nowrap text-on-accent uppercase">
                        Best value
                      </span>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-accent-primary/15 blur-2xl"
                      />
                    </>
                  )}
                  <span
                    className={`font-semibold tracking-[-0.03em] ${
                      best ? "text-[42px] text-ink" : "text-[34px] text-ink"
                    }`}
                  >
                    {pack.credits}
                  </span>
                  <span className="text-xs tracking-[0.08em] text-muted uppercase">
                    credits
                  </span>
                  <span
                    className={`mt-3 font-medium ${
                      best ? "text-xl text-brand" : "text-lg text-ink"
                    }`}
                  >
                    {money(pack.price[currency], currency)}
                  </span>
                  <span
                    className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      best
                        ? "bg-tile-sky text-brand"
                        : "glass-chip text-muted"
                    }`}
                  >
                    {perCredit(pack.price[currency], pack.credits, currency)}
                  </span>
                  {currency === "INR" && (
                    <span className="mt-1.5 text-[11px] text-muted">
                      {gstNote(pack.price.INR)}
                    </span>
                  )}
                  {best && (
                    <span className="mt-2 text-[11px] font-medium text-muted">
                      Save {savePct}% per credit vs the 50 pack
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void checkout(`pack-${pack.credits}`, {
                        pack: pack.credits,
                      })
                    }
                    className={`mt-4 flex w-full cursor-pointer items-center justify-center rounded-2xl text-sm font-medium transition-[transform,filter,opacity,background-color] duration-200 hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70 ${
                      best
                        ? "h-11 bg-accent-primary text-on-accent hover:bg-accent-hover"
                        : "glass-chip h-10 text-ink"
                    }`}
                  >
                    {busy === `pack-${pack.credits}` ? "Opening…" : "Buy pack"}
                  </button>
                  {/* The other half of the ARL story: saying plainly what does
                      NOT auto-renew is what stops "recurring" reading as the
                      default for everything on the page. */}
                  <span className="mt-2 text-[11px] leading-snug text-muted">
                    One-time charge{currency === "INR" ? " plus GST" : " plus tax"}.
                    Not a subscription — nothing renews, and the credits never
                    expire.
                  </span>
                </motion.div>
              </FadeUp>
            );
          })}
        </div>
        {error && isPack(error.key) && <CheckoutError text={error.message} />}
      </section>

      {/* ── Comparison matrix ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[880px] px-6 pt-6 pb-10">
        <FadeUp>
          <p className="mb-3 text-center text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Side by side
          </p>
          <h2 className="m-0 mb-6 text-center font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
            Compare plans
          </h2>
        </FadeUp>
        <FadeUp delay={0.08}>
          <div className="glass-card overflow-x-auto p-2">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left font-medium text-muted" />
                  {plans.map((p) => (
                    <th
                      key={p.name}
                      className={`p-3 text-center font-serif text-base font-semibold ${
                        p.popular
                          ? "rounded-t-lg bg-accent-primary/10 text-brand"
                          : "text-ink"
                      }`}
                    >
                      {p.name}
                      <span className="block font-sans text-xs font-normal text-muted">
                        {money(p.price[currency], currency)}
                        {p.per === "forever" ? "" : "/mo"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, ri) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="p-3 text-ink-soft">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className={`p-3 text-center ${
                          v === "—" ? "text-muted" : "text-ink"
                        } ${
                          i === 1
                            ? `bg-accent-primary/5 ${
                                ri === matrix.length - 1 ? "rounded-b-lg" : ""
                              }`
                            : ""
                        }`}
                      >
                        {v === "✓" ? (
                          <span className="inline-flex text-brand">
                            <LinearTickCircle size={16} />
                          </span>
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
