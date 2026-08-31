import { describe, expect, it } from "vitest";

import {
  INDEXED_LOCALES,
  defaultLocale,
  hreflangAlternates,
  isIndexedLocale,
  isLocalizedPath,
  localeFromPathname,
  localizeHref,
  locales,
  negotiateLocale,
  stripLocale,
  toLocale,
} from "@/i18n-config";
import { getDictionary } from "./i18n";

/**
 * The routing half of i18n, where being wrong is invisible rather than loud: a
 * link that silently 404s, an hreflang set that is not reciprocal, or a header
 * parser that lets an unsupported tag through into a URL.
 */
describe("INDEXED_LOCALES", () => {
  it("is a subset of the routed locales and always contains the default", () => {
    // x-default names the default locale's URL, so a default that is not
    // indexed would point the whole cluster at a noindex page.
    expect(INDEXED_LOCALES).toContain(defaultLocale);
    for (const locale of INDEXED_LOCALES) {
      expect(locales, locale).toContain(locale);
    }
  });

  it("answers only for locales whose copy is translated", () => {
    expect(isIndexedLocale(defaultLocale)).toBe(true);
    expect(isIndexedLocale("klingon")).toBe(false);
    expect(isIndexedLocale(null)).toBe(false);
    for (const locale of locales) {
      expect(isIndexedLocale(locale), locale).toBe(
        INDEXED_LOCALES.includes(locale),
      );
    }
  });
});

describe("negotiateLocale", () => {
  it("honours q-values rather than header order", () => {
    // "en" comes first but is the WEAKER preference — order alone says English.
    // Both candidates must be indexed for the ranking to be observable, so the
    // assertion is "the winner is the indexed one it ranked highest".
    const ranked = negotiateLocale("en;q=0.5, fr;q=0.9");
    expect(ranked).toBe(INDEXED_LOCALES.includes("fr") ? "fr" : defaultLocale);
    expect(negotiateLocale("de-AT,de;q=0.9,en;q=0.8")).toBe(
      INDEXED_LOCALES.includes("de") ? "de" : defaultLocale,
    );
  });

  it("never selects a locale whose pages are not translated", () => {
    // Sending a French speaker to /fr/pricing — English copy at a French URL,
    // and the noindex half of the pair — is worse than the English page.
    for (const locale of locales) {
      const picked = negotiateLocale(`${locale};q=1`);
      expect(isIndexedLocale(picked), locale).toBe(true);
      if (!INDEXED_LOCALES.includes(locale)) {
        expect(picked, locale).toBe(defaultLocale);
      }
    }
  });

  it("matches a region subtag on its language", () => {
    // fr-CA is French; whether French is served depends on it being indexed.
    expect(negotiateLocale("fr-CA")).toBe(
      INDEXED_LOCALES.includes("fr") ? "fr" : defaultLocale,
    );
    expect(negotiateLocale("en-GB")).toBe("en");
  });

  it("falls back to the default for anything unsupported or malformed", () => {
    // Visitor-controlled input: it may only ever select from INDEXED_LOCALES.
    expect(negotiateLocale(null)).toBe(defaultLocale);
    expect(negotiateLocale("")).toBe(defaultLocale);
    expect(negotiateLocale("ko,zh-Hans;q=0.8")).toBe(defaultLocale);
    expect(negotiateLocale("en;q=0")).toBe(defaultLocale);
    expect(negotiateLocale(";;;q=notanumber")).toBe(defaultLocale);
    expect(negotiateLocale("../../etc/passwd")).toBe(defaultLocale);
  });
});

describe("localizeHref", () => {
  it("prefixes the routes that have translations", () => {
    expect(localizeHref("/", "fr")).toBe("/fr");
    expect(localizeHref("/pricing", "de")).toBe("/de/pricing");
    expect(localizeHref("/features/prompt-library", "es")).toBe(
      "/es/features/prompt-library",
    );
    expect(localizeHref("/contact#form", "fr")).toBe("/fr/contact#form");
    expect(localizeHref("/download?utm=x", "fr")).toBe("/fr/download?utm=x");
  });

  it("leaves everything else alone", () => {
    // A prefix on these is a 404, not a translation.
    for (const href of ["/account", "/login", "/api/account/export", "/desktop/authorize"]) {
      expect(localizeHref(href, "fr"), href).toBe(href);
    }
    expect(localizeHref("https://example.com", "fr")).toBe("https://example.com");
    expect(localizeHref("#section", "fr")).toBe("#section");
    // Already localized — prefixing twice would give /fr/fr/pricing.
    expect(localizeHref("/fr/pricing", "fr")).toBe("/fr/pricing");
  });
});

describe("path <-> locale", () => {
  it("reads and strips the locale segment", () => {
    expect(localeFromPathname("/fr/features")).toBe("fr");
    expect(localeFromPathname("/account")).toBe(defaultLocale);
    expect(localeFromPathname(null)).toBe(defaultLocale);
    expect(stripLocale("/fr/features")).toBe("/features");
    expect(stripLocale("/fr")).toBe("/");
    // "zz" is not a locale, so it is a route segment and must survive.
    expect(stripLocale("/zz/faq")).toBe("/zz/faq");
    expect(stripLocale("/account/privacy")).toBe("/account/privacy");
  });

  it("treats an unsupported route param as the default rather than throwing", () => {
    expect(toLocale("de")).toBe("de");
    expect(toLocale("klingon")).toBe(defaultLocale);
  });

  it("knows which routes exist in every language", () => {
    expect(isLocalizedPath("/")).toBe(true);
    expect(isLocalizedPath("/features")).toBe(true);
    expect(isLocalizedPath("/account")).toBe(false);
    expect(isLocalizedPath("/unsupported")).toBe(false);
  });
});

describe("hreflangAlternates", () => {
  it("is reciprocal and carries an x-default that resolves", () => {
    const en = hreflangAlternates("https://insertgo.com", "/features");
    const fr = hreflangAlternates("https://insertgo.com", "/features");
    // Every variant emits the SAME map — that is what reciprocity means, and
    // a one-directional set is the most common hreflang implementation bug.
    expect(fr).toEqual(en);
    expect(en[defaultLocale]).toBe(
      `https://insertgo.com/${defaultLocale}/features`,
    );
    // Not the bare origin: `/` only redirects, and x-default must be a page.
    expect(en["x-default"]).toBe(`https://insertgo.com/${defaultLocale}/features`);
    expect(hreflangAlternates("https://insertgo.com", "/")["x-default"]).toBe(
      `https://insertgo.com/${defaultLocale}`,
    );
  });

  it("names every indexed locale and no unindexed one", () => {
    // An hreflang cluster that lists a noindex URL is not partially honoured:
    // Google discards the set, taking the translated pages down with it.
    const map = hreflangAlternates("https://insertgo.com", "/pricing");
    expect(Object.keys(map).sort()).toEqual(
      [...INDEXED_LOCALES, "x-default"].sort(),
    );
    for (const locale of locales) {
      if (INDEXED_LOCALES.includes(locale)) continue;
      expect(map[locale], locale).toBeUndefined();
    }
  });
});

describe("getDictionary", () => {
  it("answers for every supported locale with the English key set", () => {
    const keys = Object.keys(getDictionary("en").nav).sort();
    for (const locale of ["es", "de", "ja", "fr"] as const) {
      const nav = getDictionary(locale).nav;
      expect(Object.keys(nav).sort(), locale).toEqual(keys);
      expect(nav.pricing, locale).not.toBe(getDictionary("en").nav.pricing);
    }
  });
});
