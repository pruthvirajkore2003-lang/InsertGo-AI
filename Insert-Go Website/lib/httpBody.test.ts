import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readBodyCapped } from "./httpBody";

/** Request whose body is a chunked stream carrying NO Content-Length — the
 *  case a header pre-check can't see. `duplex` is required for a stream body. */
function streamedRequest(chunks: string[]): Request {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Request("https://x/api", {
    method: "POST",
    body: stream,
    // @ts-expect-error - undici requires duplex for a stream body
    duplex: "half",
  });
}

describe("readBodyCapped", () => {
  it("returns the body when under the cap", async () => {
    const req = new Request("https://x/api", { method: "POST", body: "hello" });
    await expect(readBodyCapped(req, 1024)).resolves.toBe("hello");
  });

  it("rejects a declared Content-Length over the cap", async () => {
    const req = new Request("https://x/api", {
      method: "POST",
      body: "x".repeat(2048),
    });
    await expect(readBodyCapped(req, 1024)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("aborts a chunked body once it crosses the cap (no Content-Length)", async () => {
    // 10 × 200 bytes = 2000 > 1024, spread across chunks so only the streaming
    // guard — not a header — can catch it.
    const req = streamedRequest(Array.from({ length: 10 }, () => "y".repeat(200)));
    expect(req.headers.get("content-length")).toBeNull();
    await expect(readBodyCapped(req, 1024)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("accepts a chunked body that stays under the cap", async () => {
    const req = streamedRequest(["ab", "cd", "ef"]);
    await expect(readBodyCapped(req, 1024)).resolves.toBe("abcdef");
  });
});
