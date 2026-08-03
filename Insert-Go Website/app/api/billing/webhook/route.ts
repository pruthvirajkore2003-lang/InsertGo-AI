/**
 * POST /api/billing/webhook — Dodo Payments event receiver.
 *
 * Point the Dodo dashboard webhook at this route and subscribe to the
 * subscription.* events. Every request is verified against
 * DODO_WEBHOOK_SECRET (Standard Webhooks HMAC over the raw body) before any
 * parsing side effects; unverified requests get 401 and touch nothing.
 *
 * Handled events:
 *   subscription.active | renewed | plan_changed  → tier from metadata.planTier
 *   subscription.cancelled | expired | failed | on_hold → tier 'free'
 *   payment.succeeded with metadata.packCredits   → addOnCredits += pack
 * Tier writes are plain idempotent UPDATEs, so Dodo's retries (same
 * webhook-id redelivered) are naturally safe. Pack grants are increments, so
 * they dedup through a "creditLedger" row keyed `dodo:<webhook-id>` — a
 * redelivered event can never double-credit. User attribution prefers the
 * `metadata.userId` planted at checkout, falling back to the customer email.
 * Unmatched or unhandled events are acknowledged with 200 so Dodo doesn't
 * retry them forever.
 */
import { pool } from "@/lib/pgPool";
import { alertOps } from "@/lib/alert";
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import {
  eventTimestampSeconds,
  extractUserRef,
  packCreditsForEvent,
  tierForSubscriptionEvent,
  verifyWebhookSignature,
  type DodoWebhookPayload,
} from "@/lib/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dodo subscription/payment payloads are a few KB; cap generously. This bounds
 *  the read for an UNAUTHENTICATED caller — the body is buffered before the HMAC
 *  check can run, so without a cap a large chunked POST is a memory-DoS lever. */
const MAX_WEBHOOK_BYTES = 65_536; // 64 KiB

/** Tier write, guarded by the event-time watermark. `match` is a literal from
 *  this module (never request data); the values ride as $1..$4 placeholders. */
const setTierSql = (match: string) => `
  update "user"
     set "tier" = $1, "subscriptionStatus" = $2, "updatedAt" = now(),
         "billingEventAt" = coalesce(to_timestamp($4::double precision), "billingEventAt")
   where ${match}
     and ($4::double precision is null
          or "billingEventAt" is null
          or "billingEventAt" <= to_timestamp($4::double precision))`;

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration: never process unverifiable events.
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await readBodyCapped(req, MAX_WEBHOOK_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return Response.json({ error: "Payload too large." }, { status: 413 });
    }
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }
  // Read once: this same id is the idempotency key for the pack grant below,
  // and verification is what guarantees it is non-empty.
  const webhookId = req.headers.get("webhook-id") ?? "";
  const ok = verifyWebhookSignature({
    rawBody,
    webhookId,
    webhookTimestamp: req.headers.get("webhook-timestamp") ?? "",
    webhookSignature: req.headers.get("webhook-signature") ?? "",
    secret,
  });
  if (!ok) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = typeof payload.type === "string" ? payload.type : "";
  const nextTier = tierForSubscriptionEvent(eventType, payload);
  const packCredits = packCreditsForEvent(eventType, payload);
  if (nextTier === null && packCredits === null) {
    // Not an event we act on — acknowledge so it isn't retried.
    console.log(`[billing] ignoring unhandled event type: ${eventType}`);
    return Response.json({ received: true });
  }

  const { userId, email } = extractUserRef(payload);
  if (!userId && !email) {
    console.error(`[billing] ${eventType} event carried no user reference`);
    return Response.json({ received: true });
  }

  try {
    if (nextTier !== null) {
      // Legacy subscriptionStatus rides along for pre-3-tier clients.
      const legacyStatus = nextTier === "free" ? "expired" : "subscribed";
      // Last-write-wins by EVENT time, not delivery time: a redelivered
      // `subscription.active` must not resurrect a tier a later `cancelled`
      // already took away. `$4 is null` (payload without a timestamp) keeps
      // the unguarded behaviour and leaves the watermark untouched.
      const eventAt = eventTimestampSeconds(payload);
      const result = await pool.query(
        setTierSql(userId ? '"id" = $3' : '"email" = $3'),
        [nextTier, legacyStatus, userId ?? email, eventAt],
      );
      if (result.rowCount === 0) {
        // Log ref presence only — keep emails out of server logs.
        console.error(
          `[billing] ${eventType}: no-op — unmatched user or stale event (byId=${Boolean(userId)})`,
        );
      } else {
        console.log(`[billing] ${eventType} → tier ${nextTier}`);
      }
    }

    if (packCredits !== null) {
      // Increment must dedup across Dodo redeliveries: the grant only lands
      // when the `dodo:<webhook-id>` ledger key inserts for the first time
      // (negative amount = credits granted — the same table the account page
      // lists purchases from).
      const grantKey = `dodo:${webhookId}`;
      const result = await pool.query(
        `with target as (
           select "id" from "user"
            where ($2::text is not null and "id" = $2)
               or ($2::text is null and "email" = $3)
            limit 1
         ),
         ins as (
           insert into "creditLedger" ("idempotencyKey", "userId", "amount")
           select $1, "id", $4 from target
           on conflict ("idempotencyKey") do nothing
           returning "userId"
         )
         update "user" u
            set "addOnCredits" = u."addOnCredits" + $5, "updatedAt" = now()
           from ins
          where u."id" = ins."userId"`,
        [grantKey, userId, email, -packCredits, packCredits],
      );
      if (result.rowCount === 0) {
        // Zero rows is either a redelivery (fine) or an unmatched user (money
        // taken, nothing granted). Only the ledger can tell them apart, and
        // the second one must page someone rather than vanish into a log line.
        const seen = await pool.query(
          'select 1 from "creditLedger" where "idempotencyKey" = $1',
          [grantKey],
        );
        if (seen.rowCount === 0) {
          console.error(
            `[billing] ${eventType}: PACK GRANT LOST — no user matched (byId=${Boolean(userId)}, credits=${packCredits})`,
          );
          // The customer paid and got nothing. A log line means they find out
          // before we do — page someone. Ref presence only, never the email.
          alertOps(
            "Pack grant lost",
            `${eventType} carried no matching user (byId=${Boolean(userId)}), ` +
              `so ${packCredits} paid credits were never granted. ` +
              `webhook-id=${webhookId}`,
          );
        } else {
          console.log(`[billing] ${eventType}: pack grant deduped (redelivery)`);
        }
      } else {
        console.log(`[billing] ${eventType} → +${packCredits} add-on credits`);
      }
    }
  } catch (e) {
    // Never dump the raw pg error: its `detail`/`where` fields echo the failing
    // statement's parameter values, which here include the customer email.
    const err = e as { code?: string; message?: string };
    console.error(
      `[billing] webhook DB update failed (${err.code ?? "?"}): ${err.message ?? "unknown"}`,
    );
    // 500 → Dodo retries with backoff; both writes are idempotent.
    return Response.json({ error: "Processing failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
