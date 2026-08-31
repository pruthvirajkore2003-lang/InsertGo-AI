import type { ReactNode } from "react";
import { FadeUp } from "./Reveal";

export function GlowBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-[-300px] left-1/2 h-[640px] w-[1000px] -translate-x-1/2 rounded-full"
      style={{
        background:
          "radial-gradient(closest-side, color-mix(in srgb, var(--color-surface) 40%, transparent), transparent 70%)",
      }}
    />
  );
}

export function PageHero({
  kicker,
  title,
  sub,
  children,
  compact = false,
  standalone = false,
}: {
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  /** @deprecated Every current call site renders Breadcrumbs above the hero,
   *  so this now maps to the default breadcrumb mode. Use `standalone` for a
   *  hero with no breadcrumbs. */
  compact?: boolean;
  /** No breadcrumbs above: pad enough to clear the fixed navbar (~74px). */
  standalone?: boolean;
}) {
  return (
    <section
      className={`relative px-6 pb-6 text-center sm:pb-8 ${
        standalone ? "pt-24 sm:pt-28" : "pt-4 sm:pt-6"
      }`}
    >
      <FadeUp>
        <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
          {kicker}
        </p>
      </FadeUp>
      <FadeUp delay={0.06}>
        <h1 className="mx-auto max-w-[820px] font-serif text-[clamp(40px,6vw,68px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h1>
      </FadeUp>
      {sub && (
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-6 max-w-[600px] text-lg leading-relaxed text-muted">
            {sub}
          </p>
        </FadeUp>
      )}
      {children}
    </section>
  );
}
