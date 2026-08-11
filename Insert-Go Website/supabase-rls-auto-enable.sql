-- InsertGo.AI — auto-enable RLS on every new table in "public".
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), AFTER
-- supabase-auth-schema.sql. Safe to re-run.
--
-- ⚠ THIS FILE IS A RECOVERY. The event trigger below was live in the
-- ap-northeast-1 project and existed in NO file in this repository — it was
-- created by hand in the SQL editor and never written down. It was found only
-- because the ap-south-1 migration enumerated pg_event_trigger before
-- rebuilding (compliance/MIGRATION-ap-south-1.md §1). A control that exists
-- only in one database is a control that dies with that database, and this one
-- would have been silently absent from the new project: event triggers are
-- global objects owned by `postgres`, so they do not travel in a schema-scoped
-- pg_dump either.
--
-- What it does: supabase-auth-schema.sql:158-179 argues that `revoke ... from
-- anon, authenticated` is an ENUMERATED denylist on a platform that grants by
-- default, so the second layer is RLS-with-no-policies (deny-all) on every
-- table. That argument only holds for tables someone remembers to ALTER. This
-- trigger closes the gap for tables nobody remembers: any CREATE TABLE in
-- `public` gets RLS enabled at ddl_command_end, before a single row can be read
-- through PostgREST.
--
-- `enable`, never `force` — same reason as supabase-auth-schema.sql:166-169: the
-- application connects as the table OWNER and owners bypass RLS unless forced.
-- Forcing here would lock the app out of every table it creates.
--
-- The exception handler is deliberate. An event trigger that raises aborts the
-- DDL that fired it, so a table this cannot protect would become a table that
-- cannot be created. Failing open with a LOG line is the right trade: the
-- enumerated revoke in supabase-auth-schema.sql is still underneath it.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
      from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (system schema or not in enforced list: %)',
        cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();

-- ── Verify ─────────────────────────────────────────────────────────────────
--
--   select evtname, evtenabled from pg_event_trigger where evtname = 'ensure_rls';
--     → one row, evtenabled = 'O'.
--
--   create table "rlsProbe" ("id" int);
--   select relrowsecurity from pg_class where relname = 'rlsProbe';   -- → true
--   drop table "rlsProbe";
