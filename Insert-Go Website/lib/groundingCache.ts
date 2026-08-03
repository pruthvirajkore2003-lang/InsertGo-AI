/**
 * Cross-instance TTL cache for pass-1 grounded research, backed by Upstash
 * Redis.
 *
 * Grounding is billed per query (Gemini 3) / per prompt (2.5) and rate-limited,
 * so identical topics within a day should not re-hit Google Search. The old
 * in-process Map did that only per instance: with thousands of serverless
 * instances the hit rate collapses to ~0 and every instance pays Google for the
 * same topic. Redis makes the cache shared, so the first instance to research a
 * topic pays for all of them.
 *
 * Keyed on a normalized (model + topic) hash; TTL 24h, enforced by Redis
 * (`EX`) rather than by a swept Map, so nothing needs an entry cap any more.
 * Values are the already-mapped grounded result, so nothing sensitive beyond
 * public citations is retained.
 *
 * Fail-open, exactly like the Map it replaces: a Redis error or an unconfigured
 * server is a miss, never a failed request — the route's grounded branch maps
 * thrown errors to 502, so a cache blip must not surface as one. Privacy
 * (SPEC §10): errors log one static line, never a key or a value.
 */
import { redis, sha256Hex } from "./edgeCache";

const TTL_SECONDS = 24 * 60 * 60; // 24h
const PREFIX = "ig:ground:";

/** Stable key for a (model, topic) pair — normalized so trivial spacing/case
 *  differences share a cache slot. Async because Web Crypto's digest is
 *  (`node:crypto` is unavailable on the Edge runtime). */
export async function cacheKey(model: string, topic: string): Promise<string> {
  const norm = topic.trim().replace(/\s+/g, " ").toLowerCase();
  return PREFIX + (await sha256Hex(`${model}\n${norm}`));
}

/** Read a live entry, or undefined. Expiry is Redis-side, so an expired entry
 *  is simply absent. Never throws. */
export async function getCached<T>(key: string): Promise<T | undefined> {
  const r = redis();
  if (!r) return undefined;
  try {
    // Upstash deserializes JSON values on the way out.
    return (await r.get<T>(key)) ?? undefined;
  } catch {
    console.error("[grounding-cache] read failed");
    return undefined;
  }
}

/** Store a value with the standard TTL. Never throws. */
export async function setCached<T>(key: string, value: T): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: TTL_SECONDS });
  } catch {
    console.error("[grounding-cache] write failed");
  }
}
