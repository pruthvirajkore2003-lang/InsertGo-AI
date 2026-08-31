/**
 * The one currency the site prices in — USD — and the geolocated country the
 * checkout route uses to let Dodo localize the real charge.
 *
 * DISPLAY ONLY. Dodo is Merchant of Record and charges whatever the
 * server-pinned product says (lib/dodo.ts), so nothing here is authoritative
 * for money and none of it is accepted from a request body. The one value that
 * does reach the gateway — the billing country — is read from the CDN's
 * geolocation header inside the checkout route.
 *
 * There is deliberately NO manual override and no second column: a visitor
 * cannot change which currency the page shows, and there is no other currency
 * to show. Every price on /pricing, in the desktop app and in conversion
 * reporting is the USD catalogue price.
 *
 * Pure module — no `next/headers`, no `document` at import time — because a
 * server component, a route handler and a client component all read it.
 */
import type { Currency } from "./pricing";

export type { Currency };

/** The catalog's only column. */
export const DEFAULT_CURRENCY: Currency = "USD";

/**
 * IP-country headers we accept, most trusted first. Vercel and Cloudflare set
 * theirs at the edge and strip any client-supplied copy; the generic two are
 * for a reverse proxy in front of a self-hosted deployment. The country is a
 * gateway input, not a price input — the checkout route re-reads these headers
 * itself, so nothing client-controllable ever reaches Dodo.
 *
 * Cloudflare outranks Vercel because when both are present Cloudflare is the
 * OUTER proxy: it geolocates the visitor, then forwards to Vercel, whose edge
 * sees only the Cloudflare PoP address and geolocates that instead. Trusting
 * Vercel first inverts the answer — US traffic through a foreign PoP reads as
 * that country. `x-vercel-ip-country` stays as the fallback for traffic that
 * reaches Vercel directly, where it is the only header set.
 */
export const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-real-ip-country",
  "geo-country",
] as const;

/** Minimal shape of `Headers` / `next/headers`, so this stays unit-testable. */
type HeaderReader = { get(name: string): string | null | undefined };

/**
 * First usable ISO-3166 alpha-2 country from the edge headers, or null.
 *
 * "XX" (Cloudflare's unknown) and "T1" (Tor) are explicitly not countries, and
 * anything that isn't two letters is a misconfigured proxy — all of them fall
 * through rather than being passed to the gateway as a country.
 */
export function countryFromHeaders(h: HeaderReader): string | null {
  for (const name of COUNTRY_HEADERS) {
    const raw = h.get(name)?.trim().toUpperCase();
    if (raw && /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1") {
      return raw;
    }
  }
  return null;
}

/** Every country reads the same column. */
export function currencyForCountry(
  _country?: string | null,
): Currency {
  return DEFAULT_CURRENCY;
}

export type DetectedCurrency = {
  currency: Currency;
  /** The geolocated country, or null when no header resolved. */
  country: string | null;
  /** Whether a geo header answered. Reporting only — the currency is USD
   *  either way. */
  source: "geo" | "default";
};

/** Server-side detection: the currency is always USD; only the country varies. */
export function detectCurrency(input: {
  headers: HeaderReader;
}): DetectedCurrency {
  const country = countryFromHeaders(input.headers);
  return {
    currency: DEFAULT_CURRENCY,
    country,
    source: country ? "geo" : "default",
  };
}

/**
 * @deprecated Single-currency pricing: there is nothing for a client-side
 * timezone/locale guess to switch to. Always null, so any remaining caller
 * leaves the server's USD alone. Delete once no caller imports it.
 */
export function detectClientCurrency(): Currency | null {
  return null;
}
