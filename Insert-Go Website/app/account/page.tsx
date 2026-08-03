import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/pgPool";
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
              <dt className="text-sm font-medium text-muted">Name</dt>
              <dd className="text-[15px] text-ink">{user.name || "—"}</dd>
            </div>
            <div className="glass-chip flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
              <dt className="text-sm font-medium text-muted">Email</dt>
              <dd className="text-[15px] text-ink">{user.email}</dd>
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
              className="flex h-11 items-center justify-center rounded-3xl bg-brand text-[15px] font-medium text-on-accent transition-all duration-200 hover:-translate-y-px hover:brightness-105"
            >
              {tier === "Free" ? "Upgrade plan" : "Manage plan & buy credits"}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
