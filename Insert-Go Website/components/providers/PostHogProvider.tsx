"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { readConsentCookie } from "@/lib/consentCookie";

/**
 * PostHog, initialised cookie-less and upgraded on consent.
 *
 * The default state mirrors what Consent Mode does for Google: `persistence:
 * "memory"` means no cookie and no localStorage entry, so a visitor with no
 * decision on file is counted for the length of one page load and is not
 * identified across them. Granting the `analytics` purpose (the consent gate or
 * /account/privacy, mirrored into a cookie) switches persistence on and starts
 * session recording. Withdrawing it stops the recorder and drops persistence
 * back to memory on the next load.
 *
 * This is deliberately not "don't load PostHog at all without consent": the
 * cookie-less mode collects no identifier to consent to, and it is what keeps
 * aggregate funnel counts — the thing the `analytics` purpose describes as
 * "aggregate counts of which features are used" — honest for the population
 * that never signs in.
 *
 * Ingestion goes to /_phex on this origin (next.config.ts rewrites), so an ad
 * blocker has no third-party host to match and the CSP needs no extra
 * connect-src entry.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/_phex";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) {
      setReady(Boolean(POSTHOG_KEY));
      return;
    }
    const consent = readConsentCookie();
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      persistence: consent.analytics ? "localStorage+cookie" : "memory",
      // Sent by PostHogPageview, which also reports them to GA4 — one place
      // decides what a pageview is.
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: !consent.analytics,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true },
      },
    });
    setReady(true);
  }, []);

  if (!POSTHOG_KEY || !ready) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
