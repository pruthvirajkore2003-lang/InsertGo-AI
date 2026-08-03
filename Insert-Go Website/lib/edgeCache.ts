/**
 * Shared Edge-runtime cache infrastructure: the Upstash clients and the hash
 * used to build cache keys.
 *
 * Both Upstash SDKs are pure `fetch` wrappers with no Node builtins, so they
 * run unchanged on the Edge runtime. Clients are constructed lazily and
 * memoized on `globalThis` — merely importing this module must never throw on a
 * server without Upstash configured, and a warm invocation must not rebuild
 * them.
 *
 * Unconfigured is a first-class state: `redis()` / `vectorIndex()` return null,
 * and every caller degrades to "no cache" rather than failing the request. That
 * is the same fail-open contract the in-process caches had, and it keeps local
 * dev and CI running with no Upstash account.
 *
 * Every call carries an AbortSignal deadline and at most one retry. A cache is
 * an optimisation; a stalled cache must turn into a miss on a bounded clock,
 * never into a request that holds an Edge invocation open.
 *
 * Privacy (SPEC §10): nothing here logs a key, a value, or a token.
 */
import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";

/** Deadline for a single Upstash round trip. */
const TIMEOUT_MS = Number(process.env.UPSTASH_TIMEOUT_MS ?? 500);

/** One retry only: a second attempt covers a dropped connection, more just
 *  spends the caller's latency budget on an outage. */
const RETRY = { retries: 1, backoff: () => 50 } as const;

type Cached = { __igRedis?: Redis | null; __igVector?: Index | null };
const g = globalThis as unknown as Cached;

/** Shared Redis client, or null when Upstash Redis isn't configured. */
export function redis(): Redis | null {
  if (g.__igRedis !== undefined) return g.__igRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  g.__igRedis =
    url && token
      ? new Redis({
          url,
          token,
          retry: RETRY,
          signal: () => AbortSignal.timeout(TIMEOUT_MS),
        })
      : null;
  return g.__igRedis;
}

/** Shared Vector index client, or null when Upstash Vector isn't configured.
 *  The index's dimension and similarity function are fixed at creation time in
 *  the Upstash console — see lib/semanticCache.ts for the values to use. */
export function vectorIndex(): Index | null {
  if (g.__igVector !== undefined) return g.__igVector;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  g.__igVector =
    url && token
      ? new Index({
          url,
          token,
          retry: RETRY,
          signal: () => AbortSignal.timeout(TIMEOUT_MS),
        })
      : null;
  return g.__igVector;
}

/**
 * SHA-256 as lowercase hex, via Web Crypto (`node:crypto` is not available on
 * the Edge runtime). Async, which is why every cache-key helper built on it is
 * async too.
 *
 * Used for cache partitioning, so collision resistance is load-bearing: a
 * collision between two (model, system) pairs would serve one skill's answer
 * for another's prompt. That rules out a cheap non-cryptographic hash here.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
