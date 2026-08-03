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
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // The site talks to its own origin only; the desktop client is what talks
    // to Gemini's proxy, and it is not a browser context.
    "connect-src 'self'",
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
        "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|mp4)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
