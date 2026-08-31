import type { MetadataRoute } from "next";
import { INDEXED_LOCALES, LOCALIZED_PATHS, hreflangAlternates } from "@/i18n-config";
import { CONTENT_UPDATED, SITE_URL } from "@/lib/seo";

/** Editorial routes: they carry a lastModified stamped from CONTENT_UPDATED,
 *  which is the same date the pages print as "Reviewed". The rest are
 *  transactional or legal and have no editorial date to claim. */
const DATED_PATHS = new Set([
  "",
  "/features",
  "/features/ai-text-expander",
  "/features/auto-text-insert",
  "/features/prompt-library",
  "/features/desktop-assistant",
  "/use-cases/developers",
  "/use-cases/customer-support",
  "/alternatives/raycast-windows",
  "/alternatives/text-blaze-windows",
  "/alternatives/textexpander-windows",
  "/alternatives/windows-copilot",
  "/blog/windows-ai-productivity-guide",
  "/how-it-works",
  "/download",
  "/faq",
]);

/**
 * Every route in every INDEXED language. The path list itself lives in
 * i18n-config.ts, shared with middleware and `<Link>`, so a page cannot be
 * added to the router without appearing here — and a locale whose copy is not
 * translated yet cannot appear at all, because submitting a noindex duplicate
 * is asking Google to spend crawl budget rejecting it.
 *
 * Each entry repeats the full `alternates.languages` map, which Next renders as
 * `xhtml:link` elements. That is the second, independent channel Google accepts
 * for hreflang — the `<head>` tags say the same thing, and a page that is
 * blocked, cached stale, or fetched as a bare URL still declares its variants.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(CONTENT_UPDATED);

  return INDEXED_LOCALES.flatMap((locale) =>
    LOCALIZED_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      ...(DATED_PATHS.has(path) ? { lastModified } : {}),
      alternates: { languages: hreflangAlternates(SITE_URL, path) },
    })),
  );
}
