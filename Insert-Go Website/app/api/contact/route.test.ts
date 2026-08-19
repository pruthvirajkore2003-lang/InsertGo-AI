/**
 * Trust-boundary and delivery tests for POST /api/contact.
 *
 * Two halves. The first runs with no RESEND_API_KEY, so the route takes its dev
 * branch and nothing is sent — what is under test there is the gate in front of
 * the mailer. The second sets a key against a stubbed Resend and asserts on the
 * ENVELOPES: who the mails are addressed as, what a submitted `\r\n` or `<script>`
 * looks like by the time it reaches a header or an HTML part, and which failure
 * fails the request. Those are the properties with no other symptom — a build
 * that spoofs `from`, or drops the RFC 3834 headers, still sends mail and still
 * answers 200.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

// The shared limiter is Redis-backed and fails open when unconfigured, so with
// the real module every case would silently take the fail-open path. Stubbed so
// "allowed" and "refused" are both reachable on demand.
const { shared } = vi.hoisted(() => ({ shared: { allow: true } }));
vi.mock("@/lib/ipRateLimit", () => ({
  withinIpRateLimit: vi.fn(async () => shared.allow),
}));

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

/** Arguments of the two sends, in dispatch order: inbox first, receipt second.
 *  `payload` is what Resend was handed; `opts` carries the idempotency key. */
const sent = () =>
  send.mock.calls.map(([payload, opts]) => ({ payload, opts })) as {
    payload: Record<string, string & Record<string, string>>;
    opts: { idempotencyKey: string };
  }[];

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "eml_test" }, error: null });
  shared.allow = true;
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_TO;
  delete process.env.EMAIL_FROM;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/contact — request gate", () => {
  it("accepts a well-formed message", async () => {
    const res = await post(valid, freshIp());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("rejects a malformed body", async () => {
    const res = await post("{not json", freshIp());
    expect(res.status).toBe(400);
  });

  it("rejects a body over the cap with 413", async () => {
    const res = await POST(
      new Request("https://insertgo.ai/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "content-length": String(17 * 1024),
          ...freshIp(),
        },
        body: JSON.stringify({ ...valid, message: "x".repeat(17 * 1024) }),
      }),
    );
    expect(res.status).toBe(413);
  });

  it.each([
    ["missing name", { ...valid, name: "   " }],
    ["a name of only newlines", { ...valid, name: "\r\n" }],
    ["a name over the cap", { ...valid, name: "x".repeat(121) }],
    ["invalid email", { ...valid, email: "ada@" }],
    ["a header-injecting email", { ...valid, email: "a@b.co\r\nBcc: x@y.co" }],
    ["message under 10 chars", { ...valid, message: "too short" }],
    ["message over the cap", { ...valid, message: "x".repeat(4001) }],
    ["topic outside the offered set", { ...valid, topic: "Subject: pwned" }],
    ["a header-injecting topic", { ...valid, topic: "General\r\nBcc: x@y.co" }],
    ["non-string fields", { ...valid, name: 42 }],
  ])("rejects %s", async (_label, body) => {
    const res = await post(body, freshIp());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("swallows a filled honeypot without sending or spending the window", async () => {
    // 200 so a bot sees success and does not retry with the field cleared.
    process.env.RESEND_API_KEY = "re_test_key";
    const ip = freshIp();
    for (let i = 0; i < 8; i++) {
      const res = await post({ ...valid, company: "Acme" }, ip);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    }
    expect(send).not.toHaveBeenCalled();
    // The window is untouched, so a real visitor on that address still gets in.
    expect((await post(valid, ip)).status).toBe(200);
  });

  it("rate-limits repeat submissions from one address", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect((await post(valid, ip)).status).toBe(200);
    }
    const blocked = await post(valid, ip);
    expect(blocked.status).toBe(429);
  });

  it("refuses when the SHARED limiter says no, even on a fresh address", async () => {
    // The per-instance floor cannot see traffic that landed on other instances;
    // this is the check that does.
    shared.allow = false;
    const res = await post(valid, freshIp());
    expect(res.status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });

  it("counts a refused shared attempt against the local floor too", async () => {
    // Otherwise a flood that Redis refuses would leave the local window full of
    // budget the moment Redis went away mid-flood.
    const ip = freshIp();
    shared.allow = false;
    for (let i = 0; i < 6; i++) expect((await post(valid, ip)).status).toBe(429);
    shared.allow = true;
    expect((await post(valid, ip)).status).toBe(429);
  });

  it("refuses to fail open in production without a mailer", async () => {
    // The dev branch logs the message and answers 200; in production that
    // would silently drop every enquiry while telling the sender it arrived.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    const res = await post(valid, freshIp());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toHaveProperty("error");
    expect(send).not.toHaveBeenCalled();
  });

  it("names the sandbox rule in the dev log so an unset key is diagnosable", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await post(valid, freshIp());
    const line = log.mock.calls.flat().map(String).join(" ");
    expect(line).toContain("RESEND_API_KEY");
    expect(line).toContain("onboarding@resend.dev");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("POST /api/contact — dual dispatch", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONTACT_TO = "support@insertgo.ai";
    process.env.EMAIL_FROM = "InsertGo <hello@insertgo.ai>";
  });

  it("sends the inbox alert and the visitor receipt, keyed to one submission", async () => {
    const res = await post(valid, freshIp());
    expect(res.status).toBe(200);
    const bodyJson = (await res.json()) as { ok: boolean; submissionId: string };
    expect(bodyJson.ok).toBe(true);
    expect(bodyJson.submissionId).toMatch(/^[0-9a-f-]{36}$/);

    const [inbox, receipt] = sent();
    expect(send).toHaveBeenCalledTimes(2);

    expect(inbox.payload.to).toEqual(["support@insertgo.ai"]);
    expect(inbox.payload.replyTo).toBe(valid.email);
    expect(inbox.payload.subject).toBe("[Bug report] Ada Lovelace");
    expect(inbox.payload.text).toContain(valid.message);
    expect(inbox.opts.idempotencyKey).toBe(
      `contact-inbox/${bodyJson.submissionId}`,
    );

    expect(receipt.payload.to).toEqual([valid.email]);
    expect(receipt.payload.replyTo).toBe("support@insertgo.ai");
    expect(receipt.payload.subject).toBe("We received your message: [Bug report]");
    expect(receipt.opts.idempotencyKey).toBe(
      `contact-ack/${bodyJson.submissionId}`,
    );
    // Distinct keys: one submission must never collapse into a single send.
    expect(inbox.opts.idempotencyKey).not.toBe(receipt.opts.idempotencyKey);
  });

  it("never puts the visitor's address in `from`", async () => {
    // A `from` our SPF/DKIM records do not cover is rejected or junked by the
    // receiver, and burns the sending domain's reputation on the way.
    await post(valid, freshIp());
    for (const { payload } of sent()) {
      expect(payload.from).toBe("InsertGo <hello@insertgo.ai>");
      expect(payload.from).not.toContain(valid.email);
    }
  });

  it("marks the receipt as machine-generated (RFC 3834)", async () => {
    await post(valid, freshIp());
    const [inbox, receipt] = sent();
    expect(receipt.payload.headers).toMatchObject({
      "Auto-Submitted": "auto-replied",
      "X-Auto-Response-Suppress": "All",
    });
    expect(receipt.payload.headers["X-Entity-Ref-ID"]).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    // The inbox alert is a real message from a person — marking it auto-replied
    // would tell the support desk's own tooling to ignore it.
    expect(inbox.payload.headers).toBeUndefined();
  });

  it.each([
    "noreply@example.com",
    "no-reply@example.com",
    "MAILER-DAEMON@example.com",
    "postmaster@example.com",
    "bounce@example.com",
  ])("withholds the receipt from %s", async (email) => {
    const res = await post({ ...valid, email }, freshIp());
    expect(res.status).toBe(200);
    // Enquiry still filed; only the auto-reply is suppressed, so a loop with a
    // bounce daemon never starts.
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent()[0].opts.idempotencyKey).toMatch(/^contact-inbox\//);
  });

  it("strips CRLF before a field reaches a header", async () => {
    await post(
      { ...valid, name: "Ada\r\nBcc: victim@example.com" },
      freshIp(),
    );
    for (const { payload } of sent()) {
      expect(payload.subject).not.toMatch(/[\r\n]/);
      expect(String(payload.replyTo)).not.toMatch(/[\r\n]/);
    }
    // The injected text survives as ordinary subject content — flattened onto
    // one line, so it is a silly display name and not a second header.
    expect(sent()[0].payload.subject).toBe(
      "[Bug report] Ada Bcc: victim@example.com",
    );
  });

  it("escapes HTML in every dynamic field", async () => {
    await post(
      {
        ...valid,
        name: `<script>alert('x')</script>`,
        message: `<img src=x onerror="alert(1)"> & "quoted" line\nsecond line`,
      },
      freshIp(),
    );
    for (const { payload } of sent()) {
      expect(payload.html).not.toContain("<script>");
      expect(payload.html).not.toContain("<img src=x");
      expect(payload.html).toContain("&lt;script&gt;");
      expect(payload.html).toContain("&amp;");
      expect(payload.html).toContain("&#39;");
      // Newlines survive as markup we emitted, not as the visitor's.
      expect(payload.html).toContain("second line");
    }
  });

  it("fails the request when the inbox alert does not go out", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValueOnce({
      data: null,
      // Shaped like the real sandbox refusal, which quotes the address back.
      error: {
        name: "validation_error",
        message:
          "You can only send testing emails to your own address (owner@example.com).",
      },
    });
    const res = await post(valid, freshIp());
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toHaveProperty("error");
    // R-06: the SDK's message quotes an address; it must not reach the log raw.
    const line = error.mock.calls.flat().map(String).join(" ");
    expect(line).toContain("[EMAIL]");
    expect(line).not.toContain("owner@example.com");
  });

  it("fails the request when the SDK throws rather than reporting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValueOnce(new Error("fetch failed"));
    const res = await post(valid, freshIp());
    expect(res.status).toBe(502);
  });

  it("still reports success when only the receipt fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    send
      .mockResolvedValueOnce({ data: { id: "eml_1" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { name: "application_error", message: "receipt refused" },
      });
    const res = await post(valid, freshIp());
    // The enquiry is filed. Answering 502 here would tell the visitor to send
    // again and duplicate the ticket over a missing courtesy mail.
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toHaveProperty("ok", true);
    expect(error).toHaveBeenCalled();
  });

  it("keeps the visitor's message out of the log on failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValueOnce({
      data: null,
      error: { name: "application_error", message: "refused" },
    });
    await post(valid, freshIp());
    const line = error.mock.calls.flat().map(String).join(" ");
    expect(line).not.toContain(valid.message);
    expect(line).not.toContain(valid.email);
  });

  it("falls back to the sandbox sender and support inbox when unset", async () => {
    delete process.env.EMAIL_FROM;
    delete process.env.CONTACT_TO;
    await post(valid, freshIp());
    const [inbox] = sent();
    expect(inbox.payload.from).toBe("InsertGo <onboarding@resend.dev>");
    expect(inbox.payload.to).toEqual(["support@insertgo.ai"]);
  });
});
