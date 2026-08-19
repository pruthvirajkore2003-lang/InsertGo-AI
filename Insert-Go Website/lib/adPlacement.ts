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
  return AD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Publisher client id (`ca-pub-…`), or null when AdSense isn't configured. */
export function adsenseClient(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return client && client.startsWith("ca-pub-") ? client : null;
}
