import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request nonce Content-Security-Policy.
 *
 * This used to live in next.config.ts, which can only emit STATIC headers — so
 * `script-src` was omitted entirely on the grounds that the only alternative was
 * `'unsafe-inline'` (Next injects inline hydration scripts, Tailwind emits inline
 * styles). That reasoning was sound about `'unsafe-inline'` and wrong about the
 * alternatives: a nonce is the third option, and it needs middleware because the
 * value has to change per request.
 *
 * How the nonce reaches Next's own scripts: it is set on the REQUEST headers as
 * well as the response. Next reads the incoming `Content-Security-Policy`,
 * extracts the nonce and stamps it onto every script tag it renders — the
 * documented App Router pattern. `'strict-dynamic'` then covers the chunks those
 * bootstrap scripts load, so no bundle path has to be enumerated here.
 *
 * `style-src` keeps `'unsafe-inline'`: Tailwind v4 and Framer Motion both write
 * inline styles, and there is no nonce pipeline for them. Style injection is not
 * the attack this policy exists to stop.
 *
 * Set CSP_REPORT_ONLY=1 to emit `Content-Security-Policy-Report-Only` instead —
 * for staging a change to the policy, not as a way to run without one.
 *
 * The other security headers stay in next.config.ts: they are static, and static
 * headers are cheaper and harder to accidentally skip than middleware.
 */
export function middleware(req: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is the ignored legacy fallback: any browser that
    // understands the nonce discards it, and one that doesn't gets today's
    // behaviour rather than a blank page.
    //
    // The Google hosts are listed for the same reason and are equally ignored
    // by a CSP3 browser: 'strict-dynamic' is what actually lets adsbygoogle.js
    // and gtag.js run — they are injected by nonced <Script> tags, and the
    // scripts THOSE inject inherit the same trust. Without 'strict-dynamic' an
    // ad tag is unshippable under a nonce policy at all, because the slot
    // iframes pull scripts from hosts nobody can enumerate ahead of time.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://googleads.g.doubleclick.net 'unsafe-inline' https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Same-origin, plus the ad/measurement beacons. PostHog is deliberately
    // absent: it is reverse-proxied through /_phex (next.config.ts), so its
    // ingestion is same-origin and an ad blocker has no third-party host to
    // match on. The desktop client is what talks to Gemini's proxy, and it is
    // not a browser context.
    "connect-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com",
    // Ad slots and the conversion pixel render in iframes from these hosts.
    // child-src repeats frame-src for browsers that only implement the former.
    "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com",
    "child-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const header =
    process.env.CSP_REPORT_ONLY === "1"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

  // Request-side copy is what Next reads to nonce its own <script> tags.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Server components have no other way to see the path, and two of them need
  // it: the AdSense loader is only allowed on public content routes
  // (lib/adPlacement.ts). Set from `nextUrl`, never from a client-supplied
  // header — a spoofed `x-pathname` would otherwise put an ad network on the
  // desktop authorization screen.
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(header, csp);
  return res;
}

export const config = {
  matcher: [
    /*
     * Documents only. Static assets carry no scripts, and /api answers JSON or
     * an SSE stream — a CSP on those is pure overhead, and /api/ai/generate in
     * particular holds tens of thousands of long-lived connections that should
     * not pay for a middleware hop.
     */
    {
      source:
        "/((?!api/|_phex/|ads.txt|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|mp4)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
