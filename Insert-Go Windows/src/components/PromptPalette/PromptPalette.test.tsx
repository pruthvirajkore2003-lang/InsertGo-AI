/**
 * Stale-write guard for the streaming send path: once reset() clears the
 * palette (or the palette unmounts), an in-flight stream must be aborted and
 * its late deltas must never write into the store.
 */
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProviderSendOptions } from "@/services/aiProviders";
import { usePromptStore } from "@/store/promptStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { useHistoryStore } from "@/store/historyStore";
import { DEFAULT_SETTINGS, type ProviderConfig } from "@/types";
import { PromptPalette } from "./PromptPalette";

// Hoisted so the vi.mock factory (itself hoisted above imports) can close over it.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/services/aiProviders", () => ({
  createProvider: () => ({ send: sendMock }),
}));

// Copy goes through the clipboard service (Tauri plugin / Web API fallback);
// jsdom has no navigator.clipboard, so mock it to test the button feedback.
const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
vi.mock("@/services/clipboard", () => ({
  copyToClipboard: copyMock,
  readClipboard: vi.fn().mockResolvedValue(""),
}));

// Render probe: `canUseHistory()` is called exactly once per PromptPalette
// render (building the sub-tab list), so its call count IS the composer's
// render count. Real implementation kept — this only counts.
vi.mock("@/store/monetizationStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/store/monetizationStore")>();
  return { ...actual, canUseHistory: vi.fn(actual.canUseHistory) };
});
import { canUseHistory } from "@/store/monetizationStore";

const provider: ProviderConfig = {
  id: "p1",
  name: "Gemini",
  baseUrl: "https://generativelanguage.googleapis.com",
  apiKey: "g-test",
  isDefault: true,
};

beforeEach(() => {
  sendMock.mockReset();
  copyMock.mockReset();
  copyMock.mockResolvedValue(undefined);
  useAuthStore.setState({
    user: {
      email: "test@example.com",
      subscriptionStatus: "subscribed",
      credits: 100,
    },
    hardwareId: "test-hw-id",
  });
  usePromptStore.setState({
    body: "",
    editingId: null,
    result: null,
    thinking: null,
    isSending: false,
    error: null,
    metrics: null,
    abortRun: null,
    activeSkill: null,
    pendingSelectionReview: null,
  });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    providers: [],
    selectedProviderId: null,
  });
  useToastStore.setState({ toasts: [] });
});

/** Arm the never-resolving send mock and the store state a run needs; call
 *  before render so the palette mounts with a runnable draft. */
function armRun(): { opts: () => ProviderSendOptions } {
  let captured: ProviderSendOptions | undefined;
  sendMock.mockImplementation(
    (_req: unknown, sendOpts: ProviderSendOptions) => {
      captured = sendOpts;
      return new Promise(() => {}); // stream stays "in flight" for the test
    }
  );
  usePromptStore.setState({ body: "draft" });
  useSettingsStore.setState({ providers: [provider] });
  return {
    opts: () => {
      if (!captured) throw new Error("send was not given streaming options");
      return captured;
    },
  };
}

/** Flush pending microtasks — the send path now awaits async lane resolution
 *  (settings + credential store) before calling `send`. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Start a run (Ctrl+Enter — the composer has no Send button) and return the
 *  streaming options the palette handed to send. Awaits the async lane
 *  resolution that precedes the send call. */
async function startRun(
  armed: { opts: () => ProviderSendOptions }
): Promise<ProviderSendOptions> {
  fireEvent.keyDown(screen.getByPlaceholderText(/prompt to improve/), {
    key: "Enter",
    ctrlKey: true,
  });
  await flush();
  expect(sendMock).toHaveBeenCalledTimes(1);
  return armed.opts();
}

describe("PromptPalette streaming lifecycle", () => {
  it("hides the composer from a signed-out user (the relay needs a session)", () => {
    useAuthStore.setState({ user: null });

    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    expect(
      screen.queryByPlaceholderText(/prompt to improve/)
    ).not.toBeInTheDocument();
  });

  it("renders streamed deltas live, then reset() aborts and blocks further writes", async () => {
    const armed = armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);
    const opts = await startRun(armed);

    act(() => opts.onText!("hello", "hello"));
    expect(usePromptStore.getState().result).toBe("hello");
    expect(usePromptStore.getState().metrics?.chars).toBe(5);
    expect(opts.signal!.aborted).toBe(false);

    act(() => usePromptStore.getState().reset());
    expect(opts.signal!.aborted).toBe(true);
    expect(usePromptStore.getState().result).toBeNull();

    // A delta that raced past the abort must not resurrect the cleared UI.
    act(() => opts.onText!(" world", "hello world"));
    expect(usePromptStore.getState().result).toBeNull();
    expect(usePromptStore.getState().metrics).toBeNull();
    expect(usePromptStore.getState().isSending).toBe(false);
  });

  // Perf regression guard: a bare `usePromptStore()` in the palette (or in
  // useProviderRun) subscribes to the whole store, so every streamed
  // setResult/setThinking/setMetrics re-rendered the entire composer — tabs,
  // both editors, the picker and the skill ribbon — ~60x/s. Only the result
  // floater, which selects `result`/`thinking`/`metrics`, may repaint.
  it("does not re-render the composer on streamed deltas", async () => {
    const armed = armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);
    const opts = await startRun(armed);

    const renders = () => vi.mocked(canUseHistory).mock.calls.length;
    const before = renders();
    act(() => {
      opts.onText!("hello", "hello");
      usePromptStore.getState().setThinking("analysis…");
      usePromptStore.getState().setResult("hello");
    });

    expect(usePromptStore.getState().result).toBe("hello");
    expect(renders()).toBe(before);
  });

  it("aborts the in-flight stream on unmount", async () => {
    const armed = armRun();
    const { unmount } = render(
      <PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />
    );
    const opts = await startRun(armed);

    unmount();
    expect(opts.signal!.aborted).toBe(true);

    act(() => opts.onText!("late", "late"));
    expect(usePromptStore.getState().result).toBeNull();
  });

  it("ignores a staged selection review: reviews live in the floater window now", async () => {
    armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    // Even if a selection review somehow lands in the palette's store, the
    // palette does not consume it — no run starts and the composer stays up.
    act(() =>
      usePromptStore.getState().setPendingSelectionReview({
        skillId: "summarize-this",
        icon: "fa-align-left",
        text: "selected text",
      })
    );
    await flush();

    expect(sendMock).not.toHaveBeenCalled();
    expect(usePromptStore.getState().activeSkill).toBeNull();
    expect(screen.getByPlaceholderText(/prompt to improve/)).toBeInTheDocument();
  });

  it("renders Improvise / Skills / History sub-tabs, Improvise active by default", () => {
    armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    const sub = within(
      screen.getByRole("tablist", { name: "Composer views" })
    ).getAllByRole("tab");
    expect(sub.map((t) => t.textContent)).toEqual([
      "Improvise",
      "Skills",
      "History",
    ]);

    // Improvise is the default sub-tab: its editor + full skill ribbon.
    expect(screen.getByPlaceholderText(/prompt to improve/)).toHaveValue("draft");
    expect(
      screen.getByRole("toolbar", { name: "Prompt skills" })
    ).toBeInTheDocument();

    // The old two-mode composer (Improvise/Create segmented control) is gone.
    expect(screen.queryByRole("tablist", { name: "Composer mode" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Create" })).toBeNull();
    expect(screen.queryByPlaceholderText(/want to create/)).toBeNull();

    // Improvise action row is Copy/Insert/Save only: Refiner, Manage and Send
    // were removed — Ctrl+Enter is the run path, Skills tab manages skills.
    for (const name of ["Refiner", "Manage skills", "Send"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();
  });

  it("Skills sub-tab renders the Skill Manager panel", () => {
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    // Not mounted until the sub-tab is selected.
    expect(
      screen.queryByRole("heading", { name: "Manage Skills" })
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Skills" }));

    expect(
      screen.getByRole("heading", { name: "Manage Skills" })
    ).toBeInTheDocument();
    // The old Library sub-tab is gone entirely.
    expect(screen.queryByRole("tab", { name: "Library" })).toBeNull();
  });

  it("gates History for a free user: locked tab, gate renders without error", () => {
    // Trial/no-history user — not entitled (beforeEach's subscribed user is).
    useAuthStore.setState({
      user: { email: "free@example.com", subscriptionStatus: "trial", credits: 0 },
    });
    useHistoryStore.setState({ entries: [] });
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    const historyTab = screen.getByRole("tab", { name: /History/ });
    expect(
      within(historyTab).getByRole("img", { name: "Requires Pro" })
    ).toBeInTheDocument();

    // Clicking still renders the gated panel (empty state), never throwing.
    fireEvent.click(historyTab);
    expect(screen.getByText(/No history yet/)).toBeInTheDocument();
  });

  it("records a completed editor run and reuses it from History", () => {
    useHistoryStore.setState({ entries: [] });
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    // Simulate the run pipeline's authoritative completion: result + metrics
    // set, then isSending flips false. The palette's subscription records it.
    act(() => {
      usePromptStore.setState({ body: "recorded prompt", isSending: true });
      usePromptStore.setState({
        result: "done",
        metrics: { ttftMs: 10, totalMs: 1234, chars: 4, outputTokens: 42 },
      });
      usePromptStore.setState({ isSending: false });
    });

    expect(useHistoryStore.getState().entries).toHaveLength(1);
    expect(useHistoryStore.getState().entries[0].body).toBe("recorded prompt");

    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("recorded prompt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reuse/ }));
    expect(usePromptStore.getState().body).toBe("recorded prompt");
    expect(screen.getByPlaceholderText(/prompt to improve/)).toHaveValue(
      "recorded prompt"
    );
  });

  it("shows the empty-editor guidance on Improvise only when there is no text", () => {
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);
    expect(
      screen.getByText(/pick a skill to improve it/)
    ).toBeInTheDocument();

    act(() => usePromptStore.setState({ body: "some draft" }));
    expect(screen.queryByText(/pick a skill to improve it/)).toBeNull();
  });

  it("Copy writes the draft and flashes 'Copied!' feedback", async () => {
    act(() => usePromptStore.setState({ body: "my draft" }));
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    fireEvent.click(screen.getByRole("button", { name: /Copy prompt/ }));

    expect(copyMock).toHaveBeenCalledWith("my draft");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("Ctrl+Enter in the Improvise editor sends the Improvise body", async () => {
    armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/prompt to improve/), {
      key: "Enter",
      ctrlKey: true,
    });
    await flush();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendMock.mock.calls[0][0])).toContain("draft");
  });

  it("keeps the composer mounted behind the floater for an editor-flow run", () => {
    armRun();
    render(<PromptPalette editorRef={createRef<HTMLTextAreaElement>()} />);

    // Editor-flow skill run (SkillButtons path): floater opens as an overlay.
    act(() =>
      usePromptStore.getState().setActiveSkill({
        id: "summarize-this",
        label: "Summarize This",
        icon: "fa-align-left",
        source: "editor",
      })
    );

    expect(
      screen.getByRole("dialog", { name: "Skill Components" })
    ).toBeInTheDocument();
    // Unlike the selection flow, the composer stays mounted underneath.
    expect(
      screen.getByRole("toolbar", { name: "Prompt skills" })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Type or paste a prompt/)
    ).toBeInTheDocument();
  });
});
