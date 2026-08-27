/**
 * Per-generation cost telemetry for `/api/ai/generate`.
 *
 * Why this exists: the margin on this product is a token-cost question, and
 * nothing else in the schema can answer it. `"apiUsage"` counts REQUESTS (it is
 * a rate-limit window counter) and `"creditLedger"` counts CREDITS, but a
 * credit buys a variable number of tokens — a one-line rewrite and a full-page
 * expansion are both one credit and differ by ~10x in what they cost to serve.
 * Until this table the only record of that difference was a `console.debug`
 * line in the route, which ages out of platform logs in days, so cost-per-user,
 * cost-per-model and the semantic cache's real hit rate were all unmeasurable
 * and margin drift stayed invisible until the monthly Gemini bill arrived.
 *
 * Fire-and-forget by construction. `logGeneration` never rejects and is never
 * awaited by the route: it runs in the stream's `finally` block, after the last
 * byte the client cares about. A telemetry write that can delay — or fail — a
 * generation the user already paid a credit for is strictly worse than no
 * telemetry, so every error is swallowed here rather than handled upstream.
 *
 * Privacy (SPEC §10): counts, ids and booleans only. There is deliberately no
 * parameter that can carry prompt or response text, which is what makes these
 * rows safe to retain at all. They are Class A for erasure — a verified DSR
 * purges them (supabase-consent-dsr.sql `erase_user`).
 */
import { rpc } from "./db";
import type { Tier } from "./entitlements";

export type GenerationLogEntry = {
  userId: string;
  tier: Tier;
  /** The model actually billed — the request model, not the allowlist default. */
  model: string;
  promptTokens: number;
  outputTokens: number;
  /** Grounded runs carry a per-prompt Google Search charge (~70x a plain
   *  generation), so cost analysis is meaningless without this flag. */
  grounded: boolean;
  /** A semantic-cache hit still costs an embedding call but no generation.
   *  Recording it is what makes the cache's real hit rate — and therefore
   *  whether it pays for itself — measurable. */
  cacheHit: boolean;
};

/**
 * Record one served generation. Resolves to `true` when the row was written and
 * `false` on any failure; never rejects, so `void logGeneration(...)` is safe.
 *
 * Callers should NOT await this on the request path.
 */
export async function logGeneration(
  entry: GenerationLogEntry
): Promise<boolean> {
  try {
    await rpc("log_generation", {
      p_user_id: entry.userId,
      p_tier: entry.tier,
      p_model: entry.model,
      // Coerced here as well as in SQL: `usageMetadata` fields are optional on
      // the Gemini chunk, and a partial stream can leave them undefined.
      p_prompt_tokens: Math.max(0, Math.trunc(entry.promptTokens || 0)),
      p_output_tokens: Math.max(0, Math.trunc(entry.outputTokens || 0)),
      p_grounded: entry.grounded,
      p_cache_hit: entry.cacheHit,
    });
    return true;
  } catch (e) {
    // One static line, no ids or values (SPEC §10). Losing a telemetry row is a
    // reporting gap, not a user-facing fault — the generation already shipped.
    console.warn(
      "[generationLog] write failed:",
      e instanceof Error ? e.name : "unknown"
    );
    return false;
  }
}
