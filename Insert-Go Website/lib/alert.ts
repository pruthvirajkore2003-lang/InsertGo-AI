/**
 * Operator alerts for events that must not sit in a log file.
 *
 * One call site today: the billing webhook's PACK GRANT LOST branch — money
 * taken, credits never granted — which knew it was critical ("must page someone
 * rather than vanish into a log line") and then console.error'd into the void.
 *
 * NOT usable from app/api/ai/generate: that route runs on the Edge runtime and
 * its whole dependency graph is deliberately `fetch`-only, so pulling the Resend
 * SDK in there would break the property that keeps it scalable. Its refused-replay
 * branch (`[ai/generate] replay refused …`, the server-side signature of a
 * metering bypass) stays a log line — alert on it with a log-drain rule.
 *
 * Deliberately thin: it reuses the Resend transport lib/auth.ts already
 * configures, adds no dependency and no schema. Fire-and-forget — an alert that
 * fails must never fail the request that raised it — and never awaited, so it
 * cannot add latency to a webhook Dodo is timing.
 *
 * Privacy (SPEC §10): callers pass event type, ids and counts. No emails, no
 * prompt/response bodies, no tokens — the same rule the log lines follow.
 *
 * ponytail: email is the whole delivery mechanism. Point OPS_ALERT_TO at a
 * PagerDuty/Opsgenie intake address if these ever need to page rather than
 * arrive.
 */

/** Dedup window: a metering-bypass loop can raise the same alert dozens of
 *  times a minute, and burying the inbox is its own kind of silence. Per
 *  instance, which is enough — the point is to stop a flood, not to be exact. */
const DEDUP_MS = 5 * 60 * 1000;
const lastSent = new Map<string, number>();

export function alertOps(subject: string, detail: string): void {
  const now = Date.now();
  const previous = lastSent.get(subject);
  if (previous !== undefined && now - previous < DEDUP_MS) return;
  lastSent.set(subject, now);
  // The map only grows on distinct subjects (a small, fixed set today), but
  // sweep anyway so a future caller templating ids into the subject can't leak.
  if (lastSent.size > 500) {
    for (const [k, at] of lastSent) if (now - at > DEDUP_MS) lastSent.delete(k);
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.OPS_ALERT_TO;
  if (!key || !to) {
    // Unconfigured is not silent: the line still lands in the platform log,
    // which is exactly where it was before this module existed.
    console.error(`[alert] ${subject}: ${detail}`);
    return;
  }

  void import("resend")
    .then(({ Resend }) =>
      new Resend(key).emails.send({
        from: process.env.EMAIL_FROM ?? "InsertGo <onboarding@resend.dev>",
        to,
        subject: `[InsertGo] ${subject}`,
        text: `${detail}\n\nEnvironment: ${process.env.NODE_ENV ?? "unknown"}`,
      }),
    )
    // The SDK reports failures in `error` rather than throwing, but either way
    // the fallback is the same: get the line into the log.
    .then((res) => {
      if (res?.error) console.error(`[alert] delivery failed: ${subject}`);
    })
    .catch(() => console.error(`[alert] delivery failed: ${subject}`));
}
