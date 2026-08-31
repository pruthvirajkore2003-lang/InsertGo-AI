import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPath = { value: null as string | null };

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-pathname" ? requestPath.value : null,
  }),
}));

import { INDEXED_LOCALES, defaultLocale, locales } from "@/i18n-config";
import { SITE_URL } from "@/lib/seo";
import { generateMetadata } from "./layout";

const meta = (locale: string, pathname: string) => {
  requestPath.value = pathname;
  return generateMetadata({ params: Promise.resolve({ locale }) });
};

/**
 * The head of every public page: which URL it claims to be, which variants it
 * declares, and whether it may be indexed at all.
 *
 * Both failure modes are invisible in a browser. A translated locale that
 * loses its `alternates` drops out of the hreflang cluster; an UNtranslated
 * one that keeps them puts a page of English copy into the cluster as the
 * French version — and because Google reads language from content and treats
 * an untranslated localized page as a duplicate, that one entry is enough for
 * it to discard the set.
 */
describe("locale layout metadata", () => {
  beforeEach(() => {
    requestPath.value = null;
  });

  it("self-canonicalises an indexed locale and declares its alternates", async () => {
    const m = await meta(defaultLocale, `/${defaultLocale}/pricing`);
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/${defaultLocale}/pricing`);
    const languages = m.alternates?.languages ?? {};
    expect(Object.keys(languages)).toContain("x-default");
    expect(Object.keys(languages).sort()).toEqual(
      [...INDEXED_LOCALES, "x-default"].sort(),
    );
    // Indexable by omission — the site-wide default; only the exceptions say so.
    expect(m.robots).toBeUndefined();
  });

  it("noindexes a locale whose copy is not translated, with no alternates", async () => {
    for (const locale of locales) {
      if (INDEXED_LOCALES.includes(locale)) continue;
      const m = await meta(locale, `/${locale}/pricing`);
      expect(m.robots, locale).toEqual({ index: false, follow: true });
      // Not merely absent from other pages' clusters — carrying none of its
      // own is what keeps the noindex page out of the set entirely.
      expect(m.alternates, locale).toBeUndefined();
    }
  });

  it("emits nothing without the middleware pathname or for a bad locale", async () => {
    // No x-pathname means this is not a document request; a guessed canonical
    // would name a URL of someone else's choosing.
    requestPath.value = null;
    expect(await generateMetadata({ params: Promise.resolve({ locale: defaultLocale }) })).toEqual({});
    expect(await meta("klingon", "/klingon/pricing")).toEqual({});
  });
});
