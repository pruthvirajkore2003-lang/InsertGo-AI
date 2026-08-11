/**
 * Per-IP fixed-window rate limit for UNAUTHENTICATED routes.
 *
 * Better Auth's own limiter only covers `/api/auth/*`, and `lib/usageLimit.ts`
 * can't help here: its `apiUsage."userId"` is FK-bound to `"user"`, so it can
 * only meter a caller who is already signed in. The routes that need this are
 * exactly the ones that aren't.
 *
 * Backed by the Upstash Redis client the caches already use (`lib/edgeCache.ts`)
 * — shared across instances, unlike an in-process Map, which resets per
 * serverless instance and therefore bounds nothing. Same fail-open contract as
 * those caches: an unconfigured or unreachable Redis allows the request. This
 * limiter exists to bound load from a flood, not to enforce access; failing
 * closed would let an Upstash blip take out sign-in.
 *
 * The window is fixed, not sliding: a caller can send up to 2x `max` across a
 * boundary. That is fine for a load bound and costs one round trip.
 *
 * Privacy (SPEC §10): the IP is hashed into the key, never logged here.
 */
import { clientIp } from "./auditLog";
import { redis, sha256Hex } from "./edgeCache";

/**
 * Consume one unit for this request's client IP. Returns true when the caller
 * is within `max` for the current `windowSecs` bucket, and true (fail-open) for
 * a request with no derivable IP or any Redis failure.
 */
export async function withinIpRateLimit(
  req: Request,
  opts: { action: string; max: number; windowSecs: number }
): Promise<boolean> {
  const r = redis();
  const ip = clientIp(req);
  if (!r || !ip) return true;
  try {
    const bucket = Math.floor(Date.now() / 1000 / opts.windowSecs);
    const key = `ig:rl:${opts.action}:${bucket}:${await sha256Hex(ip)}`;
    const count = await r.incr(key);
    // Only the first caller in a bucket pays for the TTL write, and a key that
    // somehow missed one would otherwise live forever.
    if (count === 1) await r.expire(key, opts.windowSecs);
    return count <= opts.max;
  } catch {
    // Degraded, not closed — see the module header.
    console.error(`[rate-limit] check failed action=${opts.action}`);
    return true;
  }
}
