/**
 * First-run clickwrap. The one screen that stands ahead of everything —
 * ahead of sign-in, ahead of the palette, ahead of the OS hooks.
 *
 * Why it blocks rather than informs: InsertGo reads the focused field and the
 * current selection through Windows accessibility interfaces, and notices
 * selections through WH_KEYBOARD_LL / WH_MOUSE_LL hooks. Under California's
 * Invasion of Privacy Act (Penal Code §§631, 632) that is interception of a
 * communication, and it is lawful only with prior express consent — $5,000 per
 * violation otherwise, with no proof of damage required. A policy link in a
 * footer is not consent. An unticked box the user ticks, before the hooks
 * exist, is.
 *
 * So the sequencing is the feature, not the UI:
 *   1. Rust launches WITHOUT registering the hotkey or installing any hook
 *      (`Settings::consent_current()` in lib.rs).
 *   2. This modal renders the shipped text and takes an affirmative tick.
 *   3. `acceptedTermsVersion` is PERSISTED first.
 *   4. Only then `legalConsentGranted()` tells Rust to arm — it re-reads the
 *      file, so a UI that skipped step 3 arms nothing.
 * If step 3 fails, step 4 never runs and the modal stays up. Failing closed is
 * the whole point: a consent we could not record is a consent we cannot prove.
 *
 * Scope: this is contract acceptance plus interception authorisation, and
 * NOTHING else. Analytics and marketing are separate, optional, individually
 * revocable purposes collected on the website (`lib/consent.ts` PURPOSES) —
 * bundling them into this tick would make an optional purpose a precondition
 * of service, which DPDP §6(1) forbids outright. See CONSENT_LABEL's note.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CONSENT_LABEL,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE,
  LEGAL_VERSION,
} from "@/legal";
import { legalConsentGranted, quitApp } from "@/services/tauriBridge";
import { Tabs } from "@/components/ui/Tabs";

const EASE = [0.32, 0.72, 0, 1] as const; // mirrors --ig-ease

export type LegalConsentModalProps = {
  /** Persist `acceptedTermsVersion`. Must reject on failure — the caller
   *  treats a resolved promise as "the record exists". */
  onAccept: (version: string) => Promise<void>;
};

export function LegalConsentModal({ onAccept }: LegalConsentModalProps) {
  const [docId, setDocId] = useState(LEGAL_DOCUMENTS[0].id);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const doc = LEGAL_DOCUMENTS.find((d) => d.id === docId) ?? LEGAL_DOCUMENTS[0];

  // Focus the decision, not the prose: a screen-reader user lands on the thing
  // being asked rather than at the top of ~9,000 words of terms.
  useEffect(() => {
    checkboxRef.current?.focus();
  }, []);

  // NO Escape handler and NO click-outside dismissal, deliberately, and they
  // are not an oversight to "fix": a gate that closes on Escape has recorded
  // nothing while the app carries on, which is worse than either answer.
  // "Decline and quit" is the way out.

  const accept = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Order matters. Persist, THEN arm.
      await onAccept(LEGAL_VERSION);
      await legalConsentGranted();
    } catch {
      setError(
        "Couldn't save your choice. Check that InsertGo can write its " +
          "settings file, then try again."
      );
      setBusy(false);
    }
    // No setBusy(false) on success: the parent unmounts this on the next
    // render, and re-enabling the button first invites a second submit.
  };

  return (
    <AnimatePresence>
      <motion.div
        className="ig-modal"
        style={{ animation: "none" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <motion.div
          className="ig-modal__card"
          style={{ animation: "none", maxWidth: 560 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ig-legal-title"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <span className="ig-section-label">
            Before InsertGo starts · v{LEGAL_VERSION} · {LEGAL_EFFECTIVE}
          </span>
          <div className="ig-modal__title" id="ig-legal-title">
            Please read and accept
          </div>
          <p className="ig-muted">
            InsertGo reads the text field you invoke it on and writes the
            result back, and watches for selection gestures with Windows
            keyboard and mouse hooks. None of that is running yet. It starts
            when you agree below, and not before.
          </p>

          {/* The APG tab pattern (roving tabindex, arrow keys, Home/End) is
              already solved in ui/Tabs — reuse it rather than re-deriving it
              badly on the one screen that must be reachable by keyboard. */}
          <Tabs
            tabs={LEGAL_DOCUMENTS.map((d) => ({ id: d.id, label: d.title }))}
            value={docId}
            onChange={(id) => setDocId(id as typeof docId)}
            aria-label="Legal documents"
            idBase="ig-legal"
          />

          {/* tabIndex makes the scroll region keyboard-reachable: without it a
              keyboard-only user can tick the box but cannot read what they are
              ticking. */}
          <div
            role="tabpanel"
            id={`ig-legal-panel-${doc.id}`}
            aria-labelledby={`ig-legal-tab-${doc.id}`}
            tabIndex={0}
            className="ig-legal__scroll"
          >
            {doc.sections.map((s) => (
              <section
                key={s.heading}
                className={
                  s.emphasis ? "ig-legal__section ig-legal__section--flag" : "ig-legal__section"
                }
              >
                <h3 className="ig-legal__heading">{s.heading}</h3>
                <p className="ig-legal__body">{s.body}</p>
              </section>
            ))}
          </div>

          <label className="ig-legal__consent">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={agreed}
              disabled={busy}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>{CONSENT_LABEL}</span>
          </label>
          <p className="ig-muted ig-legal__aside">
            Optional things — product analytics, marketing email — are asked
            separately on insertgo.com and you can change them any time. This
            box is not about those.
          </p>

          {error && (
            <div className="ig-error" role="alert">
              {error}
            </div>
          )}

          <div className="ig-actions" style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className="ig-btn"
              disabled={busy}
              onClick={() => void quitApp()}
            >
              Decline and quit
            </button>
            <button
              type="button"
              className="ig-btn ig-btn--primary"
              disabled={!agreed || busy}
              onClick={() => void accept()}
            >
              {busy ? "Saving…" : "Agree and Continue"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
