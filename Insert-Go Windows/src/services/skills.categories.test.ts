/**
 * Skill Manager additions: category resolution + filtering, and skill-set
 * preset validation/mutation. Pure functions, so a plain input→output check.
 */
import { describe, expect, it } from "vitest";
import type { Skill } from "@/types";
import {
  addPreset,
  filterSkills,
  matchesCategory,
  removePreset,
  resolveSkillGrounding,
  skillCategory,
  slugifyPresetId,
  validateCustomSkill,
  validatePreset,
} from "./skills";

const builtin = (id: string, over: Partial<Skill> = {}): Skill => ({
  id,
  label: id,
  template: "t",
  ...over,
});
const custom = (id: string, over: Partial<Skill> = {}): Skill => ({
  id,
  label: id,
  template: "t",
  isCustom: true,
  ...over,
});

describe("resolveSkillGrounding", () => {
  it("grounds only the two research built-ins", () => {
    expect(resolveSkillGrounding(builtin("learn-more"))).toBe(true);
    expect(resolveSkillGrounding(builtin("answer-this-question"))).toBe(true);
    expect(resolveSkillGrounding(builtin("summarize-this"))).toBe(false);
    expect(resolveSkillGrounding(builtin("improve-this"))).toBe(false);
  });

  it("falls back to a custom skill's own flag", () => {
    expect(resolveSkillGrounding(custom("custom-news"))).toBe(false);
    expect(
      resolveSkillGrounding(custom("custom-news", { grounded: true }))
    ).toBe(true);
    expect(
      resolveSkillGrounding(custom("custom-news", { grounded: false }))
    ).toBe(false);
  });
});

describe("skillCategory", () => {
  it("maps a known built-in id", () => {
    expect(skillCategory(builtin("summarize-this"))).toBe("writing");
    expect(skillCategory(builtin("learn-more"))).toBe("research");
  });

  it("falls back to ops for an unmapped built-in", () => {
    expect(skillCategory(builtin("brand-new-skill"))).toBe("ops");
  });

  it("uses a custom skill's own category, else custom", () => {
    expect(skillCategory(custom("custom-a", { category: "coding" }))).toBe(
      "coding"
    );
    expect(skillCategory(custom("custom-b"))).toBe("custom");
    // An invalid stored value degrades to custom, never throws.
    expect(
      skillCategory(custom("custom-c", { category: "nonsense" as never }))
    ).toBe("custom");
  });
});

describe("matchesCategory / filterSkills", () => {
  const all: Skill[] = [
    builtin("summarize-this"), // writing
    builtin("learn-more"), // research
    custom("custom-coder", { label: "Coder", category: "coding" }),
    custom("custom-note", { label: "Note", description: "quick memo" }),
  ];

  it("'all' matches everything; 'custom' matches every user skill", () => {
    expect(all.filter((s) => matchesCategory(s, "all"))).toHaveLength(4);
    expect(filterSkills(all, "custom", "").map((s) => s.id)).toEqual([
      "custom-coder",
      "custom-note",
    ]);
  });

  it("a custom skill shows under both its category and Custom", () => {
    expect(filterSkills(all, "coding", "").map((s) => s.id)).toEqual([
      "custom-coder",
    ]);
    expect(filterSkills(all, "writing", "").map((s) => s.id)).toEqual([
      "summarize-this",
    ]);
  });

  it("'selected' matches only bar skills; empty/absent set matches none", () => {
    const enabled = new Set(["summarize-this", "custom-note"]);
    expect(filterSkills(all, "selected", "", enabled).map((s) => s.id)).toEqual([
      "summarize-this",
      "custom-note",
    ]);
    // Query still applies within the selected view.
    expect(filterSkills(all, "selected", "memo", enabled).map((s) => s.id)).toEqual([
      "custom-note",
    ]);
    // No set (or empty set) → nothing, never a crash.
    expect(filterSkills(all, "selected", "")).toHaveLength(0);
    expect(matchesCategory(builtin("summarize-this"), "selected")).toBe(false);
  });

  it("query filters by label and description, case-insensitively", () => {
    expect(filterSkills(all, "all", "CODER").map((s) => s.id)).toEqual([
      "custom-coder",
    ]);
    expect(filterSkills(all, "all", "memo").map((s) => s.id)).toEqual([
      "custom-note",
    ]);
    expect(filterSkills(all, "all", "zzz")).toHaveLength(0);
  });
});

describe("validateCustomSkill carries category", () => {
  it("stores a valid category, defaults to custom", () => {
    const ok = validateCustomSkill(
      { label: "My Skill", template: "do it", category: "research" },
      []
    );
    expect(ok.ok && ok.skill.category).toBe("research");
    const def = validateCustomSkill({ label: "Bare", template: "x" }, []);
    expect(def.ok && def.skill.category).toBe("custom");
  });
});

describe("skill-set presets", () => {
  it("slugifies names into the preset- namespace", () => {
    expect(slugifyPresetId("Writing Mode!")).toBe("preset-writing-mode");
    expect(slugifyPresetId("   ")).toBe("");
  });

  it("rejects empty name, empty selection, and duplicates", () => {
    expect(validatePreset("", ["a"], []).ok).toBe(false);
    expect(validatePreset("Set", [], []).ok).toBe(false);
    const existing = [{ id: "preset-set", name: "Set", skillIds: ["a"] }];
    // Case-insensitive name collision.
    expect(validatePreset("set", ["a"], existing).ok).toBe(false);
  });

  it("addPreset appends a snapshot; removePreset drops by id", () => {
    const { presets, preset } = addPreset([], "Writing Mode", ["a", "b"]);
    expect(preset.id).toBe("preset-writing-mode");
    expect(preset.skillIds).toEqual(["a", "b"]);
    expect(presets).toHaveLength(1);
    expect(removePreset(presets, "preset-writing-mode")).toHaveLength(0);
  });

  it("addPreset throws on an invalid draft", () => {
    expect(() => addPreset([], "", ["a"])).toThrow();
  });
});
