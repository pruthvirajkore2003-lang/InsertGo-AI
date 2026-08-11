-- InsertGo.AI — consent artifact, data-principal requests, and erasure.
-- Remediation items R-09 (consent), R-10 (withdrawal), R-11 (rights + 90-day
-- SLA), R-12 (two-class retention), R-14 (age declaration).
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), AFTER
-- supabase-auth-schema.sql and supabase-audit-log.sql. Safe to re-run.
--
-- Naming: camelCase quoted identifiers, matching "auditLog" / "creditLedger" /
-- "apiUsage" in this schema. The remediation plan writes these as
-- `consent_record` / `dsr_request`; one convention per schema beats matching a
-- prose document, and every reference to them is generated from lib/consent.ts.

-- ═══ 1. Consent record (R-09) ══════════════════════════════════════════════
--
-- DPDP §6 puts the burden of PROVING valid consent on the Data Fiduciary. A
-- boolean on "user" cannot discharge it: it records that a box was ticked, not
-- which notice was shown, when, for what purpose, or in what language. When the
-- notice text changes — and it will — every prior consent becomes unverifiable
-- unless the version was captured at the time.
--
-- Hence: one row per (user, purpose, decision), NEVER updated. A withdrawal is
-- a NEW ROW, not an edit. If withdrawing rewrote the grant, the act of
-- withdrawing would destroy the evidence that consent had ever been validly
-- obtained — which is the one record a regulator asks for after a complaint.
--
-- NO FOREIGN KEY on "userId", for the same reason as "auditLog": this is
-- evidence, and a §12(3) erasure must not be able to delete the proof that
-- processing was lawful while it was happening. Class B in the §3 classifier.
create table if not exists "consentRecord" (
  "id"            bigint generated always as identity primary key,
  "at"            timestamptz not null default now(),
  "userId"        text not null,             -- deliberately no FK; see above
  "purpose"       text not null,
  "granted"       boolean not null,          -- false = withdrawal, as a new row
  "noticeVersion" text not null,             -- lib/consent.ts NOTICE_VERSION
  "language"      text not null default 'en',
  "method"        text not null,             -- how the decision was collected
  "ip"            text,
  "userAgent"     text,

  -- Bounded vocabularies. A typo must fail at write time, not silently create a
  -- purpose that /account/privacy never shows a toggle for — which would be a
  -- consent nobody can withdraw, i.e. the §6(4) breach this file exists to
  -- prevent. The list is mirrored in lib/consent.ts and asserted by its tests.
  constraint "consentRecord_purpose_ck" check ("purpose" in (
    'account', 'billing', 'ai_processing', 'analytics', 'marketing', 'age_18_plus'
  )),
  constraint "consentRecord_method_ck" check ("method" in (
    'web_consent_gate', 'web_account_settings', 'desktop_onboarding', 'operator'
  )),
  constraint "consentRecord_version_len_ck" check (length("noticeVersion") <= 32),
  constraint "consentRecord_lang_len_ck"    check (length("language") <= 8),
  constraint "consentRecord_ua_len_ck"      check ("userAgent" is null or length("userAgent") <= 512)
);

create index if not exists "consentRecord_user_at_idx"
  on "consentRecord" ("userId", "at" desc);
-- Serves consent_current(): latest decision per (user, purpose).
create index if not exists "consentRecord_user_purpose_at_idx"
  on "consentRecord" ("userId", "purpose", "at" desc);

-- ═══ 2. Data-principal requests (R-11) ═════════════════════════════════════
--
-- §§11–14 rights with the DPDP Rules' 90-day response window.
--
-- "dueAt" IS NOT A GENERATED COLUMN, and that is not a shortcut. R-11 specified
-- `generated always as ("createdAt" + interval '90 days') stored`; Postgres
-- REFUSES it, because a stored generated column requires an IMMUTABLE
-- expression and `timestamptz + interval` is STABLE (verified:
-- `select provolatile from pg_proc where proname='timestamptz_pl_interval'`
-- returns 's'). The property R-11 actually wanted is "the database sets the
-- clock, not a developer remembering to", and a DEFAULT plus a CHECK gives
-- exactly that: the default supplies it, the CHECK makes any other value
-- impossible, and dsr_create() below is the only writer anyway.
create table if not exists "dsrRequest" (
  "id"          bigint generated always as identity primary key,
  "createdAt"   timestamptz not null default now(),
  "dueAt"       timestamptz not null default (now() + interval '90 days'),
  "userId"      text not null,               -- deliberately no FK; see §1
  "kind"        text not null,
  "status"      text not null default 'open',
  -- Acting on an UNVERIFIED erasure request is itself a personal data breach:
  -- an impostor who can delete someone's account has caused exactly the harm
  -- the right exists to prevent. erase_user() refuses without this stamp.
  "verifiedAt"  timestamptz,
  "fulfilledAt" timestamptz,
  "note"        text,

  constraint "dsrRequest_kind_ck" check ("kind" in (
    'access', 'correction', 'erasure', 'grievance', 'nomination'
  )),
  constraint "dsrRequest_status_ck" check ("status" in (
    'open', 'verified', 'fulfilled', 'refused'
  )),
  -- The 90-day window is the statute's, not the caller's.
  constraint "dsrRequest_due_ck" check ("dueAt" = "createdAt" + interval '90 days'),
  constraint "dsrRequest_note_len_ck" check ("note" is null or length("note") <= 2048)
);

-- The ageing report (compliance schedule, monthly) reads exactly this shape:
-- open requests by due date. Partial, because fulfilled requests are the
-- overwhelming majority over time and never appear in it.
create index if not exists "dsrRequest_open_due_idx"
  on "dsrRequest" ("dueAt")
  where "status" in ('open', 'verified');
create index if not exists "dsrRequest_user_idx" on "dsrRequest" ("userId");

-- ═══ 3. Append-only enforcement ════════════════════════════════════════════
--
-- Same guard as "auditLog": the trigger blocks UPDATE and DELETE for EVERY
-- role including the owner, because `service_role` is superuser-adjacent in
-- Supabase and a leaked service key must not be able to rewrite consent
-- history. "dsrRequest" is deliberately NOT under this guard — a request's
-- status legitimately advances open → verified → fulfilled, so it is mutable
-- by design and its history lives in "auditLog" (dsr.request / dsr.fulfilled).
create or replace function public.consent_record_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception
    'consentRecord is append-only: % refused (DPDP §6 — a withdrawal is a new row, not an edit)',
    tg_op;
end;
$$;

drop trigger if exists "consentRecord_append_only" on "consentRecord";
create trigger "consentRecord_append_only"
  before update or delete on "consentRecord"
  for each statement execute function public.consent_record_guard();

-- TRUNCATE does not fire `before update or delete` — same gap as "auditLog",
-- found 2026-08-08. Without this, the append-only guarantee held against every
-- statement except the one that empties the table in a single shot.
drop trigger if exists "consentRecord_no_truncate" on "consentRecord";
create trigger "consentRecord_no_truncate"
  before truncate on "consentRecord"
  for each statement execute function public.consent_record_guard();

-- ═══ 4. Write consent (R-09, R-10, R-14) ═══════════════════════════════════
--
-- One call records one decision. Grant and withdrawal are the same operation
-- with a different `p_granted` — there is deliberately no separate withdraw
-- function, because two code paths is how one of them ends up doing an UPDATE.
create or replace function public.consent_write(
  p_user_id        text,
  p_purpose        text,
  p_granted        boolean,
  p_notice_version text,
  p_method         text,
  p_language       text default 'en',
  p_ip             text default null,
  p_user_agent     text default null
)
returns table ("id" bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into "consentRecord" (
    "userId", "purpose", "granted", "noticeVersion", "language", "method", "ip", "userAgent"
  )
  values (
    p_user_id, p_purpose, p_granted, left(p_notice_version, 32),
    left(coalesce(p_language, 'en'), 8), p_method, p_ip, left(p_user_agent, 512)
  )
  returning "id";
$$;

-- Current state = the LATEST row per purpose. Reading the whole history and
-- folding it in application code would work too, and would put the definition
-- of "current" in two places the first time anything else needs it.
create or replace function public.consent_current(p_user_id text)
returns table (
  "purpose"       text,
  "granted"       boolean,
  "noticeVersion" text,
  "at"            timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct on (c."purpose")
         c."purpose", c."granted", c."noticeVersion", c."at"
    from "consentRecord" c
   where c."userId" = p_user_id
   order by c."purpose", c."at" desc, c."id" desc;
$$;

-- ═══ 5. Data-principal requests (R-11) ═════════════════════════════════════

-- `p_verified` is how identity verification is RECORDED, not assumed. A request
-- raised from an authenticated web session is verified by definition — holding
-- a live session is control of the account — so the caller passes true and says
-- so in the note. A request arriving by email to the Grievance Officer is not,
-- and stays unverified until a human establishes who sent it. erase_user()
-- refuses to run against an unverified erasure row, so this flag is the whole
-- difference between a right being exercised and an account being taken over.
create or replace function public.dsr_create(
  p_user_id  text,
  p_kind     text,
  p_note     text default null,
  p_verified boolean default false
)
returns table ("id" bigint, "dueAt" timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into "dsrRequest" ("userId", "kind", "note", "verifiedAt", "status")
  values (
    p_user_id, p_kind, left(p_note, 2048),
    case when p_verified then now() end,
    case when p_verified then 'verified' else 'open' end
  )
  returning "id", "dueAt";
$$;

create or replace function public.dsr_fulfil(p_id bigint, p_note text default null)
returns table ("id" bigint, "fulfilledAt" timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  update "dsrRequest"
     set "status" = 'fulfilled',
         "fulfilledAt" = now(),
         "note" = left(coalesce(p_note, "note"), 2048)
   where "id" = p_id
  returning "id", "fulfilledAt";
$$;

-- Ageing report for the monthly compliance check. Escalation is at day 75, not
-- day 89: a request that turns out to need legal input needs it with time left,
-- and a 90-day SLA managed by hand becomes a 91-day SLA.
create or replace function public.dsr_ageing(p_escalate_after_days integer default 75)
returns table (
  "id"          bigint,
  "kind"        text,
  "status"      text,
  "ageDays"     integer,
  "dueInDays"   integer,
  "escalated"   boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select d."id", d."kind", d."status",
         extract(day from now() - d."createdAt")::integer,
         extract(day from d."dueAt" - now())::integer,
         now() - d."createdAt" >= make_interval(days => greatest(coalesce(p_escalate_after_days, 75), 1))
    from "dsrRequest" d
   where d."status" in ('open', 'verified')
   order by d."dueAt";
$$;

-- ═══ 6. Erasure — the two-class classifier (R-12) ══════════════════════════
--
-- THE MOST DANGEROUS OPERATION IN THIS SCHEMA, because the naive version looks
-- correct and passes its own test. `delete from "user" where id = ?` satisfies
-- an erasure request, returns success, and silently destroys the "creditLedger"
-- rows that are BOOKS OF ACCOUNT under the Companies Act, GST and income-tax
-- rules — every table in supabase-auth-schema.sql carries
-- `on delete cascade`. One compliance obligation, executed correctly, destroys
-- another, in a single statement, with no warning.
--
-- §8(7) erasure and §17(1) statutory retention are not actually in conflict
-- once the data is classified; they apply to different rows:
--
--   Class A — consent basis, PURGE:   session, verification, account, apiUsage,
--                                     and the identity columns of "user"
--   Class B — statutory hold, RETAIN: creditLedger (books of account),
--                                     auditLog (CERT-In Direction 4),
--                                     consentRecord (proof consent was valid),
--                                     dsrRequest (proof the request was handled)
--
-- Hence the load-bearing rule: **NEVER DELETE THE "user" ROW.** Anonymise in
-- place so the foreign key survives, Class B rows stay intact and joinable, and
-- the ledger retains only a pseudonymous "userId".
--
-- This must also be STATED IN ADVANCE (R-13): a subject told "we erase
-- everything" who then finds a retained ledger has been misled; one whose
-- notice itemises the statutory-retention class has been informed.
create or replace function public.erase_user(
  p_user_id text,
  p_dsr_id  bigint default null
)
returns table (
  "userAnonymised"    boolean,
  "sessionsDeleted"   bigint,
  "accountsDeleted"   bigint,
  "apiUsageDeleted"   bigint,
  "verificationsDeleted" bigint,
  "ledgerRetained"    bigint,
  "auditRetained"     bigint,
  "consentRetained"   bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_sessions bigint; v_accounts bigint; v_usage bigint; v_verif bigint;
  v_ledger bigint; v_audit bigint; v_consent bigint;
begin
  -- Identity verification precedes execution, and is recorded. Acting on an
  -- unverified request is itself a breach (see "verifiedAt" above), so this
  -- refuses rather than trusting its caller — the caller is an HTTP route.
  if p_dsr_id is not null then
    if not exists (
      select 1 from "dsrRequest"
       where "id" = p_dsr_id and "userId" = p_user_id
         and "kind" = 'erasure' and "verifiedAt" is not null
    ) then
      raise exception
        'erase_user: DSR % is not a verified erasure request for this user', p_dsr_id;
    end if;
  end if;

  select "email" into v_email from "user" where "id" = p_user_id;
  if v_email is null then
    raise exception 'erase_user: no such user';
  end if;

  -- Class B counts are read BEFORE the purge and returned, so the acceptance
  -- test can assert that they did not change. That assertion is the whole point
  -- of this function: it is the regression that would otherwise ship.
  select count(*) into v_ledger  from "creditLedger"  where "userId" = p_user_id;
  select count(*) into v_audit   from "auditLog"      where "userId" = p_user_id;
  select count(*) into v_consent from "consentRecord" where "userId" = p_user_id;

  -- ── Class A: purge ──
  delete from "session"  where "userId" = p_user_id;
  get diagnostics v_sessions = row_count;
  delete from "account"  where "userId" = p_user_id;
  get diagnostics v_accounts = row_count;
  delete from "apiUsage" where "userId" = p_user_id;
  get diagnostics v_usage = row_count;
  -- "verification" is keyed by IDENTIFIER (the email), not by userId — it holds
  -- OTP hashes and desktop PKCE authorization codes. A userId-only sweep would
  -- leave live sign-in material behind for an address that no longer has an
  -- account, which is the one leftover that could re-authenticate.
  delete from "verification" where "identifier" = v_email or "identifier" like '%' || v_email;
  get diagnostics v_verif = row_count;

  -- ── The "user" row: anonymise in place, never delete ──
  -- A unique-constrained placeholder address keeps the column's UNIQUE index
  -- satisfiable for repeat erasures, and `@invalid` is reserved by RFC 2606 so
  -- it can never route anywhere.
  update "user"
     set "name"          = '[erased]',
         "email"         = 'erased+' || p_user_id || '@invalid',
         "emailVerified" = false,
         "image"         = null,
         "erasedAt"      = now(),
         "updatedAt"     = now()
   where "id" = p_user_id;

  return query select
    true, v_sessions, v_accounts, v_usage, v_verif, v_ledger, v_audit, v_consent;
end;
$$;

-- "erasedAt" marks an anonymised row so nothing later mistakes it for an
-- ordinary account — a sign-in attempt, a re-consent prompt, a billing retry.
alter table "user" add column if not exists "erasedAt" timestamptz;
create index if not exists "user_erasedAt_idx" on "user" ("erasedAt")
  where "erasedAt" is not null;

-- ═══ 7. Grants ═════════════════════════════════════════════════════════════
--
-- Postgres grants EXECUTE to PUBLIC on new functions by default, so without the
-- revoke the anon API key could call them — consent_write() under anon would
-- let anyone forge a consent record, and erase_user() would be a remote account
-- wipe. Same trap supabase-edge-rpc.sql and supabase-audit-log.sql document.
-- `service_role` must be revoked explicitly: Supabase's default privileges have
-- already granted it ALL on every new table in public, and a GRANT is additive,
-- so `grant select` alone leaves INSERT/UPDATE/DELETE/TRUNCATE in place. Same
-- defect as supabase-audit-log.sql carried until 2026-08-08 — and on this table
-- it would mean a leaked service key could forge or destroy the consent
-- evidence that DPDP §6 puts the burden of producing on us.
revoke all on table "consentRecord", "dsrRequest" from public, anon, authenticated, service_role;
grant select on table "consentRecord", "dsrRequest" to service_role;

alter table "consentRecord" enable row level security;
alter table "dsrRequest"    enable row level security;

-- `anon, authenticated` MUST BE NAMED HERE — revoking from PUBLIC alone does
-- NOT work on Supabase, because the platform's default privileges grant EXECUTE
-- to those roles DIRECTLY and a revoke aimed at PUBLIC leaves a direct grant in
-- place. Until 2026-08-08 this file's comment above described a control it did
-- not implement: erase_user was callable unauthenticated over
-- /rest/v1/rpc/erase_user, and because `p_dsr_id` defaults to null the verified
-- -DSR check is skipped entirely on that path — a remote account wipe by id,
-- which is precisely the outcome the comment names as unacceptable.
revoke all on function public.consent_write(text, text, boolean, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.consent_current(text) from public, anon, authenticated;
revoke all on function public.dsr_create(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.dsr_fulfil(bigint, text) from public, anon, authenticated;
revoke all on function public.dsr_ageing(integer) from public, anon, authenticated;
revoke all on function public.erase_user(text, bigint) from public, anon, authenticated;
revoke all on function public.consent_record_guard() from public, anon, authenticated;

grant execute on function public.consent_write(text, text, boolean, text, text, text, text, text) to service_role;
grant execute on function public.consent_current(text) to service_role;
grant execute on function public.dsr_create(text, text, text, boolean) to service_role;
grant execute on function public.dsr_fulfil(bigint, text) to service_role;
grant execute on function public.dsr_ageing(integer) to service_role;
grant execute on function public.erase_user(text, bigint) to service_role;
