"use client";

/**
 * Central semantic-shortcut registry: one place maps abstract actions
 * (save / palette / close…) to physical chords, per platform.
 *
 * - Mod = Cmd on macOS, Ctrl everywhere else.
 * - Chords that are browser-fatal (Mod+W, Mod+N…) are disabled (`web: null`)
 *   or re-mapped when running outside the Tauri shell, so the web build can
 *   never steal a tab-close or new-window chord.
 * - Mod-chords and Escape fire even while an input/textarea has focus
 *   (Ctrl+S while typing a title must save); bare-key and Alt-chords don't,
 *   because AltGr (= Ctrl+Alt) and plain keys type characters.
 *
 * This file is intentionally dependency-free and byte-identical in both
 * repos: InsertGo-AI/src/hooks/ and InsertGo.AI Website/hooks/. Edit both.
 */
import { useEffect, useRef } from "react";

type Combo = {
  /**
   * Lower-case `KeyboardEvent.key` value ("s", "k", "escape"). A list accepts
   * any one of several, which punctuation needs: a printable key reports its
   * *shifted* glyph, so "[" arrives as "{" while Shift is held, and which
   * glyph appears at all depends on the keyboard layout.
   */
  key: string | readonly string[];
  /** Requires Cmd on macOS / Ctrl elsewhere. */
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
};

/** Action → chord per environment; `web: null` = not available in a browser. */
const SHORTCUTS = {
  onSave: { desktop: { key: "s", mod: true }, web: { key: "s", mod: true } },
  onPalette: { desktop: { key: "k", mod: true }, web: { key: "k", mod: true } },
  onClose: { desktop: { key: "escape" }, web: { key: "escape" } },
  // Mod+W closes the browser tab — desktop only, silently absent on web.
  onCloseView: { desktop: { key: "w", mod: true }, web: null },
  // Mod+N opens a browser window — re-mapped to Mod+Alt+N on web.
  onNewItem: {
    desktop: { key: "n", mod: true },
    web: { key: "n", mod: true, alt: true },
  },
  // Mod+Tab / Mod+Shift+Tab drive the *browser's* tab strip and can't be
  // cancelled from a page — web takes the IDE bracket chords instead.
  // ponytail: on macOS Chrome/Safari the bracket chords are the browser's own
  // tab switcher too, so web tab-cycling is a no-op there (the tab bar is
  // still clickable). Move to a Mod+Alt chord if mac web users ask for it.
  onPrevTab: {
    desktop: { key: "tab", mod: true, shift: true },
    web: { key: ["[", "{"], mod: true, shift: true },
  },
  onNextTab: {
    desktop: { key: "tab", mod: true },
    web: { key: ["]", "}"], mod: true, shift: true },
  },
} satisfies Record<string, { desktop: Combo; web: Combo | null }>;

export type ShortcutAction = keyof typeof SHORTCUTS;

/**
 * Return `false` to decline the event: it propagates untouched (lets a
 * combobox keep its Escape, or a lower dialog layer take over). Any other
 * return consumes it (preventDefault + stopPropagation).
 */
export type ShortcutHandler = (e: KeyboardEvent) => void | boolean;

export type AppShortcutHandlers = Partial<
  Record<ShortcutAction, ShortcutHandler>
>;

/** True when running inside the Tauri shell (vs. a plain browser). */
export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isMacLike(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function matches(e: KeyboardEvent, c: Combo): boolean {
  const key = e.key.toLowerCase();
  if (typeof c.key === "string" ? key !== c.key : !c.key.includes(key))
    return false;
  const mac = isMacLike();
  // Exact modifier match: Mod+Shift+S must not trigger onSave, and Ctrl+S
  // on a Mac stays free for the terminal-style flow it belongs to.
  return (
    e.metaKey === (Boolean(c.mod) && mac) &&
    e.ctrlKey === (Boolean(c.mod) && !mac) &&
    e.altKey === Boolean(c.alt) &&
    e.shiftKey === Boolean(c.shift)
  );
}

function isEditable(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      t.isContentEditable)
  );
}

function firesInEditable(c: Combo): boolean {
  if (c.alt) return false; // AltGr = Ctrl+Alt can type characters
  return Boolean(c.mod) || c.key === "escape";
}

/**
 * Bind semantic app shortcuts. One window keydown listener per call.
 *
 * `capture` defaults to true so a dialog's Escape wins over ancestors —
 * the established layering pattern. Pass `{ capture: false }` for a
 * root-level fallback that should only fire when no layer consumed the key
 * (e.g. the palette window's hide-on-Escape).
 */
export function useAppShortcuts(
  handlers: AppShortcutHandlers,
  opts: { capture?: boolean } = {}
): void {
  const { capture = true } = opts;
  // Ref, not deps: inline handler objects must not re-register per render.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const env: "desktop" | "web" = isTauriEnv() ? "desktop" : "web";
    const onKeyDown = (e: KeyboardEvent) => {
      for (const action of Object.keys(SHORTCUTS) as ShortcutAction[]) {
        const handler = ref.current[action];
        if (!handler) continue;
        const combo = SHORTCUTS[action][env];
        if (!combo || !matches(e, combo)) continue;
        if (isEditable(e.target) && !firesInEditable(combo)) continue;
        if (handler(e) === false) return; // declined — leave the event alone
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown, capture);
    return () => window.removeEventListener("keydown", onKeyDown, capture);
  }, [capture]);
}
