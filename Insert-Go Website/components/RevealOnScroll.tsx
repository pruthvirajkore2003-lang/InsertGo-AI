"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// IntersectionObserver stand-in for framer-motion's whileInView — same trigger
// point (6% before the element's top edge leaves the viewport bottom), fires
// once, then the observer disconnects. Keeping framer-motion out of this file
// keeps it out of every route that only animates on scroll.
export function RevealOnScroll({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${shown ? "animate-fade-up" : "reveal-pending"} ${className ?? ""}`}
      style={shown && delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
