/**
 * Token endpoint for the desktop PKCE flow (see lib/desktopAuth.ts).
 *
 * Public client: no secret, no session — possession of the code AND the
 * verifier behind its challenge is the entire proof. Returns a normal Better
 * Auth session token, which the desktop then sends as `Authorization: Bearer`
 * (bearer plugin), so /api/auth/get-session and /api/ai/generate are unchanged.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import {
  DESKTOP_CLIENT_ID,
  codeIdentifier,
  isCode,
  isVerifier,
  verifierMatches,
} from "@/lib/desktopAuth";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** grant_type + client_id + a ≤128-char code + a ≤128-char verifier is ~400
 *  bytes. This route is UNAUTHENTICATED and Better Auth's rate limiter only
 *  covers /api/auth/*, so `req.json()` — which buffers the whole body before
 *  anything is validated — is a memory-exhaustion lever for anyone at all. */
const MAX_TOKEN_BYTES = 4_096;

/** OAuth 2.0 error body (RFC 6749 §5.2). Deliberately uniform: a bad code, an
 *  expired code, a replayed code and a wrong verifier are indistinguishable. */
const fail = (error: string, description: string, status = 400) =>
  NextResponse.json(
    { error, error_description: description },
    { status, headers: noStore },
  );

export async function POST(req: Request) {
  let body: Record<string, unknown> | null;
  try {
    body = JSON.parse(await readBodyCapped(req, MAX_TOKEN_BYTES));
  } catch (e) {
    // Same uniform error as every other rejection below: an oversize body must
    // not become an oracle either.
    return e instanceof BodyTooLargeError
      ? fail("invalid_request", "Malformed token request.", 413)
      : fail("invalid_request", "Malformed token request.");
  }
  const { grant_type, client_id, code, code_verifier } = body ?? {};

  if (grant_type !== "authorization_code") {
    return fail("unsupported_grant_type", "Unsupported grant type.");
  }
  if (client_id !== DESKTOP_CLIENT_ID || !isCode(code) || !isVerifier(code_verifier)) {
    return fail("invalid_request", "Malformed token request.");
  }

  const ctx = await auth.$context;
  // Atomic single-use read: a replayed code finds nothing. Also returns null
  // once expired, so no separate freshness check is needed.
  const stored = await ctx.internalAdapter.consumeVerificationValue(
    codeIdentifier(code),
  );
  if (!stored) {
    return fail("invalid_grant", "That sign-in code is invalid or expired.");
  }

  let userId: unknown;
  let challenge: unknown;
  try {
    ({ userId, code_challenge: challenge } = JSON.parse(stored.value));
  } catch {
    return fail("invalid_grant", "That sign-in code is invalid or expired.");
  }
  if (
    typeof userId !== "string" ||
    typeof challenge !== "string" ||
    !verifierMatches(code_verifier, challenge)
  ) {
    return fail("invalid_grant", "That sign-in code is invalid or expired.");
  }

  const session = await ctx.internalAdapter.createSession(userId);
  if (!session) {
    return fail("server_error", "Could not create a session.", 500);
  }

  return NextResponse.json(
    {
      access_token: session.token,
      token_type: "Bearer",
      expires_in: Math.floor(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000,
      ),
    },
    { headers: noStore },
  );
}
