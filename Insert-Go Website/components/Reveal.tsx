"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Apple's reveal: a short rise paired with a slight scale-up, so content reads
// as approaching the viewer rather than sliding in from off-screen.
//
// One spring drives every entrance and every hover lift on the site. Just under
// critical damping (zeta ~= 0.84 at mass 0.8), so it overshoots once and settles
// in ~350ms — and stays interruptible, which a keyframe never is.
export const SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8,
} as const;

const HIDDEN = { opacity: 0, y: 24, scale: 0.985 };
const SHOWN = { opacity: 1, y: 0, scale: 1 };
const LIFT = { y: -4 };

// Fires 6% before the element's top edge leaves the viewport bottom, bottom
// edge only. A bare "-6%" would gate all four sides and delay reveals on
// upward scroll too.
const VIEWPORT = { once: true, margin: "0px 0px -6% 0px" };

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** spring lift on pointer hover — for cards that fill the whole wrapper */
  hoverLift?: boolean;
};

// scroll-triggered, fires once
export function Reveal({ children, delay = 0, className, hoverLift }: RevealProps) {
  // framer defaults reducedMotion to "never" — it does NOT read the media query
  // on its own, so every motion prop is gated here.
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal
      className={className}
      initial={reduce ? false : HIDDEN}
      whileInView={reduce ? undefined : SHOWN}
      whileHover={reduce || !hoverLift ? undefined : LIFT}
      viewport={VIEWPORT}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

// entrance (no scroll trigger) — page-load stagger, same optical language
export function FadeUp({ children, delay = 0, className }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal
      className={className}
      initial={reduce ? false : HIDDEN}
      animate={reduce ? undefined : SHOWN}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}
