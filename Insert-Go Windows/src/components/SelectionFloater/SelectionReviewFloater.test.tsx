/**
 * The selection review floater window's root: a `selection:review` handoff
 * must open the Skill Components card and start the run in THIS window (the
 * palette no longer participates), and dismissing the card must hide the OS
 * window via hide_selection_floater. A handoff with a NULL skillId (the
 * bar's "More" button) shows the skill picker instead — ranked like the bar
 * — and only picking a skill there starts the run.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SKILLS } from "@/services/skills";
import type { ProviderSendOptions } from "@/services/aiProviders";
import type { SelectionReviewPayload } from "@/services/selectionBar";
import { SKILL_SYSTEM } from "@/services/skills";
import { usePromptStore } from "@/store/promptStore";
import { useHistoryStore } from "@/store/historyStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { DEFAULT_SETTINGS, type ProviderConfig } from "@/types";

// Hoisted so the vi.mock factories (themselves hoisted) can close over them.
const { sendMock, hideFloaterMock, reviewListeners } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  hideFloaterMock: vi.fn(),
  reviewListeners: [] as Array<(p: SelectionReviewPayload) => void>,
}));

vi.mock("@/services/aiProviders", () => ({
  createProvider: () => ({ send: sendMock }),
}));
vi.mock("@/services/selectionBar", () => ({
  onSelectionReview: (cb: (p: SelectionReviewPayload) => void) => {
    reviewListeners.push(cb);
    return Promise.resolve(() => {});
  },
  hideSelectionFloater: hideFloaterMock,
  selectionFloaterInsert: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => true,
  loadSettings: vi.fn().mockRejectedValue(new Error("no tauri in tests")),
  loadProviders: vi.fn().mockRejectedValue(new Error("no tauri in tests")),
  getHardwareId: vi.fn().mockResolvedValue("hw"),
}));
// The insert:fallback listener attaches directly via the Tauri event API.
vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}));

import { SelectionReviewFloater } from "./SelectionReviewFloater";

const provider: ProviderConfig = {
  id: "p1",
  name: "Gemini",
  baseUrl: "https://generativelanguage.googleapis.com",
  apiKey: "g-test",
  isDefault: true,
};

beforeEach(() => {
  sendMock.mockReset();
  hideFloaterMock.mockReset().mockResolvedValue(undefined);
  reviewListeners.length = 0;
  localStorage.clear();
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
    providers: [provider],
    selectedProviderId: null,
    // Fresh skills baseline each test — the custom-skill case below mutates
    // this and zustand's shallow merge would otherwise leak it into siblings.
    settings: {
      ...DEFAULT_SETTINGS,
      enabledSkillIds: [...DEFAULT_SETTINGS.enabledSkillIds],
      customSkills: [],
    },
  });
});

/** Flush pending microtasks (async lane resolution precedes `send`). */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Deliver a `selection:review` event to every registered listener. */
async function deliverReview(payload: SelectionReviewPayload): Promise<void> {
  await act(async () => {
    for (const cb of reviewListeners) cb(payload);
  });
  await flush();
}

describe("SelectionReviewFloater", () => {
  it("renders nothing until a review arrives", () => {
    render(<SelectionReviewFloater />);
    expect(
      screen.queryByRole("dialog", { name: "Skill Components" })
    ).toBeNull();
  });

  it("a selection:review opens the card and starts the skill run here", async () => {
    sendMock.mockImplementation(() => new Promise(() => {})); // stays in flight
    render(<SelectionReviewFloater />);

    await deliverReview({
      skillId: "summarize-this",
      icon: "fa-align-left",
      text: "selected text",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [req] = sendMock.mock.calls[0] as [
      { prompt: string; system?: string },
      ProviderSendOptions,
    ];
    expect(req.prompt).toContain("selected text");
    expect(req.system).toBe(SKILL_SYSTEM);
    // Consumed exactly once, and the card is up for that skill.
    expect(usePromptStore.getState().pendingSelectionReview).toBeNull();
    expect(usePromptStore.getState().activeSkill).toEqual({
      id: "summarize-this",
      label: "Summarize This",
      icon: "fa-align-left",
      source: "selection",
    });
    expect(
      screen.getByRole("dialog", { name: "Skill Components" })
    ).toBeInTheDocument();
  });

  it("resolves a CUSTOM skill id and opens the card (no black screen)", async () => {
    sendMock.mockImplementation(() => new Promise(() => {}));
    const s = useSettingsStore.getState().settings;
    useSettingsStore.setState({
      settings: {
        ...s,
        customSkills: [
          { id: "custom-foo", label: "Foo", template: "do foo", isCustom: true },
        ],
        enabledSkillIds: [...s.enabledSkillIds, "custom-foo"],
      },
    });
    render(<SelectionReviewFloater />);

    await deliverReview({ skillId: "custom-foo", icon: "fa-bolt", text: "sel" });

    // Before the fix, a custom id missed SKILLS → early return → blank window.
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(usePromptStore.getState().activeSkill).toEqual({
      id: "custom-foo",
      label: "Foo",
      icon: "fa-bolt",
      source: "selection",
    });
    expect(
      screen.getByRole("dialog", { name: "Skill Components" })
    ).toBeInTheDocument();
  });

  it("dismissing the card hides the floater window", async () => {
    sendMock.mockImplementation(() => new Promise(() => {}));
    render(<SelectionReviewFloater />);
    await deliverReview({
      skillId: "summarize-this",
      icon: "fa-align-left",
      text: "selected text",
    });

    act(() => usePromptStore.getState().closeSkillFloater());

    await waitFor(() => expect(hideFloaterMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("dialog", { name: "Skill Components" })
    ).toBeNull();
  });

  it("a null-skill review (the bar's More) shows the ranked picker, no run", async () => {
    render(<SelectionReviewFloater />);

    await deliverReview({
      skillId: null,
      icon: null,
      text: "こんにちは、これは日本語のテキストです",
    });

    expect(
      screen.getByRole("dialog", { name: "Pick a skill" })
    ).toBeInTheDocument();
    const toolbar = screen.getByRole("toolbar", { name: "Selection skills" });
    const buttons = within(toolbar).getAllByRole("button");
    expect(buttons).toHaveLength(SKILLS.length);
    // Same context ranking as the bar: foreign text puts translation first.
    expect(buttons[0].getAttribute("aria-label")).toBe("Translate This");
    expect(sendMock).not.toHaveBeenCalled();
    expect(usePromptStore.getState().activeSkill).toBeNull();
  });

  it("picking a skill starts that run and swaps to the review card", async () => {
    sendMock.mockImplementation(() => new Promise(() => {}));
    render(<SelectionReviewFloater />);
    await deliverReview({ skillId: null, icon: null, text: "selected text" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Summarize This" }));
    });
    await flush();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(usePromptStore.getState().activeSkill).toEqual({
      id: "summarize-this",
      label: "Summarize This",
      icon: "fa-align-left",
      source: "selection",
    });
    expect(screen.queryByRole("dialog", { name: "Pick a skill" })).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Skill Components" })
    ).toBeInTheDocument();
    // The floater window stays up for the run — no stray hide.
    expect(hideFloaterMock).not.toHaveBeenCalled();
  });

  it("records a completed skill run into local history (no selection text)", async () => {
    sendMock.mockResolvedValue({ text: "summary result", outputTokens: 7 });
    useHistoryStore.setState({ entries: [] });
    render(<SelectionReviewFloater />);

    await deliverReview({
      skillId: "summarize-this",
      icon: "fa-align-left",
      text: "selected text",
    });

    await waitFor(() =>
      expect(useHistoryStore.getState().entries).toHaveLength(1)
    );
    const [entry] = useHistoryStore.getState().entries;
    expect(entry.outputTokens).toBe(7);
    // SPEC §10: the selection text must never land in the log.
    expect(entry.body).toBe("");
    expect(entry.body).not.toContain("selected text");
  });

  it("Esc dismisses the picker and hides the floater window", async () => {
    render(<SelectionReviewFloater />);
    await deliverReview({ skillId: null, icon: null, text: "selected text" });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog", { name: "Pick a skill" })).toBeNull();
    await waitFor(() => expect(hideFloaterMock).toHaveBeenCalledTimes(1));
    expect(sendMock).not.toHaveBeenCalled();
  });
});
