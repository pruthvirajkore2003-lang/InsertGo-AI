import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the two PostgREST RPCs this module calls, dispatched
// by function name: `consume_quota` (per-key counter, as Postgres serialises
// conflicting writes on the PK) and `debit_credit` (ledger + user maps,
// replicating its insert-first/conflict + daily-then-addon semantics, including
// the drain-race ledger cleanup that now lives inside the function).
const counters = new Map<string, number>();
const users = new Map<
  string,
  { tier: string; dailyUsed: number; dailyDate: string; addOn: number }
>();
const ledger = new Map<
  string,
  { userId: string; atMs: number; replays: number }
>();
/** Mock "UTC today" — tests move it to cross the 00:00 UTC boundary. */
let today = "2026-07-22";
vi.mock("./db", () => ({
  DbError: class DbError extends Error {},
  rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "consume_quota") {
      const key = args.p_key as string;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return [{ count: next }];
    }

    const key = args.p_key as string;
    const userId = args.p_user_id as string;
    const caps: Record<string, number> = {
      free: args.p_daily_free as number,
      plus: args.p_daily_plus as number,
      pro: args.p_daily_pro as number,
    };
    const u = users.get(userId);
    if (!u) return []; // no such user -> zero rows
    const prior = ledger.get(key);
    const usedToday = u.dailyDate === today ? u.dailyUsed : 0;
    const max = caps[u.tier] ?? caps.free;
    const hasCredit = usedToday < max || u.addOn > 0;
    const dailyUsedSnap = usedToday;
    const addOnSnap = u.addOn;
    let inserted = false;
    let debitedUsed: number | null = null;
    let debitedAddOn: number | null = null;
    if (!prior && hasCredit) {
      ledger.set(key, { userId, atMs: Date.now(), replays: 0 });
      inserted = true;
      u.dailyDate = today;
      if (usedToday < max) {
        u.dailyUsed = usedToday + 1;
      } else {
        u.dailyUsed = usedToday;
        u.addOn -= 1;
      }
      debitedUsed = u.dailyUsed;
      debitedAddOn = u.addOn;
    }
    // Drain race: key claimed but nothing debited -> release it (in-function).
    if (inserted && debitedUsed === null) ledger.delete(key);
    // A replay (nothing inserted, row already there) is counted in the same
    // transaction — the route bounds how many times one charged key may be
    // reused, because each reuse serves a full uncharged generation.
    if (!inserted && prior) prior.replays += 1;
    return [
      {
        tier: u.tier,
        subscriptionStatus: null,
        dailyUsedSnap,
        addOnSnap,
        debitedUsed,
        debitedAddOn,
        inserted,
        priorAgeSecs: prior ? Math.floor((Date.now() - prior.atMs) / 1000) : null,
        replays: prior ? prior.replays : 0,
      },
    ];
  }),
}));

import { consumeQuota, debitCredit } from "./usageLimit";
import { rpc } from "./db";

beforeEach(() => {
  counters.clear();
  users.clear();
  ledger.clear();
  today = "2026-07-22";
  vi.mocked(rpc).mockClear();
});

describe("consumeQuota", () => {
  it("increments the count and flips `allowed` once it exceeds max", async () => {
    const max = 3;
    const seen: Array<{ count: number; allowed: boolean }> = [];
    for (let i = 0; i < 4; i++) {
      const r = await consumeQuota("u-incr", "generate:burst", max, 3600);
      seen.push({ count: r.count, allowed: r.allowed });
    }
    expect(seen.map((s) => s.count)).toEqual([1, 2, 3, 4]);
    expect(seen.map((s) => s.allowed)).toEqual([true, true, true, false]);
  });

  it("reports the configured limit and a positive reset window", async () => {
    const r = await consumeQuota("u-meta", "generate:day", 200, 86_400);
    expect(r.limit).toBe(200);
    expect(r.resetSeconds).toBeGreaterThan(0);
    expect(r.resetSeconds).toBeLessThanOrEqual(86_400);
  });

  it("gives N concurrent calls N distinct counts (no double-spend)", async () => {
    const N = 20;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        consumeQuota("u-conc", "generate:burst", 1000, 3600)
      )
    );
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });

  it("separates windows/actions by key so they don't share a counter", async () => {
    const a = await consumeQuota("u-split", "generate:burst", 5, 60);
    const b = await consumeQuota("u-split", "generate:day", 5, 86_400);
    expect(a.count).toBe(1);
    expect(b.count).toBe(1); // different action -> different key -> own counter
  });

  it("fails closed when the upsert returns no row", async () => {
    vi.mocked(rpc).mockResolvedValueOnce([]);
    await expect(
      consumeQuota("u-empty", "generate:burst", 5, 60)
    ).rejects.toThrow();
  });
});

describe("debitCredit", () => {
  it("charges the daily allowance first, then replays the same key without a second debit", async () => {
    users.set("t1", { tier: "free", dailyUsed: 0, dailyDate: today, addOn: 3 });
    expect(await debitCredit("t1", "k-1")).toEqual({
      outcome: "charged",
      tier: "free",
      dailyMax: 5,
      dailyRemaining: 4,
      addOnCredits: 3, // add-on untouched while daily allowance remains
    });
    expect(await debitCredit("t1", "k-1")).toMatchObject({
      outcome: "replayed",
      dailyRemaining: 4,
      addOnCredits: 3,
    });
    expect(users.get("t1")!.dailyUsed).toBe(1); // no double charge
  });

  it("falls through to add-on credits only once the daily allowance is gone", async () => {
    users.set("t2", { tier: "free", dailyUsed: 5, dailyDate: today, addOn: 2 });
    expect(await debitCredit("t2", "k-a")).toEqual({
      outcome: "charged",
      tier: "free",
      dailyMax: 5,
      dailyRemaining: 0,
      addOnCredits: 1,
    });
    expect(users.get("t2")!.addOn).toBe(1);
  });

  it("refuses with 0 daily + 0 add-on and never goes negative", async () => {
    users.set("t3", { tier: "free", dailyUsed: 5, dailyDate: today, addOn: 1 });
    expect(await debitCredit("t3", "k-a")).toMatchObject({
      outcome: "charged",
      addOnCredits: 0,
    });
    expect(await debitCredit("t3", "k-b")).toEqual({
      outcome: "insufficient",
      tier: "free",
      dailyMax: 5,
    });
    expect(users.get("t3")!.addOn).toBe(0);
    expect(ledger.has("k-b")).toBe(false); // refused key never persists
  });

  it("resets the daily allowance at the 00:00 UTC boundary without touching add-on credits", async () => {
    users.set("t4", {
      tier: "free",
      dailyUsed: 5,
      dailyDate: "2026-07-21", // yesterday — exhausted before the boundary
      addOn: 2,
    });
    expect(await debitCredit("t4", "k-day2")).toEqual({
      outcome: "charged",
      tier: "free",
      dailyMax: 5,
      dailyRemaining: 4, // fresh allowance, daily consumed first again
      addOnCredits: 2, // add-on untouched by the reset
    });
    expect(users.get("t4")!.dailyDate).toBe(today);
  });

  it("meters paid tiers against their own daily allowance", async () => {
    users.set("p1", { tier: "pro", dailyUsed: 149, dailyDate: today, addOn: 0 });
    expect(await debitCredit("p1", "k-p")).toEqual({
      outcome: "charged",
      tier: "pro",
      dailyMax: 150,
      dailyRemaining: 0,
      addOnCredits: 0,
    });
    expect(await debitCredit("p1", "k-p2")).toMatchObject({
      outcome: "insufficient",
      tier: "pro",
    });
  });

  it("passes the tier caps from entitlements so SQL never hardcodes them", async () => {
    users.set("t5", { tier: "plus", dailyUsed: 0, dailyDate: today, addOn: 0 });
    await debitCredit("t5", "k-caps");
    expect(vi.mocked(rpc).mock.calls[0]?.[1]).toMatchObject({
      p_daily_free: 5,
      p_daily_plus: 50,
      p_daily_pro: 150,
    });
  });

  it("throws (caller fails closed) when the user row is missing", async () => {
    await expect(debitCredit("ghost", "k-g")).rejects.toThrow();
  });

  // A replay serves a full generation and debits nothing, so the count is the
  // only thing standing between one credit and the whole daily quota. The route
  // refuses past GEN_MAX_REPLAYS (default 2).
  it("counts every replay of a key so the route can bound them", async () => {
    users.set("r1", { tier: "pro", dailyUsed: 0, dailyDate: today, addOn: 0 });
    expect(await debitCredit("r1", "k-r")).toMatchObject({
      outcome: "charged",
    });
    const counts: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await debitCredit("r1", "k-r");
      expect(r.outcome).toBe("replayed");
      counts.push((r as { replays: number }).replays);
    }
    expect(counts).toEqual([1, 2, 3, 4]); // strictly increasing, never resets
    expect(users.get("r1")!.dailyUsed).toBe(1); // still exactly one charge
  });

  // The ledger's primary key is the idempotency key ALONE, so the route
  // namespaces it with the verified user id. Two accounts sending the same raw
  // client key must each be charged against their own balance.
  it("keeps two users' namespaced keys independent", async () => {
    users.set("a", { tier: "free", dailyUsed: 0, dailyDate: today, addOn: 0 });
    users.set("b", { tier: "free", dailyUsed: 0, dailyDate: today, addOn: 0 });
    const clientKey = "shared-client-uuid";
    expect(await debitCredit("a", `a:${clientKey}`)).toMatchObject({
      outcome: "charged",
      dailyRemaining: 4,
    });
    // B sends the identical header value; namespacing makes it a distinct row.
    expect(await debitCredit("b", `b:${clientKey}`)).toMatchObject({
      outcome: "charged",
      dailyRemaining: 4,
    });
    expect(users.get("a")!.dailyUsed).toBe(1);
    expect(users.get("b")!.dailyUsed).toBe(1);
  });

  // The pre-fix bug, pinned: without the user prefix B would land on A's row,
  // read `replayed`, and be served an uncharged generation with an empty balance.
  it("would let an un-namespaced key ride another user's charge", async () => {
    users.set("a2", { tier: "free", dailyUsed: 0, dailyDate: today, addOn: 0 });
    users.set("b2", { tier: "free", dailyUsed: 5, dailyDate: today, addOn: 0 });
    await debitCredit("a2", "raw-key");
    // Same raw key, different user, no namespace — the shape the route must
    // never produce. B2 has zero credits yet is not refused.
    expect(await debitCredit("b2", "raw-key")).toMatchObject({
      outcome: "replayed",
    });
    expect(users.get("b2")!.dailyUsed).toBe(5); // nothing charged to B2
  });
});
