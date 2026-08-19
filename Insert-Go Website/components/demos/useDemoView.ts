"use client";

import { useEffect, type RefObject } from "react";
import { trackDemo, type DemoEventName } from "@/lib/demoAnalytics";

/** Fires `name` once when the element stays ≥50% visible for one second. */
export function useDemoView(
  ref: RefObject<HTMLElement | null>,
  name: DemoEventName
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    let fired = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (fired) return;
        if (entry.intersectionRatio >= 0.5) {
          timer = window.setTimeout(() => {
            fired = true;
            io.disconnect();
            trackDemo(name);
          }, 1000);
        } else {
          window.clearTimeout(timer);
        }
      },
      { threshold: [0, 0.5] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref, name]);
}
