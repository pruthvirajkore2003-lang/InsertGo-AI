"use client";

import type { ReactNode } from "react";

import { trackEvent, type AnalyticsEvent, type EventProperties } from "@/lib/analytics";

/**
 * Attach an analytics event to a link or button that lives in a server
 * component.
 *
 * A wrapper rather than an `onClick` on each CTA because the CTAs are rendered
 * on the server — turning `/download`'s installer link into a client component
 * to add one listener would ship the whole page section to the browser for it.
 * `display: contents` keeps the wrapper out of the layout entirely, so it
 * cannot change how the button renders, and the click still bubbles from the
 * real anchor inside.
 *
 * Not focusable and carries no role: the interactive element is the child. This
 * is a listener, not a control.
 */
export function TrackClick({
  event,
  properties,
  children,
}: {
  event: AnalyticsEvent;
  properties?: EventProperties;
  children: ReactNode;
}) {
  return (
    <span
      style={{ display: "contents" }}
      onClick={() => trackEvent(event, properties)}
    >
      {children}
    </span>
  );
}
