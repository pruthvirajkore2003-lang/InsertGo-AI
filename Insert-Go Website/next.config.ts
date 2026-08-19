import type { NextConfig } from "next";

/**
 * Static security headers, applied to every route.
 *
 * `X-Frame-Options: DENY` (and the `frame-ancestors 'none'` that rides with the
 * CSP) are the load-bearing ones: /desktop/authorize is an approval screen — it
 * hands a desktop client a live session — so it must never be frameable by a
 * clickjacking page.
 *
 * The Content-Security-Policy is NOT here: it now carries a per-request nonce
 * for `script-src`, which a static header cannot do. See middleware.ts. Do not
 * add a second CSP here — two `Content-Security-Policy` headers are intersected
 * by the browser, so the weaker-looking one silently tightens the other.
 */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/**
 * PostHog ingestion, reverse-proxied through this origin.
 *
 * Two reasons, and the second is the one that matters here: an ad blocker that
 * drops `*.i.posthog.com` takes the product funnel with it, and a third-party
 * analytics host in `connect-src` widens the CSP for every page. Proxied, the
 * browser only ever talks to `insertgo.ai/_phex/*`, so `connect-src 'self'`
 * covers it (middleware.ts) and there is no host for a blocker to match.
 *
 * `/static` is the asset/recorder bundle host, `/_phex/*` is the event API.
 * `skipTrailingSlashRedirect` below is required: without it Next 308s
 * `/_phex/decide/` and PostHog's client does not follow the redirect.
 */
const POSTHOG_ASSET_HOST = "https://us-assets.i.posthog.com";
const POSTHOG_API_HOST = "https://us.i.posthog.com";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    return [
      { source: "/_phex/static/:path*", destination: `${POSTHOG_ASSET_HOST}/static/:path*` },
      { source: "/_phex/array/:path*", destination: `${POSTHOG_ASSET_HOST}/array/:path*` },
      { source: "/_phex/:path*", destination: `${POSTHOG_API_HOST}/:path*` },
    ];
  },
};

export default nextConfig;
