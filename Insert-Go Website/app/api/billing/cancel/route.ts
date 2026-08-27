/**
 * POST /api/billing/cancel — the user cancels their own subscription.
 *
 * This route is a legal obligation before it is a feature. California's
 * Automatic Renewal Law (Bus. & Prof. Code §17602(c), as amended by AB 2863)
 * and the FTC's ROSCA rule both require that a subscription bought online can
 * be cancelled online, immediately, by the consumer, without talking to
 * anybody and in no more steps than signing up took. So: one authenticated
 * POST, no body, no reason field, no retention offer, no "are you sure" chain
 * beyond the single confirmation the UI shows.
 *
 * Cancellation is at PERIOD END, not immediate — the customer keeps what they
 * paid for (Terms §6/§7). `cancelSubscription` asks Dodo to stop the next
 * charge; Dodo emits `subscription.cancelled` when the period actually
 * elapses, and the existing webhook downgrades the tier then.
 *
 * Ordering is deliberate: gateway first, database second. A local flag written
 * over a failed gateway call would tell the user they had cancelled while the
 * card kept being charged, which is the exact harm the statutes exist for. The
 * reverse (gateway succeeded, local write failed) is recoverable — the webhook
 * still lands and the user is not billed again.
 */
import { auth } from "@/lib/auth";
import { pool } from "@/lib/pgPool";
import { audit } from "@/lib/auditLog";
import { requireSession, requireWithinQuota, type Denied } from "@/lib/entitlements";
import { consumeQuota } from "@/lib/usageLimit";
import { cancelSubscription, dodoCheckoutConfigured } from "@/lib/dodo";

// pg + the outbound Dodo call need Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function denied(d: Denied): Response {
  return errorResponse(d.status, d.message);
}

export async function POST(req: Request): Promise<Response> {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    session = null;
  }
  const denySession = requireSession(session);
  if (denySession) return denied(denySession);
  const userId = session!.user.id;

  // Bound it like checkout: an outbound gateway call held open by a leaked
  // bearer token is the same DoS lever either way. The ceiling is generous on
  // purpose — a cancellation must never be the request that gets rate-limited
  // away, so this only stops scripted abuse, not a person clicking twice.
  try {
    const quota = await consumeQuota(userId, "cancel:hour", 20, 3_600);
    const denyQuota = requireWithinQuota(quota);
    if (denyQuota) return denied(denyQuota);
  } catch (e) {
    // Fail OPEN. A metering outage must never be the thing standing between a
    // customer and cancelling — that is precisely the "obstructed
    // cancellation" ROSCA and the ARL prohibit.
    console.error(
      "[billing] cancel quota check failed; allowing:",
      e instanceof Error ? e.message : String(e),
    );
  }

  if (!dodoCheckoutConfigured()) {
    return errorResponse(503, "Billing isn't configured yet.");
  }

  // The subscription id comes from OUR row, written by the webhook from the
  // gateway's own event — never from the request body. A client-supplied id
  // would let any signed-in user cancel a stranger's subscription.
  let subscriptionId: string | null = null;
  let alreadyCancelling = false;
  try {
    const { rows } = await pool.query<{
      dodoSubscriptionId: string | null;
      cancelAtPeriodEnd: boolean;
    }>(
      'select "dodoSubscriptionId", "cancelAtPeriodEnd" from "user" where "id" = $1',
      [userId],
    );
    subscriptionId = rows[0]?.dodoSubscriptionId ?? null;
    alreadyCancelling = rows[0]?.cancelAtPeriodEnd ?? false;
  } catch (e) {
    console.error(
      "[billing] cancel lookup failed:",
      e instanceof Error ? e.message : String(e),
    );
    return errorResponse(500, "Could not reach your subscription — please try again.");
  }

  // Idempotent: a second click, or a refresh, is a success and not an error.
  if (alreadyCancelling) {
    return Response.json({ cancelled: true, alreadyCancelling: true });
  }

  if (!subscriptionId) {
    // No recurring charge exists to stop. Distinguish it from a failure so the
    // UI can say something true instead of "try again".
    return errorResponse(
      409,
      "There's no active subscription on this account to cancel.",
    );
  }

  try {
    await cancelSubscription(subscriptionId);
  } catch {
    return errorResponse(
      502,
      "We couldn't cancel with our payment provider just now. Please try " +
        "again — if it keeps failing, email support@insertgo.ai and we will " +
        "cancel it for you and refund any charge taken in the meantime.",
    );
  }

  try {
    await pool.query(
      'update "user" set "cancelAtPeriodEnd" = true, "updatedAt" = now() where "id" = $1',
      [userId],
    );
  } catch (e) {
    // The renewal IS stopped — Dodo accepted it. Losing the local flag only
    // costs the account page its "Cancels at period end" badge until the
    // webhook lands, so report success rather than inviting a retry that
    // would suggest the cancellation had not happened.
    console.error(
      "[billing] cancel flag write failed after gateway success:",
      e instanceof Error ? e.message : String(e),
    );
  }

  // Evidence. An ARL/ROSCA dispute is decided on whether cancellation was
  // available and honoured; a durable, timestamped record of the request is
  // the cheapest form of that proof. Ids only — no email, per SPEC §10.
  audit("billing.subscription.cancelled", {
    outcome: "success",
    req,
    userId,
    detail: { atPeriodEnd: true },
  });

  return Response.json({ cancelled: true, alreadyCancelling: false });
}
