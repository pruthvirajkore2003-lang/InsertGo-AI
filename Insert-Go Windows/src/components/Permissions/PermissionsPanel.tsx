/**
 * Settings › Access — what InsertGo touches on this machine, and how to fix it
 * when one of them isn't working.
 *
 * Windows never shows a consent dialog for what InsertGo needs: UIA reads, a
 * global chord, and clipboard access either work or fail silently. So there is
 * nothing to "grant" — the honest design is to explain each capability, let the
 * user check it on demand, and hand them a fix when a check comes back bad.
 *
 * This was a mandatory first-run step. It is not one any more, for the same
 * reason it can't be: with nothing to grant, the step was explanations
 * delivered before the user had a reason to care about any of them, and the
 * only moment they do care — the skill bar silently doing nothing in some app
 * — was days later with the panel nowhere in sight. A permanent home in
 * Settings is both where it belongs and where the recovery copy can be found.
 *
 * Two rules survive the move:
 *  - No bulk sweep. One shared probe exists, but only a card's own Check button
 *    (or the explicit "Check all") fires it. Nothing runs on mount.
 *  - No dead ends. Every non-optional failure surfaces recovery steps.
 *
 * There is deliberately NO microphone or audio card: voice is out of scope, so
 * InsertGo must never ask for it.
 */
import { AnimatePresence, motion } from "framer-motion";
import { PermissionCard } from "./PermissionCard";
import { usePermissionsStore } from "@/store/permissionsStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { PermissionId } from "@/types";

/** Static copy per card. Chords come from live settings, so a remapped hotkey
 *  is taught correctly (see `cards` below). */
const COPY: Record<
  PermissionId,
  {
    icon: string;
    title: string;
    why: string;
    optional?: boolean;
    recovery?: readonly string[];
  }
> = {
  accessibility: {
    icon: "fa-universal-access",
    title: "Read the text you select",
    why:
      "The skill bar uses the Windows accessibility API to read the text you " +
      "have selected, and only at the moment you select it. Password fields " +
      "are always refused — their contents are never read.",
    recovery: [
      "Sign out and back in — the accessibility service occasionally needs a fresh session.",
      "If a screen reader or automation tool is running, restart it; two clients can fight over the tree.",
      "The bar still works without it: InsertGo falls back to a save-and-restore clipboard read.",
    ],
  },
  globalHotkey: {
    icon: "fa-keyboard",
    title: "Open the palette from anywhere",
    why:
      "A system-wide chord that brings up the prompt palette over whatever " +
      "app you're in. Windows gives a chord to one app only, so a clash is " +
      "silent unless we check.",
    recovery: [
      "Another app already owns this chord — close it, or pick a different chord in Settings › Hotkeys.",
      "Common culprits: Windows Terminal's quake mode, Everything, PowerToys Run, and vendor tray utilities.",
    ],
  },
  clipboard: {
    icon: "fa-clipboard",
    title: "Clipboard fallback",
    why:
      "When accessibility can't reach a field (Electron apps and terminals " +
      "are common), InsertGo saves your clipboard, uses it to move the text, " +
      "then puts your original contents back.",
    recovery: [
      "Another app is holding the clipboard open — clipboard managers and remote-desktop clients do this.",
      "Close or pause that app and re-check; nothing else needs changing.",
    ],
  },
  autostart: {
    icon: "fa-power-off",
    title: "Start with Windows",
    optional: true,
    why:
      "Optional. InsertGo is only useful when it's already running, so most " +
      "people turn this on — but nothing here depends on it, and you can " +
      "change it any time in Settings.",
  },
};

/** Display order: capability first, the chord next, optional last. */
const ORDER: readonly PermissionId[] = [
  "accessibility",
  "globalHotkey",
  "clipboard",
  "autostart",
];

export function PermissionsPanel() {
  const permissions = usePermissionsStore((s) => s.permissions);
  const elevated = usePermissionsStore((s) => s.elevated);
  const probeError = usePermissionsStore((s) => s.probeError);
  const checkPermissions = usePermissionsStore((s) => s.checkPermissions);
  const setAutostart = usePermissionsStore((s) => s.setAutostart);
  const hotkey = useSettingsStore((s) => s.settings.hotkey);

  const chords: Partial<Record<PermissionId, string>> = {
    globalHotkey: hotkey,
  };

  const anyChecked = ORDER.some((id) => permissions[id] !== "unknown");

  return (
    <motion.div
      className="ig-onb__step"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      <header className="ig-onb__intro">
        <span className="ig-section-label">What InsertGo touches</span>
        <h2 className="ig-onb__title">Nothing is switched on behind you</h2>
        <p className="ig-muted">
          Windows has no permission prompt for these — they either work or fail
          quietly. Check any of them whenever something isn&apos;t behaving.
        </p>
      </header>

      <div className="ig-onb__perms">
        {ORDER.map((id) => (
          <PermissionCard
            key={id}
            icon={COPY[id].icon}
            title={COPY[id].title}
            why={COPY[id].why}
            chord={chords[id]}
            status={permissions[id]}
            optional={COPY[id].optional}
            recovery={COPY[id].recovery}
            onCheck={() => void checkPermissions()}
            onToggle={
              id === "autostart"
                ? (enabled) => void setAutostart(enabled)
                : undefined
            }
          />
        ))}
      </div>

      <div className="ig-actions">
        <button
          type="button"
          className="ig-btn"
          onClick={() => void checkPermissions()}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" />
          {anyChecked ? "Re-check all" : "Check all"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {probeError && (
          <motion.p
            key="probe-error"
            className="ig-hint"
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
            Couldn&apos;t run the check here ({probeError}). This works in the
            installed app.
          </motion.p>
        )}

        {/* UIPI: a normal-integrity process cannot read from or paste into a
            window owned by an elevated one, and Windows reports no error for
            it. Say so before the user hits it as a mystery no-op. */}
        {elevated === false && (
          <motion.p
            key="uipi"
            className="ig-hint"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
            InsertGo runs without admin rights, which is the safer default. If
            it does nothing in an app you launched as administrator, that is
            Windows blocking it — right-click InsertGo and choose &quot;Run as
            administrator&quot; to use it there.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
