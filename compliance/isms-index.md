# ISMS index and Statement of Applicability

**Remediation item:** R-08. **Depends on:** R-21 (done), R-22 (drafted).
**Legal basis:** IT Act 2000 §43A with IT (Reasonable Security Practices…) Rules
2011 **Rule 8**, which *deems* compliance with IS/ISO/IEC 27001 to be
"reasonable security practices".
**Date:** 2026-08-08.

---

## 1. What this is, and what it deliberately is not

Rule 8's deeming provision is the practical value here. After an incident, the
§43A question is whether reasonable practices were **documented and followed**,
and a coherent ISMS answers it with one evidence set instead of an argument.
Certification is optional; documentation is not.

**This document contains no policy text.** It is an index. The substance was
produced by R-01/R-02/R-05/R-06/R-07/R-12/R-17 and lives in the files below, and
duplicating it here would create a second copy that drifts — a drifted policy is
worse than none, because it documents a control you no longer operate. That is
not a hypothetical concern in this estate: three findings in this audit
(`ap-south-1`, the orphaned desktop consent module, and the BYOK sections of the
privacy policy) were documents describing controls that did not exist.

Every row below points at a real artifact. **A row with nothing behind it is a
bug in this table, not a gap to be filled with prose.**

---

## 2. Scope

| | |
|---|---|
| **Organisation** | InsertGo.AI |
| **Services** | InsertGo desktop application (Windows) and the insertgo.com website + managed AI API |
| **In scope** | The Next.js website and API on Vercel; the Supabase Postgres estate; the Tauri desktop client; the release build and signing pipeline; all seven processors in `subprocessors.md` §3 |
| **Out of scope** | The data principal's own machine beyond what the client writes there; enterprise customers' identity providers |
| **Roles** | Engineering lead; CERT-In Point of Contact (primary + backup); Grievance Officer. **All three unfilled — R-16.** |

---

## 3. Statement of Applicability

ISO/IEC 27001:2022 Annex A controls this estate claims, each pointing at the
artifact that implements it. Controls not listed are not claimed.

| Annex A | Control | Artifact | State |
|---|---|---|---|
| A.5.1 | Policies for information security | `SECURITY.md`, this index | ✅ |
| A.5.7 | Threat intelligence | `vulnerability-exceptions.md`; weekly `npm audit` / `cargo audit` | ✅ |
| A.5.19–5.22 | Supplier relationships | `subprocessors.md` §3, §5 | ⚠️ register done, **contracts unsigned (R-18)** |
| A.5.23 | Cloud service security | `subprocessors.md`; `log-retention.md` §11.2 | ⚠️ **region non-conforming (R-19)** |
| A.5.24–5.28 | Incident management | `incident-runbook.md`; `lib/detect.ts`; `auditLog` | ⚠️ **not executable until R-16** |
| A.5.31 | Legal and contractual requirements | `remediation-plan.md`; this index | ✅ |
| A.5.33 | Protection of records | `supabase-audit-log.sql` append-only trigger; `supabase-consent-dsr.sql` §3 | ✅ |
| A.5.34 | Privacy and PII protection | `ropa.json` (generated + CI-gated); `lib/consent.ts`; `dpia-prompt-flow.md` | ✅ |
| A.8.2–8.3 | Privileged and information access | RLS on all tables; `service_role` revoked from `session`/`account`/`verification` | ✅ |
| A.8.5 | Secure authentication | PKCE S256 desktop flow; OTP/OAuth/SSO; no password auth (CHECK-constrained) | ✅ |
| A.8.8 | Technical vulnerability management | `.github/workflows/security.yml`; `scripts/audit-gate.mjs` | ✅ |
| A.8.9 | Configuration management | `.env.example`; `next.config.ts` headers; `middleware.ts` CSP | ✅ |
| A.8.12 | Data leakage prevention | `lib/safeLog.ts` + the R-06 CI log-hygiene gate | ✅ |
| A.8.15 | Logging | `lib/auditLog.ts`; `log-retention.md` | ⚠️ **store outside India (R-19)** |
| A.8.16 | Monitoring activities | `lib/detect.ts`; `audit_log_alerts()`; Vercel cron | ⚠️ **pages nowhere until `OPS_ALERT_TO` is set** |
| A.8.17 | Clock synchronisation | `log-retention.md` §11 | ✅ |
| A.8.24 | Use of cryptography | `lib/sessionTokenHash.ts`; `encryptOAuthTokens`; `lib/pgSsl.ts` | ✅ |
| A.8.28 | Secure coding | `CLAUDE.md` / `AGENTS.md` working rules; typed trust boundaries; Vitest suites | ✅ |
| A.8.31 | Separation of environments | `DODO_ENV`; `NODE_ENV` production guards in `lib/auth.ts` | ✅ |
| A.8.32 | Change management | `scripts/ropa.mjs` CI gate; `security.yml` on every PR | ✅ |

**Six controls are ⚠️, and every one of them traces to an open manual action, not
to missing code.** That is the honest state and it is more useful than a table of
green ticks: R-16 (two rows), R-18, R-19 (two rows), R-03's `OPS_ALERT_TO`.

---

## 4. Risk register

Pointers, not a second copy. The assessments live where the work was done.

| Risk | Assessed in | Current state |
|---|---|---|
| Compromised secrets | `secret-rotation.md` | 1 open: Gemini key revocation |
| Log store outside Indian jurisdiction | `subprocessors.md` §1 | **Open — breach of Direction 4** |
| No incident detection reaching a human | `remediation-plan.md` R-03 | Open — `OPS_ALERT_TO` unset |
| Session token disclosure | `remediation-plan.md` R-04 | Closed in code; migration pending |
| Credential/PII in logs | `remediation-plan.md` R-06 | Closed, CI-gated |
| Known vulnerable dependencies | `vulnerability-exceptions.md` | 8 documented exceptions, review 2026-11-06 |
| Cross-border prompt flow | `dpia-prompt-flow.md` | 3 open risks, all tracked |
| Erasure destroying books of account | `remediation-plan.md` R-12 | Closed by `erase_user()` |
| Notice over-describing privacy (BYOK) | `remediation-plan.md` R-15 | **Closed 2026-08-08** — BYOK cancelled by decision; legal 1.3.0 |

---

## 5. Document set

| Document | Covers |
|---|---|
| `remediation-plan.md` | The programme, findings, and every acceptance criterion |
| `secret-rotation.md` | A.5.17 — secret inventory and rotation procedures |
| `log-retention.md` | A.8.15–8.17 — logging, retention, time sources |
| `vulnerability-exceptions.md` | A.8.8 — exceptions with owners and review dates |
| `subprocessors.md` | A.5.19–5.23 — processors, regions, transfers |
| `incident-runbook.md` | A.5.24–5.28 — dual-clock incident response |
| `dpia-prompt-flow.md` | A.5.34 — privacy impact of the AI relay |
| `ropa.json` | A.5.34 — generated record of processing |
| `Insert-Go Windows/SECURITY.md` | Boundary decisions, dependency floors |

---

## 6. Review

Annually, and on any of: an incident of any Annexure I type; notification as a
Significant Data Fiduciary (R-20); a new processor; a change to what leaves the
device.

**Acceptance (R-08).** *"Every Annex A control claimed in the SoA points to a real
artifact in this repo or a named external system."* **Met** — §3 has no row
whose artifact column is empty or aspirational, and the six unfinished controls
are marked ⚠️ against a named open action rather than claimed as complete.
