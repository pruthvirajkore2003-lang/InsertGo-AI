import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  hreflangAlternates,
  isIndexedLocale,
  isLocale,
  locales,
  stripLocale,
} from "@/i18n-config";
import { SITE_URL } from "@/lib/seo";

type LocaleParams = { params: Promise<{ locale: string }> };

/** The locale set, so Next knows the finite list of variants to prerender and
 *  to link. Anything outside it still reaches the layout below and 404s. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Reciprocal hreflang for every page under this segment.
 *
 * Built here rather than per page so a route added later cannot ship without
 * its alternates: the layout wraps all of them, and the only input is the path,
 * which middleware stamps on `x-pathname` (never a client-supplied header —
 * a spoofed one would emit a canonical pointing at a URL of the caller's
 * choosing). `canonical` names this locale's own URL, so each variant
 * self-canonicalises and the `languages` map — identical on every indexed
 * variant — is what ties them together. `x-default` points at the default
 * locale's real URL, not at the bare origin, which only redirects.
 *
 * Pages below deliberately do NOT set `alternates`: Next replaces the field
 * wholesale rather than merging it, so a page-level `canonical` would silently
 * delete every hreflang on that page.
 */
export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const pathname = (await headers()).get("x-pathname");
  // No header means this is not a document request (middleware skips prefetch
  // RSC fetches). Emitting a guessed canonical would be worse than none.
  if (!isLocale(locale) || !pathname) return {};

  // A locale whose copy is not translated yet (INDEXED_LOCALES) serves the
  // English page at a URL claiming to be a translation of it — which is what
  // Google calls a duplicate. It stays out of the index, and out of the
  // hreflang cluster: one noindex member invalidates the set for the pages
  // that ARE translated. `follow` stays on so the links still flow.
  if (!isIndexedLocale(locale)) return { robots: { index: false, follow: true } };

  const languages = hreflangAlternates(SITE_URL, stripLocale(pathname));
  return { alternates: { canonical: languages[locale], languages } };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  // Trust boundary: `locale` is whatever the visitor typed. Rendering an
  // unsupported one would serve the default-language page at a URL that
  // claims to be a translation of it — a duplicate Google would index.
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return children;
}
