import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useMonetizationStore } from "@/store/monetizationStore";
import {
  GEMINI_MAX_ATTEMPTS,
  GEMINI_MODEL,
  GEMINI_STREAM_IDLE_MS,
  GeminiProvider,
  REFINER_SYSTEM,
  createProvider,
} from "./aiProviders";

function cfg(over: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "1",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "g-test",
    isDefault: true,
    ...over,
  };
}

/** SSE Response body: one `data:` line per payload, each its own read chunk.
 *  Non-string payloads are JSON-encoded; strings pass through verbatim. */
function sseBody(payloads: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of payloads) {
        const line = typeof p === "string" ? p : JSON.stringify(p);
        controller.enqueue(enc.encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
}

describe("GeminiProvider.send", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    sessionStorage.setItem(
      "auth_token",
      JSON.stringify({ v: "test-token", exp: Date.now() + 60 * 60 * 1000 })
    );
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function geminiCfg(over: Partial<ProviderConfig> = {}): ProviderConfig {
    return cfg(over);
  }

  /** Non-OK (or bodyless) fetch Response stand-in — error paths read json(). */
  function respond(body: unknown, status = 200) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
  }

  /** OK fetch Response stand-in with an SSE stream body. */
  function okStream(payloads: unknown[]) {
    return { ok: true, status: 200, body: sseBody(payloads) };
  }

  function textChunk(text: string) {
    return { candidates: [{ content: { role: "model", parts: [{ text }] } }] };
  }

  /** A chunk whose candidate hit the output-token ceiling mid-generation. */
  function maxTokensChunk(text: string) {
    return {
      candidates: [
        {
          content: { role: "model", parts: [{ text }] },
          finishReason: "MAX_TOKENS",
        },
      ],
    };
  }

  function finalChunk(text: string) {
    return {
      candidates: [
        { content: { role: "model", parts: [{ text }] }, finishReason: "STOP" },
      ],
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 2,
        totalTokenCount: 3,
      },
    };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    // jsdom has no __TAURI_INTERNALS__, so the provider picks global fetch.
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(useAuthStore.getState(), "refreshStatus").mockImplementation(async () => {});
    vi.spyOn(useAuthStore.getState(), "logout").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("posts to the backend proxy endpoint with the JWT in Authorization header", async () => {
    fetchMock.mockResolvedValue(okStream([finalChunk("Refined prompt")]));

    const res = await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });

    expect(res).toEqual({ text: "Refined prompt", outputTokens: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/ai/generate");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("emits deltas in order and resolves with the concatenated text", async () => {
    fetchMock.mockResolvedValue(
      okStream([textChunk("Refined"), finalChunk(" prompt")])
    );
    const onText = vi.fn();

    const res = await new GeminiProvider(geminiCfg()).send(
      { prompt: "draft" },
      { onText }
    );

    expect(res.text).toBe("Refined prompt");
    expect(onText.mock.calls).toEqual([
      ["Refined", "Refined"],
      [" prompt", "Refined prompt"],
    ]);
  });

  it("forwards the abort signal to fetch", async () => {
    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    const controller = new AbortController();
    await new GeminiProvider(geminiCfg()).send(
      { prompt: "x" },
      { signal: controller.signal }
    );
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("defaults to the refiner system message and honors overrides", async () => {
    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe(REFINER_SYSTEM);
    expect(body.prompt).toBe("draft");

    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({
      prompt: "composed skill prompt",
      system: "Follow the instructions exactly.",
    });
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.system).toBe("Follow the instructions exactly.");
  });

  it("sends the pinned model in the request body", async () => {
    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe(GEMINI_MODEL);
  });

  it("omits `grounded` unless the request opts in", async () => {
    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
      "grounded"
    );

    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({
      prompt: "draft",
      grounded: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty(
      "grounded"
    );

    fetchMock.mockResolvedValue(okStream([finalChunk("ok")]));
    await new GeminiProvider(geminiCfg()).send({
      prompt: "draft",
      grounded: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).grounded).toBe(true);
  });

  it("returns the trailing insertgo.grounding frame without polluting the text", async () => {
    const grounding = {
      queries: ["insertgo desktop"],
      chunks: [{ uri: "https://example.com/a", title: "A" }],
      searchSuggestionHtml: "<div>suggestions</div>",
    };
    const onText = vi.fn();
    fetchMock.mockResolvedValue(
      okStream([
        textChunk("grounded "),
        finalChunk("answer"),
        { insertgo: { grounding } },
      ])
    );
    const res = await new GeminiProvider(geminiCfg()).send(
      { prompt: "draft", grounded: true },
      { onText }
    );
    // The custom frame is neither a delta nor part of the deliverable.
    expect(res.text).toBe("grounded answer");
    expect(onText).toHaveBeenCalledTimes(2);
    expect(res.grounding).toEqual(grounding);
  });

  it("ignores a malformed or empty insertgo frame instead of throwing", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        "{not json",
        { insertgo: {} },
        { insertgo: { grounding: undefined } },
        finalChunk("ok"),
      ])
    );
    const res = await new GeminiProvider(geminiCfg()).send({
      prompt: "draft",
      grounded: true,
    });
    expect(res.text).toBe("ok");
    expect(res.grounding).toBeUndefined();
  });

  it("throws a clear error (without fetching) when no auth token is set", async () => {
    sessionStorage.removeItem("auth_token");
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/must be logged in/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 401/403 to an actionable session expired message", async () => {
    respond({}, 403);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/expired/);
  });

  it("maps a 400 API_KEY_INVALID body to the invalid-key message", async () => {
    respond(
      {
        error: {
          code: 400,
          status: "INVALID_ARGUMENT",
          message: "API key not valid. Please pass a valid API key.",
          details: [{ reason: "API_KEY_INVALID" }],
        },
      },
      400
    );
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/invalid API key/);
  });

  it("surfaces Google's message on a non-key 400", async () => {
    respond({ error: { message: "Invalid JSON payload received." } }, 400);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/returned 400: Invalid JSON payload received\./);
  });

  it("maps 429 to a rate-limit message", async () => {
    respond({}, 429);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/rate limited/);
  });

  it("reports other statuses, and never retries a 500", async () => {
    respond({}, 500);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/returned 500/);
    // The relay reserves 500 for permanent faults (misconfigured server, RPC
    // functions not deployed). Retrying only delays the report.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 503 and streams from the next attempt", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(okStream([finalChunk("Refined prompt")]));

    const promise = new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    // Worst-case jittered backoff before attempt 2 is 1s * 1.25.
    await vi.advanceTimersByTimeAsync(1_250);

    await expect(promise).resolves.toEqual({
      text: "Refined prompt",
      outputTokens: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends one Idempotency-Key and reuses it verbatim across retries", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(okStream([finalChunk("Refined prompt")]));

    const promise = new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    await vi.advanceTimersByTimeAsync(1_250);
    await promise;

    const keys = fetchMock.mock.calls.map(
      ([, init]) => init.headers["Idempotency-Key"]
    );
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]); // same charge, not a second one

    // A fresh send() is a new logical operation → a new key.
    fetchMock.mockResolvedValueOnce(okStream([finalChunk("again")]));
    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    expect(fetchMock.mock.calls[2][1].headers["Idempotency-Key"]).not.toBe(
      keys[0]
    );
  });

  it("maps 402 to an out-of-credits error, mirrors the balance, refreshes status, and opens the upgrade modal", async () => {
    useMonetizationStore.setState({ upgradeReason: null });
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@t.dev",
        subscriptionStatus: "trial",
        credits: 5,
      },
    });
    respond({ error: "insufficient_credits", balance: 0, required: 1 }, 402);

    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/out of credits/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never retried
    expect(useAuthStore.getState().user?.credits).toBe(0);
    expect(useAuthStore.getState().refreshStatus).toHaveBeenCalled();
    expect(useMonetizationStore.getState().upgradeReason).toBe("credits");
    useMonetizationStore.setState({ upgradeReason: null });
  });

  it("applies the daily/add-on breakdown from a 402 body when present", async () => {
    useMonetizationStore.setState({ upgradeReason: null });
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@t.dev",
        subscriptionStatus: "trial",
        credits: 5,
        tier: "free",
        dailyCreditsRemaining: 2,
        dailyCreditsMax: 5,
        addOnCredits: 3,
      },
    });
    respond(
      { error: "insufficient_credits", balance: 0, required: 1, daily: 0, addOn: 0 },
      402
    );

    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/out of credits/);
    const user = useAuthStore.getState().user;
    expect(user?.dailyCreditsRemaining).toBe(0);
    expect(user?.addOnCredits).toBe(0);
    expect(user?.credits).toBe(0);
    useMonetizationStore.setState({ upgradeReason: null });
  });

  it("syncs the credit balance from the x-credits-remaining response header", async () => {
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@t.dev",
        subscriptionStatus: "trial",
        credits: 50,
      },
    });
    fetchMock.mockResolvedValue({
      ...okStream([finalChunk("Refined prompt")]),
      headers: { get: (k: string) => (k === "x-credits-remaining" ? "49" : null) },
    });

    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });

    expect(useAuthStore.getState().user?.credits).toBe(49);
  });

  it("prefers the x-credits-daily/x-credits-addon breakdown headers when present", async () => {
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@t.dev",
        subscriptionStatus: "trial",
        credits: 50,
        tier: "plus",
        dailyCreditsRemaining: 50,
        dailyCreditsMax: 50,
        addOnCredits: 7,
      },
    });
    const headers: Record<string, string> = {
      "x-credits-remaining": "56",
      "x-credits-daily": "49",
      "x-credits-addon": "7",
    };
    fetchMock.mockResolvedValue({
      ...okStream([finalChunk("Refined prompt")]),
      headers: { get: (k: string) => headers[k] ?? null },
    });

    await new GeminiProvider(geminiCfg()).send({ prompt: "draft" });

    const user = useAuthStore.getState().user;
    expect(user?.dailyCreditsRemaining).toBe(49);
    expect(user?.addOnCredits).toBe(7);
    expect(user?.credits).toBe(56); // legacy total stays in step
  });

  it("throws an actionable overloaded message after exhausting 503 retries", async () => {
    vi.useFakeTimers();
    respond(
      { error: { message: "The model is overloaded. Please try again later." } },
      503
    );

    const promise = new GeminiProvider(geminiCfg()).send({ prompt: "x" });
    // Attach the rejection handler before advancing so the rejection that
    // fires mid-advance is never unhandled.
    const outcome = expect(promise).rejects.toThrow(
      /temporarily overloaded.*retry in a minute/
    );
    // Worst-case jittered backoffs: 1s * 1.25 + 2s * 1.25.
    await vi.advanceTimersByTimeAsync(3_750);

    await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_MAX_ATTEMPTS);
  });

  it("does not retry non-transient statuses", async () => {
    respond({}, 403);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/expired/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    respond({ error: "Trial expired. Please upgrade." }, 403);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/Trial expired/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    respond({ error: { message: "Invalid JSON payload received." } }, 400);
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/returned 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the model declines (safety block), before emitting that chunk's text", async () => {
    const onText = vi.fn();
    fetchMock.mockResolvedValue(
      okStream([
        textChunk("partial"),
        {
          candidates: [
            { content: { parts: [{ text: "never shown" }] }, finishReason: "SAFETY" },
          ],
        },
      ])
    );
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" }, { onText })
    ).rejects.toThrow(/declined/);
    // The blocked chunk's own text never reached the UI.
    expect(onText.mock.calls).toEqual([["partial", "partial"]]);

    fetchMock.mockResolvedValue(
      okStream([{ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }])
    );
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/declined/);
  });

  it("throws on MAX_TOKENS truncation, before emitting that chunk's text", async () => {
    const onText = vi.fn();
    fetchMock.mockResolvedValue(
      okStream([textChunk("partial"), maxTokensChunk("cut-off tail")])
    );
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" }, { onText })
    ).rejects.toThrow(/cut off/);
    // The truncated chunk's own delta never reached the UI.
    expect(onText.mock.calls).toEqual([["partial", "partial"]]);
  });

  it("throws on other non-STOP terminal reasons (e.g. RECITATION)", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        {
          candidates: [
            {
              content: { parts: [{ text: "quoted" }] },
              finishReason: "RECITATION",
            },
          ],
        },
      ])
    );
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/stopped early \(RECITATION\)/);
  });

  it("throws when no text is returned", async () => {
    fetchMock.mockResolvedValue(okStream([{ candidates: [] }]));
    await expect(
      new GeminiProvider(geminiCfg()).send({ prompt: "x" })
    ).rejects.toThrow(/no text/);
  });

  it("retries a transient network rejection and streams from the next attempt", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okStream([finalChunk("Refined prompt")]));

    const promise = new GeminiProvider(geminiCfg()).send({ prompt: "draft" });
    // Worst-case jittered backoff before attempt 2 is 1s * 1.25.
    await vi.advanceTimersByTimeAsync(1_250);

    await expect(promise).resolves.toEqual({
      text: "Refined prompt",
      outputTokens: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws an actionable network error after exhausting retries on repeated rejection", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const promise = new GeminiProvider(geminiCfg()).send({ prompt: "x" });
    const outcome = expect(promise).rejects.toThrow(
      /network error reaching Gemini.*check your connection/
    );
    // Worst-case jittered backoffs: 1s * 1.25 + 2s * 1.25.
    await vi.advanceTimersByTimeAsync(3_750);

    await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_MAX_ATTEMPTS);
  });

  it("does not retry a fetch rejection once the caller has aborted", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    await expect(
      new GeminiProvider(geminiCfg()).send(
        { prompt: "x" },
        { signal: controller.signal }
      )
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a completed <final> artifact even when the run then hits MAX_TOKENS", async () => {
    const onText = vi.fn();
    const done = "<analysis>ok</analysis>\n<final>\nDeliverable.\n</final>";
    fetchMock.mockResolvedValue(
      okStream([textChunk(done), maxTokensChunk("\noverran chatter")])
    );

    const res = await new GeminiProvider(geminiCfg()).send(
      { prompt: "x" },
      { onText }
    );

    // The artifact closed before the cap, so the run succeeds with it intact…
    expect(res.text).toBe(done);
    // …and the post-</final> truncated tail was dropped, never streamed.
    expect(onText.mock.calls).toEqual([[done, done]]);
  });

  it("maps a stalled stream to a retryable error after the idle timeout", async () => {
    vi.useFakeTimers();
    const enc = new TextEncoder();
    const stalling = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify(textChunk("hi"))}\n\n`)
        );
        // never close, never enqueue again → the next read hangs
      },
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: stalling });
    const onText = vi.fn();

    const promise = new GeminiProvider(geminiCfg()).send(
      { prompt: "x" },
      { onText }
    );
    const outcome = expect(promise).rejects.toThrow(/stalled.*please retry/);
    await vi.advanceTimersByTimeAsync(GEMINI_STREAM_IDLE_MS + 100);

    await outcome;
    // The one delta that did arrive was delivered before the stall.
    expect(onText).toHaveBeenCalledWith("hi", "hi");
  });
});

describe("createProvider", () => {
  it("returns GeminiProvider when the host is generativelanguage.googleapis.com", () => {
    expect(
      createProvider(
        cfg({ baseUrl: "https://generativelanguage.googleapis.com" })
      )
    ).toBeInstanceOf(GeminiProvider);
  });

  it("throws an actionable error for any non-Gemini host", () => {
    expect(() =>
      createProvider(cfg({ baseUrl: "https://example.com/api" }))
    ).toThrow(/only Gemini/);
    expect(() =>
      createProvider(cfg({ baseUrl: "https://api.anthropic.com" }))
    ).toThrow(/only Gemini/);
  });
});
