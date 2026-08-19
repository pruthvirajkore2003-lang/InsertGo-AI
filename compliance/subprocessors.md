# Subprocessor register and cross-border transfer position

**Remediation item:** R-19. **Blocks:** R-02 acceptance (limb d), R-18 (the register
is the input to the contract set).
**Legal basis:** DPDP Act 2023 §8(2) (processor under contract), §16 (cross-border
transfer — negative list); CERT-In Directions No. 20(3)/2022 **Direction 4** (logs
maintained "within the Indian jurisdiction").
**Owner:** Engineering lead / CERT-In Point of Contact (R-16).
**Opened:** 2026-08-08. **Next scheduled check:** 2026-09-08 (monthly, §7).

---

## 1. Finding: the Supabase project is in Tokyo, not Mumbai

**R-02 and `log-retention.md` §1 both assert `ap-south-1` (Mumbai). That assertion is
wrong.** The project is in AWS **`ap-northeast-1` (Tokyo, Japan)**.

Two independent signals, both reproducible with the commands in §6:

| Signal | Value |
|---|---|
| Pooler host in `DATABASE_URL` | `aws-0-**ap-northeast-1**.pooler.supabase.com` |
| `db.ubzepkoghmgcqzycosrg.supabase.co` resolves to | `2406:da14:18fe:3102:…` |
| AWS-published range containing that address (`ip-ranges.json`, `createDate 2026-08-07`) | `2406:da14::/35` → **`ap-northeast-1`** |

The third hextet disambiguates: `2406:da14:8000::/36` is `ap-southeast-7`, and
`0x18fe < 0x8000`, so the address falls in the `/35` that AWS publishes as
`ap-northeast-1`.

This is precisely the state R-19's analysis named as the worst of the three possible:
not an absent control, but **a documented control that does not do what its own policy
says**. `log-retention.md` §1 currently tells a reader — and would tell CERT-In — that
the 180-day store is in India. It is not.

### 1.1 What this breaks

**The jurisdiction limb of CERT-In Direction 4.** The `auditLog` table is the system of
record for the 180-day retention obligation, and it is held outside India. The
retention limb (180-day floor, append-only, purge at 210) is unaffected and still
holds — R-02's SQL and TypeScript are correct and need no change. It is only the
*where* that fails.

R-02's status therefore moves from **Done** to **Blocked on migration**. The code is
finished; the control is not.

### 1.2 What this does not break

Recorded explicitly, so the correction does not cascade further than the facts support:

- **§16 transfers remain lawful.** §16 is a *negative list*: a transfer is permitted
  unless the Central Government restricts the country by notification. Japan is not
  restricted (checked 2026-08-08, §7). Holding personal data in Tokyo is lawful. The
  Direction 4 problem is a *logging* duty, not a *transfer* prohibition, and the two are
  independent — one can be breached while the other is satisfied, which is the case here.
- **R-05 (NTP) survives, and its argument gets stronger.** Its reasoning was that the
  estate "spans multiple geographies by construction", so Direction 1's second limb
  governs. Edge-near-caller plus a database in Tokyo spans more geographies than
  Edge-plus-Mumbai did, not fewer. AWS Time Sync in `ap-northeast-1` is the same
  GPS-disciplined stratum-1 source realising the same UTC, so the sub-millisecond
  deviation claim is unchanged. Only the region string in `log-retention.md` §11.2 was
  wrong. **R-05 stays Done.**
- **The clock of record is unchanged.** One Postgres instance still stamps every piece
  of evidence. Moving the instance does not add a clock.
- **No RBI payment-data localisation duty attaches.** Dodo Payments is merchant of
  record and no card data reaches our systems. Re-test if the payment architecture
  changes.

### 1.3 How the wrong region got asserted

Worth one line, because the mechanism will repeat otherwise. `ap-south-1` was never
read from anything — it was written into `log-retention.md` §1 as the region the design
*required*, and then cited by R-05 §11.2 and R-02's acceptance limb as though it were
an observation. Three documents agreed with each other and none of them agreed with the
`DATABASE_URL` sitting in `.env.local`. The check in §6 exists so the next assertion has
a command behind it.

---

## 2. Remediation decision: migrate the project to `ap-south-1`

**Decision: migrate the Supabase project to `ap-south-1` (Mumbai). Do it now, while the
production deployment is paused.**

Supabase has no in-place region change for an existing project, so the operation is:
create a new project in `ap-south-1` → `pg_dump` / restore → re-run the four SQL files
→ swap `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel →
redeploy. Steps in §3.

The timing is the whole argument. `https://insertgo.com` currently answers **503
`X-Vercel-Error: DEPLOYMENT_PAUSED`** on every route (verified 2026-08-08, §6). The
usual objection to a region migration is the restore window; right now that window
costs nothing, because nothing is being served. **The cheapest moment to do this is
before the deployment resumes**, and the cost rises monotonically from there — with
each signed-in user, each `creditLedger` row and each day of `auditLog` that has to
move.

### 2.1 Rejected alternatives

**Ship only `auditLog` to S3 `ap-south-1` with Object Lock** (`log-retention.md` §6's
documented upgrade path). This would satisfy Direction 4 exactly, and it is
*technically stronger* than any in-database control — COMPLIANCE mode cannot be
shortened by the account root. Rejected because it fixes the narrower problem for more
work: it adds an AWS account, a credential, an IAM policy and a drain receiver, and it
leaves every user's name, address and billing ledger in Tokyo. Migrating the project
fixes Direction 4 *and* moves the personal data, with zero code change and no new
credential. It remains the right answer if the threat model later grows to include a
hostile database owner; that is a separate decision from this one.

**Rely on CERT-In's FAQ latitude** — logs may sit outside India provided they can be
produced to CERT-In on order. This is a real position, not a fiction, and
`log-retention.md` §1 already considered and declined it. It declined it when declining
was free; it is no longer free, so the reasoning is restated rather than assumed: the
latitude is FAQ guidance against directive text that says "within the Indian
jurisdiction", and relying on guidance to excuse non-compliance with the instrument is
a position one defends after an incident rather than one that prevents the finding.

It is nonetheless the **interim position until the migration lands**, and it is written
down for that reason — during the gap the choice is between a stated position and no
position, and an unstated one is indistinguishable from not having noticed. §7 dates
the gap so it cannot quietly become permanent.

**Do nothing and correct the documents to say `ap-northeast-1`.** Rejected: it converts
an honest error into a knowing one. The documents are corrected *and* the migration is
scheduled; correcting them alone would leave a policy that accurately describes a
breach.

### 2.2 Migration steps

**Superseded 2026-08-08 by [`MIGRATION-ap-south-1.md`](./MIGRATION-ap-south-1.md).** The
steps that stood here were written from the repository; the source project was then
enumerated, and two of the hazards they warned about do not exist while one control they
would have destroyed was never in the repository at all:

- **`auditLog` does not exist in the source project.** `supabase-audit-log.sql` has never
  been run — no table, no `audit_log_write`, no append-only trigger. So the "dump it
  before recreating the trigger" hazard cannot occur, and the correction to §1 is
  sharper than §1 states: the 180-day store is not in the wrong country, it is *absent*,
  and the 180-day clock starts when that file first runs on the new project.
- **The double-hashing hazard is retired.** `supabase-session-hardening.sql` has never
  been run either, and the migration carries no `session` rows (31 rows, 29 holding a
  cleartext bearer token — moving them is a worse disclosure than the one that file
  prevents, and the paused deployment makes signing four users out free). Its own guard
  was sound regardless: the predicate is a regex on the stored form and cannot match an
  already-hashed value.
- **An undocumented control was recovered.** Event trigger `ensure_rls`
  (`public.rls_auto_enable()`) was live in Tokyo and in no file in this repository — it
  is the automatic half of the deny-by-default argument in
  `supabase-auth-schema.sql:158-179`. It is now `supabase-rls-auto-enable.sql` and is in
  the run order. This is §8's "a region change at any processor" clause working in
  reverse: the rebuild is what audits the estate.

`pg_dump` is not used — 364 rows, of which 6 are worth carrying; the reasoning per table
is in `MIGRATION-ap-south-1.md` §2. Steps 4–7 above (Vercel swap, §6 re-verify, the
`auth.session.purge` record, delete Tokyo last) are unchanged and are carried into §§5–7
of that document.

Until its §5 passes, R-02's acceptance limb (d) remains unmet and this register's §1
stands as the disclosure.

---

## 3. The register

Ten processors. **R-18 scopes contracts to five** — it does not list the two Upstash
services, which were found while compiling this register (§3.1), nor the three
measurement/advertising processors added on 2026-08-19 with the website's AdSense and
Google Ads integration (§3.2). R-18's acceptance ("signed terms on file for all five")
must be re-scoped to ten.

| # | Entity | Role | Purpose | Personal data categories | Hosting region | Verified | §8(2) contract |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase** (Postgres) | Processor | Primary datastore: identity, sessions, metering, billing ledger, **the 180-day audit log** | Name, email, avatar URL, hashed session tokens, OTP verification rows, usage counters, credit ledger, **client IP + user-agent** (`auditLog`) | **`ap-northeast-1` (Tokyo, JP)** — *non-conforming, see §1; target `ap-south-1`* | ✅ 2026-08-08, two signals (§6) | ❌ R-18 |
| 2 | **Vercel** | Processor | Application hosting; Node + Edge function execution; cron (R-03) | Transits everything above. Prompt text transits and is **not stored** (SPEC §10 — token counts only). Runtime logs are diagnostic, hours-to-days | Edge: near caller, global. Node functions: **project default — unverified** | ⚠️ deployment paused; region not readable from a 503 (§6) | ❌ R-18 |
| 3 | **Google** (Gemini API) | Processor | Managed AI relay: generation, grounding, embeddings | **User prompt text and generated output** — drafts, emails, private writing. The highest-sensitivity data the product touches | Google global; not region-pinned on this API tier | ⚠️ asserted from the API's own terms, not measured | ❌ R-18 |
| 4 | **Upstash** (Vector) | Processor | Shared semantic cache (`lib/semanticCache.ts`) | **Prompt embeddings and cached response text** — a stored response restates the draft it came from. Namespaced per (model, system, **user**) | Index-creation region — **unverified** | ❌ not verified | ❌ **absent from R-18** |
| 5 | **Upstash** (Redis) | Processor | Grounding cache + Edge session memo (`lib/edgeSession.ts`) | Only `{id, subscriptionStatus, credits}` keyed by `sha256(token)`. `narrow()` is a deliberate security boundary — no email, no name, **no session token** | Database-creation region — **unverified** | ❌ not verified | ❌ **absent from R-18** |
| 6 | **Dodo Payments** | **Merchant of record**, not a processor | Checkout, subscriptions, credit packs | Name, email, billing address, payment instrument — **held by Dodo as principal; no card data reaches our systems** | Dodo's own estate | ⚠️ asserted | ❌ R-18 |
| 7 | **Resend** | Processor | Transactional email: sign-in OTP, operator alerts | **Email address, and the OTP code in transit.** Delivery logs on their side | US (AWS) | ⚠️ asserted | ❌ R-18 |
| 8 | **Google** (AdSense + Ads) | Processor for conversion measurement; **independent controller** for ad serving and personalisation | Adverts on public content pages; Google Ads conversion tracking with Enhanced Conversions | Advertising cookies and identifiers, IP, page URL and referrer. On a completed purchase: **order id, order value, and the buyer's email hashed in the browser** (`lib/google-ads.ts`). Nothing reaches it until the `marketing` purpose is granted — Consent Mode v2 defaults are `denied` | Google global | ⚠️ asserted from Google's published terms | ❌ **absent from R-18** |
| 9 | **PostHog** | Processor | Product analytics and input-masked session replay for the website | Page and feature events, device/browser, IP-derived approximate location, masked replay. **Cookie-less (`persistence: "memory"`) until the `analytics` purpose is granted**; ingestion is reverse-proxied through `/_phex` on our own origin | US Cloud (`us.i.posthog.com`) | ⚠️ asserted | ❌ **absent from R-18** |
| 10 | **Vercel** (Web Analytics + Speed Insights) | Processor | Aggregate traffic counts and Core Web Vitals | Page path, referrer, device class, vitals timings. Same entity as row 2, listed separately because it is a **different product with a different data flow** | Vercel global edge | ⚠️ asserted | ❌ **absent from R-18** |

Legend: ✅ verified with a command in §6 · ⚠️ asserted from documentation · ❌ open.

### 3.2 The measurement and advertising rows (added 2026-08-19)

Three things about rows 8–10 that a reader should not have to infer:

1. **Google AdSense is not a pure processor.** For ad serving and personalisation Google
   determines its own purposes, which makes it an independent controller for that limb
   and us a joint discloser — not a controller/processor pair. That is why the row says
   both, and why the notice (`lib/consent.ts`, `marketing`) had to name advertising
   explicitly rather than hide it inside "email me about offers". `NOTICE_VERSION` moved
   1.3.0 → 1.4.0 for it, which re-prompts every existing user through the consent gate.
2. **Nothing in rows 8–10 receives anything before consent.** Consent Mode v2 initialises
   all four signals to `denied` before any Google tag executes
   (`components/analytics/ConsentMode.tsx`); PostHog initialises with in-memory
   persistence and session recording off. The grant comes from the DPDP record
   (`consentRecord`), mirrored to the browser by the two server actions that write it.
3. **Ads are excluded from every authenticated surface** — `/account/*`, `/login`,
   `/consent`, `/desktop/authorize` — by one allowlist consulted by both the loader
   script and every slot (`lib/adPlacement.ts`). The desktop application is unaffected:
   it carries no adverts and no analytics.

### 3.1 Why Upstash was missing

R-18's list of five was drawn from what the audit narrative discussed, not from
`package.json`. `@upstash/redis` and `@upstash/vector` are declared dependencies with a
live code path (`lib/edgeCache.ts`, reached from `/api/ai/generate`), and Upstash Vector
holds **prompt-derived content** — the second-most sensitive category in the estate
after the Gemini flow itself. It is also the only processor documented **only** in
`DEV_SETUP.md:45-46` and not in `.env.example`, which is likely how it stayed invisible:
the file everyone copies when setting the app up does not mention it.

`redis()` and `vectorIndex()` return `null` when unconfigured and every caller degrades
to "no cache", so **whether these are live is per-environment**. That is a
configuration fact, not a code fact, and it is an open verification in §7 — an
unconfigured processor is not a processor, but "probably unset" is not a register entry.

### 3.2 Not subprocessors

- **BYOK provider egress — cancelled 2026-08-08, and it never shipped.** This row
  originally reasoned that user-initiated egress to a self-chosen provider is not a
  transfer by the Data Fiduciary and so does not belong in this register. That
  reasoning stands, but it now has nothing to apply to: there is no BYOK mode, and
  the ~35 provider hosts that were listed in the desktop's Tauri capabilities were
  deleted with the feature (R-15). Every request the desktop makes goes to
  `insertgo.ai`. Kept as a row because "we looked and it is not a subprocessor" and
  "nobody considered it" must not read the same, and because the reasoning is what a
  reviewer needs if this is ever proposed again.
- **The desktop application.** Runs on the data principal's own machine. It ships no
  telemetry SDK — verified 2026-08-08: no Sentry, PostHog, Mixpanel, Amplitude,
  Datadog or Crashlytics anywhere in `src/` or `src-tauri/src/`.
- **GitHub Actions.** Build and release only. Processes no personal data.

---

## 4. Cross-border transfer position (§16)

**§16 uses a negative list.** Transfers are permitted unless the Central Government
restricts a country by notification. As of the check in §7, no notification restricts
Japan, the United States, or any country in §3.

Deliberately **not** produced: Standard Contractual Clauses, adequacy assessments,
transfer impact assessments. Those are GDPR instruments; they answer no obligation
under the DPDP Act, and producing them would create maintenance for paperwork no
Indian regulator asks for while the actual control — a monitored register plus §8(2)
contracts — went unbuilt.

Two limits on that permissiveness, both live here:

1. **Direction 4 is independent of §16.** The in-jurisdiction *logging* duty applies
   regardless of how permissive the *transfer* rule is. §16 is satisfied today;
   Direction 4 is not (§1).
2. **§16 is monitorable, not settled.** A restriction notification can be issued at any
   time and takes effect on its own terms. That is what makes §7 monthly rather than
   annual.

---

## 5. Contract requirements (input to R-18)

Every entity in §3 rows 1–7 needs §8(2) terms. The clause that carries the operational
weight is **breach notification to InsertGo within 24 hours**: both InsertGo clocks —
6 hours to CERT-In, 72 hours to the Data Protection Board — start when *we* notice, so
a processor that takes five days to tell us makes our filings late through no act of
ours and with no defence.

Priority order for R-18, by data sensitivity rather than by vendor size:

1. **Google (Gemini)** — prompt text, the highest-sensitivity category.
2. **Upstash Vector** — prompt-derived content; also needs a region answer.
3. **Supabase** — everything else, plus the audit log.
4. **Resend** — email addresses and OTP codes in transit.
5. **Vercel** — transits all of it, stores little.
6. **Dodo** — MoR, so the instrument is a merchant agreement rather than processor
   terms; confirm which it is before drafting.
7. **Upstash Redis** — least sensitive of the seven by design (`narrow()`).

---

## 6. Verification commands

Every claim marked ✅ in §3 comes from one of these. Run them, do not assume them —
§1.3 is what assuming produced.

**Supabase region (two independent signals; both must agree):**

```bash
# 1. The pooler hostname states the region literally.
grep -o '@[^:/]*' "Insert-Go Website/.env.local"     # → aws-0-<region>.pooler.supabase.com

# 2. Resolve the direct DB host and locate the address in AWS's published ranges.
nslookup db.<project-ref>.supabase.co
curl -s https://ip-ranges.amazonaws.com/ip-ranges.json -o /tmp/aws.json
node -e "const d=require('/tmp/aws.json');console.log(d.createDate);
  console.log(d.ipv6_prefixes.filter(p=>p.ipv6_prefix.startsWith('2406:da14')).map(p=>p.ipv6_prefix+' '+p.region).join('\n'))"
```

Do not use `SUPABASE_URL` for this — `<ref>.supabase.co` is fronted and carries no
region signal. `inet_server_addr()` returns the instance's own address and is a third
signal if the pooler is bypassed.

**Vercel serving region:** `curl -sI https://insertgo.com/ | grep -i x-vercel-id`.
The prefix is the **edge PoP that answered**, not the function region — on a 503 from a
paused deployment it is only the PoP. The function region is a project setting and must
be read from the dashboard (or pinned in code with `export const preferredRegion`).

**Upstash regions:** Upstash console → database/index → Region. Not derivable from the
REST URL. Confirm first whether `UPSTASH_*` is set in the Vercel production environment
at all.

**Desktop telemetry (should return nothing):**

```bash
grep -riE '(sentry|posthog|mixpanel|amplitude|datadog|crashlytics)' \
  "Insert-Go Windows/src" "Insert-Go Windows/src-tauri/src"
```

---

## 7. Check log

Monthly: re-run §6's Supabase region check, and check for §16(1) restriction
notifications. **Recorded either way** — an unrecorded check is indistinguishable from
one that never happened, which is the failure this register exists to prevent.

| Date | Region re-verified | §16(1) restrictions | Notes | By |
|---|---|---|---|---|
| 2026-08-08 | ❌ **`ap-northeast-1`, non-conforming** | None notified affecting §3 | Register opened. Finding §1 raised; migration decided (§2); R-02 moved to Blocked; Upstash added as processors 4–5 | Compliance audit |
| 2026-08-19 | — *(not re-run; this entry adds rows, it does not re-verify §1)* | None notified affecting §3 | Rows 8–10 added: Google AdSense/Ads, PostHog, Vercel Web Analytics + Speed Insights, with the website monetization and analytics work. `NOTICE_VERSION` 1.3.0 → 1.4.0 (§3.2) | Engineering |
| 2026-09-08 | *(due)* | *(due)* | Migration expected complete by this check | |

**Interim position while §1 stands:** the 180-day store is outside India and the
migration is scheduled per §2. If CERT-In orders production of logs before the
migration completes, they are producible in full and within the same timeframe — the
FAQ latitude in §2.1 is the position of record for that window, and only for it.

---

## 8. What voids this register

Any of these makes a row stale, and a stale register is worse than none because it is
an advertised commitment:

- A new dependency that transmits personal data off-machine. **Adding one without a row
  here is the change that is wrong**, not the omission discovered later — §3.1 is what
  that omission costs.
- A region change at any processor, including one the vendor makes.
- A §16(1) restriction notification naming any country in §3.
- Payment architecture changing such that card data touches our systems (re-tests the
  RBI localisation question, §1.2).
- InsertGo being notified as a Significant Data Fiduciary under §10 (R-20) — that
  brings a mandatory DPIA and annual independent audit, and this register becomes an
  audited artifact rather than an internal one.

**Procedure for adding a row:** verify the region with a command, not with the vendor's
marketing page; record the data categories from the code path, not from the vendor's
description of their product; and open the R-18 contract action in the same change.
