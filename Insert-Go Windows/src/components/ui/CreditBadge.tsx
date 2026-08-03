import { useEffect } from "react";
import { totalCredits, useAuthStore } from "@/store/authStore";

/** Background credit re-sync cadence. refreshStatus() is the existing
 *  server-authoritative session read; applyCredits()/applyBalance() already
 *  push instant updates from generate responses — this loop only corrects
 *  cross-device drift. */
const SYNC_MS = 30_000;

/** Color status thresholds on the total spendable balance (daily remaining +
 *  non-expiring add-on): green while comfortable (>10), amber when low
 *  (1–10), red only when exhausted. */
const WARN_REMAINING = 10;

export function creditTier(credits: number): "green" | "amber" | "red" {
  return credits <= 0 ? "red" : credits <= WARN_REMAINING ? "amber" : "green";
}

export function CreditBadge() {
  const user = useAuthStore((s) => s.user);
  const signedIn = useAuthStore((s) => s.token !== null && s.user !== null);

  useEffect(() => {
    if (!signedIn) return;
    const sync = () => void useAuthStore.getState().refreshStatus();
    const id = setInterval(sync, SYNC_MS);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", sync);
    };
  }, [signedIn]);

  if (!signedIn || !user) return null;
  const total = totalCredits(user);
  const daily = user.dailyCreditsRemaining;
  const dailyMax = user.dailyCreditsMax;
  const addOn = user.addOnCredits;
  const tier = creditTier(total);
  const hasBreakdown = daily !== undefined && dailyMax !== undefined;
  return (
    <span
      className={`ig-creditbadge ig-creditbadge--${tier}`}
      role="status"
      aria-live="polite"
      title={
        hasBreakdown
          ? `${daily}/${dailyMax} daily credits (reset 00:00 UTC)` +
            ` · ${addOn ?? 0} add-on credits (never expire)`
          : `${total} credit${total === 1 ? "" : "s"} remaining`
      }
    >
      <i className="fa-solid fa-coins" aria-hidden="true" />
      {total}
      {hasBreakdown && dailyMax > 0 && (
        <span className="ig-creditbadge__bar" aria-hidden="true">
          <span
            className="ig-creditbadge__bar-fill"
            style={{
              width: `${Math.max(0, Math.min(100, (daily / dailyMax) * 100))}%`,
            }}
          />
        </span>
      )}
      <span className="ig-visually-hidden">
        {hasBreakdown
          ? `${total} credits remaining: ${daily} of ${dailyMax} daily, ${addOn ?? 0} add-on`
          : "credits remaining"}
      </span>
    </span>
  );
}
