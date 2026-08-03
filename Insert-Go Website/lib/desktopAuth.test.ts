import { describe, expect, it } from "vitest";
import {
  callbackUrl,
  isChallenge,
  isState,
  isVerifier,
  newAuthCode,
  s256,
  verifierMatches,
} from "./desktopAuth";

// The one path that must never go wrong: a code is redeemable only by the app
// that holds the verifier behind the challenge it was issued against.
describe("PKCE", () => {
  const verifier = "a".repeat(43);

  it("accepts the matching verifier and nothing else", () => {
    const challenge = s256(verifier);
    expect(isChallenge(challenge)).toBe(true);
    expect(verifierMatches(verifier, challenge)).toBe(true);
    expect(verifierMatches("b".repeat(43), challenge)).toBe(false);
    // A plain-method client sending the verifier as its own challenge fails.
    expect(verifierMatches(verifier, verifier)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isVerifier("a".repeat(42))).toBe(false); // under RFC 7636 minimum
    expect(isVerifier("a".repeat(129))).toBe(false);
    expect(isVerifier(`a+/=${"a".repeat(40)}`)).toBe(false); // not unreserved
    expect(isChallenge(s256(verifier) + "x")).toBe(false);
    expect(isState("short")).toBe(false);
    expect(isState(null)).toBe(false);
  });
});

describe("callback", () => {
  it("percent-encodes code and state into the custom scheme", () => {
    const code = newAuthCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(callbackUrl(code, "st/at e"));
    expect(url.protocol).toBe("insertgo:");
    expect(url.searchParams.get("code")).toBe(code);
    expect(url.searchParams.get("state")).toBe("st/at e");
  });
});
