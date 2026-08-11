import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Drift guard for the three hand-kept copies of the legal text: the two website
 * pages and the desktop mirror (`Insert-Go Windows/src/legal/index.ts`).
 *
 * These are read as SOURCE TEXT rather than imported. The point is to catch a
 * reverted or re-pasted paragraph, and an import would only see the exported
 * values — plus the desktop module lives in the other workspace package and
 * `lib/consent.ts` pulls in `pg`.
 *
 * Two properties, both of which failed silently before 2026-08-08:
 *  1. The version strings agree. They were three separate constants and drifted
 *     (Terms sat on 1.2.0/"5 August" while Privacy said "8 August"), which makes
 *     `consentRecord.noticeVersion` useless — its only job is to name text we can
 *     still produce.
 *  2. No copy promises BYOK. R-15: user API keys and local models are a decided
 *     non-feature, and all three documents described them as shipped for the whole
 *     of their non-existence. The bans below are phrases that can only appear in a
 *     promise — "you cannot supply your own API key" is truthful and passes.
 */

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const CONSENT = read("./consent.ts");
const COPIES: Array<[string, string]> = [
  ["website privacy", read("../app/privacy/page.tsx")],
  ["website terms", read("../app/terms/page.tsx")],
  ["desktop mirror", read("../../Insert-Go Windows/src/legal/index.ts")],
];

/** Join the `"…" + "…"` string concatenation the section bodies are written as,
 *  so a phrase can be searched for without knowing where the line breaks fell. */
const prose = (src: string): string =>
  src.replace(/"\s*\+\s*(?:`|")/g, "").replace(/\s+/g, " ");

/** Sentence fragments that assert a lane which does not exist. Deliberately
 *  long: a short ban like "API key" would also fire on the truthful negative. */
const BANNED = [
  "Your own API key, and local models",
  "API keys you enter",
  "goes straight from your PC",
  "travels directly from your device",
  "your own key, your text",
  "your provider keys",
  "point it at a model running locally",
  "With a local model, nothing is sent",
  "no one but",
];

describe("legal copy", () => {
  it("keeps NOTICE_VERSION and the desktop LEGAL_VERSION in step", () => {
    const notice = /NOTICE_VERSION = "([^"]+)"/.exec(CONSENT)?.[1];
    const legal = /LEGAL_VERSION = "([^"]+)"/.exec(
      COPIES.find(([name]) => name === "desktop mirror")![1]
    )?.[1];

    expect(notice).toBeTruthy();
    expect(legal).toBe(notice);
  });

  it("renders every page from the shared version constant", () => {
    // A page that hard-codes its own version is how the drift started.
    for (const [name, src] of COPIES) {
      const literals = (src.match(/VERSION\s*=\s*"[^"]+"/g) ?? []).length;
      // The desktop mirror declares LEGAL_VERSION; the website pages must both
      // import it, so a literal there is the drift this test exists to catch.
      expect(literals, `${name} hard-codes a version string`).toBe(
        name === "desktop mirror" ? 1 : 0
      );
    }
  });

  it("promises no BYOK lane in any copy", () => {
    for (const [name, src] of COPIES) {
      for (const phrase of BANNED) {
        expect(src.includes(phrase), `${name} still claims: "${phrase}"`).toBe(
          false
        );
      }
    }
  });

  it("states the negative explicitly, so a reader cannot infer the old lane", () => {
    // Removing the claim is not enough — a user who remembers the old policy
    // goes looking for the setting. Each copy has to say it is not there.
    const expected: Record<string, string> = {
      "website privacy": "There is no way to point InsertGo at your own API key",
      "website terms": "cannot configure the product with your own API key",
      "desktop mirror": "There is no way to point InsertGo at your own API key",
    };
    for (const [name, src] of COPIES) {
      expect(prose(src), `${name} does not state that BYOK is unavailable`)
        .toContain(expected[name]);
    }
  });
});
