/**
 * Contextual plan upsell — opens when the ledger 402s (out of credits) or a
 * free user hits a paid gate (history). Mounted ONCE (App root) and
 * driven by `monetizationStore.upgradeReason`, so N triggers share one modal
 * instance. Distinct from the lifetime-license UpgradeModal (licenseStore):
 * this one sells the subscription tiers + non-expiring credit packs and
 * deep-links to the website checkout — payment happens in the system
 * browser, the `insertgo://` callback + refreshStatus() sync the new
 * entitlements back.
 *
 * Reuses the .ig-modal glass material; framer-motion owns enter/exit
 * (CSS keyframe animations are disabled inline so the two systems don't
 * fight over opacity/transform).
 */
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { isTauri } from "@/services/tauriBridge";
import { API_URL } from "@/services/apiConfig";
import { formatUsd, planFor } from "@/services/billing";
import { useAuthStore } from "@/store/authStore";
import {
  useMonetizationStore,
  type UpgradeReason,
} from "@/store/monetizationStore";

const EASE = [0.32, 0.72, 0, 1] as const; // mirrors --ig-ease

/** Monthly prices as the copy renders them. Used when the pricing catalog
 *  hasn't loaded (first open, offline) — the last known website prices. */
const FALLBACK_PLUS = 8;
const FALLBACK_PRO = 15;

type Prices = { plus: string; pro: string };

const COPY: Record<
  UpgradeReason,
  {
    label: string;
    title: string;
    body: (prices: Prices) => string;
    cta: string;
    anchor: string;
  }
> = {
  credits: {
    label: "Out of credits",
    title: "You've used today's credits",
    body: () =>
      "Your daily allowance resets at 00:00 UTC. Upgrade for a bigger daily " +
      "allowance, or grab an add-on pack — pack credits never expire and " +
      "are only spent after your daily credits.",
    cta: "Get more credits",
    anchor: "#packs",
  },
  history: {
    label: "Plus feature",
    title: "Interaction history is part of InsertGo Plus",
    body: ({ plus, pro }) =>
      "Keep every interaction searchable on this device. Included in Plus " +
      `(${plus}/mo) and Pro (${pro}/mo).`,
    cta: "Upgrade to Plus",
    anchor: "",
  },
};

export function PlanUpgradeModal() {
  const reason = useMonetizationStore((s) => s.upgradeReason);
  const closeUpgrade = useMonetizationStore((s) => s.closeUpgrade);
  const pricing = useMonetizationStore((s) => s.pricing);
  const loadPricing = useMonetizationStore((s) => s.loadPricing);
  const daily = useAuthStore((s) => s.user?.dailyCreditsRemaining);
  const dailyMax = useAuthStore((s) => s.user?.dailyCreditsMax);
  const addOn = useAuthStore((s) => s.user?.addOnCredits);

  const open = reason !== null;

  useAppShortcuts({
    onClose: open ? () => closeUpgrade() : undefined,
  });

  // This modal is mounted for the whole session but is a pricing surface only
  // while open — fetch on first open, not at app start.
  useEffect(() => {
    if (open) void loadPricing();
  }, [open, loadPricing]);

  const prices: Prices = {
    plus: formatUsd(planFor(pricing, "plus")?.price.USD ?? FALLBACK_PLUS),
    pro: formatUsd(planFor(pricing, "pro")?.price.USD ?? FALLBACK_PRO),
  };

  const goPricing = async (anchor: string) => {
    const url = `${API_URL}/pricing${anchor}`;
    try {
      if (isTauri()) await openUrl(url);
      else window.open(url, "_blank");
    } catch {
      // Opener blocked — leave the modal up; the copy names the page.
    }
  };

  const copy = reason ? COPY[reason] : null;

  return (
    <AnimatePresence>
      {open && copy && (
        <motion.div
          className="ig-modal"
          style={{ animation: "none" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={closeUpgrade}
        >
          <motion.div
            className="ig-modal__card"
            style={{ animation: "none" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ig-planupgrade-title"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: 10,
              scale: 0.97,
              transition: { duration: 0.15, ease: "easeIn" },
            }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="ig-section-label">{copy.label}</span>
            <div className="ig-modal__title" id="ig-planupgrade-title">
              {copy.title}
            </div>
            <p className="ig-muted">{copy.body(prices)}</p>

            {reason === "credits" && dailyMax !== undefined && (
              <p className="ig-muted" style={{ margin: 0 }}>
                <i className="fa-solid fa-coins" aria-hidden="true" />{" "}
                {daily ?? 0}/{dailyMax} daily · {addOn ?? 0} add-on credits
                left
              </p>
            )}

            <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="ig-btn" onClick={closeUpgrade}>
                Maybe later
              </button>
              <button
                type="button"
                className="ig-btn ig-btn--primary"
                autoFocus
                onClick={() => void goPricing(copy.anchor)}
              >
                {copy.cta}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
