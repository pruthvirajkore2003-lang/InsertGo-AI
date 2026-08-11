/**
 * Store session tokens hashed (R-04).
 *
 * `session.token` is a live bearer credential. Better Auth persists it in
 * cleartext and looks sessions up by equality on that column, so a single
 * READ-ONLY disclosure of the table — a leaked service-role key, a backup on a
 * laptop, a support export — hands over directly replayable sessions for every
 * signed-in user. No cracking, no privilege escalation: copy and use. Hashing
 * collapses that to a list of expiry timestamps.
 *
 * The library has no option, hook or documented seam for this: `createSession`
 * generates `token: generateId(32)` and `findSession` runs
 * `findOne(session, where token = <presented>)`. `databaseHooks.session.create.
 * before` cannot do it either — the cookie is written from the row that hook
 * returns, so hashing there would make the stored value identical to the
 * presented one and buy nothing. The adapter is the only boundary where the two
 * differ, which is why this wraps the adapter.
 *
 * ── The invariant ────────────────────────────────────────────────────────────
 * Better Auth always sees the RAW token; only the database sees the hash.
 * Every method hashes token values on the way down, and the three that can
 * return a session row put the raw back on the way up (we know it — it is
 * either the value we were asked to store or the value we were asked to look
 * up). This matters because `setSessionCookie` writes `session.token` from the
 * row returned by `createSession` AND by `updateSession` (the >24h refresh
 * path, lib/auth.ts `session.updateAge`): a wrapper that returned the hash from
 * either one would silently re-issue the hash as the cookie.
 *
 * ── Why every mistake here fails CLOSED ──────────────────────────────────────
 * Hashing is unconditional — there is deliberately no "looks like a hash
 * already, pass it through" shortcut. Such a shortcut would make the stored
 * value a working credential again, which is the one outcome worse than not
 * hashing at all. Without it, any path that ever leaks a hash into a cookie
 * produces `hash(hash) != hash` on the next request: a 401 someone notices in
 * minutes, never a silent bypass.
 *
 * ── Known divergence ─────────────────────────────────────────────────────────
 * `listSessions(userId)` reads by `userId`, so its rows carry hashes that
 * cannot be reversed. That makes `/list-sessions` cosmetically wrong and
 * `/revoke-other-sessions` a silent no-op (it filters on token equality, then
 * deletes by token — which hashes again and matches nothing). Both are disabled
 * in lib/auth.ts `disabledPaths` so they answer 404 instead of lying. Neither
 * has a UI in this app. `/sign-out`, `/revoke-session` and `/revoke-sessions`
 * are unaffected: they carry the raw token or work by user id.
 */
import { createHash } from "node:crypto";
import type { DBAdapter, DBTransactionAdapter, Where } from "better-auth/adapters";

/** Better Auth's model name for the session table, and the credential column. */
const MODEL = "session";
const FIELD = "token";

/** sha256-hex. No salt and no KDF on purpose: the input is 32 characters of
 *  CSPRNG output, so there is no guessable plaintext to stretch, and the lookup
 *  has to be a single indexed equality on the hot path of every request. */
export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const hashIfString = (v: unknown): unknown =>
  typeof v === "string" ? hashSessionToken(v) : v;

/** Hash every `token` value in a where clause. Handles `operator: "in"`, which
 *  carries an array (`findSessions` / `deleteSessions` both use it). */
function hashWhere(model: string, where: Where[] | undefined): Where[] | undefined {
  if (model !== MODEL || !where) return where;
  return where.map((w) =>
    w.field === FIELD
      ? {
          ...w,
          value: (Array.isArray(w.value)
            ? w.value.map(hashIfString)
            : hashIfString(w.value)) as Where["value"],
        }
      : w,
  );
}

/**
 * hash → raw for every token this call already knows: the ones it was asked to
 * match, plus a token being written by an update. Used to put the raw back on
 * returned rows so the rest of Better Auth never observes a hash.
 */
function knownRaw(
  model: string,
  where: Where[] | undefined,
  update?: Record<string, unknown>,
): Map<string, string> | null {
  if (model !== MODEL) return null;
  const map = new Map<string, string>();
  for (const w of where ?? []) {
    if (w.field !== FIELD) continue;
    for (const v of Array.isArray(w.value) ? w.value : [w.value]) {
      if (typeof v === "string") map.set(hashSessionToken(v), v);
    }
  }
  if (typeof update?.[FIELD] === "string") {
    const raw = update[FIELD];
    map.set(hashSessionToken(raw), raw);
  }
  return map.size ? map : null;
}

/** Swap a row's hashed token back for the raw one, when we hold it. A row we
 *  cannot reverse is returned untouched — see the divergence note above. */
function restore<T>(row: T, map: Map<string, string> | null): T {
  if (!map || !row || typeof row !== "object") return row;
  const token = (row as { token?: unknown }).token;
  if (typeof token !== "string") return row;
  const raw = map.get(token);
  return raw ? ({ ...row, token: raw } as T) : row;
}

/**
 * The method overrides, shared by the top-level adapter and by the
 * transaction-scoped one. Wrapping the transaction adapter is not optional:
 * sign-up creates the user, account and session inside one transaction, and an
 * unwrapped inner adapter would write that session's token in cleartext.
 */
function overrides(base: DBTransactionAdapter) {
  return {
    create: async <T extends Record<string, unknown>, R = T>(args: {
      model: string;
      data: Omit<T, "id">;
      select?: string[];
      forceAllowId?: boolean;
    }): Promise<R> => {
      const raw = (args.data as { token?: unknown }).token;
      if (args.model !== MODEL || typeof raw !== "string") {
        return base.create<T, R>(args);
      }
      const created = await base.create<T, R>({
        ...args,
        data: { ...args.data, token: hashSessionToken(raw) },
      });
      // The caller is about to put this token in a cookie / Bearer response.
      return created && typeof created === "object"
        ? ({ ...created, token: raw } as R)
        : created;
    },

    findOne: async <T>(args: {
      model: string;
      where: Where[];
      select?: string[];
      join?: unknown;
    }): Promise<T | null> =>
      restore(
        await base.findOne<T>({
          ...args,
          where: hashWhere(args.model, args.where) as Where[],
        } as Parameters<typeof base.findOne>[0]),
        knownRaw(args.model, args.where),
      ),

    findMany: async <T>(args: {
      model: string;
      where?: Where[];
      [k: string]: unknown;
    }): Promise<T[]> => {
      const map = knownRaw(args.model, args.where);
      const rows = await base.findMany<T>({
        ...args,
        where: hashWhere(args.model, args.where),
      } as Parameters<typeof base.findMany>[0]);
      return map ? rows.map((r) => restore(r, map)) : rows;
    },

    update: async <T>(args: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }): Promise<T | null> =>
      restore(
        await base.update<T>({
          ...args,
          where: hashWhere(args.model, args.where) as Where[],
          update:
            args.model === MODEL && typeof args.update[FIELD] === "string"
              ? { ...args.update, [FIELD]: hashSessionToken(args.update[FIELD]) }
              : args.update,
        }),
        knownRaw(args.model, args.where, args.update),
      ),

    updateMany: (args: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }): Promise<number> =>
      base.updateMany({
        ...args,
        where: hashWhere(args.model, args.where) as Where[],
        update:
          args.model === MODEL && typeof args.update[FIELD] === "string"
            ? { ...args.update, [FIELD]: hashSessionToken(args.update[FIELD]) }
            : args.update,
      }),

    // The remaining where-takers need no output fix — they return void, a count
    // or a non-session row — but every one of them still has to hash, or a
    // delete/count silently addresses nothing.
    delete: (args: { model: string; where: Where[] }): Promise<void> =>
      base.delete({ ...args, where: hashWhere(args.model, args.where) as Where[] }),

    deleteMany: (args: { model: string; where: Where[] }): Promise<number> =>
      base.deleteMany({
        ...args,
        where: hashWhere(args.model, args.where) as Where[],
      }),

    count: (args: { model: string; where?: Where[] }): Promise<number> =>
      base.count({ ...args, where: hashWhere(args.model, args.where) }),

    consumeOne: async <T>(args: { model: string; where: Where[] }): Promise<T | null> =>
      restore(
        await base.consumeOne<T>({
          ...args,
          where: hashWhere(args.model, args.where) as Where[],
        }),
        knownRaw(args.model, args.where),
      ),
  };
}

/**
 * Wrap an adapter so `session.token` is hashed at the database boundary.
 *
 * Pass-through for every other model and every method not listed above — this
 * adds a projection on one column, not a new adapter.
 */
export function withHashedSessionTokens<A extends DBAdapter>(base: A): A {
  return {
    ...base,
    id: `${base.id}+hashed-session-token`,
    ...overrides(base),
    transaction: (cb: (tx: DBTransactionAdapter) => Promise<unknown>) =>
      base.transaction((tx) => cb({ ...tx, ...overrides(tx) })),
  } as unknown as A;
}
