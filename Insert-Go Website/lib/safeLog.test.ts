import { describe, expect, it, vi } from "vitest";
import { redact, safeError } from "./safeLog";

/** What actually reached the sink, joined — the assertions here are about the
 *  console output, not about the return value, because the output is the thing
 *  Vercel keeps. */
function logged(run: () => void): string {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    run();
    return spy.mock.calls.flat().map(String).join(" ");
  } finally {
    spy.mockRestore();
  }
}

describe("redact", () => {
  it("removes an address and keeps the rest of the line", () => {
    const out = redact("delivery to first.last+tag@example.co.uk failed");
    expect(out).not.toContain("example.co.uk");
    expect(out).toBe("delivery to [EMAIL] failed");
  });

  it("removes bearer tokens and provider API keys", () => {
    const out = redact(
      "Authorization: Bearer abcdef0123456789 key=AIzaSyA1B2C3D4E5F6G7",
    );
    expect(out).not.toMatch(/abcdef0123456789|AIzaSy/);
  });

  it("leaves a line with nothing sensitive alone", () => {
    const line = "[ai/generate] usage: prompt=812 output=44 total=856";
    expect(redact(line)).toBe(line);
  });
});

describe("safeError", () => {
  it("drops a database error's quoted row", () => {
    // The exact shape that makes a boundary worth having: the format string
    // names nothing, and the address rides in on a property.
    const e = Object.assign(
      new Error('duplicate key value violates unique constraint "user_email_key"'),
      { code: "23505", detail: "Key (email)=(person@example.com) already exists." },
    );
    const out = logged(() => safeError("[auth] lookup failed", e));
    expect(out).not.toContain("person@example.com");
    expect(out).not.toContain("Key (email)");
    expect(out).toContain("user_email_key"); // the diagnosable part survives
  });

  it("redacts an address a provider echoed back inside a plain object", () => {
    const providerError = {
      name: "validation_error",
      message:
        "You can only send testing emails to your own address (person@example.com)",
    };
    const out = logged(() => safeError("[contact] delivery failed", providerError));
    expect(out).not.toContain("person@example.com");
    expect(out).toContain("validation_error");
  });

  it("never throws on an unserialisable argument", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const out = logged(() => safeError("[x] failed", circular));
    expect(out).toContain("[unserializable]");
  });

  it("cannot redact a bare one-time code — that is the call site's job", () => {
    // Documented, not a gap found later: six digits are indistinguishable from
    // a token count, so lib/auth.ts keeps codes out of production logs
    // structurally and this module is only the second line.
    expect(redact("code 483920")).toContain("483920");
  });
});
