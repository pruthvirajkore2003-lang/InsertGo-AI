import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composeResearchPrompt,
  composeResearchTopic,
  generateGrounded,
  isAllowedModel,
  mapGroundingMetadata,
  resolveGroundingModel,
  RESEARCH_SYSTEM,
} from "./gemini";

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

// --- pass 1 (grounded research) ---------------------------------------------
// The SDK is mocked at the module boundary: these assert the request shape and
// the no-research guard, never a live Google Search.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai/web", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

/** A pass-1 response from a run where the search tool actually fired. */
function searchedResponse() {
  return {
    text: "Next.js 15.3.8 is the current stable release.",
    candidates: [
      {
        finishReason: "STOP",
        groundingMetadata: {
          webSearchQueries: ["next.js latest release 2026 -site:youtube.com"],
          groundingChunks: [
            { web: { uri: "https://redirect.example/1", title: "nextjs.org" } },
          ],
        },
      },
    ],
  };
}

describe("composeResearchTopic", () => {
  it("appends no search operator — the model writes its own queries", () => {
    const topic = composeResearchTopic("<draft>Next.js edge runtime</draft>");
    expect(topic).toBe("Next.js edge runtime");
    expect(topic).not.toContain("-site:");
  });

  it("caps the topic so the whole draft never reaches Google", () => {
    expect(composeResearchTopic("word ".repeat(400)).length).toBeLessThanOrEqual(
      500
    );
  });
});

describe("RESEARCH_SYSTEM", () => {
  // Both are load-bearing: googleSearch is discretionary, and the Developer API
  // has no excludeDomains, so the instruction is the only place either lives.
  it("mandates the search and puts the exclusion on every query", () => {
    expect(RESEARCH_SYSTEM).toContain("SEARCHING IS MANDATORY");
    expect(RESEARCH_SYSTEM).toContain("-site:youtube.com");
  });
});

describe("composeResearchPrompt", () => {
  it("dates the request outside the untrusted <topic> boundary", () => {
    const p = composeResearchPrompt("react 19 server components", "2026-08-27");
    expect(p).toContain("<topic>\nreact 19 server components\n</topic>");
    expect(p.indexOf("2026-08-27")).toBeLessThan(p.indexOf("<topic>"));
  });
});

describe("mapGroundingMetadata", () => {
  it("drops YouTube sources by title domain and by uri host", () => {
    const { chunks } = mapGroundingMetadata({
      groundingChunks: [
        { web: { uri: "https://redirect.example/1", title: "youtube.com" } },
        { web: { uri: "https://m.youtube.com/watch?v=abc", title: "A video" } },
        { web: { uri: "https://youtu.be/abc", title: "A short" } },
        { web: { uri: "https://redirect.example/3", title: "youtube.com › watch" } },
        { web: { uri: "https://redirect.example/2", title: "nextjs.org" } },
      ],
    });
    expect(chunks).toEqual([
      { uri: "https://redirect.example/2", title: "nextjs.org" },
    ]);
  });

  it("keeps a real source whose title merely mentions YouTube", () => {
    const { chunks } = mapGroundingMetadata({
      groundingChunks: [
        {
          web: {
            uri: "https://redirect.example/3",
            title: "YouTube changes its API — theverge.com",
          },
        },
      ],
    });
    expect(chunks).toHaveLength(1);
  });
});

describe("generateGrounded", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  it("sends a dated prompt with the search tool and returns the findings", async () => {
    generateContent.mockResolvedValue(searchedResponse());
    const res = await generateGrounded("next.js edge runtime", "gemini-2.5-flash");

    const req = generateContent.mock.calls[0][0];
    expect(req.config.tools).toEqual([{ googleSearch: {} }]);
    expect(req.config.systemInstruction).toBe(RESEARCH_SYSTEM);
    expect(req.contents).toContain("Today's date is");
    expect(req.contents).toContain("<topic>\nnext.js edge runtime\n</topic>");

    expect(res.findings).toContain("15.3.8");
    expect(res.grounding.queries).toHaveLength(1);
    expect(res.grounding.chunks).toHaveLength(1);
  });

  it("throws when the model answered from memory instead of searching", async () => {
    // Discretionary tool: text, no grounding metadata. Returning this would
    // cache un-sourced recall as "research" for 24h and cite nothing.
    generateContent.mockResolvedValue({
      text: "Next.js 14 is current.",
      candidates: [{ finishReason: "STOP" }],
    });
    await expect(
      generateGrounded("next.js edge runtime", "gemini-2.5-flash")
    ).rejects.toThrow(/no research/);
  });

  it("throws, naming finishReason, when the output cap left no findings", async () => {
    const res = searchedResponse();
    res.text = "";
    res.candidates[0].finishReason = "MAX_TOKENS";
    generateContent.mockResolvedValue(res);
    await expect(
      generateGrounded("next.js edge runtime", "gemini-2.5-flash")
    ).rejects.toThrow(/MAX_TOKENS/);
  });
});
