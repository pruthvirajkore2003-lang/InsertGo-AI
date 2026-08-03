/**
 * Session verification for Edge-runtime routes.
 *
 * `auth.api.getSession()` cannot be called from the Edge runtime: Better Auth's
 * adapter is a `pg` Pool (lib/auth.ts), and `pg` needs TCP sockets. Rather than
 * re-implement session/bearer validation here — duplicating a security boundary
 * is how the two copies drift apart — this calls Better Auth's own
 * `/api/auth/get-session` endpoint, which still runs on Node with the same
 * plugins (bearer, cookieCache, customSession entitlement enrichment). Better
 * Auth stays the single authority on what a valid session is; only the
 * transport changed.
 *
 * The origin comes from BETTER_AUTH_URL, never from the incoming request's Host
 * header: a caller who could steer this fetch at their own origin could mint
 * any session they liked.
 *
 * Optional Redis memo (SESSION_CACHE_TTL_SECS, default 60s, 0 disables): at
 * 50k concurrent streams the sub-request per generation is the single hottest
 * path in the system, and it resolves to the same answer for the same
 * credential every time. Bounded staleness only — the credential is hashed
 * before it is used as a key, the VALUE is narrowed to the three fields this
 * route reads (see `narrow`) so no token is ever written to Redis, misses and
 * failures are never cached (a fresh sign-in is live immediately), and 60s is
 * strictly tighter than the 5-minute `cookieCache` Better Auth already applies.
 * Nothing about spend rides on it either: quota and credit debits are
 * DB-authoritative on every request, so a stale session cannot overspend.
 *
 * Privacy (SPEC §10): no token, cookie, or user field is ever logged.
 */
import { redis, sha256Hex } from "./edgeCache";

/** The subset of a Better Auth session this app reads — the same shape
 *  lib/entitlements.ts narrows. */
export type EdgeSession = {
  user?: {
    id?: string | null;
    subscriptionStatus?: string | null;
    credits?: number | null;
  } | null;
} | null;

/** What Better Auth actually answers with: `{ session, user }`, where `session`
 *  is the full row INCLUDING its `token` (the bearer plugin's whole purpose —
 *  compare `parseAccountOutput`, which does strip credentials). Typed loosely
 *  on purpose; only `user` survives `narrow`. */
type RawSession = { user?: Record<string, unknown> | null } | null;

/**
 * Reduce a session to exactly the three fields this route reads (`requireSession`
 * needs `id`; `lib/entitlements.ts` `isGroundingEntitled` reads the other two).
 *
 * This is a security boundary, not a size optimisation: the value returned here
 * is what gets written to Upstash, and the un-narrowed body contains a working
 * session token. Anyone holding UPSTASH_REDIS_REST_TOKEN could otherwise read
 * live credentials for every user active in the last SESSION_CACHE_TTL_SECS.
 */
function narrow(raw: RawSession): EdgeSession {
  const u = raw?.user;
  if (!u || typeof u.id !== "string" || !u.id) return null;
  return {
    user: {
      id: u.id,
      // `== null` on the way out too: lib/entitlements.ts treats "both absent"
      // as a pre-customSession server and degrades to trial-with-credits, and
      // undefined→null must not change that.
      subscriptionStatus:
        typeof u.subscriptionStatus === "string" ? u.subscriptionStatus : null,
      credits: typeof u.credits === "number" ? u.credits : null,
    },
  };
}

const FETCH_TIMEOUT_MS = Number(process.env.SESSION_FETCH_TIMEOUT_MS ?? 3_000);
const CACHE_TTL_SECS = Number(process.env.SESSION_CACHE_TTL_SECS ?? 60);
const PREFIX = "ig:sess:";

/**
 * Resolve the caller's session, or null when there isn't a valid one.
 *
 * Never throws: any transport failure resolves to null, which the route maps to
 * 401 — the same behaviour the in-process `try/catch` around
 * `auth.api.getSession` had.
 */
export async function getEdgeSession(req: Request): Promise<EdgeSession> {
  // Desktop clients send `Authorization: Bearer <session-token>`; the website
  // sends the session cookie. Anything else cannot be a session.
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (!authorization && !cookie) return null;

  const key = PREFIX + (await sha256Hex(`${authorization ?? ""}\n${cookie ?? ""}`));
  const cached = await readCache(key);
  if (cached) return cached;

  const base = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
  if (!base) {
    // Misconfigured server: fail closed rather than guess an origin from the
    // request (a spoofed Host would become a session oracle).
    console.error("[edge-session] BETTER_AUTH_URL is not set");
    return null;
  }

  let session: EdgeSession = null;
  try {
    const headers: Record<string, string> = {};
    if (authorization) headers.authorization = authorization;
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`${base}/api/auth/get-session`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    // Better Auth answers with the literal `null` body when there is no session.
    // Narrow immediately: the raw body carries the full `session` record, and
    // `parseSessionOutput` keeps its `token` — a live bearer credential that
    // must not travel any further than this line.
    session = narrow((await res.json()) as RawSession);
  } catch {
    // Timeout / network error. Static line only — never headers or bodies.
    console.error("[edge-session] session lookup failed");
    return null;
  }

  if (session?.user?.id) void writeCache(key, session);
  return session;
}

async function readCache(key: string): Promise<EdgeSession> {
  if (CACHE_TTL_SECS <= 0) return null;
  const r = redis();
  if (!r) return null;
  try {
    return (await r.get<EdgeSession>(key)) ?? null;
  } catch {
    return null; // a cache miss, not a failure
  }
}

async function writeCache(key: string, session: EdgeSession): Promise<void> {
  if (CACHE_TTL_SECS <= 0) return;
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, session, { ex: CACHE_TTL_SECS });
  } catch {
    // Best-effort: an unmemoized session just costs one more sub-request.
  }
}
