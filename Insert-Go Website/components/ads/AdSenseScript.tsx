import { headers } from "next/headers";
import Script from "next/script";

import { adsAllowedOn, adsenseClient } from "@/lib/adPlacement";

/**
 * The AdSense loader, and only on pages that may carry ads.
 *
 * The path check is here and not just on the slots because loading
 * adsbygoogle.js at all is a third-party script execution and an ad-network
 * ping. On `/desktop/authorize` — a screen that hands a desktop client a live
 * session — and on `/login` and `/account/*`, that is both an AdSense policy
 * breach and a surface nobody should be widening. The path comes from the
 * `x-pathname` header middleware stamps, because a server component has no
 * other way to know it.
 *
 * The nonce is what lets this run under the CSP at all; `'strict-dynamic'`
 * then covers everything adsbygoogle.js goes on to inject, which is the only
 * workable arrangement — the slot iframes pull from hosts nobody can list
 * ahead of time.
 */
export async function AdSenseScript() {
  const client = adsenseClient();
  if (!client) return null;

  const h = await headers();
  if (!adsAllowedOn(h.get("x-pathname"))) return null;

  return (
    <Script
      id="adsbygoogle-js"
      strategy="afterInteractive"
      nonce={h.get("x-nonce") ?? undefined}
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
    />
  );
}
