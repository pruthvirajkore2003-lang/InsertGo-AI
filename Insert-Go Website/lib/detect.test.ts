import { describe, expect, it } from "vitest";
import { ALERT_RULES, evaluateAlerts, type AlertCandidate } from "./detect";

const WINDOW = 10;

function candidate(over: Partial<AlertCandidate> & { rule: string }): AlertCandidate {
  return {
    subject: "s",
    events: 0,
    since: "2026-08-06T11:55:00.000Z",
    alertedMinutesAgo: null,
    ...over,
  };
}

const run = (c: AlertCandidate) => evaluateAlerts([c], WINDOW);

describe("evaluateAlerts thresholds", () => {
  // The boundary is the whole test: a rule that never fires and a rule that
  // always fires are indistinguishable in production, so both sides of every
  // threshold are asserted rather than a single comfortable value.
  it.each(
    Object.entries(ALERT_RULES).filter(([, r]) => !r.silence),
  )("%s does not fire one event below its threshold", (rule, config) => {
    expect(run(candidate({ rule, events: config.threshold - 1 }))).toEqual([]);
  });

  it.each(
    Object.entries(ALERT_RULES).filter(([, r]) => !r.silence),
  )("%s fires exactly at its threshold", (rule, config) => {
    const firing = run(candidate({ rule, events: config.threshold }));
    expect(firing).toHaveLength(1);
    expect(firing[0]?.incidentType).toBe(config.incidentType);
  });

  it("fires the critical rule on a single event", () => {
    expect(run(candidate({ rule: "critical", events: 1 }))).toHaveLength(1);
  });
});

describe("coverage.gap (silence rule)", () => {
  // Inverted on purpose: this one fires on too FEW events. A dead log sink and
  // a genuinely quiet estate look identical, and only one of them is fine.
  it("fires when the log recorded nothing in 24h", () => {
    const firing = run(candidate({ rule: "coverage.gap", events: 0 }));
    expect(firing).toHaveLength(1);
    expect(firing[0]?.incidentType).toContain("Direction 4");
  });

  it("stays quiet as soon as a single event was recorded", () => {
    expect(run(candidate({ rule: "coverage.gap", events: 1 }))).toEqual([]);
  });
});

describe("cooldown", () => {
  const rule = "auth.signin.ip";
  const { threshold, cooldownMinutes } = ALERT_RULES[rule]!;

  it("suppresses a breach already paged inside the cooldown", () => {
    const c = candidate({
      rule,
      events: threshold,
      alertedMinutesAgo: cooldownMinutes - 1,
    });
    expect(run(c)).toEqual([]);
  });

  it("pages again once the cooldown has elapsed", () => {
    const c = candidate({
      rule,
      events: threshold,
      alertedMinutesAgo: cooldownMinutes,
    });
    expect(run(c)).toHaveLength(1);
  });

  it("pages rather than suppresses when the prior-page age is unusable", () => {
    // Suppression is the dangerous default: a bad value must never be able to
    // silence a live incident.
    const c = candidate({ rule, events: threshold, alertedMinutesAgo: NaN });
    expect(run(c)).toHaveLength(1);
  });
});

describe("unmapped rules", () => {
  it("fires rather than silently dropping a rule the table does not know", () => {
    // SQL and rule table ship together, so this means deploy skew — a detector
    // that quietly ignores part of its input is the failure R-03 exists to fix.
    const firing = run(candidate({ rule: "burst.something.new", events: 1 }));
    expect(firing).toHaveLength(1);
    expect(firing[0]?.incidentType).toContain("Unclassified");
  });
});

describe("page contents", () => {
  it("names the Annexure I incident type and the group that breached", () => {
    const firing = run(
      candidate({ rule: "auth.signin.ip", subject: "203.0.113.9", events: 40 }),
    );
    expect(firing[0]?.title).toContain("auth.signin.ip");
    expect(firing[0]?.body).toContain("Identity theft");
    expect(firing[0]?.body).toContain("203.0.113.9");
    expect(firing[0]?.body).toContain("6 hours");
  });

  it("survives a null group key", () => {
    const firing = run(candidate({ rule: "critical", subject: null, events: 1 }));
    expect(firing[0]?.subject).toBe("(none)");
  });

  it("evaluates every candidate, not just the first breach", () => {
    const firing = evaluateAlerts(
      [
        candidate({ rule: "critical", subject: "a", events: 1 }),
        candidate({ rule: "auth.signin.ip", subject: "b", events: 1 }),
        candidate({ rule: "auth.signin.account", subject: "c", events: 99 }),
      ],
      WINDOW,
    );
    expect(firing.map((f) => f.rule)).toEqual(["critical", "auth.signin.account"]);
  });
});
