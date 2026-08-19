import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LinearMonitor } from "@/components/icons/LinearMonitor";
import { LinearSms } from "@/components/icons/LinearSms";
import {
  DESKTOP_CLIENT_ID,
  DESKTOP_REDIRECT_URI,
  isChallenge,
  isState,
} from "@/lib/desktopAuth";
import { DesktopApprove } from "./DesktopApprove";

export const metadata: Metadata = {
  title: "Connect your desktop app",
  robots: { index: false, follow: false },
};

/**
 * Authorization page of the desktop PKCE flow (see lib/desktopAuth.ts). The
 * desktop app opens this in the system browser — Google blocks OAuth inside
 * embedded webviews, and the user's existing web session does the work here.
 *
 * The code is issued only on an explicit click (POST from DesktopApprove), so
 * merely loading or prefetching this URL mints nothing.
 */
export default async function DesktopAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const challenge = one(q.code_challenge);
  const state = one(q.state);
  const redirectUri = one(q.redirect_uri);
  const clientId = one(q.client_id);

  const valid =
    isChallenge(challenge) &&
    isState(state) &&
    one(q.code_challenge_method) === "S256" &&
    one(q.response_type) === "code" &&
    (clientId === undefined || clientId === DESKTOP_CLIENT_ID) &&
    (redirectUri === undefined || redirectUri === DESKTOP_REDIRECT_URI);

  const session = await auth.api.getSession({ headers: await headers() });
  if (valid && !session) {
    // Sign in first, then come straight back with the request intact.
    const back = `/desktop/authorize?${new URLSearchParams(
      Object.entries(q).flatMap(([k, v]) => {
        const s = one(v);
        return s === undefined ? [] : [[k, s] as [string, string]];
      }),
    )}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 pt-28 pb-16">
      <div className="w-full max-w-[420px]">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <div className="mb-6 text-center">
            {/* Monitor tile — same icon/tile grammar as the marketing pages,
                so the hand-off reads as one product with the login card. */}
            <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-tile-sky text-brand">
              <LinearMonitor size={24} />
            </span>
            <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">
              Connect your desktop
            </h1>
            {valid ? (
              <>
                <p className="mt-2 text-[15px] text-muted">
                  Approve to sign the InsertGo desktop app in as
                </p>
                {/* Identity chip — the email gets its own row instead of an
                    inline <strong>, because break-all was slicing addresses
                    mid-word across lines. min-w-0 lets the flex child shrink
                    so break-words only wraps when the chip genuinely can't
                    fit the address on one line. */}
                <div className="glass-chip mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tile-sky text-brand">
                    <LinearSms size={18} />
                  </span>
                  <span className="min-w-0 break-words text-balance text-[15px] leading-snug font-medium text-ink">
                    {session!.user.email}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[15px] text-muted">
                This sign-in link is malformed or incomplete. Start again from
                the desktop app.
              </p>
            )}
          </div>
          {valid ? (
            <DesktopApprove challenge={challenge} state={state} />
          ) : (
            /* Without these the malformed-link branch was a card with no
               control on it — the one screen in the flow a confused user is
               most likely to land on, and it offered nowhere to go. */
            <div className="flex flex-col gap-3">
              <Link
                href="/download"
                className="glass-chip inline-flex h-12 items-center justify-center rounded-2xl text-[15px] font-medium text-ink transition-[background-color,transform] duration-200 hover:bg-surface-hover active:scale-[0.97] active:duration-75"
              >
                Set-up instructions
              </Link>
              <Link
                href="/contact"
                className="text-center text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                Still stuck? Contact support
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
