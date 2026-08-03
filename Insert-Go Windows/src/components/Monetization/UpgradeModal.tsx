/**
 * Lifetime Pro upsell — opens when a free user clicks a ProFeatureGate.
 * Mounted ONCE (App root) and driven by `licenseStore.upsellFeature`, so N
 * gates share one modal instance.
 *
 * Upsell framing: we sell the software shell, once, rather than a recurring
 * plan. Copy leads with the feature
 * that was actually clicked, names all three Workflow Shell features, and
 * anchors on "one payment, yours forever, keys stay yours" — the
 * anti-subscription promise this demographic buys on. Dismissing is
 * one click / Esc and core chat is never gated, so the sell stays an
 * invitation, not a wall.
 *
 * Reuses the .ig-modal glass material; framer-motion owns enter/exit
 * (CSS keyframe animations are disabled inline so the two systems don't
 * fight over opacity/transform).
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { isTauri } from "@/services/tauriBridge";
import { API_URL } from "@/services/apiConfig";
import { useLicenseStore } from "@/store/licenseStore";

const EASE = [0.32, 0.72, 0, 1] as const; // mirrors --ig-ease

const FEATURES = [
  {
    name: "Multi-Model Routing",
    icon: "fa-shuffle",
    blurb: "Send each prompt to the right model — GPT, Claude, Gemini, side by side.",
  },
  {
    name: "Prompt Library",
    icon: "fa-book-bookmark",
    blurb: "Save, organize, and reuse your best prompts anywhere.",
  },
  {
    name: "Local History",
    icon: "fa-clock-rotate-left",
    blurb: "Every conversation searchable, stored only on this device.",
  },
];

export function UpgradeModal() {
  const feature = useLicenseStore((s) => s.upsellFeature);
  const status = useLicenseStore((s) => s.status);
  const error = useLicenseStore((s) => s.error);
  const activate = useLicenseStore((s) => s.activate);
  const closeUpsell = useLicenseStore((s) => s.closeUpsell);

  const [key, setKey] = useState("");
  const [showKeyEntry, setShowKeyEntry] = useState(false);
  const open = feature !== null;
  const validating = status === "validating";
  const cardRef = useRef<HTMLDivElement>(null);

  useAppShortcuts({
    onClose: open
      ? () => {
          closeUpsell();
        }
      : undefined,
  });

  const submitKey = async () => {
    if (await activate(key)) {
      setKey("");
      closeUpsell(); // Pro now — the gated feature works on the next click.
    }
  };

  const buy = async () => {
    const url = `${API_URL}/pricing`;
    try {
      if (isTauri()) await openUrl(url);
      else window.open(url, "_blank");
    } catch {
      // Opener blocked — the key-entry path below still completes the loop.
      setShowKeyEntry(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ig-modal"
          style={{ animation: "none" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={closeUpsell}
        >
          <motion.div
            ref={cardRef}
            className="ig-modal__card"
            style={{ animation: "none" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ig-upgrade-title"
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
            <span className="ig-section-label">InsertGo Pro · Lifetime</span>
            <div className="ig-modal__title" id="ig-upgrade-title">
              {feature} is part of the Workflow Shell
            </div>
            <p className="ig-muted">
              Your API keys already cover the AI — Pro unlocks the software
              around it. One payment, yours forever. No subscription.
            </p>

            <ul style={{ listStyle: "none", display: "grid", gap: "var(--ig-space-3)", padding: 0, margin: 0 }}>
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.3, ease: EASE }}
                  style={{
                    display: "flex",
                    gap: "var(--ig-space-3)",
                    alignItems: "baseline",
                    opacity: 1,
                  }}
                >
                  <i className={`fa-solid ${f.icon}`} aria-hidden="true" />
                  <span>
                    <strong>{f.name}</strong>
                    {f.name === feature && (
                      <span className="ig-section-label"> · what you clicked</span>
                    )}
                    <span className="ig-muted" style={{ display: "block" }}>
                      {f.blurb}
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>

            {showKeyEntry ? (
              <div className="ig-field">
                <input
                  className="ig-input"
                  autoFocus
                  value={key}
                  disabled={validating}
                  placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  aria-label="License key"
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitKey();
                  }}
                />
                {error && <div className="ig-error">{error}</div>}
                <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="ig-btn"
                    onClick={() => setShowKeyEntry(false)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="ig-btn ig-btn--primary"
                    disabled={validating || !key.trim()}
                    onClick={() => void submitKey()}
                  >
                    {validating ? "Checking…" : "Activate license"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="ig-btn" onClick={closeUpsell}>
                  Maybe later
                </button>
                <button
                  type="button"
                  className="ig-btn"
                  onClick={() => setShowKeyEntry(true)}
                >
                  I have a key
                </button>
                <button
                  type="button"
                  className="ig-btn ig-btn--primary"
                  autoFocus
                  onClick={() => void buy()}
                >
                  Get Lifetime Pro
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
