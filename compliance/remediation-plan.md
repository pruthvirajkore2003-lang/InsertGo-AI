# InsertGo — DPDP + CERT-In remediation plan

**Scope:** `Insert-Go Website` (Next.js app + managed API) and `Insert-Go Windows`
(Tauri desktop client), as one data-fiduciary estate.
**Regulations:** Digital Personal Data Protection Act 2023 and the DPDP Rules;
IT Act 2000 §43A with the IT (Reasonable Security Practices and Procedures and
Sensitive Personal Data or Information) Rules 2011; CERT-In Directions
No. 20(3)/2022.
**Opened:** 2026-08-06. **Last updated:** 2026-08-08.

Deliberately **not** used: GDPR Standard Contractual Clauses, transfer impact
assessments, or GDPR's 72-hour all-purpose breach rule. India's §16 uses a negative
list and CERT-In's first deadline is 6 hours — importing European instruments would
produce paperwork that answers no Indian obligation while missing the one that bites.

---

## How to read this

Each item carries **Evidence** (what was actually found in the code, with
`file:line`), **Analysis** (root cause and why the obvious fix is wrong),
**Design** (the decision and the rejected alternative), **Steps**, and
**Acceptance** (a testable condition). An item is not done until Acceptance passes.

Priorities are relative to *this* estate, not generic severity: an in-force
obligation with no control outranks a future-dated one with a partial control.

---

## Status dashboard

| # | Item | Priority | Status |
|---|---|---|---|
| R-01 | Compromised-secret remediation | High | **Code complete — 1 manual action open** |
| R-02 | 180-day immutable log store | High | **Blocked** — code done, store is outside India (R-19) |
| R-03 | Incident detection (starts the 6h clock) | High | **Code complete — 5 manual actions open** |
| R-04 | Hash session tokens, encrypt account secrets | High | **Code complete — 1 manual action open** |
| R-05 | NTP sync to NIC/NPL | Medium | **Done** |
| R-06 | Strip PII from application logs | High *(raised)* | **Done** |
| R-07 | Vulnerability-management cadence | Medium | **Code complete — 1 manual action open** |
| R-08 | ISMS document set | Low | **Index done — 2 inputs still open** |
| R-09 | Consent artifact | High | **Code complete — 1 manual action open** |
| R-10 | Consent withdrawal path | High | **Code complete — 1 manual action open** |
| R-11 | Data-principal rights + 90-day SLA | High | **Code complete — 1 manual action open** |
| R-12 | Two-class retention / anonymise-in-place erasure | High | **Code complete — 1 manual action open** |
| R-13 | Itemise and version the §5 notice | Medium *(lowered)* | **Code complete — Hindi open** (BYOK text closed by R-15) |
| R-14 | Age capture at signup | Low *(lowered)* | **Done** (rides on R-09) |
| R-15 | Desktop data-flow notice | **High** *(re-raised)* | **Done** — BYOK cancelled by decision; both policies corrected, notice shipped in-app |
| R-16 | File CERT-In Point of Contact | High | Pending |
| R-17 | Dual-track breach runbook | High | **Done** — not executable until R-16 + R-03's open actions |
| R-18 | Processor contracts under §8(2) | High | Pending |
| R-19 | Subprocessor register + region pin | High *(raised)* | **Register done — region non-conforming, migration open** |
| R-20 | Verify published grievance contact | Low *(lowered)* | **Queue now exists — routing + name still open** |
| R-21 | RoPA generated from schema | Medium | **Done** |
| R-22 | DPIA for the cross-border prompt flow | Low | **Drafted — unsigned, blocked on R-16** |

### Corrections to the initial audit

The first pass was written before reading `supabase-auth-schema.sql:160-179` and
`app/privacy/page.tsx` in full. Four findings were overstated and two understated.
Recorded here because an audit that quietly revises itself is not auditable.

| Item | Initial finding | Actual | Effect |
|---|---|---|---|
| R-04 | "RLS not enabled — schema shows no `enable row level security`" | **Wrong.** All 7 tables have RLS enabled (`:170-176`) and default privileges are revoked from `anon`/`authenticated` (`:179`) | Scope cut to token hashing + column encryption |
| R-13 | "Privacy notice not itemised, English-only, prose" | **Partly wrong.** The notice is substantive and specific — named processors, Dodo as MoR, BYOK egress, on-device boundary, DPDP nomination right, IT Rules 2011 Rule 4 | High → Medium; itemise and version rather than rewrite |
| R-20 | "No published DPO / grievance contact" | **Wrong.** Grievance Officer is named with an email (`app/privacy/page.tsx:29-31`) and a stated acknowledgement window | Medium → Low; verify rather than build |
| R-14 | "No age gate at all" | **Partly wrong.** The policy states an 18+ intent | Medium → Low; capture and record at signup |
| R-06 | "One `console.log` on the contact route" | **Understated.** `lib/auth.ts:139,158` log **OTP codes** and `:155` logs an email address | Medium → **High** |
| R-06 / R-07 | "Neither repo has any `.github/workflows`" | **Wrong.** `.github/workflows/release-windows.yml` exists at the monorepo root — found while tracing time sources for R-05 | Both get cheaper: a second workflow file, not new CI |
| R-19 | "Register absent; posture substantively fine" | **Understated.** R-02's Direction 4 jurisdiction claim now *depends* on the region pin | Medium → **High**, and it blocks R-02's acceptance |

### Correction round 2 — 2026-08-08, from building R-19

| Item | Prior claim | Actual | Effect |
|---|---|---|---|
| R-02, R-05, R-19 | Supabase project is in `ap-south-1` (Mumbai) | **Wrong.** `ap-northeast-1` (Tokyo). Verified two ways — the pooler host is literally `aws-0-ap-northeast-1.pooler.supabase.com`, and the resolved DB address `2406:da14:18fe:…` sits in AWS's published `2406:da14::/35` = `ap-northeast-1` | Direction 4's jurisdiction limb is **breached**. R-02 Done → **Blocked**. R-05 unaffected (see below) |
| R-18 | "Processors in use: Supabase, Vercel, Google, Dodo, Resend" — five | **Incomplete.** `@upstash/redis` and `@upstash/vector` are declared dependencies on a live Edge path, and Upstash Vector holds **prompt embeddings and cached response text** | Seven processors, not five. R-18's acceptance re-scoped |
| R-05 | Relies on "the database is pinned to `ap-south-1`" | Premise wrong, **conclusion unaffected** — the argument is that the estate spans multiple geographies, and Edge-plus-Tokyo spans more than Edge-plus-Mumbai. Same AWS Time Sync stratum-1 source in either region | **R-05 stays Done.** Region string corrected in `log-retention.md` §11.2 |
| — | *(not previously noted)* | The production deployment answers **503 `DEPLOYMENT_PAUSED`** on every route | Makes the migration free to do now; also means R-01's acceptance test cannot be run until it resumes |

### Correction round 3 — 2026-08-08, from building the consent chain

Same class of error as round 2, three more times. Each was found by reading the
code rather than the document that described it.

| Item | Prior claim | Actual | Effect |
|---|---|---|---|
| R-09 | "No consent table anywhere… no consent capture. Nothing records what a user was shown or agreed to." | **Understated in one direction, overstated in the other.** A *versioned* consent mechanism was built — `LEGAL_VERSION`, `needsConsent()`, `CONSENT_LABEL`, 600 lines of shipped legal text (`Insert-Go Windows/src/legal/index.ts`) — and then **orphaned**: nothing imports that module, `acceptedTermsVersion` is always null, and `types/index.ts:187` admits "no in-app screen collects it since setup was removed" | Consent was worse than absent — it was *documented as a launch blocker* while collecting nothing. Also confirms the design: it bundled everything into one "I accept the Terms and Privacy Policy" checkbox, the exact §6(1) failure R-09 predicted |
| R-11 | "`dueAt` must be a stored generated column" | **Not implementable as specified.** A stored generated column requires an IMMUTABLE expression; `timestamptz + interval` is STABLE (`pg_proc.provolatile = 's'`, verified against the live database) — Postgres rejects it outright | Same property delivered by DEFAULT + CHECK + a single writing RPC. Recorded in the SQL so the next person does not re-derive the rejection |
| R-13, R-15, R-22 | "BYOK direct-egress disclosure" treated as a live, disclosed feature | **The feature does not exist.** `createProvider()` **throws** for any host but Gemini's (`aiProviders.ts:496-502`); `ProviderConfig.apiKey` is `@deprecated`, "always empty or a dummy marker"; `providers.rs` ignores any legacy `apiKey`; and even the Gemini lane posts to *our relay*, never to Google | **R-15 re-raised Low → High.** Both privacy policies describe a privacy-protective mode nobody has. See R-15 |

The third one is the serious one, and it runs the opposite way to a normal
compliance gap: the notice **over**-promises privacy. A user reading it believes
their keys stay in Windows Credential Manager and their text goes straight to a
provider we never see. In the shipped build there are no keys, and every
generation goes through our servers.

### Product decision — 2026-08-08: BYOK is cancelled

Round 3's third finding was escalated rather than fixed, because the two possible
readings ("not shipped yet" / "abandoned") produce opposite legal text. The owner's
answer: **BYOK will not be implemented, in this release or any future one.**

| | Effect |
|---|---|
| R-15 | Blocked → **Done.** Sections removed rather than re-tensed; the in-app data-flow notice now describes the managed relay |
| R-13 | BYOK limb closed; only Hindi remains |
| R-22 | One flow to assess, not two — and a **weaker** proportionality case, recorded rather than glossed |
| R-19 | The "not a subprocessor" row survives as reasoning, with nothing to apply to |
| Code | `domain/ollama.rs`, `readNdjsonStream`, ~35 provider hosts and the floater's `https://**` scope deleted |

The decision is the cheap half. The expensive half is that a feature nobody built was
described as shipped in two legal documents, a DPIA, a subprocessor register and an
ISMS index — five artifacts, none of which had been checked against
`createProvider()`. Same failure as `ap-south-1`, one item later.

The mechanism is worth naming because it will repeat: `ap-south-1` was never read from
anything. It was written into `log-retention.md` §1 as the region the design *required*,
then cited by R-05 and by R-02's acceptance limb as though it were an observation. Three
documents agreed with each other and none agreed with the `DATABASE_URL` in `.env.local`.
This plan's own standard — R-07's "reachability is established with the tool, not
asserted" — was stated two items before it was violated. `subprocessors.md` §6 gives
every region claim a command.

---

## Dependency order

```
R-01 ─ (independent, do first: live exposure)
R-16 ─ (independent: R-03 has no owner without it)
   └─> R-02 [BLOCKED on the migration] ─> R-03 [CODE DONE] ─> R-17
R-19 [REGISTER DONE] ─> ap-south-1 migration ─> unblocks R-02
R-06 ─ (independent)
R-04 ─ (independent)
R-09 ─> R-10 ─> R-12 ─> R-11
   └──> R-13 (notice must describe what R-09 actually collects)
R-21 ─> R-22 ─> R-08
R-18 ─> R-19 (register is the input to the contract set)
```

Four-week critical path: **R-01 → R-16 → R-03 → R-19 → R-18**. Until R-03 exists,
the runbook in R-17 is unexecutable no matter how well written; until R-16 exists,
R-03 pages nobody.

*Revised 2026-08-08:* the `ap-south-1` migration is now the **first** thing on that
path, ahead of R-01. Not because it is more serious than a compromised key, but
because it is the only item whose cost is currently zero and rises with every day the
deployment stays paused — R-01's remaining action is a key rotation that costs the
same next week.

---

# Technical security

## R-01 — Compromised-secret remediation
**Priority:** High **Status:** Code complete, one manual action open
**Detail:** `compliance/secret-rotation.md`

**Evidence.** `Insert-Go Windows/SECURITY.md:6-17` carried an open "ACTION REQUIRED"
block naming `JWT_SECRET` and `GEMINI_API_KEY` as compromised via CVE-2026-39364 and
CVE-2025-31125 (Vite 5.4.3 dev server reading `.env`). Both were still listed as
outstanding at audit time.

**Analysis.** The instruction to "regenerate `JWT_SECRET`" could not be carried out,
because the variable is **dead**. Verified before touching it: no `jsonwebtoken` or
`jose` dependency in either `package.json`, and no signing code in either tree — the
only surviving mentions are comments describing the Better Auth *bearer* token
(`src/services/aiProviders.ts:333`, `aiProviders.test.ts:116`). It is residue from a
local auth server that was deleted when auth moved to Better Auth on the website.

This is the more interesting finding. A rotation ticket that cannot be executed sits
open indefinitely and trains everyone to read the ACTION REQUIRED banner as
decoration. The root-cause fix for a compromised secret that nothing reads is
deletion, not rotation — rotating it would have closed the ticket while leaving a live
secret in a file a known-vulnerable dev server can serve.

`BETTER_AUTH_SECRET` was **not** part of this exposure: it lives only in the website's
`.env.local`, which the desktop dev server could not reach. Asserting otherwise would
have forced an unnecessary global sign-out.

**Legal basis.** DPDP §8(5); IT Act §43A with IT Rules 2011 Rule 8.

**Design.** Delete the dead secret; rotate the live one; write the runbook that makes
the next rotation a checklist rather than an investigation. Rejected: rotating
`JWT_SECRET` to close the ticket cosmetically.

**Done.** `JWT_SECRET` removed from `Insert-Go Windows/.env` and `.env.example`
(value never surfaced; temp backup deleted). `SECURITY.md:6` rewritten with accurate
per-secret status. `compliance/secret-rotation.md` created: 8-secret inventory,
per-secret procedures, session-purge SQL, quarterly checklist, rotation log. Confirmed
`.env` was never committed in either repo — no history scrub needed.

**Open.** Revoke the Gemini key in AI Studio, reissue, update Vercel, redeploy
(`secret-rotation.md` §3.1). No API exists for revocation; a human must do it.

**Acceptance.** Old key returns 403 from the Gemini API; a real generation through
`/api/ai/generate` returns 200 with a `usage: prompt=…` line. A successful *login*
proves nothing here — sign-in does not touch the Gemini key.

---

## R-02 — 180-day immutable log store
**Priority:** High **Status:** **Blocked** — code complete, store is outside Indian jurisdiction
**Detail:** `compliance/log-retention.md`, `compliance/subprocessors.md` §1

**Evidence.** No centralised log store existed. Vercel runtime logs and Supabase logs
retain for days on this project's plans. Security-relevant events were scattered
`console.error`/`console.warn` strings across `app/api/**` and `lib/**`.

**Analysis.** CERT-In Direction 4 has been in force since June 2022 and requires a
*rolling 180 days*, within Indian jurisdiction. A log line that has aged out is one
CERT-In can be told about but not shown. This is also the precondition for everything
downstream: a 6-hour filing (R-03/R-17) needs evidence attached, and the evidence has
to already exist when the incident starts — you cannot begin retaining logs at T+0.

**Design.** Append-only Postgres table in the existing Supabase project, written
through a `security definer` RPC. Reuses the exact pattern in `supabase-edge-rpc.sql`,
adds no infrastructure, no credential and no dependency, works from the Edge runtime
(fetch-only) where `/api/ai/generate` holds the highest-value events, and inherits
jurisdiction from the region pin R-19 already requires.

Rejected: S3 `ap-south-1` + Object Lock COMPLIANCE + Vercel Log Drain. It is
*genuinely stronger* — COMPLIANCE mode cannot be shortened by anyone including account
root, whereas a database owner with `psql` can drop a trigger. Rejected on cost, not
on merit, and recorded as the documented upgrade path with the exact threat it closes
(`log-retention.md` §6). The current control defends a leaked **application**
credential, which is the realistic threat at this size.

**Three load-bearing decisions.**

1. **No foreign key on `auditLog.userId`.** Every other table in the schema carries
   `references "user"("id") on delete cascade`. This one must not: a DPDP §12(3)
   erasure request would otherwise destroy, on request, exactly the records Direction 4
   requires be kept for 180 days. An audit trail a subject can delete is not an audit
   trail. The same reasoning applies to `consent_record` and `dsr_request` (R-09/R-11).
2. **The 180-day floor is unshrinkable in SQL.** `audit_log_purge()` applies
   `greatest(coalesce(p_older_than_days, 210), 180)`, so a mistaken
   `audit_log_purge(30)` deletes nothing still owed. Retention is a floor, not a
   target; over-retention never breaches Direction 4, under-retention always does.
3. **Append-only for every role including the owner.** A statement-level
   `BEFORE UPDATE OR DELETE` trigger raises unconditionally; the purge opens the gate
   with a transaction-local GUC that a PostgREST caller cannot set, because PostgREST
   transmits no arbitrary SQL.

**Privacy interaction.** IP and user-agent are logged and are personal data. The basis
is compliance with a legal obligation, **not** consent — so they are Class B in R-12's
retention classifier and survive a withdrawal or erasure request. R-13's notice must
say so: a subject who asks for erasure and finds security logs retained should have
read why beforehand, not discover it in the refusal.

**Shipped.** `supabase-audit-log.sql`, `lib/auditLog.ts` (closed event catalogue mapped
to Annexure I types, fire-and-forget via `after()`, console fallback),
`lib/auditLog.test.ts` (8 tests), `compliance/log-retention.md`. Wired into
`billing/webhook/route.ts` (signature invalid → critical; unmatched user) and
`ai/generate/route.ts` (replay refused → critical). Full suite 108/108,
`tsc --noEmit` clean.

**Acceptance.** (a) Bad-signature webhook produces exactly one
`billing.webhook.signature_invalid` row; (b) `delete from "auditLog";` raises
`auditLog is append-only: DELETE refused`; (c) `audit_log_coverage(180)` returns no
zero-event day; (d) **the Supabase project is in `ap-south-1`**.

**Limb (d) FAILED, 2026-08-08.** R-19 verified the project as `ap-northeast-1` (Tokyo),
not `ap-south-1`. The jurisdiction limb of Direction 4 is not asserted-but-unproven — it
is **breached**. Limbs (a)–(c) pass and the code needs no change; the 180-day floor,
the append-only trigger and the purge floor are all correct and all in the wrong
country.

This is the failure mode R-19's own analysis named as the worst of the three possible
states: not a missing control, but a documented control that does not do what its
policy says. `log-retention.md` §1 would have told CERT-In the store was in India.

Unblocked by the migration in `subprocessors.md` §2 — one operation, no code change.
Do it **before the deployment resumes**: production is currently paused, so the restore
window costs nothing today and gets more expensive with every user, ledger row and day
of log that has to move.

---

## R-03 — Incident detection (starts the 6-hour clock)
**Priority:** High **Status:** Code complete, five manual actions open
**Depends on:** R-02 (done), R-16 **Detail:** `compliance/log-retention.md` §10

**Evidence.** No alerting exists over security events. `lib/alert.ts` is the only
paging mechanism and has exactly one call site (the billing webhook's lost-pack-grant
branch); its own header notes it is unusable from `/api/ai/generate` because that route
runs on Edge with a deliberately `fetch`-only dependency graph.

**Analysis.** This is the highest-priority remaining item, and the reason is a wording
detail: CERT-In Direction 2 runs from **"noticing"** the incident. If nothing notices,
the clock never starts — which sounds like safety and is the opposite. An incident
discovered weeks later during a support ticket was, on the regulator's reading,
noticed then; the filing is late by weeks and the log window may already have rolled.
Detection is what converts an unbounded exposure into a bounded, defensible one.

R-02 made critical events durable but nothing reads them. That gap is the whole item.

**Legal basis.** CERT-In Direction 2 (6 hours from noticing); Direction 4.

**Design.** Poll `auditLog` for `severity = 'critical'` and for rate anomalies in
`warn` classes, and page the R-16 Point of Contact. A Vercel Cron route running every
5 minutes is the lazy correct answer: it needs no new service, and 5 minutes is
immaterial against a 6-hour deadline. Reuse `alertOps()` for delivery rather than
adding a paging dependency — its header already flags pointing `OPS_ALERT_TO` at a
PagerDuty/Opsgenie intake as the upgrade (see correction 2 on its dedup).

Alert classes, each mapped to an Annexure I type:
- any `severity='critical'` row → immediate page;
- `auth.signin` failures above a per-IP and per-account threshold → credential
  stuffing / identity theft. Per-account is keyed on a truncated SHA-256 of the
  address, so the rule works without an address ever entering the 180-day store;
- `billing.webhook.signature_invalid` burst → unauthorised access;
- `ai.replay_refused` burst → metering bypass, attacks on applications;
- `db.permanent_failure` sustained → attacks on servers;
- **zero-event day → the log sink is down**, which must page louder than any single
  event. The two burst rules above are dormant by construction: both call sites write
  `critical` today, so the first rule pages first and the SQL excludes critical rows
  from them — they exist so a future demotion cannot silently remove detection.

**Two corrections made while building this.**

1. **`databaseHooks` is the wrong seam.** A session row is written only when
   authentication *succeeds*, so a database hook can never observe a failure — and
   failures are the entire input to the credential-stuffing rules. The
   request-level `hooks.after` middleware is the one that sees both:
   `dispatchAuthEndpoint` catches a thrown `APIError`, parks it on
   `context.returned`, and *then* runs the after-hooks. Success is taken from
   `context.newSession` rather than from the absence of an error, because a
   successful OAuth callback also leaves as a 302 `APIError` — classifying on the
   error object alone would have recorded every successful Google sign-in as a
   failure.
2. **`alertOps()`'s dedup does not survive.** Its 5-minute window is a
   process-local `Map`, and a cron route is cold far more often than it is warm, so
   in practice it deduplicates nothing. Left unaddressed, a live incident pages
   every 5 minutes until the inbox is unreadable — and `coverage.gap` would have
   paged 288 times a day. The cooldown is therefore durable: each page writes an
   `alert.raised` row, and `audit_log_alerts()` reads them back. No new table — the
   append-only log is already the right place to record what we noticed and when,
   which is also what R-17's incident register needs.

**Shipped.** `audit_log_alerts()` in `supabase-audit-log.sql` (facts only: one
aggregate per candidate group plus its last page); `lib/detect.ts` (rule table —
threshold, cooldown, Annexure I type — and a pure `evaluateAlerts()`);
`lib/detect.test.ts` (22 tests, both sides of every threshold); `app/api/internal/detect`
behind `CRON_SECRET` with a constant-time compare; `auth.signin` capture in `lib/auth.ts`
with a truncated SHA-256 account pseudonym instead of an address (R-06);
`alert.raised` added to the event catalogue; `vercel.json` cron at `*/5 * * * *`.
Full suite 130/130, `tsc --noEmit` clean.

The threshold and cooldown decisions live in TypeScript, not SQL, for one reason: an
alert rule that never fires and one that always fires look identical in production, so
the decision has to sit somewhere a unit test can reach.

**Open (manual).** (a) Re-run `supabase-audit-log.sql`; (b) set `CRON_SECRET` in Vercel;
(c) point `OPS_ALERT_TO` at the R-16 Point of Contact — until then pages fall back to
`console.error` and nobody is woken; (d) **confirm the Vercel plan runs minute-level
crons** — Hobby coerces every expression to once a day, which silently turns a 6-hour
obligation into a ~24-hour one, and is the one deployment step that fails without
producing an error; (e) register an external uptime monitor against the route.

**Acceptance.** A synthetic burst of 10 invalid-signature webhooks produces a page
within 5 minutes, and the page text contains the Annexure I incident type; a second
burst inside the cooldown produces no second page, and exactly one `alert.raised` row
exists per page sent.

*Revised:* the original second limb — "silencing the detector itself pages within one
day" — is **not** satisfiable in-stack and was wrong to state as a code acceptance. A
cron that stops firing cannot detect its own death, and `coverage.gap` catches a dead
*sink*, not a dead *reader*. That limb transfers to open action (e): the external
monitor is the dead-man's switch, and it is the only honest place for it.

---

## R-04 — Hash session tokens, encrypt account secrets
**Priority:** High **Status:** Code complete, one manual action open

**Evidence.** `supabase-auth-schema.sql:51-76`. `session.token text not null unique`
— stored in cleartext. `account` stores `password`, `accessToken`, `refreshToken`,
`idToken` as bare `text`.
**Correction:** RLS **is** enabled on all 7 tables (`:170-176`) and default privileges
are revoked from `anon`/`authenticated` (`:179`). The original finding was wrong.

**Analysis.** With RLS already in place, the remaining exposure is narrow but sharp: a
single read-only disclosure of the `session` table — a leaked `SUPABASE_SERVICE_ROLE_KEY`,
a backup on a laptop, a support export — yields directly replayable bearer tokens for
every signed-in user. No cracking, no privilege escalation, just copy and use. Hashing
the token collapses that from full estate-wide account takeover to a list of expiry
timestamps.

`account.password` is **SPDI** under IT Rules 2011 Rule 3, which places it in the
§43A-deemed-practices regime specifically.

The honest complication: `session.token` is Better Auth's own column and the library
looks sessions up by it. Hashing means either a documented adapter override or
verifying that the deployed Better Auth version already stores a hash. **Verify before
designing** — this is not a three-line change, and an override that diverges from the
library's expectations is a worse outcome than the cleartext column.

**Legal basis.** IT Act §43A + IT Rules 2011 Rule 3 (password = SPDI) and Rule 8;
DPDP §8(5); ISO/IEC 27001 A.8.24.

**Design.** (a) Establish what Better Auth ^1.6.23 actually persists — read the
adapter, do not assume from the DDL. (b) If cleartext, store `sha256(token)` and
compare hashes at lookup, via the documented adapter seam. (c) Encrypt
`account.accessToken`/`refreshToken`/`idToken` with `pgcrypto` or Supabase Vault.
(d) Confirm `account.password` uses Better Auth's scrypt default and that no legacy
plaintext rows exist.

**What the verification found.**

1. **Cleartext, confirmed.** `createSession` writes `token: generateId(32)` and
   `findSession` runs `findOne(session, where token = <presented>)`
   (`better-auth/dist/db/internal-adapter.mjs:182,247`). No option, no plugin and
   no hook hashes it in ^1.6.23.
2. **`databaseHooks` cannot do it.** `createWithHooks` returns the row the hook
   wrote, and `setSessionCookie` builds the cookie from *that* row — so hashing in
   a `session.create.before` hook makes the stored value identical to the presented
   one. It closes the ticket and changes nothing.
3. **The adapter is the only boundary**, and the seam is real: `database` accepts
   an adapter factory, and this is exactly the adapter Better Auth builds from a
   `pg` Pool on its own (`createKyselyAdapter` resolves a Pool to `PostgresDialect`,
   `databaseType: "postgres"`, no transaction override).
4. **The refresh path is the trap.** `setSessionCookie` is fed by `createSession`
   *and* by `updateSession` — the >24h `session.updateAge` refresh. A wrapper that
   only fixed `create` would re-issue the hash as the cookie one day later, for
   everyone, silently.
5. **`account.password` is not the risk the audit assumed.** Password auth is
   disabled here, so the column is unwritten — the fix is to guarantee that rather
   than to protect a hash that does not exist.
6. **The OAuth tokens are stored and never read.** Nothing in `app/`, `lib/` or
   `components/` touches `accessToken`/`refreshToken`/`idToken`; Google is a
   sign-in lane, not an API this app calls for the user. So §6 minimisation
   applies before encryption does: clear them, and encrypt whatever lands next.

**The one design decision that matters.** Hashing is **unconditional** — there is
deliberately no "this value already looks like a hash, pass it through" shortcut,
even though it would have kept `/revoke-other-sessions` working. That shortcut makes
the stored value a working credential again: read the column, send it as a Bearer
token, pass through, match. It would have produced a control that reads as compliant
and defends nothing, which is the outcome this item's own analysis names as worse
than the cleartext column. Without it, every possible mistake — a missed code path, a
future plugin, an upgrade — resolves to `hash(hash) != hash`, i.e. a 401 someone
notices in minutes. **Fails closed by construction, never open.**

The price is one documented divergence: `listSessions(userId)` reads by user id, the
one lookup whose rows cannot be reversed. `/list-sessions` and
`/revoke-other-sessions` are therefore in `disabledPaths` and answer 404 — neither has
a UI here, and a 404 beats an endpoint that returns `{status: true}` having revoked
nothing. `/sign-out`, `/revoke-session` and `/revoke-sessions` are unaffected.

**Shipped.** `lib/sessionTokenHash.ts` — adapter wrapper hashing `session.token` at
the database boundary, restoring the raw on `create` / `findOne` / `update` (the three
that feed `setSessionCookie`), covering `in`-clauses and the transaction-scoped
adapter that sign-up writes through. `lib/sessionTokenHash.test.ts` (12 tests) asserts
against what reached storage, not just return values — including that the stored hash
cannot be replayed, and that the live `auth.$context` adapter is the wrapped one (a
refactor that drops the wrapper has no symptom other than cleartext returning).
`lib/auth.ts`: the wrapped adapter, `account.encryptOAuthTokens`
(AES-256-GCM, library-native, reads legacy cleartext through unchanged), and the two
disabled paths. `supabase-session-hardening.sql`: hashes existing tokens in place so
no user is signed out, clears the unused OAuth tokens, adds a
`check ("password" is null)` constraint, and revokes `session`/`account`/`verification`
from `service_role` — the leaked-service-key vector this finding opens with, closed
directly rather than only mitigated. Full suite 142/142, `tsc --noEmit` clean.

`@better-auth/kysely-adapter` and `kysely` moved from transitive to declared
dependencies, pinned to better-auth's version; `package.json` carries the reason and
the lockstep requirement.

**Open (manual).** Deploy, **then** run `supabase-session-hardening.sql` — in that
order. Section 1 rewrites live tokens into the form the deployed code looks up; run it
first and every signed-in user is logged out until the deploy lands. Both orders fail
closed, so this is an availability choice, not a security one.

**Acceptance.** `select "token" from "session" limit 1` returns 64 hex characters that
cannot be replayed as a bearer credential (presenting one gets hashed again).
`select "accessToken" from "account" limit 1` returns null, then `$ba$`-prefixed
ciphertext after the next Google sign-in. `select has_table_privilege('service_role',
'session', 'select')` returns false. Existing auth tests still pass (142/142).

---

## R-05 — NTP sync to NIC/NPL
**Priority:** Medium **Status:** Done **Detail:** `compliance/log-retention.md` §11

**Evidence.** No time-source configuration in either repo. Vercel and Supabase are
managed platforms with no clock control.

**Analysis (revised — the original framing was too pessimistic).** The draft called
Direction 1 "partly impossible to satisfy on serverless". Reading the directive
closely, it is not: it carries a second limb written for exactly this case.

> …**or with NTP servers traceable to these NTP servers**… Entities having ICT
> infrastructure **spanning multiple geographies may use accurate and standard time
> source other than NPL and NIC**, however it is to be ensured that their time source
> shall not deviate from NPL and NIC.

The Edge runtime executes near the caller while the database is pinned to
`ap-south-1`, so this estate spans multiple geographies by construction and limb 2
governs. NPL India and NIC realise UTC; AWS Time Sync realises the same UTC from
GPS-disciplined atomic clocks. Deviation is sub-millisecond. **This is compliance on
the directive's own terms, not an exception being claimed** — which is a materially
stronger position to file from than "managed platform, out of our control".

Two findings from actually tracing the timestamps rather than asserting them:

1. **There is only one clock of record, and it is not the application's.**
   `auditLog."at"` is `timestamptz default now()` and `audit_log_write()` takes no
   `at` parameter, so a Vercel instance *cannot* stamp a security event even by
   mistake. Same for `creditLedger."createdAt"` and the UTC daily-credit boundary,
   which `supabase-edge-rpc.sql` computes as `(now() at time zone 'utc')::date` rather
   than in Node. Ordering inside the 180-day window — the thing a 6-hour filing turns
   on — therefore depends on one monotonic source, not on N regions agreeing.
2. **There is no self-managed compute at all.** No VM, container, log shipper or
   scheduler that we operate. There is nothing to point at `samay1.nplindia.org`, so
   the deliverable is genuinely a register plus a standing rule — and the rule is
   what stops that from silently ceasing to be true.

**Correction to R-06 / R-07.** Both record "neither repo has any `.github/workflows`".
**Wrong** — `.github/workflows/release-windows.yml` exists at the monorepo root (the
signed Windows release build). Those items are therefore cheaper than scoped: the
security workflow is a second file in an existing directory, not new CI. Corrected in
place below.

**The one thing worth fixing in code.** R-03's detector compared `alertedAt`
(Postgres) against `Date.now()` (Vercel) to decide a cooldown — a cross-clock
comparison this estate did not previously have, introduced two items ago.
`audit_log_alerts()` now returns `alertedMinutesAgo`, subtracted in Postgres against
the same `now()` that wrote the row, so `lib/detect.ts` reads no clock at all. The
skew was immaterial in practice (managed NTP on both ends versus 15-to-1440-minute
cooldowns); it was removed because the fix is smaller than the code it replaced —
`evaluateAlerts()` lost a parameter and `Date.parse` — and because a register that
says *one clock* is worth more than one that documents a dependency.

Code signing deserves its own line: `sign-windows.ps1:51` passes
`/tr http://timestamp.acs.microsoft.com`, so the authoritative time on every released
binary comes from an RFC 3161 timestamp authority, not from the build runner. The
runner's clock cannot affect a shipped artifact.

**Legal basis.** CERT-In Direction 1.

**Done.** `compliance/log-retention.md` §11: the two-limb reading, the clock-of-record
finding, a register of all six time-bearing components, a table of every surviving
cross-clock comparison with its behaviour under skew, and the standing rule that any
new component writing retained logs syncs to NIC/NPL *before* it ships and is added to
the register in the same change. `audit_log_alerts()` and `lib/detect.ts` changed as
above; suite 142/142, `tsc --noEmit` clean.

**Residual, accepted and recorded (§11.3).** Three comparisons still span clocks and
all three are correct as they stand: the Dodo webhook replay bound (±5 min, fails
closed), the `billingEventAt` last-write-wins watermark (event time beats delivery
order even with a skewed sender), and `apiUsage."windowStart"` (Vercel-derived key,
self-consistent, not evidence).

**Acceptance.** Met: §11.2 names each component, its operator, its time source and
whether it produces retained evidence; §11.1 states the managed-platform dependency
and the reasoning that makes it defensible.

---

## R-06 — Strip PII from application logs
**Priority:** High *(raised from Medium)* **Status:** Done

**Evidence.** *(line numbers as found; `lib/auth.ts` had since shifted by R-03's
`auth.signin` capture — the four sites are unchanged)*
- `lib/auth.ts:307` — `console.log('[auth][dev] OTP for ${email} (${type}): ${otp}')`
- `lib/auth.ts:326` — same, in the delivery-failure fallback
- `lib/auth.ts:323` — `console.error('[auth] OTP delivery to ${email} failed', error)`
- `app/api/contact/route.ts:112` — logs name, email and full message body

**Analysis.** Raised because `lib/auth.ts` is materially worse than the contact-route
line the item was opened for: **a logged OTP is a live authentication credential**.
Anyone with log access — Vercel project members, a support export, a future log drain —
can sign in as that user without touching their mailbox. That is not a privacy
finding, it is an authentication bypass that happens to be spelled `console.log`.

The `[dev]` guard is not a control. It reflects whether `RESEND_API_KEY` is set, not
whether the environment is production, so a production deploy that loses its Resend key
starts printing OTPs to a production log while continuing to look healthy.

Root cause: the desktop repo has `src/services/safeLog.ts` with token and API-key
redaction, and the website has no equivalent — so the website grew ad-hoc logging with
no shared boundary to enforce. Fixing the four call sites without fixing that leaves
the next one to be written the same way.

**Legal basis.** DPDP §8(5); IT Act §43A; IT Rules 2011 Rule 3 (a password-equivalent
credential).

**Design.** Port the `safeLog` concept to the website as a shared boundary, then route
the four sites through it. Never print an OTP: log a request id and the *outcome*. For
local development, keep the OTP visible **only** behind an explicit
`NODE_ENV !== 'production'` check — the correct signal — rather than the absence of a
key. Add the CI grep gate as a second file alongside the existing
`.github/workflows/release-windows.yml` at the monorepo root, shared with R-07.
*Corrected under R-05: the original note that neither repo has any
`.github/workflows` was wrong.*

**Four corrections made while building this.**

1. **The contact route was already correct; the item's evidence overstated it.**
   `route.ts:108-110` returns 503 in production *before* the logging branch, so that
   line is dev-only by construction — the same guard `lib/auth.ts` was missing. The
   whole live risk sat in the auth lane. The line keeps its interpolation and takes an
   explicit marker (below) rather than a change it did not need.
2. **The guard existed and was applied to one of two branches.** `isDev` was computed
   at `auth.ts:303`, one line above the leak, and used at `:324` for the second dev
   fallback — but the `!resend` branch at `:305` was ungated. So this was not an
   oversight about whether production matters; it was a correct control applied to the
   wrong half of a two-branch function, which is the version that survives review.
3. **The address also leaked to the client, not only to the log** — a finding the item
   did not open with. The failure path threw
   `Could not send the sign-in code: ${error.message}`, and Resend's message quotes the
   request it refused ("You can only send testing emails to your own address
   (x@y.com)"). Better Auth renders a thrown message back to the caller, and the OTP
   endpoint is **unauthenticated** — so an attacker could learn a configured address by
   provoking a delivery failure. The thrown message is now fixed text; the provider's
   is logged through `safeError` only.
4. **Silent success was the second half of the same bug.** With no transport in
   production the old code `return`ed, so Better Auth answered `{success: true}`: the
   user waited for mail that was never sent while the code sat in the log where it
   *was* readable. It now throws — the user sees a failure and retries, which is both
   the honest outcome and the one that produces a support ticket instead of a silent
   credential in a log. Mirrors what `app/api/contact/route.ts` already did.

**Two decisions worth recording.**

*The redactor cannot catch the OTP, and pretending otherwise would be the failure
mode this plan keeps naming.* Six digits are indistinguishable from a token count, an
HTTP status or a credit balance, so a regex broad enough to catch a code would eat
`usage: prompt=812` and every status line. The code is kept out of production logs
**structurally**, at the call site; `lib/safeLog.ts` is the second line of defence and
its own test asserts that it leaves `483920` alone, so nobody later mistakes it for
the first.

*What justifies a module rather than four careful edits is the error object.* The
format strings were auditable by hand; the arguments are not. A `pg` error's `detail`
quotes the row it failed on — `Key (email)=(a@b.com) already exists` — and reaches the
log through `console.error(msg, e)` at `auth.ts`'s entitlement lookup, where the row is
by definition the user's. `safeError` flattens `Error` to `name: message`, so those
properties never reach a sink at all. That is the class of leak no call-site review
finds, and the reason the boundary earns ~40 lines.

**The acceptance test as originally written was unusable, and is replaced.**
`rg "console\.(log|error|warn).*(email|otp|message|prompt|token)"` matches
`[ai/generate] usage: prompt=${…}` (token counts, SPEC §10-compliant) and every
`${e.message}` in the tree — a gate that flags correct code is a gate someone deletes.
The shipped gate matches the *shape* of a leak instead of the vocabulary: a bare
interpolated identifier (`${email}`) or an interpolated property (`${user.email}`),
with `message`/`prompt` bare-only so `${e.message}` and `${usage.promptTokenCount}`
stay legal. A deliberate dev-only line carries `// log-hygiene: <reason>` **on the same
line** — one reviewed, greppable exception rather than a silenced rule.

**Shipped.** `lib/safeLog.ts` — the desktop's secret patterns (Bearer, `sk-`, `AIza`,
`AQ.`, key/token assignments) plus an address pattern the desktop does not need, and
`safeError`, which flattens `Error` and stringifies everything else before it can reach
a sink. `lib/auth.ts`: `sendVerificationOTP` extracted to an exported `deliverOtp` —
exported only because the plugin option is closed over inside `betterAuth()` and this
regression has no symptom other than the log line — now guarded on `NODE_ENV`, failing
closed with no transport, logging `accountSubject()`'s pseudonym (the helper R-03
already added) instead of the address, and never interpolating the provider's message
into what it throws; the entitlement-lookup `console.error` routed through `safeError`.
`app/api/contact/route.ts`: `safeError` on the delivery failure, marker on the dev
line. `lib/safeLog.test.ts` (6) and `lib/auth.test.ts` (4) assert on captured console
output, not return values. `.github/workflows/security.yml` — the gate plus those two
suites, on PR, push to main and weekly; R-07 adds `npm audit` / `cargo audit` as
further jobs in this file. Full suite 153/153, `tsc --noEmit` clean.

Two sites were checked and deliberately left alone: `lib/auditLog.ts:156` already omits
`detail` from its console fallback with the reasoning written down, and `lib/alert.ts`
carries an explicit no-addresses contract that its callers (R-03's detector) honour by
passing pseudonyms.

**Acceptance.** Met. The gate reports clean over `Insert-Go Website/app` and `lib`, and
fails on a reintroduction — verified by removing a marker, which surfaced both dev
lines. `lib/auth.test.ts` asserts that a failed OTP delivery in production logs neither
the address nor the code, that no transport in production throws rather than returning
success, and that local sign-in without a Resend key still prints the code.

---

## R-07 — Vulnerability-management cadence
**Priority:** Medium **Status:** Code complete, one manual action open
**Detail:** `compliance/vulnerability-exceptions.md`

**Evidence.** No dependency scanning in CI. *R-06 has since created
`.github/workflows/security.yml` (log-hygiene gate); this item adds `npm audit` and
`cargo audit` as further jobs in that file, not a new workflow.* *Corrected under R-05:
the original "no `.github/workflows` in either repo" was wrong —
`.github/workflows/release-windows.yml` exists at the monorepo root (signed Windows
release build), so this is one more file in an existing directory, not new CI.*
`SECURITY.md:19-33` documents dependency floors maintained by hand. Known transitive
`cargo audit` failures (quick-xml RUSTSEC-2026-0194/0195 via `tauri-utils`→`plist`)
are carried informally.

Scanned at close: **npm** 4 High — `fast-uri` (fixed), `postcss` ×4 GHSAs, `sharp`,
and a derived `next` entry; **cargo** 3 vulnerabilities — quick-xml ×2, rkyv — plus
18 unmaintained/unsound warnings. The quick-xml pair was the only one the item
anticipated.

**Analysis.** The floors in `SECURITY.md` are good work with no mechanism keeping them
true — the next `npm install` can regress a floor silently, and the file will still
claim it holds. Manual discipline that produced a correct result once is not a control.

The `cargo audit` exception matters more than it looks. An *undocumented* suppression
reads at audit as negligence; a documented one with a named reason, an owner and a
review date reads as risk management. Same technical state, opposite finding.

**Legal basis.** IT Act §43A / IT Rules 2011 Rule 8; ISO/IEC 27001 A.8.8.

**Design.** One `.github/workflows/security.yml` doing `npm audit` (both packages) and
`cargo audit`, weekly plus on every PR, blocking on High/Critical. Record the quick-xml
chain in `compliance/vulnerability-exceptions.md` with reason, owner and review date —
never as a silent ignore flag. Fold in R-06's grep gate rather than adding a second
workflow.

**The blocker the design did not anticipate: there is nothing pinned to measure.**
The root `package-lock.json` is **untracked**, while
`Insert-Go Website/package-lock.json` and `Insert-Go Windows/package-lock.json` are
still in git and describe pre-monorepo resolutions nothing installs from. A
dependency gate over an unpinned tree scores whatever the resolver picked that
minute, so "this PR introduces no High-severity advisory" would be unfalsifiable —
and `npm ci` in the existing `release-windows.yml` resolves from that same missing
file, so the signed-release build cannot currently install either. The workflow
therefore **fails loudly on a missing lockfile** rather than auditing a fresh
resolve, which would have been the compliant-looking version of no control at all.
Committing it is the one open action.

**Five findings from running the scanners rather than describing them.**

1. **The obvious fix was measurably worse than the advisory.** `postcss ≤8.5.22`
   (four GHSAs) is pinned *exactly* at `8.4.31` by `next`, and npm's only offered
   remediation is `next@16` — a major upgrade of a live site. A root
   `overrides: { postcss }` is silently ignored by npm 11.6 against an exact
   transitive pin (the lockfile never gained an `overrides` key) and then made
   `npm audit fix` fail `ERESOLVE`; forcing the tree with `npm update postcss`
   hoisted a clean 8.5.26 for Tailwind — kept — but made `next` materialise its own
   nested `8.4.31` regardless *and* pulled in a `sharp` copy carrying four libvips
   CVEs. **Net effect of the fix attempt: more High advisories than it removed.**
   Recorded in the register (§1) so the next person does not rediscover it.
2. **`npm audit fix` is all-or-nothing, so it is not a cadence.** One
   major-only advisory in the tree makes it abort with `ERESOLVE` and fix
   *nothing* — including `fast-uri`, which was a one-version bump. The working
   move is a targeted `npm update <pkg>`; `fast-uri` 3.1.4 → 3.1.5 cleared
   GHSA-7p8r-x3mc-p8w7 that way, and the estate went from four Highs to three.
3. **Reachability is established with the tool, not asserted.** `cargo tree -i
   tauri-utils -e normal` shows quick-xml's *only* path terminating in
   `tauri-macros` — a **proc-macro** — so it is compile-time host code that never
   links into the shipped Windows binary. `cargo tree -i rkyv -e all --target all`
   prints *nothing at all*: the crate is in `Cargo.lock` only because
   `rust_decimal` (via `byte-unit` → `tauri-plugin-log`) declares it as an optional
   dependency whose feature is off, so RUSTSEC-2026-0235 is a lockfile artifact,
   not a dependency. Neither conclusion is available from reading the advisory.
4. **Dev dependencies stay in scope.** The gate deliberately does not pass
   `--omit=dev`: this estate's one confirmed compromise (R-01) came through a
   *dev-only* Vite CVE that could read `.env`, so a production-only gate would have
   missed the very incident that opened this plan. `fast-uri` reaches the tree
   through `@remotion/cli` → webpack → ajv — dev-only, and fixed rather than
   excepted for exactly that reason.
5. **Warnings are not vulnerabilities, and conflating them kills the job.**
   `cargo audit` reports 18 `unmaintained`/`unsound` warnings — Linux-only GTK3
   bindings pulled transitively by Tauri 2, with no maintained replacement. No
   `--deny warnings`: a gate that fails on something nobody can fix is a gate
   people learn to skip, which costs more than the warnings do.

**The design decision that makes the register load-bearing.** Neither scanner
holds its own ignore list. `cargo audit`'s `--ignore` flags are *generated from*
`compliance/vulnerability-exceptions.md`, and the npm gate judges
`npm audit --json` against the same table — so deleting a row re-arms the
advisory, and there is no second place a suppression can hide. The same parser
fails the build when a row passes its review date, because a review date that
nothing enforces is a comment. This is the difference the item's own analysis
names: identical technical state, opposite finding at audit.

**Shipped.** `compliance/vulnerability-exceptions.md` — eight rows (four postcss
GHSAs, sharp, two quick-xml RUSTSECs, rkyv), each with its dependency chain, the
reachability argument, **what voids the exception**, the upgrade path, an owner and
a 2026-11-06 review date; plus the warnings-are-not-exceptions rationale and a
procedure for adding a row that requires trying the fix first.
`scripts/audit-gate.mjs` — one parser, three modes (`npm`, `cargo-ignores`,
`expiry`), runnable locally exactly as CI runs it. `.github/workflows/security.yml`
— three new jobs (`npm-audit` with the lockfile precondition, `cargo-audit` via
`taiki-e/install-action`, `exception-review` on its own so a lapsed date is
reported as itself) alongside R-06's log-hygiene job, on PR, push to main and
weekly. `SECURITY.md`'s dependency-floor section now states that the floors are
enforced rather than remembered, with the local commands. `fast-uri` bumped in the
lockfile. Website suite 153/153 and `next build` green after the dependency
changes.

**Open (manual).** Commit the root `package-lock.json` and delete the two stale
per-workspace lockfiles in the same change. Until then `npm-audit` fails by design
and `release-windows.yml`'s `npm ci` cannot run.

*Staleness confirmed 2026-08-08:* the root lockfile carries both workspace entries;
`Insert-Go Website/package-lock.json` (`name: insertgo-ai-website`) and
`Insert-Go Windows/package-lock.json` (`name: insertgo`) are standalone pre-monorepo
resolutions that nothing installs from. The exact change:

```sh
git rm --cached "Insert-Go Website/package-lock.json" "Insert-Go Windows/package-lock.json"
rm "Insert-Go Website/package-lock.json" "Insert-Go Windows/package-lock.json"
git add package-lock.json
```

**Acceptance.** Met, and both failure modes were exercised rather than assumed:
a synthetic critical advisory with no row in the register fails the npm gate
(exit 1, naming the id); a row back-dated to 2020-01-01 fails
`exception-review` (exit 1, naming the row); with the register as shipped,
`npm audit --json | node scripts/audit-gate.mjs npm` and
`cargo audit $(node scripts/audit-gate.mjs cargo-ignores)` both exit 0.

---

## R-08 — ISMS document set
**Priority:** Low **Status:** Pending **Depends on:** R-21, R-22

**Analysis.** IT Rules 2011 Rule 8 *deems* compliance with IS/ISO/IEC 27001 to be
"reasonable security practices". That deeming provision is the practical value here:
under §43A the question after an incident is whether reasonable practices were
documented and followed, and a coherent ISMS answers it with one evidence set instead
of an argument. Certification is optional; documentation is not.

Low priority because it is a *packaging* task — the substance (logging policy, secret
rotation, retention, incident response) is being produced by R-01/R-02/R-12/R-17
anyway. Doing it first would produce policy with nothing behind it.

**Design.** Assemble from what already exists — scope, risk register, Statement of
Applicability, access-control, cryptography and incident policies — promoting
`SECURITY.md` and the `compliance/` documents rather than duplicating them. Duplicated
policy drifts, and drifted policy is worse than none because it documents a control
you no longer operate.

**Shipped.** `compliance/isms-index.md` — scope, a 21-control Statement of Applicability
each pointing at a real file, a risk register of pointers rather than copies, and the
document set. **It contains no policy text**, by design: the substance already exists in
the seven companion documents, and a second copy drifts. This audit found three
documents describing controls that did not exist (`ap-south-1`, the orphaned desktop
consent module, the BYOK sections) — duplicating policy here would be a fourth.

**Six of the 21 controls are marked ⚠️, every one traceable to an open manual action
rather than to missing code** (R-16 ×2, R-18, R-19 ×2, R-03's `OPS_ALERT_TO`). A table of
green ticks would have been easy to write and worth less: the value of an SoA at audit is
that its gaps are the real ones.

**Open.** The two inputs it indexes are themselves incomplete: R-22 is unsigned and R-18's
contracts are unexecuted. Both are named in §3 rather than glossed.

**Acceptance.** Met — no row in §3's SoA has an empty or aspirational artifact column.

---

# Consent and privacy

## R-09 — Consent artifact
**Priority:** High **Status:** Pending

**Evidence.** No consent table anywhere in `supabase-auth-schema.sql`. Signup runs
through Better Auth (email OTP, Google, SSO) with no consent capture. Nothing records
what a user was shown or agreed to.

**Analysis.** §6 places the burden of proving valid consent on the Data Fiduciary. A
boolean on `user` cannot discharge it: it says a checkbox was ticked, not *which
notice* was displayed, *when*, *for what purposes*, or *in what language*. When the
notice text changes — and it will, at R-13 — every prior consent becomes
unverifiable unless the version was recorded at the time.

So the artifact must be **immutable and versioned**: one row per (user, purpose,
notice version), never updated. A withdrawal is a new row, not an edit — otherwise the
act of withdrawing destroys the evidence that consent was ever validly obtained.

Second failure mode, common and expensive: bundling. §6(1) requires consent that is
*specific* and *unconditional*. A single "I agree to the Terms and Privacy Policy"
checkbox is neither, because it makes optional purposes (analytics, marketing) a
precondition of service. ToS acceptance and DPDP consent must be separate controls.

**Legal basis.** DPDP §5 (itemised notice, plain language); §6(1) (free, specific,
informed, unconditional, unambiguous, by clear affirmative action).

**Design.** `consent_record` as specified — `userId` with **no** cascade (same
reasoning as R-02: consent history is evidence and must outlive an erasure).
Purposes: `account` (service delivery, may be a precondition), `billing`,
`ai_processing` (text sent to third-party model providers), `analytics` *(optional)*,
`marketing` *(optional)*. Checkboxes unticked by default — a pre-ticked box is not a
clear affirmative action. Each grant records notice version, language, method, IP,
user-agent, timestamp.

**Steps.** Table + `security definer` write RPC (reuse the R-02 pattern) → signup UI →
emit `consent.grant` to `auditLog` (event already in the catalogue) → backfill decision
for existing users: they must be re-consented at next sign-in, not assumed.

**What the build found.**

1. **Consent was not absent — it was orphaned.** `Insert-Go Windows/src/legal/index.ts`
   ships `LEGAL_VERSION`, `needsConsent()`, `CONSENT_LABEL` and ~600 lines of Terms and
   Privacy text, with a header stating "consent is a launch blocker". **Nothing imports
   that module.** `acceptedTermsVersion` is always null, and `types/index.ts:187` says so
   outright: "no in-app screen collects it since setup was removed". A module documented
   as a launch blocker that collects nothing is worse than no module: it is the reason
   everyone believed consent existed.
2. **Its design confirmed the failure mode this item predicted.** `CONSENT_LABEL` is a
   single "I accept the Terms & Conditions and Privacy Policy v1.2.0" — one checkbox
   bundling everything, which §6(1) invalidates for being neither specific nor
   unconditional. So the orphaning removed a control that would not have been sufficient
   anyway.
3. **The gate belongs after authentication, not inside signup.** Three sign-in lanes
   (OTP, Google, SSO) would have meant three places to get §6(1) right and three places
   to drift. One post-auth gate covers all three — and makes the backfill free: an
   existing user with no record is indistinguishable from a new one, so "re-consent
   existing users at next sign-in" needs no migration, and a `NOTICE_VERSION` bump
   re-prompts everyone through the same path.

**Shipped.** `supabase-consent-dsr.sql` §1 — `consentRecord`, append-only by trigger for
every role including the owner, **no FK on `userId`** (consent history is evidence and
must outlive an erasure), bounded purpose and method vocabularies. `lib/consent.ts` — the
purpose catalogue as the single source of truth: the gate renders it, `/account/privacy`
renders it, the §5 notice table renders it, and the SQL CHECK mirrors it, because two
hand-kept lists drift invisibly and a purpose in the notice with no checkbox is consent
nobody gave. `app/consent/` — gate page, client form with **nothing pre-ticked**,
required and optional visually separated, server action that writes every purpose
including declined ones (`granted: false`), because "asked and declined" and "never
asked" are different facts and only the first is evidence the choice was offered.
`lib/consent.test.ts` (12 tests) asserts the §6 properties, not the data shape — that the
catalogue matches the SQL vocabulary, that analytics/marketing stay optional, that a
version bump re-gates, and that optional purposes never gate.

**Open (manual).** Run `supabase-consent-dsr.sql` in Supabase. Until then the gate throws
and `/account` degrades to no gate (deliberately fail-open — a consent-store outage must
not lock people out of their own account page; it is not a security boundary).

**Acceptance.** Met in code: a new signup produces one row per purpose with a resolvable
notice version (`NOTICE_VERSION`, imported by `/privacy` so it cannot name text that no
longer renders); declining `analytics` still completes signup (the submit button gates on
required purposes only); no row is ever `UPDATE`d (the trigger raises unconditionally).
Pending the migration for the live limb.

---

## R-10 — Consent withdrawal path
**Priority:** High **Status:** Pending **Depends on:** R-09

**Evidence.** `app/account/page.tsx` is read-only: name, email, plan, daily credits,
add-on credits, purchase list, and `SignOutButton`. No privacy controls exist.

**Analysis.** §6(4)–(6) requires withdrawal to be *as easy as* giving consent — a
symmetry requirement, not a general "make it available" one. The compliance test is
mechanical: count the clicks to opt in, count the clicks to opt out. If opting in was
one checkbox at signup and opting out is an email to support, that fails regardless of
how quickly support answers.

Practical trap: making withdrawal available only by deleting the account. That
conditions withdrawal of an *optional* purpose on losing the service, which
re-imposes exactly the conditionality §6(1) forbids. Optional purposes must be
independently revocable while the account continues.

**Legal basis.** DPDP §6(4)–(6); §8(7) (erasure on withdrawal).

**Design.** `/account/privacy` with one toggle per purpose from R-09, same click cost
as the opt-in, no confirmation interstitial, no "are you sure you'll lose…" friction —
that friction is precisely the asymmetry the section prohibits. State consequences
factually. Withdrawal writes a new `consent_record` row, emits `consent.withdraw`, and
enqueues the §8(7) erasure job through R-12's classifier.

**Shipped.** `app/account/privacy/` — one toggle per purpose, each a single-submit form.
No confirmation interstitial, no "are you sure you'll lose…" copy, no retention offer:
that friction *is* the asymmetry §6(4) prohibits, and adding it would fail the item while
looking like care. Withdrawal writes a new `consentRecord` row via the same
`recordConsent()` the gate uses — there is deliberately no separate `withdraw()`, because
two entry points is how one of them eventually does an `UPDATE` and destroys the proof
consent was validly obtained. Emits `consent.withdraw` to `auditLog`. A link from
`/account`, because "as easy as" is measured from where the user actually is, not from a
policy page.

Withdrawing a **required** purpose is refused with an explanation and a pointer to
account deletion, rather than silently ignored — those are genuine preconditions, and the
honest exit is on the same page.

**Note on the desktop copy — fixed 2026-08-08.** Both copies told users they "may
withdraw the consent you gave by writing to" the grievance mailbox: the exact §6(4)
asymmetry this item exists to remove — one checkbox in, an email out. Corrected in
version 1.3.0 alongside R-15 (they are the same two files): the IT Rules paragraph now
names `insertgo.ai/account/privacy` as the primary route, "one click, no email", with the
Grievance Officer kept as the alternative rather than the only door.

**Open (manual).** Run `supabase-consent-dsr.sql`.

**Acceptance.** Met. Clicks-to-grant = 1 (one checkbox at the gate); clicks-to-withdraw =
1 (one button on `/account/privacy`). Revoking `analytics` or `marketing` leaves the
account fully functional — neither is read by any code path. Withdrawal is a new row
within the same request.

---

## R-11 — Data-principal rights + 90-day SLA
**Priority:** High **Status:** Pending **Depends on:** R-12

**Evidence.** No rights endpoints exist. `app/privacy/page.tsx:271-301` *describes*
rights and names a Grievance Officer, but there is no queue, no clock, no owner and no
mechanism behind the description.

**Analysis.** The gap between a published right and an operable one is where this
fails. Today a single access or erasure request has nobody assigned, no due date, and —
critically — **no safe way to execute**, because erasure would cascade through
`creditLedger` (see R-12). The published description therefore creates an obligation
the system cannot currently meet, which is worse than saying nothing.

Two design points that are easy to get wrong:

*Identity verification.* Acting on an unverified erasure request is itself a personal
data breach — an impostor who can delete another person's account has caused exactly
the harm the right exists to prevent. Verification must precede execution, and must be
recorded.

*The clock.* A 90-day SLA managed by hand becomes a 91-day SLA. `dueAt` must be a
stored generated column, not a convention, and the escalation must fire well before
the deadline — day 75, not day 89, because a request that needs legal input needs it
with time left.

**Legal basis.** DPDP §11 (access), §12 (correction, completion, updating, erasure),
§13 (grievance redressal), §14 (nomination); DPDP Rules 90-day response SLA.

**Design.** `dsr_request` as specified, `dueAt` generated as `createdAt + 90 days`,
partial index on open requests by due date. `/account/privacy` exposes: download my
data (JSON export of `user`, `apiUsage`, `creditLedger`, plus processing summary and
subprocessor list), correct my details, delete my account, raise a grievance,
nominate. Auto-acknowledge ≤24h; internal target 30 days; alarm at day 75. Every
transition emits `dsr.request` / `dsr.fulfilled` to `auditLog`.

**The specified `dueAt` is not implementable, and the reason is worth keeping.** A stored
generated column requires an **IMMUTABLE** expression, and `timestamptz + interval` is
**STABLE** — verified against the live database rather than assumed
(`select provolatile from pg_proc where proname='timestamptz_pl_interval'` returns `s`).
Postgres rejects the DDL outright. The property this item actually wanted is "the
database sets the clock, not a developer remembering to", and `default (now() + interval
'90 days')` plus `check ("dueAt" = "createdAt" + interval '90 days')` delivers exactly
that: the default supplies it, the CHECK makes any other value impossible, and
`dsr_create()` is the only writer since table DML is revoked from every role.

**Shipped.** `supabase-consent-dsr.sql` §2/§5 — `dsrRequest` (no FK, same evidence
reasoning as `consentRecord`), `dsr_create()` with an explicit `p_verified`, `dsr_fulfil()`,
and `dsr_ageing()` reporting escalation at **day 75, not day 89** — a request that turns
out to need legal input needs it with time left. Partial index on open requests by due
date, which is the exact shape the monthly ageing report reads. `lib/dsr.ts`.
`app/api/account/export/route.ts` — the §11 export, which answers all three limbs (the
data, a processing summary, and the recipient list) rather than dumping rows, and
**excludes `session.token` and the OAuth tokens**: they are credentials, and a
"download my data" file containing them turns a right into an exfiltration primitive the
moment it reaches a mailbox. `/account/privacy` raises correction, grievance and
nomination requests. Every transition emits `dsr.request` / `dsr.fulfilled`.

**Identity verification is recorded, not assumed.** A request raised from a live web
session is verified by definition — holding the session is control of the account — so the
caller passes `verified: true` and says so in the note. A request arriving by email to the
Grievance Officer is not, and stays unverified until a human establishes who sent it.
`erase_user()` **refuses** against an unverified erasure row, which is the difference
between a right being exercised and an account being taken over.

**Open (manual).** Run `supabase-consent-dsr.sql`; route `grievance@insertgo.ai` into the
`dsrRequest` queue rather than an inbox (R-20).

**Acceptance.** Met in code. `dueAt` is exactly 90 days out and the CHECK makes any other
value impossible. `erase_user()` raises unless the named DSR is an erasure request for
that user with `verifiedAt` set. `dsr_ageing()` flags anything past day 75.

---

## R-12 — Two-class retention, anonymise-in-place erasure
**Priority:** High **Status:** Pending **Depends on:** R-09, R-10

**Evidence.** Every table references `"user"("id") on delete cascade` —
`session:59`, `account:65`, `ssoProvider:93`, `apiUsage:111`, `creditLedger:131`.

**Analysis.** This is the single most dangerous item in the plan, because the naive
implementation looks correct and passes its own test. `DELETE FROM "user" WHERE id = ?`
satisfies an erasure request, returns success, and silently destroys the
`creditLedger` rows that are **books of account** — records retained under the
Companies Act, GST and income-tax rules. One compliance obligation executed correctly
destroys another. The cascade makes it a single statement, so nothing warns you.

The resolution is that §8(7) erasure and §17(1) statutory retention are not in
conflict once the data is classified — they simply apply to different rows:

- **Class A — consent basis, purge on erasure.** `session`, `verification`,
  `apiUsage`, `account`, and the identity columns of `user`.
- **Class B — statutory hold, retain.** `creditLedger` and the corresponding Dodo
  invoice records; plus `auditLog` (CERT-In Direction 4) and `consent_record` (the
  evidence that consent was validly obtained).

Hence: **never delete the `user` row.** Anonymise in place — `name='[erased]'`,
`email='erased+<uuid>@invalid'`, `image=null`, set `erasedAt` — so the foreign key
survives, Class B rows stay intact and auditable, and the ledger retains only a
pseudonymous `userId`.

The second-order requirement is that this must be *stated in advance*. A subject told
"we erase everything" and then given a retained ledger has been misled; a subject whose
notice itemises the statutory-retention class has been informed. That is R-13's job,
and it is why R-13 cannot be written before this classification exists.

**Legal basis.** DPDP §8(7); §17(1) (legal-obligation retention); Companies Act §128;
GST §36; income-tax record rules.

**Design.** A single `erase_user()` `security definer` function holding the whole
classification — one place where the A/B boundary lives, so a future table added
without classification fails loudly rather than being silently purged or silently kept.
Emit `account.erasure` to `auditLog`.

**Shipped.** `supabase-consent-dsr.sql` §6 — `erase_user()`, one `security definer`
function holding the entire A/B classification so the boundary lives in exactly one
place. Anonymises `user` in place (`name='[erased]'`,
`email='erased+<id>@invalid'` — RFC 2606 reserved, so it can never route —
`emailVerified=false`, `image=null`, `erasedAt=now()`), purges Class A, and **returns the
Class B counts it did not touch** so a caller or a test can assert they did not move.
`lib/dsr.ts` `eraseUser()`; `/account/privacy` wires it behind type-to-confirm; emits
`account.erasure` with the retained counts in `detail` — after an erasure the audit log is
the only place left that can show statutory retention was applied deliberately rather
than by omission.

**One thing the classification in the item body missed.** `verification` is keyed by
**`identifier`** (the email address), not by `userId` — it holds OTP hashes and desktop
PKCE authorization codes. A `userId`-only sweep, which is what every other table takes,
would leave live sign-in material behind for an address that no longer has an account.
That is the one leftover that could re-authenticate, so `erase_user()` reads the email
before anonymising and deletes by identifier.

**Why the confirmation step here is not a §6(4) violation.** Every consent toggle on the
same page is deliberately friction-free. Erasure takes a type-to-confirm because the
symmetry rule governs *withdrawing consent*, not *destroying an account*: this is
irreversible, and the friction protects the subject rather than deterring them.

**Open (manual).** Run `supabase-consent-dsr.sql`, then execute the acceptance below
against a seeded test account — the counts are the assertion, and they can only be
observed against a real database.

**Acceptance.** Encoded in the function's return signature rather than left to a test to
remember: `erase_user()` returns `ledgerRetained`, `auditRetained` and `consentRetained`
alongside the Class A delete counts, so "the ledger was untouched" is the value the call
hands back rather than something a caller must separately go and check. Pending execution
against a seeded account.

---

## R-13 — Itemise and version the §5 notice
**Priority:** Medium *(lowered from High)* **Status:** Pending **Depends on:** R-09, R-12

**Evidence.** `app/privacy/page.tsx` is 412 lines and substantive: named processors,
Dodo as merchant of record, BYOK direct-egress disclosure, the on-device boundary, a
"what we do not do" section, DPDP nomination right, IT Rules 2011 Rule 4 acknowledgement,
Grievance Officer at `grievance@insertgo.ai` (`:29-31`), 18+ statement, automated-decisions
section.

**Analysis.** Lowered because the initial finding — "not itemised, English-only,
prose" — was substantially wrong. This notice is better than most Indian SaaS notices
and already discloses the hard things (BYOK egress, MoR payment flow) that vendors
usually bury.

Three genuine gaps remain:

1. **Itemisation.** §5 wants the notice to enable a *specific* consent per purpose.
   Prose paragraphs that describe processing well still do not map data item → purpose
   → retention → recipient and country in a form a user can consent to selectively.
   This becomes load-bearing the moment R-09 ships per-purpose checkboxes: the
   checkboxes and the notice must enumerate the same purposes.
2. **No version identifier.** Without one, R-09's `noticeVersion` has nothing to point
   at, and no past consent can be tied to what was actually shown.
3. **No Eighth Schedule language.** §5(3) permits English or any Eighth Schedule
   language; offering only English is lawful but weak for a consumer product sold
   across India. Hindi at minimum.

Plus one substantive addition once R-12 lands: the statutory-retention class must be
disclosed — that security logs, consent records and billing ledgers survive an erasure
request, and why.

**Legal basis.** DPDP §5, §5(3); §6(1) (specific consent needs an itemised notice to
be specific *about*).

**Design.** Keep the prose — it is good and it is the "plain language" limb. Add an
itemised table above it as the operative notice, plus a `NOTICE_VERSION` constant
exported for R-09 to record, plus a language selector.

**Shipped.** `app/privacy/page.tsx` — an itemised table above the prose (kept, it is the
"plain language" limb), **generated from `PURPOSES`** rather than hand-written, so the
notice and the checkboxes cannot enumerate different things; `VERSION` now imports
`NOTICE_VERSION` from `lib/consent.ts`, the constant `consentRecord.noticeVersion`
actually stores — as two constants, a consent row could name a version this page no longer
renders, which makes the stored version worthless since its only job is to identify text
we can still produce. Plus the R-12 disclosure: a "what survives deleting your account"
section naming the three retained classes and why, so a subject learns it beforehand
rather than in a refusal.

**A false statement was removed from the live notice.** The hero read "The same text ships
inside the Windows app, which asks you to accept it before it runs." The desktop consent
screen was deleted (R-09 finding 1) — nothing asks. Replaced with what is now true: the
purposes are chosen separately at sign-in and changeable at `/account/privacy`.

**Open.** **Hindi.** §5(3) permits English or any Eighth Schedule language; English-only
is lawful but weak for a consumer product sold across India. Needs a translator, not a
developer — the table is data-driven, so the strings are the only work.

**Closed 2026-08-08.** The BYOK sections were the other open limb, and the rule stated
here — that a `NOTICE_VERSION` bump must *carry* the correction rather than precede it —
is exactly how it was done: 1.3.0 is the BYOK removal, and nothing else rode along with
it. See R-15.

**Acceptance.** Two of three met: every purpose in R-09's checkbox list appears in the
notice table with retention and recipient country (structurally — same array); and
`NOTICE_VERSION` is recorded on every consent row. Hindi is open.

---

## R-14 — Age capture at signup
**Priority:** Low *(lowered from Medium)* **Status:** Pending **Depends on:** R-09

**Evidence.** `app/privacy/page.tsx` states InsertGo is not intended for under-18s and
that under-18 users are not knowingly accepted. No capture at signup; no field in
`user`.

**Analysis.** Lowered because the stated intent already exists and the product is not
child-directed — a desktop writing assistant sold on subscription. The residual risk is
evidentiary rather than substantive: §9 carries a ₹150 crore penalty band, and the
cheapest possible defence is a recorded self-declaration rather than a policy sentence
nobody can prove was shown.

Not raised higher because verifiable parental consent — the actual §9 machinery — is a
heavy build that only becomes necessary if under-18 users are ever in scope. Building
it speculatively would be the definition of over-engineering.

**Legal basis.** DPDP §9.

**Design.** One 18+ self-declaration checkbox at signup, recorded as a
`consent_record` row (reuse R-09's table — no new schema). If under-18 users ever come
into scope, that row is where the enforcement hook attaches, and `analytics` must then
be hard-disabled for those accounts.

**Shipped.** `age_18_plus` is a required purpose in `lib/consent.ts`, so it rides on
R-09's table with no new schema, no new UI and no new migration — a checkbox in the same
gate. Classified **Class B** in R-12 and in `compliance/ropa.json`: the declaration is
evidence and must survive an erasure, or the §9 defence disappears with the account it
was made on. `lib/consent.test.ts` asserts that classification, because a drift to Class A
would silently delete the only proof the question was asked.

**Acceptance.** Met in code — every account passing the gate records an age declaration
with a timestamp and notice version. Pending the migration for the live limb.

---

## R-15 — Desktop data-flow notice
**Priority:** **High** *(re-raised from Low)* **Status:** **Done — 2026-08-08**

> ## Decision, 2026-08-08: BYOK is cancelled, permanently
>
> The user's call, recorded verbatim in substance: **InsertGo will not implement BYOK
> in the future either.** That resolves the fork below to **option 1, in its stronger
> form** — the sections are not merely re-tensed to "not yet", they are removed, because
> there is no future release in which they become true.
>
> **What that changed (all shipped in this session):**
>
> 1. **Both policies corrected, legal version 1.2.0 → 1.3.0.** `app/privacy/page.tsx`,
>    `app/terms/page.tsx` and the desktop mirror `src/legal/index.ts`. The standalone
>    "Your own API key, and local models" privacy section is deleted; Terms §9 is
>    *rewritten in place* rather than removed, so §10–§24 keep their numbers and the
>    §23 grievance cross-references in three files stay valid. It now states the
>    negative explicitly — you cannot supply a key, you cannot point at a local model,
>    and if that ever changes it will be documented before it ships, not after. The
>    inline claims went too: Credential Manager holds the **session token** (the only
>    credential the app has), and we are the controller for every AI request because
>    there is no path that does not cross our servers.
> 2. **Version bumps are the point, not a side effect.** `NOTICE_VERSION` 1.3.0
>    re-consents every user through R-09's gate, which is correct: the material fact a
>    user relied on has changed. Terms had a *third* independent version constant
>    (`"1.2.0"`, effective "5 August 2026", disagreeing with the privacy page's own
>    dates); it now imports `NOTICE_VERSION` like the privacy page does, and the desktop
>    exports `LEGAL_EFFECTIVE` beside `LEGAL_VERSION`. Four hand-typed version strings
>    are down to two constants that must be bumped together, asserted by a test.
> 3. **Two more false statements found while editing, same class as R-13's.** Terms §1
>    said "the desktop application will not run until your acceptance is recorded" and
>    the Terms hero said the app "asks you to accept it before it runs" — the desktop
>    consent screen was deleted with the old setup flow (R-09 finding 1). Both now say
>    acceptance happens at sign-in, which is what actually happens.
> 4. **The in-app notice this item was opened for now exists** —
>    `Settings/SettingsPanel.tsx`'s `DataFlowNotice`, replacing a footer that said only
>    "Active provider: InsertGo Proxy (hosted)". It names the real destination (our
>    relay, then Google's Gemini API, **outside India**), states that we record token
>    counts and not text, states the negative about keys and local models, and links the
>    published policy. It reuses the existing `PrivacyIndicator` diagram rather than
>    describing the route in prose.
> 5. **The scaffolding is deleted, which is the part that stops this recurring.**
>    `domain/ollama.rs` + its command + bridge wrapper; `readNdjsonStream` (Ollama's wire
>    format, no caller but its own test); the ~35 third-party model hosts in
>    `capabilities/default.json`'s `http:default`; and — the sharpest one — the
>    `https://**` http scope on **`selfloater.json`**, the window that streams the user's
>    selected text, which could POST it to any host on the internet. Every request the
>    app makes resolves to `${API_URL}` (`services/lanes.ts` → `aiProviders.ts:204`), so
>    none of that was reachable; it was granted egress waiting for a feature that is now
>    never coming. `SPEC.md` §16 records the cancellation and what deliberately stayed
>    (`ProviderConfig`, because the managed lane is itself a provider row; loopback in the
>    http scope, because that is the dev API server).
>
> **What is deliberately NOT deleted:** `ProviderConfig.apiKey`. It is persisted as `""`
> or `"dummy"`, ignored by `providers.rs`, and removing it is a storage-format change
> for no security gain — the field never holds a secret. Documented in SPEC §16 so the
> next reader does not mistake its survival for a surviving intention.
>
> ---
>
> **Original finding, kept because the reasoning is the audit trail.**
>
> **The premise of this item was false, and the finding is the opposite of the one it was
> opened for.** This item assumed BYOK ships and only its *placement* was wrong. **BYOK
> does not exist in this build.** Verified:
> - `src/services/aiProviders.ts:496-502` — `createProvider()` **throws** for any base URL
>   whose host is not `generativelanguage.googleapis.com`.
> - `src/types/index.ts:20-26` — `ProviderConfig.apiKey` is `@deprecated`: "no real API
>   key ever belongs here… always empty or a dummy marker".
> - `src-tauri/src/domain/providers.rs:3-8` — "no secret is stored here… Any legacy
>   `apiKey` field in an incoming payload or an old `providers.json` is ignored."
> - `src/services/aiProviders.ts:75-79` — even the Gemini lane "is NOT an egress target —
>   the client sends nothing to Google directly; generations go to the website proxy".
>
> **Every user is on the managed relay, always.** There are no user API keys, nothing in
> Windows Credential Manager but the session token, and no local-model lane.
>
> Both published privacy policies say otherwise, at length: a whole section titled "Your
> own API key, and local models"; "API keys you enter go into Windows Credential Manager
> and are never sent to us"; "your text goes straight from your PC to [the provider]".
> Website `app/privacy/page.tsx:49,63,73-74,175-181,326`; desktop mirror
> `src/legal/index.ts:184-194,424,448-449,554-556,707`.
>
> **This over-promises privacy**, which is the direction that actually harms users: they
> are told a protective mode exists, and choose to trust the product on that basis, while
> every generation goes through our servers. A notice that under-describes is a gap; one
> that over-describes is a misstatement.
>
> **Decision required before anyone edits the text**, because the fix is opposite in each
> case and both are one-way doors:
> 1. **BYOK is gone** → delete those sections from both copies, bump `NOTICE_VERSION`
>    (which re-consents every user through R-09's gate — correct, since the change is
>    material), and re-scope this item to "show the managed-relay destination in-app".
> 2. **BYOK is coming back** → the sections stay, and this item reverts to its original
>    scope, but the notice must not describe it in the present tense until it ships.
>
> **The evidence pointed at (2) — and the evidence was wrong.** That inference is worth
> keeping as a lesson: retained scaffolding was read as retained *intent*, and it was not.
> Only the person who owns the roadmap could settle it, which is why it was escalated
> rather than resolved from the code. The paragraph as written at the time:
>
> The Tauri `http://localhost:*` capability is retained
> across four capability files, and `vite.config.ts:13` says why in as many words: "the
> Tauri http capability allows `http://localhost` on any port **for local BYOK providers
> (Ollama / LM Studio)**". So BYOK is *intended and partly scaffolded* — the transport
> permission and the `ProviderConfig` shape exist — and only the provider factory and key
> storage were never built or were removed. That makes the correct fix **tense, not
> deletion**: the notice must stop describing BYOK in the present tense until
> `createProvider()` accepts a second host.
>
> Not done unilaterally even so: "not shipped yet" and "abandoned" produce different text,
> and rewriting a live legal document on an inference is worse than the misstatement it
> would fix. One sentence from the user settles it.

**Already corrected where it was unambiguous:** `lib/consent.ts`'s `ai_processing`
description (written the same day, would have shipped the same false claim into the
consent gate) and `compliance/dpia-prompt-flow.md`. Both now record the cancellation
rather than the open question.

**Analysis (as re-scoped).** The original point survives the decision intact, and only
its subject changes. Placement was always the real gap: the disclosure lived on a web
page, and the person whose text is about to leave the machine is in the desktop app.
A notice read once at signup does not inform anything three weeks later in a different
process — that is true of the managed relay exactly as it was of BYOK.

So the thing worth surfacing in-app is now the *managed* route: the text goes to
InsertGo's servers and on to **Google's Gemini API, outside India**, we keep token
counts and not content, and there is no alternative route to choose. Stating the
absence matters as much as stating the destination — a user who half-remembers the old
policy would otherwise go looking in Settings for a key field that no longer exists.

**Legal basis.** DPDP §5 (notice at the point of collection); §6 (specific consent).

**Design.** A `DataFlowNotice` in the desktop Settings panel, reusing the existing
`PrivacyIndicator` route diagram, naming the destination and linking the published
notice. No new consent artifact: the managed relay is already covered by R-09's
`ai_processing` purpose, and this is the §5 notice limb, not a second §6 decision.

**Shipped.** `Settings/SettingsPanel.tsx` — see the decision block above for the full
list, which extends past the notice into deleting the BYOK scaffolding that made the
misstatement possible.

**Acceptance.** Met. The desktop app states its actual destination, in-app, before any
request is sent — no configuration step is required to reach it, because the notice
sits in Settings where the provider controls used to be, and there is exactly one route.
The stronger limb the original acceptance implied (that no text can reach a host we did
not disclose) is now enforced by the capability scopes rather than by prose.

---

# Governance

## R-16 — File CERT-In Point of Contact
**Priority:** High **Status:** Pending **Blocks:** R-03, R-17

**Analysis.** Direction 3 requires a designated Point of Contact whose details are
filed with CERT-In and kept current. It is listed as governance but it is really a
*technical* blocker: R-03's alerts must page a person, and R-17's 6-hour filing must be
made by someone with standing. Both are unfinishable without it, and it costs a form.

The failure mode is a single-person PoC. A 6-hour deadline that lands while one person
is on a flight is a missed deadline; the backup is not optional.

**Legal basis.** CERT-In Direction 3.

**Steps.** Designate primary + backup → file with CERT-In in the prescribed format →
publish the address on the website → re-file on any personnel change → add annual
revalidation to the compliance schedule.

**Acceptance.** Filing acknowledgement retained. Both contacts reachable out of hours.
Names recorded in R-17's runbook.

---

## R-17 — Dual-track breach runbook
**Priority:** High **Status:** Pending **Depends on:** R-03, R-16

**Analysis.** The whole item exists to prevent one specific mistake: **making the
CERT-In filing wait on the personal-data assessment.**

The two clocks start together at detection but measure different things. CERT-In's
6 hours runs on *any* Annexure I cyber incident — including ones with no personal data
at all, like a defacement or infrastructure scanning. The DPB's clock runs only on a
personal-data breach. Determining whether personal data was affected routinely takes
longer than six hours. So a runbook with a single triage gate feeding both tracks
misses the CERT-In window *by design*, in every incident, and will do so while looking
methodical.

Hence two owners, two gates, evaluated concurrently. And a rule that is
counter-intuitive under pressure: **file CERT-In on partial facts.** Completeness is
not a filing precondition and supplements are expected; six hours is not extendable.
The instinct to wait until the picture is clear is the instinct that causes the breach
of Direction 2.

DPB track: intimate each affected Data Principal without delay in plain language
(nature, extent, timing, likely consequences, mitigation, contact point) — that is a
product surface, not a legal letter, and the template has to exist beforehand. Board:
initial intimation without delay, detailed report within 72 hours.

**Legal basis.** CERT-In Direction 2 (6h); DPDP §8(6) and the DPDP Rules (DPB
intimation without delay, detailed report ≤72h).

**Design.** Runbook with pre-filled Annexure I and DPB templates, both owners named
from R-16, an immutable incident register, and a log-freeze step that exempts the
incident window from R-02's 210-day purge. Rehearse semi-annually — an untested
6-hour process is an aspiration.

**Shipped.** `compliance/incident-runbook.md` — the dual-clock table and the "file CERT-In
on partial facts" rule as §0 rather than buried; what counts as "noticing" and the
instruction to write the wall-clock time down first; parallel T+0 tracks with the
log-freeze step ahead of any remediation that would destroy evidence; a pre-filled
Annexure I template and a data-principal intimation template written as product copy
rather than legal boilerplate; an incident register; and a rehearsal scenario bank.

The `auditLog` event → Annexure I type mapping is lifted straight from
`lib/auditLog.ts`'s catalogue, which is what that catalogue was closed for. §3.3 points
the DPB track at `compliance/ropa.json` — the "which categories were affected?" question
is exactly the inventory R-21 generates, and it is generated rather than remembered for
this moment specifically.

**§7 states what makes it not yet executable**, in the document itself rather than only
here: the detector cannot detect its own death (R-03 open action e), pages go nowhere
until `OPS_ALERT_TO` is set (c), Hobby silently coerces the cron to daily (d), the log
store is currently in Tokyo (R-19), and processor notification is contractual and unsigned
(R-18). Those are facts a responder needs at 3am, not caveats for an auditor.

**Open.** Names, from R-16. Every owner cell is a placeholder, and the acceptance below
cannot be run until they are filled.

**Acceptance.** Untestable until R-16 lands — a tabletop needs a named PoC to run it. The
criterion stands: a complete Annexure I draft in under 90 minutes from a cold start,
using only the runbook, with no access to whoever wrote it.

---

## R-18 — Processor contracts under §8(2)
**Priority:** High **Status:** Pending **Blocks:** R-19

**Evidence.** Processors in use: Supabase, Vercel, Google (Gemini API), Dodo Payments,
Resend. No DPDP-specific terms executed.
**Corrected 2026-08-08 by R-19:** that list is **incomplete — there are seven, not
five.** `@upstash/redis` and `@upstash/vector` are declared dependencies on a live Edge
path, and **Upstash Vector stores prompt embeddings and cached response text**. Full
register in `compliance/subprocessors.md` §3, with a contract priority order by data
sensitivity in §5 (Google first, Upstash Vector second — not by vendor size).

**Analysis.** §8(2) keeps the Data Fiduciary liable for its processors and permits
processing only under a valid contract. The liability is not transferable, so the
contract is the only instrument that makes the obligation manageable.

The clause that actually matters operationally is **processor breach notification
within 24 hours**. Both InsertGo clocks — 6 hours to CERT-In, 72 hours to the DPB —
start when *we* notice. If a processor takes 5 days to tell us, our filings are late
through no act of ours and with no defence. A 24-hour processor SLA is what keeps our
own deadlines reachable; without it the entire R-17 design rests on luck.

**Legal basis.** DPDP §8(2); §8(6).

**Design.** Standard terms covering: purpose limitation, security safeguards, **breach
notification to InsertGo within 24 hours**, deletion on termination, no onward
subprocessing without notice, and cooperation with data-principal requests within the
90-day window.

**Acceptance.** Signed terms on file for **all seven** (re-scoped from five — see the
evidence correction above). Each names a breach-notification channel that has been
tested at least once.

---

## R-19 — Subprocessor register + region pin
**Priority:** High *(raised from Medium)*
**Status:** **Register done — region non-conforming, migration open**
**Blocks:** R-02 acceptance (limb d, now failed) **Detail:** `compliance/subprocessors.md`

**Analysis.** Raised because R-02's compliance with Direction 4 now *depends* on it.
The audit log satisfies "within Indian jurisdiction" only if the Supabase project is in
`ap-south-1`, and that has been assumed, not verified. If the project sits elsewhere,
R-02 is not merely incomplete — it is a documented control that does not do what its
own policy says, which is the worst finding of the three possible states.

Substantively the cross-border posture is fine, and worth stating clearly: §16 uses a
**negative list**. Transfers are permitted unless the Central Government restricts a
country by notification. No SCCs, no adequacy assessment, no transfer impact
assessment — those are GDPR instruments and answer no Indian obligation. The control
is a monitored register plus §8(2) contracts.

Two caveats. First, CERT-In Direction 4's in-jurisdiction log duty is independent of
§16's permissiveness — one is satisfied, the other still applies. Second, no RBI
payment-data localisation duty attaches while Dodo is merchant of record and no card
data touches our systems; that must be re-tested if the payment architecture changes.

**Legal basis.** DPDP §16; CERT-In Direction 4.

**Design.** Published `compliance/subprocessors.md`: entity, purpose, data categories,
hosting country, contract date. Verify and pin the Supabase region. Monthly check for
§16(1) restriction notifications, recorded even when the answer is "none" — an
unrecorded check is indistinguishable from one that never happened.

**What the verification found.**

1. **The region was `ap-northeast-1` (Tokyo), not `ap-south-1`.** Two independent
   signals, in `subprocessors.md` §1 and reproducible from §6. The value had never
   been read from anything — it was a design requirement that three documents
   subsequently cited as an observation. R-02's limb (d) fails, and the *substantive*
   §16 posture the audit called "fine" really is fine: Japan is not on the negative
   list, so the transfer is lawful. It is the CERT-In *logging* duty that breaks, and
   the two are independent.
2. **Five processors were actually seven.** `@upstash/redis` and `@upstash/vector` are
   declared dependencies with a live path from `/api/ai/generate` (`lib/edgeCache.ts`),
   and **Upstash Vector stores prompt embeddings and cached response text** — the
   second-most sensitive category in the estate. R-18's list came from what the audit
   narrative discussed rather than from `package.json`. They are also documented only
   in `DEV_SETUP.md:45-46` and **not** in `.env.example`, which is plausibly why they
   stayed invisible: the file everyone copies does not mention them.
3. **Region ≠ configured.** `redis()`/`vectorIndex()` return `null` when unset and
   every caller degrades to "no cache", so whether Upstash is live is a per-environment
   fact. Recorded as an open verification rather than guessed — "probably unset" is not
   a register entry.
4. **The desktop is clean.** No Sentry/PostHog/Mixpanel/Amplitude/Datadog/Crashlytics
   anywhere in `src/` or `src-tauri/src/`. BYOK egress is deliberately **not** a
   subprocessor row: InsertGo is not the recipient (reasoning in §3.2).

**The decision that follows.** Migrate the Supabase project to `ap-south-1` rather than
shipping only `auditLog` to an Indian store. The S3 `ap-south-1` + Object Lock path in
`log-retention.md` §6 would satisfy Direction 4 exactly and is technically stronger,
but it fixes the narrower problem for more work — an AWS account, a credential, an IAM
policy and a drain receiver — and leaves every user's name, address and billing ledger
in Tokyo. The migration moves the personal data too, changes no code and adds no
credential. Rejected alternatives, including the CERT-In FAQ latitude and its role as
the interim position, in `subprocessors.md` §2.1.

**Timing is the load-bearing part.** `insertgo.com` currently answers 503
`DEPLOYMENT_PAUSED` on every route. The standing objection to a region migration is the
restore window; today that window costs nothing. The cost only rises from here.

**Shipped.** `compliance/subprocessors.md` — seven-processor register with data
categories read from the code path rather than from vendor descriptions, the region
finding and what it does and does not break, the migration decision with two rejected
alternatives, the §16 negative-list position, reproducible verification commands for
every claim, a dated check log with the first row filled in, and a "what voids this
register" section. `log-retention.md` §1, §6 and §11.2 corrected.

`.env.example` — the root cause of finding 2, fixed rather than left as a manual
action. It described the **deleted** in-process HNSW cache and never mentioned the
Upstash services that replaced it, so the file everyone copies when standing up an
environment actively concealed a processor. It now carries the `UPSTASH_*` block with
the register cross-reference, and drops `SEMCACHE_MAX_ENTRIES` and the three
`SEMCACHE_HNSW_*` keys — verified dead (no code reads them; `lib/hnsw.ts` is gone), so
they were documented defaults for nothing. `SEMCACHE_MAX_TEXT_KB` is read by the code
and was undocumented; it is now listed.

**Open (manual).** (a) **Migrate to `ap-south-1`** (§2.2) — the blocker on R-02;
(b) confirm whether `UPSTASH_*` is set in Vercel production, and if so read both
regions from the console; (c) read the Vercel function region from the dashboard, or
pin it with `preferredRegion`.

**Acceptance.** Register published and matching the processors actually in the code —
**met, at seven**. Supabase region confirmed as `ap-south-1` in writing, or migration
planned with a date — **partly met**: the region is confirmed in writing and it is the
wrong one; the migration is planned (§2.2) and its date is the 2026-09-08 check-log
row. This limb closes when §6's two signals both return `ap-south-1`.

---

## R-20 — Verify published grievance contact
**Priority:** Low *(lowered from Medium)* **Status:** Pending

**Evidence.** `app/privacy/page.tsx:29-31` names a Grievance Officer with
`grievance@insertgo.ai` and a stated acknowledgement window. The original finding —
"no published DPO / grievance contact" — was wrong.

**Analysis.** Reduced to verification: the mailbox must be monitored by a named person,
route into R-11's `dsr_request` queue rather than an inbox, and carry the postal address
the IT Rules 2011 Rule 5(9) grievance regime expects. A published contact that nobody
watches is worse than none, because it is an advertised commitment.

Separately, track the §10 Significant Data Fiduciary trigger. If InsertGo is ever
notified as an SDF, this becomes an India-resident DPO plus mandatory DPIA and annual
independent audit — a step change, not an increment. Do not assume it does not apply;
re-test annually.

**Unblocked 2026-08-08.** The queue this acceptance requires now exists: R-11 shipped
`dsrRequest` with `dsr_create()`, and `/account/privacy` already raises `grievance` rows
from the web. What remains is the *inbound* half — routing the mailbox into the queue —
plus the name.

**Open (manual).** (a) Appoint the officer; `GRIEVANCE_OFFICER.name` is
`[Name to be appointed]` in **three** places that must change together —
`app/privacy/page.tsx:29`, `app/terms` §23, and the desktop mirror
`Insert-Go Windows/src/legal/index.ts:25`. (b) Route `grievance@insertgo.ai` into
`dsr_create(..., p_verified => false)` — **false is load-bearing**: an emailed request has
not proved who sent it, and `erase_user()` refuses unverified erasure rows for exactly
that reason. (c) Add the postal address IT Rules 2011 Rule 5(9) expects; the policy
currently says "available on request", which is thinner than the rule contemplates.

**Acceptance.** Now testable once (b) lands: a test grievance sent to the published
address creates a `dsrRequest` row with `status='open'`, `verifiedAt` null, and a `dueAt`
90 days out, and is acknowledged within the stated 48 hours.

---

## R-21 — RoPA generated from schema
**Priority:** Medium **Status:** Pending **Blocks:** R-22, R-08

**Analysis.** §8(1) accountability requires knowing what is processed and why. A
hand-maintained record drifts from the schema within weeks — this audit is itself the
evidence, since four of its initial findings were wrong precisely because the schema
was not read exhaustively before conclusions were drawn.

Hence: generate the RoPA from the live schema and gate on it. A new personal-data
column with no RoPA entry should fail CI, not be discovered at the next audit.

**Legal basis.** DPDP §8(1); ISO/IEC 27001 A.5.34.

**Design.** Script reading `supabase-auth-schema.sql` plus the R-02/R-09/R-11
additions, emitting a machine-readable record mapping column → purpose → retention
class (A/B from R-12) → recipients. CI check in the R-07 workflow.

**Shipped.** `scripts/ropa.mjs` — parses the three schema files, cross-references a
column-level classification table, emits `compliance/ropa.json` (88 columns, 10 tables)
and gates. Not a SQL parser dependency: the input is three files in one narrow dialect we
control, and a parser would still need the classification table, which is the part that
carries the meaning. New `ropa` job in `.github/workflows/security.yml`, alongside R-06's
and R-07's.

**The gate runs in both directions**, which the item did not ask for and which is where
the second class of drift lives: a column with no classification fails, *and* a
classification for a column that no longer exists fails — a RoPA that describes
processing we stopped doing is as wrong as one that misses processing we started. A third
job asserts `compliance/ropa.json` is regenerated, so the published record cannot fall
behind the table it is generated from.

Class `N` ("not personal data") is a required, explicit verdict rather than an absence:
"we looked and it isn't" and "nobody looked" must not be the same state, which is the
distinction the whole item turns on.

**Acceptance.** Met, and **exercised rather than assumed**: adding
`alter table "user" add column if not exists "phoneNumber" text` made the gate exit 1
naming the column; reverting returned it to exit 0 (88 columns, all classified).

---

## R-22 — DPIA for the cross-border prompt flow
**Priority:** Low **Status:** Pending **Depends on:** R-21

**Analysis.** Not mandatory outside SDF status, which is why it is Low. Worth doing
anyway for one flow: user prompt text leaving India for Google's Gemini API on the
managed relay. That is the highest-sensitivity data the product touches (drafts, emails,
private writing), the least controlled path, and the one a regulator would ask about
first. *(Originally scoped as two flows — the relay and BYOK's ~35 user-chosen providers.
BYOK was cancelled on 2026-08-08, so there is exactly one flow to assess, which makes
this item narrower and its conclusions firmer.)*

The value is in establishing intent *before* being asked. A DPIA produced after an
inquiry is a defence; one produced beforehand is a control.

**Legal basis.** DPDP §10(2) (SDF-mandatory, recommended otherwise); §16.

**Design.** One page: data categories, necessity, cross-border route, safeguards
(`/api/ai/generate` logs token counts only — `route.ts:44,110,347`), residual risk,
sign-off. *(The original design also required distinguishing the relay from BYOK; with
BYOK cancelled that comparison is history, not architecture.)*

**Shipped.** `compliance/dpia-prompt-flow.md` — data categories from `ropa.json`,
necessity and proportionality including the alternative that was *provided* (BYOK) and
the one that was rejected (on-device inference for the managed tier, recorded as a
decision rather than an omission), the §16 negative-list position, a seven-row risk table
with three risks left explicitly **open** and mapped to named actions, and the
data-principal impact per right.

**Corrected twice, in the two sessions after it was written.** First: the assessment was
scoped on BYOK being live, and it was not (R-15). Then, on 2026-08-08, BYOK was cancelled
outright, so §2's two-flow comparison is neither current nor intended architecture — it is
a closed option, and risk 6 (a user misunderstanding where their BYOK text goes) is struck
rather than left open. The page carries both corrections at the top instead of being
quietly rewritten. The managed-relay half, which is the half that describes what actually
happens, has stood unchanged throughout.

**The line the cancellation costs us**, stated plainly because a DPIA that only records
mitigations is marketing: a user who wants InsertGo out of the path no longer has a
supported way to take us out of it. Under the original assessment that was the strongest
proportionality argument on the page. What replaces it is weaker and narrower — declining
the AI features, or not using the product — and the residual risk of the cross-border
flow is correspondingly higher than the first draft claimed. That is a real cost of the
decision, not a wording problem.

**Open.** Signature. Every other acceptance limb is met.

**Acceptance.** Partly met: dated, with a review trigger tied to any new model provider,
any change to what leaves the device, or SDF notification. **Unsigned — blocked on R-16**
naming the privacy owner.

---

## Ongoing compliance schedule

Full cadence in the audit response. Anchors:

| Interval | Activity | Item |
|---|---|---|
| Weekly | `npm audit` + `cargo audit`, blocking | R-07 |
| Weekly | Audit-log sink health | R-02 |
| Weekly | Detector heartbeat — confirm the cron ran and the uptime monitor is green | R-03 |
| Monthly | `audit_log_coverage(180)` — investigate any zero-event day | R-02 |
| Monthly | §16(1) restriction-notification check **and re-verify every processor region with `subprocessors.md` §6's commands**, recorded either way | R-19 |
| Monthly | Open-DSR ageing report — `select * from dsr_ageing()`; anything `escalated` is past day 75 | R-11 |
| Per PR | RoPA classification gate — an unclassified personal-data column fails CI | R-21 |
| Quarterly | Vulnerability-exception review — re-test each reachability claim, then fix or re-date | R-07 |
| Quarterly | Secret rotation checklist | R-01 |
| Quarterly | Access review; backup + log-retrieval drill | R-02, R-04 |
| Quarterly | Consent-record sample audit (20 accounts) | R-09 |
| Semi-annual | Dual-clock breach tabletop | R-17 |
| Semi-annual | Notice + consent-purpose review | R-13 |
| Annual | VAPT by a CERT-In empanelled auditor | R-07 |
| Annual | CERT-In PoC revalidation | R-16 |
| Annual | Time-source register re-attestation (`log-retention.md` §11.2) | R-05 |
| Annual | §10 Significant Data Fiduciary threshold re-test | R-20 |

## Companion documents

| File | Item |
|---|---|
| `compliance/secret-rotation.md` | R-01 |
| `compliance/log-retention.md` | R-02, R-03 (§10), R-05 (§11) |
| `compliance/subprocessors.md` | R-19, R-18 (register is the contract input) |
| `compliance/vulnerability-exceptions.md` | R-07 |
| `compliance/incident-runbook.md` | R-17 |
| `compliance/dpia-prompt-flow.md` | R-22 |
| `compliance/ropa.json` *(generated — `node scripts/ropa.mjs emit`)* | R-21, R-12 |
| `compliance/isms-index.md` | R-08 (indexes all of the above) |
| `Insert-Go Windows/SECURITY.md` | Boundary decisions, dependency floors |
