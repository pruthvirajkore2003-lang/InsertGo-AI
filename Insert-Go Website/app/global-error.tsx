"use client";

import "./globals.css";

/**
 * Last-resort boundary: this one fires when the ROOT layout itself throws, so
 * Next unmounts the layout and this component supplies its own <html>/<body>.
 * Nothing from layout.tsx is available here — no nav, no footer, no fonts — so
 * it stays intentionally self-contained and plain. app/error.tsx handles every
 * ordinary page failure with the full branded treatment.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="flex max-w-[440px] flex-col items-center gap-4">
          <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
            InsertGo.AI is having a moment
          </h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted">
            Something failed before the page could render. Reloading usually
            clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex h-12 cursor-pointer items-center rounded-btn bg-accent-primary px-7 text-base font-medium text-on-accent shadow-cta transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Reload
          </button>
          {error.digest && (
            <p className="m-0 text-[13px] text-muted">
              Reference code{" "}
              <code className="font-mono text-ink-soft">{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
