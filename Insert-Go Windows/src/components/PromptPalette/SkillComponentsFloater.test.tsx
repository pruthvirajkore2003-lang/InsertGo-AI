import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { SkillComponentsFloater } from "./SkillComponentsFloater";
import { REFINE_SYSTEM, composeRefinePrompt } from "@/services/skills";
import { usePromptStore, type ActiveSkill } from "@/store/promptStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

// The selection-source Apply goes through selection_floater_insert (hide the
// floater window, paste over the original selection); mock the bridge so the
// Tauri-only path is testable.
const { floaterInsertMock } = vi.hoisted(() => ({ floaterInsertMock: vi.fn() }));
vi.mock("@/services/selectionBar", () => ({
  selectionFloaterInsert: floaterInsertMock,
}));
vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => true,
}));

// Copy goes through the clipboard service (Tauri plugin / Web API fallback);
// mock it so the button's copy + feedback are testable without a real webview.
const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
vi.mock("@/services/clipboard", () => ({
  copyToClipboard: copyMock,
}));

const SKILL: ActiveSkill = {
  id: "summarize-this",
  label: "Summarize This",
  icon: "fa-align-left",
  source: "editor",
};

function seedStores({
  result = null as string | null,
  isSending = false,
  signedIn = true,
} = {}) {
  usePromptStore.setState({
    body: "",
    editingId: null,
    result,
    thinking: null,
    isSending,
    error: null,
    metrics: null,
    abortRun: null,
    activeSkill: SKILL,
  });
  // One lane, gated on the session token: signed in ⇒ a provider exists.
  useAuthStore.setState({ token: signedIn ? "test-token" : null });
}

function renderFloater(onRun = vi.fn()) {
  const editorRef = createRef<HTMLTextAreaElement>();
  render(<SkillComponentsFloater onRun={onRun} editorRef={editorRef} />);
  return { onRun, editorRef };
}

describe("SkillComponentsFloater", () => {
  beforeEach(() => {
    floaterInsertMock.mockReset().mockResolvedValue(true);
    copyMock.mockReset().mockResolvedValue(undefined);
    seedStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the heading with the active skill's label", () => {
    renderFloater();
    expect(screen.getByText("Skill Components")).toBeInTheDocument();
    expect(screen.getByText("Summarize This")).toBeInTheDocument();
  });

  it("shows the working pulse while streaming with no visible text yet", () => {
    seedStores({ isSending: true });
    renderFloater();
    expect(screen.getByRole("status", { name: "Working" })).toBeInTheDocument();
  });

  it("shows the result text once present", () => {
    seedStores({ result: "The generated prompt." });
    renderFloater();
    expect(screen.getByText("The generated prompt.")).toBeInTheDocument();
  });

  it("streams the <analysis> reasoning as expanded thinking during the run", () => {
    seedStores({ isSending: true });
    usePromptStore.setState({ thinking: "weighing tone and length" });
    renderFloater();

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("weighing tone and length")).toBeInTheDocument();
    // The working orb stays mounted for the WHOLE pre-deliverable run, reasoning
    // or not: unmounting it when `thinking` starts restarted its rAF loop (a
    // visible blink) and left the screen empty during the transient
    // `result === ""` gap. The reasoning is an addition to that cue, not a
    // replacement for it (see the comment on the branch in the component).
    expect(screen.getByRole("status", { name: "Working" })).toBeInTheDocument();
    // Auto-expanded while there is no deliverable yet.
    expect(
      screen.getByText("weighing tone and length").closest("details")
    ).toHaveAttribute("open");
  });

  it("keeps the reasoning reachable but collapsed once the deliverable lands", () => {
    seedStores({ result: "The final artifact." });
    usePromptStore.setState({ thinking: "some earlier reasoning" });
    renderFloater();

    expect(screen.getByText("The final artifact.")).toBeInTheDocument();
    // Reasoning still in the DOM (a <details>), but collapsed, not the artifact.
    const details = screen
      .getByText("some earlier reasoning")
      .closest("details");
    expect(details).not.toHaveAttribute("open");
  });

  it("Apply commits the draft to the composer body and closes", async () => {
    seedStores({ result: "The generated prompt." });
    renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(usePromptStore.getState().body).toBe("The generated prompt.");
    expect(usePromptStore.getState().activeSkill).toBeNull();
    // Editor-source Apply never touches the external app.
    expect(floaterInsertMock).not.toHaveBeenCalled();
  });

  it("Apply for a selection-source skill pastes over the selection and closes", async () => {
    seedStores({ result: "Refined reply." });
    usePromptStore.setState({ activeSkill: { ...SKILL, source: "selection" } });
    renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(floaterInsertMock).toHaveBeenCalledWith("Refined reply.");
    // The paste landed (mock resolves true) → the card state clears.
    await waitFor(() =>
      expect(usePromptStore.getState().activeSkill).toBeNull()
    );
    // A retry copy stays in the composer for the insert:fallback case.
    expect(usePromptStore.getState().body).toBe("Refined reply.");
  });

  it("keeps the card up for retry when the selection paste falls back", async () => {
    floaterInsertMock.mockResolvedValue(false); // insert:fallback path
    seedStores({ result: "Refined reply." });
    usePromptStore.setState({ activeSkill: { ...SKILL, source: "selection" } });
    renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(floaterInsertMock).toHaveBeenCalledWith("Refined reply.");
    // Not pasted → the review stays open so Apply can be retried.
    expect(usePromptStore.getState().activeSkill).not.toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Skill Components" })
    ).toBeInTheDocument();
  });

  it("disables Apply while sending", () => {
    seedStores({ result: "partial", isSending: true });
    renderFloater();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("Edit reveals the refine bar; submitting runs the refine turn", async () => {
    seedStores({ result: "The generated prompt." });
    const { onRun } = renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Refine instruction");
    await userEvent.type(input, "make this more concise");
    await userEvent.click(screen.getByRole("button", { name: "Refine" }));
    expect(onRun).toHaveBeenCalledWith(
      composeRefinePrompt("The generated prompt.", "make this more concise"),
      REFINE_SYSTEM
    );
    // Bar stays open for further iterations, input cleared.
    expect(screen.getByLabelText("Refine instruction")).toHaveValue("");
  });

  it("hides the Edit affordance when signed out (no lane)", () => {
    seedStores({ result: "text", signedIn: false });
    renderFloater();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("Copy copies the result, toasts, and flips to the Copied! state", async () => {
    const successSpy = vi.spyOn(toast, "success");
    seedStores({ result: "The generated prompt." });
    renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyMock).toHaveBeenCalledWith("The generated prompt.");
    expect(successSpy).toHaveBeenCalledWith("Copied to clipboard");
    // Label + icon swap for feedback.
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy output" }).querySelector("i")
    ).toHaveClass("fa-check");
  });

  it("reverts the Copy button to its idle label after 2s", async () => {
    vi.useFakeTimers();
    seedStores({ result: "text" });
    renderFloater();
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    await vi.waitFor(() => expect(screen.getByText("Copied!")).toBeInTheDocument());
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(screen.getByText("Copy")).toBeInTheDocument());
  });

  it("toasts an error when the clipboard write fails", async () => {
    const errorSpy = vi.spyOn(toast, "error");
    copyMock.mockRejectedValue(new Error("blocked"));
    seedStores({ result: "text" });
    renderFloater();
    await userEvent.click(screen.getByRole("button", { name: "Copy output" }));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Failed to copy")
    );
    // No false "Copied!" feedback on failure.
    expect(screen.queryByText("Copied!")).toBeNull();
  });

  it("disables Copy when there is no result", () => {
    seedStores({ result: null });
    renderFloater();
    expect(screen.getByRole("button", { name: "Copy output" })).toBeDisabled();
  });

  it("disables Copy while sending", () => {
    seedStores({ result: "partial", isSending: true });
    renderFloater();
    expect(screen.getByRole("button", { name: "Copy output" })).toBeDisabled();
  });

  it("Escape closes the floater", () => {
    renderFloater();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(usePromptStore.getState().activeSkill).toBeNull();
  });
});
