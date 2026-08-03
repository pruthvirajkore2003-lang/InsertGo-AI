/**
 * Public pricing catalog for the desktop app (lib/pricing.ts verbatim).
 *
 * Unauthenticated by design: this is the same data the /pricing page serves to
 * anonymous visitors, and the desktop must be able to show plan copy before
 * sign-in. Nothing user-scoped and nothing money-authoritative goes out here —
 * the server still pins products at checkout (lib/dodo.ts).
 *
 * Build-time constant, so it is served statically and cached; a stale-by-an-
 * hour price is still closer to the truth than the desktop's old hardcoded copy.
 */
import { NextResponse } from "next/server";
import { packs, plans } from "@/lib/pricing";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    { plans, packs },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
