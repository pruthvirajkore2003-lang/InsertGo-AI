import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREDITS,
  DEFAULT_SUBSCRIPTION_STATUS,
  TIER_DAILY_CREDITS,
  dailyRemaining,
  isGroundingEntitled,
  normalizeEntitlements,
  MAX_PROMPT_CHARS,
  MAX_SYSTEM_CHARS,
  normalizeTier,
  requireGroundingEntitlement,
  requirePayloadWithinLimit,
  requireSession,
  requireWithinQuota,
  tierAllowsHistory,
  type Denied,
} from "./entitlements";

describe("requireSession", () => {
  it("denies with 401 when no session/user id", () => {
    expect(requireSession(null)?.status).toBe(401);
    expect(requireSession({ user: null })?.status).toBe(401);
    expect(requireSession({ user: { id: null } })?.status).toBe(401);
  });

  it("allows a session with a user id", () => {
    expect(requireSession({ user: { id: "u1" } })).toBeNull();
  });
});

describe("isGroundingEntitled", () => {
  it("denies without a session", () => {
    expect(isGroundingEntitled(null)).toBe(false);
    expect(isGroundingEntitled({ user: { id: null } })).toBe(false);
  });

  it("allows a subscribed user regardless of credits", () => {
    expect(
      isGroundingEntitled({
        user: { id: "u1", subscriptionStatus: "subscribed", credits: 0 },
      }),
    ).toBe(true);
  });

  it("allows a trial user with credits remaining", () => {
    expect(
      isGroundingEntitled({
        user: { id: "u1", subscriptionStatus: "trial", credits: 3 },
      }),
    ).toBe(true);
  });

  it("denies when credits are gone and not subscribed", () => {
    expect(
      isGroundingEntitled({
        user: { id: "u1", subscriptionStatus: "trial", credits: 0 },
      }),
    ).toBe(false);
    expect(
      isGroundingEntitled({
        user: { id: "u1", subscriptionStatus: "expired", credits: 0 },
      }),
    ).toBe(false);
  });

  it("falls back to entitled when the session carries no billing fields (rollout mismatch)", () => {
    expect(isGroundingEntitled({ user: { id: "u1" } })).toBe(true);
  });
});

describe("requireGroundingEntitlement", () => {
  const paying = {
    user: { id: "u1", subscriptionStatus: "subscribed" as const, credits: 0 },
  };
  const broke = {
    user: { id: "u1", subscriptionStatus: "expired" as const, credits: 0 },
  };

  it("403s with paywall wording when the user is not entitled", () => {
    const denied = requireGroundingEntitlement(broke, {
      groundingConfigured: true,
    });
    expect(denied?.status).toBe(403);
    expect(denied?.message.toLowerCase()).toMatch(/upgrade|plan/);
  });

  it("allows an entitled user when grounding is configured", () => {
    expect(
      requireGroundingEntitlement(paying, { groundingConfigured: true }),
    ).toBeNull();
  });
});

describe("normalizeEntitlements", () => {
  it("passes through valid rows", () => {
    expect(
      normalizeEntitlements({ subscriptionStatus: "subscribed", credits: 7 }),
    ).toEqual({ subscriptionStatus: "subscribed", credits: 7 });
  });

  it("collapses unknown status and bad credits to trial defaults", () => {
    expect(normalizeEntitlements({ subscriptionStatus: "vip", credits: "9" })).
      toEqual({
        subscriptionStatus: DEFAULT_SUBSCRIPTION_STATUS,
        credits: DEFAULT_CREDITS,
      });
    expect(normalizeEntitlements(undefined)).toEqual({
      subscriptionStatus: DEFAULT_SUBSCRIPTION_STATUS,
      credits: DEFAULT_CREDITS,
    });
  });
});

describe("normalizeTier", () => {
  it("passes through valid tiers", () => {
    expect(normalizeTier({ tier: "free" })).toBe("free");
    expect(normalizeTier({ tier: "plus" })).toBe("plus");
    expect(normalizeTier({ tier: "pro" })).toBe("pro");
  });

  it("maps legacy subscribed rows (no tier column) to pro", () => {
    expect(normalizeTier({ subscriptionStatus: "subscribed" })).toBe("pro");
  });

  it("collapses unknown/missing values to free (never widens access)", () => {
    expect(normalizeTier({ tier: "enterprise" })).toBe("free");
    expect(normalizeTier({ subscriptionStatus: "trial" })).toBe("free");
    expect(normalizeTier(undefined)).toBe("free");
  });
});

describe("tier feature gates", () => {
  it("history is a paid feature; Free doesn't get it", () => {
    expect(tierAllowsHistory("free")).toBe(false);
    expect(tierAllowsHistory("plus")).toBe(true);
    expect(tierAllowsHistory("pro")).toBe(true);
  });

  it("daily allowances match the 5/50/150 catalog", () => {
    expect(TIER_DAILY_CREDITS).toEqual({ free: 5, plus: 50, pro: 150 });
  });
});

describe("dailyRemaining", () => {
  it("subtracts today's usage from the tier allowance", () => {
    expect(
      dailyRemaining(
        { dailyCreditsUsed: 3, dailyDate: "2026-07-22" },
        "free",
        "2026-07-22",
      ),
    ).toBe(2);
  });

  it("treats a stale dailyDate as unused (lazy 00:00 UTC reset)", () => {
    expect(
      dailyRemaining(
        { dailyCreditsUsed: 5, dailyDate: "2026-07-21" },
        "free",
        "2026-07-22",
      ),
    ).toBe(5);
  });

  it("clamps over-use to zero and tolerates junk rows", () => {
    expect(
      dailyRemaining(
        { dailyCreditsUsed: 99, dailyDate: "2026-07-22" },
        "free",
        "2026-07-22",
      ),
    ).toBe(0);
    expect(dailyRemaining({}, "plus", "2026-07-22")).toBe(50);
  });
});

describe("requireWithinQuota", () => {
  it("returns null when the request is within quota", () => {
    expect(requireWithinQuota({ allowed: true })).toBeNull();
  });

  it("returns a 429 Denied when the quota is exhausted", () => {
    const denied = requireWithinQuota({ allowed: false });
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(429);
    expect(denied?.message).toMatch(/request limit/i);
  });

  it("keeps the 429 message free of paywall words (routes to retry, not upgrade)", () => {
    const denied = requireWithinQuota({ allowed: false }) as Denied;
    expect(denied.message.toLowerCase()).not.toMatch(/trial|upgrade|credit/);
  });
});

describe("requirePayloadWithinLimit", () => {
  it("allows a payload at the cap", () => {
    expect(
      requirePayloadWithinLimit({
        prompt: "x".repeat(MAX_PROMPT_CHARS),
        system: "y".repeat(MAX_SYSTEM_CHARS),
      }),
    ).toBeNull();
  });

  it("denies with 413 one char past the prompt cap", () => {
    const denied = requirePayloadWithinLimit({
      prompt: "x".repeat(MAX_PROMPT_CHARS + 1),
      system: "",
    });
    expect(denied?.status).toBe(413);
    expect(denied?.message).toMatch(/too long/i);
  });

  it("denies an oversize system prompt even with a small prompt", () => {
    expect(
      requirePayloadWithinLimit({
        prompt: "hi",
        system: "y".repeat(MAX_SYSTEM_CHARS + 1),
      })?.status,
    ).toBe(413);
  });
});
