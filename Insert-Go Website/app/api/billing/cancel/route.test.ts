/**
 * POST /api/billing/cancel — the click-to-cancel path.
 *
 * What is actually being defended here is not a feature but a statute. Under
 * the California ARL and FTC ROSCA the cancellation has to complete online and
 * be honoured; the two ways this code could break that are both invisible at
 * runtime, so both get a test:
 *
 *  1. Telling the user "cancelled" when the gateway refused — they stop
 *     watching the statement and keep being billed. Hence: gateway first,
 *     local flag second, and a failed gateway call must NOT write the flag.
 *  2. Making cancellation conditional on something that can fail for unrelated
 *     reasons (metering, analytics). Hence: a quota outage must not block it.
 *
 * The subscription id is read from OUR row, never the request body — the third
 * test is what stops a signed-in user cancelling somebody else's plan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/pgPool", () => ({ pool: { query } }));

const { cancelSubscription } = vi.hoisted(() => ({
  cancelSubscription: vi.fn(async () => {}),
}));
vi.mock("@/lib/dodo", () => ({
  cancelSubscription,
  dodoCheckoutConfigured: () => true,
}));

const { consumeQuota } = vi.hoisted(() => ({
  consumeQuota: vi.fn(async () => ({ allowed: true, remaining: 19 })),
}));
vi.mock("@/lib/usageLimit", () => ({ consumeQuota }));

const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/auditLog", () => ({ audit }));

import { POST } from "./route";

/** One row's worth of state, plus a record of what was written back. */
let row: { dodoSubscriptionId: string | null; cancelAtPeriodEnd: boolean };
let flagWrites: number;

const post = () =>
  POST(new Request("https://insertgo.com/api/billing/cancel", { method: "POST" }));

beforeEach(() => {
  row = { dodoSubscriptionId: "sub_abc", cancelAtPeriodEnd: false };
  flagWrites = 0;
  getSession.mockResolvedValue({ user: { id: "usr_1", email: "a@b.c" } });
  cancelSubscription.mockClear();
  cancelSubscription.mockResolvedValue(undefined);
  consumeQuota.mockClear();
  consumeQuota.mockResolvedValue({ allowed: true, remaining: 19 });
  audit.mockClear();
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('select "dodoSubscriptionId"')) {
      return { rowCount: 1, rows: [row] };
    }
    if (sql.includes('set "cancelAtPeriodEnd" = true')) {
      flagWrites += 1;
      row.cancelAtPeriodEnd = true;
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`unexpected SQL: ${sql.slice(0, 50)}`);
  });
});

describe("POST /api/billing/cancel", () => {
  it("cancels at the gateway, then records it", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      cancelled: true,
      alreadyCancelling: false,
    });
    expect(cancelSubscription).toHaveBeenCalledWith("sub_abc");
    expect(row.cancelAtPeriodEnd).toBe(true);
    // The evidence an ARL dispute turns on.
    expect(audit).toHaveBeenCalledWith(
      "billing.subscription.cancelled",
      expect.objectContaining({ outcome: "success", userId: "usr_1" }),
    );
  });

  it("does NOT claim success — or write the flag — when the gateway refuses", async () => {
    cancelSubscription.mockRejectedValueOnce(new Error("cancel-failed"));
    const res = await post();
    expect(res.status).toBe(502);
    // The whole point of gateway-first ordering: a user who is still being
    // billed must not be told they are not.
    expect(flagWrites).toBe(0);
    expect(row.cancelAtPeriodEnd).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it("cancels anyway when metering is down", async () => {
    consumeQuota.mockRejectedValueOnce(new Error("db down"));
    const res = await post();
    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalled();
  });

  it("refuses to touch the gateway for an unauthenticated caller", async () => {
    getSession.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(401);
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it("is idempotent: a second click succeeds without a second gateway call", async () => {
    row.cancelAtPeriodEnd = true;
    const res = await post();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      cancelled: true,
      alreadyCancelling: true,
    });
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it("says so plainly when there is no subscription to cancel", async () => {
    row.dodoSubscriptionId = null;
    const res = await post();
    expect(res.status).toBe(409);
    expect(cancelSubscription).not.toHaveBeenCalled();
  });
});
