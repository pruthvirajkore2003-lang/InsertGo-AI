import { headers } from "next/headers";
import Script from "next/script";

/**
 * Google Consent Mode v2 defaults — the first script on the page.
 *
 * `strategy="beforeInteractive"` is load-bearing, not a preference: Consent
 * Mode is a *default*, and a default that arrives after gtag.js or
 * adsbygoogle.js has already run is not a default at all — the tag has by then
 * written its cookies under the assumption of consent. This has to be in the
 * document before either loader, which is exactly what beforeInteractive
 * guarantees and what a `useEffect` cannot.
 *
 * All four v2 signals start `denied` (DPDP §6: no processing for an optional
 * purpose before a clear affirmative action; GDPR/ePrivacy: no non-essential
 * storage before consent). `wait_for_update` gives ConsentSync 500ms to read
 * the consent cookie and grant, so a consenting user's first pageview is still
 * measured rather than lost to a race.
 *
 * `ads_data_redaction` strips ad identifiers from pings while ad_storage is
 * denied; `url_passthrough` keeps click ids (gclid) in the URL across
 * navigations so attribution survives without a cookie. Both are the
 * consent-denied halves of Consent Mode and only do anything in that state.
 *
 * This also defines `window.gtag` for the whole app — the classic
 * `dataLayer.push(arguments)` body. lib/google-ads.ts calls through it rather
 * than pushing to dataLayer itself, because gtag.js distinguishes an
 * `arguments` object from a plain array when it drains the queue.
 */
const CONSENT_DEFAULTS = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
gtag('set', 'ads_data_redaction', true);
gtag('set', 'url_passthrough', true);
`.trim();

export async function ConsentMode() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <Script
      id="google-consent-mode"
      strategy="beforeInteractive"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS }}
    />
  );
}
