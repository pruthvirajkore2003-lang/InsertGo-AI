"use client";

import { useEffect } from "react";

import { trackPurchase } from "@/lib/analytics";

/**
 * Fire the Google Ads conversion once, on the page Dodo returns the buyer to.
 *
 * Two independent guards against double-counting, because this page is exactly
 * the one people refresh and reach with the back button:
 *
 *  - `transaction_id` — our own id, planted in the Dodo checkout metadata and
 *    carried on the return URL. Google dedups conversions on it server-side,
 *    which is the guard that survives a new tab and a new session.
 *  - `sessionStorage` — stops the PostHog `purchase` event repeating within the
 *    tab, which `transaction_id` does nothing about.
 *
 * The value is the catalogue price for the purchased item, resolved on the
 * server from lib/pricing.ts; the query string only names the item, so a
 * tampered URL can shift our own reporting between two real catalogue prices
 * and nothing else. Dodo is Merchant of Record and charges what the pinned
 * product says — no number here has ever touched the actual charge.
 */
export function PurchaseConversion({
  transactionId,
  value,
  currency,
  item,
  email,
}: {
  transactionId: string;
  value: number;
  currency: string;
  item: string;
  email?: string | null;
}) {
  useEffect(() => {
    const key = `ig_conv_${transactionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode / storage disabled: fall through and rely on
      // transaction_id dedup rather than dropping the conversion.
    }
    trackPurchase({ transactionId, value, currency, item, email });
  }, [transactionId, value, currency, item, email]);

  return null;
}
