-- InsertGo.AI — credential-at-rest hardening for "session" and "account" (R-04).
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), AFTER
-- supabase-auth-schema.sql. Safe to re-run.
--
-- ⚠ ORDER MATTERS: deploy the application FIRST, then run this file.
-- Section 1 rewrites live session tokens into the form the deployed code looks
-- them up by. Run it before the deploy and every signed-in user is logged out
-- until the deploy lands; run it after, and only the gap between the two costs
-- anything. Both orders fail CLOSED — a mismatch is a 401, never a bypass — so
-- the risk here is availability, not security.
--
-- Why this file exists: RLS is already enabled on all seven tables and
-- anon/authenticated are revoked (supabase-auth-schema.sql:155-179), so the
-- remaining exposure is narrow and sharp — a single READ of "session" or
-- "account" yields live credentials. DPDP §8(5); IT Act §43A with IT Rules 2011
-- Rule 3 (a password is SPDI) and Rule 8; ISO/IEC 27001 A.8.24.

-- ── 1. Hash existing session tokens ────────────────────────────────────────
--
-- lib/sessionTokenHash.ts stores sha256(token) from this deploy onward and
-- hashes the presented token before every lookup, so rows written before it
-- must be converted or their owners get signed out. Hashing them in place is
-- what makes this migration invisible to users: the cookie they already hold
-- still hashes to the value now stored.
--
-- `sha256(bytea)` is core Postgres (11+) — no pgcrypto needed. The WHERE clause
-- is the idempotency guard: a converted row is 64 lowercase hex, a Better Auth
-- token is 32 characters of mixed-case alphanumeric, so the two can never be
-- confused and re-running this converts nothing twice.
update "session"
   set "token" = encode(sha256("token"::bytea), 'hex')
 where "token" !~ '^[0-9a-f]{64}$';

-- ── 2. Purge unused third-party OAuth tokens ───────────────────────────────
--
-- Google's access / refresh / id tokens are credentials for the USER'S GOOGLE
-- ACCOUNT, so a disclosure of this table reaches past InsertGo entirely.
-- Nothing in this codebase reads them — Google is a sign-in lane, not an API we
-- call on the user's behalf (`rg "accessToken|refreshToken|idToken"` over
-- app/, lib/ and components/ returns nothing) — so the DPDP §6 answer is to not
-- hold them at all rather than to hold them well.
--
-- `account.encryptOAuthTokens` (lib/auth.ts) makes everything written from now
-- on AES-256-GCM ciphertext; this statement clears what is already there in
-- cleartext, which would otherwise sit unencrypted until each user next signs
-- in. Better Auth repopulates the columns (encrypted) on the next OAuth
-- callback.
--
-- What is lost: a Google refresh token, once cleared, is only re-issued on a
-- fresh consent with `access_type=offline`. That costs nothing today and would
-- cost a re-consent prompt if this app ever starts calling Google APIs for the
-- user. Skip this statement if that is already planned.
update "account"
   set "accessToken" = null, "refreshToken" = null, "idToken" = null
 where "accessToken" is not null
    or "refreshToken" is not null
    or "idToken" is not null;

-- ── 3. Pin `account.password` to null ──────────────────────────────────────
--
-- Password auth is disabled (lib/auth.ts `emailAndPassword: { enabled: false }`)
-- — OTP / OAuth / SSO only. A password is SPDI under IT Rules 2011 Rule 3,
-- which is the class §43A's deemed-practices regime is written for, so the
-- cheapest possible control is to guarantee one never lands rather than to
-- protect one that might.
--
-- This constraint IS the verification the audit asked for: if any legacy row
-- carries a password hash, the ALTER fails loudly here instead of the question
-- being answered from memory. To enable password auth later, drop the
-- constraint in the same change that flips the flag — that is the point, the
-- decision becomes visible.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'account_password_null_ck'
  ) then
    alter table "account"
      add constraint "account_password_null_ck" check ("password" is null);
  end if;
end;
$$;

-- ── 4. Take the credential tables away from service_role ───────────────────
--
-- `service_role` bypasses RLS, and SUPABASE_SERVICE_ROLE_KEY sits in the Vercel
-- environment for the Edge routes — so that key is precisely the "single
-- read-only disclosure" the finding is about. Nothing needs it here: Better
-- Auth and the Node routes connect as the table OWNER over DATABASE_URL, and
-- every PostgREST call this app makes is a `security definer` RPC, which runs
-- as its owner and is unaffected by table grants (lib/db.ts exposes `rpc()`
-- only — arbitrary SQL cannot be sent over that transport by design).
--
-- Scoped to the three tables that hold credentials rather than all seven: a
-- leaked key reading "creditLedger" is a privacy incident, reading these is an
-- account takeover. "auditLog" deliberately keeps its service_role SELECT for
-- incident response (supabase-audit-log.sql).
revoke all on "session", "account", "verification" from service_role;

-- ── Verify ─────────────────────────────────────────────────────────────────
--
--   select "token" from "session" limit 1;
--     → 64 hex characters. Presenting it as a Bearer token gets hashed again
--       and matches nothing.
--   select "accessToken", "password" from "account" limit 1;
--     → null, or `$ba$`-prefixed ciphertext once a user signs in with Google.
--   select has_table_privilege('service_role', 'session', 'select');
--     → false.
