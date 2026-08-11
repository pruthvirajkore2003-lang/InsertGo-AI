import { describe, expect, it } from "vitest";
import {
  NOTICE_VERSION,
  OPTIONAL_PURPOSES,
  PURPOSES,
  REQUIRED_PURPOSES,
  needsConsentGate,
  purpose,
  type ConsentState,
  type PurposeId,
} from "./consent";

/**
 * These assert the DPDP §6 properties, not the shape of the data. Each one
 * fails on a specific way the consent design can silently stop being lawful.
 */

/** The vocabulary the SQL CHECK constraint pins. Duplicated here on purpose:
 *  if these two lists ever disagree, a write fails in production and passes in
 *  CI, which is the failure mode a shared constant would hide. */
const SQL_PURPOSES = [
  "account",
  "billing",
  "ai_processing",
  "analytics",
  "marketing",
  "age_18_plus",
];

function state(entries: Array<[PurposeId, boolean, string?]>) {
  return new Map<PurposeId, ConsentState>(
    entries.map(([p, granted, v]) => [
      p,
      {
        purpose: p,
        granted,
        noticeVersion: v ?? NOTICE_VERSION,
        at: "2026-08-08T00:00:00Z",
      },
    ]),
  );
}

const allRequiredGranted = () =>
  state(REQUIRED_PURPOSES.map((p) => [p, true] as [PurposeId, boolean]));

describe("purpose catalogue", () => {
  it("matches the SQL CHECK constraint exactly", () => {
    expect(PURPOSES.map((p) => p.id).sort()).toEqual([...SQL_PURPOSES].sort());
  });

  it("keeps analytics and marketing optional", () => {
    // The §6(1) failure this guards: making an optional purpose required turns
    // it into a precondition of service, which is the conditionality the
    // section forbids outright.
    expect(OPTIONAL_PURPOSES).toContain("analytics");
    expect(OPTIONAL_PURPOSES).toContain("marketing");
    expect(REQUIRED_PURPOSES).not.toContain("analytics");
    expect(REQUIRED_PURPOSES).not.toContain("marketing");
  });

  it("gives every purpose the itemisation §5 needs", () => {
    for (const p of PURPOSES) {
      expect(p.dataItems.length, `${p.id} dataItems`).toBeGreaterThan(0);
      expect(p.retention, `${p.id} retention`).toBeTruthy();
      expect(["A", "B"]).toContain(p.retentionClass);
    }
  });

  it("classifies the statutory-hold purposes as Class B", () => {
    // R-12: billing ledger entries are books of account and the age
    // declaration is evidence — both survive erasure, and R-13's notice has to
    // say so in advance. A drift to Class A here would promise an erasure the
    // ledger cannot honour.
    expect(purpose("billing").retentionClass).toBe("B");
    expect(purpose("age_18_plus").retentionClass).toBe("B");
  });

  it("names a recipient country wherever data leaves the estate", () => {
    for (const p of PURPOSES) {
      for (const r of p.recipients) {
        expect(r.country, `${p.id} → ${r.name}`).toBeTruthy();
      }
    }
  });

  it("rejects an unknown purpose rather than returning undefined", () => {
    expect(() => purpose("tracking" as PurposeId)).toThrow(/unknown consent purpose/);
  });
});

describe("needsConsentGate", () => {
  it("gates a user who has never been asked", () => {
    expect(needsConsentGate(new Map())).toBe(true);
  });

  it("lets through a user who granted every required purpose", () => {
    expect(needsConsentGate(allRequiredGranted())).toBe(false);
  });

  it("gates when any single required purpose is missing", () => {
    for (const missing of REQUIRED_PURPOSES) {
      const partial = state(
        REQUIRED_PURPOSES.filter((p) => p !== missing).map(
          (p) => [p, true] as [PurposeId, boolean],
        ),
      );
      expect(needsConsentGate(partial), `missing ${missing}`).toBe(true);
    }
  });

  it("gates when a required purpose was explicitly declined", () => {
    const declined = allRequiredGranted();
    declined.set(REQUIRED_PURPOSES[0], {
      purpose: REQUIRED_PURPOSES[0],
      granted: false,
      noticeVersion: NOTICE_VERSION,
      at: "2026-08-08T00:00:00Z",
    });
    expect(needsConsentGate(declined)).toBe(true);
  });

  it("re-gates on a notice version bump", () => {
    // The whole reason noticeVersion is stored per row. Without this, a
    // reworded notice would silently inherit consent given to the old text.
    const stale = state(
      REQUIRED_PURPOSES.map((p) => [p, true, "0.9.0"] as [PurposeId, boolean, string]),
    );
    expect(needsConsentGate(stale)).toBe(true);
  });

  it("does NOT gate on optional purposes, granted or declined", () => {
    // §6(4): re-prompting someone who declined marketing on every sign-in is
    // asymmetric friction. Declining must be as durable as accepting.
    for (const granted of [true, false]) {
      const s = allRequiredGranted();
      for (const p of OPTIONAL_PURPOSES) {
        s.set(p, {
          purpose: p,
          granted,
          noticeVersion: NOTICE_VERSION,
          at: "2026-08-08T00:00:00Z",
        });
      }
      expect(needsConsentGate(s), `optional granted=${granted}`).toBe(false);
    }
  });
});
