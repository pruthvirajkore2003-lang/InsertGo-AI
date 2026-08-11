import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@/types";
import { GEMINI_MODEL } from "./aiProviders";
import { isGeminiProvider } from "./providerUtils";


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
