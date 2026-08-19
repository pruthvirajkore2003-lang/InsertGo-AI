/**
 * Demo instrumentation — one fixed event vocabulary.
 *
 * The vocabulary stays here (it is demo-specific and long), the delivery does
 * not: everything goes through `trackEvent`, which fans out to PostHog, GA4 and
 * Vercel Web Analytics. Sending straight to `window.va` was fine when Vercel
 * was the only sink; keeping it that way once PostHog exists would mean the
 * funnel that matters most — the interactive demo — is the one funnel missing
 * from the product analytics.
 *
 * No PII: event names and enum-ish props only.
 */
import { AnalyticsEvent, trackEvent } from "./analytics";

export type DemoEventName =
  | "floater_view"
  | "floater_summon"
  | "floater_prompt_select"
  | "floater_insert"
  | "floater_complete"
  | "floater_replay"
  | "skillbar_view"
  | "skillbar_select"
  | "skillbar_skill_click"
  | "skillbar_result"
  | "skillbar_undo"
  | "skillbar_repeat"
  | "skillbuilder_view"
  | "skillbuilder_recipe"
  | "skillbuilder_generate"
  | "skillbuilder_run"
  | "demo_cta_click";

export function trackDemo(name: DemoEventName, data?: Record<string, string>) {
  if (typeof window === "undefined") return;
  // `step` rather than the event name itself: one GA4/PostHog event with a
  // step property funnels cleanly, seventeen sibling event names do not.
  trackEvent(AnalyticsEvent.DemoInteraction, { step: name, ...data });
  if (process.env.NODE_ENV === "development") {
    console.debug("[demo]", name, data ?? "");
  }
}
