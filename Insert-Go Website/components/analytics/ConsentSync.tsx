"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

import { readConsentCookie } from "@/lib/consentCookie";
import { updateGoogleConsent } from "@/lib/google-ads";

/**
 * Push the recorded consent decision into every tag, on load and after each
 * navigation.
 *
 * The decision itself lives in Postgres (`consentRecord`, lib/consent.ts) and
 * is mirrored into a readable cookie by the two server actions that write it.
 * Re-reading on `pathname` change is what makes withdrawal take effect
 * immediately: both consent surfaces finish with a redirect or a
 * `revalidatePath`, so a navigation is exactly when the cookie has just
 * changed. Without it, a user who withdrew consent would keep granted tags
 * until they closed the tab — which fails the §6(4) "as easy as" test in
 * substance while looking correct in the database.
 *
 * `marketing` maps to the advertising signals and `analytics` to
 * `analytics_storage`; that split is the point of Consent Mode v2, and it is
 * why withdrawing marketing alone still leaves product analytics working.
 */
export function ConsentSync() {
  const pathname = usePathname();

  useEffect(() => {
    const consent = readConsentCookie();
    updateGoogleConsent({
      adsConsent: consent.marketing,
      analyticsConsent: consent.analytics,
    });

    if (!posthog.__loaded) return;
    posthog.set_config({
      persistence: consent.analytics ? "localStorage+cookie" : "memory",
    });
    if (consent.analytics) posthog.startSessionRecording();
    else posthog.stopSessionRecording();
  }, [pathname]);

  return null;
}
