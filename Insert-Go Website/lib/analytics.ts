/**
 * The one client-side event sink. Browser only.
 *
 * Three destinations, one call: PostHog (product funnels), GA4 (traffic
 * attribution) and — for purchases — Google Ads (conversions). They are fanned
 * out here rather than at each call site because the alternative is what this
 * codebase already had one instance of: a component that reports a step to one
 * sink and nothing to the others, invisibly, until someone compares two
 * dashboards.
 *
 * Consent: PostHog runs cookie-less until the `analytics` purpose is granted
 * (components/providers/PostHogProvider.tsx), and every Google tag is held at
 * Consent Mode's `denied` defaults until `ConsentSync` says otherwise. Nothing
 * here needs its own consent check — the transports are already gated, and a
 * second gate in this file would be the drift-prone copy.
 *
 * No PII: event names and enum-ish props only. The single exception is the
 * purchase conversion's email, which Google hashes in the browser for Enhanced
 * Conversions and which the user is looking at on their own account page.
 *
 * NOT importable from a server module — it pulls in posthog-js. The server has
 * lib/analytics-server.ts.
 */
import posthog from "posthog-js";

import { GA4_ID, gtag, trackGoogleAdsConversion } from "./google-ads";

/** The fixed event vocabulary. Values are the names that reach every sink, so
 *  they are snake_case (GA4's convention) and never change once shipped. */
export enum AnalyticsEvent {
  PageView = "page_view",
  CtaClick = "cta_click",
  DemoInteraction = "demo_interaction",
  DownloadStarted = "download_started",
  SignUpStarted = "sign_up_started",
  CheckoutStarted = "begin_checkout",
  Purchase = "purchase",
  WebVital = "web_vital",
}

export type EventProperties = Record<string, string | number | boolean | undefined>;

type Va = (event: "event", props: { name: string; data?: Record<string, string> }) => void;

/** Vercel Web Analytics only accepts flat string data. */
function stringProps(properties: EventProperties): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v !== undefined) out[k] = String(v);
  }
  return out;
}

/**
 * Report one event to every configured sink. Safe to call from anywhere in the
 * browser; a no-op on the server and for any sink that isn't loaded.
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties: EventProperties = {},
): void {
  if (typeof window === "undefined") return;

  try {
    if (posthog.__loaded) posthog.capture(event, properties);
  } catch {
    // An analytics failure must never break the interaction that produced it.
  }

  if (GA4_ID) gtag("event", event, properties);

  const va = (window as { va?: Va }).va;
  if (typeof va === "function") {
    va("event", { name: event, data: stringProps(properties) });
  }
}

/** GA4 page_view. Sent explicitly because `send_page_view` is off in the tag
 *  config — App Router client navigations don't reload the page, so the
 *  automatic one would only ever fire for the first route of a session. */
export function trackPageView(url: string): void {
  if (!GA4_ID) return;
  gtag("event", "page_view", { page_location: url, page_path: url });
}

export interface PurchaseInput {
  transactionId: string;
  value: number;
  currency?: string;
  item: string;
  email?: string | null;
}

/**
 * A completed purchase: the product-analytics event AND the Google Ads
 * conversion, in one call, so the two can never be reported apart.
 */
export function trackPurchase({
  transactionId,
  value,
  currency = "INR",
  item,
  email,
}: PurchaseInput): void {
  trackEvent(AnalyticsEvent.Purchase, {
    transaction_id: transactionId,
    value,
    currency,
    item,
  });
  trackGoogleAdsConversion({ value, currency, transactionId, email });
}
