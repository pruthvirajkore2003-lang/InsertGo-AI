/**
 * §11 right of access — "download my data" (R-11).
 *
 * Node runtime: this reads several tables through the authenticated pool, and
 * unlike `/api/ai/generate` it is not latency-sensitive.
 *
 * Three decisions worth stating, because the obvious implementation gets each
 * of them wrong:
 *
 *  1. **Credentials are excluded.** `session.token` and `account.accessToken` /
 *     `refreshToken` / `idToken` are personal data held about the subject, and
 *     a naive "everything we hold" dump would include them. That would turn a
 *     data-protection right into a credential-exfiltration primitive the moment
 *     the file reaches a mailbox or a shared drive. §11 is a right to know what
 *     is processed, not a right to be handed live keys.
 *  2. **It answers all three limbs.** §11 asks for the personal data, a summary
 *     of the processing, AND the identities of other Data Fiduciaries/
 *     Processors it has been shared with. A row dump answers only the first, so
 *     the purpose catalogue and the subprocessor register ride along.
 *  3. **The export itself is logged.** An access request is a disclosure of
 *     personal data, so it is exactly the kind of event that matters after an
 *     account takeover — "someone downloaded everything" has to be visible in
 *     the 180-day store.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/auditLog";
import { pool } from "@/lib/pgPool";
import { safeError } from "@/lib/safeLog";
import { NOTICE_VERSION, PURPOSES } from "@/lib/consent";
import { createDsr, fulfilDsr } from "@/lib/dsr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  let payload: Record<string, unknown>;
  let dsrId: number | null = null;
  try {
    // Recorded as a fulfilled §11 request, not just served: the queue is what
    // makes the 90-day SLA measurable, and a self-service export that bypasses
    // it would make the ageing report understate the real request volume.
    const created = await createDsr({
      userId,
      kind: "access",
      note: "[web session] self-service export",
      verified: true,
    });
    dsrId = created.id;

    const [subject, consent, requests, usage, ledger] = await Promise.all([
      pool.query(
        `select "id", "name", "email", "emailVerified", "image", "createdAt",
                "updatedAt", "tier", "subscriptionStatus", "credits",
                "addOnCredits", "dailyCreditsUsed", "dailyCreditsDate", "erasedAt"
           from "user" where "id" = $1`,
        [userId],
      ),
      pool.query(
        `select "at", "purpose", "granted", "noticeVersion", "language", "method"
           from "consentRecord" where "userId" = $1 order by "at"`,
        [userId],
      ),
      pool.query(
        `select "id", "createdAt", "dueAt", "kind", "status", "verifiedAt",
                "fulfilledAt", "note"
           from "dsrRequest" where "userId" = $1 order by "createdAt"`,
        [userId],
      ),
      pool.query(
        `select "action_key" from (
           select "key" as "action_key" from "apiUsage" where "userId" = $1
           order by "updatedAt" desc limit 500
         ) t`,
        [userId],
      ),
      pool.query(
        `select "idempotencyKey", "amount", "replays", "createdAt"
           from "creditLedger" where "userId" = $1 order by "createdAt"`,
        [userId],
      ),
    ]);

    payload = {
      generatedAt: new Date().toISOString(),
      noticeVersion: NOTICE_VERSION,
      note:
        "Session tokens and OAuth tokens are deliberately excluded — they are " +
        "credentials, not information about you, and a file containing them " +
        "would be dangerous to hold.",
      subject: subject.rows[0] ?? null,
      consent: consent.rows,
      requests: requests.rows,
      usage: usage.rows,
      ledger: ledger.rows,
      processing: {
        purposes: PURPOSES.map((p) => ({
          purpose: p.id,
          description: p.description,
          required: p.required,
          dataItems: p.dataItems,
          recipients: p.recipients,
          retention: p.retention,
          retentionClass: p.retentionClass,
        })),
        subprocessors:
          "The full register, including hosting country per processor, is " +
          "published at compliance/subprocessors.md and summarised at /privacy.",
        retention:
          "Class A data is erased on request. Class B — billing ledger, " +
          "security audit log, consent history — is retained under tax, " +
          "company-law and CERT-In obligations and survives erasure.",
      },
    };

    await fulfilDsr(dsrId, "[web session] export served");
  } catch (e) {
    // A pg error's `detail` quotes the row it failed on, and this query's rows
    // are by definition the subject's (R-06).
    safeError("[account/export] failed", e);
    audit("dsr.request", {
      outcome: "failure",
      req,
      userId,
      detail: { kind: "access", dsrId },
    });
    return new Response("Could not build the export. Please try again.", {
      status: 503,
    });
  }

  audit("dsr.fulfilled", {
    outcome: "success",
    req,
    userId,
    detail: { kind: "access", dsrId },
  });

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="insertgo-my-data.json"`,
      // Never let a proxy or the browser keep a copy of someone's whole record.
      "Cache-Control": "no-store, private",
    },
  });
}
