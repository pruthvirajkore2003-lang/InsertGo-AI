import { describe, expect, it } from "vitest";
import { createPkce } from "./pkce";

// The challenge must be exactly what the server recomputes from the verifier
// (base64url SHA-256, unpadded) or every sign-in fails with invalid_grant.
describe("createPkce", () => {
  it("derives an S256 challenge the server can verify", async () => {
    const { verifier, challenge, state } = await createPkce();

    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/); // RFC 7636 §4.1
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url, no padding
    expect(state).toMatch(/^[A-Za-z0-9\-._~]{8,128}$/);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    const expected = Buffer.from(digest).toString("base64url");
    expect(challenge).toBe(expected);
  });

  it("never repeats a verifier or state", async () => {
    const a = await createPkce();
    const b = await createPkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
  });
});
