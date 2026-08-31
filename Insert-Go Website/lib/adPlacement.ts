import { stripLocale } from "@/i18n-config";

/**
 * Where ads are allowed. One predicate, consulted by both halves of the
 * integration — the loader script (components/ads/AdSenseScript.tsx) and every
 * slot (components/ads/AdUnit.tsx).
 *
 * It is one function rather than a rule applied at each call site because the
 * failure mode is asymmetric: a missed ad costs pennies, an ad rendered inside
 * `/desktop/authorize` — a screen that hands a desktop client a live session —
 * is a third-party iframe on a security-critical surface, and AdSense's own
 * policies forbid ads on sign-in and account pages besides. An allowlist, not
 * a denylist: a new authenticated route added later is excluded by default
 * rather than by remembering to exclude it.
 */
const AD_PATH_PREFIXES = ["/blog", "/alternatives", "/features", "/use-cases", "/faq"] as const;

export function adsAllowedOn(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Public routes are locale-prefixed (`/fr/blog`), and both callers hand this
  // the raw pathname. Matching without stripping would silently switch every
  // ad off site-wide — and, worse, the same slip on a future denylist would
  // switch them ON over an authenticated page.
  const path = stripLocale(pathname);
  return AD_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Publisher client id (`ca-pub-…`), or null when AdSense isn't configured. */
export function adsenseClient(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return client && client.startsWith("ca-pub-") ? client : null;
}
