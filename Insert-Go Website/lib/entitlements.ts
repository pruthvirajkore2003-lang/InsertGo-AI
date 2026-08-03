/**
 * Access gating for `/api/ai/generate`.
 *
 * Two gates, returning a `Denied` (status + message) or null:
 *
 *  - `requireSession` — a valid Better Auth session is mandatory for any
 *    generation. Its 401 message deliberately reads "session has expired" (no
 *    "trial"/"upgrade"/"credit" words) so the desktop maps it to logout, not
 *    the paywall (see aiProviders.ts 401/403 branch).
 *
 *  - `requireGroundingEntitlement` — opt-in web grounding is billed and rate-
 *    limited, so it is gated separately. Its 403 message DOES contain
 *    "upgrade"/"plan" so the client routes it to the trial/upgrade path and
 *    refreshes status.
 *
 * Billing state lives on the `"user"` table (`subscriptionStatus`, `credits`),
 * is written only by the Dodo Payments webhook handler
 * (app/api/billing/webhook), and reaches this module through the
 * `customSession` plugin in lib/auth.ts, which stamps both fields onto the
 * session's `user`. This module stays pure (no DB) so it unit-tests without a
 * database.
 */

/** A rejected request: the HTTP status and the message the client surfaces. */
export type Denied = { status: 401 | 403 | 413 | 429; message: string };

/**
 * Server-side payload caps for `/api/ai/generate`.
 *
 * `MAX_PROMPT_CHARS` mirrors the desktop client's own cap (Windows
 * `src/types/index.ts`), but that one is advisory: a signed-in caller — or a
 * leaked bearer token — can POST the API directly and skip it. The per-user
 * quota bounds request *count*, not token size, so without this a single
 * account can spend the shared server Gemini key at maximum size per call.
 * The system prompt is ours (~2 KB today), so its cap is deliberately tight.
 */
export const MAX_PROMPT_CHARS = 100_000;
export const MAX_SYSTEM_CHARS = 20_000;

/** 413 when the prompt or system prompt exceeds the server-side cap. */
export function requirePayloadWithinLimit(payload: {
  prompt: string;
  system: string;
}): Denied | null {
  if (
    payload.prompt.length > MAX_PROMPT_CHARS ||
    payload.system.length > MAX_SYSTEM_CHARS
  ) {
    return {
      status: 413,
      message:
        `Your input is too long (limit ${MAX_PROMPT_CHARS.toLocaleString()} ` +
        `characters). Shorten it and try again.`,
    };
  }
  return null;
}

export type SubscriptionStatus = "trial" | "subscribed" | "expired";

export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = "trial";
export const DEFAULT_CREDITS = 50;

// ── 3-tier model ───────────────────────────────────────────────────────────
// Free/$0, Plus/$8, Pro/$15. Daily allowance resets at 00:00 UTC (lazily, on
// the next debit/read — no cron); add-on pack credits never expire and are
// consumed only after the daily allowance is gone (lib/usageLimit.ts).

export type Tier = "free" | "plus" | "pro";

export const TIER_DAILY_CREDITS: Record<Tier, number> = {
  free: 5,
  plus: 50,
  pro: 150,
};

/** Interaction history is a paid feature; Free doesn't get it. */
export const tierAllowsHistory = (tier: Tier): boolean => tier !== "free";

/**
 * Coerce a raw `"user"` row into a tier. The `tier` column wins; rows from a
 * pre-3-tier DB (no column) map legacy `subscriptionStatus`: subscribed → pro
 * (they paid for the top plan of the old model), everything else → free.
 * Unknown values collapse to free so a bad row can never widen access.
 */
export function normalizeTier(row: unknown): Tier {
  const r = (row ?? {}) as Record<string, unknown>;
  const t = r.tier;
  if (t === "free" || t === "plus" || t === "pro") return t;
  return r.subscriptionStatus === "subscribed" ? "pro" : "free";
}

/** Today as a `YYYY-MM-DD` UTC date string (the daily-reset boundary). */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Daily allowance remaining, applying the lazy 00:00 UTC reset: a
 * `dailyCreditsDate` older than today means the counter hasn't been touched
 * since the boundary, so nothing is used yet.
 */
export function dailyRemaining(
  row: { dailyCreditsUsed?: unknown; dailyDate?: unknown },
  tier: Tier,
  today: string = utcToday()
): number {
  const max = TIER_DAILY_CREDITS[tier];
  const used =
    row.dailyDate === today && typeof row.dailyCreditsUsed === "number"
      ? row.dailyCreditsUsed
      : 0;
  return Math.max(0, max - used);
}

/**
 * Coerce a raw `"user"` row (or undefined) into safe entitlement values —
 * unknown statuses and non-numeric credits collapse to the trial defaults so a
 * bad row can never widen access beyond a fresh trial.
 */
export function normalizeEntitlements(row: unknown): {
  subscriptionStatus: SubscriptionStatus;
  credits: number;
} {
  const r = (row ?? {}) as Record<string, unknown>;
  const status = r.subscriptionStatus;
  const credits = r.credits;
  return {
    subscriptionStatus:
      status === "trial" || status === "subscribed" || status === "expired"
        ? status
        : DEFAULT_SUBSCRIPTION_STATUS,
    credits:
      typeof credits === "number" && Number.isFinite(credits)
        ? credits
        : DEFAULT_CREDITS,
  };
}

/** Minimal shape of a Better Auth session this module reads. */
type SessionLike = {
  user?: {
    id?: string | null;
    subscriptionStatus?: string | null;
    credits?: number | null;
  } | null;
} | null;

/** 401 unless a valid session is present. */
export function requireSession(session: SessionLike): Denied | null {
  if (!session?.user?.id) {
    return { status: 401, message: "Your session has expired. Please log in again." };
  }
  return null;
}

/**
 * Grounding is billed: entitled when the user is subscribed, or still has
 * trial credits. Sessions from a server without the customSession plugin (or
 * a pre-migration DB) carry no fields — treat those as trial-with-credits so
 * a rollout mismatch degrades to today's behavior instead of locking everyone
 * out.
 */
export function isGroundingEntitled(session: SessionLike): boolean {
  if (!session?.user?.id) return false;
  const { subscriptionStatus, credits } = session.user;
  if (subscriptionStatus == null && credits == null) return true;
  return subscriptionStatus === "subscribed" || (credits ?? 0) > 0;
}

/**
 * 403 when grounding is unavailable for this request: either the server has no
 * grounding model configured (`groundingConfigured` false) or the user isn't
 * entitled. Both messages contain "upgrade"/"plan" so the client shows the
 * paywall path rather than logging the user out.
 */
export function requireGroundingEntitlement(
  session: SessionLike,
  opts: { groundingConfigured: boolean }
): Denied | null {
  if (!opts.groundingConfigured) {
    return {
      status: 403,
      message:
        "Web search grounding isn't available on your plan yet — upgrade to enable it.",
    };
  }
  if (!isGroundingEntitled(session)) {
    return {
      status: 403,
      message: "Upgrade your plan to use web search grounding.",
    };
  }
  return null;
}

/**
 * 429 when a per-user quota window is exhausted. The caller runs the DB-backed
 * counter (lib/usageLimit.ts `consumeQuota`) and passes the `{ allowed }` result
 * here; the pure decision stays in this module so it unit-tests without a DB.
 *
 * The message deliberately avoids "trial"/"upgrade"/"credit": the desktop client
 * maps 429 to its dedicated "rate limited - try again shortly" branch, and those
 * words would misroute it to the paywall path (see aiProviders.ts 401/403 vs 429
 * handling).
 */
export function requireWithinQuota(check: { allowed: boolean }): Denied | null {
  if (check.allowed) return null;
  return {
    status: 429,
    message:
      "You've reached the request limit for now — please wait a little and try again.",
  };
}
