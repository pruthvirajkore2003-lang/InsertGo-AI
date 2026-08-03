/**
 * POST /api/billing/checkout — start a plan upgrade or credit-pack purchase
 * for the signed-in user.
 *
 * Called by the web pricing page (cookie session) or the desktop app (Bearer
 * session token) with `{ tier: "plus" | "pro" }` or `{ pack: 50|150|350|500 }`.
 * Creates a Dodo Payments hosted checkout session and returns
 * `{ gateway: "dodo", url }`; the client opens `url` (system browser on
 * desktop). Dodo is the Merchant of Record, so currency/tax/payment-method
 * localization happens on their hosted page.
 *
 * Prices/products are pinned server-side via DODO_PRODUCT_ID_* env — nothing
 * money-shaped is accepted from the client beyond the catalog selector, which
 * is validated against lib/dodo.ts. Without gateway env keys the route
 * answers 503 with a clear message. Fulfilment lands via the webhook
 * (app/api/billing/webhook).
 */
import { auth } from "@/lib/auth";
import {
  requireSession,
  requireWithinQuota,
  type Denied,
} from "@/lib/entitlements";
import { consumeQuota } from "@/lib/usageLimit";
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import {
  CREDIT_PACKS,
  createCheckoutSession,
  dodoCheckoutConfigured,
  type CheckoutItem,
} from "@/lib/dodo";

// pg (Better Auth session lookup) and the outbound Dodo call need Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The body is `{ tier }` or `{ pack }` — tens of bytes. */
const MAX_CHECKOUT_BYTES = 4_096;

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function denied(d: Denied): Response {
  return errorResponse(d.status, d.message);
}

export async function POST(req: Request): Promise<Response> {
  // 1. Authenticate via the existing Better Auth session/bearer.
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    session = null;
  }
  const denySession = requireSession(session);
  if (denySession) return denied(denySession);

  // 1.5 Meter it. Better Auth's rateLimit covers /api/auth/* only, so this
  //     route had no bound at all: every call holds a serverless invocation for
  //     up to 10s waiting on Dodo and leaves an orphaned checkout session
  //     behind. Nobody legitimately starts more than a handful an hour. Same
  //     DB-backed counter the generate route uses, keyed on the verified user.
  const userId = session!.user.id;
  try {
    const quota = await consumeQuota(userId, "checkout:hour", 10, 3_600);
    const denyQuota = requireWithinQuota(quota);
    if (denyQuota) return denied(denyQuota);
  } catch (e) {
    // Fail OPEN, unlike the generate route: this path spends the user's money,
    // not ours, and a metering blip must not block a purchase. Never silently —
    // the outbound Dodo call is still bounded by its own 10s timeout.
    console.error(
      "[billing] checkout quota check failed; allowing:",
      e instanceof Error ? e.message : String(e)
    );
  }

  // 2. Validate the body against the server catalog: a paid tier or a pack.
  //    `req.json()` buffers the whole body first, so a leaked bearer token
  //    could stream an unbounded POST here — bound the read like the webhook.
  let body: unknown;
  try {
    body = JSON.parse(await readBodyCapped(req, MAX_CHECKOUT_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return errorResponse(413, "Payload too large.");
    }
    return errorResponse(400, "Invalid JSON body.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  let item: CheckoutItem;
  if (b.tier === "plus" || b.tier === "pro") {
    item = { kind: "plan", tier: b.tier };
  } else if (
    typeof b.pack === "number" &&
    CREDIT_PACKS.some((p) => p.credits === b.pack)
  ) {
    item = { kind: "pack", credits: b.pack };
  } else {
    return errorResponse(
      400,
      'Expected { tier: "plus" | "pro" } or { pack: 50 | 150 | 350 | 500 }.'
    );
  }

  // 3. Honest degradation until the Dodo account is provisioned.
  if (!dodoCheckoutConfigured()) {
    return errorResponse(503, "Billing isn't configured yet.");
  }

  // 4. Create the hosted checkout session. User identity comes from the
  //    verified session, never the request body.
  const user = session!.user;
  try {
    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      item,
    });
    return Response.json({ gateway: "dodo", url });
  } catch (e) {
    if (e instanceof Error && e.message === "checkout-product-unconfigured") {
      return errorResponse(503, "This product isn't available yet.");
    }
    return errorResponse(502, "Could not start checkout — please try again.");
  }
}
