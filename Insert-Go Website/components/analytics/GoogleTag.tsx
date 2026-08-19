import { headers } from "next/headers";
import Script from "next/script";

import { GA4_ID, GOOGLE_ADS_ID, googleTagConfigured } from "@/lib/google-ads";

/**
 * gtag.js, configured for GA4 and/or Google Ads.
 *
 * Renders nothing when neither id is set, so a local or preview deployment
 * ships no third-party tag at all rather than a broken one.
 *
 * `send_page_view: false`: App Router navigations don't reload the document,
 * so gtag's automatic pageview would only ever fire for the first route of a
 * session. `PostHogPageview` sends them for real, including the first.
 *
 * Both ids are configured on one loader — that is how gtag.js is designed to
 * be used, and it is what lets an Enhanced Conversion carry the GA4 client id
 * for cross-tool dedup. Loading two copies of gtag.js instead double-counts.
 *
 * `afterInteractive`, not `beforeInteractive`: the consent defaults must land
 * first (components/analytics/ConsentMode.tsx), and nothing about measurement
 * is worth blocking the page for.
 */
export async function GoogleTag() {
  if (!googleTagConfigured()) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const primaryId = GA4_ID || GOOGLE_ADS_ID;

  const config = [
    "gtag('js', new Date());",
    GA4_ID && `gtag('config', ${JSON.stringify(GA4_ID)}, { send_page_view: false });`,
    GOOGLE_ADS_ID && `gtag('config', ${JSON.stringify(GOOGLE_ADS_ID)}, { allow_enhanced_conversions: true });`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`}
      />
      <Script
        id="gtag-config"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: config }}
      />
    </>
  );
}
