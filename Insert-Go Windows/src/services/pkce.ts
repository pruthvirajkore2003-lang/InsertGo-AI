/**
 * PKCE (RFC 7636) + CSRF state for the browser sign-in flow (SPEC §16.1).
 *
 * The desktop app is a public OAuth client — no secret ships in the binary, so
 * the code_verifier is the only thing proving the app that redeems an
 * authorization code is the one that asked for it. That matters because any
 * local program can claim the `insertgo://` scheme on Windows and receive the
 * callback: without PKCE, an interceptor could redeem the code.
 *
 * Web Crypto only — no dependency, and the verifier never leaves memory.
 */

const b64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const randomB64Url = (byteLength: number): string =>
  b64url(crypto.getRandomValues(new Uint8Array(byteLength)));

export type Pkce = { verifier: string; challenge: string; state: string };

/** 32 random bytes → 43 base64url chars: the RFC 7636 minimum verifier length,
 *  and the exact length of an S256 challenge (what the server validates). */
export async function createPkce(): Promise<Pkce> {
  const verifier = randomB64Url(32);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return {
    verifier,
    challenge: b64url(new Uint8Array(digest)),
    state: randomB64Url(16),
  };
}
