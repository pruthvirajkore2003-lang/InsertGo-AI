import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

// The exact relative-URL allowlist Better Auth applies to `callbackURL`
// (matchesOriginPattern, better-auth/dist/auth/trusted-origins). A callbackURL
// that fails this is answered with 403 INVALID_CALLBACK_URL — which is what
// silently killed the desktop sign-in's Google and SSO lanes.
const BETTER_AUTH_RELATIVE =
  /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/;

const DESKTOP_NEXT =
  "/desktop/authorize?response_type=code&client_id=insertgo-desktop" +
  "&redirect_uri=insertgo://auth/callback" +
  "&code_challenge=AiCw7yoLMNhiuxIoeNNiHqL6yHR_nAz-Fi1mS4Y_g3Y" +
  "&code_challenge_method=S256&state=X6O2iBUOVUj0uRxshHrc6Q";

describe("safeNext", () => {
  it("rejects anything that leaves the origin", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.test/x",
      "//evil.test/x",
      "/\\evil.test/x",
      "/account\\..\\x",
      "account",
    ]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });

  it("passes plain paths through untouched", () => {
    expect(safeNext("/pricing")).toBe("/pricing");
  });

  it("produces a callbackURL Better Auth accepts", () => {
    expect(BETTER_AUTH_RELATIVE.test(DESKTOP_NEXT)).toBe(false); // the bug
    expect(BETTER_AUTH_RELATIVE.test(safeNext(DESKTOP_NEXT))).toBe(true);
  });

  it("round-trips every desktop PKCE parameter", () => {
    const url = new URL(safeNext(DESKTOP_NEXT), "http://localhost:3000");
    expect(url.pathname).toBe("/desktop/authorize");
    const original = new URL(DESKTOP_NEXT, "http://localhost:3000");
    for (const [k, v] of original.searchParams) {
      expect(url.searchParams.get(k)).toBe(v);
    }
  });
});
