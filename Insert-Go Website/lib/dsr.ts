/**
 * Data-principal requests and erasure (R-11, R-12).
 *
 * DPDP §§11–14 with the DPDP Rules' 90-day response window. The gap this closes
 * is not that the rights were undocumented — `app/privacy/page.tsx` describes
 * them accurately — but that a described right with no queue, no clock, no
 * owner and no safe execution path is an obligation the system cannot meet.
 * That is worse than saying nothing, because it is an advertised commitment.
 */

import { rpc } from "./db";

export type DsrKind =
  | "access"
  | "correction"
  | "erasure"
  | "grievance"
  | "nomination";

/**
 * Open a request. `verified` records HOW identity was established, and is the
 * gate on erasure: acting on an unverified erasure request is itself a personal
 * data breach — an impostor who can delete someone's account has caused exactly
 * the harm §12(3) exists to prevent.
 *
 * A live web session is verification (it is control of the account). An email
 * to the Grievance Officer is not, and must stay `verified: false` until a
 * human establishes who sent it.
 */
export async function createDsr(args: {
  userId: string;
  kind: DsrKind;
  note?: string | null;
  verified: boolean;
}): Promise<{ id: number; dueAt: string }> {
  const rows = await rpc<{ id: number; dueAt: string }>("dsr_create", {
    p_user_id: args.userId,
    p_kind: args.kind,
    p_note: args.note ?? null,
    p_verified: args.verified,
  });
  const row = rows[0];
  if (!row) throw new Error("dsr_create returned no row");
  return row;
}

export async function fulfilDsr(id: number, note?: string): Promise<void> {
  await rpc("dsr_fulfil", { p_id: id, p_note: note ?? null });
}

/** What `erase_user()` reports back. The Class B counts are the point: an
 *  erasure that changed them is the bug this whole item exists to prevent. */
export interface EraseResult {
  userAnonymised: boolean;
  sessionsDeleted: number;
  accountsDeleted: number;
  apiUsageDeleted: number;
  verificationsDeleted: number;
  ledgerRetained: number;
  auditRetained: number;
  consentRetained: number;
}

/**
 * Execute a verified erasure (R-12).
 *
 * Anonymises the `user` row in place and purges Class A; Class B — the credit
 * ledger (books of account under the Companies Act, GST and income-tax rules),
 * the CERT-In audit log, and the consent history — is retained by design and
 * returned as counts so a caller or a test can assert it did not move.
 *
 * `dsrId` is not optional in practice: the SQL refuses unless it names a
 * verified erasure request belonging to this user.
 */
export async function eraseUser(
  userId: string,
  dsrId: number,
): Promise<EraseResult> {
  const rows = await rpc<EraseResult>("erase_user", {
    p_user_id: userId,
    p_dsr_id: dsrId,
  });
  const row = rows[0];
  if (!row) throw new Error("erase_user returned no row");
  return row;
}

/**
 * Everything held about one user, for the §11 right of access.
 *
 * Deliberately assembled here rather than dumped from the schema: an export is
 * a disclosure, so what it contains is a decision. It carries the subject's own
 * data plus the processing summary and subprocessor list §11(b)–(c) require —
 * a bare row dump answers the first limb and neither of the other two.
 *
 * `session.token` and `account.*Token` are excluded: they are credentials, and
 * a "download my data" file that contains live credentials turns a right into
 * an attack surface the moment it reaches a mailbox.
 */
export interface AccessExport {
  generatedAt: string;
  noticeVersion: string;
  subject: Record<string, unknown>;
  consent: unknown[];
  requests: unknown[];
  usage: unknown[];
  ledger: unknown[];
  processing: {
    purposes: unknown[];
    subprocessors: string;
    retention: string;
  };
}
