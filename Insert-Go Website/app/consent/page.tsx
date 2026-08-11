import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { currentConsent, needsConsentGate, NOTICE_VERSION } from "@/lib/consent";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = {
  title: "Your privacy choices",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The consent gate (R-09).
 *
 * One surface covers all three sign-in lanes — email OTP, Google, enterprise
 * SSO — because it sits *after* authentication rather than inside any signup
 * form. That is also what makes the backfill free: an existing user with no
 * consent record is indistinguishable from a new one here, so "existing users
 * must be re-consented at next sign-in" needs no separate migration, and a
 * NOTICE_VERSION bump re-prompts everyone through the same path.
 *
 * Modifying three provider flows instead would have meant three places to get
 * §6(1) right and three places for it to drift.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ incomplete?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Already current: never make someone re-answer a question we can prove they
  // answered. Re-prompting on every visit is the friction §6(4) prohibits on
  // the withdrawal side, and it is no more defensible on the grant side.
  const state = await currentConsent(session.user.id);
  if (!needsConsentGate(state)) redirect("/account");

  const { incomplete } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 pt-28 pb-16">
      <div className="w-full max-w-[560px]">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">
            Before you start
          </h1>
          <p className="mt-2 mb-6 text-[15px] leading-relaxed text-muted">
            {state.size > 0
              ? `We've updated our privacy notice to version ${NOTICE_VERSION}. Please confirm your choices for the current text.`
              : "Choose what InsertGo may do with your data. Each item is a separate choice — you are not agreeing to one bundle."}
          </p>
          <ConsentForm incomplete={incomplete === "1"} />
        </div>
      </div>
    </main>
  );
}
