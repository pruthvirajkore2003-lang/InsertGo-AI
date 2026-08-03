/**
 * Native window move/resize for the borderless Spotlight palette.
 * Borderless windows have no OS titlebar to drag from and (on Windows)
 * can't be mouse-resized from their edges even with `resizable: true` — so
 * the frontend drives both via `startDragging` / `startResizeDragging`
 * (tauri #8519). `ResizeDirection` isn't exported from the installed
 * `@tauri-apps/api` (2.11.1), so it's redeclared locally; the literal union
 * matches the runtime type exactly and is structurally compatible.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/services/tauriBridge";

export type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

let manipulating = false;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

export const isManipulatingWindow = (): boolean => manipulating;

export const clearWindowManipulation = (): void => {
  manipulating = false;
  if (fallbackTimer !== undefined) {
    clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
  }
};

// Windows simulates an HTCAPTION titlebar click at drag/resize start, which
// fires a transient focus-lost -> focus-gained pair (tauri #10767, #5864).
// Setting this flag before the call lets useHotkey's focus-loss handler
// ignore that blur instead of hiding the Spotlight mid-manipulation
// (tauri #12747). The timeout is a fallback in case focus-gained never
// arrives (e.g. the drag is cancelled without a focus change).
function beginManipulation(): void {
  manipulating = true;
  if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
  fallbackTimer = setTimeout(() => {
    manipulating = false;
  }, 1000);
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauri()) return;
  beginManipulation();
  await getCurrentWindow().startDragging();
}

export async function startWindowResize(dir: ResizeDirection): Promise<void> {
  if (!isTauri()) return;
  beginManipulation();
  await getCurrentWindow().startResizeDragging(dir);
}

/** Hide the palette (header ✕). Same effect as Esc/blur — the window is
 *  summoned back via the global hotkey. */
export async function hideWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().hide();
}

/** Bring this window back after the system browser stole focus (sign-in
 *  hand-off). Focus is what the palette's blur-hide watches, so both calls
 *  are needed — show() alone leaves it behind the browser. */
export async function showWindow(): Promise<void> {
  if (!isTauri()) return;
  const window = getCurrentWindow();
  await window.show();
  await window.setFocus();
}
