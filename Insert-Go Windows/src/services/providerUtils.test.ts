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
    const { MAX_PROMPT_CHARS } = await import("@/types");
    // Bound off the constant, not a literal: this cap is a COST control that
    // mirrors the server's authoritative value, so it is expected to move.
    // Hardcoding the number makes the test fail on a deliberate tuning change
    // instead of on a real regression.
    expect(() =>
      enforcePromptLimit("a".repeat(MAX_PROMPT_CHARS), "P"),
    ).not.toThrow();
    expect(() =>
      enforcePromptLimit("a".repeat(MAX_PROMPT_CHARS + 1), "P"),
    ).toThrow(/too long/);
  });

  it("stays at or below the server cap, or users hit an unwarned 413", async () => {
    // The server (Website lib/entitlements.ts MAX_PROMPT_CHARS) is
    // authoritative and rejects with 413. This local copy exists only so an
    // oversize paste fails instantly instead of after a round trip — if it
    // drifts ABOVE the server's value it stops doing that job.
    const { MAX_PROMPT_CHARS } = await import("@/types");
    const SERVER_MAX_PROMPT_CHARS = 24_000;
    expect(MAX_PROMPT_CHARS).toBeLessThanOrEqual(SERVER_MAX_PROMPT_CHARS);
  });
});
