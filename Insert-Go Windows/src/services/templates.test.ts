import { describe, expect, it } from "vitest";
import {
  BUILTIN_TEMPLATES,
  expandTemplate,
  extractPlaceholders,
} from "./templates";

describe("extractPlaceholders", () => {
  it("returns unique names in first-seen order", () => {
    const out = extractPlaceholders("{{a}} {{ b }} {{a}} {{c}}");
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("returns empty for no placeholders", () => {
    expect(extractPlaceholders("plain text")).toEqual([]);
  });
});

describe("expandTemplate", () => {
  it("replaces known vars and tolerates inner spaces", () => {
    const out = expandTemplate("Hi {{ name }}!", { name: "Ada" });
    expect(out).toBe("Hi Ada!");
  });

  it("leaves unknown placeholders intact", () => {
    const out = expandTemplate("{{known}} {{unknown}}", { known: "X" });
    expect(out).toBe("X {{unknown}}");
  });

  it("expands selected_text", () => {
    const tpl = "Explain:\n\n{{selected_text}}";
    expect(expandTemplate(tpl, { selected_text: "code" })).toBe(
      "Explain:\n\ncode"
    );
  });
});

describe("BUILTIN_TEMPLATES", () => {
  it("all reference {{selected_text}} and have unique ids", () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(BUILTIN_TEMPLATES.length);
    for (const t of BUILTIN_TEMPLATES) {
      expect(extractPlaceholders(t.body)).toContain("selected_text");
    }
  });
});
