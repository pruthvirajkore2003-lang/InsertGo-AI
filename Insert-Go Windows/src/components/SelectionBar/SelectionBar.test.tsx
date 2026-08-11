/**
 * Selection skill bar contract (mirrors SkillButtons.test.tsx): the bar ranks
 * skills for the selection's context and shows ALL of them at once as the
 * large toolbar. With a provider, an icon click hands the skill + selection
 * to the main palette via `open_selection_review` (the run streams into the
 * Skill Components floater there — the bar itself no longer runs the provider
 * or pastes); with no provider (logged out) it shows a login notice and never
 * touches the selection.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SKILLS } from "@/services/skills";
import { useAuthStore } from "@/store/authStore";
import { SelectionBar } from "./SelectionBar";

const { invokeMock, listenHandlers, sendMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenHandlers: {} as Record<string, (e: { payload: unknown }) => void>,
  sendMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: () => false,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, cb: (e: { payload: unknown }) => void) => {
    listenHandlers[event] = cb;
    return Promise.resolve(() => {});
  },
}));

vi.mock("@/services/aiProviders", () => ({
  createProvider: () => ({ send: sendMock }),
}));

// The bar loads settings on mount (fresh webview context); reject so the
// store keeps its test-controlled state.
vi.mock("@/services/tauriBridge", () => ({
  loadSettings: vi.fn().mockRejectedValue(new Error("no tauri in tests")),
  isTauri: () => false,
}));

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined);
  sendMock.mockReset();
  localStorage.clear();
  // Signed in by default: the session token IS the lane (one hosted relay), so
  // without it the bar renders the login panel INSTEAD of the skill row. The
  // logged-out branch is covered by its own case below.
  useAuthStore.setState({ token: "test-token", error: null });
});

/** Render the bar and deliver a `selection:show` with `text`. */
async function showSelection(text: string, placement?: "above" | "below") {
  render(<SelectionBar />);
  await act(async () => {
    listenHandlers["selection:show"]({ payload: { text, placement } });
  });
}

describe("SelectionBar", () => {
  it("renders nothing until a selection arrives, then every skill at once", async () => {
    render(<SelectionBar />);
    await act(async () => {});
    // Idle: the shell stays mounted but is aria-hidden, so nothing is exposed
    // to the a11y tree (no toolbar, no buttons) until a selection arrives.
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    await act(async () => {
      listenHandlers["selection:show"]({ payload: { text: "my draft" } });
    });

    // The large toolbar: all skills visible at once (no overflow toggle),
    // plus the trailing "More" button that opens the floater's skill picker.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(SKILLS.length + 1);
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(buttons[buttons.length - 1].getAttribute("aria-label")).toBe("More");
    expect(new Set(buttons.map((b) => b.getAttribute("aria-label"))).size).toBe(
      SKILLS.length + 1
    );
    // Icons render for each button (skills + More).
    expect(document.querySelectorAll("i.fa-solid")).toHaveLength(
      SKILLS.length + 1
    );
  });

  it("ranks translation first for a non-Latin selection", async () => {
    await showSelection("こんにちは、これは日本語のテキストです");
    // Foreign context → translate-this leads.
    expect(
      screen.getByRole("button", { name: "Translate This" })
    ).toBeInTheDocument();
    // It is the first button in the pill.
    const first = screen.getAllByRole("button")[0];
    expect(first.getAttribute("aria-label")).toBe("Translate This");
  });

  it("hands the skill + selection to the palette for floater review", async () => {
    await showSelection("my draft");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Summarize This" }));
    });

    // No local run, no direct paste — review happens in the palette.
    expect(sendMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith(
      "apply_to_selection",
      expect.anything()
    );
    expect(invokeMock).toHaveBeenCalledWith("open_selection_review", {
      skillId: "summarize-this",
      icon: "fa-align-left",
      text: "my draft",
    });
  });

  it("More hands the selection over with no skill (floater opens its picker)", async () => {
    await showSelection("my draft");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "More" }));
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("open_selection_review", {
      skillId: null,
      icon: null,
      text: "my draft",
    });
  });

  it("logged out: replaces the skill row with a login notice", async () => {
    useAuthStore.setState({ token: null, error: null });
    await showSelection("my draft");

    expect(screen.getByRole("status").textContent).toBe(
      "Sign in to InsertGo to run skills"
    );
    // The skills and the More handoff are GONE, not merely disabled — there is
    // nothing to click that could reach the provider or the selection.
    expect(screen.queryByRole("button", { name: "Translate This" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
    expect(sendMock).not.toHaveBeenCalled();
    // Crucially: no handoff, and no paste over the user's live selection.
    expect(invokeMock).not.toHaveBeenCalledWith(
      "open_selection_review",
      expect.anything()
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      "apply_to_selection",
      expect.anything()
    );
  });

  it("shows an error notice when the palette handoff fails", async () => {
    invokeMock.mockRejectedValue(new Error("handoff exploded"));
    await showSelection("my draft");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Improve This" }));
    });

    expect(invokeMock).not.toHaveBeenCalledWith(
      "apply_to_selection",
      expect.anything()
    );
    expect(screen.getByRole("status").textContent).toBe("handoff exploded");
  });

  it("points the caret per the backend placement", async () => {
    await showSelection("my draft", "below");
    expect(document.querySelector(".ig-selbar-shell--below")).toBeInTheDocument();
  });

  it("hides the bar but keeps it mounted on selection:hide", async () => {
    await showSelection("my draft");
    expect(
      screen.getByRole("button", { name: "Summarize This" })
    ).toBeEnabled();

    await act(async () => {
      listenHandlers["selection:hide"]({ payload: undefined });
    });
    // Idle ⇒ removed from the a11y tree (aria-hidden), so role/button queries
    // find nothing…
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // …but the shell stays mounted (no remount / glyph reflow on the next
    // show) and is marked hidden.
    const shell = document.querySelector(".ig-selbar-shell");
    expect(shell).not.toBeNull();
    expect(shell).toHaveClass("ig-selbar-shell--hidden");
    expect(shell).toHaveAttribute("aria-hidden", "true");
  });
});
