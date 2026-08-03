/**
 * Contract for the usage store (skillUsage.ts): counts round-trip, malformed
 * storage degrades to empty, and a throwing store never propagates.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSkillUsage, recordSkillUse } from "@/services/skillUsage";

beforeEach(() => {
  localStorage.clear();
});

describe("skillUsage", () => {
  it("starts empty and counts uses", () => {
    expect(getSkillUsage()).toEqual({});
    recordSkillUse("summarize-this");
    recordSkillUse("summarize-this");
    recordSkillUse("translate-this");
    expect(getSkillUsage()).toEqual({ "summarize-this": 2, "translate-this": 1 });
  });

  it("ignores malformed stored values", () => {
    localStorage.setItem("ig.skillUsage", "not json{");
    expect(getSkillUsage()).toEqual({});
    localStorage.setItem(
      "ig.skillUsage",
      JSON.stringify({ good: 3, bad: "x", neg: -1 })
    );
    expect(getSkillUsage()).toEqual({ good: 3 });
  });

  it("never throws when the store errors", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => recordSkillUse("x")).not.toThrow();
    spy.mockRestore();
  });
});
