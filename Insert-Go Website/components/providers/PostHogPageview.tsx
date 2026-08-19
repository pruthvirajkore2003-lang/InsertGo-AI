"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

import { trackPageView } from "@/lib/analytics";

/**
 * One pageview per App Router navigation, to PostHog and GA4.
 *
 * `useSearchParams` opts the whole subtree out of static rendering, which is
 * why this is a separate component wrapped in `<Suspense>` at the mount site
 * rather than folded into the provider. The query string is included because
 * paid traffic lands with `?gclid=…`/`?utm_*` on it — dropping it drops the
 * attribution that the Google Ads spend is being judged on.
 */
export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const url = `${window.location.origin}${path}`;

    if (posthog.__loaded) posthog.capture("$pageview", { $current_url: url });
    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}
