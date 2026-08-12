/**
 * Auto-update against the `latest.json` published on GitHub Releases
 * (tauri.conf.json plugins.updater).
 *
 * Everything here is best-effort by design: a failed update check must never
 * be visible to the user and must never block startup. The palette is a
 * hotkey-driven tool — if the network is down, the endpoint 404s, or the
 * signature does not verify, the correct outcome is "keep running the version
 * we have", not an error dialog over whatever the user was typing into.
 *
 * The Windows install path is `passive` (tauri.conf): the NSIS installer shows
 * its own progress window, needs no clicks, and needs no elevation because the
 * bundle installs per-user (`nsis.installMode: "currentUser"`). Tauri exits the
 * app to run it and the installer relaunches us, so no @tauri-apps/plugin-process.
 */

import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { safeError } from "./safeLog";

/** 6h. The app lives in the tray for days at a time, so a startup-only check
 *  would miss every release for users who never reboot. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let inFlight = false;

/**
 * Check once, and install if something is there. Resolves either way; never
 * rejects. Returns true only when an update was found and handed to the
 * installer (in which case the process is about to exit).
 */
export async function checkForUpdates(): Promise<boolean> {
  // Vite dev in a plain browser has no updater IPC; calling check() there
  // throws a "not allowed"/undefined-plugin error on every reload.
  if (!isTauri()) return false;

  // The interval and the startup call can overlap on a slow download, and a
  // second downloadAndInstall would run the installer twice.
  if (inFlight) return false;
  inFlight = true;

  try {
    // Resolves to null when the manifest's version is <= ours — the ordinary
    // case, and not an error.
    const update = await check();
    if (!update) return false;

    // eslint-disable-next-line no-console -- version strings only, no user data
    console.info(`update ${update.version} available; installing`);
    await update.downloadAndInstall();
    return true;
  } catch (e) {
    // Offline, DNS failure, 404 on latest.json, malformed manifest, or a
    // signature that does not verify against `pubkey`. All of them mean the
    // same thing to the user: nothing. safeError, not console.error — the
    // plugin's message can embed the endpoint URL.
    safeError("update check failed:", e);
    return false;
  } finally {
    inFlight = false;
  }
}

/**
 * Start the periodic check. Call once, from the main window only — the
 * `floating-icon` window loads this same bundle and a second timer would
 * double every request and race on the installer.
 */
export function startUpdateChecks(): void {
  void checkForUpdates();
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}
