#!/usr/bin/env node
/**
 * Record of Processing Activities, generated from the schema (R-21).
 *
 * DPDP §8(1) accountability requires knowing what is processed and why. A
 * hand-maintained record drifts from the schema within weeks — this audit is
 * its own evidence, since several of its initial findings were wrong precisely
 * because the schema had not been read exhaustively before conclusions were
 * drawn.
 *
 * So the RoPA is generated, and the classification is gated:
 *
 *   node scripts/ropa.mjs check    → exit 1 if any column is unclassified
 *   node scripts/ropa.mjs emit     → write compliance/ropa.json
 *
 * The control is `check`. A new column with no entry in CLASSIFICATION below
 * fails CI, so a personal-data column cannot reach production without someone
 * deciding — in the same pull request — what purpose it serves, how long it is
 * kept and whether it survives an erasure request. Discovering that at the next
 * audit is the outcome this replaces.
 *
 * Deliberately not a real SQL parser: the input is four files we control, all
 * written in one narrow dialect. A dependency to parse our own DDL would be
 * more code to maintain than the twenty lines below, and it would still need
 * the classification table, which is the part that carries the meaning.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SQL_FILES = [
  "Insert-Go Website/supabase-auth-schema.sql",
  "Insert-Go Website/supabase-audit-log.sql",
  "Insert-Go Website/supabase-consent-dsr.sql",
];

/**
 * Retention classes (R-12).
 *   A — consent / service basis. Purged on an erasure request.
 *   B — statutory hold. Survives erasure, and R-13's notice must say so.
 *   N — not personal data. Still listed, because "we looked and it isn't"
 *       and "nobody looked" must not be the same state.
 */
const CLASSIFICATION = {
  user: {
    id: ["N", "Pseudonymous identifier; retained to keep Class B rows joinable"],
    name: ["A", "Account — display"],
    email: ["A", "Account — sign-in and service email"],
    emailVerified: ["A", "Account — sign-in"],
    image: ["A", "Account — display"],
    createdAt: ["A", "Account"],
    updatedAt: ["A", "Account"],
    subscriptionStatus: ["B", "Billing — legacy entitlement stamp"],
    credits: ["B", "Billing — legacy balance"],
    tier: ["B", "Billing — entitlement"],
    addOnCredits: ["B", "Billing — purchased balance"],
    dailyCreditsUsed: ["A", "Service — daily quota counter"],
    dailyCreditsDate: ["A", "Service — daily quota window"],
    billingEventAt: ["B", "Billing — webhook ordering watermark"],
    erasedAt: ["B", "Evidence that erasure was performed and when"],
  },
  session: {
    id: ["A", "Account — session"],
    expiresAt: ["A", "Account — session"],
    token: ["A", "Credential (SHA-256 hashed at rest, R-04)"],
    createdAt: ["A", "Account — session"],
    updatedAt: ["A", "Account — session"],
    ipAddress: ["A", "Account — session provenance"],
    userAgent: ["A", "Account — session provenance"],
    userId: ["A", "Account — session"],
  },
  account: {
    id: ["A", "Account — federated identity"],
    accountId: ["A", "Account — provider subject id"],
    providerId: ["A", "Account — provider name"],
    userId: ["A", "Account — federated identity"],
    accessToken: ["A", "Third-party credential (AES-256-GCM, R-04)"],
    refreshToken: ["A", "Third-party credential (AES-256-GCM, R-04)"],
    idToken: ["A", "Third-party credential (AES-256-GCM, R-04)"],
    accessTokenExpiresAt: ["A", "Account — federated identity"],
    refreshTokenExpiresAt: ["A", "Account — federated identity"],
    scope: ["A", "Account — federated identity"],
    password: ["A", "SPDI under IT Rules 2011 r.3 — CHECK-constrained null"],
    createdAt: ["A", "Account — federated identity"],
    updatedAt: ["A", "Account — federated identity"],
  },
  verification: {
    id: ["A", "Account — OTP / PKCE code"],
    identifier: ["A", "Account — email address or code key"],
    value: ["A", "Credential — OTP / authorization code"],
    expiresAt: ["A", "Account — OTP / PKCE code"],
    createdAt: ["A", "Account — OTP / PKCE code"],
    updatedAt: ["A", "Account — OTP / PKCE code"],
  },
  ssoProvider: {
    id: ["N", "Organisation configuration, not personal data"],
    issuer: ["N", "Organisation configuration"],
    oidcConfig: ["N", "Organisation configuration"],
    samlConfig: ["N", "Organisation configuration"],
    userId: ["A", "Account — who registered the provider"],
    providerId: ["N", "Organisation configuration"],
    organizationId: ["N", "Organisation configuration"],
    domain: ["N", "Organisation configuration"],
  },
  apiUsage: {
    key: ["A", "Service — quota bucket, contains the user id"],
    userId: ["A", "Service — quota"],
    count: ["A", "Service — quota"],
    windowStart: ["A", "Service — quota"],
    updatedAt: ["A", "Service — quota"],
  },
  creditLedger: {
    idempotencyKey: ["B", "Books of account — Companies Act, GST, income tax"],
    userId: ["B", "Books of account"],
    amount: ["B", "Books of account"],
    replays: ["B", "Books of account — replay accounting"],
    createdAt: ["B", "Books of account"],
  },
  auditLog: {
    id: ["B", "CERT-In Direction 4 — 180-day rolling retention"],
    at: ["B", "CERT-In Direction 4"],
    event: ["B", "CERT-In Direction 4"],
    severity: ["B", "CERT-In Direction 4"],
    outcome: ["B", "CERT-In Direction 4"],
    userId: ["B", "CERT-In Direction 4 — pseudonymous, deliberately no FK"],
    ip: ["B", "CERT-In Direction 4 — legal obligation, not consent"],
    userAgent: ["B", "CERT-In Direction 4 — legal obligation, not consent"],
    detail: ["B", "CERT-In Direction 4 — ids/counts/enums only, never content"],
  },
  consentRecord: {
    id: ["B", "DPDP §6 — proof consent was validly obtained"],
    at: ["B", "DPDP §6 — proof"],
    userId: ["B", "DPDP §6 — proof, deliberately no FK"],
    purpose: ["B", "DPDP §6 — proof"],
    granted: ["B", "DPDP §6 — proof"],
    noticeVersion: ["B", "DPDP §6 — which text was shown"],
    language: ["B", "DPDP §5(3) — which language was shown"],
    method: ["B", "DPDP §6 — how the decision was collected"],
    ip: ["B", "DPDP §6 — provenance of the decision"],
    userAgent: ["B", "DPDP §6 — provenance of the decision"],
  },
  dsrRequest: {
    id: ["B", "DPDP §§11–14 — proof the request was handled"],
    createdAt: ["B", "DPDP §§11–14 — starts the 90-day clock"],
    dueAt: ["B", "DPDP Rules — the 90-day deadline"],
    userId: ["B", "DPDP §§11–14 — proof, deliberately no FK"],
    kind: ["B", "DPDP §§11–14"],
    status: ["B", "DPDP §§11–14"],
    verifiedAt: ["B", "Identity verification preceded execution"],
    fulfilledAt: ["B", "DPDP §§11–14 — SLA evidence"],
    note: ["B", "DPDP §§11–14 — free text; never carries prompt content"],
  },
};

/** Tables intentionally out of scope — dropped, or not ours. */
const IGNORED_TABLES = new Set(["deviceCode"]);

/** Parse `create table "x" (...)` and `alter table "x" add column ... "y"`. */
function parseSchema() {
  const tables = new Map();
  for (const rel of SQL_FILES) {
    const sql = readFileSync(join(ROOT, rel), "utf8");

    for (const m of sql.matchAll(
      /create table if not exists\s+"([^"]+)"\s*\(([\s\S]*?)\n\);/g,
    )) {
      const [, table, body] = m;
      const cols = tables.get(table) ?? new Set();
      for (const line of body.split("\n")) {
        const c = line.match(/^\s*"([^"]+)"\s+\S/);
        // `constraint "x" check (...)` also starts with a quoted name; the
        // leading keyword is what tells them apart.
        if (c && !/^\s*(constraint|primary|unique|foreign|check)\b/i.test(line)) {
          cols.add(c[1]);
        }
      }
      tables.set(table, cols);
    }

    for (const m of sql.matchAll(
      /alter table\s+"([^"]+)"\s+add column if not exists\s+"([^"]+)"/g,
    )) {
      const [, table, col] = m;
      if (!tables.has(table)) tables.set(table, new Set());
      tables.get(table).add(col);
    }
  }
  return tables;
}

function main() {
  const mode = process.argv[2] ?? "check";
  const tables = parseSchema();
  const problems = [];
  const ropa = [];

  for (const [table, cols] of tables) {
    if (IGNORED_TABLES.has(table)) continue;
    const known = CLASSIFICATION[table];
    if (!known) {
      problems.push(
        `table "${table}" has no entry in CLASSIFICATION (scripts/ropa.mjs)`,
      );
      continue;
    }
    for (const col of cols) {
      const entry = known[col];
      if (!entry) {
        problems.push(
          `column "${table}"."${col}" is unclassified — add it to CLASSIFICATION ` +
            `in scripts/ropa.mjs with a retention class (A purge / B retain / N not personal)`,
        );
        continue;
      }
      const [cls, purpose] = entry;
      ropa.push({ table, column: col, retentionClass: cls, purpose });
    }
    // The reverse direction matters too: a classification for a column that no
    // longer exists is a RoPA that describes processing we stopped doing.
    for (const col of Object.keys(known)) {
      if (!cols.has(col)) {
        problems.push(
          `"${table}"."${col}" is classified but not in the schema — remove it ` +
            `from CLASSIFICATION (a RoPA describing processing we no longer do is wrong)`,
        );
      }
    }
  }

  if (mode === "emit") {
    const out = {
      generatedAt: new Date().toISOString().slice(0, 10),
      generatedBy: "scripts/ropa.mjs",
      basis: "DPDP Act 2023 §8(1); ISO/IEC 27001 A.5.34",
      note:
        "Generated from the SQL schema. Do not hand-edit — edit CLASSIFICATION " +
        "in scripts/ropa.mjs, which CI gates against the live schema.",
      classes: {
        A: "Consent / service basis — purged on an erasure request (R-12)",
        B: "Statutory hold — survives erasure; disclosed in the §5 notice",
        N: "Not personal data",
      },
      columns: ropa,
    };
    writeFileSync(
      join(ROOT, "compliance/ropa.json"),
      JSON.stringify(out, null, 2) + "\n",
    );
    console.log(`wrote compliance/ropa.json (${ropa.length} columns)`);
  }

  if (problems.length > 0) {
    console.error("RoPA classification gate FAILED (R-21):\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      `\n${problems.length} problem(s). Every personal-data column must be ` +
        `classified in the same change that adds it — DPDP §8(1).`,
    );
    process.exit(1);
  }

  console.log(
    `RoPA gate OK — ${ropa.length} columns across ${tables.size} tables, all classified.`,
  );
}

main();
