import { describe, expect, it } from "vitest";
import {
  FLOATER_INITIAL,
  FLOATER_PROMPTS,
  floaterReducer,
  type FloaterEvent,
  type FloaterState,
} from "./floaterDemoMachine";

const run = (events: FloaterEvent[], from: FloaterState = FLOATER_INITIAL) =>
  events.reduce(floaterReducer, from);

describe("floaterReducer", () => {
  it("walks the happy path summon → choose → insert → done", () => {
    const s = run([
      { type: "SUMMON" },
      { type: "CHOOSE", promptId: "summarize" },
      { type: "INSERT" },
      { type: "INSERTED" },
    ]);
    expect(s).toEqual({ phase: "done", promptId: "summarize" });
  });

  it("allows re-choosing a prompt before inserting", () => {
    const s = run([
      { type: "SUMMON" },
      { type: "CHOOSE", promptId: "continue" },
      { type: "CHOOSE", promptId: "closing" },
    ]);
    expect(s).toEqual({ phase: "chosen", promptId: "closing" });
  });

  it("ignores out-of-order events", () => {
    // INSERT with nothing chosen
    expect(run([{ type: "SUMMON" }, { type: "INSERT" }]).phase).toBe("summoned");
    // CHOOSE before summon
    expect(run([{ type: "CHOOSE", promptId: "continue" }])).toEqual(FLOATER_INITIAL);
    // double SUMMON keeps state
    expect(run([{ type: "SUMMON" }, { type: "SUMMON" }]).phase).toBe("summoned");
    // INSERTED outside inserting
    expect(run([{ type: "INSERTED" }])).toEqual(FLOATER_INITIAL);
  });

  it("resets to initial from any phase", () => {
    const mid = run([
      { type: "SUMMON" },
      { type: "CHOOSE", promptId: "continue" },
      { type: "INSERT" },
    ]);
    expect(floaterReducer(mid, { type: "RESET" })).toEqual(FLOATER_INITIAL);
  });

  it("every prompt has a non-empty response that starts with a space (appends mid-paragraph)", () => {
    expect(FLOATER_PROMPTS.length).toBe(3);
    for (const p of FLOATER_PROMPTS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.response.startsWith(" ")).toBe(true);
      expect(p.response.trim().length).toBeGreaterThan(20);
    }
  });
});
