import { describe, expect, it } from "vitest";
import type { DBAdapter, Where } from "better-auth/adapters";
import { hashSessionToken, withHashedSessionTokens } from "./sessionTokenHash";

/**
 * A fake adapter that records exactly what reached "the database".
 *
 * The whole property under test is the gap between what Better Auth passes in
 * and what the storage layer sees, so the assertions look at `rows` and `seen`
 * — a mock that only checked return values would pass while writing cleartext.
 */
function fakeAdapter() {
  const rows: Record<string, unknown>[] = [];
  const seen: { method: string; model: string; where?: Where[] }[] = [];

  const match = (row: Record<string, unknown>, where: Where[] = []) =>
    where.every((w) =>
      Array.isArray(w.value)
        ? (w.value as unknown[]).includes(row[w.field])
        : row[w.field] === w.value,
    );

  const base = {
    id: "fake",
    create: async ({ model, data }: { model: string; data: Record<string, unknown> }) => {
      seen.push({ method: "create", model });
      const row = { ...data };
      rows.push(row);
      return { ...row };
    },
    findOne: async ({ model, where }: { model: string; where: Where[] }) => {
      seen.push({ method: "findOne", model, where });
      const row = rows.find((r) => match(r, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ model, where }: { model: string; where?: Where[] }) => {
      seen.push({ method: "findMany", model, where });
      return rows.filter((r) => match(r, where)).map((r) => ({ ...r }));
    },
    update: async ({
      model,
      where,
      update,
    }: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }) => {
      seen.push({ method: "update", model, where });
      const row = rows.find((r) => match(r, where));
      if (!row) return null;
      Object.assign(row, update);
      return { ...row };
    },
    updateMany: async ({ model, where }: { model: string; where: Where[] }) => {
      seen.push({ method: "updateMany", model, where });
      return rows.filter((r) => match(r, where)).length;
    },
    delete: async ({ model, where }: { model: string; where: Where[] }) => {
      seen.push({ method: "delete", model, where });
      const i = rows.findIndex((r) => match(r, where));
      if (i >= 0) rows.splice(i, 1);
    },
    deleteMany: async ({ model, where }: { model: string; where: Where[] }) => {
      seen.push({ method: "deleteMany", model, where });
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i]!, where)) rows.splice(i, 1);
      return before - rows.length;
    },
    count: async ({ model, where }: { model: string; where?: Where[] }) => {
      seen.push({ method: "count", model, where });
      return rows.filter((r) => match(r, where)).length;
    },
    consumeOne: async ({ model, where }: { model: string; where: Where[] }) => {
      seen.push({ method: "consumeOne", model, where });
      return rows.find((r) => match(r, where)) ?? null;
    },
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(base),
  };

  return { rows, seen, adapter: withHashedSessionTokens(base as unknown as DBAdapter) };
}

const RAW = "wpQ8vK3mZ1tY7bN2xL5cR9hJ4dF6gS0a"; // shape of generateId(32)
const eq = (field: string, value: unknown): Where[] => [{ field, value } as Where];

describe("what reaches the database", () => {
  it("stores a hash, never the token itself", async () => {
    const { rows, adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    expect(rows[0]!.token).toBe(hashSessionToken(RAW));
    expect(rows[0]!.token).not.toBe(RAW);
  });

  it("hashes the token in a where clause so the lookup still matches", async () => {
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    const found = await adapter.findOne<{ userId: string }>({
      model: "session",
      where: eq("token", RAW),
    });
    expect(found?.userId).toBe("u1");
  });

  it("hashes every element of an `in` clause (deleteSessions / findSessions)", async () => {
    const { rows, adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    await adapter.create({ model: "session", data: { token: "second-token", userId: "u1" } });
    const removed = await adapter.deleteMany({
      model: "session",
      where: [{ field: "token", value: [RAW, "second-token"], operator: "in" } as Where],
    });
    expect(removed).toBe(2);
    expect(rows).toHaveLength(0);
  });

  it("leaves other models completely alone", async () => {
    const { rows, adapter } = fakeAdapter();
    await adapter.create({ model: "user", data: { token: RAW, id: "u1" } });
    expect(rows[0]!.token).toBe(RAW);
  });

  it("hashes inside a transaction — sign-up writes the session there", async () => {
    const { rows, adapter } = fakeAdapter();
    await adapter.transaction(async (tx) => {
      await tx.create({ model: "session", data: { token: RAW, userId: "u1" } });
    });
    expect(rows[0]!.token).toBe(hashSessionToken(RAW));
  });
});

describe("what Better Auth sees", () => {
  // Load-bearing: `setSessionCookie` writes `session.token` from the row these
  // return. A hash coming back here becomes the user's cookie.
  it("returns the raw token from create", async () => {
    const { adapter } = fakeAdapter();
    const created = await adapter.create<{ token: string; userId: string }>({
      model: "session",
      data: { token: RAW, userId: "u1" },
    });
    expect(created.token).toBe(RAW);
  });

  it("returns the raw token from a lookup by token", async () => {
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    const found = await adapter.findOne<{ token: string }>({
      model: "session",
      where: eq("token", RAW),
    });
    expect(found?.token).toBe(RAW);
  });

  it("returns the raw token from the refresh update", async () => {
    // The >24h `session.updateAge` path: updateSession() → setSessionCookie().
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    const updated = await adapter.update<{ token: string; expiresAt: string }>({
      model: "session",
      where: eq("token", RAW),
      update: { expiresAt: "2026-09-01" },
    });
    expect(updated?.token).toBe(RAW);
  });

  it("returns hashes for a read by userId — the documented divergence", async () => {
    // listSessions() cannot be reversed, which is why /list-sessions and
    // /revoke-other-sessions are in `disabledPaths`. Asserted so that a future
    // change making them reversible is a deliberate one.
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    const listed = await adapter.findMany<{ token: string }>({
      model: "session",
      where: eq("userId", "u1"),
    });
    expect(listed[0]!.token).toBe(hashSessionToken(RAW));
  });
});

// Boots Better Auth against the real DATABASE_URL — see the note in
// lib/auth.test.ts for why the default 5s budget is not enough on a cold run.
describe("the wrapper is actually wired in", { timeout: 20_000 }, () => {
  it("is the adapter Better Auth boots with", async () => {
    // Everything above tests the wrapper in isolation, which stays green even if
    // lib/auth.ts stops using it — and that regression has no symptom other than
    // tokens quietly going back to cleartext. This asserts the live wiring.
    process.env.BETTER_AUTH_SECRET ||= "test-secret-value-32-bytes-long!!";
    process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
    process.env.DATABASE_URL ||= "postgres://u:p@localhost:5432/db";
    const { auth } = await import("./auth");
    const ctx = await auth.$context;
    expect(ctx.adapter.id).toContain("hashed-session-token");
  });
});

describe("the stored hash is not a credential", () => {
  it("cannot be replayed as a token", async () => {
    // The attack this whole module exists to stop: read the column, present it.
    // Hashing is unconditional, so the presented hash is hashed again and
    // matches nothing.
    const { rows, adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    const stolen = rows[0]!.token as string;
    const replayed = await adapter.findOne({ model: "session", where: eq("token", stolen) });
    expect(replayed).toBeNull();
  });

  it("fails closed if a hash ever reaches a cookie", async () => {
    // Same mechanism seen from the availability side: the worst a missed code
    // path can do is sign someone out, never let a hash authenticate.
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "session", data: { token: RAW, userId: "u1" } });
    expect(
      await adapter.findOne({ model: "session", where: eq("token", hashSessionToken(RAW)) }),
    ).toBeNull();
  });
});
