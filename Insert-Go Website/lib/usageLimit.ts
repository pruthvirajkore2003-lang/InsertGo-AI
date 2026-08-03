/**
 * Per-user metering for /api/ai/generate, backed by Postgres over PostgREST RPC
 * (lib/db.ts) so it runs on the Edge runtime.
 *
 * Both statements live in `security definer` Postgres functions
 * (supabase-edge-rpc.sql). Moving them out of this file changed the transport,
 * not the semantics: one RPC call is one transaction, so
 *
 *  - `consumeQuota` is still the single atomic
 *    `INSERT … ON CONFLICT DO UPDATE … RETURNING count`. Postgres serialises
 *    conflicting writes on the primary key, so N concurrent requests get N
 *    distinct counts — no check-then-write race, and it coordinates correctly
 *    across any number of Edge instances (unlike an in-memory counter, which
 *    each instance would reset independently).
 *  - `debitCredit` is still the one insert-first CTE, now with the drain-race
 *    ledger cleanup folded into the same transaction instead of a second round
 *    trip.
 *
 * Why not a driver: `pg` needs TCP, which the Edge runtime does not have, and
 * the usual Edge driver (`@neondatabase/serverless`) only fronts Neon-hosted
 * databases — this app's Postgres is Supabase. PostgREST is Supabase's own HTTP
 * interface and holds its pool server-side, so 50k in-flight SSE streams cost
 * this app zero Postgres connections. The daily-allowance caps travel as
 * parameters so lib/entitlements.ts stays the single source of truth for them.
 *
 * The increment is unconditional: an over-limit request pushes `count` past
 * `max` but the window resets on schedule, so `allowed` stays correct. It runs
 * BEFORE the Gemini call, so a failed generation still counts — acceptable and
 * simpler for abuse prevention (no decrement-on-failure).
 *
 * The pure allow/deny decision lives in lib/entitlements.ts (`requireWithinQuota`)
 * so it stays unit-testable without a DB; this module owns the I/O.
 */
import { rpc } from "./db";
import { normalizeTier, TIER_DAILY_CREDITS, type Tier } from "./entitlements";

export type QuotaCheck = {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until this window rolls over. */
  resetSeconds: number;
};

/**
 * Atomically consume one unit of `action` quota for `userId` in the current
 * `windowSecs`-wide window, returning the new count and whether it is within
 * `max`. The composite `key` is built only from the server-derived user id and
 * server-controlled action/window constants — never from the request body — and
 * arguments travel as JSON to a named function parameter, so there is no
 * SQL-injection surface.
 */
export async function consumeQuota(
  userId: string,
  action: string,
  max: number,
  windowSecs: number
): Promise<QuotaCheck> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSecs) * windowSecs;
  const key = `${userId}:${action}:${windowStart}`;
  const rows = await rpc<{ count: number }>("consume_quota", {
    p_key: key,
    p_user_id: userId,
    p_window_start: windowStart,
  });
  const count = rows[0]?.count;
  // The upsert always returns exactly one row; anything else means the write
  // did not happen, and the caller must fail closed rather than allow.
  if (typeof count !== "number") throw new Error("quota row missing");
  return {
    allowed: count <= max,
    count,
    limit: max,
    resetSeconds: windowStart + windowSecs - nowSec,
  };
}

/** Post-debit (or current, for replays) credit balances. */
export type CreditBalance = {
  tier: Tier;
  dailyRemaining: number;
  dailyMax: number;
  addOnCredits: number;
};

export type CreditDebit =
  | ({ outcome: "charged" } & CreditBalance)
  /** Idempotency-key replay: already charged, nothing deducted this call.
   *  `replays` counts how many times this key has now been replayed — the
   *  route refuses one that has been replayed more often than a real retry
   *  ever would, because a replay still serves a full uncharged generation. */
  | ({ outcome: "replayed"; ageSeconds: number; replays: number } & CreditBalance)
  | { outcome: "insufficient"; tier: Tier; dailyMax: number };

/** One row of `debit_credit`'s result — the pre-statement snapshot, what the
 *  debit actually wrote (null when it did not fire), and the age of any
 *  pre-existing ledger row. */
type DebitRow = {
  tier: unknown;
  subscriptionStatus: unknown;
  dailyUsedSnap: number;
  addOnSnap: number;
  debitedUsed: number | null;
  debitedAddOn: number | null;
  inserted: boolean;
  priorAgeSecs: number | null;
  /** Post-increment replay count for this key (0 when this call charged). */
  replays: number | null;
};

/**
 * Atomically debit one generation credit for `userId`, idempotent on
 * `idempotencyKey`. Deduction order: daily allowance first, add-on credits only
 * when today's allowance is exhausted (add-on packs never expire, so they must
 * be the last thing spent).
 *
 * Outcomes:
 *  - `charged`      — the debit fired; balances are post-debit.
 *  - `replayed`     — this key already claimed a debit; balances are current,
 *                     `ageSeconds` lets the route reject a stale replay, and
 *                     `replays` how many times the key has now been reused.
 *
 * `idempotencyKey` MUST already be namespaced to the caller (the route prefixes
 * the verified user id). `"creditLedger"`'s primary key is the key alone, so a
 * raw client-supplied value would let one account claim — and then replay — a
 * ledger row belonging to another.
 *  - `insufficient` — both pools empty; nothing was written and no ledger row
 *                     survives (the function releases a key it could not
 *                     charge).
 */
export async function debitCredit(
  userId: string,
  idempotencyKey: string
): Promise<CreditDebit> {
  const rows = await rpc<DebitRow>("debit_credit", {
    p_key: idempotencyKey,
    p_user_id: userId,
    // Caps travel from lib/entitlements.ts so the tier model stays single-source.
    p_daily_free: TIER_DAILY_CREDITS.free,
    p_daily_plus: TIER_DAILY_CREDITS.plus,
    p_daily_pro: TIER_DAILY_CREDITS.pro,
  });
  const r = rows[0];
  if (!r) throw new Error("user row not found"); // caller fails closed (503)
  const tier = normalizeTier(r);
  const dailyMax = TIER_DAILY_CREDITS[tier];
  if (r.debitedUsed !== null && r.debitedAddOn !== null)
    return {
      outcome: "charged",
      tier,
      dailyMax,
      dailyRemaining: Math.max(0, dailyMax - r.debitedUsed),
      addOnCredits: r.debitedAddOn,
    };
  if (r.inserted) {
    // Drain race: the key was claimed but the debit saw both pools empty on the
    // locked row. `debit_credit` already released the uncharged key inside the
    // same transaction, so a later retry can't replay it into a free generation.
    return { outcome: "insufficient", tier, dailyMax };
  }
  const snapshot: CreditBalance = {
    tier,
    dailyMax,
    dailyRemaining: Math.max(0, dailyMax - r.dailyUsedSnap),
    addOnCredits: r.addOnSnap,
  };
  if (r.priorAgeSecs !== null)
    return {
      outcome: "replayed",
      ageSeconds: r.priorAgeSecs,
      replays: r.replays ?? 0,
      ...snapshot,
    };
  if (snapshot.dailyRemaining > 0 || snapshot.addOnCredits > 0)
    // Credit left, no insert, no snapshot-visible ledger row: a concurrent
    // statement won the insert for this same key mid-flight. Same-key
    // duplicate → replay semantics. It is the first replay of that key by
    // definition, so it counts as one.
    return { outcome: "replayed", ageSeconds: 0, replays: 1, ...snapshot };
  return { outcome: "insufficient", tier, dailyMax };
}
