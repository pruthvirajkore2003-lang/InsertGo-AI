import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { safeNext } from "./safeNext";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to InsertGo.AI with Google, your organization's SSO, or a one-time email code.",
};

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
    <main className="flex min-h-screen items-center justify-center px-5 pt-28 pb-16">
      <div className="w-full max-w-[420px]">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              Sign in to sync your templates, manage your plan and activate the
              desktop app.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-5 text-center text-[13px] leading-relaxed text-muted">
          New accounts are created automatically on first sign-in. By
          continuing you agree to our terms.
        </p>
      </div>
    </main>
  );
}
