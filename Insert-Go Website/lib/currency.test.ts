import { describe, expect, it } from "vitest";

import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE,
  countryFromHeaders,
  currencyCookieValue,
  currencyForCountry,
  detectClientCurrency,
  detectCurrency,
  isIndianLocale,
  parseCurrency,
} from "./currency";

/** A `Headers`-shaped stub; keys are matched case-insensitively like the real
 *  thing, so a test can't pass on a spelling the platform would miss. */
const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
});

describe("parseCurrency", () => {
  it("accepts the two currencies, in any casing", () => {
    expect(parseCurrency("INR")).toBe("INR");
    expect(parseCurrency("usd")).toBe("USD");
    expect(parseCurrency(" inr ")).toBe("INR");
  });

  it("rejects anything else rather than guessing", () => {
    // A cookie is user-editable text. Everything that isn't one of the two
    // literals has to fall through to detection, not become a third column.
    for (const bad of ["", "EUR", "0", "INR,USD", "<script>", null, undefined]) {
      expect(parseCurrency(bad)).toBeNull();
    }
  });
});

describe("countryFromHeaders", () => {
  it("reads every CDN/proxy header we deploy behind", () => {
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "IN" }))).toBe("IN");
    expect(countryFromHeaders(headers({ "cf-ipcountry": "in" }))).toBe("IN");
    expect(countryFromHeaders(headers({ "x-country-code": "US" }))).toBe("US");
    expect(countryFromHeaders(headers({ "x-real-ip-country": "DE" }))).toBe("DE");
    expect(countryFromHeaders(headers({ "geo-country": "FR" }))).toBe("FR");
  });

  it("prefers Cloudflare's answer over Vercel's when both are present", () => {
    // Behind Cloudflare, Vercel's edge geolocates the Cloudflare PoP, not the
    // visitor — reading it first served rupees to US traffic routed through
    // an Indian PoP. Cloudflare is the outer proxy, so it saw the real IP.
    expect(
      countryFromHeaders(
        headers({ "cf-ipcountry": "US", "x-vercel-ip-country": "IN" }),
      ),
    ).toBe("US");
  });

  it("falls back to Vercel's header when Cloudflare's is absent or unusable", () => {
    expect(
      countryFromHeaders(headers({ "x-vercel-ip-country": "IN" })),
    ).toBe("IN");
    // "XX" is Cloudflare present-but-clueless: skip it, do not stop at it.
    expect(
      countryFromHeaders(
        headers({ "cf-ipcountry": "XX", "x-vercel-ip-country": "IN" }),
      ),
    ).toBe("IN");
  });

  it("prefers the platform header over a proxy-supplied one", () => {
    expect(
      countryFromHeaders(
        headers({ "x-vercel-ip-country": "IN", "x-country-code": "US" }),
      ),
    ).toBe("IN");
  });

  it("treats the not-a-country placeholders as absent", () => {
    // Cloudflare sends XX when it cannot geolocate and T1 for Tor. Reading
    // either as "not India" is the same answer for the wrong reason: it would
    // suppress the client-side fallback that exists for exactly this case.
    expect(countryFromHeaders(headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "INDIA" }))).toBeNull();
    expect(countryFromHeaders(headers({}))).toBeNull();
  });
});

describe("currencyForCountry", () => {
  it("is India-or-base, with no third case", () => {
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("in")).toBe("INR");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
  });
});

describe("detectCurrency", () => {
  it("serves INR to a visitor geolocated in India", () => {
    expect(
      detectCurrency({ headers: headers({ "x-vercel-ip-country": "IN" }) }),
    ).toEqual({ currency: "INR", country: "IN", source: "geo" });
  });

  it("serves USD to everyone else", () => {
    expect(
      detectCurrency({ headers: headers({ "cf-ipcountry": "GB" }) }),
    ).toEqual({ currency: "USD", country: "GB", source: "geo" });
  });

  it("lets the stored choice beat geolocation, both ways", () => {
    // The whole point of the toggle: an NRI on a US IP who wants rupees, and
    // an expat in India who wants dollars, both get what they picked.
    expect(
      detectCurrency({
        headers: headers({ "x-vercel-ip-country": "US" }),
        cookie: "INR",
      }),
    ).toEqual({ currency: "INR", country: "US", source: "cookie" });
    expect(
      detectCurrency({
        headers: headers({ "x-vercel-ip-country": "IN" }),
        cookie: "USD",
      }),
    ).toEqual({ currency: "USD", country: "IN", source: "cookie" });
  });

  it("ignores a tampered cookie and falls through to geolocation", () => {
    expect(
      detectCurrency({
        headers: headers({ "x-vercel-ip-country": "IN" }),
        cookie: "GBP",
      }),
    ).toEqual({ currency: "INR", country: "IN", source: "geo" });
  });

  it("reports a shrug as a shrug when nothing resolves", () => {
    // `source: "default"` is load-bearing — it is the ONLY state in which the
    // client is allowed to overrule the server with timezone/locale. Reporting
    // it as "geo" is what pinned local development in India to dollars.
    expect(detectCurrency({ headers: headers({}) })).toEqual({
      currency: "USD",
      country: null,
      source: "default",
    });
  });
});

describe("isIndianLocale", () => {
  it("matches the India region subtag and bare Hindi", () => {
    for (const tag of ["en-IN", "hi", "hi-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "bn-IN", "ta-Latn-IN"]) {
      expect(isIndianLocale(tag)).toBe(true);
    }
  });

  it("does not claim a language shared with another country", () => {
    // `bn` alone is as likely Bangladesh; guessing wrong about the price a
    // shopper sees is worse than the base column plus a visible toggle.
    for (const tag of ["en-US", "bn", "ta", "de", "in", "", null, undefined]) {
      expect(isIndianLocale(tag)).toBe(false);
    }
  });
});

describe("detectClientCurrency", () => {
  it("reads both spellings of the Indian timezone", () => {
    // Windows and older ICU builds still resolve the legacy alias.
    expect(detectClientCurrency({ timeZone: "Asia/Kolkata" })).toBe("INR");
    expect(detectClientCurrency({ timeZone: "Asia/Calcutta" })).toBe("INR");
  });

  it("falls back to the UI language when the zone says nothing", () => {
    expect(
      detectClientCurrency({ timeZone: "UTC", languages: ["en-IN", "en-US"] }),
    ).toBe("INR");
  });

  it("returns null — not USD — when nothing says India", () => {
    // Null means "no opinion", which leaves a real server-side geolocation
    // alone. Answering USD here would let a laptop's timezone overwrite the
    // CDN's verdict.
    expect(
      detectClientCurrency({ timeZone: "America/New_York", languages: ["en-US"] }),
    ).toBeNull();
    expect(detectClientCurrency({ timeZone: null, languages: [] })).toBeNull();
    // No prefix matching: a zone that merely starts with the right letters is
    // not India.
    expect(
      detectClientCurrency({ timeZone: "Asia/Kolkata_Bogus", languages: [] }),
    ).toBeNull();
  });
});

describe("currencyCookieValue", () => {
  it("persists for a year, site-wide, and survives top-level navigation", () => {
    const v = currencyCookieValue("INR", true);
    expect(v).toBe(
      `${CURRENCY_COOKIE}=INR; Path=/; Max-Age=${CURRENCY_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
    );
    expect(CURRENCY_COOKIE_MAX_AGE).toBe(31_536_000);
  });

  it("drops Secure off https so localhost can store a choice", () => {
    // A Secure cookie on http is silently discarded, which would make the
    // toggle look broken in development — the exact environment it is most
    // needed in.
    expect(currencyCookieValue("USD", false)).not.toContain("Secure");
  });
});
