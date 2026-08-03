/**
 * Dodo Payments (Merchant of Record) hosted checkout: the server returns a
 * URL and the user pays in the system browser — currency/tax localization
 * happens there, so no country/gateway picker on this side.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/services/apiConfig";
import { http } from "@/services/http";
import { isTauri } from "@/services/tauriBridge";
import { safeError } from "@/services/safeLog";
import { toast } from "@/store/toastStore";

// ── Pricing catalog (website lib/pricing.ts, served by /api/desktop/pricing) ─
// Mirrors of the website types. The desktop renders USD only — it has no
// currency detection, and the old hardcoded copy was USD too; Dodo localizes
// at checkout regardless, so this stays display-only.

export type Currency = "USD" | "INR";
export type Money = Record<Currency, number>;

export type PricingPlan = {
  name: string;
  tier: "plus" | "pro" | null;
  price: Money;
  /** Billing period as rendered next to the amount ("forever", "/ month"). */
  per: string;
  features: string[];
};

export type PricingPack = { credits: number; price: Money };

export type PricingData = { plans: PricingPlan[]; packs: PricingPack[] };

/** "$0", "$7.99" — decimals only when the price has them (mirrors the site). */
export function formatUsd(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/** The catalog entry for a paid tier, or null when pricing hasn't loaded. */
export function planFor(
  pricing: PricingData | null,
  tier: "plus" | "pro"
): PricingPlan | null {
  return pricing?.plans.find((p) => p.tier === tier) ?? null;
}

// Remote JSON is untrusted input: anything malformed becomes `null` so the UI
// keeps its offline fallbacks rather than rendering `undefined`.
const isMoney = (v: any): v is Money =>
  !!v && Number.isFinite(v.USD) && Number.isFinite(v.INR);

const isPlan = (v: any): v is PricingPlan =>
  !!v &&
  typeof v.name === "string" &&
  (v.tier === null || v.tier === "plus" || v.tier === "pro") &&
  typeof v.per === "string" &&
  isMoney(v.price) &&
  Array.isArray(v.features) &&
  v.features.every((f: unknown) => typeof f === "string");

const isPack = (v: any): v is PricingPack =>
  !!v && Number.isFinite(v.credits) && isMoney(v.price);

/**
 * Fetch the public pricing catalog. Unauthenticated (the `/api/desktop/`
 * namespace is exempt from http()'s signed-out gate), so plan copy is
 * available before sign-in.
 *
 * Returns null on any failure — offline, captive portal, malformed body. The
 * caller keeps whatever it had; pricing is never worth an error toast.
 */
export async function fetchPricing(): Promise<PricingData | null> {
  try {
    const response = await http(`${API_URL}/api/desktop/pricing`, {
      method: "GET",
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data?.plans) || !Array.isArray(data?.packs)) return null;
    if (!data.plans.every(isPlan) || !data.packs.every(isPack)) return null;
    return { plans: data.plans, packs: data.packs };
  } catch (e) {
    safeError("Failed to load pricing (using built-in fallbacks)", e);
    return null;
  }
}

/** System browser (opener plugin scope allows insertgo.ai + the Dodo hosts);
 *  browser dev mode falls back to a tab. */
async function openExternal(url: string): Promise<void> {
  if (isTauri()) await openUrl(url);
  else window.open(url, "_blank");
}

/** Public pricing page — the compare-tiers / credit-packs route, and the
 *  fallback when hosted checkout can't be started (no session yet). */
export async function openPricingPage(): Promise<void> {
  try {
    await openExternal(`${API_URL}/pricing`);
  } catch (e) {
    toast.error(
      `Couldn't open the pricing page: ${e instanceof Error ? e.message : e}`
    );
  }
}

export async function startProCheckout(): Promise<void> {
  const token = useAuthStore.getState().token;
  // No session = no per-user checkout URL; the public pricing page is the
  // honest destination instead of a dead button.
  if (!token) return openPricingPage();

  try {
    const response = await http(`${API_URL}/api/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tier: "pro" }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data.error || "Checkout failed");
    }
    await openExternal(data.url);
  } catch (e) {
    // Never alert(): a webview modal blocks every later Tauri event.
    toast.error(
      `Billing redirect failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
