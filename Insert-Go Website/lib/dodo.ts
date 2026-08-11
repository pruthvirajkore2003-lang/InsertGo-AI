/**
 * Dodo Payments (Merchant of Record) integration.
 *
 * Two halves:
 *  - `createCheckoutSession` — server-to-server `POST /checkouts` with the
 *    account-level API key; returns the hosted `checkout_url` the desktop app
 *    opens in the system browser. The user id rides in `metadata.userId` so
 *    the webhook can attribute the resulting subscription without trusting
 *    the customer email alone.
 *  - Webhook verification + event mapping — Dodo follows the Standard
 *    Webhooks spec (`webhook-id`/`webhook-timestamp`/`webhook-signature`
 *    headers; HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` with the
 *    base64 secret after the optional `whsec_` prefix). Pure functions so
 *    they unit-test without network or env.
 *
 * Env: DODO_API_KEY, DODO_WEBHOOK_SECRET, DODO_ENV ("test" default | "live"),
 *      DODO_PRODUCT_ID_PLUS / DODO_PRODUCT_ID_PRO (subscription plans),
 *      DODO_PRODUCT_ID_PACK_50/150/350/500 (one-time credit packs).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import type { Tier } from "./entitlements";

// ── Catalog ────────────────────────────────────────────────────────────────

export type PaidTier = Exclude<Tier, "free">;

/** Add-on credit packs — non-expiring. Prices are display-only (Dodo owns
 *  the real charge via the pinned product id); `credits` is the grant the
 *  webhook applies and MUST match the product configured in Dodo. */
export const CREDIT_PACKS = [
  { credits: 50, usd: 2 },
  { credits: 150, usd: 4 },
  { credits: 350, usd: 6 },
  { credits: 500, usd: 8 },
] as const;

export type CheckoutItem =
  | { kind: "plan"; tier: PaidTier }
  | { kind: "pack"; credits: number };

/** Server-pinned product id for a checkout item; null when unconfigured or
 *  the item isn't in the catalog (nothing money-shaped comes from clients). */
export function dodoProductId(item: CheckoutItem): string | null {
  if (item.kind === "plan") {
    return (
      (item.tier === "plus"
        ? process.env.DODO_PRODUCT_ID_PLUS
        : process.env.DODO_PRODUCT_ID_PRO) ?? null
    );
  }
  if (!CREDIT_PACKS.some((p) => p.credits === item.credits)) return null;
  return process.env[`DODO_PRODUCT_ID_PACK_${item.credits}`] ?? null;
}

/**
 * Reverse of `dodoProductId`: the tier a Dodo product id implies, or null when
 * it matches neither configured plan (unconfigured env included — an empty
 * `DODO_PRODUCT_ID_*` must never match an empty/absent payload field).
 *
 * This is the ONLY tier source that stays correct across a plan change. The
 * `planTier` in checkout metadata is stamped once, at the original checkout, so
 * a portal upgrade or downgrade carries the OLD tier forever.
 */
export function tierForProductId(id: unknown): PaidTier | null {
  if (typeof id !== "string" || !id) return null;
  if (id === process.env.DODO_PRODUCT_ID_PRO) return "pro";
  if (id === process.env.DODO_PRODUCT_ID_PLUS) return "plus";
  return null;
}

// ── Checkout ───────────────────────────────────────────────────────────────

export function dodoApiBase(): string {
  return process.env.DODO_ENV === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

/** Checkout needs the API key; per-item product config is checked per call. */
export function dodoCheckoutConfigured(): boolean {
  return Boolean(process.env.DODO_API_KEY);
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  item: CheckoutItem;
}): Promise<{ url: string }> {
  const siteUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const productId = dodoProductId(input.item);
  if (!productId) throw new Error("checkout-product-unconfigured");

  // Metadata is what the webhook trusts for attribution + fulfilment: the
  // verified userId, and either the plan tier or the pack size (validated
  // again server-side on receipt — metadata round-trips as strings).
  const metadata: Record<string, string> = { userId: input.userId };
  if (input.item.kind === "plan") metadata.planTier = input.item.tier;
  else metadata.packCredits = String(input.item.credits);

  const res = await fetch(`${dodoApiBase()}/checkouts`, {
    method: "POST",
    // A hung gateway socket otherwise pins the whole serverless invocation
    // until the platform kills it; fail fast so the route can answer 502.
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DODO_API_KEY}`,
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: input.email, name: input.name },
      return_url: `${siteUrl}/account?upgraded=1`,
      metadata,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    checkout_url?: string;
  } | null;
  if (!res.ok || !data?.checkout_url) {
    // Never echo the gateway's raw body to the client — log status only.
    console.error(`[billing] Dodo checkout create failed (${res.status})`);
    throw new Error("checkout-create-failed");
  }
  return { url: data.checkout_url };
}

// ── Webhook verification (Standard Webhooks) ───────────────────────────────

/** Max allowed clock skew between the webhook timestamp and now. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/** Decode the shared secret: optional `whsec_` prefix, base64 body. */
function secretBytes(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    const decoded = Buffer.from(raw, "base64");
    // Node's base64 decoder is lenient; require a round-trip to accept.
    if (decoded.length > 0 && decoded.toString("base64") === raw) {
      return decoded;
    }
  } catch {
    /* fall through to raw bytes */
  }
  return Buffer.from(raw, "utf8");
}

/**
 * Verify a Standard-Webhooks signature. Returns true only when the timestamp
 * is within tolerance AND one of the space-separated `v1,<base64>` entries in
 * the signature header matches the HMAC (constant-time compare).
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { rawBody, webhookId, webhookTimestamp, webhookSignature, secret } =
    input;
  if (!rawBody || !webhookId || !webhookTimestamp || !webhookSignature) {
    return false;
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secretBytes(secret))
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest();

  // Header may carry several space-separated signatures (secret rotation).
  for (const part of webhookSignature.split(" ")) {
    const value = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return true;
    }
  }
  return false;
}

// ── Event mapping ──────────────────────────────────────────────────────────

/** Minimal payload shape the webhook route reads. */
export type DodoWebhookPayload = {
  type?: string;
  /** Event time (ISO-8601, or epoch seconds). NOT the `webhook-timestamp`
   *  header — that one is stamped per *delivery attempt*, so a retry carries a
   *  fresh value and it can never order events. */
  timestamp?: string | number;
  data?: {
    metadata?: Record<string, unknown> | null;
    customer?: { email?: string | null } | null;
    /** Subscription events carry the CURRENT product; payment events carry the
     *  cart. Either one is the live plan, unlike `metadata.planTier`. */
    product_id?: string | null;
    product_cart?: Array<{ product_id?: string | null } | null> | null;
  } | null;
};

/**
 * Event time in epoch seconds, or null when the payload carries none.
 *
 * Webhook delivery is at-least-once AND unordered: a `subscription.active`
 * whose first delivery 500s can be retried *after* the `subscription.cancelled`
 * that followed it, which would restore a paid tier the user already gave up.
 * The webhook route uses this to make tier writes last-write-wins by event
 * time. Null means "can't order this one" — the route then applies the write
 * unconditionally (today's behaviour) rather than dropping revenue events.
 */
export function eventTimestampSeconds(
  payload: DodoWebhookPayload,
): number | null {
  const raw = payload.timestamp;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

/**
 * Map a Dodo subscription event to the tier it implies, or null for events
 * this app doesn't act on.
 *
 * Activation events resolve the tier from the event's own PRODUCT ID first.
 * `metadata.planTier` is only the fallback because it is planted once, at the
 * original checkout, and never rewritten: reading it on
 * `subscription.plan_changed` under-grants every portal upgrade (plus→pro keeps
 * "plus") and over-grants every downgrade (pro→plus keeps "pro", which is paid
 * entitlement given away). A subscription created outside this app's checkout
 * has neither, so it defaults to the entry paid tier (least paid privilege)
 * rather than pro. Termination events always land on free. Kept tiny and total
 * so the webhook route stays a thin shell.
 */
export function tierForSubscriptionEvent(
  eventType: string,
  payload: DodoWebhookPayload,
): Tier | null {
  switch (eventType) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed": {
      const byProduct =
        tierForProductId(payload.data?.product_id) ??
        tierForProductId(payload.data?.product_cart?.[0]?.product_id);
      if (byProduct) return byProduct;
      const t = payload.data?.metadata?.planTier;
      return t === "pro" ? "pro" : "plus";
    }
    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.failed":
    case "subscription.on_hold":
      return "free";
    default:
      return null;
  }
}

/**
 * Credits to grant for a one-time pack purchase event, or null when the event
 * isn't a completed pack payment. Validated against CREDIT_PACKS — a forged
 * or mistyped `packCredits` (metadata round-trips as strings) grants nothing.
 */
export function packCreditsForEvent(
  eventType: string,
  payload: DodoWebhookPayload,
): number | null {
  if (eventType !== "payment.succeeded") return null;
  const raw = payload.data?.metadata?.packCredits;
  const credits = Number(raw);
  return CREDIT_PACKS.some((p) => p.credits === credits) ? credits : null;
}

/**
 * Events that undo a pack purchase. Pack credits never expire, so without a
 * reversal a refunded or charged-back purchase leaves the credits granted
 * forever — the one place in this integration where money can move backwards
 * and entitlement doesn't.
 *
 * Isolated as a constant because these strings are the part of the Dodo
 * catalogue this code can't verify from here: confirm them against the
 * dashboard's webhook event list before going live.
 */
const REVERSAL_EVENTS = ["refund.succeeded", "dispute.lost"] as const;

/**
 * Credits to CLAW BACK for a refund/chargeback of a pack purchase, or null when
 * the event isn't one. Mirrors `packCreditsForEvent` exactly, including the
 * CREDIT_PACKS validation — a forged or mistyped `packCredits` reverses nothing.
 */
export function packCreditsReversedForEvent(
  eventType: string,
  payload: DodoWebhookPayload,
): number | null {
  if (!(REVERSAL_EVENTS as readonly string[]).includes(eventType)) return null;
  const credits = Number(payload.data?.metadata?.packCredits);
  return CREDIT_PACKS.some((p) => p.credits === credits) ? credits : null;
}

/**
 * Pull the user reference out of a webhook payload: prefer the `userId` we
 * planted in checkout metadata; fall back to the customer email for
 * subscriptions created outside this app's checkout.
 */
export function extractUserRef(payload: DodoWebhookPayload): {
  userId: string | null;
  email: string | null;
} {
  const meta = payload.data?.metadata;
  const userId =
    meta && typeof meta.userId === "string" && meta.userId ? meta.userId : null;
  const email =
    typeof payload.data?.customer?.email === "string" &&
    payload.data.customer.email
      ? payload.data.customer.email
      : null;
  return { userId, email };
}
