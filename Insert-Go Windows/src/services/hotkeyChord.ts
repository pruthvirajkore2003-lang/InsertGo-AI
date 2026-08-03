type KeyEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
>;

/** Match Rust global-hotkey aliases against `KeyboardEvent.key`, which names
 * several non-printing keys differently. Modifiers must match exactly. */
export function matchesChord(e: KeyEvent, chord: string): boolean {
  const parts = chord
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const configuredKey = parts.pop();
  if (!configuredKey) return false;

  const wants = (...names: string[]) => names.some((name) => parts.includes(name));

  return (
    normalizeKey(e.key) === normalizeKey(configuredKey) &&
    e.ctrlKey === wants("ctrl", "control", "cmdorctrl", "commandorcontrol") &&
    e.altKey === wants("alt", "option") &&
    e.shiftKey === wants("shift") &&
    e.metaKey === wants("super", "meta", "cmd", "command", "win")
  );
}

function normalizeKey(key: string): string {
  if (key === " ") return "space";

  switch (key.trim().toLowerCase()) {
    case "space":
    case "spacebar":
      return "space";
    case "`":
    case "~":
    case "backquote":
    case "grave":
      return "backquote";
    case "return":
      return "enter";
    case "esc":
      return "escape";
    case "up":
      return "arrowup";
    case "down":
      return "arrowdown";
    case "left":
      return "arrowleft";
    case "right":
      return "arrowright";
    case "del":
      return "delete";
    default:
      return key.trim().toLowerCase();
  }
}
