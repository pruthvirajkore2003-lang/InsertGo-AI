/**
 * Plan panel for the managed model (Monetization & Trust layer). The catalog
 * comes from the website over /api/desktop/pricing (useMonetizationStore) —
 * Free / Plus / Pro subscriptions side-by-side, with consumable add-on credit
 * packs in a subordinate grid below. Plus carries the "Most Popular" marker
 * (side-by-side comparison, highlighted middle tier).
 *
 * This is the ONE authoritative plan/purchase call to action on the Profile
 * tab — AuthPanel deliberately carries no upgrade button (two competing CTAs
 * collided there). Payment happens on the website: hosted checkout in the
 * system browser (startCheckout), with the public pricing page as the
 * secondary route.
 *
 * Trust plumbing: the relay holds the provider key server-side; the desktop app
 * never sees an LLM key (Desktop invariant #7).
 */
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { TIER_LABELS, useMonetizationStore } from "@/store/monetizationStore";
import { isPro, totalCredits, useAuthStore } from "@/store/authStore";
import {
  detectCurrency,
  formatMoney,
  openPricingPage,
  startCheckout,
  type CheckoutPayload,
  type PricingPlan,
} from "@/services/billing";

/** Trial grant when the server reports no daily maximum (pre-3-tier build) —
 *  same default authStore falls back to for `credits`. */
const TRIAL_CREDITS = 50;
/** Meter turns amber here, red at zero — mirrors CreditBadge's thresholds. */
const LOW_CREDITS = 10;

/** Badge icons, positional. The labels come from the website catalog when it
 *  loaded; icons stay local — the catalog is text, and Font Awesome names are
 *  a desktop concern. Positions past the end fall back to a check. */
const FEATURE_ICONS = ["fa-infinity", "fa-bolt", "fa-lock", "fa-bullseye"];

/** 4-6 bullets per card — a compact desktop window can't host a feature
 *  matrix, and longer lists lose the side-by-side comparison. */
const MAX_FEATURES = 6;

/** Offline copy, mirroring the website catalog (lib/pricing.ts). Shown until
 *  the catalog loads and whenever it can't be reached — checkout still works,
 *  only the display copy is local. Exported so the tests assert CTA labels
 *  against these names instead of re-hardcoding them (the drift that left this
 *  file's suite red). */
export const FALLBACK_PLANS: PricingPlan[] = [
  {
    name: "Free",
    tier: null,
    price: { USD: 0, INR: 0 },
    per: "forever",
    features: [
      "5 credits every day",
      "Inline prompt optimization",
      "Global hotkey overlay",
      "Works in every Windows app",
    ],
  },
  {
    name: "Plus",
    tier: "plus",
    price: { USD: 7.99, INR: 499 },
    per: "/ month",
    features: [
      "50 credits every day",
      "Interaction history",
      "Inline prompt optimization",
      "Everything in Free",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    price: { USD: 14.99, INR: 999 },
    per: "/ month",
    features: [
      "150 credits every day",
      "High-volume capacity",
      "Priority support",
      "Everything in Plus",
    ],
  },
];

export function MonetizationOnboarding() {
  const tier = useMonetizationStore((s) => s.tier);
  const pricing = useMonetizationStore((s) => s.pricing);
  const loadPricing = useMonetizationStore((s) => s.loadPricing);
  const user = useAuthStore((s) => s.user);
  const signInWithBrowser = useAuthStore((s) => s.signInWithBrowser);
  const subscribed = isPro(user);

  /** Key of the card whose checkout/sign-in is in flight, so one pending
   *  action doesn't freeze every button on the panel. */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Which price column to render. Pure and sync (one Intl lookup), so it does
  // not need memoizing — and re-reading it per render means a timezone change
  // is picked up without a restart.
  const currency = detectCurrency();

  // Loads once per session and never rejects; offline leaves the fallbacks up.
  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  // Null pricing (loading/offline) keeps the fallback catalog — the layout,
  // buttons and meter are identical either way.
  const plans = pricing?.plans ?? FALLBACK_PLANS;
  const packs = pricing?.packs ?? [];

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
    } finally {
      setBusyKey(null);
    }
  };

  /** Gate shared by every purchase: sign in first, then hosted checkout in
   *  the system browser (the billing webhook flips the entitlement and
   *  refreshStatus() picks it up). */
  const purchase = (key: string, payload: CheckoutPayload) =>
    void run(key, async () => {
      if (!user) {
        await signInWithBrowser();
        return;
      }
      await startCheckout(payload);
    });

  // Trial meter: total spendable (daily remaining + non-expiring add-on) over
  // the daily allowance. Lives in the Free card and is only meaningful
  // before subscribing.
  const left = totalCredits(user);
  const max = user?.dailyCreditsMax ?? TRIAL_CREDITS;
  const showMeter = Boolean(user) && !subscribed && max > 0;
  const pct = Math.max(0, Math.min(100, (left / max) * 100));
  const meterState = left <= 0 ? "out" : left <= LOW_CREDITS ? "low" : "ok";

  const planCard = (plan: PricingPlan) => {
    const key = `plan:${plan.tier ?? "free"}`;
    const busy = busyKey === key;
    const recommended = plan.tier === "plus";

    const chip = recommended
      ? "Most Popular"
      : subscribed && plan.tier
        ? "Included"
        : !subscribed && !plan.tier && user
          ? "Current"
          : null;

    // Free tier never goes to checkout: signed-out users sign in, trial users
    // are already on it. Paid tiers are disabled once subscribed (packs stay
    // enabled — consumables top up an active subscription).
    const cta = !plan.tier
      ? !user
        ? { label: "Sign in to start free", disabled: false }
        : subscribed
          ? { label: "Free tier", disabled: true }
          : { label: "Current plan", disabled: true }
      : !user
        ? { label: `Sign in for ${plan.name}`, disabled: false }
        : subscribed
          ? { label: "Subscription active", disabled: true }
          : { label: `Get ${plan.name}`, disabled: false };

    return (
      <article
        key={key}
        className={`ig-glass-card ig-plan-card${recommended ? " ig-plan-card--active ig-plan-card--pro" : ""}`}
      >
        <header className="ig-plan-card__head">
          <h4 className="ig-plan-card__title">{plan.name}</h4>
          {chip && <span className="ig-plan-card__chip">{chip}</span>}
        </header>
        <p className="ig-plan-card__price">
          {formatMoney(plan.price[currency], currency)} {plan.per}
        </p>

        <ul
          className="ig-plan-card__badges"
          aria-label={`What ${plan.name} includes`}
        >
          {plan.features.slice(0, MAX_FEATURES).map((label, i) => (
            <li className="ig-plan-badge" key={label}>
              <i
                className={`fa-solid ${FEATURE_ICONS[i] ?? "fa-check"}`}
                aria-hidden="true"
              />
              {label}
            </li>
          ))}
        </ul>

        {!plan.tier && showMeter && (
          <div className={`ig-meter ig-meter--${meterState}`}>
            <div className="ig-meter__head">
              <span>Trial credits</span>
              <span>
                {left}/{max} remaining
              </span>
            </div>
            <div
              className="ig-meter__track"
              role="progressbar"
              aria-valuenow={left}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label="Trial credits remaining"
            >
              <span className="ig-meter__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="ig-plan-card__actions">
          <motion.button
            type="button"
            className={`ig-btn ${recommended ? "ig-btn--primary" : ""} ig-plan-card__cta`}
            disabled={cta.disabled || busyKey !== null}
            onClick={() =>
              plan.tier
                ? purchase(key, { tier: plan.tier })
                : void run(key, async () => {
                    await signInWithBrowser();
                  })
            }
            whileHover={
              cta.disabled || busyKey !== null ? undefined : { y: -1 }
            }
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
            {busy ? "Opening checkout…" : cta.label}
          </motion.button>
        </div>
      </article>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className="ig-plan" aria-label="Plans and credit packs">
        <div className="ig-plan__head">
          <h3 className="ig-section-label">Your plan</h3>
          <span className="ig-plan__current">{TIER_LABELS[tier]}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="ig-plan__grid">{plans.map(planCard)}</div>
        </motion.div>

        {/* Dodo's products are tax-exclusive, so the hosted checkout adds the
            regional tax on top of every figure above. Saying so here is
            cheaper than the "why is it more than the price?" support ticket. */}
        <p className="ig-muted" style={{ margin: 0, textAlign: "center" }}>
          Prices exclude tax — taxes (e.g. VAT/GST) are calculated at checkout.
        </p>

        {/* Consumables are visually subordinate to subscriptions: one-time
            top-ups, no plan change. Offline there is no catalog, so the
            section simply stays hidden. */}
        {packs.length > 0 && (
          <>
            <div className="ig-plan__head">
              <h3 className="ig-section-label">Add-on credit packs</h3>
              <span className="ig-plan__current">One-time · never expire</span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.26,
                ease: [0.32, 0.72, 0, 1],
                delay: 0.06,
              }}
            >
              <div
                className="ig-plan__grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                }}
              >
                {packs.map((pack) => {
                  const key = `pack:${pack.credits}`;
                  const busy = busyKey === key;
                  return (
                    <article key={key} className="ig-glass-card ig-plan-card">
                      <header className="ig-plan-card__head">
                        <h4 className="ig-plan-card__title">
                          {pack.credits} credits
                        </h4>
                      </header>
                      <p className="ig-plan-card__price">
                        {formatMoney(pack.price[currency], currency)} one-time
                      </p>
                      <div className="ig-plan-card__actions">
                        <motion.button
                          type="button"
                          className="ig-btn ig-plan-card__cta"
                          disabled={busyKey !== null}
                          onClick={() => purchase(key, { pack: pack.credits })}
                          whileHover={
                            busyKey !== null ? undefined : { y: -1 }
                          }
                          transition={{
                            duration: 0.15,
                            ease: [0.32, 0.72, 0, 1],
                          }}
                        >
                          {busy
                            ? "Opening checkout…"
                            : !user
                              ? "Sign in to buy"
                              : "Buy credits"}
                        </motion.button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}

        <button
          type="button"
          className="ig-linkbtn"
          style={{ alignSelf: "center" }}
          onClick={() => void openPricingPage()}
        >
          View pricing on the website
        </button>
      </section>
    </MotionConfig>
  );
}
