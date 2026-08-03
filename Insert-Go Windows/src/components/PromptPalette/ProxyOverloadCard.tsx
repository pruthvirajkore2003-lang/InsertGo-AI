/**
 * Transient-relay failure surface. When the managed relay exhausts its retries
 * on a 503 (aiProviders.ts), the raw string —
 *   Provider "Backend Proxy": service is temporarily overloaded - tried 3
 *   times, please retry in a minute.
 * — used to render as red error text, which reads as "your account broke".
 * It is neither an account nor a billing failure, so it gets a wait-and-retry
 * card instead: a 60s cooldown countdown, an always-available Retry, and the
 * explicit reassurance that credits and keys are untouched.
 *
 * Scope is deliberately narrow: only 503 lands here. A permanently broken
 * relay (misconfigured server, RPC functions not deployed) answers 500 and
 * keeps the plain error line — telling someone to wait 60s for a fault that
 * will never clear is worse than telling them nothing.
 *
 * The countdown is advisory — it never fires a request on its own. A generation
 * is a metered action; only the user starts one.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/** The relay's own advice ("retry in a minute"), made literal. */
const COOLDOWN_S = 60;

/**
 * True for the transient relay/provider capacity 503 only. Anchored on the
 * message aiProviders.ts throws — every other provider error keeps the plain
 * error line, because those ARE actionable (bad request, region, quota).
 */
export function isOverloadError(message: string | null | undefined): boolean {
  return typeof message === "string" && /temporarily overloaded/i.test(message);
}

type Props = {
  /** Replays the failed run (promptStore.retryRun). */
  onRetry: () => void;
  /** A run is already in flight — Retry stays visible but inert. */
  busy?: boolean;
};

export function ProxyOverloadCard({ onRetry, busy = false }: Props) {
  const [left, setLeft] = useState(COOLDOWN_S);

  // One self-clearing timeout per tick: no interval to leak, and remounting
  // (a fresh failure) restarts the cooldown from the top.
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const retry = () => {
    setLeft(COOLDOWN_S);
    onRetry();
  };

  const pct = (left / COOLDOWN_S) * 100;

  return (
    <motion.div
      className="ig-overload"
      role="status"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="ig-overload__head">
        <i className="fa-solid fa-cloud-bolt" aria-hidden="true" />
        The AI service is busy right now
      </div>
      <p className="ig-overload__body">
        InsertGo&apos;s relay is briefly unavailable and gave up after a few
        automatic retries. Nothing is wrong with your account — your credits
        and your keys are completely unaffected, and this run was not charged.
        A permanent fault would say so instead of asking you to wait.
      </p>
      {/* Cooldown bar. aria-hidden with a static sentence below it: a
          per-second countdown announced by a screen reader is noise. */}
      <div className="ig-overload__track" aria-hidden="true">
        <span className="ig-overload__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ig-overload__foot">
        <span className="ig-overload__count" aria-hidden="true">
          {left > 0 ? `Best chance in ${left}s` : "Ready to retry"}
        </span>
        <span className="ig-visually-hidden">
          Wait about a minute, then retry.
        </span>
        <button
          type="button"
          className="ig-btn ig-btn--primary"
          onClick={retry}
          disabled={busy}
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          Retry now
        </button>
      </div>
    </motion.div>
  );
}
