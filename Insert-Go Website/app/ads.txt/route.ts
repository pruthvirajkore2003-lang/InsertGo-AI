/**
 * GET /ads.txt — the IAB authorised-sellers record AdSense crawls.
 *
 * A route rather than `public/ads.txt`, for one reason: a file in `public`
 * shadows a route of the same path, so shipping both would leave the route
 * dead and the publisher id declared in two places that can disagree. The id
 * is deployment configuration (`NEXT_PUBLIC_ADSENSE_PUB_ID`), and this is the
 * one place it is written.
 *
 * Unconfigured answers 404, not a placeholder line. An ads.txt naming a
 * publisher id that isn't ours is worse than no ads.txt at all: Google reads it
 * as "these sellers are authorised", so a stale placeholder actively
 * de-authorises the real account once it exists.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
  if (!pubId || !pubId.startsWith("pub-")) {
    return new Response("Not found", { status: 404 });
  }
  // `f08c47fec0942fa0` is Google's own certification-authority id — a constant
  // for every AdSense publisher, not a per-account secret.
  return new Response(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
