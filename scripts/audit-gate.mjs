#!/usr/bin/env node
/**
 * R-07: the gate that makes `compliance/vulnerability-exceptions.md` load-bearing.
 *
 * `npm audit` and `cargo audit` both know how to be silenced, and a silenced
 * scanner is worse than none — it reports clean. So neither tool holds its own
 * ignore list here: this script reads the exception table, and an id that is not
 * in it fails the build. Deleting a row re-arms the advisory; letting a row's
 * review date lapse fails the build outright, which is the only mechanism that
 * has ever kept a review date honest.
 *
 * Modes:
 *   node scripts/audit-gate.mjs npm            gate `npm audit --json` (stdin)
 *   node scripts/audit-gate.mjs cargo-ignores  print `--ignore <id>` flags
 *   node scripts/audit-gate.mjs expiry         fail on a lapsed review date
 *
 * Run it locally exactly as CI does:
 *   npm audit --json | node scripts/audit-gate.mjs npm
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABLE = join(ROOT, "compliance", "vulnerability-exceptions.md");
const BLOCKING = new Set(["high", "critical"]);

/** One row per active exception. Column 1 is the id, the last column is the
 *  review date — the shape the table documents. */
function exceptions() {
  const rows = [];
  for (const line of readFileSync(TABLE, "utf8").split(/\r?\n/)) {
    if (!/^\|\s*(GHSA|RUSTSEC)-/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const [id] = cells;
    const reviewBy = cells[cells.length - 1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) {
      fail(`${id}: review date "${reviewBy}" is not ISO YYYY-MM-DD.`);
    }
    rows.push({ id, pkg: cells[2], reviewBy });
  }
  if (!rows.length) console.error("note: no active exceptions in the table.");
  return rows;
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

/** Today in UTC. ISO dates compare correctly as strings, so no date parsing. */
const today = new Date().toISOString().slice(0, 10);

function checkExpiry(rows) {
  for (const r of rows) {
    if (r.reviewBy < today) {
      fail(
        `${r.id} (${r.pkg}) was due for review on ${r.reviewBy}. Re-assess it, ` +
          `then either fix the advisory or move the date with a written reason.`,
      );
    }
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Gate `npm audit --json`. Only advisories carrying their own id are judged:
 * npm also emits derived entries (`next` "depends on vulnerable postcss") whose
 * `via` is a bare package name. Those clear automatically once the advisory they
 * derive from is excepted, and listing them separately would mean maintaining a
 * row that names no advisory.
 */
async function gateNpm(allowed) {
  const raw = await readStdin();
  if (!raw.trim()) return fail("no `npm audit --json` output on stdin.");
  const report = JSON.parse(raw);
  const unexcepted = [];
  for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
    if (!BLOCKING.has(v.severity)) continue;
    for (const via of v.via ?? []) {
      if (typeof via === "string") continue; // derived entry, judged at its source
      const id = /GHSA-[\w-]+/.exec(via.url ?? "")?.[0];
      if (!id) continue;
      if (!allowed.has(id)) unexcepted.push(`${pkg}: ${id} (${via.title ?? ""})`);
    }
  }
  if (unexcepted.length) {
    fail(
      `${unexcepted.length} unexcepted high/critical npm advisory(ies):\n` +
        unexcepted.map((u) => `  - ${u}`).join("\n") +
        `\n\nFix it, or add a row to compliance/vulnerability-exceptions.md with ` +
        `a reachability argument, an owner and a review date.`,
    );
  } else {
    console.log("npm audit: no unexcepted high/critical advisories.");
  }
}

const mode = process.argv[2];
const rows = exceptions();

if (mode === "expiry") {
  checkExpiry(rows);
  if (!process.exitCode) console.log(`exceptions: all ${rows.length} rows in date.`);
} else if (mode === "cargo-ignores") {
  // Expiry is enforced by its own job; this only emits flags.
  process.stdout.write(
    rows
      .filter((r) => r.id.startsWith("RUSTSEC-"))
      .map((r) => `--ignore ${r.id}`)
      .join(" "),
  );
} else if (mode === "npm") {
  checkExpiry(rows); // a lapsed row must not keep suppressing an advisory
  await gateNpm(new Set(rows.map((r) => r.id)));
} else {
  fail(`unknown mode "${mode ?? ""}" — expected npm | cargo-ignores | expiry.`);
}
