import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREDITS,
  DEFAULT_SUBSCRIPTION_STATUS,
  GROUNDED_DAILY_MAX,
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
  utcToday,
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

describe("GROUNDED_DAILY_MAX", () => {
  // Cost regression guard. Google bills Search grounding per grounded prompt
  // ($35/1k on Gemini 2.5, $14/1k on 3.x), so these ceilings ARE the monthly
  // grounding bill: max/day * 30 * rate. Raising one raises COGS linearly, and
  // free must stay 0 — a free account grounding its 5 daily credits costs
  // ~$5.25/month against no revenue at all.
  it("keeps free at zero", () => {
    expect(GROUNDED_DAILY_MAX.free).toBe(0);
  });

  it("keeps paid ceilings inside their price at the 3.x grounding rate", () => {
    const RATE_PER_CALL = 0.014; // $14 per 1,000 grounded prompts
    const monthly = (perDay: number) => perDay * 30 * RATE_PER_CALL;
    // Grounding alone must stay a small slice of revenue — the plan still has
    // to cover ordinary generations, payment fees, and infra.
    expect(monthly(GROUNDED_DAILY_MAX.plus)).toBeLessThan(7.99 * 0.15);
    expect(monthly(GROUNDED_DAILY_MAX.pro)).toBeLessThan(14.99 * 0.25);
  });
});

describe("isGroundingEntitled", () => {
  it("denies free — the tier that used to qualify via credits > 0", () => {
    expect(isGroundingEntitled("free")).toBe(false);
  });

  it("allows paid tiers", () => {
    expect(isGroundingEntitled("plus")).toBe(true);
    expect(isGroundingEntitled("pro")).toBe(true);
  });

  it("derives from GROUNDED_DAILY_MAX so the gate and counter cannot drift", () => {
    for (const tier of ["free", "plus", "pro"] as const) {
      expect(isGroundingEntitled(tier)).toBe(GROUNDED_DAILY_MAX[tier] > 0);
    }
  });
});

describe("requireGroundingEntitlement", () => {
  it("403s with paywall wording for an unentitled tier", () => {
    const denied = requireGroundingEntitlement("free", {
      groundingConfigured: true,
    });
    expect(denied?.status).toBe(403);
    expect(denied?.message.toLowerCase()).toMatch(/upgrade|plan/);
  });

  it("403s with paywall wording when the server has no grounding model", () => {
    const denied = requireGroundingEntitlement("pro", {
      groundingConfigured: false,
    });
    expect(denied?.status).toBe(403);
    expect(denied?.message.toLowerCase()).toMatch(/upgrade|plan/);
  });

  it("allows an entitled tier when grounding is configured", () => {
    expect(
      requireGroundingEntitlement("plus", { groundingConfigured: true }),
    ).toBeNull();
    expect(
      requireGroundingEntitlement("pro", { groundingConfigured: true }),
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

  it("uses the UTC day, not the local one, at both edges of the boundary", () => {
    // The reset is defined in UTC and the row's date column is written in UTC,
    // so a machine east or west of Greenwich must still agree on "today".
    expect(utcToday(new Date("2026-07-22T23:59:59.999Z"))).toBe("2026-07-22");
    expect(utcToday(new Date("2026-07-23T00:00:00.000Z"))).toBe("2026-07-23");
    const row = { dailyCreditsUsed: 5, dailyDate: "2026-07-22" };
    expect(
      dailyRemaining(row, "free", utcToday(new Date("2026-07-22T23:59:59Z"))),
    ).toBe(0);
    expect(
      dailyRemaining(row, "free", utcToday(new Date("2026-07-23T00:00:00Z"))),
    ).toBe(5);
  });
});

/**
 * Mid-day plan changes. The daily counter is a single "used today" integer, NOT
 * a per-tier one, so a tier write from the billing webhook re-derives the
 * allowance against usage the OLD tier accrued. Both directions have to be
 * safe: an upgrade must credit the difference immediately (the user paid now,
 * not at 00:00 UTC tomorrow), and a downgrade must never produce a negative
 * remainder that reads back as free generations.
 */
describe("plan transitions mid-day", () => {
  const today = "2026-07-22";

  it("upgrade Free -> Plus grants the difference immediately", () => {
    const row = { dailyCreditsUsed: 5, dailyDate: today };
    expect(dailyRemaining(row, "free", today)).toBe(0); // exhausted on free
    // Same row, new tier: 50 - 5. The webhook writes only "tier", so this is
    // the whole upgrade path — no counter reset, no cron, no double-grant.
    expect(dailyRemaining(row, "plus", today)).toBe(45);
  });

  it("upgrade Plus -> Pro keeps prior usage spent, not refunded", () => {
    const row = { dailyCreditsUsed: 50, dailyDate: today };
    expect(dailyRemaining(row, "plus", today)).toBe(0);
    expect(dailyRemaining(row, "pro", today)).toBe(100); // 150 - 50, not 150
  });

  it("downgrade Pro -> Plus past the new cap clamps to 0, never negative", () => {
    // 60 used on pro, then the plan_changed webhook writes tier=plus. 50 - 60
    // is -10; a negative remainder added to add-on credits would UNDERSTATE the
    // balance header, and a `> 0` check elsewhere would read it as "has daily".
    const row = { dailyCreditsUsed: 60, dailyDate: today };
    expect(dailyRemaining(row, "plus", today)).toBe(0);
    // The next debit therefore comes out of the non-expiring add-on pool, which
    // is exactly what debit_credit does once the daily branch stops matching.
  });

  it("a downgrade does not leak into the next UTC day", () => {
    const row = { dailyCreditsUsed: 60, dailyDate: today };
    expect(dailyRemaining(row, "plus", "2026-07-23")).toBe(50);
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
