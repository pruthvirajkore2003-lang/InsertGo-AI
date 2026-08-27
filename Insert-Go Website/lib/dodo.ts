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

/**
 * ISO-3166 alpha-2, or null. Guards the one field on this payload that a
 * caller could turn into an arbitrage lever: Dodo serves localized pricing per
 * billing country, so a country picked by the shopper would be a price picked
 * by the shopper. The route only ever passes the CDN's geolocation header, and
 * this narrows whatever arrives to two letters before it reaches the gateway.
 */
function normalizeCountry(value: unknown): string | null {
  const c = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  item: CheckoutItem;
  /**
   * Geolocated billing country (`"IN"`), from the edge header only — NEVER
   * from a request body or the display-currency cookie. Sending it makes Dodo
   * open its localized checkout (₹ for India) deterministically instead of
   * re-guessing from the IP the browser happens to arrive on. Omitted when the
   * header didn't resolve, in which case Dodo localizes on its own.
   */
  country?: string | null;
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

  // Our own order id, minted here so it exists on BOTH sides of the gateway:
  // it rides the return URL (where the browser reports the Google Ads
  // conversion) and the metadata (where the webhook sees it). Google dedups
  // conversions on `transaction_id`, so a buyer who refreshes the return page
  // — or comes back to it — is counted once. Dodo's own payment id would be
  // ideal, but it does not exist yet at the moment this URL has to be built.
  metadata.transactionId = crypto.randomUUID();
  const itemKey =
    input.item.kind === "plan"
      ? `plan:${input.item.tier}`
      : `pack:${input.item.credits}`;
  const returnUrl =
    `${siteUrl}/account?upgraded=1` +
    `&tx=${encodeURIComponent(metadata.transactionId)}` +
    `&item=${encodeURIComponent(itemKey)}`;

  const country = normalizeCountry(input.country);

  const post = (withCountry: boolean) =>
    fetch(`${dodoApiBase()}/checkouts`, {
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
        ...(withCountry ? { billing_address: { country } } : {}),
        return_url: returnUrl,
        metadata,
      }),
    });

  let res = await post(Boolean(country));
  // The country hint is an optimisation, not a requirement: if the gateway
  // rejects the address shape, retry the plain payload rather than turning a
  // localisation nicety into a failed purchase. Dodo still localises from the
  // shopper's own IP on its hosted page.
  if (!res.ok && country) {
    console.warn(
      `[billing] Dodo rejected billing_address (${res.status}); retrying without it`,
    );
    res = await post(false);
  }

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

/**
 * Stop a subscription renewing, keeping the period the customer already paid
 * for. This is the API half of "click to cancel" (Cal. Bus. & Prof. Code
 * §17602(c), FTC ROSCA): the cancellation must complete online, immediately,
 * in the same medium the sign-up happened, with no retention gauntlet.
 *
 * `cancel_at_next_billing_date` — NOT `status: "cancelled"` — is load-bearing.
 * An immediate termination would take away paid-for time, which is both worse
 * for the customer and a contradiction of Terms §6/§7; and the webhook maps
 * `subscription.cancelled` straight to the free tier, so an immediate cancel
 * would strip entitlement the moment the button is pressed. With this field,
 * Dodo emits that event when the period actually ends, and the existing
 * downgrade path is correct without a special case.
 *
 * Throws on any non-2xx. Callers must NOT record a local cancellation unless
 * this resolves: a UI that says "cancelled" over a gateway that kept billing
 * is the precise failure ROSCA penalises.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(
    `${dodoApiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_API_KEY}`,
      },
      body: JSON.stringify({ cancel_at_next_billing_date: true }),
    },
  );
  if (!res.ok) {
    // Status only — the gateway body can echo customer details.
    console.error(`[billing] Dodo cancel failed (${res.status})`);
    throw new Error("cancel-failed");
  }
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
    /** Dodo's id for the subscription. Stored on activation so the account
     *  page's Cancel button has something to cancel. */
    subscription_id?: string | null;
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
 * The subscription id an activation event names, or null.
 *
 * Only read for events that mean "this subscription is live now"; a
 * cancellation must not (re)write the id, or a cancelled subscription stays
 * pointed at by the Cancel button forever. Non-string and empty values are
 * rejected so an absent field can never be stored as `""` — which would look
 * like a subscription to `cancelSubscription` and 404 at the gateway.
 */
export function subscriptionIdForEvent(
  eventType: string,
  payload: DodoWebhookPayload,
): string | null {
  if (
    eventType !== "subscription.active" &&
    eventType !== "subscription.renewed" &&
    eventType !== "subscription.plan_changed"
  ) {
    return null;
  }
  const id = payload.data?.subscription_id;
  return typeof id === "string" && id ? id : null;
}

/**
 * Whether an event means the SUBSCRIPTION ITSELF is gone, so the stored id
 * should be dropped.
 *
 * Deliberately not "the tier went to free". `subscription.on_hold` also
 * demotes — Terms §6 lets us suspend paid features while a failed payment is
 * retried — but the subscription is still alive at the gateway and still
 * retrying the customer's card. Dropping the id there would leave that
 * customer demoted AND unable to stop the retries: the account page has no
 * button to render and `/api/billing/cancel` 409s with nothing to call. A
 * cancellation path that disappears exactly when the customer most wants it is
 * the obstructed cancellation the ARL and ROSCA prohibit.
 *
 * `subscription.failed` is a subscription that never activated, so there is
 * nothing live to keep a handle on.
 */
export function clearsSubscriptionId(eventType: string): boolean {
  return (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.failed"
  );
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
