/**
 * Incident detection rules — what starts the CERT-In 6-hour clock (R-03).
 *
 * CERT-In Direction 2 requires a reportable incident to be filed within 6 hours
 * of **noticing** it. Nothing here shortens that window; what it does is make
 * "noticing" happen on a 5-minute cadence instead of whenever someone next reads
 * a log. An incident found three weeks later during a support ticket was, on the
 * regulator's reading, noticed then — the filing is late by three weeks and the
 * 180-day evidence window may already have rolled past the start of it.
 *
 * R-02 made the events durable. This module is the part that reads them.
 *
 * Split of responsibility with supabase-audit-log.sql: the SQL reports facts
 * (one aggregate per candidate group, plus when that group was last paged), and
 * every *decision* — threshold, cooldown, incident type — lives here, because a
 * rule that never fires and a rule that always fires look identical in
 * production and the difference has to be visible to a unit test.
 */

/** One aggregate row from `audit_log_alerts()`. */
export interface AlertCandidate {
  rule: string;
  subject: string | null;
  /** PostgREST returns bigint as a JSON number; counts here are far below 2^53. */
  events: number;
  /** First occurrence inside the window; null for rules that aren't event bursts. */
  since: string | null;
  /**
   * Minutes since this exact (rule, subject) was last paged; null if never.
   *
   * An age rather than a timestamp on purpose: Postgres subtracts against the
   * same clock that wrote the row, so the cooldown never depends on the Vercel
   * and Supabase clocks agreeing (R-05).
   */
  alertedMinutesAgo: number | null;
}

export interface AlertRule {
  /**
   * CERT-In Annexure I incident type. The 6-hour filing has to name one, so the
   * page carries it — an operator woken at 3am should not have to derive it.
   */
  incidentType: string;
  /** Fires at `events >= threshold`, or at `events < threshold` when `silence`. */
  threshold: number;
  /**
   * Inverts the comparison: the rule fires on too FEW events, not too many.
   * Only `coverage.gap` uses it — silence in a log is a failure mode, and it is
   * the one failure mode that looks exactly like good news.
   */
  silence?: boolean;
  /** Minutes before the same (rule, subject) may page again. */
  cooldownMinutes: number;
  /** One line of what happened, for the page subject. */
  summary: string;
}

/**
 * The rule table.
 *
 * Thresholds are set against what this estate actually produces, not generic
 * severity. Two failure modes to keep in view when editing: a threshold set too
 * low pages on normal product usage until the pages are ignored, and one set too
 * high is indistinguishable from having no rule at all.
 */
export const ALERT_RULES: Record<string, AlertRule> = {
  // One is enough by construction: a call site declares `severity: 'critical'`
  // only for events that are never routine (forged webhook signature, refused
  // replay). If this ever pages on noise, the call site is miscategorised —
  // fix it there, not by raising the threshold here.
  critical: {
    incidentType: "Unauthorised access to IT systems / data",
    threshold: 1,
    cooldownMinutes: 15,
    summary: "critical security event recorded",
  },
  // Credential stuffing: one password sprayed across many accounts from few
  // addresses. 10 failures from a single address in the window is well past
  // anything a real person does with a 6-digit code.
  "auth.signin.ip": {
    incidentType: "Identity theft, spoofing and phishing attacks",
    threshold: 10,
    cooldownMinutes: 60,
    summary: "repeated sign-in failures from one address",
  },
  // The other shape: one account attacked from many addresses. Lower, because
  // Better Auth already caps a single OTP at 3 attempts, so reaching 5 means
  // the attacker is requesting fresh codes — that is targeted, not fat-fingered.
  "auth.signin.account": {
    incidentType: "Identity theft, spoofing and phishing attacks",
    threshold: 5,
    cooldownMinutes: 60,
    summary: "repeated sign-in failures against one account",
  },
  // Both of the next two are written as `critical` today, so the `critical`
  // rule pages first and these stay dormant (the SQL excludes critical rows
  // from them). They exist so a future demotion of either call site does not
  // silently remove detection with it.
  "burst.billing.webhook.signature_invalid": {
    incidentType: "Unauthorised access to IT systems / data",
    threshold: 5,
    cooldownMinutes: 60,
    summary: "burst of invalid billing webhook signatures",
  },
  "burst.ai.replay_refused": {
    incidentType: "Attacks on applications such as API",
    threshold: 20,
    cooldownMinutes: 60,
    summary: "burst of refused idempotency-key replays",
  },
  "burst.db.permanent_failure": {
    incidentType: "Attacks on servers and network devices",
    threshold: 5,
    cooldownMinutes: 60,
    summary: "sustained permanent database failures",
  },
  // Not an Annexure I incident — a control failure, and the one that makes
  // every other rule here worthless. Zero events in 24h in a system that
  // authenticates users daily means the sink is down, not that the estate was
  // quiet. Daily cooldown: it is a standing condition, not an event.
  "coverage.gap": {
    incidentType: "Logging failure — CERT-In Direction 4 evidence at risk",
    threshold: 1,
    silence: true,
    cooldownMinutes: 24 * 60,
    summary: "no audit events recorded in 24 hours",
  },
};

/**
 * A rule the SQL emits that this table does not know. Deliberately fires rather
 * than being dropped: the two sides ship together, so an unmapped rule means a
 * deploy skew, and a detector that silently ignores half its input is the exact
 * thing this module exists to prevent.
 */
const UNMAPPED: AlertRule = {
  incidentType: "Unclassified — detector rule has no mapping",
  threshold: 1,
  cooldownMinutes: 60,
  summary: "unmapped detector rule fired",
};

export interface Firing {
  rule: string;
  subject: string;
  events: number;
  incidentType: string;
  /** Page subject. Stable per (rule, subject) so alertOps' dedup can key on it. */
  title: string;
  /** Page body. Ids, counts and timestamps only — never user content. */
  body: string;
}

function cooledDown(minutesAgo: number | null, cooldownMinutes: number): boolean {
  // Never paged, or a value that isn't a usable number: suppression is the
  // dangerous default, so anything unreadable pages.
  if (minutesAgo === null || !Number.isFinite(minutesAgo)) return true;
  return minutesAgo >= cooldownMinutes;
}

/**
 * Decide which candidates page.
 *
 * Pure, and now clock-free: every time comparison was done in Postgres against
 * the clock that wrote the rows, so nothing here reads a clock at all.
 */
export function evaluateAlerts(
  candidates: readonly AlertCandidate[],
  windowMinutes: number,
): Firing[] {
  const firing: Firing[] = [];
  for (const c of candidates) {
    const rule = ALERT_RULES[c.rule] ?? UNMAPPED;
    const events = Number.isFinite(c.events) ? c.events : 0;
    const breached = rule.silence ? events < rule.threshold : events >= rule.threshold;
    if (!breached) continue;
    if (!cooledDown(c.alertedMinutesAgo, rule.cooldownMinutes)) continue;

    const subject = c.subject ?? "(none)";
    firing.push({
      rule: c.rule,
      subject,
      events,
      incidentType: rule.incidentType,
      title: `${rule.summary} [${c.rule}]`,
      body: [
        `Rule:          ${c.rule}`,
        `Subject:       ${subject}`,
        `Events:        ${events} (threshold ${rule.silence ? "<" : "≥"} ${rule.threshold} over ${windowMinutes}m)`,
        `First seen:    ${c.since ?? "n/a"}`,
        `Incident type: ${rule.incidentType}`,
        "",
        "CERT-In Direction 2: 6 hours from noticing. That clock started when this",
        "page was sent. File on partial facts if the picture is not yet complete —",
        "supplements are expected, the six hours are not extendable. Runbook:",
        "compliance/incident-runbook.md (R-17).",
      ].join("\n"),
    });
  }
  return firing;
}
