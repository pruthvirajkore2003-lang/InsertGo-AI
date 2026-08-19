/**
 * The browser-readable mirror of the OPTIONAL consent purposes.
 *
 * `lib/consent.ts` is the record of truth and it lives in Postgres — which the
 * browser cannot read, and which a signed-out visitor has no row in at all.
 * Google's Consent Mode and PostHog both need the answer in the browser, on
 * every page, before any tag runs. This cookie carries exactly that: the ids of
 * the optional purposes currently granted, written by the two server actions
 * that record a decision (`/consent`, `/account/privacy`).
 *
 * Deliberately NOT httpOnly — a script has to read it, that is its whole job —
 * and deliberately carrying nothing but purpose ids, so it is not an identifier
 * and needs no consent of its own (it *is* the consent record's transport).
 *
 * Absent cookie = denied. A signed-out visitor never gets one, so Consent Mode
 * stays at its `denied` defaults for them, which is the intended behaviour and
 * not a bug: there is no cookie banner on this site, consent is collected once,
 * itemised, on the authenticated gate.
 */
import type { PurposeId } from "./consent";

export const CONSENT_COOKIE = "ig_consent";

/** One year: the cookie is refreshed on every decision, and an expiry shorter
 *  than the notice-version cadence would silently downgrade a live consent. */
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface BrowserConsent {
  analytics: boolean;
  marketing: boolean;
}

export const NO_CONSENT: BrowserConsent = { analytics: false, marketing: false };

/** Serialise granted optional purposes: `"analytics,marketing"`, or `""`. */
export function serializeConsent(granted: Iterable<PurposeId>): string {
  const set = new Set(granted);
  return (["analytics", "marketing"] as const).filter((id) => set.has(id)).join(",");
}

export function parseConsent(value: string | null | undefined): BrowserConsent {
  if (!value) return NO_CONSENT;
  const ids = value.split(",");
  return {
    analytics: ids.includes("analytics"),
    marketing: ids.includes("marketing"),
  };
}

/** Client-side read. Returns denied on the server and for a visitor with no
 *  decision on file — the two cases are the same as far as tags are concerned. */
export function readConsentCookie(): BrowserConsent {
  if (typeof document === "undefined") return NO_CONSENT;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match ? decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1)) : null);
}
