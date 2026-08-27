import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONSENT_LABEL,
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  PRIVACY,
  TERMS,
  needsConsent,
} from "./index";

/**
 * Guards on the consent gate itself — the module that decides whether the OS
 * hooks may exist at all.
 *
 * There are three copies of the version string in this product (the website's
 * `NOTICE_VERSION`, this module's `LEGAL_VERSION`, and Rust's
 * `domain::settings::LEGAL_VERSION`) and each one gates something different.
 * The website test binds the first two. This binds the third, which is the one
 * that matters most: Rust decides at process start whether to install
 * WH_KEYBOARD_LL / WH_MOUSE_LL hooks, and if its constant lags behind this
 * file, the modal asks for v-new while the backend arms on v-old — consent
 * theatre with the hooks running underneath it.
 */

// Vitest runs with cwd = project root, like types/defaultsMirror.test.ts.
const rust = readFileSync(
  join(process.cwd(), "src-tauri/src/domain/settings.rs"),
  "utf8",
);

describe("version mirror", () => {
  it("matches the Rust LEGAL_VERSION the hook gate reads", () => {
    const match = /LEGAL_VERSION: &str = "([^"]+)"/.exec(rust)?.[1];
    expect(match, "Rust declares no LEGAL_VERSION").toBeTruthy();
    expect(match).toBe(LEGAL_VERSION);
  });

  it("keeps the Rust gate version-EXACT, not merely present", () => {
    // `is_some()` would let an acceptance of any older document arm the hooks.
    expect(rust).toContain(
      "self.accepted_terms_version.as_deref() == Some(LEGAL_VERSION)",
    );
  });
});

describe("needsConsent", () => {
  it("asks a fresh install", () => {
    expect(needsConsent(null)).toBe(true);
  });

  it("re-asks after a version bump instead of inheriting the old tick", () => {
    expect(needsConsent("1.3.0")).toBe(true);
    expect(needsConsent("1.4.0")).toBe(true);
  });

  it("does not nag someone who accepted this exact version", () => {
    expect(needsConsent(LEGAL_VERSION)).toBe(false);
  });
});

describe("CONSENT_LABEL", () => {
  it("names the version it is recording, so the record identifies the text", () => {
    expect(CONSENT_LABEL).toContain(LEGAL_VERSION);
  });

  it("authorises the interception explicitly, not just the documents", () => {
    // CIPA §§631/632 want consent to the reading/writing itself. "I accept the
    // Terms" alone leaves the interception consented to only by reference.
    expect(CONSENT_LABEL).toMatch(/authorise/i);
    expect(CONSENT_LABEL).toMatch(/clipboard/i);
    expect(CONSENT_LABEL).toMatch(/keyboard\/mouse hook/i);
  });

  it("bundles no optional privacy purpose into the tick", () => {
    // DPDP §6(1): an optional purpose folded into a mandatory acceptance is a
    // precondition of service, which is exactly what the section forbids.
    // Those live in the website's PURPOSES catalogue and are asked one by one.
    for (const banned of ["analytic", "marketing", "advertis", "newsletter"]) {
      expect(
        CONSENT_LABEL.toLowerCase().includes(banned),
        `CONSENT_LABEL bundles "${banned}"`,
      ).toBe(false);
    }
  });
});

describe("shipped documents", () => {
  it("ships both documents to the modal", () => {
    expect(LEGAL_DOCUMENTS).toEqual([TERMS, PRIVACY]);
  });

  it("carries the arbitration clause the website publishes", () => {
    const s23 = TERMS.sections.find((x) => x.heading.startsWith("23."));
    expect(s23, "no section 23").toBeTruthy();
    expect(s23!.body).toContain("BINDING INDIVIDUAL ARBITRATION");
    expect(s23!.body).toContain("30-DAY RIGHT TO OPT OUT");
    // Flagged, so the modal boxes it out rather than burying it in the run of
    // prose — conspicuousness is a condition of enforcing a waiver.
    expect(s23!.emphasis).toBe(true);
  });

  it("has no unfilled placeholder anywhere in either document", () => {
    const all = [...TERMS.sections, ...PRIVACY.sections]
      .map((x) => `${x.heading} ${x.body}`)
      .join(" ");
    expect(all).not.toContain("[Name to be appointed]");
    expect(all).not.toMatch(/\[[A-Za-z ]+to be [a-z]+\]/);
    expect(all).toContain("Pruthviraj Kore");
  });
});
