/**
 * Monetization & Trust layer. Every request goes through the managed InsertGo
 * relay (the "proxy" lane) — the desktop app never holds an LLM key, so the
 * only entitlement questions left are "how many credits" and "is history
 * unlocked".
 *
 * BYOK ("bring your own key": device → provider) was removed, and with it the
 * second route, the credential-store plumbing, and the `free_byok`/`paid_byok`
 * tiers. What survives is the part that was never about routing: the tier is
 * DERIVED from the auth store's server-validated subscription (or a lifetime
 * license), never stored, so there is no second source of truth to drift.
 *
 * The managed session token lives in `authStore` under its own keyring
 * account ("session") — the app's only remaining secret.
 */
import { create } from "zustand";
import {
  historyAllowedFor,
  isPro,
  useAuthStore,
} from "@/store/authStore";
import { isLicensePro, useLicenseStore } from "@/store/licenseStore";
import { fetchPricing, type PricingData } from "@/services/billing";

export type PlanTier = "managed_trial" | "managed_pro";

/** User-facing tier names (Profile plan header). */
export const TIER_LABELS: Record<PlanTier, string> = {
  managed_trial: "Trial · Managed",
  managed_pro: "Pro · Managed",
};

/** Tier = entitlement. Pure so it stays testable. */
export function deriveTier(pro: boolean): PlanTier {
  return pro ? "managed_pro" : "managed_trial";
}

// ── Feature entitlement predicates ────────────────────────────────────────
// The remaining gate for the 3-tier model (Free = no history; Plus/Pro =
// history). Server-stamped flag (authStore historyAllowed) OR a lifetime
// license — read fresh from the stores on every call so non-React code never
// holds a stale verdict.

export function canUseHistory(): boolean {
  return (
    historyAllowedFor(useAuthStore.getState().user) ||
    isLicensePro(useLicenseStore.getState())
  );
}

/** What the contextual upgrade modal was opened for. */
export type UpgradeReason = "credits" | "history";

type MonetizationState = {
  tier: PlanTier;
  /** Non-null while the contextual upgrade modal is open (PlanUpgradeModal,
   *  mounted once at App root — N triggers share one instance). */
  upgradeReason: UpgradeReason | null;
  /** The website's pricing catalog, or null until it loads (and while
   *  offline). Every reader must carry its own fallback copy. */
  pricing: PricingData | null;

  /** Open the contextual upgrade modal (out of credits / gated feature). */
  openUpgrade: (reason: UpgradeReason) => void;
  closeUpgrade: () => void;
  /** Load the catalog once per session; safe to call from every pricing
   *  surface on mount. Never rejects — a failure just leaves `pricing` null. */
  loadPricing: () => Promise<void>;
};

// One in-flight request per session, shared by all callers. Cleared when it
// settles so a load that failed offline is retried the next time a pricing
// surface opens.
let pricingLoad: Promise<void> | null = null;

function snapshot(): Pick<MonetizationState, "tier"> {
  const pro =
    isPro(useAuthStore.getState().user) ||
    isLicensePro(useLicenseStore.getState());
  return { tier: deriveTier(pro) };
}

export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  ...snapshot(),
  upgradeReason: null,
  pricing: null,

  openUpgrade: (reason) => set({ upgradeReason: reason }),
  closeUpgrade: () => set({ upgradeReason: null }),

  loadPricing: () => {
    if (get().pricing) return Promise.resolve();
    pricingLoad ??= fetchPricing()
      .then((pricing) => {
        if (pricing) set({ pricing });
      })
      .finally(() => {
        pricingLoad = null;
      });
    return pricingLoad;
  },
}));

// The tier is a pure projection of auth + license — recompute on either
// store's change so `useMonetizationStore(s => s.tier)` is always current.
useAuthStore.subscribe(() => useMonetizationStore.setState(snapshot()));
useLicenseStore.subscribe(() => useMonetizationStore.setState(snapshot()));
