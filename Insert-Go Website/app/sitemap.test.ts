import { describe, expect, it } from "vitest";

import {
  INDEXED_LOCALES,
  LOCALIZED_PATHS,
  locales,
} from "@/i18n-config";
import { SITE_URL } from "@/lib/seo";
import sitemap from "./sitemap";

/**
 * What the sitemap submits, and — the part that fails silently — what it must
 * not submit.
 *
 * A locale whose landing copy is still English (see INDEXED_LOCALES) serves
 * the English page at a URL claiming to be a translation of it. Google calls
 * that a duplicate, reads a page's language from its content rather than from
 * `hreflang`, and discards an hreflang cluster that names a noindex URL. So a
 * single stale `locales` reference here would re-submit four near-identical
 * copies of every route and take the English cluster down with them — an
 * XML file nobody reads by eye is exactly where that hides.
 */
describe("sitemap", () => {
  const entries = sitemap();

  it("lists every localized route once per indexed locale, and nothing else", () => {
    expect(entries).toHaveLength(INDEXED_LOCALES.length * LOCALIZED_PATHS.length);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
    for (const locale of INDEXED_LOCALES) {
      for (const path of LOCALIZED_PATHS) {
        expect(entries.map((e) => e.url)).toContain(
          `${SITE_URL}/${locale}${path}`,
        );
      }
    }
  });

  it("never submits a locale whose pages are noindex", () => {
    const unindexed = locales.filter((l) => !INDEXED_LOCALES.includes(l));
    for (const entry of entries) {
      const segment = new URL(entry.url).pathname.split("/")[1];
      expect(unindexed, entry.url).not.toContain(segment);
      // The per-entry hreflang map travels with the URL as xhtml:link, so the
      // same rule applies to the alternates, not just to the <loc>.
      for (const alternate of Object.values(entry.alternates?.languages ?? {})) {
        const altSegment = new URL(String(alternate)).pathname.split("/")[1];
        expect(unindexed, String(alternate)).not.toContain(altSegment);
      }
    }
  });

  it("carries a self-referencing hreflang map on every entry", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages), entry.url).toContain("x-default");
      expect(Object.values(languages), entry.url).toContain(entry.url);
    }
  });
});
