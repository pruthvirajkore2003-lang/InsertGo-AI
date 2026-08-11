# Security logging and 180-day retention policy

**Remediation items:** R-02 (the store), R-03 (§10, detection), R-05 (§11, time
synchronisation)
**Legal basis:** CERT-In Directions No. 20(3)/2022, **Direction 4** — "enable logs of
all their ICT systems and maintain them securely for a rolling period of 180 days …
within the Indian jurisdiction". Also Direction 1 (clock synchronisation),
Direction 2 (6 hours from noticing), Direction 3 (produce logs to CERT-In on order)
and DPDP Act 2023 §8(5); ISO/IEC 27001 A.8.15 (logging), A.8.16 (monitoring).
**Status:** in force since 28 June 2022. Non-compliance is punishable under IT Act
§70B(7). This is not a future-dated obligation.
**Owner:** Engineering lead / CERT-In Point of Contact (R-16).

---

## 1. System of record

**`auditLog` in the Supabase Postgres project** (`Insert-Go Website/supabase-audit-log.sql`).

Neither platform log is fit to be the record:

| Source | Retention | Verdict |
|---|---|---|
| Vercel runtime logs | hours to days on this plan | Diagnostic only |
| Supabase logs (Postgres, PostgREST, Auth) | ~1–7 days by plan | Diagnostic only |
| **`auditLog` table** | **180-day floor, purged at 210** | **System of record** |

> **⚠️ Jurisdiction is NOT currently satisfied — corrected 2026-08-08.**
> This section previously asserted the Supabase project region was `ap-south-1`
> (Mumbai). **It is `ap-northeast-1` (Tokyo, Japan)**, verified two ways in
> `compliance/subprocessors.md` §1 and §6. `ap-south-1` was never read from anything;
> it was written here as the region the design *required* and then cited elsewhere as
> though it were an observation.
>
> **Effect:** the 180-day store is held outside India, so the *jurisdiction* limb of
> Direction 4 is breached. The *retention* limb — 180-day floor, append-only, purge at
> 210 — is unaffected and holds; the SQL and TypeScript in this policy need no change.
> R-02 moves from Done to **Blocked on migration**.
>
> **Remediation:** migrate the project to `ap-south-1`. Steps, timing and rejected
> alternatives in `subprocessors.md` §2. Until that completes, the interim position is
> the FAQ latitude described immediately below — stated as a position, not as
> compliance.

CERT-In's FAQ to these Directions permits logs to be stored outside India provided
they can be produced to CERT-In when ordered. This policy deliberately did not rely on
that latitude, on the reasoning that keeping the store in-region removes the argument
entirely and costs nothing since the personal data it describes already lives there.
That reasoning was sound and the premise was false — the data does not live there
either. The latitude is therefore the position of record for the migration window
only, and `subprocessors.md` §7 dates that window so it cannot quietly become
permanent.

## 2. What is logged

The closed event catalogue lives in `Insert-Go Website/lib/auditLog.ts` — closed on
purpose, because an alert rule (R-03) can only watch names it knows. Each maps to the
CERT-In **Annexure I** incident type that a 6-hour filing has to name.

| Event | Annexure I type | Severity |
|---|---|---|
| `auth.signin` | Unauthorised access to IT systems; identity theft | info / warn |
| `auth.otp.request` | Phishing, identity theft | info |
| `auth.session.purge` | Operator action (evidence for R-01 §3.2) | info |
| `billing.webhook.signature_invalid` | Unauthorised access; data tampering | **critical** |
| `billing.webhook.unmatched_user` | Data integrity failure | warn |
| `ai.replay_refused` | Attacks on applications (metering bypass) | **critical** |
| `ai.quota_denied` | Targeted scanning / abuse | warn |
| `ai.metering_failure` | Attacks on servers | warn |
| `db.permanent_failure` | Attacks on servers | warn |
| `consent.grant` / `consent.withdraw` | — (DPDP §6 evidence) | info |
| `dsr.request` / `dsr.fulfilled` | — (DPDP §§11–14 evidence) | info |
| `account.erasure` | — (DPDP §12(3) evidence) | info |

Each row carries: timestamp, event, severity, outcome, pseudonymous `userId`, client
IP, user-agent, and a bounded `detail` object of ids/counts/enums.

**Deliberately never logged** — SPEC §10 and DPDP §8(5), enforced by review and by the
R-06 CI gate: prompt or response bodies, email addresses, OTP codes, session tokens,
bearer tokens, API keys, passwords, or any free user text.

**IP and user-agent are personal data and are retained anyway.** The basis is
compliance with a legal obligation (Direction 4), **not** consent. They therefore sit
in the **Class B / statutory-retention** bucket of the R-12 classifier and survive a
consent withdrawal or an erasure request. The §5 privacy notice (R-13) must state this
plainly — a subject who asks for erasure and finds security logs retained deserves to
have read why beforehand, not to discover it in the refusal.

### Out of scope: the desktop client

`Insert-Go Windows` runs on the data principal's own machine. Its local logs and
history store are the user's records on the user's hardware, not our ICT system, and
are not collected. Direction 4 attaches to the systems we operate: the Next.js
application, its API routes, and the Supabase project. The desktop's *server-side*
footprint — sign-in, token exchange, every relayed generation — is already captured
here, because all of it transits the website.

## 3. Retention

- **Floor: 180 days.** Enforced in SQL, not by convention: `audit_log_purge()` applies
  `greatest(coalesce(p_older_than_days, 210), 180)`, so a mistaken
  `audit_log_purge(30)` deletes nothing that is still owed. The floor cannot be
  lowered from a call site.
- **Purge age: 210 days**, giving a month of margin. Over-retention never breaches
  Direction 4; under-retention always does.
- **Schedule:** `pg_cron` job `insertgo-audit-log-purge`, daily at 03:17 UTC. If
  `pg_cron` is not enabled the SQL file raises a notice and skips scheduling — the
  table then grows unbounded, which is safe but should be corrected.

## 4. Integrity and access control

- **Append-only for every role, including the owner.** A statement-level
  `BEFORE UPDATE OR DELETE` trigger raises unconditionally. The only legitimate
  deleter is `audit_log_purge()`, which opens the gate with a transaction-local GUC
  that a PostgREST caller cannot set — PostgREST transmits no arbitrary SQL.
- **No table-level DML is granted to any role.** Writes go through the
  `security definer` function `audit_log_write()` or not at all. `service_role` holds
  `SELECT` for incident response only.
- **No foreign key to `user`.** Every other table in the schema cascades on user
  deletion; this one must not, or a DPDP §12(3) erasure request would destroy the
  records Direction 4 requires be kept. An audit trail a subject can delete is not an
  audit trail.
- **Trust-boundary caps.** `event` ≤64 chars, `userAgent` ≤512, `detail` ≤2048,
  enforced as CHECK constraints *and* trimmed client-side so a row lands truncated
  rather than being rejected. Without a ceiling, one unauthenticated client can inflate
  the store until writes fail — the cheapest way to blind an audit trail is to flood it.
- **Failure is degraded, never silent.** If the audit write fails, `lib/auditLog.ts`
  falls back to `console.error` and the request still succeeds. A persistent outage is
  caught by §5, not by a user-visible error.

## 5. Verification

`audit_log_coverage(180)` returns one row per day with event and critical counts.

```sql
-- Monthly integrity check. Investigate ANY day with zero events.
select * from public.audit_log_coverage(180) where "events" = 0;
```

A zero-event day in a system that authenticates users daily means **logging was down**,
not that nothing happened. That is the whole point of the check: a broken sink looks
exactly like a quiet month right up until CERT-In asks for the window.

Cadence (see the compliance schedule): weekly automated sink-health check, monthly
coverage query, quarterly retrieval drill — pull a random 24-hour window and confirm it
can be produced in the Annexure I format within one working day.

## 6. Upgrade path

The current control defends against a leaked **application** credential. It does not
defend against a hostile database owner with `psql`, who could drop the trigger.

If the threat model grows to include that, ship these rows to **S3 `ap-south-1` with
Object Lock in COMPLIANCE mode**, 180-day retention and lifecycle expiry at 210 days,
written by an append-only IAM role. COMPLIANCE mode cannot be shortened or overridden
by anyone, including the account root — which is strictly stronger than any in-database
control. A Vercel Log Drain into the same bucket would also capture platform-level logs
this table does not see, and becomes available on an eligible Vercel plan.

Not done now because it adds an AWS account, a credential, an IAM policy and a drain
receiver to solve a threat the current design already covers for an organisation this
size. The decision is recorded so it is a choice, not an oversight.

Since 2026-08-08 this path would *also* fix the jurisdiction breach in §1, which is a
different reason to reach for it than the one it was written for. It was still
rejected for that purpose — migrating the Supabase project moves the personal data as
well as the logs, changes no code and adds no credential. Reasoning in
`subprocessors.md` §2.1; the hostile-owner threat above remains a separate, open
decision.

## 7. Producing logs to CERT-In (Direction 3)

On a CERT-In order, the PoC (R-16) produces the requested window:

```sql
select "at", "event", "severity", "outcome", "userId", "ip", "userAgent", "detail"
from "auditLog"
where "at" >= '<from>'::timestamptz and "at" < '<to>'::timestamptz
order by "at";
```

Export as CSV, note the row count and the exact window in the incident record, and
transmit through the channel named in the order. All timestamps are UTC (see R-05).

## 8. Deployment

Run once in Supabase — SQL Editor → New query → paste → Run, after
`supabase-auth-schema.sql`. Safe to re-run.

1. Dashboard → Database → Extensions → enable **pg_cron** (otherwise the purge is not
   scheduled and the file says so in a notice).
2. Run `Insert-Go Website/supabase-audit-log.sql`.
3. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel — they were
   previously needed only by `/api/ai/generate`; audit writes from the Node-runtime
   routes now use the same PostgREST transport.
4. Smoke test: `POST /api/billing/webhook` with a bad `webhook-signature` → expect 401,
   then `select * from "auditLog" order by "at" desc limit 1;` → expect one
   `billing.webhook.signature_invalid` row.
5. Confirm append-only: `delete from "auditLog";` must raise
   `auditLog is append-only: DELETE refused`.

## 9. Known gaps

| Gap | Effect | Plan |
|---|---|---|
| Vercel platform logs are not drained into the 180-day store | Function-level events with no application call site (cold-start failures, platform 502s) are not durably retained | §6 upgrade path, on an eligible plan |
| The detector has no dead-man's switch | If the cron itself stops firing, nothing notices. `coverage.gap` catches a dead *sink*; a dead *reader* is invisible from inside the app | External uptime monitor calling `/api/internal/detect` — §10, manual |
| Delivery is email | `alertOps()` reaches an inbox, not a phone. A 6-hour deadline that starts at 02:00 depends on someone reading mail | Point `OPS_ALERT_TO` at a PagerDuty/Opsgenie intake (R-16 names who) |

## 10. Incident detection (R-03)

The read side of this store. CERT-In Direction 2 gives **6 hours from noticing**, so
something has to look: `GET /api/internal/detect` runs on a Vercel Cron every 5 minutes,
asks Postgres for the current alert candidates in one round trip
(`audit_log_alerts()`), applies the rule table in `Insert-Go Website/lib/detect.ts`, and
pages `OPS_ALERT_TO` through `lib/alert.ts`. Five minutes is immaterial against a
six-hour deadline, which is why no queue and no new service were added.

**Where the decisions live.** SQL reports facts only — one aggregate per candidate
group, plus when that group was last paged. Every threshold, cooldown and Annexure I
mapping is in `lib/detect.ts`, because a rule that never fires and a rule that always
fires look identical in production and the difference has to be reachable by a unit test
(`lib/detect.test.ts` asserts both sides of every threshold).

| Rule | Fires at | Annexure I type |
|---|---|---|
| `critical` | any 1 `severity='critical'` row | Unauthorised access to IT systems / data |
| `auth.signin.ip` | 10 failed sign-ins from one address / 10 min | Identity theft, spoofing and phishing |
| `auth.signin.account` | 5 failed sign-ins against one account / 10 min | Identity theft, spoofing and phishing |
| `burst.billing.webhook.signature_invalid` | 5 / 10 min *(dormant — written as critical)* | Unauthorised access to IT systems / data |
| `burst.ai.replay_refused` | 20 / 10 min *(dormant — written as critical)* | Attacks on applications such as API |
| `burst.db.permanent_failure` | 5 / 10 min | Attacks on servers and network devices |
| `coverage.gap` | **fewer than 1** event in 24h | Logging failure — Direction 4 evidence at risk |

`coverage.gap` is inverted on purpose: silence in a log is a failure mode, and it is the
one failure mode that looks exactly like good news.

**Cooldown.** Each page writes an `alert.raised` row, and `audit_log_alerts()` reads
those back as the per-rule cooldown. Without it a live incident re-pages every 5 minutes
until the inbox is unreadable — which is its own kind of silence. It also gives R-17's
incident register a durable record of *when we noticed*, which is the fact the 6-hour
filing turns on. `alert.raised` is always `info`; a detector event that was itself
critical would re-trigger the rule that raised it.

**Sign-in capture.** `lib/auth.ts` records `auth.signin` through Better Auth's
request-level `hooks.after`, not `databaseHooks`: a session row is written only when
authentication succeeds, so a database hook can never see a failure — and failures are
the entire input to the credential-stuffing rules. Failed attempts carry a truncated
SHA-256 of the address as `detail.subject`, never the address itself (R-06).

**Deployment.**

1. Re-run `Insert-Go Website/supabase-audit-log.sql` (idempotent) — it now also creates
   `audit_log_alerts()`.
2. Set `CRON_SECRET` in Vercel (`openssl rand -base64 32`). Vercel sends it as
   `Authorization: Bearer <value>` on every cron invocation; the route answers 503 until
   it is set, because an unauthenticated detector is a free read of the estate's
   security posture.
3. Set `OPS_ALERT_TO` to the R-16 Point of Contact's address — until then, pages fall
   back to `console.error` and nobody is woken.
4. **Confirm the Vercel plan runs minute-level crons.** Hobby coerces every expression
   to once a day, which silently turns a 6-hour obligation into a ~24-hour one. This is
   the one deployment step that can fail without producing any error.
5. Register an external uptime monitor against `/api/internal/detect` (with the bearer
   secret) so the detector's own death is noticed by something outside it.
6. Smoke test: 10 bad-signature webhook POSTs, then invoke the cron path manually —
   expect one page naming `billing.webhook.signature_invalid` and its Annexure I type,
   and exactly one `alert.raised` row in `auditLog`.

## 11. Time synchronisation (R-05)

**Legal basis:** CERT-In Direction 1. Two limbs, and the second is the one that
applies here:

> …shall connect to the NTP Server of NIC or NPL **or with NTP servers traceable to
> these NTP servers**… Entities having ICT infrastructure **spanning multiple
> geographies may use accurate and standard time source other than NPL and NIC**,
> however it is to be ensured that their time source shall not deviate from NPL
> and NIC.

The Edge runtime executes in whichever region is closest to the caller while the
database sits in a single fixed region (`ap-northeast-1` today, `ap-south-1` after the
migration in `subprocessors.md` §2 — **either way** the premise holds, and the current
state spans more geographies rather than fewer), so this estate spans multiple
geographies by
construction and limb 2 governs. NPL India and NIC realise UTC; the managed platforms
below take time from GPS-disciplined atomic stratum-1 sources that realise the same
UTC. Deviation is sub-millisecond, which is what "shall not deviate" asks for. This is
compliance by the directive's own terms, not an exception being claimed.

### 11.1 The clock of record

**Every timestamp that is evidence comes from one clock: the Supabase Postgres
instance.** `auditLog."at"` is `timestamptz default now()` and `audit_log_write()`
does not accept an `at` parameter, so an application server cannot supply the time on
a security event even by mistake. The same is true of `creditLedger."createdAt"` and
of the UTC daily-credit boundary (`supabase-edge-rpc.sql` computes it as
`(now() at time zone 'utc')::date`, not in Node).

That single fact does most of the work Direction 1 exists to do. Ordering within the
180-day window — which a 6-hour filing depends on — is decided by one monotonic
source, so it cannot be corrupted by skew between application instances no matter how
many regions they run in.

### 11.2 Register

| Component | Operator | Time source | Produces retained evidence? |
|---|---|---|---|
| Supabase Postgres (`ap-northeast-1` — see `subprocessors.md` §1; `ap-south-1` after migration) | Supabase on AWS | AWS Time Sync (GPS + atomic, stratum-1, UTC) | **Yes — the clock of record** |
| Vercel Node + Edge runtimes | Vercel | Platform NTP, UTC-traceable | No. Produces session/PKCE expiries and quota window buckets only |
| GitHub Actions `windows-latest` (`.github/workflows/release-windows.yml`) | GitHub | Platform NTP | No. Build only |
| Release code signature | — | **RFC 3161 TSA** `timestamp.acs.microsoft.com` (`src-tauri/sign-windows.ps1:51`) | Externally verifiable, and independent of the runner clock |
| `Insert-Go Windows` desktop | The data principal | The user's machine | No — out of scope, see §2. It transmits no timestamp |
| Dodo Payments | Dodo | Third party | No. Their `webhook-timestamp` is used as a replay bound only |

**No self-managed compute exists in this estate** — no VM, container, log shipper or
scheduler that we operate. There is nothing to point at `samay1.nplindia.org` or
`time.nic.in`, which is why this item is a register and a standing rule rather than a
configuration change. §11.4 is what makes that stay true.

### 11.3 Cross-clock dependencies

Places where a value from one clock is compared against another. Each is stated with
its effect under skew, because "we use NTP" is not an answer to a comparison that
spans two of them.

| Comparison | Clocks | Effect of skew | Verdict |
|---|---|---|---|
| Detector cooldown | ~~Postgres vs Vercel~~ | — | **Removed.** `audit_log_alerts()` now returns `alertedMinutesAgo`, subtracted in Postgres against the clock that wrote the row, so `lib/detect.ts` reads no clock at all |
| Dodo `webhook-timestamp` vs receipt time | Dodo vs Vercel | Absorbed by the ±5-minute tolerance (`lib/dodo.ts:121`); beyond that a legitimate webhook is rejected, which fails closed | Accepted — a replay bound must use the sender's claim |
| `billingEventAt` watermark | Dodo vs Postgres | Last-write-wins by *event* time, which is more correct than delivery order even when the sender's clock is off | Accepted, deliberate |
| `apiUsage."windowStart"` vs `"updatedAt"` | Vercel vs Postgres | The bucket key is entirely Vercel-derived, so the rate limit stays self-consistent; only a human reading both columns would notice | Accepted — not evidence |
| `utcToday()` in the session response | Vercel | Display only. The authoritative debit uses the Postgres UTC date | Accepted — the two can disagree for milliseconds around midnight UTC, and the balance shown is not the balance charged |

### 11.4 Standing rule

**Any new component that writes retained logs, or that supplies a timestamp stored
alongside them, must sync to NIC/NPL or to a source demonstrably traceable to them
*before* it ships, and must be added to §11.2 in the same change.** Concretely:

- Self-managed compute (a VM, a container we operate, a log shipper, a scheduler):
  set `samay1.nplindia.org` and `time.nic.in` as the NTP sources. This is the case
  Direction 1's first limb is written for and no other reading applies.
- A managed platform: record its time source and its traceability in §11.2, as
  above. A stated and reasoned dependency is defensible; an unexamined one is not.
- Prefer, in every case, having the database stamp the row. The cheapest way to
  satisfy Direction 1 is to keep the number of clocks that can produce evidence at
  one — §11.1 is the design, not an accident.
