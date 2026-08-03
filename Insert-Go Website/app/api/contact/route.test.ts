/**
 * Trust-boundary tests for POST /api/contact. Every case below runs with no
 * RESEND_API_KEY set, so the route takes its dev branch and nothing is sent —
 * what is under test is the gate in front of the mailer, not the mailer.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://insertgo.ai/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "The overlay never opens in Word. Windows 11, version 2.4.1.",
  topic: "Bug report",
};

/** Each test gets its own IP so the per-IP window never bleeds across cases. */
let n = 0;
const freshIp = () => ({ "x-forwarded-for": `203.0.113.${++n}` });

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("POST /api/contact", () => {
  it("accepts a well-formed message", async () => {
    const res = await post(valid, freshIp());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("rejects a malformed body", async () => {
    const res = await post("{not json", freshIp());
    expect(res.status).toBe(400);
  });

  it.each([
    ["missing name", { ...valid, name: "   " }],
    ["invalid email", { ...valid, email: "ada@" }],
    ["message under 10 chars", { ...valid, message: "too short" }],
    ["message over the cap", { ...valid, message: "x".repeat(4001) }],
    ["topic outside the offered set", { ...valid, topic: "Subject: pwned" }],
  ])("rejects %s", async (_label, body) => {
    const res = await post(body, freshIp());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("swallows a filled honeypot without reporting an error", async () => {
    // 200 so a bot sees success and does not retry with the field cleared.
    const res = await post({ ...valid, company: "Acme" }, freshIp());
    expect(res.status).toBe(200);
  });

  it("rate-limits repeat submissions from one address", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect((await post(valid, ip)).status).toBe(200);
    }
    const blocked = await post(valid, ip);
    expect(blocked.status).toBe(429);
  });

  it("refuses to fail open in production without a mailer", async () => {
    // The dev branch logs the message and answers 200; in production that
    // would silently drop every enquiry while telling the sender it arrived.
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await post(valid, freshIp());
      expect(res.status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
