import type { ReactNode } from "react";
import { RevealOnScroll } from "./RevealOnScroll";

// Apple's reveal: a short rise paired with a slight scale-up, so content reads
// as approaching the viewer rather than sliding in from off-screen. The curve
// and keyframes live in globals.css (`--animate-fade-up`); reduced motion is
// handled by the global prefers-reduced-motion block there.

// scroll-triggered, fires once — the only variant that needs the client
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <RevealOnScroll delay={delay} className={className}>
      {children}
    </RevealOnScroll>
  );
}

// entrance (no scroll trigger) — page-load stagger, same optical language.
// Pure CSS, so this stays a server component and ships no JS.
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className ? `animate-fade-up ${className}` : "animate-fade-up"}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
