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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
