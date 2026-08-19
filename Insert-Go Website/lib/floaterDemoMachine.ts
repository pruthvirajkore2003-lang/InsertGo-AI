/**
 * Pure state machine for the hero Floater demo.
 *
 * The component owns timers, focus and DOM; every legal phase transition
 * lives here so it can be unit-tested in the node environment. Illegal
 * events (e.g. INSERT before a prompt is chosen) return state unchanged —
 * the UI can dispatch optimistically without guarding every call site.
 *
 *   idle → summoned → chosen → inserting → done
 *     ↑______________________________________|   (RESET from anywhere)
 */

export type FloaterPhase = "idle" | "summoned" | "chosen" | "inserting" | "done";

export type PromptId = "continue" | "summarize" | "closing";

export type FloaterState = {
  phase: FloaterPhase;
  promptId: PromptId | null;
};

export type FloaterEvent =
  | { type: "SUMMON" }
  | { type: "CHOOSE"; promptId: PromptId }
  | { type: "INSERT" }
  | { type: "INSERTED" }
  | { type: "RESET" };

export const FLOATER_INITIAL: FloaterState = { phase: "idle", promptId: null };

/** Canned prompt → response pairs. The response IS the demo — keep it good. */
export const FLOATER_PROMPTS: {
  id: PromptId;
  label: string;
  response: string;
}[] = [
  {
    id: "continue",
    label: "Continue this paragraph",
    response:
      " Enterprise followed the same curve: twelve net-new logos, churn under 2%, and the strongest pipeline the team has ever carried into a fourth quarter.",
  },
  {
    id: "summarize",
    label: "Summarize the update",
    response:
      " Net: revenue up 18%, enterprise pipeline at a record, churn under 2% — Q4 is set up to be the best quarter on the books.",
  },
  {
    id: "closing",
    label: "Draft the closing line",
    response:
      " The self-serve bet paid off; the numbers say double down, and Q4 is where it compounds.",
  },
];

export function floaterReducer(
  state: FloaterState,
  event: FloaterEvent
): FloaterState {
  switch (event.type) {
    case "SUMMON":
      return state.phase === "idle" ? { phase: "summoned", promptId: null } : state;
    case "CHOOSE":
      return state.phase === "summoned" || state.phase === "chosen"
        ? { phase: "chosen", promptId: event.promptId }
        : state;
    case "INSERT":
      return state.phase === "chosen" && state.promptId !== null
        ? { ...state, phase: "inserting" }
        : state;
    case "INSERTED":
      return state.phase === "inserting" ? { ...state, phase: "done" } : state;
    case "RESET":
      return FLOATER_INITIAL;
  }
}
