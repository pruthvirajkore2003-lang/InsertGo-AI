import { afterEach, describe, expect, it, vi } from "vitest";
import { readSseStream, SseIdleTimeoutError } from "./sse";

/** Byte stream from pre-encoded chunks (lets tests split multi-byte chars). */
function byteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

/** Byte stream where each string becomes one network chunk. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return byteStream(chunks.map((c) => enc.encode(c)));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const payloads: string[] = [];
  await readSseStream(stream, (p) => payloads.push(p));
  return payloads;
}

describe("readSseStream", () => {
  afterEach(() => vi.useRealTimers());

  it("emits each data line from a multi-line chunk, skipping blank separators", async () => {
    const payloads = await collect(
      streamOf('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c":3}\n\n')
    );
    expect(payloads).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it("buffers a data line split across reads", async () => {
    const payloads = await collect(
      streamOf('data: {"text":"Hel', 'lo world"}\n\n')
    );
    expect(payloads).toEqual(['{"text":"Hello world"}']);
  });

  it("keeps a multi-byte UTF-8 character split across chunk boundaries intact", async () => {
    const bytes = new TextEncoder().encode("data: héllo\n");
    // Split inside the two-byte é sequence.
    const cut = 8;
    const payloads: string[] = [];
    await readSseStream(
      byteStream([bytes.slice(0, cut), bytes.slice(cut)]),
      (p) => payloads.push(p)
    );
    expect(payloads).toEqual(["héllo"]);
  });

  it("skips comment keep-alives and non-data fields", async () => {
    const payloads = await collect(
      streamOf(": keep-alive\n\nevent: ping\ndata: one\n\n: another comment\ndata: two\n\n")
    );
    expect(payloads).toEqual(["one", "two"]);
  });

  it("strips at most one leading space and handles no-space data lines", async () => {
    const payloads = await collect(
      streamOf("data:[DONE]\ndata: [DONE]\ndata:  padded\n")
    );
    // Two spaces: only the first is field-syntax, the second is payload.
    expect(payloads).toEqual(["[DONE]", "[DONE]", " padded"]);
  });

  it("parses CRLF line endings identically to LF", async () => {
    const payloads = await collect(
      streamOf('data: {"a":1}\r\n\r\ndata: {"b":2}\r\n\r\n')
    );
    expect(payloads).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("flushes a trailing unterminated data line at stream end", async () => {
    const payloads = await collect(streamOf("data: first\n", "data: tail-no-newline"));
    expect(payloads).toEqual(["first", "tail-no-newline"]);
  });

  it("completes normally with idleMs set when the stream keeps flowing", async () => {
    // The idle guard must be invisible on a live stream — no false timeout.
    const payloads: string[] = [];
    await readSseStream(
      streamOf("data: a\n\ndata: b\n\n"),
      (p) => payloads.push(p),
      { idleMs: 1000 }
    );
    expect(payloads).toEqual(["a", "b"]);
  });

  it("rejects with SseIdleTimeoutError when a chunk stalls past idleMs", async () => {
    vi.useFakeTimers();
    const enc = new TextEncoder();
    // One chunk, then the stream goes silent forever (never closed).
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode("data: one\n"));
      },
    });

    const seen: string[] = [];
    const promise = readSseStream(stream, (p) => seen.push(p), { idleMs: 1000 });
    // Attach the rejection assertion before advancing so it is never unhandled.
    const outcome = expect(promise).rejects.toBeInstanceOf(SseIdleTimeoutError);
    await vi.advanceTimersByTimeAsync(1_100);

    await outcome;
    // The one chunk that did arrive was still delivered before the stall.
    expect(seen).toEqual(["one"]);
  });

  it("propagates an onData throw and cancels the source stream", async () => {
    const cancelled = vi.fn();
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode("data: boom\ndata: never-seen\n"));
      },
      cancel: cancelled,
    });

    const seen: string[] = [];
    await expect(
      readSseStream(stream, (p) => {
        seen.push(p);
        throw new Error("consumer rejected chunk");
      })
    ).rejects.toThrow("consumer rejected chunk");

    expect(seen).toEqual(["boom"]);
    expect(cancelled).toHaveBeenCalled();
  });
});
