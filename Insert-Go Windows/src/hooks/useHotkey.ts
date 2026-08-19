/**
 * Bridges the OS-level global shortcut (registered in Rust) to the React UI.
 * The Rust side toggles window visibility and emits `palette:shown` /
 * `palette:hidden`; here we react to those (e.g. to focus the editor) and
 * wire `Esc` to hide the palette and restore focus to the previous app.
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/services/tauriBridge";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import {
  isManipulatingWindow,
  clearWindowManipulation,
} from "@/services/windowChrome";
import { usePromptStore } from "@/store/promptStore";

export type HotkeyHandlers = {
  /** Called when the palette becomes visible (good time to focus input). */
  onShown?: () => void;
  /** Called when the palette is hidden. */
  onHidden?: () => void;
};

export function useHotkey({ onShown, onHidden }: HotkeyHandlers): void {
  // Root-level Escape hides the palette window (the OS then returns focus to
  // the prior foreground app). Bubble phase so any open dialog's capture-phase
  // Escape wins and this fallback never fires underneath it.
  useAppShortcuts(
    {
      onClose: () => {
        if (!isTauri()) return false;
        void getCurrentWindow().hide();
        onHidden?.();
      },
    },
    { capture: false }
  );

  useEffect(() => {
    if (!isTauri()) return;

    const unlisteners: Array<() => void> = [];

    listen("palette:shown", () => onShown?.()).then((u) => unlisteners.push(u));
    listen("palette:hidden", () => onHidden?.()).then((u) =>
      unlisteners.push(u)
    );

    // Click-outside / focus-loss dismissal (SPEC §5.2): hide when the palette
    // loses focus so it behaves like a Spotlight overlay.
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          clearWindowManipulation();
          return;
        }
        // Ignore the transient blur Windows emits when startDragging/
        // startResizeDragging simulate a titlebar click (#10767); only a
        // real click-away (no active manipulation) should dismiss the
        // palette.
        if (isManipulatingWindow()) return;
        // No isLoading exception here: sign-in now hides the window itself
        // right after the browser opens, so blur-hide during login is the
        // desired behaviour, not a race to suppress. Generation still wins —
        // hiding mid-stream would orphan the request UI.
        const isGenerating = usePromptStore.getState().isSending;
        if (isGenerating) return;
        void getCurrentWindow().hide();
        onHidden?.();
      })
      .then((u) => unlisteners.push(u));

    return () => unlisteners.forEach((u) => u());
  }, [onShown, onHidden]);
}
