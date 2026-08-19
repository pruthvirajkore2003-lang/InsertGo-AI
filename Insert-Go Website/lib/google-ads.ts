/**
 * Google tag helpers: Consent Mode v2 updates and Google Ads conversions.
 *
 * Everything here goes through `window.gtag`, which is defined by the inline
 * bootstrap in `components/analytics/ConsentMode.tsx` — before gtag.js loads,
 * before anything else runs, and with the classic `dataLayer.push(arguments)`
 * body, because gtag.js distinguishes an `arguments` object from a plain array
 * when it drains the queue. Reusing that one definition is why nothing in this
 * file touches `dataLayer` directly.
 *
 * Consent Mode's defaults are `denied` (DPDP §6 / GDPR: no advertising or
 * analytics storage before a decision). `updateGoogleConsent` is the only way
 * that changes, and the only callers are the two surfaces that record a
 * decision — the consent gate and `/account/privacy`, via the cookie mirror.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: unknown[];
  }
}

/** Fire a gtag command. No-op on the server, and no-op if the bootstrap script
 *  was blocked — in which case every Google tag is dead anyway. */
export function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  window.gtag?.(...args);
}

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
const CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? "";

/** True when at least one Google tag is configured — what decides whether the
 *  gtag.js loader renders at all. */
export function googleTagConfigured(): boolean {
  return Boolean(GA4_ID || GOOGLE_ADS_ID);
}

export interface ConsentChoice {
  adsConsent: boolean;
  analyticsConsent: boolean;
}

/**
 * Mirror a consent decision into Consent Mode v2.
 *
 * All four v2 signals are always sent together. Sending a subset leaves the
 * others at whatever they were, which is how an account that withdrew
 * `marketing` keeps personalised advertising: `ad_storage` alone is not the
 * consent, `ad_user_data` and `ad_personalization` are separate legal bases.
 */
export function updateGoogleConsent({ adsConsent, analyticsConsent }: ConsentChoice): void {
  const ads = adsConsent ? "granted" : "denied";
  gtag("consent", "update", {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: analyticsConsent ? "granted" : "denied",
  });
}

export interface ConversionInput {
  /** Order value in the reporting currency. */
  value: number;
  /** ISO-4217. Dodo is Merchant of Record and localises the real charge; this
   *  is the catalogue price for the item the user bought. */
  currency?: string;
  /** Our own id, planted in Dodo checkout metadata. Google dedups conversions
   *  on it, which is what makes a refresh of the return page harmless. */
  transactionId: string;
  /** Enhanced Conversions: raw address, normalised here. Google hashes it in
   *  the browser — it never leaves as plaintext. */
  email?: string | null;
}

/** Google's normalisation for Enhanced Conversions: trim, lowercase. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Report a purchase to Google Ads.
 *
 * No-ops unless both the account id and the conversion label are configured —
 * a `send_to` with an empty label is silently dropped by Google, so failing
 * loudly here (in the console, in development) beats a reporting hole nobody
 * notices for a quarter.
 */
export function trackGoogleAdsConversion({
  value,
  currency = "INR",
  transactionId,
  email,
}: ConversionInput): void {
  if (!GOOGLE_ADS_ID || !CONVERSION_LABEL) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[ads] conversion skipped — NEXT_PUBLIC_GOOGLE_ADS_ID / _CONVERSION_LABEL unset");
    }
    return;
  }
  if (email) {
    // Must precede the event: gtag attaches whatever user_data is set at the
    // time the conversion fires.
    gtag("set", "user_data", { email: normalizeEmail(email) });
  }
  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABEL}`,
    value,
    currency,
    transaction_id: transactionId,
  });
}
