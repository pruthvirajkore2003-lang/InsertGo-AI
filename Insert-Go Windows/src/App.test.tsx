import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "@/types";

// Keep the always-mounted Tauri listeners inert in jsdom.
vi.mock("@/hooks/useHotkey", () => ({ useHotkey: () => {} }));
vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  loadSettings: vi.fn().mockRejectedValue(new Error("no tauri in tests")),
  saveSettings: vi.fn((s) => Promise.resolve(s)),
  sessionTokenGet: vi.fn().mockResolvedValue(null),
  sessionTokenSet: vi.fn().mockResolvedValue(undefined),
  sessionTokenDelete: vi.fn().mockResolvedValue(undefined),
  getHardwareId: vi.fn().mockResolvedValue("hw"),
}));

import App from "./App";
import { useAuthStore } from "@/store/authStore";
import { useLicenseStore } from "@/store/licenseStore";
import { useSettingsStore } from "@/store/settingsStore";

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  useLicenseStore.setState({ upsellFeature: null });
});

describe("App tabs", () => {
  it("renders three tabs: Composer, Settings, Profile", () => {
    render(<App />);
    // Scope to the header nav — the composer also mounts its own nested
    // sub-tab tablist (Improvise / Skills / History).
    const tabs = within(
      screen.getByRole("tablist", { name: "Views" })
    ).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Composer",
      "Settings",
      "Profile",
    ]);
  });

  it("nests Improvise / Skills / History sub-tabs under Composer (not top-level)", () => {
    render(<App />);
    const topTabs = within(screen.getByRole("tablist", { name: "Views" }));
    // Skills is no longer a top-level view, and Library is gone entirely.
    expect(topTabs.queryByRole("tab", { name: "Skills" })).toBeNull();
    expect(topTabs.queryByRole("tab", { name: "Library" })).toBeNull();
    // Skills is a composer sub-tab now, alongside Improvise and History.
    const sub = within(
      screen.getByRole("tablist", { name: "Composer views" })
    ).getAllByRole("tab");
    expect(sub.map((t) => t.textContent)).toEqual([
      "Improvise",
      "Skills",
      "History",
    ]);
  });

  it("gates a signed-out user behind sign-in", () => {
    useAuthStore.setState({ user: null });

    render(<App />);

    // Every request goes through the managed relay, which needs a session —
    // there is no route that unlocks the app without one.
    expect(
      screen.getByRole("button", { name: "Sign in with browser" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: "Views" })
    ).not.toBeInTheDocument();
  });

});

describe("first run", () => {
  // Setup was removed: a fresh install goes straight to the thing that
  // actually blocks (the session), never to a wizard. The persisted flag is
  // kept for the Rust settings contract but drives no UI.
  it("lands a fresh install on sign-in, with no setup screen ahead of it", () => {
    useAuthStore.setState({ user: null });
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, hasCompletedOnboarding: false },
      hasLoaded: true,
    });

    render(<App />);

    expect(
      screen.getByRole("button", { name: "Sign in with browser" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
