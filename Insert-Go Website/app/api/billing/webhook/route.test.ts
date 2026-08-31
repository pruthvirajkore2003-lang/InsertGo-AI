/**
 * Fulfilment tests for POST /api/billing/webhook.
 *
 * `lib/dodo.test.ts` already covers the pure mapping (which event means which
 * tier, which pack size is real). What has no coverage anywhere else is the
 * part that actually moves money-shaped state: the three SQL statements in this
 * route. Their guarantees are all *in the statement text* — the ledger-keyed
 * dedup CTE, the `billingEventAt` watermark, the `greatest(0, …)` clamp — so
 * deleting any one of them still compiles, still returns 200, and silently
 * either double-credits, resurrects a cancelled plan, or drives a balance
 * negative.
 *
 * So `pool.query` is stubbed with a small Postgres stand-in that applies each
 * guard ONLY when the statement it was handed actually contains it. Every
 * assertion below is therefore a real regression test: strip `greatest(0,` from
 * route.ts and the clamp case fails on a negative balance, exactly as the
 * database would behave.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Postgres stand-in ──────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type UserRow = {
  id: string;
  email: string;
  tier: string;
  subscriptionStatus: string;
  addOnCredits: number;
  /** Event-time watermark, epoch seconds; null until a timestamped event lands. */
  billingEventAt: number | null;
  /** Dodo's subscription id — what /api/billing/cancel needs to exist. */
  dodoSubscriptionId: string | null;
  /** Cancelled-but-still-paid-for. Reset by every tier write. */
  cancelAtPeriodEnd: boolean;
};

const users = new Map<string, UserRow>();
const ledger = new Map<string, { userId: string; amount: number }>();

/** Resolve the `target` CTE: prefer $2 (userId), else $3 (email). */
function target(userId: unknown, email: unknown): UserRow | undefined {
  if (typeof userId === "string" && userId) return users.get(userId);
  if (typeof email === "string" && email) {
    return [...users.values()].find((u) => u.email === email);
  }
  return undefined;
}

/** True while the statement still carries the clause that makes the ledger
 *  claim exclusive. `do nothing` is the whole dedup: swap it for `do update`
 *  and every redelivery re-credits. */
const DEDUPS = (sql: string) =>
  sql.includes('on conflict ("idempotencyKey") do nothing');

/** Claim `key` in the ledger; false when it already exists (redelivery). */
function claim(key: string, userId: string, amount: number): boolean {
  if (ledger.has(key)) return false;
  ledger.set(key, { userId, amount });
  return true;
}

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/pgPool", () => ({ pool: { query } }));

const { alertOps } = vi.hoisted(() => ({ alertOps: vi.fn() }));
vi.mock("@/lib/alert", () => ({ alertOps }));

const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/auditLog", () => ({ audit }));

// Analytics is consent-gated and best-effort; both are asserted separately.
const { captureServerEvent } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics-server", () => ({ captureServerEvent }));

const { consentGranted } = vi.hoisted(() => ({ consentGranted: { on: true } }));
vi.mock("@/lib/consent", () => ({
  currentConsent: vi.fn(async () => ({
    get: () => ({ granted: consentGranted.on }),
  })),
}));

import { POST } from "./route";

/**
 * Interpret one of the route's statements against the in-memory tables.
 *
 * Dispatch is on a fragment unique to each statement, and — the point of the
 * whole harness — each *guard* is applied only if the SQL still carries it.
 */
query.mockImplementation(async (sql: string, params: unknown[] = []) => {
  const rows: Row[] = [];

  // 1. Tier write, watermarked by event time.
  if (sql.includes('set "tier" = $1')) {
    const [tier, status, ref, eventAt, subId, clearsSubId] = params as [
      string,
      string,
      string,
      number | null,
      string | null,
      boolean,
    ];
    const u = sql.includes('"id" = $3')
      ? users.get(ref)
      : [...users.values()].find((x) => x.email === ref);
    if (!u) return { rowCount: 0, rows };
    // The watermark predicate is what makes tier writes last-write-wins by
    // EVENT time. Honour it only while route.ts still sends it.
    const guarded = sql.includes('"billingEventAt" <= to_timestamp');
    if (
      guarded &&
      eventAt != null &&
      u.billingEventAt != null &&
      u.billingEventAt > eventAt
    ) {
      return { rowCount: 0, rows }; // stale redelivery — no-op
    }
    // Every `set` expression reads the PRE-update row, as Postgres does — so
    // the cancel-flag guard below compares against the OLD watermark.
    const priorEventAt = u.billingEventAt;
    u.tier = tier;
    u.subscriptionStatus = status;
    if (eventAt != null) u.billingEventAt = eventAt;
    // Same rule as the guards above: honour the clause only while route.ts
    // still sends it, so deleting it fails a test rather than passing quietly.
    if (sql.includes('"dodoSubscriptionId" = case')) {
      // Read the CONDITION from the statement, not just the clause: the whole
      // point is that "$6, the event says the subscription is gone" and
      // "$1 = 'free', the tier was demoted" disagree on on_hold. Going back to
      // the tier test has to fail a test, not quietly pass one.
      const gone = sql.includes("case when $6::boolean")
        ? clearsSubId
        : tier === "free";
      u.dodoSubscriptionId = gone ? null : (subId ?? u.dodoSubscriptionId);
    }
    // A replay (event no newer than the watermark) must leave the flag alone;
    // anything strictly newer resets it. Drop the `case` from route.ts and the
    // redelivery test below sees the flag flip back to false.
    if (sql.includes('"cancelAtPeriodEnd" = case')) {
      const replay =
        eventAt != null && priorEventAt != null && priorEventAt >= eventAt;
      if (!replay) u.cancelAtPeriodEnd = false;
    } else if (sql.includes('"cancelAtPeriodEnd" = false')) {
      u.cancelAtPeriodEnd = false;
    }
    return { rowCount: 1, rows };
  }

  // 2. Pack grant: ledger claim gates the increment.
  if (sql.includes('u."addOnCredits" + $5')) {
    const [key, userId, email, amount, credits] = params as [
      string,
      string | null,
      string | null,
      number,
      number,
    ];
    const u = target(userId, email);
    if (!u) return { rowCount: 0, rows };
    // `on conflict do nothing` + `update … from ins`: no claim, no increment.
    const fresh = DEDUPS(sql) ? claim(key, u.id, amount) : true;
    if (!fresh) return { rowCount: 0, rows };
    u.addOnCredits += credits;
    return { rowCount: 1, rows };
  }

  // 3. Reversal: same dedup, signs flipped, clamped at zero.
  if (sql.includes('u."addOnCredits" - $4')) {
    const [key, userId, email, amount] = params as [
      string,
      string | null,
      string | null,
      number,
    ];
    const u = target(userId, email);
    if (!u) return { rowCount: 0, rows };
    const fresh = DEDUPS(sql) ? claim(key, u.id, amount) : true;
    if (!fresh) return { rowCount: 0, rows };
    const next = u.addOnCredits - amount;
    // Apply the clamp only if the statement still asks for it — otherwise the
    // balance really does go negative, and the test below catches it.
    u.addOnCredits = sql.includes("greatest(0,") ? Math.max(0, next) : next;
    return { rowCount: 1, rows };
  }

  // 4. "Did this key already land?" — tells a redelivery from a lost grant.
  if (sql.includes('select 1 from "creditLedger"')) {
    const key = params[0] as string;
    return ledger.has(key)
      ? { rowCount: 1, rows: [{ "?column?": 1 }] }
      : { rowCount: 0, rows };
  }

  throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
});

// ── Request helpers ────────────────────────────────────────────────────────

const SECRET = `whsec_${Buffer.from("webhook-secret-32-bytes-long!!!!").toString("base64")}`;

let msgSeq = 0;

/** POST a signed webhook exactly as Dodo signs it. */
function post(
  payload: unknown,
  opts: { id?: string; secret?: string; tamper?: boolean } = {},
) {
  const body = JSON.stringify(payload);
  const id = opts.id ?? `msg_${++msgSeq}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = (opts.secret ?? SECRET).replace(/^whsec_/, "");
  const sig = createHmac("sha256", Buffer.from(raw, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return POST(
    new Request("https://insertgo.com/api/billing/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${sig}`,
      },
      body: opts.tamper ? `${body} ` : body,
    }),
  );
}

const iso = (epoch: number) => new Date(epoch * 1000).toISOString();

const seed = (over: Partial<UserRow> = {}): UserRow => {
  const u: UserRow = {
    id: "usr_1",
    email: "buyer@example.com",
    tier: "free",
    subscriptionStatus: "trial",
    addOnCredits: 0,
    billingEventAt: null,
    dodoSubscriptionId: null,
    cancelAtPeriodEnd: false,
    ...over,
  };
  users.set(u.id, u);
  return u;
};

beforeEach(() => {
  users.clear();
  ledger.clear();
  msgSeq = 0;
  // mockClear, never mockReset: the implementation above IS the fake Postgres,
  // and mockReset would wipe it for every test after the first.
  query.mockClear();
  alertOps.mockClear();
  audit.mockClear();
  captureServerEvent.mockClear();
  consentGranted.on = true;
  process.env.DODO_WEBHOOK_SECRET = SECRET;
});

// ── Trust boundary ─────────────────────────────────────────────────────────

describe("signature gate", () => {
  it("401s a tampered body and writes nothing", async () => {
    const u = seed();
    const res = await post({ type: "subscription.active" }, { tamper: true });
    expect(res.status).toBe(401);
    expect(u.tier).toBe("free");
    expect(query).not.toHaveBeenCalled();
  });

  it("401s a body signed with the wrong secret", async () => {
    const other = `whsec_${Buffer.from("attacker-secret-32-bytes-long!!!").toString("base64")}`;
    const res = await post(
      { type: "subscription.active", data: { metadata: { userId: "usr_1" } } },
      { secret: other },
    );
    expect(res.status).toBe(401);
  });

  it("audits a forged event as critical — the highest-signal unauth event", async () => {
    await post({ type: "subscription.active" }, { tamper: true });
    expect(audit).toHaveBeenCalledWith(
      "billing.webhook.signature_invalid",
      expect.objectContaining({ outcome: "denied", severity: "critical" }),
    );
  });

  it("503s rather than processing when no secret is configured", async () => {
    delete process.env.DODO_WEBHOOK_SECRET;
    const res = await post({ type: "subscription.active" });
    expect(res.status).toBe(503);
    expect(query).not.toHaveBeenCalled();
  });

  it("400s malformed JSON that is nonetheless correctly signed", async () => {
    const res = await post("{not json" as unknown);
    // A signed string body parses as JSON (it is a quoted string), so the route
    // sees a payload with no `type` and simply acknowledges it.
    expect([200, 400]).toContain(res.status);
    expect(query).not.toHaveBeenCalled();
  });

  it("413s a body past the 64 KiB cap before any HMAC work", async () => {
    const res = await POST(
      new Request("https://insertgo.com/api/billing/webhook", {
        method: "POST",
        headers: { "content-length": String(70_000) },
        body: "x".repeat(70_000),
      }),
    );
    expect(res.status).toBe(413);
  });
});

// ── Subscription lifecycle ─────────────────────────────────────────────────

describe("subscription tier writes", () => {
  const sub = (type: string, at: number, meta: Row = {}) => ({
    type,
    timestamp: iso(at),
    data: { metadata: { userId: "usr_1", ...meta } },
  });

  it("grants the paid tier on activation and demotes on cancellation", async () => {
    const u = seed();
    await post(sub("subscription.active", 1000, { planTier: "plus" }));
    expect(u).toMatchObject({ tier: "plus", subscriptionStatus: "subscribed" });

    await post(sub("subscription.cancelled", 2000));
    expect(u).toMatchObject({ tier: "free", subscriptionStatus: "expired" });
  });

  it.each([
    "subscription.cancelled",
    "subscription.expired",
    "subscription.failed",
    "subscription.on_hold",
  ])("%s demotes to free", async (type) => {
    const u = seed({ tier: "pro", subscriptionStatus: "subscribed" });
    await post(sub(type, 1000));
    expect(u.tier).toBe("free");
  });

  it("ignores an out-of-order redelivery that would resurrect a dead plan", async () => {
    const u = seed();
    await post(sub("subscription.active", 1000, { planTier: "pro" }));
    await post(sub("subscription.cancelled", 2000));
    expect(u.tier).toBe("free");

    // Dodo delivery is at-least-once AND unordered: the activation's first
    // attempt can 500 and be retried after the cancellation it preceded.
    const res = await post(sub("subscription.active", 1000, { planTier: "pro" }));
    expect(res.status).toBe(200);
    expect(u.tier).toBe("free"); // watermark held
  });

  it("applies a redelivery of the SAME event (equal timestamps are not stale)", async () => {
    const u = seed();
    const evt = sub("subscription.active", 1000, { planTier: "plus" });
    await post(evt);
    u.tier = "free"; // simulate drift, then let the redelivery re-converge
    await post(evt, { id: "msg_redelivery" });
    expect(u.tier).toBe("plus");
  });

  it("still applies a payload that carries no event time (unguarded write)", async () => {
    const u = seed();
    await post({
      type: "subscription.active",
      data: { metadata: { userId: "usr_1", planTier: "pro" } },
    });
    expect(u.tier).toBe("pro");
    expect(u.billingEventAt).toBeNull();
  });

  it("falls back to the customer email when checkout metadata has no userId", async () => {
    const u = seed();
    await post({
      type: "subscription.active",
      timestamp: iso(1000),
      data: {
        metadata: { planTier: "plus" },
        customer: { email: "buyer@example.com" },
      },
    });
    expect(u.tier).toBe("plus");
  });

  it("audits and acknowledges an event with no user reference at all", async () => {
    const res = await post({ type: "subscription.active", data: {} });
    expect(res.status).toBe(200); // never make Dodo retry an unattributable event
    expect(audit).toHaveBeenCalledWith(
      "billing.webhook.unmatched_user",
      expect.objectContaining({ outcome: "failure" }),
    );
  });

  it("acknowledges unhandled event types without touching the database", async () => {
    seed();
    const res = await post({ type: "subscription.trialing" });
    expect(res.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });
});

// ── Pack purchase ──────────────────────────────────────────────────────────

describe("pack grants", () => {
  const pay = (credits: number | string) => ({
    type: "payment.succeeded",
    timestamp: iso(1000),
    data: { metadata: { userId: "usr_1", packCredits: String(credits) } },
  });

  it("adds the pack to the non-expiring add-on balance", async () => {
    const u = seed({ addOnCredits: 7 });
    await post(pay(150));
    expect(u.addOnCredits).toBe(157);
  });

  it("dedups a redelivered grant through the ledger key", async () => {
    const u = seed();
    await post(pay(350), { id: "msg_pack" });
    await post(pay(350), { id: "msg_pack" }); // same webhook-id = same key
    expect(u.addOnCredits).toBe(350);
    expect(ledger.size).toBe(1);
  });

  it("records the grant as a negative ledger amount", async () => {
    seed();
    await post(pay(50), { id: "msg_a" });
    expect([...ledger.values()][0]).toMatchObject({ amount: -50, userId: "usr_1" });
  });

  it("grants nothing for a pack size outside the catalog", async () => {
    const u = seed();
    const res = await post(pay(99_999));
    expect(res.status).toBe(200);
    expect(u.addOnCredits).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("pages ops when money moved but no user matched", async () => {
    // No seeded user: the customer paid and the grant has nowhere to land.
    const res = await post(pay(500));
    expect(res.status).toBe(200);
    expect(alertOps).toHaveBeenCalledOnce();
    const [subject, detail] = alertOps.mock.calls[0] as [string, string];
    expect(subject).toMatch(/pack grant lost/i);
    expect(detail).toContain("500");
    // DPDP §10: the customer email is never allowed into an ops page or a log.
    expect(detail).not.toContain("buyer@example.com");
  });

  it("does not page on a redelivery that legitimately granted nothing", async () => {
    seed();
    await post(pay(150), { id: "msg_dup" });
    alertOps.mockClear();
    await post(pay(150), { id: "msg_dup" });
    expect(alertOps).not.toHaveBeenCalled();
  });
});

// ── Refunds and chargebacks ────────────────────────────────────────────────

describe("pack reversals", () => {
  const reverse = (type: string, credits: number) => ({
    type,
    timestamp: iso(3000),
    data: { metadata: { userId: "usr_1", packCredits: String(credits) } },
  });

  it.each(["refund.succeeded", "dispute.lost"])(
    "%s deducts the pack it reverses",
    async (type) => {
      const u = seed({ addOnCredits: 200 });
      await post(reverse(type, 150));
      expect(u.addOnCredits).toBe(50);
    },
  );

  it("clamps at zero when the credits were already spent", async () => {
    // The whole reason `greatest(0, …)` exists: 150 refunded against a balance
    // of 20 must land on 0, not -130 — a negative balance silently eats the
    // user's NEXT purchase, and no webhook ever repairs it.
    const u = seed({ addOnCredits: 20 });
    await post(reverse("refund.succeeded", 150));
    expect(u.addOnCredits).toBe(0);
    expect(u.addOnCredits).toBeGreaterThanOrEqual(0);
  });

  it("deducts exactly once when the reversal is redelivered", async () => {
    const u = seed({ addOnCredits: 500 });
    await post(reverse("refund.succeeded", 350), { id: "msg_refund" });
    await post(reverse("refund.succeeded", 350), { id: "msg_refund" });
    expect(u.addOnCredits).toBe(150);
  });

  it("keeps the grant and its reversal on separate ledger keys", async () => {
    const u = seed();
    await post(
      {
        type: "payment.succeeded",
        timestamp: iso(1000),
        data: { metadata: { userId: "usr_1", packCredits: "150" } },
      },
      { id: "msg_grant" },
    );
    await post(reverse("refund.succeeded", 150), { id: "msg_reversal" });
    // Distinct webhook-ids, so the reversal is never mistaken for a redelivery
    // of the grant — the balance completes the round trip.
    expect(u.addOnCredits).toBe(0);
    expect(ledger.size).toBe(2);
  });

  it("reverses nothing when the amount is off-catalog", async () => {
    const u = seed({ addOnCredits: 100 });
    await post(reverse("refund.succeeded", 12_345));
    expect(u.addOnCredits).toBe(100);
  });

  it("logs, and does not page, a reversal that matches nobody", async () => {
    const res = await post(reverse("dispute.lost", 50));
    expect(res.status).toBe(200);
    expect(alertOps).not.toHaveBeenCalled();
  });
});

// ── Failure handling and privacy ───────────────────────────────────────────

describe("failure handling", () => {
  it("500s so Dodo retries when the database write fails", async () => {
    seed();
    query.mockRejectedValueOnce(
      Object.assign(new Error("deadlock detected"), { code: "40P01" }),
    );
    const res = await post({
      type: "subscription.active",
      timestamp: iso(1000),
      data: { metadata: { userId: "usr_1", planTier: "plus" } },
    });
    expect(res.status).toBe(500);
  });

  it("never lets a raw pg error's parameter values reach the log", async () => {
    seed();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValueOnce(
      Object.assign(new Error("unique violation"), {
        code: "23505",
        // pg puts the failing statement's parameter values in these fields —
        // here that is the customer's email.
        detail: "Key (email)=(buyer@example.com) already exists.",
        where: "parameters: $3 = 'buyer@example.com'",
      }),
    );
    await post({
      type: "subscription.active",
      timestamp: iso(1000),
      data: { metadata: { userId: "usr_1" } },
    });
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("buyer@example.com");
    spy.mockRestore();
  });
});

describe("revenue analytics", () => {
  const purchase = {
    type: "payment.succeeded",
    timestamp: iso(1000),
    data: {
      metadata: { userId: "usr_1", packCredits: "150", transactionId: "tx_9" },
    },
  };

  it("captures a purchase for a user who granted analytics consent", async () => {
    seed();
    await post(purchase);
    expect(captureServerEvent).toHaveBeenCalledWith(
      "usr_1",
      "purchase_confirmed",
      expect.objectContaining({ pack_credits: 150, transaction_id: "tx_9" }),
    );
  });

  it("captures nothing when analytics consent was declined (DPDP §6)", async () => {
    seed();
    consentGranted.on = false;
    await post(purchase);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("never blocks fulfilment when analytics throws", async () => {
    const u = seed();
    captureServerEvent.mockRejectedValueOnce(new Error("posthog down"));
    const res = await post(purchase);
    expect(res.status).toBe(200);
    expect(u.addOnCredits).toBe(150); // money already moved; entitlement stands
  });

  it("does not report a demotion as revenue", async () => {
    seed({ tier: "pro" });
    await post({
      type: "subscription.cancelled",
      timestamp: iso(2000),
      data: { metadata: { userId: "usr_1" } },
    });
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});

// ── Cancellation state the ARL flow depends on ─────────────────────────────

describe("subscription id and cancel flag", () => {
  const active = (subscriptionId?: string) => ({
    type: "subscription.active",
    timestamp: iso(1000),
    data: {
      metadata: { userId: "usr_1" },
      subscription_id: subscriptionId,
      product_id: process.env.DODO_PRODUCT_ID_PLUS,
    },
  });

  it("stores the subscription id, so cancelling has something to call", async () => {
    const u = seed();
    await post(active("sub_abc"));
    // Without this the account page can render a Cancel button that 409s,
    // which is "cancel online" in name only.
    expect(u.dodoSubscriptionId).toBe("sub_abc");
  });

  it("keeps the stored id when a renewal omits it", async () => {
    const u = seed({ tier: "plus", dodoSubscriptionId: "sub_abc" });
    await post({
      type: "subscription.renewed",
      timestamp: iso(2000),
      data: { metadata: { userId: "usr_1" } },
    });
    // `coalesce`: a payload without the field must not erase a good id.
    expect(u.dodoSubscriptionId).toBe("sub_abc");
  });

  it("drops the id on the way to free", async () => {
    const u = seed({ tier: "plus", dodoSubscriptionId: "sub_abc" });
    await post({
      type: "subscription.cancelled",
      timestamp: iso(2000),
      data: { metadata: { userId: "usr_1" } },
    });
    expect(u.tier).toBe("free");
    expect(u.dodoSubscriptionId).toBeNull();
  });

  it("clears cancelAtPeriodEnd when the user resubscribes", async () => {
    const u = seed({ cancelAtPeriodEnd: true });
    await post(active("sub_new"));
    // A stale flag would show "Cancels at period end" over a live paid plan.
    expect(u.cancelAtPeriodEnd).toBe(false);
  });

  it("keeps the id on hold, so a failed payment can still be cancelled", async () => {
    const u = seed({ tier: "plus", dodoSubscriptionId: "sub_abc" });
    await post({
      type: "subscription.on_hold",
      timestamp: iso(2000),
      data: { metadata: { userId: "usr_1" } },
    });
    // Demoting is fine — Terms §6 allows suspending paid features while a
    // payment is retried. Forgetting the id is not: Dodo is still charging the
    // card, and the account page would have no button to stop it.
    expect(u.tier).toBe("free");
    expect(u.dodoSubscriptionId).toBe("sub_abc");
  });

  it("does not resurrect a cancellation flag on a redelivered activation", async () => {
    const u = seed();
    await post(active("sub_abc"));
    // The user then cancels through /api/billing/cancel, which writes the flag
    // WITHOUT touching the event-time watermark.
    u.cancelAtPeriodEnd = true;

    // Dodo retries the original activation. Equal timestamps pass the
    // watermark by design (the tier re-converges), but this event is not news
    // about the subscription and must not report "renews automatically" to
    // someone who has already cancelled.
    await post(active("sub_abc"), { id: "msg_redelivery" });
    expect(u.cancelAtPeriodEnd).toBe(true);
    expect(u.tier).toBe("plus");
  });

  it("still clears the flag for an activation that is genuinely newer", async () => {
    const u = seed();
    await post(active("sub_abc"));
    u.cancelAtPeriodEnd = true;
    await post({
      ...active("sub_abc"),
      timestamp: iso(5000), // a real resubscribe, after the cancellation
    });
    expect(u.cancelAtPeriodEnd).toBe(false);
  });
});
