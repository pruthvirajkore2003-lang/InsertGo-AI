-- InsertGo.AI — append-only security audit log (CERT-In Direction 4).
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), AFTER
-- supabase-auth-schema.sql. Safe to re-run.
--
-- Why this exists: CERT-In Directions No. 20(3)/2022 Direction 4 requires logs
-- of all ICT systems to be enabled, maintained securely for a ROLLING 180 DAYS,
-- and held within Indian jurisdiction. Vercel's runtime logs and Supabase's own
-- logs are retained for days, not months, on the plans this project runs on — so
-- neither can be the system of record. This table is.
--
-- Why a Postgres table and not S3 Object Lock: the store must live in Indian
-- jurisdiction, survive a service-role key leak, and be reachable from the Edge
-- runtime (fetch-only, no TCP). The Supabase project already satisfies the first
-- and third, and `security definer` RPC already solves the second for the credit
-- ledger — see supabase-edge-rpc.sql. Reusing that pattern adds no
-- infrastructure, no credential, and no dependency. Object Lock in COMPLIANCE
-- mode is strictly stronger (not even the account root can delete), so it is the
-- documented upgrade path in compliance/log-retention.md, not a rejected idea.
--
-- Jurisdiction depends on the Supabase project region being ap-south-1.
--
-- SATISFIED 2026-08-08. The project was migrated ap-northeast-1 → ap-south-1
-- (compliance/MIGRATION-ap-south-1.md) and the region was verified by two
-- independent signals before this file was run against it. This file first ran
-- on 2026-08-08, which is when the 180-day retention window actually opens —
-- the previous project never had this table at all.

-- ── Table ──────────────────────────────────────────────────────────────────
--
-- NOTE THE ABSENCE OF A FOREIGN KEY on "userId". Every other table in this
-- schema carries `references "user"("id") on delete cascade`. This one must not:
--  * erasure under DPDP §12(3) anonymises the user row (R-12), and a cascade
--    would take the audit history with it — destroying, on request, exactly the
--    records CERT-In requires be retained for 180 days;
--  * an audit trail that a subject can delete is not an audit trail.
-- The audit log is Class B (statutory retention) in the R-12 retention
-- classifier: it is processed to comply with a legal obligation, NOT under
-- consent, so withdrawing consent does not purge it. Say so in the §5 notice.
create table if not exists "auditLog" (
  "id"        bigint generated always as identity primary key,
  "at"        timestamptz not null default now(),
  "event"     text not null,
  "severity"  text not null,
  "outcome"   text not null,
  "userId"    text,                       -- pseudonymous; deliberately no FK
  "ip"        text,                       -- as seen at the edge; CERT-In needs the real value
  "userAgent" text,
  "detail"    jsonb not null default '{}'::jsonb,

  -- Bounded vocabularies: a typo in a caller must fail loudly at write time,
  -- not silently create an event class no alert rule is watching (R-03).
  constraint "auditLog_severity_ck" check ("severity" in ('info', 'warn', 'critical')),
  constraint "auditLog_outcome_ck"  check ("outcome"  in ('success', 'failure', 'denied')),
  -- Trust-boundary caps. `userAgent` and `detail` are attacker-controlled on
  -- every unauthenticated route that writes here; without a ceiling, one client
  -- can inflate the 180-day store until writes fail and logging goes dark —
  -- which is the cheapest way to blind an audit trail.
  constraint "auditLog_event_len_ck"  check (length("event") <= 64),
  constraint "auditLog_ua_len_ck"     check ("userAgent" is null or length("userAgent") <= 512),
  constraint "auditLog_detail_len_ck" check (length("detail"::text) <= 2048)
);

-- Retrieval patterns: a CERT-In request is "everything in this window"; an
-- incident triage is "this event class in this window"; a data-principal
-- grievance is "this user in this window".
create index if not exists "auditLog_at_idx"       on "auditLog" ("at" desc);
create index if not exists "auditLog_event_at_idx" on "auditLog" ("event", "at" desc);
create index if not exists "auditLog_user_at_idx"  on "auditLog" ("userId", "at" desc)
  where "userId" is not null;

-- ── Append-only enforcement ────────────────────────────────────────────────
--
-- Revoking DML is not enough on its own: `service_role` is a superuser-adjacent
-- role in Supabase, so a leaked service key could otherwise rewrite history. The
-- trigger blocks UPDATE and DELETE for EVERY role, including the owner.
--
-- The purge below is the one legitimate deleter, and it opens the gate with a
-- transaction-local GUC. A caller who reaches this database only through
-- PostgREST RPC cannot set that GUC — PostgREST sends no arbitrary SQL — so the
-- gate is only openable from inside audit_log_purge().
--
-- ponytail: this is defence against a leaked application credential, not against
-- a hostile database owner with psql. If the threat model grows to include the
-- latter, the upgrade is shipping these rows to S3 ap-south-1 with Object Lock
-- in COMPLIANCE mode — see compliance/log-retention.md §6.
create or replace function public.audit_log_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if coalesce(current_setting('insertgo.audit_purge', true), 'off') <> 'on' then
    raise exception
      'auditLog is append-only: % refused (CERT-In Direction 4, 180-day retention)',
      tg_op;
  end if;
  return null;  -- statement-level trigger; the DELETE itself proceeds
end;
$$;

drop trigger if exists "auditLog_append_only" on "auditLog";
create trigger "auditLog_append_only"
  before update or delete on "auditLog"
  for each statement execute function public.audit_log_guard();

-- TRUNCATE IS A THIRD STATEMENT, NOT A KIND OF DELETE. `before update or delete`
-- does not fire on it, so the trigger above — described as blocking "EVERY role,
-- including the owner" — was silent on the one statement that empties the whole
-- table at once. Found 2026-08-08 while verifying the ap-south-1 build.
--
-- audit_log_purge() DELETEs and never TRUNCATEs, so this refuses unconditionally
-- in practice while leaving the legitimate retention purge working. It is the
-- braces; the grant below is the belt.
drop trigger if exists "auditLog_no_truncate" on "auditLog";
create trigger "auditLog_no_truncate"
  before truncate on "auditLog"
  for each statement execute function public.audit_log_guard();

-- ── Write ──────────────────────────────────────────────────────────────────
--
-- One HTTP RPC = one INSERT. Called fire-and-forget from lib/auditLog.ts on both
-- runtimes (the Edge routes cannot open a TCP connection, so PostgREST is the
-- only transport available to them).
create or replace function public.audit_log_write(
  p_event      text,
  p_severity   text,
  p_outcome    text,
  p_user_id    text  default null,
  p_ip         text  default null,
  p_user_agent text  default null,
  p_detail     jsonb default '{}'::jsonb
)
returns table ("id" bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into "auditLog" ("event", "severity", "outcome", "userId", "ip", "userAgent", "detail")
  values (
    left(p_event, 64),
    p_severity,
    p_outcome,
    p_user_id,
    p_ip,
    left(p_user_agent, 512),
    coalesce(p_detail, '{}'::jsonb)
  )
  returning "id";
$$;

-- ── Purge ──────────────────────────────────────────────────────────────────
--
-- Retention is a FLOOR, not a target: CERT-In requires 180 days, so the default
-- purge age is 210 to leave a month of margin. `greatest(..., 180)` is the
-- load-bearing line — it makes the statutory floor unshrinkable from the call
-- site, so a mistaken `audit_log_purge(30)` deletes nothing that is still owed.
create or replace function public.audit_log_purge(p_older_than_days integer default 210)
returns table ("deleted" bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(coalesce(p_older_than_days, 210), 180);
  v_n    bigint;
begin
  set local "insertgo.audit_purge" = 'on';
  delete from "auditLog" where "at" < now() - make_interval(days => v_days);
  get diagnostics v_n = row_count;
  return query select v_n;
end;
$$;

-- ── Integrity check ────────────────────────────────────────────────────────
--
-- Monthly verification (compliance schedule): returns one row per day for the
-- retention window. A day with zero rows in a system that authenticates users
-- daily means logging was DOWN, not that nothing happened — the failure mode
-- this check exists to catch, because a silently-broken log drain looks exactly
-- like a quiet month until CERT-In asks for the window.
create or replace function public.audit_log_coverage(p_days integer default 180)
returns table ("day" date, "events" bigint, "criticals" bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    d::date as "day",
    count(l."id")                                            as "events",
    count(l."id") filter (where l."severity" = 'critical')   as "criticals"
  from generate_series(
         (now() - make_interval(days => greatest(coalesce(p_days, 180), 1)))::date,
         now()::date,
         interval '1 day'
       ) as d
  left join "auditLog" l on l."at" >= d and l."at" < d + interval '1 day'
  group by d
  order by d desc;
$$;

-- ── Alert candidates (R-03) ────────────────────────────────────────────────
--
-- CERT-In Direction 2 runs from NOTICING an incident. A log nobody reads never
-- notices, so the clock never starts — which sounds like safety and is the
-- opposite: the incident is deemed noticed whenever it is eventually found, and
-- the filing is late by however long that took. This function is the read side.
--
-- It reports FACTS ONLY — one aggregate per candidate group, plus when that
-- group was last paged. Thresholds and cooldowns live in lib/detect.ts, not
-- here, for one reason: a rule that never fires and a rule that always fires
-- look identical in production, so the decision has to sit somewhere a unit test
-- can reach. Adding a rule is a row in that table plus a branch below.
--
-- `p_lookback_minutes` bounds the search for prior 'alert.raised' rows; it must
-- be >= the longest cooldown in lib/detect.ts or that rule's cooldown silently
-- shortens to this value.
--
-- The cooldown is returned as AGE IN MINUTES rather than as a timestamp, so the
-- subtraction happens here against the same `now()` that wrote the row. The
-- caller runs on Vercel and the log lives in Supabase — two managed clocks —
-- and comparing one platform's timestamp against the other's `Date.now()` is a
-- cross-clock dependency the detector does not need to carry (R-05).
create or replace function public.audit_log_alerts(
  p_window_minutes   integer default 10,
  p_lookback_minutes integer default 1440
)
returns table (
  "rule"              text,
  "subject"           text,
  "events"            bigint,
  "since"             timestamptz,
  "alertedMinutesAgo" double precision
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with w as (
    select now() - make_interval(mins => greatest(coalesce(p_window_minutes, 10), 1)) as t0
  ),
  cand as (
    -- Anything critical, grouped by event. Threshold 1 in lib/detect.ts: these
    -- are declared critical at the call site precisely because one is enough.
    select 'critical'::text as "rule", l."event" as "subject",
           count(*) as "events", min(l."at") as "since"
      from "auditLog" l, w
     where l."at" >= w.t0 and l."severity" = 'critical'
     group by l."event"

    union all

    -- Failed sign-ins by source address — credential stuffing sprays one
    -- password across many accounts from few addresses, so the IP is the group
    -- that shows it. `ip` is null for server-side calls with no inbound request.
    select 'auth.signin.ip', coalesce(l."ip", '(unknown)'),
           count(*), min(l."at")
      from "auditLog" l, w
     where l."at" >= w.t0 and l."event" = 'auth.signin'
       and l."outcome" in ('failure', 'denied')
     group by coalesce(l."ip", '(unknown)')

    union all

    -- Failed sign-ins by account — the other shape: one account attacked from
    -- many addresses. `detail->>'subject'` is a truncated SHA-256 of the address
    -- (lib/auth.ts); the address itself must never reach this table (R-06).
    select 'auth.signin.account', l."detail" ->> 'subject',
           count(*), min(l."at")
      from "auditLog" l, w
     where l."at" >= w.t0 and l."event" = 'auth.signin'
       and l."outcome" in ('failure', 'denied')
       and l."detail" ->> 'subject' is not null
     group by l."detail" ->> 'subject'

    union all

    -- Named warn-class bursts. `severity <> 'critical'` is load-bearing: today
    -- signature_invalid and replay_refused are written as critical, so the first
    -- rule already pages on them and this one must not page a second time for
    -- the same rows. It stays as the belt for the day a call site is demoted.
    select 'burst.' || l."event", l."event", count(*), min(l."at")
      from "auditLog" l, w
     where l."at" >= w.t0 and l."severity" <> 'critical'
       and l."event" in (
         'billing.webhook.signature_invalid',
         'ai.replay_refused',
         'db.permanent_failure'
       )
     group by l."event"

    union all

    -- The detector's own health. A day with zero rows in a system that
    -- authenticates users daily means logging is DOWN, not that nothing
    -- happened — and a silently-broken sink is indistinguishable from a quiet
    -- month right up until CERT-In asks for the window. This row is always
    -- emitted; lib/detect.ts inverts it (fires on too FEW, not too many).
    select 'coverage.gap', 'auditLog', count(*), null::timestamptz
      from "auditLog" l
     where l."at" >= now() - interval '24 hours'
  )
  select
    c."rule", c."subject", c."events", c."since",
    (select extract(epoch from now() - max(a."at")) / 60
       from "auditLog" a
      where a."event" = 'alert.raised'
        and a."at" >= now() - make_interval(mins => greatest(coalesce(p_lookback_minutes, 1440), 1))
        and a."detail" ->> 'rule' = c."rule"
        and a."detail" ->> 'subject' is not distinct from c."subject") as "alertedMinutesAgo"
    from cand c;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
--
-- Postgres grants EXECUTE to PUBLIC on new functions by default, so without the
-- revoke the anon API key could call them — the same trap supabase-edge-rpc.sql
-- documents. No role gets table-level DML: writes go through the function or not
-- at all.
-- `service_role` MUST BE IN THE REVOKE LIST, and was not until 2026-08-08.
-- Supabase ships `alter default privileges in schema public grant all on tables
-- to service_role`, so this table was created with service_role already holding
-- INSERT/UPDATE/DELETE/TRUNCATE. A GRANT is ADDITIVE — the `grant select` below
-- never took those away, so the comment that used to sit on it ("DML still
-- blocked by the trigger") described an intent the grants did not implement.
-- Revoking first is what makes the next line the whole of service_role's access.
-- supabase-session-hardening.sql is the only other file that gets this right.
revoke all on table "auditLog" from public, anon, authenticated, service_role;
grant select on table "auditLog" to service_role;   -- read for incident response; no DML at all

-- `anon, authenticated` MUST BE NAMED HERE. Revoking from PUBLIC alone does not
-- work on Supabase and left every function below callable unauthenticated over
-- /rest/v1/rpc/<fn> until 2026-08-08 — audit_log_purge deletes from the CERT-In
-- log, audit_log_write forges entries. The platform ships
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
-- so those roles hold EXECUTE **directly**, and a revoke aimed at PUBLIC does
-- not touch a direct grant. supabase-edge-rpc.sql:216-219 named all three and
-- was the only file the linter never flagged.
revoke all on function public.audit_log_write(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.audit_log_purge(integer) from public, anon, authenticated;
revoke all on function public.audit_log_coverage(integer) from public, anon, authenticated;
revoke all on function public.audit_log_alerts(integer, integer) from public, anon, authenticated;
revoke all on function public.audit_log_guard() from public, anon, authenticated;
grant execute on function public.audit_log_write(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.audit_log_purge(integer) to service_role;
grant execute on function public.audit_log_coverage(integer) to service_role;
grant execute on function public.audit_log_alerts(integer, integer) to service_role;

-- ── Scheduled purge ────────────────────────────────────────────────────────
--
-- pg_cron is available on Supabase but not enabled by default. If this block is
-- skipped, the table simply grows — which is safe (over-retention never breaches
-- Direction 4) but should be corrected: enable the extension in
-- Dashboard → Database → Extensions → pg_cron, then re-run this file.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('insertgo-audit-log-purge')
      where exists (select 1 from cron.job where jobname = 'insertgo-audit-log-purge');
    perform cron.schedule(
      'insertgo-audit-log-purge',
      '17 3 * * *',                       -- 03:17 UTC daily, off the billing-webhook peak
      $job$ select public.audit_log_purge(210) $job$
    );
  else
    raise notice 'pg_cron not installed — audit log purge NOT scheduled. Enable pg_cron and re-run.';
  end if;
end;
$$;
