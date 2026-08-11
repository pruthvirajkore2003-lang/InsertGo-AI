import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/pgPool";
import { currentConsent, needsConsentGate } from "@/lib/consent";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = {
  title: "Account",
};

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export default async function AccountPage() {
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
  const tier = TIER_LABELS[user.tier ?? "free"] ?? "Free";
  const daily = user.dailyCreditsRemaining ?? 0;
  const dailyMax = user.dailyCreditsMax ?? 5;
  const addOn = user.addOnCredits ?? 0;

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
            <div className="glass-chip flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
              <dt className="text-sm font-medium text-muted">Plan</dt>
              <dd className="text-[15px] font-medium text-ink">{tier}</dd>
            </div>
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
                <span className="ml-1.5 text-xs text-muted">never expire</span>
              </dd>
            </div>
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
