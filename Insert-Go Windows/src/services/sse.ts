/**
 * Minimal SSE line reader for streaming provider responses (SPEC §11 —
 * perceived latency = time-to-first-token, not time-to-last-token).
 *
 * Deliberately a dumb `data:` line parser, not an EventSource implementation:
 * the streaming API this app consumes (Gemini `:streamGenerateContent?alt=sse`)
 * only ever carries payloads on `data:` lines, so `event:`/`id:`
 * dispatch would be dead code. Callers `JSON.parse` payloads themselves inside
 * try/catch and skip malformed ones.
 *
 * Sibling to `skills.ts` in style: pure, framework-free, no imports, and
 * indexOf/slice string walking only — no eval, no regexes (ReDoS-safe by
 * construction). Buffered text is bounded by the providers' `max_tokens`
 * budgets, so unbounded-growth concerns don't apply.
 */

/**
 * Thrown by `readSseStream` when no chunk arrives for `idleMs` — a stalled
 * connection (socket open, no bytes, no close) that would otherwise park
 * `reader.read()` forever and hang the caller. It bounds the gap *between*
 * chunks, not the total stream duration (the timer resets on every read), so
 * a long-but-live response never trips it. Callers map it to a retryable
 * "stream stalled" error rather than surfacing raw plumbing.
 */
export class SseIdleTimeoutError extends Error {
  constructor(idleMs: number) {
    super(`SSE stream idle for ${idleMs}ms`);
    this.name = "SseIdleTimeoutError";
  }
}

export type ReadSseOptions = {
  /**
   * Abort the read when no chunk arrives within this many ms (falsy/≤0 = no
   * idle guard, the pre-existing behavior). Reset on every chunk, so it caps
   * the silence between bytes — including the wait for the first token.
   */
  idleMs?: number;
};

/**
 * Read a byte stream as SSE, invoking `onData` with each `data:` line's
 * payload (one leading space stripped, per the SSE spec).
 *
 * - Partial lines are buffered across chunk boundaries; a streaming
 *   TextDecoder keeps multi-byte UTF-8 sequences split across chunks intact.
 * - Blank lines (event separators) and `:`-prefixed keep-alive comments are
 *   skipped; CRLF line endings parse identically to LF.
 * - A trailing unterminated line is flushed at stream end.
 * - With `opts.idleMs`, a stall longer than that between chunks rejects with
 *   `SseIdleTimeoutError` (and cancels the source), so a dead connection can
 *   never hang the loop indefinitely.
 * - An `onData` throw (or an idle timeout) propagates to the caller; the
 *   source stream is cancelled so the transport doesn't idle until GC (on
 *   normal completion the cancel is a no-op on an already-closed stream).
 */
export async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  onData: (payload: string) => void,
  opts: ReadSseOptions = {}
): Promise<void> {
  return readLineStream(
    stream,
    (rawLine) => {
      // CRLF wire format: the \n split leaves a trailing \r — drop it.
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (line === "" || line.startsWith(":")) return;
      if (!line.startsWith("data:")) return;
      const afterField = line.slice("data:".length);
      onData(afterField.startsWith(" ") ? afterField.slice(1) : afterField);
    },
    opts
  );
}

/**
 * Read a byte stream as NDJSON-style lines (Ollama's streaming format),
 * invoking `onLine` with each non-empty line. Same buffering, idle-timeout,
 * and cancellation semantics as `readSseStream` — they share the line loop.
 */
export async function readNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
  opts: ReadSseOptions = {}
): Promise<void> {
  return readLineStream(
    stream,
    (rawLine) => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (line.trim() === "") return;
      onLine(line);
    },
    opts
  );
}

/** Shared line-splitting read loop behind both wire formats. */
async function readLineStream(
  stream: ReadableStream<Uint8Array>,
  emitLine: (rawLine: string) => void,
  opts: ReadSseOptions = {}
): Promise<void> {
  const { idleMs } = opts;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Race each read against a fresh idle timer (when idleMs is set). A won race
  // clears the timer; a lost race rejects, unwinding to the `finally` that
  // cancels the reader — so the dangling read() settles instead of leaking.
  const readChunk = (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (!idleMs || idleMs <= 0) return reader.read();
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SseIdleTimeoutError(idleMs)), idleMs);
    });
    return Promise.race([reader.read(), timeout]).finally(() =>
      clearTimeout(timer)
    );
  };

  try {
    for (;;) {
      const { done, value } = await readChunk();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        emitLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode(); // flush a trailing multi-byte sequence
    if (buffer) emitLine(buffer);
  } finally {
    void reader.cancel().catch(() => {});
  }
}
