/**
 * runInlineRefine status contract: the "done" chip must say when the run
 * degraded to a draft-only condense (conversation capture came back empty),
 * so the user knows why the refined prompt carries no on-screen context.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isTauri: () => false,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));
vi.mock("@/services/improveAdapters", () => ({
  resolveImproveAdapter: vi.fn(() => ({
    targetProfile: "test profile",
    supportsDynamicRefine: true,
  })),
  isPlaceholderText: vi.fn(() => false),
}));
vi.mock("@/services/lanes", () => ({
  resolveActiveProvider: vi.fn(async () => ({
    provider: { send: vi.fn() },
    requiresLogin: false,
  })),
}));
vi.mock("@/services/promptRefiner", () => ({
  runDynamicRefine: vi.fn(async () => "REFINED PROMPT"),
}));
vi.mock("@/store/authStore", () => ({
  useAuthStore: { getState: () => ({ user: null }) },
}));

import { runInlineRefine, type RefineContextPayload } from "./inlineImprove";

function payload(conversation: string | null): RefineContextPayload {
  return {
    draft: "make it faster pls",
    conversation,
    processName: "chrome.exe",
    windowTitle: "Claude",
  };
}

function statusCalls() {
  return invoke.mock.calls.filter(([cmd]) => cmd === "improve_status");
}

beforeEach(() => {
  invoke.mockClear();
});

describe("runInlineRefine status chip", () => {
  it("reports plain done when conversation context was captured", async () => {
    await runInlineRefine(payload("User: earlier turn\nAssistant: reply"));

    const done = statusCalls();
    expect(done).toHaveLength(1);
    expect(done[0][1]).toEqual({
      state: "done",
      message: "Refined — Ctrl+Alt+Z to undo",
    });
  });

  it("reports the draft-only degradation when conversation is null", async () => {
    await runInlineRefine(payload(null));

    const done = statusCalls();
    expect(done).toHaveLength(1);
    expect(done[0][1]).toEqual({
      state: "done",
      message:
        "Refined from your draft only — open the chat so its text is on screen. Ctrl+Alt+Z to undo",
    });
  });

  it("treats a whitespace-only conversation as draft-only", async () => {
    await runInlineRefine(payload("   \n "));

    const done = statusCalls();
    expect(done[0][1]).toMatchObject({ state: "done" });
    expect((done[0][1] as { message: string }).message).toContain(
      "draft only"
    );
  });
});
