"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { adsAllowedOn, adsenseClient } from "@/lib/adPlacement";

/**
 * One responsive AdSense slot.
 *
 * Two things this component exists to get right:
 *
 *  1. **No layout shift.** The wrapper reserves its height before the ad
 *     arrives (`min-h-[280px]`, or whatever the caller passes). An `<ins>` that
 *     grows from 0 to 280px after hydration is a CLS penalty on a page whose
 *     whole purpose is organic search traffic — it costs more ranking than the
 *     slot earns.
 *  2. **Survives an SPA re-mount.** `adsbygoogle.push({})` throws
 *     ("All 'ins' elements ... already have ads") if the same element is pushed
 *     twice, which App Router navigation makes routine. The push is guarded by
 *     a ref and wrapped in try/catch: an ad that fails to fill must never take
 *     the page down with it.
 *
 * Renders nothing when AdSense is unconfigured or the route isn't an ad route
 * (lib/adPlacement.ts) — the same predicate the loader script uses, so a slot
 * can never appear on a page whose loader was suppressed.
 *
 * `slot` defaults to a single responsive display unit
 * (`NEXT_PUBLIC_ADSENSE_SLOT`). One unit reused across placements is what
 * AdSense's own auto-sizing is built for, and it keeps the configuration to
 * two environment variables; pass `slot` explicitly only when a placement
 * needs its own line in the AdSense report.
 */
export function AdUnit({
  slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "",
  format = "auto",
  responsive = true,
  className = "",
  minHeight = "min-h-[280px]",
  label = "Advertisement",
}: {
  slot?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  minHeight?: string;
  label?: string;
}) {
  const client = adsenseClient();
  const pathname = usePathname();
  const allowed = Boolean(client) && Boolean(slot) && adsAllowedOn(pathname);
  const pushed = useRef(false);

  useEffect(() => {
    if (!allowed || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // Blocked, not yet loaded, or already filled — all three are fine.
    }
  }, [allowed]);

  if (!allowed) return null;

  return (
    // aria-hidden on the label, not the slot: screen-reader users should be
    // able to tell an ad from the article, and "Advertisement" is how.
    <aside
      aria-label={label}
      className={`mx-auto w-full max-w-[760px] px-6 ${className}`}
    >
      <span className="mb-2 block text-[11px] tracking-[0.14em] text-muted uppercase">
        {label}
      </span>
      <div className={`${minHeight} overflow-hidden`}>
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={client ?? undefined}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={responsive ? "true" : "false"}
        />
      </div>
    </aside>
  );
}
