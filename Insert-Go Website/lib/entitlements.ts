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
 *
 * Sizing `MAX_PROMPT_CHARS` (24k chars ≈ 6k tokens): a prompt is one skill
 * template plus the user's selection. The largest shipped template is ~6.9 KB
 * (`src/skills/10-reply-with-instructions.md`), which leaves ~17 KB of
 * selection — several pages of pasted text, well past the "grab a paragraph
 * and act on it" workflow the product is built around.
 *
 * The old 100k cap was ~4x the real ceiling and cost real money: paired with an
 * uncapped output it made a single 1-credit call worth ~$0.029 of Gemini spend,
 * which a maxed-out Pro account turns into ~$129/month against $14.99 of
 * revenue. `maxOutputTokens` in lib/gemini.ts closes the larger half of that
 * hole; this closes the input half.
 *
 * Keep in sync with the desktop's own `MAX_PROMPT_CHARS` (Windows
 * `src/types/index.ts`). The client copy is advisory — it exists so an oversize
 * paste fails instantly and locally instead of after a round trip — but if the
 * client's is the larger of the two, users hit a server 413 the client never
 * warned them about.
 */
export const MAX_PROMPT_CHARS = 24_000;
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
 * Grounded runs allowed per tier per UTC day — a SEPARATE budget from
 * `TIER_DAILY_CREDITS`, because a grounded run and a plain one differ in cost
 * by roughly two orders of magnitude.
 *
 * Google bills Search grounding per grounded prompt, not per token: $35 per
 * 1,000 on Gemini 2.5 and $14 per 1,000 on 3.x — i.e. $0.035 / $0.014 a call,
 * against ~$0.0005 for a plain flash-lite generation. Charging both a flat 1
 * credit (which is what the ledger does, and what it should keep doing — the
 * credit is the user-facing unit of work) means the daily credit allowance
 * bounds cost only for the cheap kind. Left ungoverned, a Pro account
 * grounding all 150 daily credits bills ~$157/month against $14.99 of revenue,
 * and a FREE account — entitled under the old `credits > 0` rule — bills ~$5.25
 * a month against nothing at all.
 *
 * So grounding gets its own much smaller daily counter, enforced by the route
 * through the same `consumeQuota` machinery as the burst/daily windows. At a
 * 3.x grounding model these ceilings cost ~$0.84/month (Plus) and ~$2.94/month
 * (Pro) at full use — affordable inside both prices.
 *
 * Free is 0 by design, and this table is the single source of truth for that:
 * `isGroundingEntitled` derives the entitlement from it rather than keeping a
 * second list that could drift.
 *
 * ponytail: flat per-tier ceilings, not a cost-weighted credit multiplier.
 * Pricing grounding at N credits would be the more flexible model, but it needs
 * `debit_credit` (supabase-edge-rpc.sql) to take a cost parameter, and that
 * function's insert-first CTE is the atomicity guarantee the whole ledger rests
 * on. Revisit when a second premium action needs the same treatment.
 */
export const GROUNDED_DAILY_MAX: Record<Tier, number> = {
  free: 0,
  plus: 2,
  pro: 7,
};

/**
 * Whether this tier may ground at all. Derived from `GROUNDED_DAILY_MAX` so the
 * gate and the counter can never disagree.
 *
 * Replaces an earlier `subscriptionStatus === "subscribed" || credits > 0`
 * rule, which entitled every free account (they start with credits) to the most
 * expensive call the service can make. Tier comes from the DB row the debit
 * locked, not from the session — session fields are stamped at login by the
 * customSession plugin and can be stale across an upgrade or downgrade.
 */
export function isGroundingEntitled(tier: Tier): boolean {
  return GROUNDED_DAILY_MAX[tier] > 0;
}

/**
 * 403 when grounding is unavailable for this request: either the server has no
 * grounding model configured (`groundingConfigured` false) or the tier isn't
 * entitled. Both messages contain "upgrade"/"plan" so the client shows the
 * paywall path rather than logging the user out.
 *
 * Exhausting the daily grounded allowance is NOT handled here — that is a 429
 * through `requireWithinQuota`, because it clears on its own and the client
 * must not show a paywall for it.
 */
export function requireGroundingEntitlement(
  tier: Tier,
  opts: { groundingConfigured: boolean }
): Denied | null {
  if (!opts.groundingConfigured) {
    return {
      status: 403,
      message:
        "Web search grounding isn't available on your plan yet — upgrade to enable it.",
    };
  }
  if (!isGroundingEntitled(tier)) {
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
