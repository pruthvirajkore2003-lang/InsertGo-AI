"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { FadeUp } from "@/components/Reveal";
import { packs, plans, type Currency } from "@/lib/pricing";

/**
 * 3-tier pricing + non-expiring add-on credit packs.
 *
 * Conversion layout: Plus is the visual anchor ("Most popular", dark card,
 * middle position) so Free reads as the on-ramp and Pro as headroom. Packs
 * carry per-credit unit pricing so the larger packs sell themselves; the
 * comparison matrix answers "what exactly do I get" without leaving the page.
 * Checkout goes through /api/billing/checkout (server-pinned products —
 * nothing money-shaped leaves this file).
 *
 * The plans/packs catalog lives in lib/pricing.ts because the desktop app
 * reads the same data over /api/desktop/pricing — this page is one renderer of
 * it, not the source of truth. The comparison matrix stays here: it is page
 * layout, not catalog.
 */

export type { Currency };

const SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

/** "$0", "$7.99", "₹499" — decimals only when the price actually has them. */
function money(amount: number, currency: Currency): string {
  return `${SYMBOL[currency]}${
    Number.isInteger(amount) ? amount : amount.toFixed(2)
  }`;
}

const matrix: { label: string; values: [string, string, string] }[] = [
  { label: "Daily credits", values: ["5", "50", "150"] },
  { label: "Inline prompt optimization", values: ["✓", "✓", "✓"] },
  { label: "Works in every Windows app", values: ["✓", "✓", "✓"] },
  { label: "Managed AI — no API key setup", values: ["✓", "✓", "✓"] },
  { label: "Interaction history", values: ["—", "✓", "✓"] },
  { label: "Add-on credit packs", values: ["✓", "✓", "✓"] },
  { label: "High-volume capacity", values: ["—", "—", "✓"] },
  { label: "Support", values: ["Community", "Standard", "Priority"] },
];

/** Cents read naturally for USD; rupee sub-units don't, so INR stays in ₹. */
function perCredit(
  amount: number,
  credits: number,
  currency: Currency
): string {
  return currency === "INR"
    ? `₹${(amount / credits).toFixed(2)} / credit`
    : `${((amount / credits) * 100).toFixed(1)}¢ / credit`;
}

/** Rendered directly beneath whichever grid the failed button lives in. */
function CheckoutError({ text }: { text: string }) {
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      className="mx-auto mt-5 max-w-[420px] rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-center text-sm text-danger"
    >
      {text}
    </motion.p>
  );
}

export function PricingPlans({ currency }: { currency: Currency }) {
  const [busy, setBusy] = useState<string | null>(null);
  // Which control the failure belongs to. A single alert pinned under the
  // plans meant a failed pack purchase reported itself two sections above the
  // button that was pressed — off-screen, so the click looked like a no-op.
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null
  );
  const isPack = (key: string) => key.startsWith("pack-");

  /** POST the catalog selector; the server owns products and prices. */
  const checkout = async (
    key: string,
    body: { tier: "plus" | "pro" } | { pack: number }
  ) => {
    setBusy(key);
    setError(null);
    const fail = (message: string) => setError({ key, message });
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.url) {
        fail(data?.error ?? "Could not start checkout — please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      fail("Could not start checkout — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* ── Plans ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1080px] px-6 pt-[50px] pb-10">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] items-stretch gap-5">
          {plans.map((p, i) => (
            <FadeUp key={p.name} delay={0.22 + i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className={`relative flex h-full flex-col p-8 px-7 ${
                  p.dark ? "glass-floating" : "glass-card"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-[5px] text-[11px] font-medium tracking-[0.1em] whitespace-nowrap text-ink uppercase">
                    Most popular
                  </span>
                )}
                <h2
                  className={`m-0 font-serif text-xl font-semibold ${
                    p.dark ? "text-on-accent" : "text-ink"
                  }`}
                >
                  {p.name}
                </h2>
                <p className="mt-1.5 mb-0 text-sm leading-normal text-muted">
                  {p.tagline}
                </p>
                <div className="mt-[22px] flex items-baseline gap-1.5">
                  <span
                    className={`text-[44px] font-semibold tracking-[-0.03em] ${
                      p.dark ? "text-on-accent" : "text-ink"
                    }`}
                  >
                    {money(p.price[currency], currency)}
                  </span>
                  <span className="text-sm text-muted">{p.per}</span>
                </div>
                {p.tier ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void checkout(p.tier!, { tier: p.tier! })}
                    className={`mt-[22px] flex h-12 cursor-pointer items-center justify-center rounded-3xl text-[15px] font-medium transition-[transform,filter,opacity,background-color] duration-200 hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70 ${
                      p.dark ? "bg-brand text-on-accent" : "glass-chip text-ink"
                    }`}
                  >
                    {busy === p.tier ? "Opening checkout…" : p.cta}
                  </button>
                ) : (
                  <Link
                    href="/download"
                    className="glass-chip mt-[22px] flex h-12 items-center justify-center rounded-3xl text-[15px] font-medium text-ink transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-105"
                  >
                    {p.cta}
                  </Link>
                )}
                <div
                  className={`my-6 mb-5 h-px ${p.dark ? "bg-dark-2" : "bg-line"}`}
                />
                <div className="flex flex-col gap-3">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex shrink-0 text-brand">
                        <LinearTickCircle size={15} />
                      </span>
                      <span
                        className={`text-sm leading-normal ${
                          p.dark ? "text-ink/85" : "text-ink-soft"
                        }`}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
        {error && !isPack(error.key) && <CheckoutError text={error.message} />}
      </section>

      {/* ── Add-on credit packs ───────────────────────────────────────── */}
      <section id="packs" className="mx-auto max-w-[1080px] px-6 pt-4 pb-10">
        <FadeUp>
          <h2 className="m-0 text-center font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
            Add-on credit packs
          </h2>
          <p className="mx-auto mt-2 mb-8 max-w-[480px] text-center text-[15px] leading-relaxed text-muted">
            Top up any plan. Pack credits never expire and are only used after
            your daily credits run out.
          </p>
        </FadeUp>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {packs.map((pack, i) => {
            const best = i === packs.length - 1;
            return (
              <FadeUp key={pack.credits} delay={0.1 + i * 0.06}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="glass-card relative flex h-full flex-col items-center p-6 text-center"
                >
                  {best && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-[5px] text-[11px] font-medium tracking-[0.1em] whitespace-nowrap text-ink uppercase">
                      Best value
                    </span>
                  )}
                  <span className="text-[34px] font-semibold tracking-[-0.03em] text-ink">
                    {pack.credits}
                  </span>
                  <span className="text-xs tracking-[0.08em] text-muted uppercase">
                    credits
                  </span>
                  <span className="mt-3 text-lg font-medium text-ink">
                    {money(pack.price[currency], currency)}
                  </span>
                  <span className="glass-chip mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted">
                    {perCredit(pack.price[currency], pack.credits, currency)}
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void checkout(`pack-${pack.credits}`, {
                        pack: pack.credits,
                      })
                    }
                    className="glass-chip mt-4 flex h-10 w-full cursor-pointer items-center justify-center rounded-2xl text-sm font-medium text-ink transition-[transform,filter,opacity] duration-200 hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
                  >
                    {busy === `pack-${pack.credits}` ? "Opening…" : "Buy pack"}
                  </button>
                </motion.div>
              </FadeUp>
            );
          })}
        </div>
        {error && isPack(error.key) && <CheckoutError text={error.message} />}
      </section>

      {/* ── Comparison matrix ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[880px] px-6 pt-6 pb-10">
        <FadeUp>
          <h2 className="m-0 mb-6 text-center font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
            Compare plans
          </h2>
        </FadeUp>
        <FadeUp delay={0.08}>
          <div className="glass-card overflow-x-auto p-2">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left font-medium text-muted" />
                  {plans.map((p) => (
                    <th
                      key={p.name}
                      className={`p-3 text-center font-serif text-base font-semibold ${
                        p.popular ? "text-brand" : "text-ink"
                      }`}
                    >
                      {p.name}
                      <span className="block text-xs font-sans font-normal text-muted">
                        {money(p.price[currency], currency)}
                        {p.per === "forever" ? "" : "/mo"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="p-3 text-ink-soft">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className={`p-3 text-center ${
                          v === "—" ? "text-muted" : "text-ink"
                        }`}
                      >
                        {v === "✓" ? (
                          <span className="inline-flex text-brand">
                            <LinearTickCircle size={16} />
                          </span>
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
