/**
 * THE pricing catalog — one source of truth for the public pricing page
 * (app/pricing/PricingPlans.tsx) and the desktop app, which reads it over
 * /api/desktop/pricing instead of hardcoding its own copy (they drifted).
 *
 * Prices are per-currency literals, not FX conversions: the INR column is
 * PPP-adjusted charm pricing chosen for conversion, and both columns are
 * display only — Dodo (Merchant of Record) charges what the pinned product
 * says, so `currency` never reaches a checkout call. Nothing here is
 * authoritative for money; lib/dodo.ts pins the products the server charges.
 *
 * Pure data, no server-only imports: a client component, a route handler and
 * the desktop payload all read the same module.
 */

export type Currency = "USD" | "INR";

export type Money = Record<Currency, number>;

export type Plan = {
  name: string;
  tier: "plus" | "pro" | null;
  tagline: string;
  price: Money;
  /** Billing period as rendered next to the amount ("forever", "/ month"). */
  per: string;
  popular: boolean;
  dark: boolean;
  cta: string;
  features: string[];
};

export type Pack = { credits: number; price: Money };

export const plans: Plan[] = [
  {
    name: "Free",
    tier: null,
    tagline: "For trying the loop and light daily use.",
    price: { USD: 0, INR: 0 },
    per: "forever",
    popular: false,
    dark: false,
    cta: "Download free",
    features: [
      "5 credits every day",
      "Inline prompt optimization",
      "Global hotkey overlay",
      "Works in every Windows app",
      "Community support",
    ],
  },
  {
    name: "Plus",
    tier: "plus",
    tagline: "For people who write with AI every day.",
    price: { USD: 7.99, INR: 499 },
    per: "/ month",
    popular: true,
    dark: true,
    cta: "Get Plus",
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
    tagline: "For high-volume, all-day workflows.",
    price: { USD: 14.99, INR: 999 },
    per: "/ month",
    popular: false,
    dark: false,
    cta: "Get Pro",
    features: [
      "150 credits every day",
      "High-volume capacity",
      "Priority support",
      "Everything in Plus",
    ],
  },
];

/** Pack sizes mirror lib/dodo.ts CREDIT_PACKS; prices here are display only
 *  (the server pins the product, Dodo charges it). */
export const packs: Pack[] = [
  { credits: 50, price: { USD: 1.99, INR: 149 } },
  { credits: 150, price: { USD: 3.99, INR: 249 } },
  { credits: 350, price: { USD: 5.99, INR: 399 } },
  { credits: 500, price: { USD: 7.99, INR: 499 } },
];

/**
 * Catalogue price in INR for a purchase-return item key (`"plan:plus"`,
 * `"pack:150"`), or null when the key names nothing we sell.
 *
 * Reporting only — it is what the Google Ads conversion and the `purchase`
 * event carry as order value. It is NOT what anyone was charged: Dodo is
 * Merchant of Record and localises from the server-pinned product, so a buyer
 * outside India paid the USD column. Reporting one currency keeps the
 * conversion values comparable in the Ads account, which is the number bids are
 * set from; mixing two currencies into one conversion action silently makes
 * that number meaningless.
 */
export function inrPriceForItemKey(key: string): number | null {
  const [kind, value] = key.split(":");
  if (kind === "plan") {
    return plans.find((p) => p.tier === value)?.price.INR ?? null;
  }
  if (kind === "pack") {
    return packs.find((p) => String(p.credits) === value)?.price.INR ?? null;
  }
  return null;
}
