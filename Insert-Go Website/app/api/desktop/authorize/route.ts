/**
 * Authorization endpoint for the desktop PKCE flow (see lib/desktopAuth.ts).
 * Called by /desktop/authorize once the signed-in user approves: mints a
 * single-use code bound to the app's code_challenge and hands back the
 * `insertgo://` callback the page then navigates to.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import {
  CODE_TTL_MS,
  DESKTOP_CLIENT_ID,
  callbackUrl,
  codeIdentifier,
  isChallenge,
  isState,
  newAuthCode,
} from "@/lib/desktopAuth";

const noStore = { "Cache-Control": "no-store" };

/** client_id + a 43-char challenge + method + a ≤128-char state: ~250 bytes.
 *  `req.json()` buffers the whole body first, so cap the read (same reason as
 *  every other route here — lib/httpBody.ts). */
const MAX_AUTHORIZE_BYTES = 4_096;

export async function POST(req: Request) {
  // State-changing and cookie-authenticated: reject cross-origin callers
  // outright rather than relying on SameSite alone.
  // A missing Origin is rejected too: browsers always send it on POST, so an
  // absent header means a non-browser caller — the one case where falling back
  // to SameSite alone would prove nothing.
  const origin = req.headers.get("origin");
  if (origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  let body: Record<string, unknown> | null;
  try {
    body = JSON.parse(await readBodyCapped(req, MAX_AUTHORIZE_BYTES));
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: e instanceof BodyTooLargeError ? 413 : 400, headers: noStore },
    );
  }
  const { client_id, code_challenge, code_challenge_method, state } =
    body ?? {};
  if (
    client_id !== DESKTOP_CLIENT_ID ||
    code_challenge_method !== "S256" || // plain is never accepted
    !isChallenge(code_challenge) ||
    !isState(state)
  ) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: noStore },
    );
  }

  const code = newAuthCode();
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: codeIdentifier(code),
    value: JSON.stringify({ userId: session.user.id, code_challenge }),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return NextResponse.json(
    { redirect: callbackUrl(code, state) },
    { headers: noStore },
  );
}
