import { audit } from "./auditLog";
import { isPermanentDbFailure } from "./db";
import { safeError } from "./safeLog";

/**
 * Record a failed RPC on a surface that degrades instead of dying.
 *
 * Two rules in one place because both are easy to get subtly wrong at five
 * separate call sites:
 *
 *  1. **The error object never reaches a plain log line.** PostgREST error
 *     bodies echo SQL text and row values, so `safeError` (R-06) is the only
 *     way out — `console.error(e)` here would put a data principal's row in a
 *     log written *by the privacy page*.
 *  2. **A permanent failure leaves a durable row; a transient one does not.**
 *     A wrong service-role key, a missing `security definer` function or
 *     absent config (401/403/404 — `isPermanentDbFailure`) looks exactly like
 *     a healthy app from the outside once the page degrades gracefully, so it
 *     has to page someone: `db.permanent_failure` is what the R-03 burst rule
 *     in supabase-audit-log.sql watches. Timeouts and 5xx stay console-only —
 *     `AuditEvent` has no name for them, and a detector that fires on every
 *     network hiccup is a detector nobody reads.
 *
 * Best-effort by construction: `audit()` is fire-and-forget and itself writes
 * over the same transport, so it stays silent when that transport is the thing
 * that is broken. Never throws — a caller in a `catch` is already the fallback
 * path, and this must not become the reason the page dies after all.
 */
export function noteDbFailure(
  /** Log prefix, e.g. `"privacy"` — the surface, not the user. */
  scope: string,
  /** Enum-ish operation name, e.g. `"consent_current"`. Never user content. */
  stage: string,
  e: unknown,
  userId: string | null = null,
): void {
  safeError(`[${scope}] ${stage} failed`, e);
  if (!isPermanentDbFailure(e)) return;
  audit("db.permanent_failure", {
    outcome: "failure",
    severity: "critical",
    userId,
    detail: { scope, stage },
  });
}
