/**
 * Sub-path i18n: every public page lives at `/<locale>/…`, including the
 * default one. There is deliberately no unprefixed variant — two URLs serving
 * the same English page (`/pricing` and `/en/pricing`) is the duplicate-content
 * problem hreflang exists to avoid, so `/pricing` only ever redirects.
 *
 * This module is imported by middleware (Edge), server components and client
 * components alike, so it stays pure: no `next/*` imports, no I/O.
 */

export const locales = ["en", "es", "de", "ja", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * The locales whose PAGE COPY is actually translated.
 *
 * Routing serves every entry in `locales` — `/fr/pricing` is a real 200 — but
 * only the locales named here are indexed, listed in the sitemap, linked by
 * hreflang, or negotiated into from a locale-free URL.
 *
 * The distinction is not cosmetic. Google treats a localized URL whose main
 * content is still English as a DUPLICATE of the English page, and it reads a
 * document's language from the content, not from `hreflang` or `lang` — so an
 * hreflang cluster whose members contradict their own copy is discarded rather
 * than trusted. Advertising five languages while shipping one therefore buys
 * no ranking anywhere, costs the crawl budget of four near-identical copies of
 * every route, and puts the cluster that will matter later at risk.
 *
 * lib/i18n.ts translates the nav chrome only; the landing copy under
 * app/[locale] is English. When a language's copy is genuinely translated, add
 * it here and indexing, the sitemap, hreflang and language negotiation all
 * switch on together — the drift this constant exists to prevent.
 *
 * `defaultLocale` must always be a member: it is the x-default target.
 */
export const INDEXED_LOCALES: readonly Locale[] = ["en"];

/**
 * `og:locale` wants `language_TERRITORY`; hreflang and `<html lang>` take the
 * bare language tag. The territory here is the primary market for each
 * language, not a claim that other regions are excluded — hreflang is what
 * carries targeting, and it stays language-only.
 */
export const ogLocale: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  ja: "ja_JP",
  fr: "fr_FR",
};

/**
 * Every route that exists under every locale, leading slash, no trailing slash;
 * `""` is the home page. Single source of truth for three things that must not
 * drift apart: what the sitemap lists, what middleware will redirect into a
 * locale, and which `<Link href>` values get a locale prefix.
 *
 * Authenticated and transactional routes (`/account`, `/login`, `/desktop`,
 * `/consent`) are absent on purpose: they are noindex, they are not translated,
 * and an allowlist means a route added there later is excluded by default
 * rather than by remembering to exclude it.
 */
export const LOCALIZED_PATHS = [
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
  "/pricing",
  "/contact",
  "/cancel",
  "/terms",
  "/privacy",
] as const;

const LOCALIZED = new Set<string>(LOCALIZED_PATHS);

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Whether a locale may be indexed, sitemapped and hreflang-linked — i.e. its
 *  pages are really in that language. See INDEXED_LOCALES. */
export function isIndexedLocale(
  value: string | null | undefined,
): value is Locale {
  return isLocale(value) && INDEXED_LOCALES.includes(value);
}

/** `"/features"` for `""`-style membership tests: `"/"` and `""` are the same route. */
function normalize(path: string): string {
  return path === "/" ? "" : path.replace(/\/+$/, "");
}

/** True for a *locale-free* path that has a translated variant. */
export function isLocalizedPath(path: string): boolean {
  return LOCALIZED.has(normalize(path));
}

/** The locale a pathname is already in, or the default when it carries none. */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  const segment = pathname?.split("/")[1];
  return isLocale(segment) ? segment : defaultLocale;
}

/**
 * Pick a supported locale from `Accept-Language`.
 *
 * The header is visitor-controlled, so nothing in it is used except as a
 * lookup key into `locales` — the return value can only ever be one of the
 * four, and a malformed or hostile header degrades to the default rather than
 * reaching the router. Quality values are honoured because `fr;q=0.9,en;q=0.8`
 * means French, and header order alone would say English.
 *
 * Region subtags are matched on their language: `fr-CA` gets the French page,
 * which is the right answer until there is a Canadian French variant to serve.
 *
 * Only INDEXED_LOCALES are selectable. Sending a French speaker to a `/fr/`
 * URL that renders English copy is a worse answer than the English URL that
 * says so, and it is the one page of the pair Google will not index.
 */
export function negotiateLocale(header: string | null): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        q: q ? Number(q.split("=")[1]) : 1,
      };
    })
    .filter((entry) => Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { language } of ranked) {
    if (isIndexedLocale(language)) return language;
  }
  return defaultLocale;
}
/**
 * Narrow a `[locale]` route param.
 *
 * Next types generated route params as `string`, so every page receives one.
 * The fallback is never reached in practice — app/[locale]/layout.tsx wraps all
 * of them and calls `notFound()` on anything unsupported — but it keeps the
 * narrowing total instead of asserting, so a page rendered outside that layout
 * degrades to the default language rather than emitting `/undefined/…` URLs.
 */
export function toLocale(value: string): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** `/fr/pricing` -> `/pricing`. A path with no locale prefix is returned as-is. */
export function stripLocale(pathname: string): string {
  const [, segment, ...rest] = pathname.split("/");
  if (!isLocale(segment)) return pathname;
  return `/${rest.join("/")}`.replace(/\/$/, "") || "/";
}

/**
 * Prefix an internal href with the active locale, but only when the route
 * actually has locale variants. `/account` and `/api/…` are left alone — a
 * prefix there is a 404, not a translation.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/")) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const suffix = cut === -1 ? "" : href.slice(cut);
  if (isLocale(path.split("/")[1]) || !isLocalizedPath(path)) return href;
  return `/${locale}${normalize(path)}${suffix}`;
}

/**
 * The `alternates.languages` map Next renders as `<link rel="alternate">`.
 * Reciprocal by construction: every locale's page emits the same set, and
 * `x-default` names the default locale rather than a bare origin, so the
 * fallback URL is one that actually exists.
 *
 * Built from INDEXED_LOCALES, not `locales`: a cluster that names a noindex
 * URL is invalid, and Google drops the whole set rather than the bad member.
 */
export function hreflangAlternates(
  origin: string,
  path: string,
): Record<string, string> {
  const base = normalize(path);
  const languages: Record<string, string> = {};
  for (const locale of INDEXED_LOCALES) {
    languages[locale] = `${origin}/${locale}${base}`;
  }
  languages["x-default"] = `${origin}/${defaultLocale}${base}`;
  return languages;
}
