/**
 * Guard for the hand-mirrored selection-bar defaults: DEFAULT_SETTINGS in
 * types/index.ts must stay byte-identical to the serde defaults in
 * src-tauri/src/domain/settings.rs (the Rust side is the source of truth —
 * the frontend normally receives fully-defaulted settings via loadSettings).
 * The blocklist is security-relevant (password managers / credential UIs),
 * so silent drift between the two copies must fail CI, not a user.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./index";

// Vitest runs with cwd = project root (vite.config's root).
const rsSource = readFileSync(
  join(process.cwd(), "src-tauri/src/domain/settings.rs"),
  "utf8"
);

/** String literals of the array inside `fn <name>() -> Vec<String>`. */
function rustDefaultList(name: string): string[] {
  const fn = rsSource.split(`fn ${name}()`)[1]?.split(".map(String::from)")[0];
  expect(fn, `fn ${name}() not found in settings.rs`).toBeTruthy();
  return [...fn!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
}

describe("Rust ↔ TS default mirror (settings.rs / DEFAULT_SETTINGS)", () => {
  it("selectionBarApps matches default_selection_bar_apps()", () => {
    expect(DEFAULT_SETTINGS.selectionBarApps).toEqual(
      rustDefaultList("default_selection_bar_apps")
    );
  });

  it("selectionBarBlocklist matches default_selection_bar_blocklist()", () => {
    expect(DEFAULT_SETTINGS.selectionBarBlocklist).toEqual(
      rustDefaultList("default_selection_bar_blocklist")
    );
  });

  it("enabledSkillIds matches default_enabled_skill_ids()", () => {
    expect(DEFAULT_SETTINGS.enabledSkillIds).toEqual(
      rustDefaultList("default_enabled_skill_ids")
    );
  });

  // The palette chord is also mirrored in the website's HOTKEYS.primary
  // (Insert-Go Website/lib/constants/hotkeys.ts) — three copies, one string.
  it("hotkey matches Settings::default()", () => {
    expect(rsSource).toContain(`hotkey: "${DEFAULT_SETTINGS.hotkey}".into()`);
  });
});
