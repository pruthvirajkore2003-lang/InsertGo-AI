/**
 * Semantic cache for `/api/ai/generate` — bypass Gemini entirely when a new
 * prompt is a near-duplicate of one already answered.
 *
 * Flow (route.ts): Embed → ANN lookup → serve cached SSE, or generate → store.
 *
 *  - Embedding: `embedText` (lib/gemini.ts), SEMANTIC_SIMILARITY task type at a
 *    reduced dimensionality (SEMCACHE_EMBED_DIM) for latency; vectors are
 *    L2-normalized here so similarity is exact cosine.
 *  - ANN: Upstash Vector, one namespace per sha256(model + system + user).
 *    This replaced an in-process HNSW index (the deleted lib/hnsw.ts). The
 *    algorithm was never the problem — the locality was: a per-instance index
 *    across thousands of serverless instances hits almost never, so the same
 *    prompt gets re-embedded and re-generated (and re-billed) on every instance
 *    that has not seen it. A shared index makes the first answer serve all of
 *    them — for that same user. Partitioning by exact (model, system) still
 *    means a refiner draft can never be served a skill's answer however similar
 *    the raw prompts are, and a system-prompt edit invalidates old entries
 *    structurally, no versioning needed; partitioning by user means a stored
 *    response — which restates the draft it came from — can never reach a
 *    different account (see `namespaceKey`).
 *  - Quality floor: a hit is served only at/above SEMCACHE_MIN_SIMILARITY
 *    cosine (default 0.95) AND within TTL. Below the bar the request falls
 *    through to a real generation, so quality can only be traded where the
 *    prompts are near-identical.
 *  - Latency discipline: the whole lookup (embed + vector query) races
 *    SEMCACHE_LOOKUP_TIMEOUT_MS — a slow leg turns into a cache miss instead of
 *    delaying generation, and the still-pending embedding is reused by the
 *    post-stream `store` (fire-and-forget) so the miss path never re-embeds.
 *
 * Index setup (Upstash console, once): dimension = SEMCACHE_EMBED_DIM (768 by
 * default) and similarity function = COSINE. The dimension is fixed at creation
 * time; changing SEMCACHE_EMBED_DIM without recreating the index makes every
 * upsert fail (which degrades to "never caches", not to a broken request).
 *
 * Bounding: TTL is the only bound now. The old per-namespace FIFO cap and
 * namespace LRU existed to keep one process's heap in check and have no
 * meaning against a hosted index; entries expire on read and are deleted then.
 * ponytail: expired vectors that are never queried again linger until the
 * index's plan limit — add a scheduled `delete({ filter: "exp < <now>" })`
 * sweep if storage, not correctness, starts to bite.
 *
 * Privacy (SPEC §10): prompts are never stored — only their embeddings, the
 * response text keyed by them, and an expiry stamp. Errors log one static line,
 * no bodies, no keys.
 */
import { sha256Hex, vectorIndex } from "./edgeCache";
import { embedText } from "./gemini";

/** The lookup embedding, carried from a miss to the post-stream store so the
 *  prompt is embedded exactly once per request. */
export type PendingEmbedding = {
  ns: string;
  vector: Promise<Float32Array>;
};

export type CacheLookup = {
  /** Set when a cached response clears the similarity + TTL bar. */
  hit: { text: string; similarity: number } | null;
  pending: PendingEmbedding;
};

/** What rides along with each vector: the epoch-ms expiry. The response text
 *  itself goes in the entry's `data` field, which is sized for payloads. */
type EntryMeta = { exp?: number };

/** At/above this cosine, a new entry is a duplicate of an existing one —
 *  refresh its TTL instead of inserting a twin (keeps the index from filling
 *  with clones of one hot prompt). */
const DUPLICATE_SIMILARITY = 0.999;

// ── Config (read lazily so tests and ops can change env without a reload) ──

/** Enabled only when an index is actually configured: without one, a lookup
 *  could never hit, and running it anyway would spend embedding tokens on every
 *  request for nothing. */
export function semanticCacheEnabled(): boolean {
  return process.env.SEMCACHE_ENABLED !== "0" && vectorIndex() !== null;
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function embedModel(): string {
  return process.env.SEMCACHE_EMBED_MODEL?.trim() || "gemini-embedding-001";
}
function embedDim(): number {
  return envNum("SEMCACHE_EMBED_DIM", 768);
}
function minSimilarity(): number {
  return envNum("SEMCACHE_MIN_SIMILARITY", 0.95);
}
/** Budget for the whole lookup, embed + vector query. Was embed-only when the
 *  index was in-process and free to query; the default moved up to match. */
function lookupTimeoutMs(): number {
  return envNum("SEMCACHE_LOOKUP_TIMEOUT_MS", 600);
}
function ttlMs(): number {
  return envNum("SEMCACHE_TTL_HOURS", 24) * 60 * 60 * 1000;
}
/** Upstash caps an entry's payload; an oversize generation is simply not
 *  cached rather than failing the upsert on every store. */
function maxTextBytes(): number {
  return envNum("SEMCACHE_MAX_TEXT_KB", 32) * 1024;
}

// ── Pure helpers (exported for tests) ──────────────────────────────────────

/**
 * Stable partition key: exact (model, system, user) triple. Hashed so the (long)
 * system prompt never sits in a namespace name — and because a collision here
 * would cross skill boundaries, the hash is cryptographic, not cheap.
 *
 * The USER dimension is a confidentiality boundary, not a tuning knob. Without
 * it the namespace is shared by everyone on a given skill, and since the stored
 * `data` is the response text — which restates the originating user's draft —
 * any second user whose prompt lands within SEMCACHE_MIN_SIMILARITY is served
 * that first user's content. The stock system prompts ship with the desktop
 * client, so a handful of namespaces would hold the entire user base.
 *
 * The cost is honest: cross-user hits are gone, so the hit rate is now "this
 * user asked something near-identical before", which is the only sharing that
 * was ever safe.
 */
export function namespaceKey(
  model: string,
  system: string,
  userId: string
): Promise<string> {
  return sha256Hex(`${model}\n${system}\n${userId}`);
}

/**
 * Upstash normalizes COSINE (and DOT_PRODUCT) scores into [0, 1] as
 * `(1 + cosine) / 2`, so a raw cosine of 0.95 comes back as 0.975. Comparing
 * SEMCACHE_MIN_SIMILARITY against the raw score would silently accept cosine
 * 0.90 — a real quality regression. Invert it here so the threshold, and the
 * `similarity` the route logs, keep exactly the meaning they had against the
 * in-process index.
 */
export function cosineFromScore(score: number): number {
  return 2 * score - 1;
}

/** L2-normalize to a unit vector. Fails fast on a zero/degenerate vector —
 *  indexing it would make cosine meaningless. */
export function normalize(values: number[]): Float32Array {
  let sq = 0;
  for (const v of values) sq += v * v;
  const norm = Math.sqrt(sq);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Cannot normalize a zero or non-finite vector.");
  }
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] / norm;
  return out;
}

/** A cache hit as one Gemini-shaped SSE frame — the exact chunk subset the
 *  desktop client already parses (delta text + STOP), so a served hit is
 *  byte-indistinguishable from a one-chunk live stream. */
export function sseLineFromCachedText(text: string): string {
  const payload = {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Embed the prompt and return a unit vector; the promise is created eagerly
 *  and shared by lookup + store. */
function embedNormalized(prompt: string): Promise<Float32Array> {
  const p = embedText(prompt, embedModel(), embedDim()).then(normalize);
  // Detach a no-op handler: if lookup times out and the request then fails
  // before store runs, the rejection would otherwise be unhandled.
  p.catch(() => {});
  return p;
}

/**
 * Embed → ANN lookup, bounded by SEMCACHE_LOOKUP_TIMEOUT_MS. Never throws:
 * an embed failure, an index error or a timeout is a miss (fail-open — the
 * cache must not be able to take generation down). Always returns `pending` so
 * a miss can be stored later without re-embedding.
 */
export async function lookupSemanticCache(params: {
  model: string;
  system: string;
  prompt: string;
  /** Verified session user id — the namespace's confidentiality dimension. */
  userId: string;
}): Promise<CacheLookup> {
  // Start the embed before awaiting the (cheap) namespace hash.
  const vector = embedNormalized(params.prompt);
  const ns = await namespaceKey(params.model, params.system, params.userId);
  const pending: PendingEmbedding = { ns, vector };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const hit = await Promise.race([
    vector.then((v) => searchNamespace(ns, v)).catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), lookupTimeoutMs());
    }),
  ]);
  // Don't leave a live timer holding the invocation open once the race is over.
  if (timer !== undefined) clearTimeout(timer);
  return { hit, pending };
}

async function searchNamespace(
  ns: string,
  v: Float32Array
): Promise<{ text: string; similarity: number } | null> {
  const index = vectorIndex();
  if (!index) return null;
  const space = index.namespace(ns);
  // topK=3: the nearest neighbor may be TTL-expired; give the next-nearest a
  // shot before giving up. Hits come back best-first, so the first live entry
  // below the bar ends the scan.
  const hits = await space.query<EntryMeta>({
    vector: Array.from(v),
    topK: 3,
    includeMetadata: true,
    includeData: true,
  });
  for (const hit of hits) {
    const exp = hit.metadata?.exp;
    if (typeof exp !== "number" || exp <= Date.now()) {
      // Expired (or unstamped): drop it so the index self-heals, and keep
      // scanning. Fire-and-forget — a failed delete must not fail the lookup.
      void space.delete(String(hit.id)).catch(() => {});
      continue;
    }
    if (typeof hit.data !== "string" || hit.data.length === 0) continue;
    const similarity = cosineFromScore(hit.score);
    if (similarity >= minSimilarity()) {
      return { text: hit.data, similarity };
    }
    break;
  }
  return null;
}

/**
 * Store a completed generation under the request's embedding. Fire-and-forget:
 * the route calls this without awaiting, after the stream has closed — a slow
 * or failed embed can never block or fail a user response. Returns the
 * internal promise purely so tests can await settlement.
 */
export function storeSemanticCache(
  pending: PendingEmbedding,
  text: string
): Promise<void> {
  return (async () => {
    const index = vectorIndex();
    if (!index) return;
    if (new TextEncoder().encode(text).length > maxTextBytes()) return;

    const v = await pending.vector;
    const vector = Array.from(v);
    const space = index.namespace(pending.ns);
    const expires = Date.now() + ttlMs();

    // A near-identical vector already indexed: refresh its expiry in place
    // (keeping the answer it already holds) instead of inserting a twin.
    const nearest = (
      await space.query<EntryMeta>({
        vector,
        topK: 1,
        includeMetadata: true,
        includeData: true,
      })
    )[0];
    if (nearest && cosineFromScore(nearest.score) >= DUPLICATE_SIMILARITY) {
      await space.upsert({
        id: String(nearest.id),
        vector,
        data: nearest.data ?? text,
        metadata: { exp: expires },
      });
      return;
    }

    await space.upsert({
      id: crypto.randomUUID(),
      vector,
      data: text,
      metadata: { exp: expires },
    });
  })().catch(() => {
    // Static line only — never prompt/response bodies (SPEC §10).
    console.error("[semantic-cache] store failed");
  });
}
