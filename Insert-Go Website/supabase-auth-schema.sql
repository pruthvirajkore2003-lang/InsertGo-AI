-- InsertGo.AI — Better Auth schema (v1.6.x) for Supabase Postgres.
-- Generated from the live plugin config in lib/auth.ts
-- (core + email-otp + sso + device-authorization + bearer).
--
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Column names are camelCase and quoted — Better Auth's default naming.

create table if not exists "user" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  -- Billing entitlements (server-authoritative; written only by the Dodo
  -- webhook handler and admin SQL — never by any client-settable auth field).
  "subscriptionStatus" text not null default 'trial',  -- trial | subscribed | expired
  "credits" integer not null default 50
);

-- Idempotent migration for databases provisioned before the billing columns
-- existed (safe to re-run; matches the defaults in the create table above).
alter table "user" add column if not exists "subscriptionStatus" text not null default 'trial';
alter table "user" add column if not exists "credits" integer not null default 50;

-- 3-tier model (free/plus/pro) + non-expiring add-on credit packs.
-- Daily allowance (5/50/150 by tier, lib/entitlements.ts TIER_DAILY_CREDITS)
-- resets lazily at 00:00 UTC: a "dailyCreditsDate" older than the current UTC
-- date is treated as used=0 by the debit CTE in lib/usageLimit.ts — no cron.
alter table "user" add column if not exists "tier" text not null default 'free';           -- free | plus | pro
alter table "user" add column if not exists "addOnCredits" integer not null default 0;     -- purchased packs, never expire
alter table "user" add column if not exists "dailyCreditsUsed" integer not null default 0;
alter table "user" add column if not exists "dailyCreditsDate" date not null default (now() at time zone 'utc')::date;

-- Watermark for the last billing event APPLIED to this row (event time from the
-- webhook payload, not delivery time). Webhook delivery is at-least-once and
-- unordered: without this, a retried "subscription.active" landing after the
-- "subscription.cancelled" that followed it would hand back a paid tier for
-- free. The tier UPDATE in app/api/billing/webhook refuses writes older than
-- the watermark. Null = never stamped, so the first event always applies.
alter table "user" add column if not exists "billingEventAt" timestamptz;

-- One-time ledger migration (safe to re-run — both statements are self-guarding):
--  * legacy subscribed users land on the top tier of the new model;
--  * any legacy monthly "credits" balance folds into non-expiring add-on
--    credits so no existing session loses value mid-migration.
update "user" set "tier" = 'pro' where "subscriptionStatus" = 'subscribed' and "tier" = 'free';
update "user" set "addOnCredits" = "addOnCredits" + "credits", "credits" = 0 where "credits" > 0;

create table if not exists "session" (
  "id" text primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
  "id" text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table if not exists "verification" (
  "id" text primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

-- @better-auth/sso — registered OIDC/SAML identity providers
create table if not exists "ssoProvider" (
  "id" text primary key,
  "issuer" text not null,
  "oidcConfig" text,
  "samlConfig" text,
  "userId" text references "user" ("id") on delete cascade,
  "providerId" text not null unique,
  "organizationId" text,
  "domain" text not null
);

-- Desktop sign-in (Authorization Code + PKCE, lib/desktopAuth.ts) needs no
-- table of its own: authorization codes live in "verification" for 5 minutes
-- and are consumed atomically. The old device-authorization flow is gone.
drop table if exists "deviceCode";

-- Per-user API quota counters for /api/ai/generate (fixed-window rate limit).
-- One row per (user, action, window bucket); an atomic upsert in
-- lib/usageLimit.ts increments "count" and reads it back in a single statement,
-- so concurrent requests can't double-spend. Run once in the Supabase SQL editor
-- (same as the rest of this file).
create table if not exists "apiUsage" (
  "key" text primary key,                 -- `${userId}:${action}:${windowStart}`
  "userId" text not null references "user" ("id") on delete cascade,
  "count" integer not null default 0,
  "windowStart" bigint not null,          -- epoch-second bucket start
  "updatedAt" timestamptz not null default now()
);

-- Credit ledger for /api/ai/generate: one row per credit debit, keyed by the
-- client's Idempotency-Key header. The atomic CTE in lib/usageLimit.ts
-- inserts the key and debits the daily/add-on pools in one statement, so a
-- network retry replaying the same key is served without a second charge and
-- concurrent requests can't double-spend (the primary key arbitrates).
-- Add-on pack purchases are also recorded here (key `dodo:<webhook-id>`,
-- negative "amount" = credits granted) so webhook retries can't double-credit
-- and the account page can list purchases.
-- The key is NAMESPACED with the verified user id by the route
-- (`${userId}:${clientKey}`) before it ever reaches SQL: this primary key is
-- global, so a bare client-supplied key would let one account claim — and
-- replay — a row belonging to another.
create table if not exists "creditLedger" (
  "idempotencyKey" text primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  "amount" integer not null default 1,
  "replays" integer not null default 0,
  "createdAt" timestamptz not null default now()
);

-- How many times this key has been replayed after its charge. A replay serves a
-- fresh generation WITHOUT debiting (that is the point: a client that timed out
-- and never saw its response must still get one), so without a cap one charged
-- key buys unlimited generations for the whole replay window. The route refuses
-- past GEN_MAX_REPLAYS.
alter table "creditLedger" add column if not exists "replays" integer not null default 0;

-- Hot-path indexes
create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");
create index if not exists "ssoProvider_domain_idx" on "ssoProvider" ("domain");
create index if not exists "apiUsage_userId_idx" on "apiUsage" ("userId");
create index if not exists "creditLedger_userId_idx" on "creditLedger" ("userId");

-- Better Auth (and the app's own pool in lib/db.ts) talk to these tables
-- directly via the DATABASE_URL role. Lock them away from Supabase's
-- anon/authenticated PostgREST roles:
revoke all on "user", "session", "account", "verification", "ssoProvider", "apiUsage", "creditLedger"
  from anon, authenticated;

-- Second layer, because the revoke above is an ENUMERATED denylist on a platform
-- that grants by default: Supabase ships
-- `alter default privileges in schema public grant all on tables to anon,
-- authenticated`, so the next table anyone adds (a migration, a table made in
-- Studio) is PostgREST-readable with the publishable anon key until someone
-- remembers to extend the list. RLS with NO policies is deny-all, so a forgotten
-- revoke stops being an exposure.
--
-- `enable`, never `force`: this app connects as the table OWNER (Better Auth's
-- pool, the account page, the billing webhook) and owners bypass RLS unless it
-- is forced. `force row level security` here would lock the application out of
-- its own database.
alter table "user"         enable row level security;
alter table "session"      enable row level security;
alter table "account"      enable row level security;
alter table "verification" enable row level security;
alter table "ssoProvider"  enable row level security;
alter table "apiUsage"     enable row level security;
alter table "creditLedger" enable row level security;

-- Make deny-by-default the standing rule for tables that do not exist yet.
alter default privileges in schema public revoke all on tables from anon, authenticated;
