/**
 * Chord matching: the webview-side half of the Improve hotkey. Rust owns the
 * global registration; this decides whether a keydown inside our own window is
 * the user's configured chord.
 */
import { describe, expect, it } from "vitest";
import { matchesChord } from "@/services/hotkeyChord";

describe("chord matching", () => {
  it("matches the configured chord exactly, ignoring extra modifiers", () => {
    const press = (over: Partial<KeyboardEvent>) => ({
      key: "Enter",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      ...over,
    });
    expect(
      matchesChord(press({ ctrlKey: true, altKey: true }), "Ctrl+Alt+Enter")
    ).toBe(true);
    // An extra modifier is a different chord.
    expect(
      matchesChord(
        press({ ctrlKey: true, altKey: true, shiftKey: true }),
        "Ctrl+Alt+Enter"
      )
    ).toBe(false);
    // A missing modifier is not the chord either — plain Enter must stay a
    // newline in any textarea the chord is pressed in.
    expect(matchesChord(press({}), "Ctrl+Alt+Enter")).toBe(false);
    // Remapped chords work, and "Return" is accepted for Enter.
    expect(matchesChord(press({ ctrlKey: true }), "Ctrl+Return")).toBe(true);
  });

  it("normalizes every non-printing key alias accepted by Rust", () => {
    const press = (key: string, shiftKey = false) => ({
      key,
      ctrlKey: true,
      altKey: true,
      shiftKey,
      metaKey: false,
    });

    for (const [configured, browserKey] of [
      ["Up", "ArrowUp"],
      ["Down", "ArrowDown"],
      ["Left", "ArrowLeft"],
      ["Right", "ArrowRight"],
      ["Space", " "],
      ["Backquote", "`"],
      ["Grave", "`"],
      ["Del", "Delete"],
    ]) {
      expect(
        matchesChord(press(browserKey), `Ctrl+Alt+${configured}`),
        configured
      ).toBe(true);
    }
    expect(matchesChord(press("~", true), "Ctrl+Alt+Shift+Grave")).toBe(true);
  });
});
