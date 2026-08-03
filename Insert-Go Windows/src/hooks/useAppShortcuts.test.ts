/**
 * Semantics under test: platform-aware Mod resolution, exact modifier
 * matching, web-vs-desktop binding tables (browser-fatal chords never bind
 * on web), editable-target rules, and the decline (`return false`) contract.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppShortcuts, type AppShortcutHandlers } from "./useAppShortcuts";

function press(
  key: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
  > = {},
  target: EventTarget = window
): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...mods,
  });
  target.dispatchEvent(e);
  return e;
}

function mount(handlers: AppShortcutHandlers, opts?: { capture?: boolean }) {
  return renderHook(() => useAppShortcuts(handlers, opts));
}

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, "platform", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setPlatform("Win32");
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("useAppShortcuts", () => {
  it("fires onSave on Ctrl+S (Windows) and consumes the event", () => {
    setPlatform("Win32");
    const onSave = vi.fn();
    const { unmount } = mount({ onSave });
    const e = press("s", { ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    unmount();
  });

  it("requires an exact modifier match (Ctrl+Shift+S is not save)", () => {
    const onSave = vi.fn();
    const { unmount } = mount({ onSave });
    press("s", { ctrlKey: true, shiftKey: true });
    press("s"); // bare key
    expect(onSave).not.toHaveBeenCalled();
    unmount();
  });

  it("uses Meta on macOS and rejects Ctrl there", () => {
    setPlatform("MacIntel");
    const onSave = vi.fn();
    const { unmount } = mount({ onSave });
    press("s", { ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
    press("s", { metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("fires onClose on Escape, including from an input", () => {
    const onClose = vi.fn();
    const { unmount } = mount({ onClose });
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("Escape", {}, input);
    expect(onClose).toHaveBeenCalledTimes(1);
    input.remove();
    unmount();
  });

  it("never binds onCloseView (Mod+W) in a browser environment", () => {
    const onCloseView = vi.fn();
    const { unmount } = mount({ onCloseView });
    const e = press("w", { ctrlKey: true });
    expect(onCloseView).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    unmount();
  });

  it("binds onCloseView (Mod+W) inside the Tauri shell", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const onCloseView = vi.fn();
    const { unmount } = mount({ onCloseView });
    press("w", { ctrlKey: true });
    expect(onCloseView).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("re-maps onNewItem to Mod+Alt+N on web (Mod+N stays with the browser)", () => {
    const onNewItem = vi.fn();
    const { unmount } = mount({ onNewItem });
    const plain = press("n", { ctrlKey: true });
    expect(onNewItem).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(false);
    press("n", { ctrlKey: true, altKey: true });
    expect(onNewItem).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("binds the tab chords to Mod+Tab / Mod+Shift+Tab on desktop", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const onNextTab = vi.fn();
    const onPrevTab = vi.fn();
    const { unmount } = mount({ onNextTab, onPrevTab });
    press("Tab", { ctrlKey: true });
    expect(onNextTab).toHaveBeenCalledTimes(1);
    expect(onPrevTab).not.toHaveBeenCalled();
    press("Tab", { ctrlKey: true, shiftKey: true });
    expect(onPrevTab).toHaveBeenCalledTimes(1);
    expect(onNextTab).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("never binds Mod+Tab on web (the browser's own tab strip owns it)", () => {
    const onNextTab = vi.fn();
    const onPrevTab = vi.fn();
    const { unmount } = mount({ onNextTab, onPrevTab });
    const e = press("Tab", { ctrlKey: true });
    press("Tab", { ctrlKey: true, shiftKey: true });
    expect(onNextTab).not.toHaveBeenCalled();
    expect(onPrevTab).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    unmount();
  });

  it("takes the bracket chords on web, shifted glyph included", () => {
    const onNextTab = vi.fn();
    const onPrevTab = vi.fn();
    const { unmount } = mount({ onNextTab, onPrevTab });
    // A real browser reports the shifted glyph ("}"), but layouts vary — both
    // spellings must bind.
    press("}", { ctrlKey: true, shiftKey: true });
    press("]", { ctrlKey: true, shiftKey: true });
    expect(onNextTab).toHaveBeenCalledTimes(2);
    press("{", { ctrlKey: true, shiftKey: true });
    expect(onPrevTab).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("keeps Alt-chords out of editable targets (AltGr types characters)", () => {
    const onNewItem = vi.fn();
    const { unmount } = mount({ onNewItem });
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("n", { ctrlKey: true, altKey: true }, input);
    expect(onNewItem).not.toHaveBeenCalled();
    input.remove();
    unmount();
  });

  it("still fires plain Mod-chords inside inputs (Ctrl+S while typing)", () => {
    const onSave = vi.fn();
    const { unmount } = mount({ onSave });
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("s", { ctrlKey: true }, input);
    expect(onSave).toHaveBeenCalledTimes(1);
    input.remove();
    unmount();
  });

  it("leaves the event untouched when the handler declines with false", () => {
    const onClose = vi.fn(() => false);
    const { unmount } = mount({ onClose });
    const e = press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(false);
    unmount();
  });
});
