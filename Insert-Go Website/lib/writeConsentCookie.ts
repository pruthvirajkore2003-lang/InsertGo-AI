import { cookies } from "next/headers";

import type { PurposeId } from "./consent";
import {
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  serializeConsent,
} from "./consentCookie";

/**
 * Write the browser-readable mirror of the optional consent purposes.
 *
 * Server-action only — `cookies().set()` throws anywhere else. Split from
 * lib/consentCookie.ts because that module is read by client components, and
 * importing `next/headers` into a client bundle is a build error.
 *
 * `httpOnly: false` is the point: a script must read this. It carries purpose
 * ids and nothing else — no identifier, no user reference — so it is not
 * itself personal data, and it is what makes the site's tags obey a decision
 * recorded in the database.
 */
export async function writeConsentCookie(
  granted: Iterable<PurposeId>,
): Promise<void> {
  (await cookies()).set(CONSENT_COOKIE, serializeConsent(granted), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_COOKIE_MAX_AGE,
  });
}
