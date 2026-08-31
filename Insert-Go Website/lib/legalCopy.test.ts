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
  ["website privacy", read("../app/[locale]/privacy/page.tsx")],
  ["website terms", read("../app/[locale]/terms/page.tsx")],
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

/**
 * The 1.5.0 clauses. Each of these exists because a specific statute or case
 * makes its ABSENCE expensive, and each is a paragraph a future edit could
 * quietly reword away — the version bump alone would not notice.
 */
describe("dispute resolution and jurisdiction", () => {
  const TERMS = prose(COPIES.find(([n]) => n === "website terms")![1]);
  const MIRROR = prose(COPIES.find(([n]) => n === "desktop mirror")![1]);

  /** Both copies of the Terms — the published page and the offline mirror the
   *  desktop shows at first run. A clause in only one of them is a clause the
   *  other half of the userbase never assented to. */
  const BOTH: Array<[string, string]> = [
    ["website terms", TERMS],
    ["desktop mirror", MIRROR],
  ];

  it("keeps the FAA-governed individual arbitration agreement for US residents", () => {
    for (const [name, src] of BOTH) {
      // Berman v. Freedom Financial Network, 30 F.4th 849: an Indian forum
      // clause alone does not stop a US class action. These four elements are
      // what does.
      expect(src, `${name}: no arbitration agreement`).toContain(
        "BINDING INDIVIDUAL ARBITRATION",
      );
      expect(src, `${name}: no FAA hook`).toContain("Federal Arbitration Act");
      expect(src, `${name}: no administrator named`).toContain(
        "American Arbitration Association",
      );
      expect(src, `${name}: no consumer rules`).toContain(
        "Consumer Arbitration Rules",
      );
    }
  });

  it("keeps the class action and jury trial waivers", () => {
    for (const [name, src] of BOTH) {
      expect(src, `${name}: no class action waiver`).toContain(
        "CLASS ACTION WAIVER",
      );
      expect(src, `${name}: no jury waiver`).toContain("JURY TRIAL WAIVER");
    }
  });

  it("keeps the 30-day opt-out and the address it goes to", () => {
    for (const [name, src] of BOTH) {
      // An arbitration clause with no opt-out is the one most likely to be
      // struck as unconscionable — the opt-out is what buys the rest of it.
      expect(src, `${name}: no opt-out`).toContain("30-DAY RIGHT TO OPT OUT");
      expect(src, `${name}: opt-out has no address`).toContain(
        "support@insertgo.com",
      );
    }
  });

  it("preserves Indian statutory remedies rather than waiving them", () => {
    for (const [name, src] of BOTH) {
      expect(src, `${name}: no Indian consumer remedy`).toContain(
        "Consumer Protection Act, 2019",
      );
      expect(src, `${name}: no DPB escalation`).toContain(
        "Data Protection Board of India",
      );
    }
  });

  it("flags the arbitration section as conspicuous, not as ordinary prose", () => {
    for (const [name, src] of BOTH) {
      // `emphasis: true` is what boxes the section out in both renderers.
      expect(src, `${name}: arbitration not visually flagged`).toContain(
        "emphasis: true",
      );
    }
    // ...and section 1 has to point at it, or a reader never gets there.
    for (const [name, src] of BOTH) {
      expect(src, `${name}: no upfront notice of the clause`).toContain(
        "PLEASE READ SECTION 23 CAREFULLY",
      );
    }
  });
});

describe("grievance officer", () => {
  it("names a real officer in all three copies", () => {
    for (const [name, src] of COPIES) {
      // IT (Intermediary Guidelines) Rules 2021 r.3(2)(a) wants a named
      // person. A placeholder shipped to production is an unappointed officer.
      expect(src.includes("[Name to be appointed]"), `${name} still has the placeholder`)
        .toBe(false);
      expect(prose(src), `${name} names no Grievance Officer`).toContain(
        "Pruthviraj Kore",
      );
      expect(prose(src), `${name} states no acknowledgement window`).toContain(
        "forty-eight hours",
      );
    }
  });
});

describe("high-risk use and buffer replacement", () => {
  const TERMS = prose(COPIES.find(([n]) => n === "website terms")![1]);
  const MIRROR = prose(COPIES.find(([n]) => n === "desktop mirror")![1]);

  it("disclaims the domains InsertGo is not built for", () => {
    for (const src of [TERMS, MIRROR]) {
      expect(src).toContain("NOT designed, tested, licensed or authorised");
      expect(src).toContain("life-critical");
    }
  });

  it("says plainly that it overwrites another application's buffer", () => {
    for (const src of [TERMS, MIRROR]) {
      expect(src).toContain("REPLACES THE ENTIRE CONTENTS");
      expect(src).toContain("third-party application");
    }
  });
});

describe("desktop interception consent", () => {
  it("states in every copy that the OS hooks wait for an explicit tick", () => {
    for (const [name, src] of COPIES) {
      const text = prose(src);
      // The claim the product's CIPA position rests on. If the code ever stops
      // being true, this sentence has to change with it — and it is easier to
      // notice a failing test than a false policy.
      const claims =
        text.includes("YOUR EXPRESS CONSENT COMES FIRST") ||
        text.includes("NONE OF THIS RUNS UNTIL YOU ALLOW IT");
      expect(claims, `${name} does not state that the hooks wait for consent`).toBe(
        true,
      );
    }
  });
});
