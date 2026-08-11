# Supabase migration: `ap-northeast-1` → `ap-south-1`

**Unblocks:** R-02 acceptance limb (d) — the jurisdiction limb of CERT-In Direction 4,
the only breached duty in the register. **Supersedes** `subprocessors.md` §2.2, which was
written before the source project was enumerated and assumes facts that are not true
(§1 below). **Owner:** Engineering lead. **Opened:** 2026-08-08.

Source project: `ubzepkoghmgcqzycosrg` (`ap-northeast-1`), PostgreSQL 17.6.
Target project: `mxmqzcogjavtxexcwdjh` — created 2026-08-08, **region unverified until §3's
gate runs**. The ref is recorded here and not treated as evidence of anything: §1.3 of
`subprocessors.md` is the record of what happens when an intended region is written down
and then cited as an observation.
Region confirmed a third time from inside the database — `inet_server_addr()` returns
`2406:da14:18fe:3102:…`, the same `2406:da14::/35` AWS publishes as `ap-northeast-1`
that `subprocessors.md` §1 resolved externally. Three independent signals now agree.

---

## 1. Verified state of the source project

Read out of the live database on 2026-08-08, not from the repository. **Four findings
changed the procedure**, and each one made it smaller or safer:

| # | Finding | Effect on the plan |
|---|---|---|
| a | **`auditLog` does not exist.** Neither the table nor `audit_log_write` / `audit_log_purge` / `audit_log_coverage` / `audit_log_alerts`. `supabase-audit-log.sql` has never been run. | §2.2 step 2's central hazard — "dump `auditLog` before recreating its append-only trigger, else the restore is refused by its own control" — **cannot occur**. There is no table, no trigger, and no row to move. |
| b | **`supabase-session-hardening.sql` has never been run.** 31 session rows, of which only 2 are hashed (those two written by deployed `lib/sessionTokenHash.ts`); `account` still holds Google OAuth tokens in cleartext on 2 rows; `account_password_null_ck` absent; `service_role` still holds SELECT on `session`, `account` and `verification`. | §2.2 step 3's hazard — "double-hashing signs every user out" — is **retired by not carrying sessions** (§2). The guard was sound regardless: `where "token" !~ '^[0-9a-f]{64}$'` is a regex on the stored form and cannot match an already-hashed value. Verified against the live table: 31 rows, exactly 2 match, both correctly skipped. |
| c | **The schema is behind the repository.** `creditLedger` has no `replays` column (`supabase-auth-schema.sql:142`), and the live `debit_credit` is the pre-`replays` version that does not reference it. `supabase_migrations` is empty — every change was applied by hand. | Not a migration risk; a migration *benefit*. Re-running the files on a fresh project brings the database up to the code. Do not carry the drift forward. |
| d | **An undocumented security control was live in Tokyo and in no file in this repository:** event trigger `ensure_rls` on `ddl_command_end`, owned by `postgres`, running `public.rls_auto_enable()` — it enables RLS on every new table in `public`. | Recovered verbatim into **`Insert-Go Website/supabase-rls-auto-enable.sql`** and added to the run order (§3b). Event triggers are global objects owned by `postgres`; a schema-scoped `pg_dump` would not have carried it either, so this would have been silently lost by the original procedure too. |

Also true, and carried forward deliberately:

- **No RLS policies exist on any table.** That is the design, not a gap — RLS is enabled
  with zero policies, which is deny-all, and the application connects as the table owner
  (`supabase-auth-schema.sql:158-176`). Nothing to migrate.
- **Installed extensions:** `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
  `supabase_vault`. All are Supabase defaults on a new project. **`pg_cron` is not
  installed** — which is why the audit-log purge has never been scheduled either (§3d).
- **`supabase-consent-dsr.sql` has never been run**, although `lib/consent.ts` exists.
  Same class of drift as (a). Added to the run order (§3f) — see the note there.

### 1.1 Closing inventory: everything the source does *not* contain

Finding (d) is the reason this section exists. One control was live and unwritten; the
only way to know it was the *only* one is to enumerate exhaustively rather than to stop
at the first surprise. Read out of the live database on 2026-08-08, immediately before
read access to the source was given up:

| Object class | Source | Consequence |
|---|---|---|
| Storage buckets / objects | 0 / 0 | No object migration. |
| `auth.users` / `auth.identities` | 0 / 0 | Supabase Auth is unused — identity is Better Auth in `public`. Nothing in `auth` to carry. |
| `vault.secrets` | 0 | No encrypted secrets pinned to the old project ref. |
| Custom schemas | 0 | Everything the application owns is in `public`. |
| Views, matviews, foreign tables in `public` | 0 | The 7 tables are the whole surface. |
| Custom types (enum / domain) | 0 | Bounded vocabularies are `check` constraints, not enums — they travel in the DDL. |
| Row-level triggers, all schemas | 5, **all platform-owned** | `storage.buckets`/`objects` (4, `supabase_storage_admin`) and `realtime.subscription` (1, `supabase_realtime_admin`). A new project recreates all five. **None are ours** — `ensure_rls` is an *event* trigger in a different catalog, which is precisely why enumerating `pg_trigger` alone would have missed it. |
| Publications | 1 (`supabase_realtime`), **zero tables** | No realtime replication to reconstruct. |
| `supabase_migrations` | empty | No migration history to replay — see (c). The rebuild should create one (§3). |

Nothing outside `public` needs to move. That is the finding, and it is what makes §2's
6-row carry-over complete rather than merely small.

> **The register understates the position.** `subprocessors.md` §1 says the 180-day audit
> store is *in the wrong country*. Finding (a) says it **does not exist**: `lib/auditLog.ts`
> writes fire-and-forget to an RPC that returns 404, so the CERT-In log has zero rows,
> in any jurisdiction. Migrating the region does not fix that by itself — **running
> `supabase-audit-log.sql` (§3d) is what starts the log**, and the 180-day clock starts
> from that run, not from today. Record that date in `subprocessors.md` §7.

---

## 2. Why there is no `pg_dump` step

`subprocessors.md` §2.2 step 2 specifies `pg_dump` / restore. Two facts make that the
wrong tool here:

1. **Neither `pg_dump`, `psql`, nor Docker is available on this machine** (the Supabase
   CLI is installed and would shell out to a `supabase/postgres` container for
   `supabase db dump`). Installing a Postgres client to move this dataset is not
   proportionate.
2. **The dataset is 364 rows, and only 6 of them are worth carrying.** Full source
   inventory: `user` 4, `account` 2, `session` 31, `apiUsage` 173, `creditLedger` 154,
   `verification` 0, `ssoProvider` 0.

What is carried, and the reasoning for each drop, is written into the header of
`seed-ap-south-1.sql` rather than repeated here. The two decisions that need review:

- **`session` (31 rows) is dropped, so every user signs in again.** 29 of those rows hold
  a live bearer token *in cleartext* (finding b). Carrying them means writing 29 working
  credentials to a file on disk and pasting them through a browser SQL editor — a worse
  disclosure than the one `supabase-session-hardening.sql` exists to prevent. The cost of
  dropping them is currently zero: `insertgo.com` answers `503 DEPLOYMENT_PAUSED` on every
  route, so no live session is interrupted, and there are four users. **This is the same
  reasoning §2.2's own timing argument uses** — do it while nothing is being served.
- **`creditLedger` (154 rows) is dropped.** Verified at source: **zero** rows with a
  `dodo:` key and **zero** rows with `amount < 0` — no purchase and no credit grant is
  recorded in this table, only debit/idempotency rows from development traffic, whose
  replay windows closed weeks ago. Balances live on `user` and **are** carried; total
  credit value is asserted unchanged at 154 by the check in §4. **If a purchase row ever
  exists this reasoning expires** and the ledger must be carried in full.

`apiUsage` (173 rows) is expired fixed-window rate-limit buckets; carrying them
re-creates dead rows. `verification` and `ssoProvider` are empty.

---

## 3. Execution

Steps 3a–3g all run in the **new** project's SQL Editor. Nothing here writes to Tokyo —
the source stays untouched and intact until §7, which is what makes §6 a real rollback.

**0. Create the project.** Supabase dashboard → New project → **same organisation** →
region **`ap-south-1` (Mumbai)** → Postgres **17** (match the source's 17.6). Record the
new project ref. Do this before anything else; the rest of this document assumes it exists.

**Verify the region before loading anything into it.** A wrong region found now costs a
deleted empty project; found after cutover it costs this whole procedure again:

```sql
select inet_server_addr()::text;
```

The address must **not** fall in `2406:da14::/35`. Confirm it positively against
`https://ip-ranges.amazonaws.com/ip-ranges.json` — the `ipv6_prefixes` entry containing
it must read `"region": "ap-south-1"`. Also check the pooler hostname on the connection
string page reads `aws-0-ap-south-1.pooler.supabase.com`. **Both signals must agree**,
per `subprocessors.md` §6; §1.3 of that document is the record of what assuming produced.

**Enable `pg_cron` now**, before 3d: Dashboard → Database → Extensions → `pg_cron`. The
purge block at the end of `supabase-audit-log.sql` is a no-op without it, and skipping it
is how the source project ended up with no scheduled purge.

Then run these files, in this order, each pasted whole into a new SQL Editor query:

| | File | Notes |
|---|---|---|
| a | `Insert-Go Website/supabase-auth-schema.sql` | Creates the 7 tables. Its two ledger-migration `UPDATE`s are no-ops here (empty tables) and are re-applied by 3e. |
| b | `Insert-Go Website/supabase-rls-auto-enable.sql` | **New file — the control recovered in finding (d).** Must run after 3a and before any later `CREATE TABLE`, so that 3d and 3f get RLS automatically. |
| c | `Insert-Go Website/supabase-edge-rpc.sql` | `consume_quota`, `debit_credit`. Installs the current `replays` version, closing drift (c). |
| d | `Insert-Go Website/supabase-audit-log.sql` | Creates `auditLog` and starts the CERT-In 180-day log **for the first time** (finding a). Watch for `NOTICE: pg_cron not installed` — if it appears, enable the extension and re-run this file. |
| e | `compliance/migration.local/seed-ap-south-1.sql` — **not in git**, ignored by `.gitignore:11` (`*.local`), verified with `git check-ignore` | The 6 carried rows plus the re-applied ledger fold. Runs **after** 3d so the tables exist, and **before** 3f so hardening acts on real rows. |
| f | `Insert-Go Website/supabase-consent-dsr.sql` | **Addition to `subprocessors.md` §2.2's four-file list.** `lib/consent.ts` is in the deployed code and its tables have never existed (§1). Its own header requires it run after 3a and 3d, which is satisfied here. Omit it only if R-09–R-14 are being deliberately deferred — but then the new project inherits the same drift the migration is the opportunity to clear. |
| g | `Insert-Go Website/supabase-session-hardening.sql` | **Last, and now unconditionally safe.** §1 hashes nothing (no sessions carried). §2 nulls OAuth tokens already null in the seed. §3's `account_password_null_ck` passes — verified at source that zero rows carry a password. §4 revokes `session`/`account`/`verification` from `service_role`. |

> `supabase-session-hardening.sql:6-11` warns "deploy the application FIRST, then run this
> file". That ordering constraint protects live sessions from being invalidated by the
> hash rewrite. There are no live sessions on the new project — 3e carries none — so the
> constraint is vacuous here and 3g runs before the Vercel cutover, not after.

---

## 4. Verify the target before cutover

One query. Every column must match the expected value; **stop and diagnose on any
mismatch** — do not proceed to §5.

```sql
select
  (select count(*) from "user")                                                as users,                  -- 4
  (select count(*) from "account")                                             as accounts,               -- 2
  (select sum("credits" + "addOnCredits") from "user")                         as credit_value,           -- 154
  (select count(*) from "account"
     where coalesce("accessToken","refreshToken","idToken","password") is not null) as leaked_credentials, -- 0
  (select count(*) from "session")                                             as sessions,               -- 0
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='auditLog')                    as audit_table,            -- 1
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='creditLedger'
       and column_name='replays')                                              as replays_col,            -- 1
  (select count(*) from pg_trigger where tgname='auditLog_append_only')        as append_only_trigger,    -- 1
  (select count(*) from pg_event_trigger where evtname='ensure_rls')           as rls_event_trigger,      -- 1
  (select count(*) from pg_constraint where conname='account_password_null_ck') as password_constraint,   -- 1
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)      as tables_without_rls,     -- 0
  (select count(*) from pg_policies where schemaname='public')                 as policies,               -- 0 (deny-all by design)
  has_table_privilege('service_role','"session"','select')                     as sr_reads_session,       -- false
  has_table_privilege('service_role','"account"','select')                     as sr_reads_account,       -- false
  has_table_privilege('service_role','"auditLog"','select')                    as sr_reads_auditlog;      -- true (incident response)
```

Then prove the append-only control actually bites, rather than assuming it from the file:

```sql
delete from "auditLog" where false;
-- expected: ERROR ... auditLog is append-only: DELETE refused (CERT-In Direction 4, ...)
```

A `DELETE` that succeeds means the trigger did not install. That is a blocking failure —
the control is the whole reason this table is the system of record.

Finally, run `get_advisors` (security) against the new project and confirm it returns
nothing that the source did not.

### 4.1 Result of the 2026-08-08 run, and what verification caught

The build ran clean on the first pass and **every expected value in §4 matched** — 4 users,
2 accounts, credit value 154 identical to source, 0 sessions, 0 leaked credentials,
`auditLog` present, `replays` present, both append-only triggers, `ensure_rls`,
`account_password_null_ck`, 0 tables without RLS, 0 policies, purge scheduled under
`pg_cron`, and `service_role` reading `auditLog` but not `session`/`account`.

Verification then found **three defects that were in the SQL files, not in the
migration** — none of which had ever been observable, because these files had never been
run anywhere (§1 findings a and b). Building the project is what executed them for the
first time, and the linter is what read the result back.

**(i) `service_role` held TRUNCATE on the append-only evidence tables.** Supabase ships
`alter default privileges in schema public grant all on tables to service_role`, so
`auditLog`, `consentRecord` and `dsrRequest` were created with `service_role` already
holding INSERT/UPDATE/DELETE/TRUNCATE. Both files then say `grant select ... to
service_role` — and a GRANT is **additive**, so it never removed any of it. The comment
in `supabase-audit-log.sql` ("read for incident response; DML still blocked by the
trigger") described an intent the grants did not implement.

**(ii) The append-only trigger did not cover TRUNCATE.** `before update or delete` does
not fire on TRUNCATE — it is a third statement class, not a kind of DELETE. So the guard
described as blocking "EVERY role, including the owner" was silent on the single
statement that empties the whole table. Combined with (i), the CERT-In 180-day log was
one statement from gone by a path the design states is closed. Not reachable through
PostgREST, which sends no arbitrary SQL — but the control was weaker than its own
documentation.

**(iii) CRITICAL — every `security definer` function was callable unauthenticated.**
`supabase-audit-log.sql` and `supabase-consent-dsr.sql` both `revoke all on function ...
from public`, and both name the exact risk in their comments. That revoke does not work
on Supabase: the platform grants EXECUTE to `anon` and `authenticated` **directly**, and
revoking from PUBLIC does not touch a direct grant. Reachable over `/rest/v1/rpc/<fn>`
with the publishable anon key:

- **`erase_user`** — `p_dsr_id` defaults to null, which skips the verified-DSR check
  entirely. Any account anonymisable by id, unauthenticated. This is the R-12 erasure
  path being usable as an attack.
- **`audit_log_purge`** — deletes from the 180-day CERT-In log.
- **`audit_log_write`** — forge or flood entries, including burying real ones under the
  2048-char `detail` cap.
- **`consent_write` / `dsr_create` / `dsr_fulfil`** — forge the DPDP §6 consent evidence
  and the request record that proves it was handled.
- **`consent_current` / `dsr_ageing` / `audit_log_coverage` / `audit_log_alerts`** — read
  any user's compliance state.

`supabase-edge-rpc.sql` is the counter-example that proves the mechanism: it writes
`from public, anon, authenticated`, and `consume_quota`/`debit_credit` were the only two
definer functions the linter did not flag.

Fixed in migrations `append_only_close_truncate_gap`, `lock_definer_functions_from_anon`
and `lock_trigger_guard_functions`, and back-ported to the source files so the repository
and the database agree — leaving them apart would recreate exactly the drift finding (c)
is about. `supabase-auth-schema.sql` now also carries
`alter default privileges in schema public revoke execute on functions from anon,
authenticated`, mirroring the line it already had for tables, so the next definer function
someone adds is not world-callable until a reviewer notices.

**Post-fix advisor state:** 10 × INFO `rls_enabled_no_policy`, which is the deliberate
deny-all design (`supabase-auth-schema.sql:158-176`), and nothing at WARN or above.

> **This is a finding about the Tokyo project too, and about R-02's acceptance.** The
> files were sound in intent and wrong in three statements, and nothing caught it because
> nothing had ever run them. Any acceptance limb that reads "the SQL is correct" is
> evidence about a file, not about a database. §4's query and `get_advisors` are what
> make the difference, and they belong in the monthly check in `subprocessors.md` §7.

---

## 5. Cutover

In Vercel → project → Settings → Environment Variables → **Production**, replace:

- `DATABASE_URL` — new pooler connection string. Keep the existing `sslmode` and any
  query parameters; only host, credentials and project ref change.
- `SUPABASE_URL` — `https://<new-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — new project's service role key.

`SUPABASE_CA_CERT` is unchanged: same Supabase Root 2021 CA.

Do **not** edit these while the old values are still serving traffic anywhere — the
deployment is paused, which is what makes this a clean swap rather than a cutover with a
split-brain window. Redeploy, then re-run `subprocessors.md` §6's checks against the
deployed app.

**Rotate the Tokyo service-role key** once §6 passes and before §7. It has sat in a
Vercel environment and in this migration's working context; it is dead weight the moment
the swap lands, and a dead credential that still works is the cheapest possible incident.

---

## 6. Rollback

Available in full until §7, and only until §7. Tokyo is untouched by everything above:
its data, schema and keys are exactly as they were. Rollback is restoring the three
environment variables to the Tokyo values and redeploying. The only unrecoverable
consequence of a rollback is the 31 dropped sessions — those users sign in again either
way, which is the cost already accepted in §2.

---

## 7. Teardown, and the record

**Delete the Tokyo project only after §5's verification passes**, not after §4's. A
deleted source with an unverified target is the one failure mode that loses evidence
(`subprocessors.md` §2.2 step 7).

Before deleting:

- Delete `compliance/migration.local/`. It carries the personal data of four data
  principals and has no reason to outlive the migration. Being gitignored is what keeps
  it out of history; being deleted is what keeps it off the disk.
- Emit an `auth.session.purge` audit event recording that 31 sessions were dropped by
  operator action. The event exists in the catalogue and an action of that size belongs
  in the record — this is `subprocessors.md` §2.2 step 6, which applies here for the
  session *drop* rather than for a double-hash.

Then update, in `subprocessors.md`:

- **§1** — delete the finding, or rewrite it as history. Do not leave it standing.
- **§2.2** — replaced by this document.
- **§3 row 1** — hosting region → `ap-south-1` (Mumbai, IN), verified date, two signals.
- **§7** — a new row: region re-verified `ap-south-1`, Tokyo project deleted on <date>,
  and **the date `supabase-audit-log.sql` first ran**, which is when the 180-day window
  actually opens.
- **`log-retention.md` §1 and §11.2** — the assertions §1.3 identified as never having
  been read from anything. They become true on completion of this document; make them
  true *by verification*, with the §6 command output recorded, not by editing the string.

Also correct `supabase-audit-log.sql:21-29`, whose header carries the
`AS OF 2026-08-08 IT IS NOT` breach notice. Its own instruction is that the note goes
once the project moves.
