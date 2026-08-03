import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the Upstash Vector index. It reproduces the two
 * behaviours the cache actually depends on: per-namespace isolation, and
 * Upstash's normalized COSINE score `(1 + cosine) / 2` — the cache converts it
 * back before comparing against SEMCACHE_MIN_SIMILARITY, and a regression there
 * would silently halve the quality bar.
 */
type Rec = { id: string; vector: number[]; data?: string; metadata?: { exp?: number } };
const spaces = new Map<string, Map<string, Rec>>();

function space(ns: string): Map<string, Rec> {
  let s = spaces.get(ns);
  if (!s) spaces.set(ns, (s = new Map()));
  return s;
}
/** Stored and queried vectors are unit-normalized by the cache, so dot == cosine. */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

const fakeIndex = {
  namespace: (ns: string) => ({
    query: async (args: { vector: number[]; topK: number }) =>
      [...space(ns).values()]
        .map((r) => ({
          id: r.id,
          score: (1 + dot(args.vector, r.vector)) / 2, // Upstash normalization
          data: r.data,
          metadata: r.metadata,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, args.topK),
    upsert: async (r: Rec) => {
      space(ns).set(r.id, r);
      return "Success";
    },
    delete: async (id: string) => {
      space(ns).delete(id);
      return { deleted: 1 };
    },
  }),
};

vi.mock("./edgeCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./edgeCache")>()),
  vectorIndex: () => fakeIndex,
}));

// The cache embeds via the shared lazy Gemini client; tests must never hit the
// network (or need a key), so the embedding lane is mocked per test.
vi.mock("./gemini", () => ({ embedText: vi.fn() }));

import {
  cosineFromScore,
  lookupSemanticCache,
  namespaceKey,
  normalize,
  semanticCacheEnabled,
  sseLineFromCachedText,
  storeSemanticCache,
} from "./semanticCache";
import { embedText } from "./gemini";

const embedMock = vi.mocked(embedText);

/** Route each prompt to a fixed raw vector (normalized inside the cache). */
function embedFromMap(map: Record<string, number[]>): void {
  embedMock.mockImplementation(async (text: string) => {
    const v = map[text];
    if (!v) throw new Error(`no test vector for: ${text}`);
    return v;
  });
}

const SEMCACHE_VARS = [
  "SEMCACHE_ENABLED",
  "SEMCACHE_MIN_SIMILARITY",
  "SEMCACHE_LOOKUP_TIMEOUT_MS",
  "SEMCACHE_TTL_HOURS",
  "SEMCACHE_MAX_TEXT_KB",
];
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(SEMCACHE_VARS.map((k) => [k, process.env[k]]));
  spaces.clear();
  embedMock.mockReset();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("namespaceKey", () => {
  it("partitions by model, system prompt and user", async () => {
    const base = await namespaceKey("m1", "s1", "u1");
    expect(await namespaceKey("m2", "s1", "u1")).not.toBe(base);
    expect(await namespaceKey("m1", "s2", "u1")).not.toBe(base);
    // The confidentiality dimension: stored text restates the prompt it came
    // from, so it must never be reachable from another account.
    expect(await namespaceKey("m1", "s1", "u2")).not.toBe(base);
    expect(await namespaceKey("m1", "s1", "u1")).toBe(base);
  });
});

describe("cosineFromScore", () => {
  it("undoes Upstash's [0,1] normalization so the threshold keeps its meaning", () => {
    expect(cosineFromScore(1)).toBeCloseTo(1);
    expect(cosineFromScore(0.975)).toBeCloseTo(0.95);
    expect(cosineFromScore(0.5)).toBeCloseTo(0);
  });
});

describe("normalize", () => {
  it("produces a unit vector and rejects degenerate input", () => {
    const v = normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(() => normalize([0, 0])).toThrow(/zero/);
  });
});

describe("sseLineFromCachedText", () => {
  it("emits the exact one-chunk Gemini SSE shape the client parses", () => {
    const line = sseLineFromCachedText("hello");
    expect(line.startsWith("data: ")).toBe(true);
    expect(line.endsWith("\n\n")).toBe(true);
    const payload = JSON.parse(line.slice("data: ".length));
    expect(payload).toEqual({
      candidates: [
        { content: { parts: [{ text: "hello" }] }, finishReason: "STOP" },
      ],
    });
  });
});

describe("semanticCacheEnabled", () => {
  it("defaults on with an index configured, and turns off at '0'", () => {
    delete process.env.SEMCACHE_ENABLED;
    expect(semanticCacheEnabled()).toBe(true);
    process.env.SEMCACHE_ENABLED = "0";
    expect(semanticCacheEnabled()).toBe(false);
  });
});

describe("lookup/store", () => {
  const req = (prompt: string, system = "sys", userId = "user-1") => ({
    model: "gemini-2.5-flash-lite",
    system,
    prompt,
    userId,
  });

  it("misses cold, then hits an identical prompt after store", async () => {
    embedFromMap({ "improve this": [1, 0, 0] });
    const miss = await lookupSemanticCache(req("improve this"));
    expect(miss.hit).toBeNull();

    await storeSemanticCache(miss.pending, "cached answer");
    const hit = await lookupSemanticCache(req("improve this"));
    expect(hit.hit?.text).toBe("cached answer");
    expect(hit.hit?.similarity).toBeGreaterThan(0.999);
  });

  it("hits a near-duplicate above the threshold, misses below it", async () => {
    embedFromMap({
      base: [1, 0, 0],
      near: [0.96, 0.28, 0], // cosine 0.96 ≥ 0.95 default
      far: [0.8, 0.6, 0], // cosine 0.80 < 0.95
    });
    const miss = await lookupSemanticCache(req("base"));
    await storeSemanticCache(miss.pending, "answer");

    expect((await lookupSemanticCache(req("near"))).hit?.text).toBe("answer");
    expect((await lookupSemanticCache(req("far"))).hit).toBeNull();
  });

  it("never crosses (model+system) namespaces", async () => {
    embedFromMap({ base: [1, 0, 0] });
    const miss = await lookupSemanticCache(req("base", "skill A"));
    await storeSemanticCache(miss.pending, "skill A answer");

    expect((await lookupSemanticCache(req("base", "skill B"))).hit).toBeNull();
    expect((await lookupSemanticCache(req("base", "skill A"))).hit?.text).toBe(
      "skill A answer"
    );
  });

  // The stored `data` is the response text, which restates the draft it came
  // from. An identical prompt from a different account must generate, not read.
  it("never serves one user's cached answer to another", async () => {
    embedFromMap({ "the confidential memo": [1, 0, 0] });
    const victim = await lookupSemanticCache(
      req("the confidential memo", "sys", "victim")
    );
    await storeSemanticCache(victim.pending, "the rewritten memo");

    const attacker = await lookupSemanticCache(
      req("the confidential memo", "sys", "attacker")
    );
    expect(attacker.hit).toBeNull();

    // …and the owner still gets their own hit, which is the whole point.
    expect(
      (await lookupSemanticCache(req("the confidential memo", "sys", "victim")))
        .hit?.text
    ).toBe("the rewritten memo");
  });

  it("degrades a slow embedding to a miss, then reuses it to store", async () => {
    process.env.SEMCACHE_LOOKUP_TIMEOUT_MS = "10";
    embedMock.mockImplementation(
      () => new Promise((r) => setTimeout(() => r([1, 0, 0]), 50))
    );
    const slow = await lookupSemanticCache(req("slow prompt"));
    expect(slow.hit).toBeNull(); // timed out, not failed

    await storeSemanticCache(slow.pending, "late answer");
    process.env.SEMCACHE_LOOKUP_TIMEOUT_MS = "1000";
    expect((await lookupSemanticCache(req("slow prompt"))).hit?.text).toBe(
      "late answer"
    );
  });

  it("treats an embedding failure as a miss and store swallows it", async () => {
    embedMock.mockRejectedValue(new Error("embed down"));
    const miss = await lookupSemanticCache(req("anything"));
    expect(miss.hit).toBeNull();
    await expect(
      storeSemanticCache(miss.pending, "text")
    ).resolves.toBeUndefined();
  });

  it("expires entries after the TTL and drops them from the index", async () => {
    process.env.SEMCACHE_TTL_HOURS = "0";
    embedFromMap({ base: [1, 0, 0] });
    const miss = await lookupSemanticCache(req("base"));
    await storeSemanticCache(miss.pending, "stale");
    const ns = await namespaceKey("gemini-2.5-flash-lite", "sys", "user-1");
    expect(space(ns).size).toBe(1);

    expect((await lookupSemanticCache(req("base"))).hit).toBeNull();
    expect(space(ns).size).toBe(0); // self-healing: expired vector deleted
  });

  it("refreshes a duplicate instead of inserting a twin", async () => {
    embedFromMap({ a: [1, 0, 0], "a again": [1, 0, 0], b: [0, 1, 0] });
    const a = await lookupSemanticCache(req("a"));
    await storeSemanticCache(a.pending, "A");

    const aAgain = await lookupSemanticCache(req("a again"));
    expect(aAgain.hit?.text).toBe("A");
    await storeSemanticCache(aAgain.pending, "A2");

    const ns = await namespaceKey("gemini-2.5-flash-lite", "sys", "user-1");
    expect(space(ns).size).toBe(1); // refreshed in place, not twinned
    expect((await lookupSemanticCache(req("a"))).hit?.text).toBe("A");

    // A genuinely different vector still inserts.
    const b = await lookupSemanticCache(req("b"));
    await storeSemanticCache(b.pending, "B");
    expect(space(ns).size).toBe(2);
  });

  it("skips storing a response larger than the payload cap", async () => {
    process.env.SEMCACHE_MAX_TEXT_KB = "0";
    embedFromMap({ big: [1, 0, 0] });
    const miss = await lookupSemanticCache(req("big"));
    await storeSemanticCache(miss.pending, "too large to cache");
    expect((await lookupSemanticCache(req("big"))).hit).toBeNull();
  });
});
