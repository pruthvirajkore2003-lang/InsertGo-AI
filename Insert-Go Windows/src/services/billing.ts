/**
 * Dodo Payments (Merchant of Record) hosted checkout: the server returns a
 * URL and the user pays in the system browser — currency/tax localization
 * happens there, so no country/gateway picker on this side.
 */
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/services/apiConfig";
import { http } from "@/services/http";
import { openExternal } from "@/services/openExternal";
import { safeError } from "@/services/safeLog";
import { toast } from "@/store/toastStore";

// ── Pricing catalog (website lib/pricing.ts, served by /api/desktop/pricing) ─
// Mirrors of the website types. Both currency columns ship in the payload and
// the UI picks one for display; Dodo (Merchant of Record) localizes the real
// charge from the server-pinned product, so `Currency` never reaches checkout.

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

const SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

/** IANA zones for India — `Asia/Calcutta` is the legacy alias Windows and
 *  older ICU builds still resolve to. */
const INDIA_ZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

/**
 * Display currency for this machine, from the system timezone.
 *
 * The website reads the CDN's IP-country header, but the desktop has no such
 * header and /api/desktop/pricing is force-static (it can't vary per caller),
 * so the timezone is the zero-dependency signal available offline and without
 * a geolocation call. A VPN or a travelling laptop can disagree with the real
 * billing country — harmless, because this is display only: Dodo charges the
 * pinned product at its own regionalized price either way.
 */
export function detectCurrency(): Currency {
  try {
    return INDIA_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone)
      ? "INR"
      : "USD";
  } catch {
    // Locked-down webview with no ICU data: USD is the catalog's base column.
    return "USD";
  }
}

/** "$0", "$7.99", "₹499" — decimals only when the price has them (mirrors
 *  the site's `money()`). */
export function formatMoney(amount: number, currency: Currency): string {
  return `${SYMBOL[currency]}${
    Number.isInteger(amount) ? amount : amount.toFixed(2)
  }`;
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

/** What can be bought: a subscription tier or a one-time credit pack.
 *  The server (POST /api/billing/checkout) validates the payload against its
 *  own catalog — `{ tier: "plus" | "pro" }` or `{ pack: <credits> }` — so an
 *  unknown value is rejected there, not charged. */
export type CheckoutPayload = { tier: "plus" | "pro" } | { pack: number };

export async function startCheckout(payload: CheckoutPayload): Promise<void> {
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
      body: JSON.stringify(payload),
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
