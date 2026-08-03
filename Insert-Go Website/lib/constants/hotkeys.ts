/**
 * Single source of truth for every hotkey the website displays.
 *
 * Mirrors the desktop defaults — keep in sync with:
 *   Insert-Go Windows/src/types/index.ts        (DEFAULT_SETTINGS)
 *   Insert-Go Windows/src-tauri/src/domain/settings.rs (Settings::default)
 *
 * `keys` renders keycaps, `label` renders inline prose. Never hardcode either.
 */
export const HOTKEYS = {
  primary: {
    keys: ["Ctrl", "`"],
    label: "Ctrl + `",
    name: "Global Palette",
    description: "Toggles the InsertGo palette from any application",
  },
  improve: {
    keys: ["Ctrl", "Alt", "Enter"],
    label: "Ctrl + Alt + Enter",
    name: "Inline Improve",
    description:
      "Rewrites the focused text field in-place without opening the palette",
  },
  undo: {
    keys: ["Ctrl", "Alt", "Z"],
    label: "Ctrl + Alt + Z",
    name: "Inline Undo",
    description: "Restores the pre-improvement draft text",
  },
} as const;

export type HotkeyId = keyof typeof HOTKEYS;
export type Hotkey = (typeof HOTKEYS)[HotkeyId];
