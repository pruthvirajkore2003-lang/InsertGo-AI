/**
 * Editor state for the active prompt being composed/refined, plus the
 * provider result. Library CRUD lives in libraryStore; provider config in
 * settingsStore.
 */
import { create } from "zustand";
import type { GroundingResult, Prompt } from "@/types";

/** Live latency metrics for the current/last provider run (SPEC §11 latency
 *  work). Updated in place while the stream runs — the floater chip row
 *  re-renders per delta — and settled once more at completion. */
export type RunMetrics = {
  /** Dispatch → first streamed delta, in ms; null until the first delta. */
  ttftMs: number | null;
  /** Dispatch → latest update, in ms; settles at completion. */
  totalMs: number;
  /** Characters streamed so far — the tok/s estimate until usage arrives. */
  chars: number;
  /** Output tokens from the provider's final usage; null until reported. */
  outputTokens: number | null;
};

/** The run being reviewed in the Skill Components floater — a skill-bar skill,
 *  or the synthetic "Result" entry a plain Send sets so every run type reviews
 *  in the same card; the resolved FA icon travels here so the floater never
 *  re-derives it. Non-null means the floater is the run's presentation. */
export type ActiveSkill = {
  id: string;
  label: string;
  /** Font Awesome solid glyph class, e.g. "fa-align-left". */
  icon: string;
  /** Where the skill was invoked — decides what the floater's Apply does:
   *  "editor" commits the draft to the composer; "selection" pastes it over
   *  the original selection in the external app (via insert_text). */
  source: "editor" | "selection";
};

/** A selection-bar skill click staged by the selection review floater
 *  window's listener (SelectionReviewFloater) until its consume effect can
 *  start the run. Only ever set in that window's store instance — the main
 *  palette no longer participates in the selection flow. */
export type PendingSelectionReview = {
  /** Null = the bar's "More" handoff: open the skill picker, don't run yet. */
  skillId: string | null;
  icon: string | null;
  text: string;
};

type PromptState = {
  /** Composer editor text (skills + plain Send operate on this; library
   *  templates and saved prompts also land here). */
  body: string;
  /** Prompt currently being edited from the library, if any. */
  editingId: string | null;
  /** Latest provider response text (grows incrementally during a stream). */
  result: string | null;
  /** Live <analysis> reasoning for a skill run, streamed as collapsible
   *  "thinking" so the analysis phase shows progress instead of a blank pulse
   *  (L1 latency work). Never the deliverable — Apply/Copy only ever use
   *  `result`. Null for non-skill runs (plain Send / refine have no analysis)
   *  and before <analysis> appears. */
  thinking: string | null;
  /** Citations from a web-grounded run (the trailing `insertgo` SSE frame),
   *  rendered as the floater's "Sources" block. Null for every non-grounded
   *  run and until the frame lands — it arrives after the text stream ends. */
  grounding: GroundingResult | null;
  /** True while a provider call is in flight. */
  isSending: boolean;
  /** Last error message, surfaced as a toast/inline message. */
  error: string | null;
  /** Live metrics for the chip row; null before any run produces output. */
  metrics: RunMetrics | null;
  /** Aborts the in-flight provider stream. Registered by the palette per run
   *  so `reset()` can cancel the stream — a stale delta can then never write
   *  into a cleared palette. */
  abortRun: (() => void) | null;
  /** Replays the last dispatched run with its exact arguments. Registered by
   *  useProviderRun so any error surface (e.g. the relay-overload card) can
   *  offer Retry without re-deriving the prompt, system or skill transforms. */
  retryRun: (() => void) | null;
  /** Skill whose run the Skill Components floater is reviewing, if any. */
  activeSkill: ActiveSkill | null;
  /** Selection-bar handoff waiting for the composer to pick it up. */
  pendingSelectionReview: PendingSelectionReview | null;

  setBody: (body: string) => void;
  reset: () => void;
  /** Load a saved prompt into the composer editor for refinement. */
  loadFromPrompt: (prompt: Prompt) => void;

  setResult: (result: string | null) => void;
  setThinking: (thinking: string | null) => void;
  setGrounding: (grounding: GroundingResult | null) => void;
  setSending: (isSending: boolean) => void;
  setError: (error: string | null) => void;
  setMetrics: (metrics: RunMetrics | null) => void;
  setAbortRun: (abortRun: (() => void) | null) => void;
  setRetryRun: (retryRun: (() => void) | null) => void;
  setActiveSkill: (skill: ActiveSkill | null) => void;
  setPendingSelectionReview: (review: PendingSelectionReview | null) => void;
  /** Dismiss the Skill Components floater: abort any in-flight run and clear
   *  its run state, leaving the editor body untouched. */
  closeSkillFloater: () => void;
};

export const usePromptStore = create<PromptState>((set, get) => ({
  body: "",
  editingId: null,
  result: null,
  thinking: null,
  grounding: null,
  isSending: false,
  error: null,
  metrics: null,
  abortRun: null,
  retryRun: null,
  activeSkill: null,
  pendingSelectionReview: null,

  setBody: (body) => set({ body }),
  reset: () => {
    // Cancel any in-flight stream first: after this, its onText/abort paths
    // see an aborted signal and skip all further store writes.
    get().abortRun?.();
    set({
      body: "",
      editingId: null,
      result: null,
      thinking: null,
      grounding: null,
      error: null,
      isSending: false,
      metrics: null,
      abortRun: null,
      retryRun: null,
      activeSkill: null,
      pendingSelectionReview: null,
    });
  },
  loadFromPrompt: (prompt) =>
    set({ body: prompt.body, editingId: prompt.id }),

  setResult: (result) => set({ result }),
  setThinking: (thinking) => set({ thinking }),
  setGrounding: (grounding) => set({ grounding }),
  setSending: (isSending) => set({ isSending }),
  setError: (error) => set({ error }),
  setMetrics: (metrics) => set({ metrics }),
  setAbortRun: (abortRun) => set({ abortRun }),
  setRetryRun: (retryRun) => set({ retryRun }),
  setActiveSkill: (activeSkill) => set({ activeSkill }),
  setPendingSelectionReview: (pendingSelectionReview) =>
    set({ pendingSelectionReview }),
  closeSkillFloater: () => {
    get().abortRun?.();
    set({
      activeSkill: null,
      result: null,
      thinking: null,
      grounding: null,
      error: null,
      isSending: false,
      metrics: null,
      abortRun: null,
      retryRun: null,
    });
  },
}));
