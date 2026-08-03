/**
 * Edge-safe Postgres access: PostgREST RPC over `fetch`.
 *
 * `/api/ai/generate` runs on the Edge runtime, which has no TCP sockets — `pg`
 * (and every driver built on it) is unusable there. The usual Edge escape hatch
 * (`@neondatabase/serverless`) is not one here either: its HTTP/WebSocket
 * endpoints only exist in front of a Neon-hosted database, and this app's
 * Postgres is Supabase. Supabase's own HTTP front door is PostgREST, so that is
 * what the Edge route talks to.
 *
 * The consequence that actually matters at 50k concurrent streams: this process
 * holds ZERO database connections. PostgREST owns a fixed server-side pool, so
 * the number of live SSE holds is fully decoupled from the number of Postgres
 * backends. The Node-runtime surfaces keep their own pool in lib/pgPool.ts,
 * pointed at Supavisor.
 *
 * Only `rpc()` is exposed — arbitrary SQL cannot be sent over this transport by
 * design. Each statement lives in a `security definer` Postgres function (see
 * supabase-edge-rpc.sql), which keeps the multi-statement atomicity the credit
 * ledger depends on: one HTTP call is one transaction. The service-role key is
 * server-only and never reaches a client bundle.
 *
 * Every call is bounded by SUPABASE_RPC_TIMEOUT_MS — a stalled DB must surface
 * as a failure the caller can fail closed on (503), never as a hung request
 * holding an Edge invocation open.
 */

/** Request timeout for a single RPC call. */
const RPC_TIMEOUT_MS = Number(process.env.SUPABASE_RPC_TIMEOUT_MS ?? 5_000);

/**
 * Thrown for any non-2xx / timed-out / malformed RPC. Carries the HTTP status
 * only: PostgREST error bodies echo SQL text and row values, and this app never
 * logs anything that could contain user data (SPEC §10).
 */
export class DbError extends Error {
  constructor(
    readonly fn: string,
    readonly status: number
  ) {
    super(`db rpc ${fn} failed (${status})`);
    this.name = "DbError";
  }
}

/** Server is missing the config this transport needs. Distinct from DbError:
 *  no request was made, and no amount of retrying will ever make one work. */
export class DbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbConfigError";
  }
}

/**
 * True when a failed RPC can never be fixed by retrying, so the caller must
 * answer 500 (a permanent fault) instead of 503 ("try again later"):
 *  - missing SUPABASE_* config — no request was even attempted;
 *  - 404 — the `security definer` function is absent from this database
 *    (supabase-edge-rpc.sql was never applied);
 *  - 401/403 — the service-role key is wrong or lacks EXECUTE.
 * Timeouts, network errors (status 0) and 5xx stay transient.
 */
export function isPermanentDbFailure(e: unknown): boolean {
  if (e instanceof DbConfigError) return true;
  return (
    e instanceof DbError &&
    (e.status === 404 || e.status === 401 || e.status === 403)
  );
}

/** Read config lazily so merely importing this module never throws on a
 *  misconfigured server — only an actual query fail-fasts. */
function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new DbConfigError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Edge database access."
    );
  }
  return { url, key };
}

/**
 * Call a `security definer` Postgres function and return its rows.
 *
 * Every function used here is declared `returns table (...)`, so PostgREST
 * always answers with a JSON array — a uniform shape regardless of how many
 * rows the statement produced. `args` maps directly to the function's named
 * parameters and is serialized as JSON, so values are never interpolated into
 * SQL text (no injection surface, same guarantee the old parameterized
 * `pool.query` had).
 */
export async function rpc<TRow>(
  fn: string,
  args: Record<string, unknown>
): Promise<TRow[]> {
  const { url, key } = config();
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Ask PostgREST not to buffer a count it was never going to use.
        Prefer: "count=none",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Network error / AbortSignal timeout. Status 0 = never reached the DB.
    throw new DbError(fn, 0);
  }
  if (!res.ok) {
    // Drain so the connection can be reused; the body is deliberately dropped.
    await res.text().catch(() => "");
    throw new DbError(fn, res.status);
  }
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) throw new DbError(fn, res.status);
  return rows as TRow[];
}
