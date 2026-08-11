/**
 * GET /api/internal/detect — the thing that notices (R-03).
 *
 * CERT-In Direction 2 gives 6 hours from **noticing** a reportable incident.
 * R-02 made security events durable in the append-only `auditLog`; nothing read
 * them. This route is the reader: every 5 minutes it asks Postgres for the
 * current alert candidates in one round trip, applies the rule table in
 * lib/detect.ts, and pages the R-16 Point of Contact for anything that breaches.
 *
 * Five minutes is immaterial against a 6-hour deadline, which is why a Vercel
 * Cron hitting a plain route handler is the whole design — no queue, no new
 * service, no paging dependency. Delivery reuses lib/alert.ts; point
 * OPS_ALERT_TO at a PagerDuty/Opsgenie intake when email stops being enough.
 *
 * REQUIRES the Vercel plan to actually run minute-level crons. On Hobby, cron
 * expressions are coerced to once per day, which turns a 6-hour obligation into
 * a ~24-hour one — see compliance/log-retention.md §10.
 *
 * Not a dead-man's switch. If the cron itself stops firing, nothing here
 * notices; the `coverage.gap` rule catches a dead *sink*, not a dead *reader*.
 * That gap closes with an external uptime monitor calling this route — a manual
 * step recorded against R-03, not something the app can self-host.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { alertOps } from "@/lib/alert";
import { audit } from "@/lib/auditLog";
import { rpc } from "@/lib/db";
import { evaluateAlerts, type AlertCandidate } from "@/lib/detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lookback for the aggregation. Twice the 5-minute cadence, so a run that is
 *  skipped or retried cannot leave a hole between windows. */
const WINDOW_MINUTES = 10;
/** How far back the SQL looks for prior pages. Must be >= the longest cooldown
 *  in lib/detect.ts (24h) or that cooldown silently shortens to this. */
const LOOKBACK_MINUTES = 24 * 60;

/** Constant-time secret compare. Digesting first fixes both sides at 32 bytes,
 *  so `timingSafeEqual` cannot throw on a length mismatch — and the length of
 *  the configured secret never leaks through an early return. */
function secretMatches(presented: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(presented).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function GET(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed, loudly. An unauthenticated detector is a free read of the
    // security posture of the estate; an absent one is a 6-hour clock that
    // never starts. Both are wrong, so refuse and say which.
    console.error("[detect] CRON_SECRET is not set — detection is NOT running");
    return Response.json({ error: "Detector not configured." }, { status: 503 });
  }
  const presented = req.headers.get("authorization") ?? "";
  if (!secretMatches(presented, `Bearer ${expected}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let candidates: AlertCandidate[];
  try {
    candidates = await rpc<AlertCandidate>("audit_log_alerts", {
      p_window_minutes: WINDOW_MINUTES,
      p_lookback_minutes: LOOKBACK_MINUTES,
    });
  } catch {
    // The detector is blind. It cannot record that in the store it just failed
    // to read, so this one goes straight to the operator — a silent detector
    // and a quiet estate are indistinguishable from the outside, which is the
    // failure this whole item exists to remove.
    alertOps(
      "detector unavailable [detect.rpc_failed]",
      "audit_log_alerts() did not answer. Security-event detection is DOWN and " +
        "the CERT-In 6-hour clock will not start on its own. Check SUPABASE_URL / " +
        "SUPABASE_SERVICE_ROLE_KEY and that supabase-audit-log.sql is applied.",
    );
    return Response.json({ error: "Detection unavailable." }, { status: 503 });
  }

  const firing = evaluateAlerts(candidates, WINDOW_MINUTES);
  for (const f of firing) {
    alertOps(f.title, f.body);
    // Durable cooldown: audit_log_alerts() reads these back, so a live incident
    // pages once per cooldown instead of every 5 minutes forever. Also the
    // record R-17's incident register wants — when we noticed, and what of.
    audit("alert.raised", {
      outcome: "success",
      detail: {
        rule: f.rule,
        subject: f.subject,
        events: f.events,
        incidentType: f.incidentType,
      },
    });
  }

  return Response.json({
    checked: candidates.length,
    firing: firing.length,
    rules: firing.map((f) => f.rule),
  });
}
