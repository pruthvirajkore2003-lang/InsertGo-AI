import type { Metadata } from "next";
import Link from "@/components/Link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/pgPool";
import { currentConsent, needsConsentGate } from "@/lib/consent";
import { usdPriceForItemKey } from "@/lib/pricing";
import { PurchaseConversion } from "@/components/analytics/PurchaseConversion";
import { SignOutButton } from "./SignOutButton";
import { CancelSubscription } from "./CancelSubscription";

export const metadata: Metadata = {
  title: "Account",
  // robots.txt already disallows /account, but Disallow only stops the crawl —
  // it does not stop indexing. A URL Google cannot fetch but has seen linked
  // still gets listed, titleless, forever. `noindex` is the directive that
  // actually keeps a signed-in surface out of the index.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export default async function AccountPage({
  searchParams,
}: {
  // Dodo returns the buyer here after a successful checkout, carrying the
  // order id and item key lib/dodo.ts planted in the return URL.
  searchParams: Promise<{ upgraded?: string; tx?: string; item?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // The consent gate (R-09). Placed here rather than in middleware on purpose:
  // middleware runs on every request including static assets, and answering
  // "has this user consented?" costs a database round trip. This is the first
  // authenticated surface anyone lands on, and it is also what re-consents
  // existing users after a NOTICE_VERSION bump — no backfill migration needed.
  //
  // Deliberately NOT gating /api/ai/generate: a desktop client mid-generation
  // cannot render a consent form, so gating there would return an error the
  // user has no way to act on. Consent is collected where it can be given.
  try {
    if (needsConsentGate(await currentConsent(session.user.id))) {
      redirect("/consent");
    }
  } catch (e) {
    // `redirect()` throws by design — never swallow it.
    if (e && typeof e === "object" && "digest" in e) throw e;
    // A consent-store outage must not lock people out of their own account
    // page. The gate re-asserts on the next load; failing closed here would
    // turn a database blip into a total lockout for a check that is not a
    // security boundary.
  }

  // customSession (lib/auth.ts) stamps the tier + credit fields onto the
  // session user — the same server-authoritative values the desktop reads.
  const user = session.user as typeof session.user & {
    tier?: string;
    dailyCreditsRemaining?: number;
    dailyCreditsMax?: number;
    addOnCredits?: number;
  };
  const tierKey = user.tier === "plus" || user.tier === "pro" ? user.tier : "free";
  const tier = TIER_LABELS[tierKey];
  const daily = user.dailyCreditsRemaining ?? 0;
  const dailyMax = user.dailyCreditsMax ?? 5;
  const addOn = user.addOnCredits ?? 0;

  // Active-perk breakdown for the VIP member card — mirrors the marketed
  // feature lists in lib/pricing.ts (source of truth for what each plan
  // actually buys).
  const TIER_PERKS: Record<"plus" | "pro", string[]> = {
    plus: [
      "50 credits every day",
      "Interaction history",
      "Inline prompt optimization",
    ],
    pro: [
      "150 credits every day",
      "High-volume capacity",
      "Priority support",
      "Interaction history",
    ],
  };

  // The conversion report for a checkout that just completed. The price is
  // resolved from the catalogue HERE, on the server — the URL only names the
  // item, so the worst a tampered link can do is attribute one real catalogue
  // price to another. Nothing on this path can move money; fulfilment is the
  // webhook's job and happened before the browser got back.
  const { tx, item } = await searchParams;
  const conversionValue = item ? usdPriceForItemKey(item) : null;

  // Cancellation state. Two facts, both written by the billing side: whether
  // a live Dodo subscription exists to cancel, and whether the user already
  // cancelled and is running out the period they paid for. Fetched here rather
  // than read off the session because `customSession` does not carry them and
  // a stale session must not hide the Cancel button — an ARL cancellation path
  // that intermittently disappears is worse than none.
  let subscription = {
    hasSubscription: false,
    cancelAtPeriodEnd: false,
    /** The lookup failed, so "no subscription" is a guess, not a fact. */
    unknown: false,
  };
  try {
    const { rows } = await pool.query<{
      dodoSubscriptionId: string | null;
      cancelAtPeriodEnd: boolean;
    }>(
      'select "dodoSubscriptionId", "cancelAtPeriodEnd" from "user" where "id" = $1',
      [user.id],
    );
    subscription = {
      hasSubscription: Boolean(rows[0]?.dodoSubscriptionId),
      cancelAtPeriodEnd: Boolean(rows[0]?.cancelAtPeriodEnd),
      unknown: false,
    };
  } catch {
    // Pre-migration database (columns absent) or a blip. Do NOT let that read
    // as "no subscription": this user is on a paid tier, so something is
    // billing them, and hiding the Cancel button over a transient query is the
    // disappearing cancellation path the comment above rules out. Render it
    // and let POST /api/billing/cancel — which re-reads the row — be the
    // authority; it already answers 409 in plain words when there is genuinely
    // nothing to cancel.
    subscription = { ...subscription, unknown: true };
  }

  // Pack purchases live in "creditLedger" as negative amounts (webhook
  // grants); per-generation debits (+1 rows) are noise here, so filter.
  let purchases: { credits: number; at: Date }[] = [];
  try {
    const { rows } = await pool.query<{ amount: number; createdAt: Date }>(
      `select "amount", "createdAt" from "creditLedger"
        where "userId" = $1 and "amount" < 0
        order by "createdAt" desc limit 10`,
      [user.id],
    );
    purchases = rows.map((r) => ({ credits: -r.amount, at: r.createdAt }));
  } catch {
    // Ledger listing is decorative — the balances above are authoritative.
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 pt-28 pb-16">
      <div className="w-full max-w-[480px]">
        {tx && conversionValue !== null && item && (
          <PurchaseConversion
            transactionId={tx}
            value={conversionValue}
            currency="USD"
            item={item}
            email={user.email}
          />
        )}
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">
            Your account
          </h1>

          <dl className="mt-6 flex flex-col gap-4">
            <div className="glass-chip flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
              <dt className="shrink-0 text-sm font-medium text-muted">Name</dt>
              {/* User-supplied, unbounded — let it wrap inside the chip rather
                  than push the row wider than the card. */}
              <dd className="min-w-0 text-right text-[15px] break-words text-ink">
                {user.name || "—"}
              </dd>
            </div>
            <div className="glass-chip flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
              <dt className="shrink-0 text-sm font-medium text-muted">Email</dt>
              {/* break-all, not break-words: an address has no spaces to break
                  on, so anywhere-wrapping is the only thing that contains it. */}
              <dd className="min-w-0 text-right text-[15px] break-all text-ink">
                {user.email}
              </dd>
            </div>
            {tierKey === "free" ? (
              <div className="glass-chip rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm font-medium text-muted">Plan</dt>
                  <dd className="text-[15px] font-medium text-ink">{tier}</dd>
                </div>
                {/* Cancelling has to be reachable from the surface that shows the
                    plan, not only from the footer — the same "as easy as" test
                    the privacy link below is here for. */}
                <p className="mt-1.5 mb-0 text-xs text-muted">
                  Paid plans renew monthly and can be cancelled any time, right
                  here.{" "}
                  <Link
                    href="/cancel"
                    className="font-medium text-brand no-underline hover:underline"
                  >
                    Cancellation &amp; refund policy
                  </Link>
                </p>
                {/* A free-tier row that still carries a live subscription id
                    means a payment failed and Dodo is retrying it
                    (subscription.on_hold): the features are suspended but the
                    card is not. That is the moment a customer most wants to
                    stop the retries, so the control renders here too.
                    `unknown` is deliberately NOT included — an ordinary free
                    user has nothing to cancel, and a query blip must not offer
                    everyone a button that can only 409. */}
                {(subscription.hasSubscription ||
                  subscription.cancelAtPeriodEnd) && (
                  <div className="mt-3">
                    <CancelSubscription
                      tier={tier}
                      cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                      suspended
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Paid tiers: the plan row becomes the VIP member card — tier-
                 branded gradient border, credit visualizers and the active
                 perk breakdown in one elevated surface. */
              <div
                className={`vip-card vip-card--${tierKey} px-5 py-5`}
                data-tier={tierKey}
              >
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm font-medium text-muted">Plan</dt>
                  <span
                    className={`tier-badge tier-badge--${tierKey}`}
                    aria-label={`${tier} plan`}
                  >
                    {tier.toUpperCase()}
                  </span>
                </div>
                <dd className="m-0 mt-1 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
                  {tier} member
                </dd>

                {/* Credit visualizers — the same meter language as the Free
                    rows below, elevated into the card. */}
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-muted">
                        Daily credits
                      </span>
                      <span className="text-ink">
                        {daily} / {dailyMax}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={daily}
                      aria-valuemin={0}
                      aria-valuemax={dailyMax}
                      aria-label="Daily credits remaining"
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                    >
                      <div
                        className={`meter-fill h-full rounded-full ${
                          daily === 0 ? "bg-danger" : "bg-brand"
                        }`}
                        style={{
                          width: `${dailyMax > 0 ? (daily / dailyMax) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 mb-0 text-xs text-muted">
                      {daily === 0
                        ? "You're out for today — buy a credit pack or wait for the reset at 00:00 UTC."
                        : "Resets at 00:00 UTC."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-muted">
                      Add-on credits
                    </span>
                    <span className="text-ink">
                      {addOn}
                      <span className="ml-1.5 text-xs text-muted">
                        never expire
                      </span>
                    </span>
                  </div>
                </div>

                {/* Active tier perks — mirrors lib/pricing.ts feature lists. */}
                <ul className="m-0 mt-4 flex list-none flex-col gap-2 border-t border-white/[0.06] p-0 pt-4">
                  {TIER_PERKS[tierKey].map((perk) => (
                    <li key={perk} className="vip-perk">
                      <svg
                        aria-hidden
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="7"
                          fill={
                            tierKey === "pro"
                              ? "rgba(47, 107, 255, 0.2)"
                              : "rgba(99, 102, 241, 0.2)"
                          }
                        />
                        <path
                          d="M5 8.2 7.1 10.3 11 6"
                          stroke={
                            tierKey === "pro" ? "#93c5fd" : "#a5b4fc"
                          }
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {perk}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 mb-0 text-xs text-muted">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancelled — no further charges. ${tier} stays active until the period you have paid for ends. `
                    : `Renews automatically each month until you cancel. Cancel below and keep ${tier} until the period you have paid for ends. `}
                  <Link
                    href="/cancel"
                    className="font-medium text-brand no-underline hover:underline"
                  >
                    Cancellation &amp; refund policy
                  </Link>
                </p>
                {/* On the plan card itself, not buried under a "Manage billing"
                    detour: the ARL/ROSCA test is steps-to-cancel measured from
                    where the user actually is. */}
                {(subscription.hasSubscription ||
                  subscription.cancelAtPeriodEnd ||
                  subscription.unknown) && (
                  <div className="mt-3">
                    <CancelSubscription
                      tier={tier}
                      cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                    />
                  </div>
                )}
              </div>
            )}
            {tierKey === "free" && (
              <>
                <div className="glass-chip rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm font-medium text-muted">
                      Daily credits
                    </dt>
                    <dd className="text-[15px] text-ink">
                      {daily} / {dailyMax}
                    </dd>
                  </div>
                  {/* A bare div is invisible to assistive tech — the meter has to
                      announce its own value, not rely on the "3 / 5" beside it. */}
                  <div
                    role="progressbar"
                    aria-valuenow={daily}
                    aria-valuemin={0}
                    aria-valuemax={dailyMax}
                    aria-label="Daily credits remaining"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
                  >
                    <div
                      className={`meter-fill h-full rounded-full ${
                        daily === 0 ? "bg-danger" : "bg-brand"
                      }`}
                      style={{
                        width: `${dailyMax > 0 ? (daily / dailyMax) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 mb-0 text-xs text-muted">
                    {daily === 0
                      ? "You're out for today — buy a credit pack or wait for the reset at 00:00 UTC."
                      : "Resets at 00:00 UTC."}
                  </p>
                </div>
                <div className="glass-chip flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
                  <dt className="text-sm font-medium text-muted">
                    Add-on credits
                  </dt>
                  <dd className="text-[15px] text-ink">
                    {addOn}
                    <span className="ml-1.5 text-xs text-muted">
                      never expire
                    </span>
                  </dd>
                </div>
              </>
            )}
          </dl>

          {purchases.length > 0 && (
            <div className="mt-6">
              <h2 className="m-0 mb-2 text-sm font-medium text-muted">
                Credit pack purchases
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {purchases.map((p, i) => (
                  <li
                    key={i}
                    className="glass-chip flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm"
                  >
                    <span className="text-ink">+{p.credits} credits</span>
                    <span className="text-muted">
                      {p.at.toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/pricing"
              className="flex h-11 items-center justify-center rounded-3xl bg-brand text-[15px] font-medium text-on-accent transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-105"
            >
              {tier === "Free" ? "Upgrade plan" : "Manage plan & buy credits"}
            </Link>
            {/* R-10: withdrawal has to be reachable from the account surface,
                not only from a policy page — §6(4)'s "as easy as" is measured
                from where the user actually is. */}
            <Link
              href="/account/privacy"
              className="glass-chip flex h-11 items-center justify-center rounded-2xl text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-muted/10"
            >
              Privacy choices &amp; your data
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
