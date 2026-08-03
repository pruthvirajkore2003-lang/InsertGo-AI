/**
 * Plan panel for the managed model (Monetization & Trust layer). There is one
 * route now that BYOK is gone — InsertGo Pro (Managed): subscription,
 * zero-setup relay, open to free/trial users. Conversion is optimized by being
 * radically transparent: the card carries a PrivacyIndicator showing the
 * literal data path BEFORE the user commits, and names its trade-off (relay in
 * the path) instead of hiding it.
 *
 * This is the ONE authoritative "Upgrade to Pro" call to action on the Profile
 * tab — AuthPanel deliberately carries no upgrade button (two competing CTAs
 * collided there). Payment happens on the website: hosted checkout in the
 * system browser (startProCheckout), with the public pricing page as the
 * secondary route.
 *
 * Trust plumbing: the relay holds the provider key server-side; the desktop app
 * never sees an LLM key (Desktop invariant #7).
 */
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { PrivacyIndicator } from "./PrivacyIndicator";
import { TIER_LABELS, useMonetizationStore } from "@/store/monetizationStore";
import { isPro, totalCredits, useAuthStore } from "@/store/authStore";
import {
  formatUsd,
  openPricingPage,
  planFor,
  startProCheckout,
} from "@/services/billing";
import { toast } from "@/store/toastStore";

/** Trial grant when the server reports no daily maximum (pre-3-tier build) —
 *  same default authStore falls back to for `credits`. */
const TRIAL_CREDITS = 50;
/** Meter turns amber here, red at zero — mirrors CreditBadge's thresholds. */
const LOW_CREDITS = 10;

/** Badge icons, positional. The labels come from the website's Pro plan when
 *  the catalog loaded; these four are the offline copy. Icons stay local —
 *  the catalog is text, and Font Awesome names are a desktop concern. */
const FEATURE_ICONS = ["fa-infinity", "fa-bolt", "fa-lock", "fa-bullseye"];
const FALLBACK_FEATURES = [
  "Unlimited Generations",
  "Flash Latency",
  "Zero Retention",
  "Universal Hotkey",
];

/** Shown until the pricing catalog loads, and whenever it can't be reached. */
const FALLBACK_PRICE_LINE = "7-day free trial (50 credits), then subscription";

/** Concrete jobs, not adjectives — the card has to answer "what would I use
 *  this for on a Tuesday". */
const USE_CASES = [
  "Rewrite a blunt Slack reply into something you'd actually send — in Slack.",
  "Turn three rough bullets into a client-ready email, without leaving Outlook.",
  "Tighten a Jira ticket, PR description or commit message in place.",
];

export function MonetizationOnboarding() {
  const tier = useMonetizationStore((s) => s.tier);
  const pricing = useMonetizationStore((s) => s.pricing);
  const loadPricing = useMonetizationStore((s) => s.loadPricing);
  const user = useAuthStore((s) => s.user);
  const signInWithBrowser = useAuthStore((s) => s.signInWithBrowser);
  const subscribed = isPro(user);

  const [busy, setBusy] = useState(false);

  // Loads once per session and never rejects; offline leaves the fallbacks up.
  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  const proPlan = planFor(pricing, "pro");
  const priceLine = subscribed
    ? "Subscription active — unlimited managed generations."
    : proPlan
      ? `7-day free trial (50 credits), then ${formatUsd(proPlan.price.USD)} ${proPlan.per}`
      : FALLBACK_PRICE_LINE;
  const features = proPlan?.features.length
    ? proPlan.features.slice(0, FEATURE_ICONS.length)
    : FALLBACK_FEATURES;

  const selectManaged = async () => {
    setBusy(true);
    try {
      if (!user) {
        await signInWithBrowser();
        return;
      }
      if (subscribed) {
        toast.success(
          "Managed mode active — requests use your InsertGo subscription."
        );
        return;
      }
      // Hosted checkout in the system browser; the billing webhook flips
      // the entitlement and refreshStatus() picks it up.
      await startProCheckout();
    } finally {
      setBusy(false);
    }
  };

  const managedCta = !user
    ? "Sign in for managed"
    : subscribed
      ? "Current plan"
      : "Upgrade to Pro";

  // Trial meter: total spendable (daily remaining + non-expiring add-on) over
  // the daily allowance. Only meaningful before subscribing.
  const left = totalCredits(user);
  const max = user?.dailyCreditsMax ?? TRIAL_CREDITS;
  const showMeter = Boolean(user) && !subscribed && max > 0;
  const pct = Math.max(0, Math.min(100, (left / max) * 100));
  const meterState = left <= 0 ? "out" : left <= LOW_CREDITS ? "low" : "ok";

  return (
    <MotionConfig reducedMotion="user">
      <section className="ig-plan" aria-label="Plan">
        <div className="ig-plan__head">
          <h3 className="ig-section-label">Your plan</h3>
          <span className="ig-plan__current">{TIER_LABELS[tier]}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="ig-plan__grid">
            <article className="ig-glass-card ig-plan-card ig-plan-card--active ig-plan-card--pro">
              <header className="ig-plan-card__head">
                <h4 className="ig-plan-card__title">InsertGo Pro · Managed</h4>
                <span className="ig-plan-card__chip">
                  {subscribed ? "Active" : "Trial"}
                </span>
              </header>
              <p className="ig-plan-card__price">{priceLine}</p>

              <ul className="ig-plan-card__badges" aria-label="What Pro includes">
                {features.map((label, i) => (
                  <li className="ig-plan-badge" key={label}>
                    <i
                      className={`fa-solid ${FEATURE_ICONS[i] ?? "fa-check"}`}
                      aria-hidden="true"
                    />
                    {label}
                  </li>
                ))}
              </ul>

              {showMeter && (
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

              <PrivacyIndicator />

              <ul className="ig-plan-card__list">
                {USE_CASES.map((u) => (
                  <li key={u}>{u}</li>
                ))}
                <li>No API keys or provider accounts to manage.</li>
                {/* The relay node is already in the route above; this line
                    only names what happens inside it. */}
                <li>Relayed prompts are never stored or trained on.</li>
              </ul>

              <div className="ig-plan-card__actions">
                <motion.button
                  type="button"
                  className="ig-btn ig-btn--primary ig-plan-card__cta"
                  disabled={busy || subscribed}
                  onClick={() => void selectManaged()}
                  whileHover={busy || subscribed ? undefined : { y: -1 }}
                  transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                >
                  {busy ? "Opening checkout…" : managedCta}
                </motion.button>
                <button
                  type="button"
                  className="ig-linkbtn"
                  onClick={() => void openPricingPage()}
                >
                  View pricing on the website
                </button>
              </div>
            </article>
          </div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
