-- InsertGo.AI — Edge-runtime RPC surface for /api/ai/generate.
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), AFTER
-- supabase-auth-schema.sql. Safe to re-run.
--
-- Why these exist: the generate route runs on the Edge runtime, which has no
-- TCP sockets, so it reaches Postgres over PostgREST (`lib/db.ts`). PostgREST
-- speaks REST, not SQL — so each of the two metering statements that used to be
-- sent inline from `lib/usageLimit.ts` moves here, verbatim. That is not just a
-- transport detail: both statements are atomic-by-construction, and one HTTP
-- RPC call is exactly one transaction, so the anti-double-spend guarantees are
-- preserved unchanged.
--
-- The daily-allowance caps are NOT hardcoded here. They are passed in from
-- lib/entitlements.ts `TIER_DAILY_CREDITS`, which stays the single source of
-- truth for the tier model (the old inline SQL interpolated them for the same
-- reason).
--
-- Security: both functions are `security definer` (the tables are revoked from
-- anon/authenticated in supabase-auth-schema.sql) and EXECUTE is revoked from
-- PUBLIC and granted only to `service_role`. Postgres grants EXECUTE to PUBLIC
-- on new functions by default, so without that revoke the anon API key could
-- call them.

-- ── Per-user fixed-window quota counter ────────────────────────────────────
-- The increment and the read-back are ONE statement: Postgres serialises
-- conflicting writes on the primary key, so N concurrent requests get N
-- distinct counts — no check-then-write race, correct across any number of
-- Edge instances.
create or replace function public.consume_quota(
  p_key          text,
  p_user_id      text,
  p_window_start bigint
)
returns table ("count" integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into "apiUsage" ("key", "userId", "count", "windowStart", "updatedAt")
  values (p_key, p_user_id, 1, p_window_start, now())
  on conflict ("key") do update
    set "count" = "apiUsage"."count" + 1, "updatedAt" = now()
  returning "count";
$$;

-- ── Atomic credit debit, idempotent on the client's Idempotency-Key ────────
-- Deduction order: daily allowance first (lazy 00:00 UTC reset), add-on packs
-- only once today's allowance is gone (packs never expire, so they must be the
-- last thing spent).
--
--  * `ins` claims the key in "creditLedger" (only while the user has credit
--    left). The primary key arbitrates concurrent duplicates against committed
--    data — snapshot-independent — so exactly one statement per key ever
--    debits. (Update-first would re-check via EvalPlanQual with a stale
--    snapshot and could double-charge a concurrent same-key pair.)
--  * `debit` bumps "dailyCreditsUsed" (stamping today's UTC date) or decrements
--    "addOnCredits", re-checking both conditions on the locked row so N
--    concurrent requests with distinct keys can't overspend either pool.
--  * The final select reads back the pre-statement snapshot plus the age of a
--    pre-existing ledger row, so the route can bound how old a replayed key
--    may be.
--
-- The drain-race cleanup (key claimed, but the locked row turned out to have
-- both pools empty) used to be a second round trip from the app. It is folded
-- in here: same transaction, one less network hop on the failure path, and no
-- window in which an uncharged key survives a crashed caller.
--
-- A REPLAY (the key already exists, so nothing is charged) still serves a full
-- generation upstream — that is what makes a timed-out client's retry whole. It
-- is therefore counted here, in the same transaction, so the route can refuse a
-- key that has been replayed more times than any real retry ever would. Without
-- the counter, one charged key streams unlimited free generations for the whole
-- replay window.
--
-- Zero rows out means "no such user" — the caller throws and fails closed.
--
-- The return type gained "replays", and Postgres refuses to `create or replace`
-- a function whose return type changed — so drop first to keep this file
-- re-runnable. The grants at the bottom are re-applied after every run.
drop function if exists public.debit_credit(text, text, integer, integer, integer);

create or replace function public.debit_credit(
  p_key        text,
  p_user_id    text,
  p_daily_free integer,
  p_daily_plus integer,
  p_daily_pro  integer
)
returns table (
  "tier"               text,
  "subscriptionStatus" text,
  "dailyUsedSnap"      integer,
  "addOnSnap"          integer,
  "debitedUsed"        integer,
  "debitedAddOn"       integer,
  "inserted"           boolean,
  "priorAgeSecs"       integer,
  "replays"            integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_tier            text;
  v_status          text;
  v_daily_used_snap integer;
  v_addon_snap      integer;
  v_debited_used    integer;
  v_debited_addon   integer;
  v_inserted        boolean;
  v_prior_age       integer;
  v_replays         integer := 0;
begin
  with ins as (
    insert into "creditLedger" ("idempotencyKey", "userId")
    select p_key, p_user_id
    where exists (
      select 1
        from "user" u
       where u."id" = p_user_id
         and (
           case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
                then u."dailyCreditsUsed" else 0 end
             < case u."tier" when 'plus' then p_daily_plus
                             when 'pro'  then p_daily_pro
                             else p_daily_free end
           or u."addOnCredits" > 0
         )
    )
    on conflict ("idempotencyKey") do nothing
    returning 1
  ),
  debit as (
    update "user" u
       set "dailyCreditsDate" = (now() at time zone 'utc')::date,
           "dailyCreditsUsed" =
             case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
                  then u."dailyCreditsUsed" else 0 end
             + case when case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
                             then u."dailyCreditsUsed" else 0 end
                         < case u."tier" when 'plus' then p_daily_plus
                                         when 'pro'  then p_daily_pro
                                         else p_daily_free end
                    then 1 else 0 end,
           "addOnCredits" = u."addOnCredits"
             - case when case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
                             then u."dailyCreditsUsed" else 0 end
                         < case u."tier" when 'plus' then p_daily_plus
                                         when 'pro'  then p_daily_pro
                                         else p_daily_free end
                    then 0 else 1 end
     where u."id" = p_user_id
       and exists (select 1 from ins)
       and (
         case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
              then u."dailyCreditsUsed" else 0 end
           < case u."tier" when 'plus' then p_daily_plus
                           when 'pro'  then p_daily_pro
                           else p_daily_free end
         or u."addOnCredits" > 0
       )
    returning u."dailyCreditsUsed", u."addOnCredits"
  )
  select
    u."tier"::text,
    u."subscriptionStatus"::text,
    case when u."dailyCreditsDate" = (now() at time zone 'utc')::date
         then u."dailyCreditsUsed" else 0 end,
    u."addOnCredits",
    (select d."dailyCreditsUsed" from debit d),
    (select d."addOnCredits"     from debit d),
    exists (select 1 from ins),
    (select extract(epoch from now() - cl."createdAt")::int
       from "creditLedger" cl
      where cl."idempotencyKey" = p_key)
    into
      v_tier, v_status, v_daily_used_snap, v_addon_snap,
      v_debited_used, v_debited_addon, v_inserted, v_prior_age
    from "user" u
   where u."id" = p_user_id;

  if not found then
    return; -- no such user: zero rows, caller fails closed (503)
  end if;

  -- Drain race: the key was claimed but the debit saw both pools empty on the
  -- locked row. Release the uncharged key so a later retry (e.g. after a
  -- top-up) can't replay it into a free generation.
  if v_inserted and v_debited_used is null then
    delete from "creditLedger" where "idempotencyKey" = p_key;
  end if;

  -- Nothing was inserted and a row already existed: this call is a replay of an
  -- earlier charge. Count it (same transaction, so concurrent replays of one key
  -- can't share a number) and hand the count back for the route to bound.
  if not v_inserted and v_prior_age is not null then
    update "creditLedger"
       set "replays" = "replays" + 1
     where "idempotencyKey" = p_key
    returning "replays" into v_replays;
  end if;

  return query
    select v_tier, v_status, v_daily_used_snap, v_addon_snap,
           v_debited_used, v_debited_addon, v_inserted, v_prior_age,
           coalesce(v_replays, 0);
end;
$$;

-- Lock both functions to the server-held service role. PUBLIC gets EXECUTE on
-- new functions by default — revoking it is what keeps the anon/authenticated
-- PostgREST keys from calling a `security definer` credit debit.
revoke execute on function public.consume_quota(text, text, bigint)
  from public, anon, authenticated;
revoke execute on function public.debit_credit(text, text, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.consume_quota(text, text, bigint)
  to service_role;
grant execute on function public.debit_credit(text, text, integer, integer, integer)
  to service_role;
