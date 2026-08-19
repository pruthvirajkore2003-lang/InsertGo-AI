/**
 * Server-side PostHog, for events that only exist on the backend — a payment
 * webhook lands long after the browser that started it has gone.
 *
 * Deliberately NOT a long-lived singleton with a batching queue: this runs on
 * serverless invocations that are frozen the moment the response is returned,
 * so a queued event is an event that is silently dropped. `flushAt: 1` plus an
 * awaited `shutdown()` is the only shape that actually delivers, and the cost
 * (one extra HTTP round trip on a webhook that already does several) is
 * immaterial on a path that fires once per purchase.
 *
 * Kept separate from lib/analytics.ts because that module imports posthog-js,
 * which has no business in a server bundle.
 */
import { PostHog } from "posthog-node";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

/** A fresh client, or null when PostHog isn't configured. */
export function getPostHogServer(): PostHog | null {
  if (!KEY) return null;
  return new PostHog(KEY, {
    host: HOST,
    // Send immediately — see the note above about frozen invocations.
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Capture one server-side event and wait for it to leave the process.
 *
 * Never throws: analytics must not fail a webhook that has already moved
 * money. Callers are responsible for checking consent first — this function
 * cannot, and a capture that assumed consent would be the exact §6 failure the
 * consent catalogue exists to prevent.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const client = getPostHogServer();
  if (!client) return;
  try {
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch (e) {
    console.error(
      "[analytics] server capture failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
