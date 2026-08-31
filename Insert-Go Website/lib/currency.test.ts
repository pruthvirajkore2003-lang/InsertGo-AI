import { describe, expect, it } from "vitest";

import {
  countryFromHeaders,
  currencyForCountry,
  detectClientCurrency,
  detectCurrency,
} from "./currency";

/** A `Headers`-shaped stub; keys are matched case-insensitively like the real
 *  thing, so a test can't pass on a spelling the platform would miss. */
const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
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
    // visitor. Cloudflare is the outer proxy, so it saw the real IP — and the
    // country it reports is what reaches Dodo as the billing country.
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
    // Cloudflare sends XX when it cannot geolocate and T1 for Tor. Neither is
    // a country, so neither may be forwarded to the gateway as one.
    expect(countryFromHeaders(headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "INDIA" }))).toBeNull();
    expect(countryFromHeaders(headers({}))).toBeNull();
  });
});

describe("currencyForCountry", () => {
  it("is USD for every country, with no second case", () => {
    for (const country of ["IN", "in", "US", "GB", "DE", null, undefined]) {
      expect(currencyForCountry(country)).toBe("USD");
    }
  });
});

describe("detectCurrency", () => {
  it("serves USD to everyone, whatever the geo header says", () => {
    expect(
      detectCurrency({ headers: headers({ "x-vercel-ip-country": "IN" }) }),
    ).toEqual({ currency: "USD", country: "IN", source: "geo" });
    expect(
      detectCurrency({ headers: headers({ "cf-ipcountry": "GB" }) }),
    ).toEqual({ currency: "USD", country: "GB", source: "geo" });
  });

  it("still reports USD when nothing resolves", () => {
    expect(detectCurrency({ headers: headers({}) })).toEqual({
      currency: "USD",
      country: null,
      source: "default",
    });
  });
});

describe("detectClientCurrency", () => {
  it("has no opinion — a single-currency catalog has nothing to switch to", () => {
    // Null, never a currency: any remaining caller must leave the server's
    // USD alone rather than re-deriving it from a laptop's timezone.
    expect(detectClientCurrency()).toBeNull();
  });
});
