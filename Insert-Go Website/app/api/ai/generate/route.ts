/**
 * POST /api/ai/generate — the desktop client's single generation lane.
 *
 * The Tauri client holds no LLM key; it proxies every refine/skill/improve
 * call here with `{ prompt, system, model, grounded? }` and reads back an SSE
 * stream of raw Gemini `GenerateContentResponse` chunks (one per `data:` line).
 * This route is where auth/entitlement gating and the server-held Gemini key
 * live (SPEC §10).
 *
 * Runtime: Edge. Holding tens of thousands of concurrent SSE streams open is
 * the whole job of this route, and the Edge runtime is built for exactly that
 * shape of work — many long-lived, nearly idle connections, no per-stream Node
 * process. Everything it touches had to become socket-free to get here:
 *  - the session comes from Better Auth over HTTP (lib/edgeSession.ts) instead
 *    of its `pg`-backed adapter;
 *  - metering runs through PostgREST RPC (lib/db.ts, lib/usageLimit.ts), so
 *    this route holds ZERO Postgres connections no matter how many streams are
 *    open;
 *  - both caches are Upstash-hosted (lib/groundingCache.ts,
 *    lib/semanticCache.ts), so they are shared across instances instead of
 *    per-instance — the difference between a cache and a rounding error once
 *    requests are spread over thousands of instances;
 *  - Gemini is the SDK's `fetch`-only web build (lib/gemini.ts).
 *
 * Two modes:
 *  - `grounded` falsy → single-pass streaming proxy (the pre-existing contract,
 *    byte-for-byte: Gemini chunks only, no trailing frame).
 *  - `grounded: true` → opt-in two-pass pipeline (lib/gemini.ts): pass 1 runs
 *    Google Search grounding on a distilled topic (cached 24h) and pass 2 is
 *    the normal streamed rewrite with the pass-1 findings injected inside a
 *    `<research>` data boundary and a `RESEARCH_CLAUSE` appended to the system
 *    prompt. After the stream, one custom `insertgo.grounding` frame carries
 *    the citations so the rewritten-prompt text stays pristine.
 *
 * Billing: trial users pay 1 credit per generation. The client's
 * Idempotency-Key header keys a "creditLedger" row so network retries never
 * double-charge; the post-debit balance rides back on `x-credits-remaining`,
 * and an exhausted balance returns 402 `{ error: "insufficient_credits" }`.
 * That header is untrusted input on a globally-keyed table, so it is namespaced
 * with the verified user id AND its replays are counted — a replay serves a
 * fresh generation without debiting, so an unbounded one is a metering bypass,
 * not an idempotency guarantee.
 *
 * Privacy (SPEC §10): prompt/response bodies are never logged — only token
 * counts, once per run.
 */
import {
  requireGroundingEntitlement,
  requirePayloadWithinLimit,
  requireSession,
  requireWithinQuota,
  type Denied,
} from "@/lib/entitlements";
import { getEdgeSession, type EdgeSession } from "@/lib/edgeSession";
import { consumeQuota, debitCredit } from "@/lib/usageLimit";
import { isPermanentDbFailure } from "@/lib/db";
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import {
  RESEARCH_CLAUSE,
  composeResearchTopic,
  generateGrounded,
  resolveGroundingModel,
  sseLineFromChunk,
  sseLineFromGrounding,
  streamContent,
  wrapWithResearch,
  type GroundingResult,
} from "@/lib/gemini";
import { cacheKey, getCached, setCached } from "@/lib/groundingCache";
import {
  lookupSemanticCache,
  semanticCacheEnabled,
  sseLineFromCachedText,
  storeSemanticCache,
  type PendingEmbedding,
} from "@/lib/semanticCache";

// Every dependency above is `fetch`-only (no `pg`, no `node:*`), so this route
// scales out horizontally without a Node process per stream.
export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Hard ceiling on the raw request body, checked before it is buffered. */
const MAX_BODY_BYTES = 1_048_576; // 1 MiB

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

/** Error body in the exact shape the client's `readGeminiError` parses
 *  (`body.error.message`). */
function errorResponse(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

function denied(d: Denied): Response {
  return errorResponse(d.status, d.message);
}

/**
 * Metering failed, so the request fails closed — but the STATUS has to tell the
 * client whether retrying is worth anything. A missing SUPABASE_* config or an
 * unapplied supabase-edge-rpc.sql is permanent: answering 503 there made every
 * client burn its full retry budget on a fault no retry can clear, and made the
 * desktop report "the service is overloaded" for what was a deployment gap.
 * Only genuinely transient failures (timeout, network, PostgREST 5xx) get 503.
 *
 * Privacy (SPEC §10): the error message only — never prompt/response bodies.
 */
function meteringFailure(stage: string, e: unknown): Response {
  console.error(
    `[ai/generate] ${stage} failed:`,
    e instanceof Error ? e.message : String(e)
  );
  return isPermanentDbFailure(e)
    ? errorResponse(
        500,
        "The generation service is misconfigured on our side — this is not " +
          "your account, and retrying won't help. Please contact support."
      )
    : errorResponse(503, "Service temporarily unavailable — please retry.");
}

export async function POST(req: Request): Promise<Response> {
  // 1. Authenticate. Better Auth remains the authority — this just reaches it
  //    over HTTP because its `pg` adapter can't run on the Edge runtime. As
  //    before, any failure resolves to "no session" and returns 401.
  const session: EdgeSession = await getEdgeSession(req);
  const denySession = requireSession(session);
  if (denySession) return denied(denySession);

  // 2. Parse + validate the request body.
  //    readBodyCapped streams the body and aborts the moment it crosses
  //    MAX_BODY_BYTES, so an oversize body is never fully buffered — this holds
  //    even for a chunked request with no (or a spoofed) Content-Length, which
  //    a header-only pre-check plus `req.json()` would let through. Sizing:
  //    MAX_PROMPT_CHARS + MAX_SYSTEM_CHARS is 120k chars, ≤ 480 KB worst-case
  //    UTF-8, so 1 MiB leaves room for multi-byte text and JSON escaping.
  let body: unknown;
  try {
    body = JSON.parse(await readBodyCapped(req, MAX_BODY_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return errorResponse(413, "Request body is too large.");
    }
    return errorResponse(400, "Invalid JSON body.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  const system = typeof b.system === "string" ? b.system : "";
  const model = typeof b.model === "string" ? b.model : "";
  const grounded = b.grounded === true;
  if (!prompt.trim() || !model.trim()) {
    return errorResponse(400, "prompt and model are required.");
  }
  const denySize = requirePayloadWithinLimit({ prompt, system });
  if (denySize) return denied(denySize);

  // 3. Meter per user BEFORE any Gemini call so one account can't drain the
  //    shared server key. Two windows off one table: a per-minute burst cap
  //    (stops hammering) and a daily quota (bounds total key spend). Enforced
  //    server-side against the verified session user id, so it can't be bypassed
  //    by calling the API directly or spoofing another user's counter. Runs
  //    after body validation so malformed requests don't consume quota.
  const userId = session!.user!.id!; // narrowed: requireSession rejected missing id
  const BURST_MAX = Number(process.env.GEN_BURST_MAX ?? 15); // per minute
  const DAILY_MAX = Number(process.env.GEN_DAILY_MAX ?? 200); // per day
  try {
    const burst = await consumeQuota(userId, "generate:burst", BURST_MAX, 60);
    const denyBurst = requireWithinQuota(burst);
    if (denyBurst) return denied(denyBurst);
    const daily = await consumeQuota(userId, "generate:day", DAILY_MAX, 86_400);
    const denyDaily = requireWithinQuota(daily);
    if (denyDaily) return denied(denyDaily);
  } catch (e) {
    // Fail closed: a DB blip must not reopen the unmetered hole. NOTE the
    // session lookup does NOT prove the DB is reachable from here — it goes to
    // Better Auth over HTTP (lib/edgeSession.ts), while this path is PostgREST.
    // A server missing SUPABASE_* therefore authenticates fine and dies here.
    return meteringFailure("quota gate", e);
  }

  // 3.5 Debit one credit BEFORE any Gemini call (cache hits included — a
  //     served generation is a served generation). `debitCredit` is one
  //     atomic statement (`debit_credit`, supabase-edge-rpc.sql): the
  //     Idempotency-Key claims a "creditLedger" row and the debit rides the
  //     same transaction, so concurrent requests can't double-spend and a retry
  //     replaying the key is served without a second charge. Deduction order:
  //     daily allowance first (resets 00:00 UTC), then non-expiring add-on
  //     credits; 402 only when both are gone.
  const REPLAY_WINDOW_SECS = 600; // legit client retries land within seconds
  // Coupled to the desktop client: GEMINI_MAX_ATTEMPTS is 3 (aiProviders.ts) and
  // every attempt reuses one key, so a fully unlucky legitimate request charges
  // once and replays twice. 2 is therefore the FLOOR, not a round number —
  // lowering it 409s real retries.
  const MAX_REPLAYS = Number(process.env.GEN_MAX_REPLAYS ?? 2);
  const rawKey = req.headers.get("idempotency-key")?.trim() ?? "";
  // Trust boundary: accept a sane client key, otherwise mint one server-side
  // (the debit is still enforced; the client just loses retry replay).
  const clientKey =
    rawKey.length > 0 && rawKey.length <= 128 ? rawKey : crypto.randomUUID();
  // Namespace it to the VERIFIED user before it reaches SQL. "creditLedger"'s
  // primary key is the key alone, so a raw client value lets any caller claim a
  // key another account is using — and a claimed key replays into uncharged
  // generations below.
  const idempotencyKey = `${userId}:${clientKey}`;
  let dailyLeft: number;
  let addOnLeft: number;
  try {
    const debit = await debitCredit(userId, idempotencyKey);
    if (debit.outcome === "insufficient") {
      // Exact shape the client's 402 handler parses (`body.balance`; newer
      // clients also read the daily/addOn breakdown).
      return Response.json(
        {
          error: "insufficient_credits",
          balance: 0,
          required: 1,
          daily: 0,
          addOn: 0,
          tier: debit.tier,
        },
        { status: 402 }
      );
    }
    if (
      debit.outcome === "replayed" &&
      (debit.ageSeconds > REPLAY_WINDOW_SECS || debit.replays > MAX_REPLAYS)
    ) {
      // A replay is served UNCHARGED (that is what makes a timed-out client's
      // retry whole), so both bounds are load-bearing: age alone left one
      // charged key streaming unlimited generations for ten minutes — the
      // whole daily quota on a single credit. A real client retries once.
      // Log it: a burst of these is what metering bypass looks like (F-10).
      console.warn(
        `[ai/generate] replay refused user=${userId} replays=${debit.replays} age=${debit.ageSeconds}s`
      );
      return errorResponse(409, "Duplicate request.");
    }
    dailyLeft = debit.dailyRemaining;
    addOnLeft = debit.addOnCredits;
  } catch (e) {
    // Fail closed, same as the quota gate above. Nothing was charged.
    return meteringFailure("credit debit", e);
  }
  const responseHeaders = {
    ...SSE_HEADERS,
    // Post-debit balances so the client's authStore stays in step. The
    // legacy total header stays for pre-3-tier desktop builds.
    "x-credits-remaining": String(dailyLeft + addOnLeft),
    "x-credits-daily": String(dailyLeft),
    "x-credits-addon": String(addOnLeft),
  } as const;

  // 4. Semantic cache (non-grounded only — grounded runs are time-sensitive
  //    and already cache their research pass). A near-duplicate of an answered
  //    prompt (same model + system, cosine ≥ SEMCACHE_MIN_SIMILARITY) is served
  //    as one immediately-flushed SSE frame in the exact chunk shape the client
  //    parses — Gemini is never called. Shared across instances (Upstash
  //    Vector) but partitioned PER USER: the stored text restates the draft it
  //    came from, so a namespace without the caller's id serves one account's
  //    content to another. The
  //    lookup is internally bounded by SEMCACHE_LOOKUP_TIMEOUT_MS, so a slow
  //    embed or index degrades to a miss instead of delaying generation, and
  //    the pending embedding is kept to store the miss's result after the
  //    stream (no second embed call). Runs AFTER metering on purpose: lookups
  //    spend embedding tokens, so the burst cap must still bound them.
  //    Fail-open: any cache error just means a miss.
  let cachePending: PendingEmbedding | null = null;
  if (!grounded && semanticCacheEnabled()) {
    try {
      const cached = await lookupSemanticCache({
        model,
        system,
        prompt,
        userId,
      });
      cachePending = cached.pending;
      if (cached.hit) {
        // Similarity + token counts only — never bodies (SPEC §10).
        console.debug(
          `[ai/generate] semantic-cache hit sim=${cached.hit.similarity.toFixed(4)}`
        );
        return new Response(sseLineFromCachedText(cached.hit.text), {
          headers: responseHeaders,
        });
      }
    } catch {
      cachePending = null;
    }
  }

  // 5. Grounded path: gate entitlement, then run pass 1 (cached) BEFORE
  //    streaming so a failure here can still return a JSON error status.
  let genPrompt = prompt;
  let genSystem = system;
  let grounding: GroundingResult | undefined;
  if (grounded) {
    const groundingModel = resolveGroundingModel(model);
    const deny = requireGroundingEntitlement(session, {
      groundingConfigured: groundingModel !== null,
    });
    if (deny) return denied(deny);

    try {
      const topic = composeResearchTopic(prompt);
      // Cache reads/writes are fail-open (they swallow their own errors), so
      // only a genuine pass-1 failure can reach the 502 below.
      const key = await cacheKey(groundingModel as string, topic);
      let pass1 = await getCached<{
        findings: string;
        grounding: GroundingResult;
      }>(key);
      if (!pass1) {
        pass1 = await generateGrounded(topic, groundingModel as string);
        await setCached(key, pass1);
      }
      grounding = pass1.grounding;
      // Injection isolation (OWASP LLM01): untrusted web findings go into the
      // user prompt inside <research>, and the system prompt only gains the
      // additive RESEARCH_CLAUSE — the existing REFINER/SKILL/REFINE boundaries
      // are never edited.
      genPrompt = wrapWithResearch(prompt, pass1.findings);
      genSystem = system + RESEARCH_CLAUSE;
    } catch (e) {
      // Log the CAUSE, never the topic/prompt (SPEC §10): pass 1 can fail for
      // an unavailable model, a key without Search grounding, a quota hit, or
      // a network blip, and a bare 502 makes all four indistinguishable.
      console.error(
        `[ai/generate] grounding pass 1 failed (model=${groundingModel}): ` +
          (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(
            0,
            500
          )
      );
      return errorResponse(502, "Web research step failed — please retry.");
    }
  }

  // 6. Stream pass 2 (or the sole non-grounded pass) as Gemini SSE chunks,
  //    then, for grounded runs, one trailing citation frame.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Token counts only — never prompt/response bodies (SPEC §10).
      let usage:
        | {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          }
        | undefined;
      // Accumulate the stream for the semantic cache. Only a clean run is
      // cacheable: a safety block or any non-STOP finish (MAX_TOKENS,
      // RECITATION, …) is not a deliverable and must never be replayed.
      let cacheText = "";
      let cacheable = cachePending !== null;
      try {
        const gen = await streamContent({
          prompt: genPrompt,
          system: genSystem,
          model,
        });
        for await (const chunk of gen) {
          if (chunk.usageMetadata) usage = chunk.usageMetadata;
          if (cacheable) {
            const candidate = chunk.candidates?.[0];
            const finish = candidate?.finishReason;
            if (
              chunk.promptFeedback?.blockReason ||
              (finish && finish !== "STOP")
            ) {
              cacheable = false;
              cacheText = "";
            } else {
              cacheText += (candidate?.content?.parts ?? [])
                .map((part) => part.text ?? "")
                .join("");
            }
          }
          controller.enqueue(encoder.encode(sseLineFromChunk(chunk)));
        }
        if (grounding) {
          controller.enqueue(encoder.encode(sseLineFromGrounding(grounding)));
        }
        if (cacheable && cacheText && cachePending) {
          // Fire-and-forget (not awaited): caching must never delay the
          // stream's close or fail the request. A mid-stream error above
          // skips this line entirely, so partial output is never cached.
          storeSemanticCache(cachePending, cacheText);
        }
      } catch (e) {
        // Headers are already sent, so the status can't change. End the stream;
        // the client surfaces "returned no text" for an empty result. Error
        // message only — never prompt/response bodies (SPEC §10).
        console.error(
          "[ai/generate] stream error:",
          e instanceof Error ? e.message : String(e)
        );
      } finally {
        if (usage) {
          console.debug(
            `[ai/generate] usage: prompt=${usage.promptTokenCount ?? 0}` +
              ` output=${usage.candidatesTokenCount ?? 0}` +
              ` total=${usage.totalTokenCount ?? 0}` +
              (grounded ? " grounded=1" : "")
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
