import { describe, expect, it, vi } from "vitest";
import { audit, clientIp, encodeDetail } from "./auditLog";

function req(headers: Record<string, string>): Request {
  return new Request("https://insertgo.ai/api/x", { method: "POST", headers });
}

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" }))).toBe(
      "1.2.3.4"
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIp(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("returns null when neither header is present", () => {
    expect(clientIp(req({}))).toBeNull();
  });

  it("caps an over-long spoofed value at the IPv6 maximum", () => {
    const ip = clientIp(req({ "x-forwarded-for": "9".repeat(500) }));
    expect(ip).not.toBeNull();
    expect(ip!.length).toBe(45);
  });
});

describe("encodeDetail", () => {
  it("round-trips a small detail bag", () => {
    expect(encodeDetail({ replays: 3, eventType: "payment.succeeded" })).toBe(
      '{"replays":3,"eventType":"payment.succeeded"}'
    );
  });

  it("stays inside the column CHECK by dropping trailing keys, not truncating", () => {
    // A single key far over the 2048-char ceiling: the only way to fit is to
    // drop it, and the result must still be parseable JSON — a truncated string
    // would be rejected by Postgres and lose the whole event.
    const json = encodeDetail({ keep: 1, huge: "x".repeat(4000) });
    expect(json.length).toBeLessThanOrEqual(2048);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual({ keep: 1 });
  });

  it("encodes an absent bag as an empty object", () => {
    expect(encodeDetail(undefined)).toBe("{}");
  });
});

describe("audit", () => {
  it("never throws when the audit database is unreachable", async () => {
    // No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the test env, so the RPC
    // fails immediately. The contract that matters: a broken audit sink must
    // degrade to a console line, never surface as a failed request.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      audit("billing.webhook.signature_invalid", {
        outcome: "denied",
        severity: "critical",
        req: req({ "x-forwarded-for": "1.2.3.4" }),
        detail: { webhookId: "wh_1" },
      })
    ).not.toThrow();
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]?.[0]).toContain("[audit] write failed");
    spy.mockRestore();
  });
});
