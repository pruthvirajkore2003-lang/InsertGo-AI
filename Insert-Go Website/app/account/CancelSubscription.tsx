"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Click to cancel", the UI half.
 *
 * California's ARL (Bus. & Prof. Code §17602, AB 2863) and the FTC's ROSCA
 * rule both measure cancellation against sign-up: it must be online, in the
 * same medium, and take no more steps. Signing up here is two clicks (choose a
 * plan → pay), so cancelling is two: this button, then one confirmation.
 *
 * What is deliberately absent is as load-bearing as what is here. No reason
 * field, no "are you sure you want to lose X" carousel, no downgrade offer
 * ahead of the confirm, no support link presented as the way out, no "call us"
 * anywhere. Each of those is a documented dark pattern under the CCPA's 2023
 * Guidelines and turns a compliant flow into an obstructed one. If someone
 * later wants a save-offer, it belongs AFTER the cancellation has gone
 * through, never in front of it.
 */
export function CancelSubscription({
  tier,
  cancelAtPeriodEnd,
  suspended = false,
}: {
  /** Display label of the paid plan ("Plus" / "Pro"). */
  tier: string;
  /** Already cancelled and running out the paid period. */
  cancelAtPeriodEnd: boolean;
  /**
   * The subscription is live at the gateway but the account is demoted — a
   * failed payment Dodo is still retrying (`subscription.on_hold`). There is
   * no paid period left to run out, so every "you keep X until…" line here
   * would be false; what the customer needs is the button that stops the
   * retries. Hiding it in this state is precisely the obstruction the ARL
   * forbids, so the control stays and only the copy changes.
   */
  suspended?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(cancelAtPeriodEnd);

  if (done) {
    return (
      <div className="glass-chip rounded-2xl px-4 py-3">
        <p className="m-0 text-sm font-medium text-ink">
          {suspended
            ? "Cancelled — nothing further will be charged"
            : "Cancels at the end of your billing period"}
        </p>
        <p className="mt-1 mb-0 text-xs text-muted">
          {suspended
            ? "The failed payment will not be retried. "
            : `No further charges will be taken. You keep ${tier} until the period you have already paid for ends, then the account returns to Free. `}
          Your credit packs are unaffected — they never expire.
        </p>
      </div>
    );
  }

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        cancelled?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.cancelled) {
        setError(data?.error ?? "Could not cancel — please try again.");
        setBusy(false);
        return;
      }
      setDone(true);
      // Re-read the server state so the plan card and this panel agree.
      router.refresh();
    } catch {
      setError("Could not cancel — please try again.");
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="glass-chip flex h-11 w-full items-center justify-center rounded-2xl text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-muted/10"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    // role="group" + aria-labelledby so a screen reader announces what the two
    // buttons decide, rather than reading "Yes, cancel" out of context.
    <div
      role="group"
      aria-labelledby="cancel-confirm-q"
      className="glass-chip rounded-2xl px-4 py-3"
    >
      <p id="cancel-confirm-q" className="m-0 text-sm text-ink">
        {suspended
          ? "Are you sure you want to cancel this subscription?"
          : `Are you sure you want to cancel your ${tier} renewal?`}
      </p>
      <p className="mt-1 mb-0 text-xs text-muted">
        {suspended
          ? "The payment that failed will not be retried, and nothing further will be charged."
          : "Your benefits will remain active until the end of your billing cycle. Nothing further will be charged."}
      </p>
      {error && (
        <p role="alert" className="mt-2 mb-0 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void cancel()}
          className="flex h-10 flex-1 items-center justify-center rounded-2xl bg-danger text-sm font-medium text-white transition-[filter] duration-200 hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="flex h-10 flex-1 items-center justify-center rounded-2xl text-sm font-medium text-ink transition-colors duration-200 hover:bg-muted/10 disabled:opacity-60"
        >
          {suspended ? "Keep it" : `Keep ${tier}`}
        </button>
      </div>
    </div>
  );
}
