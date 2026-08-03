/**
 * Desktop (Tauri) sign-in: Authorization Code + PKCE over a custom URI scheme
 * (RFC 8252 for native apps, RFC 7636 for PKCE). Replaces the device-code flow.
 *
 *   1. Desktop generates code_verifier + state, opens the system browser on
 *      /desktop/authorize?code_challenge=…&state=… (S256 challenge only).
 *   2. The user approves there with an existing web session, and the browser is
 *      sent to insertgo://auth/callback?code=…&state=… — the CODE only, never a
 *      session token: any local app can claim the URI scheme on Windows.
 *   3. The desktop POSTs code + code_verifier to /api/desktop/token. PKCE binds
 *      the code to the app that requested it, so an interceptor can't redeem it.
 *
 * The exchange mints a normal Better Auth session, so `bearer()`,
 * `auth.api.getSession()` and every existing API route keep working unchanged.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** The desktop app is a PUBLIC client — no secret is embedded in the binary;
 *  PKCE is what authenticates the token request. The id is an identifier only. */
export const DESKTOP_CLIENT_ID = "insertgo-desktop";

/** Sole allowed redirect target. Fixed server-side rather than accepted from
 *  the request, so a crafted authorize link can't retarget the code. */
export const DESKTOP_REDIRECT_URI = "insertgo://auth/callback";

/** Authorization codes are single-use and short-lived (RFC 6749 §4.1.2). */
export const CODE_TTL_MS = 5 * 60 * 1000;

/** Namespaced key in Better Auth's `verification` table — no new table, and
 *  `consumeVerificationValue` gives an atomic single-use read. */
export const codeIdentifier = (code: string) => `desktop-auth:${code}`;

/** S256 challenge: base64url of a SHA-256 digest — always exactly 43 chars. */
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
/** RFC 7636 §4.1 code_verifier: 43–128 unreserved characters. */
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
/** Opaque CSRF value echoed back to the app; bounded so it can't smuggle. */
const STATE_RE = /^[A-Za-z0-9\-._~]{8,128}$/;

export const isChallenge = (v: unknown): v is string =>
  typeof v === "string" && CHALLENGE_RE.test(v);
export const isVerifier = (v: unknown): v is string =>
  typeof v === "string" && VERIFIER_RE.test(v);
export const isState = (v: unknown): v is string =>
  typeof v === "string" && STATE_RE.test(v);
export const isCode = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(v);

export const s256 = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

/** Constant-time PKCE check — the challenge is attacker-supplied at authorize
 *  time, so never leak match progress through early exit. */
export function verifierMatches(verifier: string, challenge: string): boolean {
  const a = Buffer.from(s256(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 256 bits of entropy, base64url — brute-forcing a live 5-minute code is out. */
export const newAuthCode = () => randomBytes(32).toString("base64url");

export const callbackUrl = (code: string, state: string) =>
  `${DESKTOP_REDIRECT_URI}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
