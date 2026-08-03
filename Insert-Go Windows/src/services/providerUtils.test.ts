import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@/types";
import { GEMINI_MODEL } from "./aiProviders";
import {
  defaultProviderId,
  isGeminiProvider,
  removeProvider,
  setDefaultProvider,
  upsertProvider,
  validateProvider,
} from "./providerUtils";


function p(id: string, over: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id,
    name: `name-${id}`,
    baseUrl: "https://example.com",
    apiKey: "",
    isDefault: false,
    ...over,
  };
}

describe("validateProvider", () => {
  it("flags empty name and url", () => {
    const errs = validateProvider(p("a", { name: "", baseUrl: "" }));
    expect(errs).toHaveLength(2);
  });

  it("flags non-http url", () => {
    const errs = validateProvider(p("a", { baseUrl: "example.com" }));
    expect(errs.join()).toMatch(/http/i);
  });

  it("rejects a plaintext http:// url (key would go in cleartext)", () => {
    const errs = validateProvider(p("a", { baseUrl: "http://example.com" }));
    expect(errs.join()).toMatch(/https/i);
  });

  it("accepts a valid provider", () => {
    expect(validateProvider(p("a"))).toHaveLength(0);
  });
});

describe("upsertProvider", () => {
  it("adds a new provider and forces a default when none exists", () => {
    const out = upsertProvider([], p("a"));
    expect(out).toHaveLength(1);
    expect(out[0].isDefault).toBe(true);
  });

  it("updates in place by id", () => {
    const out = upsertProvider([p("a"), p("b")], p("a", { name: "renamed" }));
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("renamed");
  });

  it("demotes others when the upserted one is default", () => {
    const list = [p("a", { isDefault: true }), p("b")];
    const out = upsertProvider(list, p("b", { isDefault: true }));
    expect(out.find((x) => x.id === "a")!.isDefault).toBe(false);
    expect(out.find((x) => x.id === "b")!.isDefault).toBe(true);
  });
});

describe("setDefaultProvider", () => {
  it("marks exactly one default", () => {
    const out = setDefaultProvider([p("a", { isDefault: true }), p("b")], "b");
    expect(out.filter((x) => x.isDefault)).toHaveLength(1);
    expect(out.find((x) => x.id === "b")!.isDefault).toBe(true);
  });
});

describe("removeProvider", () => {
  it("promotes a new default when the default is removed", () => {
    const out = removeProvider([p("a", { isDefault: true }), p("b")], "a");
    expect(out).toHaveLength(1);
    expect(out[0].isDefault).toBe(true);
  });
});

describe("defaultProviderId", () => {
  it("returns the default id, else the first, else null", () => {
    expect(defaultProviderId([])).toBeNull();
    expect(defaultProviderId([p("a"), p("b", { isDefault: true })])).toBe("b");
    expect(defaultProviderId([p("a"), p("b")])).toBe("a");
  });
});

describe("isGeminiProvider", () => {
  it("is true only for the exact generativelanguage.googleapis.com host", () => {
    expect(
      isGeminiProvider(
        p("a", { baseUrl: "https://generativelanguage.googleapis.com" })
      )
    ).toBe(true);
    expect(
      isGeminiProvider(
        p("a", {
          baseUrl: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        })
      )
    ).toBe(true);
  });

  it("is false for look-alike hosts and malformed URLs", () => {
    expect(
      isGeminiProvider(
        p("a", {
          baseUrl: "https://generativelanguage.googleapis.com.evil.example",
        })
      )
    ).toBe(false);
    expect(
      isGeminiProvider(
        p("a", {
          baseUrl: "https://evil.example/generativelanguage.googleapis.com",
        })
      )
    ).toBe(false);
    expect(
      isGeminiProvider(p("a", { baseUrl: "https://api.example.com" }))
    ).toBe(false);
    expect(isGeminiProvider(p("a", { baseUrl: "not-a-url" }))).toBe(false);
    expect(isGeminiProvider(p("a", { baseUrl: "" }))).toBe(false);
  });
});

describe("enforcePromptLimit", () => {
  it("throws past MAX_PROMPT_CHARS and passes under it", async () => {
    const { enforcePromptLimit } = await import("./providerUtils");
    expect(() => enforcePromptLimit("a".repeat(100_000), "P")).not.toThrow();
    expect(() => enforcePromptLimit("a".repeat(100_001), "P")).toThrow(/too long/);
  });
});
