/**
 * Security audit log — the system of record for CERT-In Direction 4.
 *
 * Direction 4 of CERT-In Directions No. 20(3)/2022 requires logs of all ICT
 * systems to be enabled and maintained securely for a rolling 180 days, within
 * Indian jurisdiction. Vercel's runtime logs and Supabase's own logs expire in
 * days on the plans this project runs on, so `console.error` cannot be the
 * answer — a line that has aged out is a line CERT-In can be told about but not
 * shown. Everything security-relevant goes through this module instead, into the
 * append-only `auditLog` table (supabase-audit-log.sql).
 *
 * Two hard properties, in this order:
 *
 *  1. **It never breaks the request.** An audit write that throws, times out, or
 *     finds an unmigrated database must not turn a working sign-in into a 500.
 *     Every path here swallows and falls back to `console.error`, which is where
 *     the line went before this module existed — degraded, never lost.
 *  2. **It never carries user content.** The SPEC §10 rule that keeps prompt and
 *     response bodies out of logs applies here verbatim, and DPDP §8(5) extends
 *     it: `detail` takes ids, counts, enums and durations. No prompts, no
 *     response text, no email addresses, no tokens, no OTPs.
 *
 * IP and user-agent ARE recorded, and are personal data. They are processed to
 * comply with a legal obligation (Direction 4), not under consent — so they sit
 * in the Class B / statutory-retention bucket of the R-12 classifier and survive
 * a consent withdrawal. The §5 notice has to say so.
 *
 * Edge-safe: the transport is `rpc()` from lib/db.ts, which is `fetch`-only.
 * `/api/ai/generate` runs on the Edge runtime and holds the highest-value events,
 * so anything Node-only here would silently exclude them.
 */

import { after } from "next/server";
import { rpc } from "./db";

/**
 * Event catalogue. Keep it closed: an alert rule (R-03) can only watch event
 * names it knows, so a free-form string is an event nobody is watching. The
 * comment on each line is the CERT-In Annexure I incident type it maps to, which
 * is what the 6-hour filing has to name.
 */
export type AuditEvent =
  // Authentication — "unauthorised access to IT systems", "identity theft"
  | "auth.signin"
  | "auth.otp.request"
  // Billing — "unauthorised access", "data tampering"
  | "billing.webhook.signature_invalid"
  | "billing.webhook.unmatched_user"
  // Managed AI relay — metering bypass, "attacks on applications"
  | "ai.replay_refused"
  | "ai.quota_denied"
  | "ai.metering_failure"
  // Infrastructure — "attacks on servers"
  | "db.permanent_failure"
  // Detection (R-03). Written by the detector when it pages, and read back by
  // audit_log_alerts() as the per-rule cooldown: without a durable record of
  // what was already paged, a live incident re-pages every 5 minutes until the
  // inbox is unreadable, which is its own kind of silence. Always `info` — a
  // detector event that was itself critical would re-trigger the rule that
  // raised it.
  | "alert.raised"
  // Data-principal rights. RESERVED: no call site writes these yet — R-09/R-10/
  // R-11/R-12 add them with the DSR surfaces themselves. They stay declared so
  // the names are fixed before the rules that watch them are written; anything
  // else here has a live call site, and `auth.session.purge` was removed
  // precisely because it never got one.
  | "consent.grant"
  | "consent.withdraw"
  | "dsr.request"
  | "dsr.fulfilled"
  | "account.erasure";

export type AuditSeverity = "info" | "warn" | "critical";
export type AuditOutcome = "success" | "failure" | "denied";

/** Ids, counts, enums, durations. Never user content — see the module header. */
export type AuditDetail = Record<string, string | number | boolean | null>;

interface AuditOptions {
  outcome: AuditOutcome;
  /** Defaults from `outcome`; pass explicitly to escalate to "critical". */
  severity?: AuditSeverity;
  /** Source of ip / user-agent. Omit for events with no inbound request. */
  req?: Request;
  userId?: string | null;
  detail?: AuditDetail;
}

/** Mirrors the `auditLog_detail_len_ck` CHECK. Trim here rather than let the
 *  insert be rejected — a row that lands truncated beats a row that never lands. */
const MAX_DETAIL_CHARS = 2048;
const MAX_UA_CHARS = 512;
/** Longest possible IPv6 form, incl. a scope id. Anything longer is spoofed. */
const MAX_IP_CHARS = 45;

function defaultSeverity(outcome: AuditOutcome): AuditSeverity {
  return outcome === "success" ? "info" : "warn";
}

/**
 * Client IP as seen at the edge.
 *
 * `x-forwarded-for` is a comma-separated chain and the FIRST hop is the client —
 * but it is also client-settable, so this value is evidence of what was claimed,
 * not proof of origin. That is the right thing to store: CERT-In wants what the
 * system observed. Vercel overwrites the header at its edge, so on production the
 * first hop is trustworthy; `x-real-ip` covers other deployments.
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip = first || req.headers.get("x-real-ip")?.trim() || "";
  return ip ? ip.slice(0, MAX_IP_CHARS) : null;
}

function clientUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, MAX_UA_CHARS) : null;
}

/** Serialize `detail`, guaranteeing the result fits the column's CHECK. Drops
 *  keys from the end until it fits rather than truncating the JSON into
 *  something unparseable. */
export function encodeDetail(detail: AuditDetail | undefined): string {
  if (!detail) return "{}";
  const entries = Object.entries(detail);
  while (entries.length > 0) {
    const json = JSON.stringify(Object.fromEntries(entries));
    if (json.length <= MAX_DETAIL_CHARS) return json;
    entries.pop();
  }
  return "{}";
}

async function send(
  event: AuditEvent,
  severity: AuditSeverity,
  outcome: AuditOutcome,
  userId: string | null,
  ip: string | null,
  userAgent: string | null,
  detailJson: string
): Promise<void> {
  try {
    await rpc<{ id: number }>("audit_log_write", {
      p_event: event,
      p_severity: severity,
      p_outcome: outcome,
      p_user_id: userId,
      p_ip: ip,
      p_user_agent: userAgent,
      p_detail: JSON.parse(detailJson) as unknown,
    });
  } catch {
    // Degraded, not lost: the platform log still gets the line, and the daily
    // coverage check (audit_log_coverage) is what surfaces a persistent outage.
    // No `detail` here — it is already bounded, but the fallback sink is the
    // short-retention one and there is no reason to widen what reaches it.
    console.error(
      `[audit] write failed event=${event} outcome=${outcome} severity=${severity}`
    );
  }
}

/**
 * Record one security event. Fire-and-forget by contract — callers must not
 * await it, and it resolves to `void` so they cannot accidentally branch on it.
 *
 * The work is handed to `after()` so it runs once the response has been flushed:
 * on the Edge runtime a bare un-awaited promise can be cancelled when the
 * invocation ends, which would drop exactly the events raised while answering an
 * attack. Outside a request scope (unit tests, scripts) `after()` throws, so the
 * fallback runs it inline.
 */
export function audit(event: AuditEvent, options: AuditOptions): void {
  const { outcome, req, userId = null, detail } = options;
  const severity = options.severity ?? defaultSeverity(outcome);
  const ip = req ? clientIp(req) : null;
  const userAgent = req ? clientUserAgent(req) : null;
  const detailJson = encodeDetail(detail);

  const run = () =>
    void send(event, severity, outcome, userId, ip, userAgent, detailJson);

  try {
    after(run);
  } catch {
    run();
  }
}
