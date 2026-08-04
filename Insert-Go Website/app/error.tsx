"use client";

import { useEffect } from "react";
import Link from "next/link";
import { GlowBackdrop } from "@/components/PageHero";
import { FadeUp } from "@/components/Reveal";

/**
 * Route-segment error boundary. Without one, a thrown render error in
 * production shows Next's unstyled "Application error" screen — the single
 * most trust-destroying page a product can serve.
 *
 * What it deliberately does NOT show: the message or the stack. Next already
 * redacts those in production, and echoing whatever survives invites leaking
 * internals. `digest` is the server-side correlation id — the one thing worth
 * surfacing, because it turns "it broke" into a support ticket we can trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled render error", error);
  }, [error]);

  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 pt-40 pb-24 text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Something went wrong
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[640px] font-serif text-[clamp(32px,5vw,52px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
            This page didn&apos;t load
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-5 max-w-[460px] text-[17px] leading-relaxed text-muted">
            The error is on our side, not yours. Nothing you entered was lost —
            try again, and if it keeps happening let us know.
          </p>
        </FadeUp>
        <FadeUp delay={0.18}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-btn bg-accent-primary px-7 text-base font-medium text-on-accent shadow-cta transition-[transform,background-color,box-shadow] duration-200 ease-standard hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-cta-hover active:translate-y-0 active:scale-[0.97] active:duration-75"
            >
              Try again
            </button>
            <Link
              href="/"
              className="glass-chip inline-flex h-12 items-center gap-2.5 rounded-btn px-7 text-base font-medium text-ink transition-[background-color,transform] duration-200 ease-standard hover:bg-surface-hover active:scale-[0.97] active:duration-75"
            >
              Back to home
            </Link>
          </div>
        </FadeUp>
        {error.digest && (
          <FadeUp delay={0.24}>
            <p className="mt-8 text-[13px] text-muted">
              Reference code{" "}
              <code className="glass-chip rounded-md px-2 py-1 font-mono text-[12px] text-ink-soft">
                {error.digest}
              </code>{" "}
              —{" "}
              <Link
                href="/contact"
                className="font-medium text-brand no-underline hover:underline"
              >
                send it to us
              </Link>{" "}
              and we can trace exactly what failed.
            </p>
          </FadeUp>
        )}
      </section>
    </main>
  );
}
