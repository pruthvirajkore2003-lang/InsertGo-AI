/**
 * Which price column a visitor sees — ₹ INR or $ USD — and where that answer
 * came from.
 *
 * DISPLAY ONLY. Dodo is Merchant of Record and charges whatever the
 * server-pinned product says (lib/dodo.ts), so nothing here is authoritative
 * for money and none of it is accepted from a request body. The one value that
 * does reach the gateway — the billing country — is read from the CDN's
 * geolocation header inside the checkout route, never from the cookie below:
 * a cookie a visitor can edit must not be able to pick a cheaper localized
 * price.
 *
 * Resolution order, highest first:
 *   1. `ig_currency` cookie — an explicit choice the visitor made on the page.
 *   2. Edge IP-country header — Vercel, Cloudflare, or a proxy in front.
 *   3. Nothing resolved → USD, and the page is told so (`source: "default"`)
 *      so the client can try timezone/locale after hydration. That last step
 *      is what stops a developer in India, a VPN user, or anyone behind a CDN
 *      that strips geo headers from being permanently stuck on dollars.
 *
 * Pure module — no `next/headers`, no `document` at import time — because a
 * server component, a route handler and a client component all read it.
 */
import type { Currency } from "./pricing";

export type { Currency };

export const CURRENCY_COOKIE = "ig_currency";

/** One year, matching the consent cookie: a display preference that expired
 *  mid-session would silently flip prices under the visitor. */
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The catalog's base column, and the answer whenever nothing else resolves. */
export const DEFAULT_CURRENCY: Currency = "USD";

/** Narrow untrusted text (cookie value, query param) to a currency, or null. */
export function parseCurrency(
  value: string | null | undefined,
): Currency | null {
  const v = value?.trim().toUpperCase();
  return v === "INR" || v === "USD" ? v : null;
}

/**
 * IP-country headers we accept, most trusted first. Vercel and Cloudflare set
 * theirs at the edge and strip any client-supplied copy; the generic two are
 * for a reverse proxy in front of a self-hosted deployment. All are display
 * inputs — see the module note on why the checkout route re-reads the same
 * headers rather than trusting the cookie.
 *
 * Cloudflare outranks Vercel because when both are present Cloudflare is the
 * OUTER proxy: it geolocates the visitor, then forwards to Vercel, whose edge
 * sees only the Cloudflare PoP address and geolocates that instead. Trusting
 * Vercel first inverts the answer — US traffic through an Indian PoP reads
 * IN and gets rupees. `x-vercel-ip-country` stays as the fallback for traffic
 * that reaches Vercel directly, where it is the only header set.
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
 * through rather than being treated as "not India", which is the same answer
 * but a different, wrong reason.
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

/** India pays in rupees; everywhere else reads the base column. */
export function currencyForCountry(
  country: string | null | undefined,
): Currency {
  return country?.trim().toUpperCase() === "IN" ? "INR" : DEFAULT_CURRENCY;
}

export type DetectedCurrency = {
  currency: Currency;
  /** The geolocated country, or null when no header resolved. */
  country: string | null;
  /**
   * `"cookie"` and `"geo"` are answers; `"default"` is a shrug, and the only
   * case where the client is allowed to override with timezone/locale.
   */
  source: "cookie" | "geo" | "default";
};

/**
 * Server-side detection. `cookie` is the raw `ig_currency` value (or undefined);
 * `headers` is the request's headers.
 */
export function detectCurrency(input: {
  headers: HeaderReader;
  cookie?: string | null;
}): DetectedCurrency {
  const country = countryFromHeaders(input.headers);
  const chosen = parseCurrency(input.cookie);
  if (chosen) return { currency: chosen, country, source: "cookie" };
  if (country) return { currency: currencyForCountry(country), country, source: "geo" };
  return { currency: DEFAULT_CURRENCY, country: null, source: "default" };
}

// ── Client-side fallback (localhost, VPN, geo-less CDN) ────────────────────

/** IANA zones for India — `Asia/Calcutta` is the legacy alias Windows and
 *  older ICU builds still resolve to. Mirrors the desktop app's copy. */
const INDIA_ZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

/**
 * Whether a BCP-47 tag says "India".
 *
 * Two shapes count: an explicit `-IN` region SUBTAG (`en-IN`, `ta-Latn-IN`),
 * and bare Hindi, which has no other national market. Deliberately NOT every
 * Indian language without a region — `bn` alone is as likely Bangladesh, and
 * guessing wrong on the price a shopper sees is worse than showing the base
 * column with a toggle right next to it.
 *
 * The region must follow a language, hence `-IN` rather than `^IN`: a bare
 * `in` is the deprecated ISO-639 code for INDONESIAN, still emitted by older
 * Android webviews, and reading it as India would put rupees in front of the
 * wrong country entirely.
 */
export function isIndianLocale(tag: string | null | undefined): boolean {
  const t = tag?.trim();
  if (!t) return false;
  return /-IN$/i.test(t) || /^hi(?:-|$)/i.test(t);
}

/**
 * Browser-only guess from timezone then UI language. Returns null when neither
 * says India, so callers can leave the server's answer alone instead of
 * overwriting a real geolocation with a shrug.
 *
 * `env` is injected in tests; in the browser it reads Intl and navigator.
 */
export function detectClientCurrency(env?: {
  timeZone?: string | null;
  languages?: readonly string[] | null;
}): Currency | null {
  let timeZone = env?.timeZone;
  if (timeZone === undefined) {
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Locked-down runtime with no ICU data.
      timeZone = null;
    }
  }
  if (timeZone && INDIA_ZONES.has(timeZone)) return "INR";

  const nav =
    typeof navigator === "undefined"
      ? null
      : (navigator as Navigator & { languages?: readonly string[] });
  const languages =
    env?.languages ??
    (nav ? (nav.languages?.length ? nav.languages : [nav.language]) : null);
  if (languages?.some(isIndianLocale)) return "INR";

  return null;
}

/** Client read of the stored choice. Null on the server and for a visitor who
 *  never touched the toggle. */
export function readCurrencyCookie(): Currency | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CURRENCY_COOKIE}=`));
  return parseCurrency(match?.slice(CURRENCY_COOKIE.length + 1));
}

/** The exact `Set-Cookie`-style value the selector writes. Split out so a test
 *  can assert the attributes without a DOM. */
export function currencyCookieValue(
  currency: Currency,
  secure: boolean,
): string {
  return (
    `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=${CURRENCY_COOKIE_MAX_AGE}` +
    `; SameSite=Lax${secure ? "; Secure" : ""}`
  );
}

/**
 * Persist the visitor's choice for a year. Not httpOnly and not a secret — it
 * carries one of two literals and exists so the NEXT server render already
 * knows which column to paint, which is what keeps the choice from flashing
 * back on navigation. `Secure` only over https so localhost still works.
 */
export function writeCurrencyCookie(currency: Currency): void {
  if (typeof document === "undefined") return;
  document.cookie = currencyCookieValue(
    currency,
    location.protocol === "https:",
  );
}
