/**
 * Lifetime Pro license — the second entitlement leg beside the managed
 * subscription. The one-time license unlocks the Workflow Shell: prompt
 * library, local history. `managed_pro` in monetizationStore's tier matrix is
 * fed from here; the subscription keeps feeding it from authStore.
 *
 * Trust invariant: localStorage is only a convenience cache, never proof of
 * entitlement. A stored key is revalidated before it grants Pro after a cold
 * launch. A fully offline cold launch therefore stays unlicensed until the
 * provider is reachable. Safe offline restoration requires a server-signed,
 * device-bound receipt rather than a mutable client boolean.
 *
 * Runtime invariant: `status === "pro"` means this process completed a valid
 * response for `licenseKey`. Rejected keys are cleared; persisted keys remain
 * candidates for startup revalidation but never hydrate directly to Pro.
 *
 * The license key is an entitlement token, not a data-access credential —
 * it never unlocks user content or provider accounts — so localStorage is
 * the right tier here; OS-keyring storage (SECURITY.md) stays reserved for
 * the session token.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  LicenseNetworkError,
  validateLicenseKey,
  type LicenseRejectReason,
} from "@/services/licenseService";
import { isPro, useAuthStore } from "@/store/authStore";

export type LicenseStatus = "unlicensed" | "validating" | "pro" | "invalid";

type LicenseState = {
  licenseKey: string | null;
  status: LicenseStatus;
  /** Epoch ms of the last successful server validation (informational —
   *  never used in expiry math, so clock skew can't strip entitlement). */
  lastValidatedAt: number | null;
  error: string | null;
  /** Feature name that hit the gate; non-null = UpgradeModal open.
   *  Transient UI state — deliberately not persisted. */
  upsellFeature: string | null;

  /** Validate a key the user just entered. Never grants Pro without one
   *  confirmed validation; never destroys an existing license on a typo. */
  activate: (key: string) => Promise<boolean>;
  /** Quiet background re-check of the stored key. Demotes ONLY on a
   *  definitive rejection; offline/unknown keeps the current runtime verdict.
   *  A cold launch remains unlicensed until this check succeeds. */
  revalidate: () => Promise<void>;
  deactivate: () => void;
  openUpsell: (feature: string) => void;
  closeUpsell: () => void;
};

const REJECT_MESSAGES: Record<LicenseRejectReason, string> = {
  invalid: "That license key isn't valid. Check for typos and try again.",
  revoked: "This license key has been revoked.",
};

const STATUSES: readonly LicenseStatus[] = [
  "unlicensed",
  "validating",
  "pro",
  "invalid",
];

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      licenseKey: null,
      status: "unlicensed",
      lastValidatedAt: null,
      error: null,
      upsellFeature: null,

      activate: async (rawKey) => {
        const key = rawKey.trim();
        if (!key) {
          set({ error: "Enter a license key." });
          return false;
        }
        const prev = get();
        set({ status: "validating", error: null });
        try {
          const result = await validateLicenseKey(key);
          if (result.valid) {
            set({
              licenseKey: key,
              status: "pro",
              lastValidatedAt: Date.now(),
              error: null,
            });
            return true;
          }
          if (prev.licenseKey && prev.licenseKey !== key) {
            // A mistyped NEW key must not nuke the existing valid license.
            set({
              licenseKey: prev.licenseKey,
              status: prev.status === "validating" ? "pro" : prev.status,
              lastValidatedAt: prev.lastValidatedAt,
              error: REJECT_MESSAGES[result.reason],
            });
          } else {
            set({
              licenseKey: null,
              status: "invalid",
              lastValidatedAt: null,
              error: REJECT_MESSAGES[result.reason],
            });
          }
          return false;
        } catch (e) {
          // Unknown verdict (offline): a brand-new key can't be trusted yet,
          // but whatever was already earned is restored untouched.
          set({
            licenseKey: prev.licenseKey,
            status: prev.licenseKey ? "pro" : "unlicensed",
            lastValidatedAt: prev.lastValidatedAt,
            error:
              e instanceof LicenseNetworkError
                ? "You appear to be offline. Your key will be checked when you're back online."
                : String(e),
          });
          return false;
        }
      },

      revalidate: async () => {
        const { licenseKey } = get();
        if (!licenseKey) return;
        try {
          const result = await validateLicenseKey(licenseKey);
          if (result.valid) {
            set({ status: "pro", lastValidatedAt: Date.now(), error: null });
          } else {
            set({
              licenseKey: null,
              status: "invalid",
              lastValidatedAt: null,
              error: REJECT_MESSAGES[result.reason],
            });
          }
        } catch {
          // Offline / server unreachable — keep this process's current
          // verdict. A cold launch starts unlicensed until validation succeeds.
        }
      },

      deactivate: () =>
        set({
          licenseKey: null,
          status: "unlicensed",
          lastValidatedAt: null,
          error: null,
        }),

      openUpsell: (feature) => set({ upsellFeature: feature }),
      closeUpsell: () => set({ upsellFeature: null }),
    }),
    {
      name: "insertgo-license",
      version: 1,
      partialize: (s) => ({
        licenseKey: s.licenseKey,
        // A kill mid-activation must not persist the transient state. Merge
        // still forces every persisted verdict to unlicensed on hydration.
        status:
          s.status === "validating"
            ? s.licenseKey
              ? ("pro" as const)
              : ("unlicensed" as const)
            : s.status,
        lastValidatedAt: s.lastValidatedAt,
      }),
      // localStorage is user-editable — treat rehydration as a trust
      // boundary. Keep a well-formed key only as a revalidation candidate;
      // malformed shapes fall back to defaults and status never hydrates Pro.
      merge: (persisted, current) => {
        const p = persisted as Partial<LicenseState> | undefined;
        if (
          !p ||
          !STATUSES.includes(p.status as LicenseStatus) ||
          (p.licenseKey !== null && typeof p.licenseKey !== "string")
        ) {
          return current;
        }
        return {
          ...current,
          licenseKey: p.licenseKey ?? null,
          // A persisted verdict is not proof: localStorage is user-editable.
          // Keep the key only as a candidate for initLicense() to revalidate.
          status: "unlicensed",
          lastValidatedAt:
            typeof p.lastValidatedAt === "number" ? p.lastValidatedAt : null,
        };
      },
    }
  )
);

/** Pure license predicate (mirrors authStore's `isPro` pattern). */
export const isLicensePro = (s: Pick<LicenseState, "status">): boolean =>
  s.status === "pro";

/** THE feature-entitlement hook — lifetime license OR managed subscription.
 *  Every ProFeatureGate goes through this one predicate so an entitlement
 *  change lands everywhere at once. */
export function useIsPro(): boolean {
  const licensed = useLicenseStore(isLicensePro);
  const subscribed = useAuthStore((s) => isPro(s.user));
  return licensed || subscribed;
}

// One re-check per window: on startup (notices server-side revocation) and
// whenever connectivity returns (an offline launch heals itself).
let initStarted = false;
export function initLicense(): void {
  if (initStarted) return;
  initStarted = true;
  void useLicenseStore.getState().revalidate();
  window.addEventListener("online", () => {
    void useLicenseStore.getState().revalidate();
  });
}
