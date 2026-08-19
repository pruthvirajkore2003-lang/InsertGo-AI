"use client";

import { useReportWebVitals } from "next/web-vitals";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";

/**
 * Core Web Vitals into the same event stream as everything else.
 *
 * Only the three metrics Google actually ranks on are forwarded. The rest
 * (TTFB, FCP, and Next's hydration timings) fire on every navigation and would
 * bury the funnel events in noise for no decision anyone makes from them —
 * Vercel Speed Insights already charts them, mounted alongside this in the
 * layout.
 *
 * Values are rounded: CLS to three decimals because it is a ratio near zero,
 * the timings to whole milliseconds.
 */
const RANKED = new Set(["LCP", "CLS", "INP"]);

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!RANKED.has(metric.name)) return;
    trackEvent(AnalyticsEvent.WebVital, {
      metric: metric.name,
      value: metric.name === "CLS" ? Number(metric.value.toFixed(3)) : Math.round(metric.value),
      rating: metric.rating,
    });
  });
  return null;
}
