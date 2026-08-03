import { describe, expect, it } from "vitest";
import { redact } from "./safeLog";

describe("redact", () => {
  it("redacts Bearer tokens", () => {
    const out = redact("request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCJ9.abc");
    expect(out).not.toContain("eyJhbGci");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts API-key-shaped strings", () => {
    for (const key of [
      "sk-proj-abcdefghijklmnopqrstuv",
      "AIzaSyA1234567890abcdef",
      "AQ.Ab8RN6LuTjHcqLdZpiVy21l_pJwBJUoq",
      'apiKey: "0123456789abcdef0123456789abcdef"',
    ]) {
      const out = redact(`error with ${key} attached`);
      expect(out).toContain("[REDACTED]");
    }
  });

  it("leaves ordinary error text untouched", () => {
    const msg = "Failed to refresh session: fetch failed (ECONNREFUSED 127.0.0.1:3000)";
    expect(redact(msg)).toBe(msg);
  });
});
