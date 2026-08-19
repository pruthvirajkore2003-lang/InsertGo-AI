import { describe, expect, it } from "vitest";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins";
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

describe("a session row that cannot be reversed never becomes a cookie", () => {
  it("throws rather than return a hash from update", async () => {
    // Better Auth only ever updates a session BY its token, so this is the
    // shape of a FUTURE regression, not a path reachable today: an update keyed
    // by anything else leaves the wrapper with no way to recover the raw token.
    // Returning the hash there is what would re-issue it as the user's cookie
    // and sign every client out on the next request, so it has to fail here.
    const { adapter } = fakeAdapter();
    const created = await adapter.create<{ token: string; userId: string }>({
      model: "session",
      data: { token: RAW, userId: "u1" },
    });
    expect(created.token).toBe(RAW);
    await expect(
      adapter.update({
        model: "session",
        where: eq("userId", "u1"),
        update: { expiresAt: "2026-09-01" },
      }),
    ).rejects.toThrow(/hashed token/);
  });

  it("leaves updates to other models alone", async () => {
    const { adapter } = fakeAdapter();
    await adapter.create({ model: "user", data: { id: "u1", name: "before" } });
    const updated = await adapter.update<{ name: string }>({
      model: "user",
      where: eq("id", "u1"),
      update: { name: "after" },
    });
    expect(updated?.name).toBe("after");
  });
});

/**
 * The next-day regression, driven through the real library.
 *
 * Everything above tests the wrapper against a fake. This boots actual Better
 * Auth over the in-memory adapter with the SAME session config as lib/auth.ts
 * and walks the lifecycle that gets reported as "signed out the next day":
 * sign in, let `session.updateAge` elapse, come back.
 *
 * The assertion that matters is that the credential re-issued by the refresh is
 * the RAW token. `setSessionCookie` writes it straight from the row
 * `updateSession` returns, so a hash escaping the adapter at that one point
 * becomes a cookie that fails `hash(hash) != hash` on the very next request —
 * every signed-in client dropped roughly a day after signing in, and the
 * desktop app erasing its keyring entry on the resulting 401.
 */
describe("the >24h refresh keeps the session alive", () => {
  const EXPIRES_IN = 60 * 60 * 24 * 30; // mirrors lib/auth.ts
  const UPDATE_AGE = 60 * 60 * 24;
  const PAST_UPDATE_AGE_MS = 25 * 60 * 60 * 1000;
  const EMAIL = "refresh@example.com";

  type Row = Record<string, unknown>;

  function boot() {
    const db: Record<string, Row[]> = {
      user: [],
      session: [],
      account: [],
      verification: [],
    };
    const auth = betterAuth({
      secret: "test-secret-value-32-bytes-long!!",
      baseURL: "http://localhost:3000",
      database: (options: BetterAuthOptions) =>
        withHashedSessionTokens(
          memoryAdapter(db)(options) as unknown as DBAdapter,
        ),
      // Only so the harness can mint a session through a real endpoint; the app
      // itself is OTP / OAuth / SSO and pins `account.password` to null.
      emailAndPassword: { enabled: true },
      session: {
        expiresIn: EXPIRES_IN,
        updateAge: UPDATE_AGE,
        cookieCache: { enabled: true, maxAge: 60 * 5 },
      },
      plugins: [bearer()],
    });
    return { db, auth };
  }

  /** Apply a response's Set-Cookie headers to a jar, the way a browser would. */
  function apply(jar: Map<string, string>, res: Response): Map<string, string> {
    for (const entry of res.headers.getSetCookie()) {
      const pair = entry.split(";")[0]!;
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1);
      if (!value || /(^|;)\s*max-age=0/i.test(entry)) jar.delete(name);
      else jar.set(name, value);
    }
    return jar;
  }

  const header = (jar: Map<string, string>) =>
    [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  /** The `<token>.<signature>` pair the browser holds, decoded. */
  const sessionCookie = (jar: Map<string, string>) =>
    decodeURIComponent([...jar].find(([k]) => k.endsWith("session_token"))![1]);

  /**
   * Drop the 5-minute `cookieCache` cookie, which is what a user coming back
   * the NEXT DAY sends: it expired hours ago. Without this the cache branch of
   * `/get-session` answers from the cookie and returns before the refresh is
   * ever considered, so a test that skipped it would assert nothing.
   */
  function staleCookieCache(jar: Map<string, string>): Map<string, string> {
    for (const name of [...jar.keys()]) {
      if (name.endsWith("session_data")) jar.delete(name);
    }
    return jar;
  }

  /**
   * Rewind the stored session so `updateAge` has elapsed since its last
   * extension. `shouldBeUpdated` is derived from `expiresAt`, not from a clock
   * this test can move, so ageing the row is how the day is simulated.
   */
  function ageBy(db: Record<string, Row[]>, ms: number): Date {
    const row = db.session[0]!;
    const expiresAt = new Date(Date.now() + EXPIRES_IN * 1000 - ms);
    row.expiresAt = expiresAt;
    row.updatedAt = new Date(Date.now() - ms);
    return expiresAt;
  }

  async function signUp(auth: ReturnType<typeof boot>["auth"]) {
    const res = await auth.api.signUpEmail({
      body: { email: EMAIL, password: "correct-horse-battery-staple", name: "R" },
      asResponse: true,
    });
    const jar = apply(new Map<string, string>(), res);
    return { jar, raw: sessionCookie(jar).split(".")[0]! };
  }

  it("stores the hash and hands the browser the raw token", async () => {
    const { db, auth } = boot();
    const { raw } = await signUp(auth);
    expect(db.session[0]!.token).toBe(hashSessionToken(raw));
    expect(db.session[0]!.token).not.toBe(raw);
  });

  it("re-issues the RAW token — never the hash — on the cookie lane", async () => {
    const { db, auth } = boot();
    const { jar, raw } = await signUp(auth);
    ageBy(db, PAST_UPDATE_AGE_MS);
    staleCookieCache(jar);

    const res = await auth.api.getSession({
      headers: new Headers({ cookie: header(jar) }),
      asResponse: true,
    });
    expect(res.status).toBe(200);
    // A refresh actually happened — otherwise the checks below would be reading
    // back the cookie the browser already had.
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token="))).toBe(
      true,
    );

    const reissued = sessionCookie(apply(jar, res)).split(".")[0]!;
    expect(reissued).toBe(raw);
    expect(reissued).not.toBe(hashSessionToken(raw));
    // ...and the database still holds only the hash (R-04).
    expect(db.session[0]!.token).toBe(hashSessionToken(raw));

    // The whole point: the very next request still authenticates.
    const after = await auth.api.getSession({
      headers: new Headers({ cookie: header(jar) }),
    });
    expect(after?.user?.email).toBe(EMAIL);
  });

  it("slides the window back out to the full 30 days on use", async () => {
    const { db, auth } = boot();
    const { jar } = await signUp(auth);
    ageBy(db, PAST_UPDATE_AGE_MS);
    staleCookieCache(jar);

    await auth.api.getSession({ headers: new Headers({ cookie: header(jar) }) });

    const extended = new Date(db.session[0]!.expiresAt as string).getTime();
    // Back out to ~now + 30d, not merely further than it was.
    expect(extended - Date.now()).toBeGreaterThan((EXPIRES_IN - 60) * 1000);
  });

  it("survives the refresh on the desktop bearer lane", async () => {
    // The desktop holds the raw token in the OS keyring and never sees a
    // cookie. If the refresh corrupted the stored row this 401s, and
    // authStore.refreshStatus() erases the keyring entry on that 401.
    const { db, auth } = boot();
    const { raw } = await signUp(auth);
    ageBy(db, PAST_UPDATE_AGE_MS);

    const refreshed = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${raw}` }),
    });
    expect(refreshed?.user?.email).toBe(EMAIL);

    const after = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${raw}` }),
    });
    expect(after?.user?.email).toBe(EMAIL);
    expect(db.session[0]!.token).toBe(hashSessionToken(raw));
  });

  it("does not extend a session that is only a few hours old", async () => {
    // The write-amortisation half of `updateAge`: a session touched every
    // minute must not produce a database write every minute.
    const { db, auth } = boot();
    const { jar } = await signUp(auth);
    const before = ageBy(db, 60 * 60 * 1000);
    staleCookieCache(jar);

    await auth.api.getSession({ headers: new Headers({ cookie: header(jar) }) });

    expect(new Date(db.session[0]!.expiresAt as string).getTime()).toBe(
      before.getTime(),
    );
  });
});
