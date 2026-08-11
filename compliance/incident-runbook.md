# Incident runbook — dual-clock breach response

**Remediation item:** R-17. **Depends on:** R-03 (detection — code complete),
R-16 (CERT-In Point of Contact — **open, and this runbook cannot be executed
without it**).
**Legal basis:** CERT-In Directions No. 20(3)/2022 **Direction 2** (report within
**6 hours** of noticing); DPDP Act 2023 §8(6) and the DPDP Rules (intimate the
Data Protection Board without delay; detailed report within **72 hours**).
**Owner:** CERT-In Point of Contact (primary + backup, R-16).
**Last rehearsed:** never — see §8.

---

## 0. The one mistake this document exists to prevent

**Do not make the CERT-In filing wait on the personal-data assessment.**

The two clocks start together at detection and measure different things:

| | CERT-In | Data Protection Board |
|---|---|---|
| Triggered by | **Any** Annexure I cyber incident | A **personal-data** breach only |
| Deadline | **6 hours** from noticing | Without delay; detailed report ≤ **72 hours** |
| Needs to know whether personal data was affected? | **No** | Yes, by definition |

Determining whether personal data was affected routinely takes longer than six
hours. So a runbook with a single triage gate feeding both tracks misses the
CERT-In window **by design, in every incident**, while looking methodical. Two
owners, two gates, evaluated concurrently.

**Corollary, and it is counter-intuitive under pressure: file CERT-In on partial
facts.** Completeness is not a filing precondition, supplements are expected,
and six hours is not extendable. The instinct to wait until the picture is clear
is the instinct that breaches Direction 2.

---

## 1. Roles

Fill these in from R-16 before this document is usable. A single-person PoC is a
missed deadline the first time it lands while that person is on a flight.

| Role | Name | Contact | Backup |
|---|---|---|---|
| CERT-In Point of Contact (owns the 6-hour track) | *(R-16)* | *(R-16)* | *(R-16)* |
| Privacy owner (owns the DPB track) | *(R-16)* | | |
| Grievance Officer (data-principal comms) | *(name to be appointed)* | grievance@insertgo.ai | |

---

## 2. T+0 — What counts as "noticing"

Direction 2 runs from **noticing**, not from occurrence. The clock starts at the
earliest of:

- a page from the R-03 detector (`app/api/internal/detect`, every 5 minutes);
- a `severity='critical'` row appearing in `auditLog`;
- a processor telling us (R-18 contracts require this within 24 hours);
- any human noticing — a support ticket, a user email, a security researcher.

**Write down the wall-clock time of the earliest of these and put it at the top
of the incident record.** Everything downstream is measured from it, and
reconstructing it later always produces a later time than the truth.

The last bullet is the one that bites. An incident found weeks later in a
support ticket was, on the regulator's reading, noticed *then* — the filing is
late by weeks and the 180-day log window may already have rolled past the
evidence.

---

## 3. T+0 to T+30 min — Both tracks start, in parallel

Do these concurrently. Do **not** sequence them.

### 3.1 Immediate (either owner)

1. **Freeze the logs.** Exempt the incident window from R-02's 210-day purge —
   `audit_log_purge()` runs daily at 03:17 UTC and its floor is 180 days, so an
   incident older than that is on a clock of its own. Record the window
   (`from`, `to`) in the incident register before doing anything else.
2. **Snapshot the evidence.** `select * from "auditLog" where "at" between …`
   for the window, plus Vercel runtime logs (hours-to-days retention — these are
   the ones that disappear first, so they come first).
3. **Do not remediate yet if remediation destroys evidence.** Rotating a
   credential is fine. Dropping a table, deleting rows, or rebuilding a
   deployment is not, until §3.1.2 is done.

### 3.2 CERT-In track (Point of Contact)

Classify against **Annexure I** and start the filing. The event catalogue in
`Insert-Go Website/lib/auditLog.ts` already carries the mapping — that is what
it is for:

| Observed | Annexure I type |
|---|---|
| `billing.webhook.signature_invalid` burst | Unauthorised access to IT systems; data tampering |
| `auth.signin` failures above threshold | Unauthorised access; identity theft |
| `ai.replay_refused` burst | Attacks on applications (metering bypass) |
| `db.permanent_failure` sustained | Attacks on servers |
| `coverage.gap` (no events for 24h) | **The log sink is down** — Direction 4 exposure in its own right |
| Website defacement / DNS change | Website defacement; DNS compromise |

**File within 6 hours even if §3.3 is unresolved.** Template in §5.

### 3.3 DPB track (privacy owner)

Answer, in this order:

1. Was personal data accessed, disclosed, altered or lost? If **unknown after
   6 hours, that does not delay §3.2** — it delays only this track.
2. Which categories? Cross-reference `compliance/ropa.json` (R-21) — it maps
   every column to a retention class and purpose, which is exactly the
   inventory this question needs and the reason it is generated rather than
   remembered.
3. How many Data Principals, and can they be identified?
4. Likely consequences, and what mitigation is available to them.

Then: **intimate the Board without delay**, and the affected Data Principals
without delay in plain language. Detailed report to the Board within 72 hours.

---

## 4. Data-principal intimation

§8(6) and the Rules require each affected Data Principal to be told, in plain
language: the nature and extent of the breach, when it happened, the likely
consequences, what we are doing about it, what they should do, and a contact
point.

**This is a product surface, not a legal letter, and the template has to exist
before the incident** — writing it under a 72-hour clock produces either legal
boilerplate nobody acts on or an apology that admits the wrong things.

> **Subject: Security incident affecting your InsertGo account**
>
> On *(date)* we discovered that *(plain description — what happened, in one
> sentence, no euphemism)*.
>
> **What was affected:** *(specific categories from ropa.json — "your email
> address and sign-in history", not "certain personal information")*.
> **What was not affected:** *(say this explicitly — e.g. "your drafts and
> prompt library never leave your PC and were not involved"; "we hold no card
> details — payments are handled by Dodo Payments as merchant of record")*.
>
> **What we have done:** *(mitigation already complete, past tense)*.
> **What you should do:** *(concrete, ordered, and only if it is genuinely
> useful — "no action needed" is a legitimate and better answer than invented
> busywork)*.
>
> **Questions:** grievance@insertgo.ai. You may also complain to the Data
> Protection Board of India.

---

## 5. CERT-In filing template (Annexure I)

Send to `incident@cert-in.org.in` from the R-16 Point of Contact address.

```
1.  Reporting entity      : InsertGo.AI
2.  Point of Contact      : (R-16 — name, designation, phone, email)
3.  Date/time NOTICED     : (UTC and IST — this is §2's recorded time)
4.  Date/time OCCURRED    : (best estimate; "under investigation" is acceptable)
5.  Annexure I type       : (from the §3.2 table)
6.  Affected systems      : (e.g. Vercel-hosted Next.js API; Supabase Postgres)
7.  Description           : (partial facts are expected — say what is known)
8.  Impact                : (users affected / data categories / service status)
9.  Actions taken         : (containment, rotation, revocation, with times)
10. Assistance requested  : (usually none)
11. Logs available        : Yes — 180-day audit log, retrievable in the format
                            of compliance/log-retention.md §7
```

**Supplement rather than delay.** Send a follow-up as facts firm up; a late
first filing cannot be cured by a complete one.

---

## 6. Incident register

One row per incident, appended, never edited. Kept beside this file.

| # | Noticed (UTC) | Detected by | Annexure I type | CERT-In filed | DPB intimated | Principals told | Log-freeze window | Closed |
|---|---|---|---|---|---|---|---|---|
| *(none to date)* | | | | | | | | |

The `alert.raised` rows in `auditLog` are the machine-side of this register
(R-03 writes one per page sent). This table is the human side: what was decided,
by whom, and when it was filed.

---

## 7. Known constraints — read these before the incident, not during

1. **The detector cannot detect its own death.** A cron that stops firing raises
   nothing, and `coverage.gap` catches a dead *sink*, not a dead *reader*. The
   external uptime monitor (R-03 open action e) is the only dead-man's switch,
   and until it exists a silent detector is indistinguishable from a quiet week.
2. **Pages go nowhere until `OPS_ALERT_TO` is set** (R-03 open action c). Until
   then `alertOps()` falls back to `console.error`, and the 6-hour clock
   effectively starts whenever someone next reads a platform log.
3. **Vercel Hobby coerces every cron to once a day** (R-03 open action d),
   silently turning a 6-hour obligation into a ~24-hour one. This is the one
   deployment step that fails without producing an error.
4. **The 180-day store is currently in Tokyo, not India** (R-19 §1). Logs are
   producible in full, but the Direction 4 jurisdiction limb is breached until
   the migration lands. If CERT-In orders production during that window, produce
   them and state the position in `subprocessors.md` §2.1 — do not improvise it
   under time pressure.
5. **Processor notification is contractual, not automatic** (R-18, open). Until
   the 24-hour clauses are signed, a processor may take days to tell us, and our
   filings are late through no act of ours and with no defence.

Constraints 1–3 mean **this runbook is not yet executable end to end.** That is
a statement of fact, not a caveat: the gap is in R-03's open actions and R-16,
not in this document.

---

## 8. Rehearsal

**Semi-annual tabletop. An untested 6-hour process is an aspiration.**

Acceptance (R-17): a tabletop exercise produces a complete Annexure I draft in
**under 90 minutes from a cold start, using only this runbook** — no access to
the person who wrote it.

Scenario bank:

1. `billing.webhook.signature_invalid` × 40 in ten minutes from one address.
2. `coverage.gap` fires — no audit events for 24 hours. *(Is this an incident or
   an outage? Both, and Direction 4 exposure either way.)*
3. Supabase tells us a service-role key was exposed in a support ticket.
   *(Tests: R-04's `service_role` revoke, R-01's rotation runbook, and whether
   the 24-hour processor clause exists yet.)*
4. A user emails to say another user's name appeared in their account.
   *(Tests the "noticed by a human" path — the one with no detector at all.)*

Record each rehearsal in §6 with the elapsed time to a complete draft.
