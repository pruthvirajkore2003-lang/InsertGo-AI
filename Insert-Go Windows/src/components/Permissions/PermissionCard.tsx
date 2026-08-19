/**
 * One capability row in Settings › Access.
 *
 * The row stays compact until something needs attention: the "why" is hidden
 * behind a Learn-more toggle, and a failed probe automatically expands the
 * recovery steps. No check runs on mount — the user chooses when to probe.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PermissionStatus } from "@/types";

const EASE = [0.32, 0.72, 0, 1] as const; // mirrors --ig-ease

/** Badge text + modifier per status. `unknown` reads as a neutral invitation,
 *  not a warning — nothing has failed yet. */
const BADGE: Record<PermissionStatus, { label: string; modifier: string }> = {
  unknown: { label: "Not checked", modifier: "" },
  checking: { label: "Checking…", modifier: "" },
  granted: { label: "Ready", modifier: "ig-permcard__badge--ok" },
  unavailable: { label: "Unavailable", modifier: "ig-permcard__badge--warn" },
  blocked: { label: "In use elsewhere", modifier: "ig-permcard__badge--warn" },
  off: { label: "Off", modifier: "" },
};

export type PermissionCardProps = {
  /** Font Awesome solid glyph (e.g. "fa-universal-access"). */
  icon: string;
  title: string;
  /** Why InsertGo needs this — hidden by default, revealed via Learn more. */
  why: string;
  /** The chord this capability belongs to, rendered as a <kbd>. */
  chord?: string;
  status: PermissionStatus;
  /** Marks the card as optional so its status never reads as a failure. */
  optional?: boolean;
  /** What to do in Windows when the status is bad. Rendered as ordered steps
   *  (text, not a link: the app's opener scope allows no `ms-settings:` URI,
   *  and a dead link is worse than instructions that work). */
  recovery?: readonly string[];
  /** Run the probe for this card. */
  onCheck: () => void;
  /** Only for the optional autostart card — turns the feature on/off. */
  onToggle?: (enabled: boolean) => void;
  /** Label rendered inside the toggle's <label>, next to the checkbox. Copy
   *  belongs to the caller, not here — only meaningful with `onToggle`. */
  toggleLabel?: string;
};

export function PermissionCard({
  icon,
  title,
  why,
  chord,
  status,
  optional = false,
  recovery,
  onCheck,
  onToggle,
  toggleLabel,
}: PermissionCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const badge = BADGE[status];
  // An optional capability that is simply off is not a problem to recover
  // from — only real failures surface the recovery steps.
  const needsRecovery =
    !optional && (status === "unavailable" || status === "blocked");
  const busy = status === "checking";
  // Recovery steps always show when a probe fails; the user can also open the
  // details manually to read the "why".
  const showDetails = detailsOpen || needsRecovery;

  return (
    <article
      className={`ig-glass-card ig-permcard ig-permcard--compact ig-permcard--${status}`}
    >
      <div className="ig-permcard__main">
        <header className="ig-permcard__head">
          <span className="ig-permcard__icon-chip" aria-hidden="true">
            <i className={`fa-solid ${icon} ig-permcard__icon`} />
          </span>
          <h4 className="ig-permcard__title">{title}</h4>
          {chord && <kbd className="ig-kbd ig-permcard__chord">{chord}</kbd>}
          <button
            type="button"
            className="ig-iconbtn ig-permcard__info"
            aria-expanded={showDetails}
            aria-label={`Learn more about ${title}`}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
          </button>
        </header>

        <div className="ig-permcard__actions">
          {/* The checkbox already states on/off; a badge beside it would say
              the same thing twice. Cards without a toggle keep the badge as
              their only status. */}
          {!onToggle && (
            <span
              className={`ig-permcard__badge ${badge.modifier}`}
              // Status changes silently otherwise — announce them for screen
              // readers the same moment the badge repaints.
              role="status"
            >
              {badge.label}
            </span>
          )}
          {onToggle && (
            /* Switch, not a bare checkbox: the card's only writable control
               should read as a control, and the on/off position carries the
               state the hidden badge used to. Input stays a real checkbox
               (role, label, keyboard) — the track is paint only. */
            <label className="ig-check ig-permcard__toggle ig-switch">
              <input
                type="checkbox"
                checked={status === "granted"}
                disabled={busy}
                onChange={(e) => onToggle(e.target.checked)}
              />
              <span className="ig-switch__track" aria-hidden="true">
                <span className="ig-switch__thumb" />
              </span>
              {/* Falls back to the title so the checkbox is never nameless if
                  a caller forgets the copy. */}
              <span className="ig-switch__text">{toggleLabel ?? title}</span>
            </label>
          )}
          <button
            type="button"
            className="ig-btn"
            disabled={busy}
            onClick={onCheck}
          >
            {busy ? "Checking…" : status === "unknown" ? "Check" : "Re-check"}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            key="details"
            className="ig-permcard__details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <div className="ig-permcard__detail-body">
              <p className="ig-permcard__why">{why}</p>
              {needsRecovery && recovery && recovery.length > 0 && (
                <div
                  className="ig-permcard__recovery"
                  role="group"
                  aria-label={`How to fix ${title}`}
                >
                  <span className="ig-section-label">How to fix it</span>
                  <ol className="ig-permcard__steps">
                    {recovery.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
