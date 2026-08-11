import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedModel, resolveGroundingModel } from "./gemini";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowedModel", () => {
  it("accepts the model the desktop actually ships", () => {
    // .env.example / VITE_GEMINI_MODEL — a default that rejected this would 400
    // every real generation.
    expect(isAllowedModel("gemini-2.5-flash-lite")).toBe(true);
  });

  it("rejects a premium model the flat 1-credit debit doesn't cover", () => {
    expect(isAllowedModel("gemini-2.5-pro")).toBe(false);
    expect(isAllowedModel("gemini-3.6-pro")).toBe(false);
  });

  it("ignores surrounding whitespace but never matches a partial name", () => {
    expect(isAllowedModel("  gemini-2.5-flash-lite  ")).toBe(true);
    expect(isAllowedModel("gemini-2.5-flash-lite-preview")).toBe(false);
    expect(isAllowedModel("")).toBe(false);
  });

  it("replaces the default outright when GEMINI_ALLOWED_MODELS is set", () => {
    vi.stubEnv("GEMINI_ALLOWED_MODELS", "gemini-2.5-pro , gemini-9-x");
    expect(isAllowedModel("gemini-2.5-pro")).toBe(true);
    expect(isAllowedModel("gemini-9-x")).toBe(true);
    // The code default is gone, not merged — that is what makes the env var a
    // ceiling an operator can actually reason about.
    expect(isAllowedModel("gemini-2.5-flash-lite")).toBe(false);
  });

  it("falls back to the default when the env var is blank or only separators", () => {
    vi.stubEnv("GEMINI_ALLOWED_MODELS", " , ,");
    expect(isAllowedModel("gemini-2.5-flash-lite")).toBe(true);
  });
});

describe("resolveGroundingModel", () => {
  it("is server config, so the allowlist never applies to pass 1", () => {
    vi.stubEnv("GEMINI_GROUNDING_MODEL", "gemini-3.6-flash");
    // Not in DEFAULT_ALLOWED_MODELS, and that is correct: the request body can't
    // choose it.
    expect(isAllowedModel("gemini-3.6-flash")).toBe(false);
    expect(resolveGroundingModel("gemini-2.5-flash-lite")).toBe(
      "gemini-3.6-flash"
    );
  });

  it("returns null for a lite request model with no env configured", () => {
    vi.stubEnv("GEMINI_GROUNDING_MODEL", "");
    expect(resolveGroundingModel("gemini-2.5-flash-lite")).toBeNull();
  });
});
