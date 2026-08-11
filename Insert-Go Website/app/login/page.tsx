import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { LoginForm } from "./LoginForm";
import { safeNext } from "./safeNext";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to InsertGo.AI with Google, your organization's SSO, or a one-time email code.",
};

const trustPoints = [
  {
    title: "No password to remember",
    desc: "Email code, Google, or company SSO — you're in with one click.",
  },
  {
    title: "7-day free trial included",
    desc: "50 credits on signup. Every prompt runs on the managed AI relay.",
  },
  {
    title: "Syncs with the Windows app",
    desc: "One account carries your prompt library and plan to the desktop.",
  },
];

function BrandMark({ size = 26 }: { size?: number }) {
  // White silhouette PNG over a cobalt glow — same treatment as SiteNav.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/main-logo.png"
      alt=""
      width={size}
      height={size}
      className="block shrink-0 [filter:drop-shadow(0_0_5px_rgba(255,255,255,0.35))_drop-shadow(0_0_14px_rgba(47,107,255,0.55))]"
    />
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    // Honour `next` — bouncing an already-signed-in user to /account would
    // strand a desktop authorize request that routed through here.
    const raw = (await searchParams).next;
    redirect(safeNext(Array.isArray(raw) ? raw[0] : raw));
  }

  return (
    <main className="relative flex min-h-screen items-stretch overflow-hidden">
      {/* Ambient brand glow — decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 520px at 18% 30%, rgba(47,107,255,0.16), transparent 65%), radial-gradient(560px 420px at 85% 85%, rgba(47,107,255,0.08), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1120px] lg:grid-cols-[1.05fr_1fr]">
        {/* Brand pane — desktop only; mobile gets the compact header below. */}
        <aside className="hidden flex-col justify-between px-12 pt-32 pb-16 lg:flex">
          <div className="flex items-center gap-2.5 text-ink">
            <BrandMark />
            <span className="font-serif text-[17px] font-semibold tracking-[-0.01em]">
              InsertGo<span className="text-brand">.AI</span>
            </span>
          </div>

          <div className="max-w-[440px]">
            {/* Not an h1 — the form's "Welcome back" owns that (operative
                heading for screen-reader users landing here to sign in). */}
            <p className="font-serif text-[40px] leading-[1.08] font-semibold tracking-[-0.015em] text-ink">
              Your prompts,
              <br />
              one hotkey away.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">
              Sign in to sync your templates, manage your plan and activate the
              desktop app.
            </p>

            <ul className="mt-10 flex flex-col gap-5">
              {trustPoints.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tile-sky text-brand">
                    <LinearTickCircle size={16} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-relaxed text-muted">
                      {p.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[13px] text-muted">
            Floating AI prompt assistant for Windows.
          </p>
        </aside>

        {/* Form pane */}
        <section className="flex items-center justify-center px-5 pt-28 pb-16 lg:px-10">
          <div className="w-full max-w-[420px]">
            {/* Compact brand header — mobile only (brand pane is lg+). */}
            <div className="mb-8 flex items-center justify-center gap-2.5 text-ink lg:hidden">
              <BrandMark size={24} />
              <span className="font-serif text-[17px] font-semibold tracking-[-0.01em]">
                InsertGo<span className="text-brand">.AI</span>
              </span>
            </div>

            <div className="glass-panel rounded-[28px] p-8 sm:p-10">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
            <p className="mt-5 text-center text-[13px] leading-relaxed text-muted">
              New accounts are created automatically on first sign-in. By
              continuing you agree to our terms.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
