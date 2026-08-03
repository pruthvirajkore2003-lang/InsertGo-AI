/**
 * Size-capped request-body reader.
 *
 * `req.text()` / `req.json()` buffer the WHOLE body into memory before any
 * size check — so a chunked request with no `Content-Length` (or a lying one)
 * defeats a header pre-check and can exhaust memory. This reads the stream and
 * aborts the moment the accumulated bytes cross `maxBytes`, so an oversize
 * body is never fully buffered. Used by the unauthenticated webhook receiver
 * and the generate proxy (SPEC §10 — bound the read at the trust boundary).
 */

/** Thrown when the body exceeds `maxBytes`. Callers map it to HTTP 413. */
export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large.");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Read the request body as a UTF-8 string, rejecting with `BodyTooLargeError`
 * as soon as it exceeds `maxBytes`. A declared `Content-Length` over the cap
 * is refused up front; the streaming guard covers the chunked / spoofed case.
 */
export async function readBodyCapped(
  req: Request,
  maxBytes: number,
): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyTooLargeError();
  }

  // TextEncoder/TextDecoder rather than Buffer: this runs on the Edge runtime
  // too (app/api/ai/generate), where `Buffer` is only a bundled polyfill.
  const body = req.body;
  if (!body) {
    // No stream (empty or already-materialized body): read once, still bound.
    const text = await req.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new BodyTooLargeError();
    }
    return text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  // `stream: false` is the default; a lone trailing multi-byte sequence that
  // was split across chunks is already whole here, since we concatenate first.
  return new TextDecoder("utf-8").decode(joined);
}
