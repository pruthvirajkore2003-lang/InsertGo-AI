/**
 * Contract for the smart-bar ranking (selectionContext.ts): detection stays
 * conservative (two-signal rules, most-specific-first ordering) and ranking
 * lets context dominate while frequency only tie-breaks.
 */
import { describe, expect, it } from "vitest";
import { SKILLS } from "@/services/skills";
import { detectContext, rankSkills } from "@/services/selectionContext";

describe("detectContext", () => {
  it("flags non-Latin script as foreign", () => {
    expect(detectContext("こんにちは、元気ですか")).toBe("foreign");
    expect(detectContext("Привет, как дела")).toBe("foreign");
    expect(detectContext("你好世界")).toBe("foreign");
  });

  it("does not treat accented Latin prose as foreign", () => {
    // Latin-with-accents is indistinguishable from English loanwords without a
    // real LM, so it must fall through — not misfire as foreign.
    expect(detectContext("Café résumé naïve")).not.toBe("foreign");
  });

  it("detects code only with two independent signals", () => {
    expect(
      detectContext("function add(a, b) {\n  return a + b;\n}")
    ).toBe("code");
    // A single 'if' sentence is prose, not code.
    expect(detectContext("Let me know if this works for you.")).not.toBe("code");
  });

  it("detects questions by terminator or interrogative lead-in", () => {
    expect(detectContext("What time is the meeting")).toBe("question");
    expect(detectContext("This works great, right?")).toBe("question");
    // A long passage that merely opens with an interrogative is prose.
    expect(detectContext("How " + "x".repeat(300))).toBe("generic");
  });

  it("detects an email from salutation + sign-off", () => {
    expect(
      detectContext("Hi team,\n\nPlease review the draft.\n\nRegards,\nAlex")
    ).toBe("email");
    // Salutation alone (no sign-off) is not enough.
    expect(detectContext("Hey there, quick note")).not.toBe("email");
  });

  it("prefers email over question when both signals are present", () => {
    expect(
      detectContext("Hi Sam,\n\nCan you send the file?\n\nThanks,\nJo")
    ).toBe("email");
  });

  it("falls back to generic for plain prose", () => {
    expect(detectContext("The quick brown fox jumps over the lazy dog.")).toBe(
      "generic"
    );
  });
});

describe("rankSkills", () => {
  it("surfaces the context's top affinity skill first", () => {
    expect(rankSkills(SKILLS, "foreign")[0].id).toBe("translate-this");
    expect(rankSkills(SKILLS, "email")[0].id).toBe("reply-to-this");
    expect(rankSkills(SKILLS, "question")[0].id).toBe("answer-this-question");
  });

  it("returns every skill exactly once (nothing dropped)", () => {
    const ranked = rankSkills(SKILLS, "code");
    expect(ranked).toHaveLength(SKILLS.length);
    expect(new Set(ranked.map((s) => s.id)).size).toBe(SKILLS.length);
  });

  it("keeps repo order for a context with no signal and no usage", () => {
    // 'generic' still has an affinity list, so use empty-usage stability on the
    // non-affinity tail: skills sharing score 0 stay in SKILLS order.
    const ranked = rankSkills(SKILLS, "generic");
    const tail = ranked.filter(
      (s) =>
        !["summarize-this", "improve-this", "reply-to-this", "learn-more"].includes(
          s.id
        )
    );
    const repoTail = SKILLS.filter(
      (s) =>
        !["summarize-this", "improve-this", "reply-to-this", "learn-more"].includes(
          s.id
        )
    );
    expect(tail.map((s) => s.id)).toEqual(repoTail.map((s) => s.id));
  });

  it("lets frequency tie-break but never override context", () => {
    // Heavy usage on a non-affinity skill must not outrank the top context pick.
    const usage = { "expand-this": 20 };
    const ranked = rankSkills(SKILLS, "foreign", usage);
    expect(ranked[0].id).toBe("translate-this");
    // Among equal-affinity (score 0) skills, the used one floats up.
    const zeroScore = ranked.filter(
      (s) => !["translate-this", "summarize-this", "learn-more", "answer-this-question"].includes(s.id)
    );
    expect(zeroScore[0].id).toBe("expand-this");
  });
});
