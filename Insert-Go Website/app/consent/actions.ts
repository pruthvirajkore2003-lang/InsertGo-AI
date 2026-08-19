"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { audit, clientIp } from "@/lib/auditLog";
import {
  OPTIONAL_PURPOSES,
  REQUIRED_PURPOSES,
  recordConsent,
  type PurposeId,
} from "@/lib/consent";
import { writeConsentCookie } from "@/lib/writeConsentCookie";

/**
 * Record the consent gate's decisions (R-09, R-14).
 *
 * Server action rather than a route handler: the form works without JavaScript,
 * which matters more here than anywhere else in the app — a consent gate that
 * silently fails to submit is a user who believes they consented and a record
 * that says they did not.
 *
 * Every purpose is written on every submit, including the optional ones the
 * user left unticked. A declined purpose has to be recorded as `granted: false`
 * and not merely omitted: "asked and declined" and "never asked" are different
 * facts, and only the first is evidence that the choice was genuinely offered.
 */
export async function submitConsent(formData: FormData): Promise<void> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/login");

  const userId = session.user.id;
  // A server action's FormData is client input. Read the fixed catalogue and
  // ask the form about each id, rather than iterating whatever keys arrived —
  // otherwise a crafted post could write a purpose the gate never displayed.
  const ticked = (id: PurposeId) => formData.get(`purpose:${id}`) === "on";

  // Required purposes are a precondition of the service, so reaching this
  // action at all means they were accepted — the submit button is disabled
  // until every one is ticked, and this re-checks it server-side because a
  // disabled button is a UI affordance, not a control.
  const missing = REQUIRED_PURPOSES.filter((id) => !ticked(id));
  if (missing.length > 0) {
    // No partial write: recording some required purposes and not others leaves
    // a state the gate will re-prompt for anyway, with a misleading history.
    redirect("/consent?incomplete=1");
  }

  const ip = clientIp(new Request("https://insertgo.ai", { headers: h }));
  const userAgent = h.get("user-agent");

  for (const id of [...REQUIRED_PURPOSES, ...OPTIONAL_PURPOSES]) {
    await recordConsent({
      userId,
      purpose: id,
      granted: ticked(id),
      method: "web_consent_gate",
      ip,
      userAgent,
    });
  }

  // Mirror the optional purposes into the browser so the tags can read them
  // (lib/consentCookie.ts). Written after the authoritative rows, never
  // instead of them: the cookie is a transport, and if the two ever disagree
  // the database is the one a regulator is shown.
  await writeConsentCookie(OPTIONAL_PURPOSES.filter(ticked));

  audit("consent.grant", {
    outcome: "success",
    userId,
    detail: {
      method: "web_consent_gate",
      // Counts, never the decisions themselves — the authoritative record is
      // consentRecord, and duplicating it into the 180-day store would put the
      // same fact in two places that can disagree.
      required: REQUIRED_PURPOSES.length,
      optionalGranted: OPTIONAL_PURPOSES.filter(ticked).length,
    },
  });

  redirect("/account");
}
