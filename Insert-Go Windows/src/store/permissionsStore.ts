/**
 * Windows capability state (accessibility, the two chords, clipboard,
 * autostart) — read on demand, never persisted.
 *
 * This used to live inside the first-run wizard. It moved out because the
 * capabilities are a *permanent* concern, not a setup step: Windows shows no
 * consent dialog for any of them, so there is nothing to "grant" during
 * onboarding — they either work or they silently don't, and the moment that
 * matters is when one actually fails, not before the user has typed anything.
 * The Access panel in Settings is the home for it now.
 *
 * The Wispr-Flow-style priming rule survives the move and is a state contract,
 * not just copy: every capability starts at `unknown` and only a deliberate
 * user action moves it. There is therefore no "probe everything on mount"
 * action here — no bulk sweep can be triggered, only per-card checks.
 */
import { create } from "zustand";
import * as bridge from "@/services/tauriBridge";
import { toast } from "@/store/toastStore";
import type {
  PermissionId,
  PermissionReport,
  PermissionStatus,
} from "@/types";

/** Every card starts unprimed — see the module note on bulk sweeps. */
const INITIAL_PERMISSIONS: Record<PermissionId, PermissionStatus> = {
  accessibility: "unknown",
  globalHotkey: "unknown",
  clipboard: "unknown",
  autostart: "unknown",
};

/** Statuses that mean "this capability works right now". `off` is excluded:
 *  it's the honest answer for an optional feature the user left alone. */
const WORKING: readonly PermissionStatus[] = ["granted"];

export function isPermissionWorking(status: PermissionStatus): boolean {
  return WORKING.includes(status);
}

type PermissionsState = {
  permissions: Record<PermissionId, PermissionStatus>;
  /** Last probe's elevation reading; null until the first successful probe.
   *  Drives the UIPI explainer (a normal-integrity InsertGo silently cannot
   *  drive an elevated target window). */
  elevated: boolean | null;
  /** Set when a probe itself couldn't run (outside the Tauri shell, or the
   *  command failed) — distinct from "probed and the answer was bad". */
  probeError: string | null;

  /** One probe pass, applied to every card. Called per-card by design: the
   *  cards share one cheap backend read, but the user always triggers it. */
  checkPermissions: () => Promise<void>;
  setAutostart: (enabled: boolean) => Promise<void>;
  reset: () => void;
};

/** Apply a Rust report onto the card map. Unknown status strings from a newer
 *  backend collapse to `unavailable` rather than corrupting the union. */
function applyReport(
  report: PermissionReport
): Record<PermissionId, PermissionStatus> {
  const valid: readonly PermissionStatus[] = [
    "granted",
    "unavailable",
    "blocked",
    "off",
  ];
  const coerce = (value: string): PermissionStatus =>
    (valid as readonly string[]).includes(value)
      ? (value as PermissionStatus)
      : "unavailable";
  return {
    accessibility: coerce(report.accessibility),
    globalHotkey: coerce(report.globalHotkey),
    clipboard: coerce(report.clipboard),
    autostart: coerce(report.autostart),
  };
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  permissions: { ...INITIAL_PERMISSIONS },
  elevated: null,
  probeError: null,

  checkPermissions: async () => {
    // Everything not yet answered shows as in-flight; already-known values
    // stay put so a re-check doesn't blank the cards mid-probe.
    set((s) => ({
      probeError: null,
      permissions: Object.fromEntries(
        Object.entries(s.permissions).map(([id, status]) => [
          id,
          status === "unknown" ? "checking" : status,
        ])
      ) as Record<PermissionId, PermissionStatus>,
    }));
    try {
      const report = await bridge.checkPermissions();
      set({ permissions: applyReport(report), elevated: report.elevated });
    } catch (e) {
      // The probe couldn't run (browser dev, or the command errored). Say that
      // instead of showing a red "denied" the user cannot act on.
      set((s) => ({
        probeError:
          e instanceof Error
            ? e.message
            : "Couldn't check Windows permissions here",
        permissions: Object.fromEntries(
          Object.entries(s.permissions).map(([id, status]) => [
            id,
            status === "checking" ? "unknown" : status,
          ])
        ) as Record<PermissionId, PermissionStatus>,
      }));
    }
  },

  setAutostart: async (enabled) => {
    set((s) => ({ permissions: { ...s.permissions, autostart: "checking" } }));
    try {
      const now = await bridge.setAutostart(enabled);
      set((s) => ({
        permissions: { ...s.permissions, autostart: now ? "granted" : "off" },
      }));
    } catch (e) {
      // Optional feature: a failure is reported and the card falls back to
      // "off" — it must never block anything.
      set((s) => ({ permissions: { ...s.permissions, autostart: "off" } }));
      toast.error(
        `Couldn't change the startup setting: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  },

  reset: () =>
    set({
      permissions: { ...INITIAL_PERMISSIONS },
      elevated: null,
      probeError: null,
    }),
}));
