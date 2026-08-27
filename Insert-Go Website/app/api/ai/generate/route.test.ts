/**
 * Metering-contract tests for POST /api/ai/generate.
 *
 * `lib/usageLimit.test.ts` covers what the ledger DOES (the daily-then-add-on
 * order, the drain race, the replay counter). This file covers the layer above
 * it: the wire contract the desktop client is coded against, and the ORDER the
 * gates run in. Both are load-bearing and neither is visible from the unit
 * tests —
 *
 *  - the 402 body shape (`aiProviders.ts` reads `balance`/`daily`/`addOn` to
 *    repaint the paywall before `refreshStatus()` returns);
 *  - the `x-credits-*` headers (the client's counters update from these
 *    instead of reloading the session);
 *  - the replay bound, which is the only thing standing between one charged
 *    Idempotency-Key and a whole day of uncharged generations;
 *  - fail-closed: nothing reaches Gemini if metering could not be recorded, and
 *    a permanent misconfiguration must answer 500, not 503, or every client
 *    burns its full retry budget on a fault no retry clears.
 *
 * Gemini, the caches and the session are stubbed; `debitCredit`/`consumeQuota`
 * are stubbed at the module seam so each outcome is reachable on demand.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { session } = vi.hoisted(() => ({
  session: { value: { user: { id: "usr_1" } } as unknown },
}));
vi.mock("@/lib/edgeSession", () => ({
  getEdgeSession: vi.fn(async () => session.value),
}));

const { consumeQuota, debitCredit } = vi.hoisted(() => ({
  consumeQuota: vi.fn(),
  debitCredit: vi.fn(),
}));
vi.mock("@/lib/usageLimit", () => ({ consumeQuota, debitCredit }));

const { streamContent, generateGrounded, resolveGroundingModel } = vi.hoisted(
  () => ({
    streamContent: vi.fn(),
    generateGrounded: vi.fn(),
    resolveGroundingModel: vi.fn(),
  }),
);
vi.mock("@/lib/gemini", async (orig) => ({
  // Keep the real `isAllowedModel` and the SSE serializers — the model gate is
  // a cost control under test here, not a stub.
  ...(await orig<Record<string, unknown>>()),
  streamContent,
  generateGrounded,
  resolveGroundingModel,
}));

// Both caches are opt-in and Upstash-backed; off by default so the default path
// under test is the plain streaming one.
const { semanticEnabled, cacheHit } = vi.hoisted(() => ({
  semanticEnabled: { on: false },
  cacheHit: { text: null as string | null },
}));
vi.mock("@/lib/semanticCache", () => ({
  semanticCacheEnabled: () => semanticEnabled.on,
  lookupSemanticCache: vi.fn(async () => ({
    hit: cacheHit.text ? { text: cacheHit.text, similarity: 0.99 } : undefined,
    pending: null,
  })),
  sseLineFromCachedText: (text: string) =>
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`,
  storeSemanticCache: vi.fn(),
}));
vi.mock("@/lib/groundingCache", () => ({
  cacheKey: vi.fn(async () => "k"),
  getCached: vi.fn(async () => undefined),
  setCached: vi.fn(async () => {}),
}));

const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/auditLog", () => ({ audit }));

const { logGeneration } = vi.hoisted(() => ({ logGeneration: vi.fn() }));
vi.mock("@/lib/generationLog", () => ({ logGeneration }));

import { DbError, DbConfigError } from "@/lib/db";
// Real (unmocked) — the grounded tests assert against the shipped ceilings, so
// a change to those tables has to be a deliberate edit here too.
import { GROUNDED_DAILY_MAX, TIER_DAILY_CREDITS } from "@/lib/entitlements";
import { POST } from "./route";

// ── Helpers ────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash-lite";

function post(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return POST(
    new Request("https://insertgo.ai/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ prompt: "tighten this", model: MODEL, ...body }),
    }),
  );
}

/** One clean Gemini chunk, the shape the client parses. The usage breakdown is
 *  the shape Gemini actually sends — the cost telemetry reads the prompt and
 *  candidates counts separately, since input and output bill at different
 *  rates (4x apart on flash-lite). */
async function* oneChunk() {
  yield {
    candidates: [
      { content: { parts: [{ text: "ok" }] }, finishReason: "STOP" },
    ],
    usageMetadata: {
      promptTokenCount: 7,
      candidatesTokenCount: 5,
      totalTokenCount: 12,
    },
  } as never;
}

const charged = (over: Record<string, unknown> = {}) => ({
  outcome: "charged" as const,
  tier: "plus" as const,
  dailyMax: 50,
  dailyRemaining: 49,
  addOnCredits: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { user: { id: "usr_1" } };
  semanticEnabled.on = false;
  cacheHit.text = null;
  // Quotas allow by default; each test that cares overrides.
  consumeQuota.mockResolvedValue({
    allowed: true,
    count: 1,
    limit: 15,
    resetSeconds: 30,
  });
  debitCredit.mockResolvedValue(charged());
  streamContent.mockResolvedValue(oneChunk());
  // Grounding is off unless a test configures it — the default path under test
  // is the plain streaming one.
  resolveGroundingModel.mockReturnValue(null);
  generateGrounded.mockResolvedValue({
    findings: "web findings",
    grounding: { queries: [], chunks: [] },
  });
  logGeneration.mockResolvedValue(true);
});

// ── Gates, in order ────────────────────────────────────────────────────────

describe("request gates run before anything is charged", () => {
  it("401s without a session and never meters", async () => {
    session.value = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("keeps the 401 free of paywall words so the client logs out, not upsells", async () => {
    session.value = null;
    const body = (await (await post()).json()) as { error: { message: string } };
    expect(body.error.message.toLowerCase()).not.toMatch(
      /upgrade|credit|trial|plan/,
    );
  });

  it("400s a malformed body without charging", async () => {
    const res = await POST(
      new Request("https://insertgo.ai/api/ai/generate", {
        method: "POST",
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("400s a missing prompt or model", async () => {
    expect((await post({ prompt: "   " })).status).toBe(400);
    expect((await post({ model: "" })).status).toBe(400);
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("rejects an unlisted model — the debit is flat, so cost is not metered", async () => {
    // A premium model billed at one flat credit is the whole reason this gate
    // exists; it must fire before quota so it cannot even be probed for free.
    const res = await post({ model: "gemini-2.5-pro" });
    expect(res.status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("413s an oversize prompt before metering", async () => {
    const res = await post({ prompt: "x".repeat(100_001) });
    expect(res.status).toBe(413);
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("429s and audits a burst-quota denial without debiting a credit", async () => {
    consumeQuota.mockResolvedValueOnce({
      allowed: false,
      count: 16,
      limit: 15,
      resetSeconds: 30,
    });
    const res = await post();
    expect(res.status).toBe(429);
    expect(debitCredit).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      "ai.quota_denied",
      expect.objectContaining({ outcome: "denied" }),
    );
  });

  it("keeps the 429 free of paywall words (retry branch, not upgrade branch)", async () => {
    consumeQuota.mockResolvedValueOnce({
      allowed: false,
      count: 16,
      limit: 15,
      resetSeconds: 30,
    });
    const body = (await (await post()).json()) as { error: { message: string } };
    expect(body.error.message.toLowerCase()).not.toMatch(/upgrade|credit|trial/);
  });
});

// ── The debit and its wire contract ────────────────────────────────────────

describe("credit debit", () => {
  it("debits exactly once per request, before Gemini is called", async () => {
    await post();
    expect(debitCredit).toHaveBeenCalledOnce();
    const order = [
      debitCredit.mock.invocationCallOrder[0],
      streamContent.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it("namespaces the client key with the verified user id", async () => {
    await post({}, { "Idempotency-Key": "client-abc" });
    expect(debitCredit).toHaveBeenCalledWith("usr_1", "usr_1:client-abc");
  });

  it("mints a server key when the client sends none, so the debit still runs", async () => {
    await post();
    const [userId, key] = debitCredit.mock.calls[0] as [string, string];
    expect(userId).toBe("usr_1");
    expect(key.startsWith("usr_1:")).toBe(true);
    expect(key.length).toBeGreaterThan("usr_1:".length);
  });

  it("refuses to trust an absurdly long client key (mints one instead)", async () => {
    await post({}, { "Idempotency-Key": "z".repeat(200) });
    const [, key] = debitCredit.mock.calls[0] as [string, string];
    expect(key).not.toContain("z".repeat(200));
  });

  it("returns the exact 402 body the desktop paywall parses", async () => {
    debitCredit.mockResolvedValueOnce({
      outcome: "insufficient",
      tier: "free",
      dailyMax: 5,
    });
    const res = await post();
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      error: "insufficient_credits",
      balance: 0,
      required: 1,
      daily: 0,
      addOn: 0,
      tier: "free",
    });
    expect(streamContent).not.toHaveBeenCalled();
  });

  it("publishes post-debit balances on the success headers", async () => {
    debitCredit.mockResolvedValueOnce(
      charged({ dailyRemaining: 12, addOnCredits: 30 }),
    );
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-credits-daily")).toBe("12");
    expect(res.headers.get("x-credits-addon")).toBe("30");
    // The legacy total stays for pre-3-tier desktop builds.
    expect(res.headers.get("x-credits-remaining")).toBe("42");
  });

  it("reports 0 daily / N add-on once the daily allowance is spent", async () => {
    debitCredit.mockResolvedValueOnce(
      charged({ dailyRemaining: 0, addOnCredits: 149 }),
    );
    const res = await post();
    expect(res.headers.get("x-credits-daily")).toBe("0");
    expect(res.headers.get("x-credits-addon")).toBe("149");
    expect(res.headers.get("x-credits-remaining")).toBe("149");
  });

  it("carries the balance headers on a semantic-cache hit too", async () => {
    // A cache hit is still a served generation, so it is charged — and the
    // client must see the same post-debit numbers it would on a live stream.
    semanticEnabled.on = true;
    cacheHit.text = "cached answer";
    debitCredit.mockResolvedValueOnce(
      charged({ dailyRemaining: 7, addOnCredits: 1 }),
    );
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-credits-daily")).toBe("7");
    expect(res.headers.get("x-credits-remaining")).toBe("8");
    expect(streamContent).not.toHaveBeenCalled();
    expect(debitCredit).toHaveBeenCalledOnce();
  });
});

// ── Replay bounds ──────────────────────────────────────────────────────────

describe("replay bounds", () => {
  const replay = (over: Record<string, unknown> = {}) => ({
    outcome: "replayed" as const,
    tier: "plus" as const,
    dailyMax: 50,
    dailyRemaining: 48,
    addOnCredits: 0,
    ageSeconds: 2,
    replays: 1,
    ...over,
  });

  it("serves a fresh in-window retry uncharged, with current balances", async () => {
    debitCredit.mockResolvedValueOnce(replay());
    const res = await post({}, { "Idempotency-Key": "same-key" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-credits-daily")).toBe("48");
    expect(streamContent).toHaveBeenCalledOnce();
  });

  it("allows the full client retry budget: 1 charge + 2 replays", async () => {
    // GEMINI_MAX_ATTEMPTS is 3 in aiProviders.ts and every attempt reuses one
    // key, so MAX_REPLAYS=2 is a FLOOR — lowering it 409s honest retries.
    for (const replays of [1, 2]) {
      debitCredit.mockResolvedValueOnce(replay({ replays }));
      const res = await post({}, { "Idempotency-Key": "same-key" });
      expect(res.status).toBe(200);
    }
  });

  it("409s the replay past the bound — a replay is a free generation", async () => {
    debitCredit.mockResolvedValueOnce(replay({ replays: 3 }));
    const res = await post({}, { "Idempotency-Key": "same-key" });
    expect(res.status).toBe(409);
    expect(streamContent).not.toHaveBeenCalled();
  });

  it("409s a replay older than the 600s window even on its first reuse", async () => {
    debitCredit.mockResolvedValueOnce(replay({ ageSeconds: 601, replays: 1 }));
    expect((await post({}, { "Idempotency-Key": "old" })).status).toBe(409);
  });

  it("audits a refused replay as critical — this is metering bypass", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    debitCredit.mockResolvedValueOnce(replay({ replays: 9 }));
    await post({}, { "Idempotency-Key": "abused" });
    expect(audit).toHaveBeenCalledWith(
      "ai.replay_refused",
      expect.objectContaining({
        outcome: "denied",
        severity: "critical",
        userId: "usr_1",
      }),
    );
  });

  it("never logs the prompt when refusing a replay (SPEC §10)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    debitCredit.mockResolvedValueOnce(replay({ replays: 9 }));
    await post({ prompt: "SECRET-DRAFT-TEXT" }, { "Idempotency-Key": "k" });
    expect(warn.mock.calls.flat().join(" ")).not.toContain("SECRET-DRAFT-TEXT");
  });
});

// ── Fail closed ────────────────────────────────────────────────────────────

describe("metering failures fail closed", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("503s a transient DB failure and calls no model", async () => {
    debitCredit.mockRejectedValueOnce(new DbError("debit_credit", 0));
    const res = await post();
    expect(res.status).toBe(503);
    expect(streamContent).not.toHaveBeenCalled();
  });

  it("500s a permanent misconfiguration so clients stop retrying", async () => {
    // 404 = supabase-edge-rpc.sql was never applied. Answering 503 there made
    // every client burn its whole retry budget on a deployment gap.
    debitCredit.mockRejectedValueOnce(new DbError("debit_credit", 404));
    const res = await post();
    expect(res.status).toBe(500);
    expect(audit).toHaveBeenCalledWith(
      "db.permanent_failure",
      expect.objectContaining({ severity: "critical" }),
    );
  });

  it("500s when SUPABASE_* config is absent (no request was ever made)", async () => {
    debitCredit.mockRejectedValueOnce(new DbConfigError("missing"));
    expect((await post()).status).toBe(500);
  });

  it("503s a quota-gate failure — the session proves nothing about the DB", async () => {
    consumeQuota.mockRejectedValueOnce(new DbError("consume_quota", 500));
    const res = await post();
    expect(res.status).toBe(503);
    expect(debitCredit).not.toHaveBeenCalled();
  });

  it("audits a transient metering failure as a warning, not a page", async () => {
    debitCredit.mockRejectedValueOnce(new DbError("debit_credit", 0));
    await post();
    expect(audit).toHaveBeenCalledWith(
      "ai.metering_failure",
      expect.objectContaining({ outcome: "failure", severity: "warn" }),
    );
  });
});

// ── Response body ──────────────────────────────────────────────────────────

describe("stream contract", () => {
  it("emits SSE headers and one data frame per Gemini chunk", async () => {
    const res = await post();
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text.startsWith("data: ")).toBe(true);
    expect(JSON.parse(text.slice(6, text.indexOf("\n")))).toMatchObject({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });
  });

  it("keeps a charged credit spent when the model fails mid-stream", async () => {
    // Headers (and the debit) are already committed by then. Documented, not
    // accidental: a refund path here would need a compensating ledger write,
    // and a partially-streamed answer is still a served answer.
    vi.spyOn(console, "error").mockImplementation(() => {});
    streamContent.mockRejectedValueOnce(new Error("gemini 500"));
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-credits-remaining")).toBe("49");
    expect(await res.text()).toBe(""); // stream closes empty
  });
});

// ── Grounding cost gates ───────────────────────────────────────────────────
//
// Grounding is the most expensive call this service can make: Google bills it
// per grounded prompt ($35/1k on Gemini 2.5, $14/1k on 3.x) versus ~$0.0005 for
// a plain flash-lite generation, while the ledger charges both the same flat
// credit. These gates are what keep the daily credit allowance from being a
// licence to spend ~70x per call, so they are cost controls under test, not
// incidental plumbing.
describe("grounded runs are cost-gated", () => {
  const grounded = { grounded: true };

  beforeEach(() => {
    resolveGroundingModel.mockReturnValue("gemini-2.5-flash");
  });

  it("403s a free-tier account — the regression that made grounding free", async () => {
    // The old rule entitled anyone with `credits > 0`, which every free account
    // has by definition. Grounding 5 credits/day is ~$5.25/month against $0.
    debitCredit.mockResolvedValue(charged({ tier: "free", dailyMax: 5 }));
    const res = await post(grounded);
    expect(res.status).toBe(403);
    expect((await res.json()).error.message.toLowerCase()).toMatch(/upgrade|plan/);
    expect(generateGrounded).not.toHaveBeenCalled();
  });

  it("meters a paid grounded run against its own per-tier daily ceiling", async () => {
    debitCredit.mockResolvedValue(charged({ tier: "pro", dailyMax: 150 }));
    await post(grounded);
    expect(consumeQuota).toHaveBeenCalledWith(
      "usr_1",
      "generate:grounded:day",
      GROUNDED_DAILY_MAX.pro,
      86_400,
    );
    // The ceiling must be the grounded one, not the plain credit allowance.
    expect(GROUNDED_DAILY_MAX.pro).toBeLessThan(TIER_DAILY_CREDITS.pro);
    expect(generateGrounded).toHaveBeenCalledOnce();
  });

  it("does not consume grounded quota on a non-grounded run", async () => {
    await post();
    const actions = consumeQuota.mock.calls.map((c) => c[1]);
    expect(actions).not.toContain("generate:grounded:day");
  });

  it("429s (not 403) when the grounded allowance is spent, so no paywall shows", async () => {
    // A spent allowance clears on its own at 00:00 UTC. The desktop maps 429 to
    // "try again shortly" and 403 to the upgrade path — surfacing a paywall for
    // a window that resets would be wrong, and for Pro there is nothing to sell.
    consumeQuota.mockImplementation(async (_u: string, action: string) => ({
      allowed: action !== "generate:grounded:day",
      count: 99,
      limit: 7,
      resetSeconds: 3600,
    }));
    const res = await post(grounded);
    expect(res.status).toBe(429);
    expect(generateGrounded).not.toHaveBeenCalled();
  });

  it("fails closed when the grounded quota counter errors", async () => {
    // A DB blip must not reopen the most expensive path in the service.
    consumeQuota.mockImplementation(async (_u: string, action: string) => {
      if (action === "generate:grounded:day") throw new DbError("consume_quota", 500);
      return { allowed: true, count: 1, limit: 15, resetSeconds: 30 };
    });
    const res = await post(grounded);
    expect(res.status).toBe(503);
    expect(generateGrounded).not.toHaveBeenCalled();
  });
});

// ── Cost telemetry ─────────────────────────────────────────────────────────
//
// The margin model is built on cost-per-generation, and a credit buys a
// VARIABLE number of tokens — so without a durable per-run token record,
// margin drift is invisible until the monthly Gemini bill arrives. These
// assert the row is written with real numbers, and that writing it can never
// hurt the generation it describes.
describe("per-generation cost telemetry", () => {
  /** Drain the SSE body so the stream's `finally` (where telemetry runs) has run. */
  async function drain(res: Response) {
    await res.text();
  }

  it("records the billed token counts, tier and model", async () => {
    await drain(await post());
    expect(logGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_1",
        tier: "plus",
        model: MODEL,
        // From `oneChunk`'s usageMetadata — proof it reads real usage rather
        // than logging a placeholder.
        promptTokens: 7,
        outputTokens: 5,
        grounded: false,
        cacheHit: false,
      }),
    );
  });

  it("flags a grounded run, whose per-prompt search charge dwarfs its tokens", async () => {
    resolveGroundingModel.mockReturnValue("gemini-2.5-flash");
    debitCredit.mockResolvedValue(charged({ tier: "pro", dailyMax: 150 }));
    await drain(await post({ grounded: true }));
    expect(logGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: true, tier: "pro" }),
    );
  });

  it("records a semantic-cache hit, so the cache cannot look free", async () => {
    // Every lookup spends an embedding call whether it hits or misses, so the
    // cache only pays for itself above a hit rate this row is the only way to
    // measure. An unrecorded hit makes it look costless.
    semanticEnabled.on = true;
    cacheHit.text = "cached answer";
    await drain(await post());
    expect(logGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true, promptTokens: 0, outputTokens: 0 }),
    );
    expect(streamContent).not.toHaveBeenCalled();
  });

  it("never fails or truncates a paid generation when the telemetry write throws", async () => {
    // The user has already been charged a credit by this point. A reporting
    // gap is acceptable; a failed generation is not.
    logGeneration.mockImplementation(() => {
      throw new Error("telemetry down");
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("ok");
  });
});
