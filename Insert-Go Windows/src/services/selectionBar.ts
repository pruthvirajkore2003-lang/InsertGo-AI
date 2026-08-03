/**
 * Bridge for the selection skill bar window — invoke/listen wrappers around
 * the `skillbar` commands and events, keeping raw command/event names out of
 * components (same choke-point idea as tauriBridge.ts).
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Rust command identifiers — must match `#[tauri::command]` fn names. */
export const SelectionCommands = {
  applyToSelection: "apply_to_selection",
  hideSelectionBar: "hide_selection_bar",
  openSelectionReview: "open_selection_review",
  hideSelectionFloater: "hide_selection_floater",
  selectionFloaterInsert: "selection_floater_insert",
} as const;

/** Which side of the selection the bar was placed on (caret direction). */
export type SelectionPlacement = "above" | "below";

export type SelectionShowPayload = {
  text: string;
  /** Optional for resilience against an older backend that omits it; the bar
   *  defaults to "above" (the common case) when absent. */
  placement?: SelectionPlacement;
};

/** `selection:review` payload — a bar click handed to the dedicated
 *  selection review floater window (`selfloater`). `icon` is the bar's
 *  resolved FA class (the icon maps live per-window by design). A null
 *  `skillId` is the bar's "More" handoff: the floater opens in its
 *  skill-picker state instead of starting a run. */
export type SelectionReviewPayload = {
  skillId: string | null;
  icon: string | null;
  text: string;
};

/** Paste `text` over the live selection in the captured target window. */
export function applyToSelection(text: string): Promise<void> {
  return invoke(SelectionCommands.applyToSelection, { text });
}

/** Hide the bar (Esc affordance, notice timeouts). */
export function hideSelectionBar(): Promise<void> {
  return invoke(SelectionCommands.hideSelectionBar);
}

/** Hand a bar click to the selection review floater window: hides the bar,
 *  moves the paste target to `PriorWindow`, emits `selection:review` to the
 *  floater window and shows it. The main palette never opens. A null
 *  `skillId` (the bar's "More" button) opens the floater's skill picker for
 *  the selection instead of starting a run. */
export function openSelectionReview(
  skillId: string | null,
  icon: string | null,
  text: string
): Promise<void> {
  return invoke(SelectionCommands.openSelectionReview, { skillId, icon, text });
}

/** Hide the selection review floater window (Esc / close / after Apply). */
export function hideSelectionFloater(): Promise<void> {
  return invoke(SelectionCommands.hideSelectionFloater);
}

/** Paste the reviewed draft over the original selection via the shared
 *  insert pipeline, hiding the FLOATER window (not the palette) first.
 *  Resolves `true` when the paste landed; `false` when the text was left on
 *  the clipboard (the `insert:fallback` event fires and the floater window
 *  is re-shown for retry). */
export function selectionFloaterInsert(text: string): Promise<boolean> {
  return invoke(SelectionCommands.selectionFloaterInsert, { text });
}

/** New selection read — the bar is about to be shown with this text. */
export function onSelectionShow(
  cb: (payload: SelectionShowPayload) => void
): Promise<UnlistenFn> {
  return listen<SelectionShowPayload>("selection:show", (e) => cb(e.payload));
}

/** The bar was hidden backend-side — reset UI state, abort in-flight runs. */
export function onSelectionHide(cb: () => void): Promise<UnlistenFn> {
  return listen("selection:hide", () => cb());
}

/** Paste couldn't land; the result is on the clipboard — tell the user. */
export function onSelectionFallback(cb: () => void): Promise<UnlistenFn> {
  return listen("selection:fallback", () => cb());
}

/** Floater-window side: a bar skill click arrived for review. */
export function onSelectionReview(
  cb: (payload: SelectionReviewPayload) => void
): Promise<UnlistenFn> {
  return listen<SelectionReviewPayload>("selection:review", (e) =>
    cb(e.payload)
  );
}
