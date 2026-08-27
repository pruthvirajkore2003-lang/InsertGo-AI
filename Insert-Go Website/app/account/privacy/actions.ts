"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { audit, clientIp } from "@/lib/auditLog";
import {
  currentConsent,
  OPTIONAL_PURPOSES,
  PURPOSES,
  recordConsent,
  type PurposeId,
} from "@/lib/consent";
import { writeConsentCookie } from "@/lib/writeConsentCookie";
import { noteDbFailure } from "@/lib/dbFailure";
import { createDsr, eraseUser, fulfilDsr } from "@/lib/dsr";

async function requireUserId(): Promise<{
  userId: string;
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/login");
  return {
    userId: session.user.id,
    ip: clientIp(new Request("https://insertgo.ai", { headers: h })),
    userAgent: h.get("user-agent"),
  };
}

/**
 * Toggle one purpose (R-10).
 *
 * §6(4)–(6) requires withdrawal to be *as easy as* giving consent. That is a
 * mechanical test — count the clicks each way — and this is the whole reason
 * there is no confirmation step, no "are you sure you'll lose…" interstitial
 * and no retention offer here. That friction is precisely the asymmetry the
 * section prohibits, and adding it would fail the item while looking like care.
 *
 * One click to grant at the gate, one click to withdraw here.
 *
 * Withdrawing a REQUIRED purpose is refused rather than silently ignored: those
 * are preconditions of the service, and the honest route out of them is account
 * deletion below, which is offered on the same page.
 */
export async function setPurpose(formData: FormData): Promise<void> {
  const { userId, ip, userAgent } = await requireUserId();

  const id = formData.get("purpose");
  const granted = formData.get("granted") === "true";
  const found = PURPOSES.find((p) => p.id === id);
  // Client input: only a purpose from the catalogue, never an arbitrary string.
  if (!found) redirect("/account/privacy");
  if (found.required && !granted) redirect("/account/privacy?required=1");

  try {
    await recordConsent({
      userId,
      purpose: found.id as PurposeId,
      granted,
      method: "web_account_settings",
      ip,
      userAgent,
    });
  } catch (e) {
    noteDbFailure("privacy", "consent_write", e, userId);
    // The attempt is worth a durable row even though the decision is not
    // stored: "the user tried to withdraw and our store was down" is the one
    // fact that explains, later, why the consent record still says granted.
    audit(granted ? "consent.grant" : "consent.withdraw", {
      outcome: "failure",
      userId,
      detail: { purpose: found.id, method: "web_account_settings" },
    });
    // Back to the page with a code, never with the database's own words.
    redirect("/account/privacy?error=save_failed");
  }

  // Re-read rather than patching the previous cookie: this action toggles ONE
  // purpose, and a cookie rebuilt from a stale local guess is how a withdrawal
  // of `marketing` silently re-grants `analytics`.
  try {
    const state = await currentConsent(userId);
    await writeConsentCookie(
      OPTIONAL_PURPOSES.filter((id) => state.get(id)?.granted),
    );
  } catch {
    // The record is written; the mirror can miss. ConsentSync re-reads on the
    // next navigation, and a missing cookie reads as denied — the safe side.
  }

  audit(granted ? "consent.grant" : "consent.withdraw", {
    outcome: "success",
    userId,
    detail: { purpose: found.id, method: "web_account_settings" },
  });

  revalidatePath("/account/privacy");
}

/** Raise a grievance or a correction/nomination request (R-11, §13, §14). */
export async function raiseRequest(formData: FormData): Promise<void> {
  const { userId } = await requireUserId();

  const kindRaw = formData.get("kind");
  const kind =
    kindRaw === "correction" || kindRaw === "grievance" || kindRaw === "nomination"
      ? kindRaw
      : null;
  if (!kind) redirect("/account/privacy");

  const note = String(formData.get("note") ?? "").slice(0, 2000);

  // Verified: raised from a live session, which is control of the account.
  let id: number;
  let dueAt: string;
  try {
    ({ id, dueAt } = await createDsr({
      userId,
      kind,
      note: `[web session] ${note}`,
      verified: true,
    }));
  } catch (e) {
    noteDbFailure("privacy", "dsr_create", e, userId);
    audit("dsr.request", { outcome: "failure", userId, detail: { kind } });
    // Told plainly that it was NOT recorded, and pointed at the email route:
    // §13's clock starts when the request reaches us, so a user who believes
    // a failed submit filed a grievance is a user whose clock never started.
    redirect("/account/privacy?error=request_failed");
  }

  audit("dsr.request", {
    outcome: "success",
    userId,
    detail: { kind, dsrId: id, dueAt },
  });

  redirect("/account/privacy?raised=1");
}

/**
 * Delete my account (R-11 → R-12).
 *
 * Unlike a consent toggle, this DOES take a confirmation step, and that is not
 * inconsistent with §6(4): the symmetry rule governs withdrawing consent, not
 * destroying an account. Erasure is irreversible and a mis-click costs the user
 * their data, so the friction here protects the subject rather than deterring
 * them.
 *
 * The request is created and executed in one path because a live session is the
 * verification — but it is still written to `dsrRequest` first, so the record
 * shows a verified request preceded the erasure. `erase_user()` refuses if it
 * does not.
 */
export async function eraseAccount(formData: FormData): Promise<void> {
  const { userId } = await requireUserId();

  // Type-to-confirm. Cheap, and it makes the intent unambiguous in a way a
  // second button does not.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect("/account/privacy?confirm=1");
  }

  // Three failure scopes, not one, because the honest message differs at each
  // step and a single catch would have to pick one and be wrong twice.
  let id: number;
  try {
    ({ id } = await createDsr({
      userId,
      kind: "erasure",
      note: "[web session] self-service account deletion",
      verified: true,
    }));
  } catch (e) {
    noteDbFailure("privacy", "dsr_create", e, userId);
    audit("account.erasure", {
      outcome: "failure",
      userId,
      detail: { stage: "dsr_create" },
    });
    redirect("/account/privacy?error=erasure_failed");
  }

  let result;
  try {
    result = await eraseUser(userId, id);
  } catch (e) {
    noteDbFailure("privacy", "erase_user", e, userId);
    audit("account.erasure", {
      outcome: "failure",
      userId,
      detail: { stage: "erase_user", dsrId: id },
    });
    // The account really is untouched here — `erase_user()` is one transaction
    // and either applied all of it or none. The DSR row stays open on purpose:
    // a verified erasure request was made, so §12's clock is running whether or
    // not this attempt completed, and the queue is where that is visible.
    redirect("/account/privacy?error=erasure_failed");
  }

  try {
    await fulfilDsr(id, "[web session] erased in place; Class B retained");
    audit("dsr.fulfilled", {
      outcome: "success",
      userId,
      detail: { kind: "erasure", dsrId: id },
    });
  } catch (e) {
    // Past the point of no return: the data IS gone. Telling this user their
    // "account is unchanged" would be a false statement about an irreversible
    // act, so this failure is logged and the flow continues. What is left
    // undone is bookkeeping — the request stays open until dsr_fulfil lands.
    noteDbFailure("privacy", "dsr_fulfil", e, userId);
  }

  audit("account.erasure", {
    outcome: "success",
    userId,
    detail: {
      dsrId: id,
      sessionsDeleted: result.sessionsDeleted,
      // Retained counts go in the log on purpose: after an erasure the log is
      // the only place left that can show statutory retention was applied
      // deliberately rather than by omission.
      ledgerRetained: result.ledgerRetained,
      consentRetained: result.consentRetained,
    },
  });

  // Every session row for this user is gone, so the cookie in hand is already
  // dead — this just lands them somewhere that says so.
  redirect("/?erased=1");
}
