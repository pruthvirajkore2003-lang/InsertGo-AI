import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { currentConsent, NOTICE_VERSION, PURPOSES } from "@/lib/consent";
import { eraseAccount, raiseRequest, setPurpose } from "./actions";

export const metadata: Metadata = {
  title: "Privacy choices",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Data-principal controls (R-10 withdrawal, R-11 rights).
 *
 * The page exists because `app/privacy/page.tsx` already *describes* these
 * rights well, and description is not the obligation — §6(4) needs a control
 * with the same click cost as the opt-in, and §§11–13 need a queue with a
 * clock. Both live here.
 *
 * Note what is deliberately absent from the consent toggles: no confirmation
 * dialog, no "you'll lose…" warning, no retention offer. Each toggle is one
 * submit, matching the one checkbox that granted it.
 */
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{
    raised?: string;
    required?: string;
    confirm?: string;
  }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const state = await currentConsent(session.user.id);
  const { raised, required, confirm } = await searchParams;

  return (
    <main className="flex min-h-screen justify-center px-5 pt-28 pb-16">
      <div className="w-full max-w-[560px]">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">
            Your privacy choices
          </h1>
          <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">
            Recorded against notice version {NOTICE_VERSION}. Read the{" "}
            <Link href="/privacy" className="underline">
              full policy
            </Link>
            .
          </p>

          {raised === "1" && (
            <p
              role="status"
              className="mt-4 mb-0 rounded-2xl bg-brand/10 px-4 py-3 text-sm text-ink"
            >
              Request received. We acknowledge within 48 hours and answer within
              90 days at the latest.
            </p>
          )}
          {required === "1" && (
            <p
              role="alert"
              className="mt-4 mb-0 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              That item is needed to run your account at all. To stop all
              processing, delete your account below.
            </p>
          )}

          {/* ── Consent toggles (R-10) ── */}
          <ul className="mt-6 mb-0 flex list-none flex-col gap-2 p-0">
            {PURPOSES.map((p) => {
              const granted = state.get(p.id)?.granted ?? false;
              return (
                <li key={p.id} className="glass-chip rounded-2xl px-4 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="m-0 text-[15px] text-ink">{p.label}</p>
                      <p className="mt-1 mb-0 text-[13px] leading-relaxed text-muted">
                        {p.description}
                      </p>
                      <p className="mt-1.5 mb-0 text-xs text-muted">
                        {p.required ? "Required · " : "Optional · "}
                        {p.retention}
                      </p>
                    </div>
                    <form action={setPurpose} className="shrink-0">
                      <input type="hidden" name="purpose" value={p.id} />
                      <input
                        type="hidden"
                        name="granted"
                        value={granted ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        disabled={p.required && granted}
                        aria-label={`${granted ? "Withdraw" : "Give"} consent for: ${p.label}`}
                        className="glass-chip h-9 rounded-full px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-muted/10 disabled:opacity-40"
                      >
                        {granted ? "Withdraw" : "Allow"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── Access (R-11 §11) ── */}
          <h2 className="mt-8 mb-2 text-sm font-medium text-muted">
            Your data
          </h2>
          <a
            href="/api/account/export"
            download
            className="glass-chip flex h-11 items-center justify-center rounded-2xl text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-muted/10"
          >
            Download a copy of my data
          </a>

          {/* ── Correction / grievance / nomination (R-11 §§12–14) ── */}
          <form action={raiseRequest} className="mt-4">
            <label
              htmlFor="dsr-kind"
              className="block text-sm font-medium text-muted"
            >
              Raise a request
            </label>
            <select
              id="dsr-kind"
              name="kind"
              defaultValue="correction"
              className="glass-chip mt-2 h-11 w-full rounded-2xl px-4 text-[15px] text-ink"
            >
              <option value="correction">Correct my details</option>
              <option value="grievance">Raise a grievance</option>
              <option value="nomination">
                Nominate someone to act for me
              </option>
            </select>
            <textarea
              name="note"
              rows={3}
              maxLength={2000}
              placeholder="What would you like us to do?"
              aria-label="Details of your request"
              className="glass-chip mt-2 w-full rounded-2xl px-4 py-3 text-[15px] text-ink"
            />
            <button
              type="submit"
              className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl bg-brand text-[15px] font-medium text-on-accent transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-105"
            >
              Send request
            </button>
          </form>

          {/* ── Erasure (R-11 → R-12) ── */}
          <h2 className="mt-8 mb-2 text-sm font-medium text-danger">
            Delete my account
          </h2>
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            This erases your name, email, sign-in records and usage history, and
            cannot be undone. Two things are kept because the law requires it,
            not because we want them: your billing ledger entries (tax and
            company law) and our security logs (CERT-In). Both keep only an
            account identifier — never your name or address again.
          </p>
          {confirm === "1" && (
            <p
              role="alert"
              className="mt-3 mb-0 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              Type DELETE to confirm.
            </p>
          )}
          <form action={eraseAccount} className="mt-3">
            <label htmlFor="confirm" className="sr-only">
              Type DELETE to confirm account deletion
            </label>
            <input
              id="confirm"
              name="confirm"
              autoComplete="off"
              placeholder="Type DELETE to confirm"
              className="glass-chip h-11 w-full rounded-2xl px-4 text-[15px] text-ink"
            />
            <button
              type="submit"
              className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl border border-danger text-[15px] font-medium text-danger transition-colors duration-200 hover:bg-danger/10"
            >
              Delete my account permanently
            </button>
          </form>

          <p className="mt-6 mb-0 text-center text-xs text-muted">
            Prefer to write to a person? Our Grievance Officer is at{" "}
            <a href="mailto:grievance@insertgo.ai" className="underline">
              grievance@insertgo.ai
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
