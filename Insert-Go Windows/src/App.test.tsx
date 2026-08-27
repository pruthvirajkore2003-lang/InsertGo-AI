import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  // The consent modal's two backend calls. Named here so a missing mock fails
  // loudly at the assertion rather than as an "undefined is not a function"
  // deep inside an unrelated test.
  legalConsentGranted: vi.fn().mockResolvedValue(true),
  quitApp: vi.fn().mockResolvedValue(undefined),
}));

import App from "./App";
import { LEGAL_VERSION } from "@/legal";
import { legalConsentGranted, quitApp } from "@/services/tauriBridge";
import { useAuthStore } from "@/store/authStore";
import { useLicenseStore } from "@/store/licenseStore";
import { useSettingsStore } from "@/store/settingsStore";

beforeEach(() => {
  localStorage.clear();
  // Consented by default: these tests are about the app behind the gate. The
  // gate itself is asserted in the "legal consent gate" block below.
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, acceptedTermsVersion: LEGAL_VERSION },
    hasLoaded: true,
  });
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
  // kept for the Rust settings contract but drives no UI. The ONE screen that
  // does stand ahead of sign-in is the legal gate below — it has to, because
  // the OS hooks are a property of the install, not of the session.
  it("lands a consented fresh install on sign-in, with no setup wizard", () => {
    useAuthStore.setState({ user: null });
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        hasCompletedOnboarding: false,
        acceptedTermsVersion: LEGAL_VERSION,
      },
      hasLoaded: true,
    });

    render(<App />);

    expect(
      screen.getByRole("button", { name: "Sign in with browser" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("legal consent gate", () => {
  const fresh = (over: Record<string, unknown> = {}) => {
    useAuthStore.setState({ user: null });
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, acceptedTermsVersion: null, ...over },
      hasLoaded: true,
    });
  };

  it("stands ahead of sign-in on a fresh install", () => {
    fresh();
    render(<App />);
    // Ahead of the auth gate on purpose: the keyboard/mouse hooks belong to
    // the install, and a signed-out launch used to arm them anyway.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /please read and accept/i })
    ).toBeInTheDocument();
  });

  it("re-asks when the shipped version moved on", () => {
    fresh({ acceptedTermsVersion: "1.3.0" });
    render(<App />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not flash before settings have loaded", () => {
    useAuthStore.setState({ user: null });
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, acceptedTermsVersion: null },
      hasLoaded: false,
    });
    render(<App />);
    // Pre-load defaults say "never consented" for everyone, including the user
    // who accepted months ago.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps 'Agree and Continue' disabled until the box is ticked", async () => {
    fresh();
    render(<App />);
    const agree = screen.getByRole("button", { name: "Agree and Continue" });
    // A pre-ticked box (or an always-enabled button) is not "clear affirmative
    // action" — it is the thing that makes a clickwrap unenforceable.
    const box = screen.getByRole("checkbox");
    expect(box).not.toBeChecked();
    expect(agree).toBeDisabled();

    await userEvent.click(box);
    expect(agree).toBeEnabled();
  });

  it("persists the version BEFORE telling the backend to arm the hooks", async () => {
    fresh();
    const order: string[] = [];
    const update = vi
      .spyOn(useSettingsStore.getState(), "update")
      .mockImplementation(async (patch) => {
        order.push(`persist:${patch.acceptedTermsVersion}`);
        useSettingsStore.setState({
          settings: { ...useSettingsStore.getState().settings, ...patch },
        });
      });
    vi.mocked(legalConsentGranted).mockImplementation(async () => {
      order.push("arm");
      return true;
    });

    render(<App />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(
      screen.getByRole("button", { name: "Agree and Continue" })
    );

    // Rust re-reads settings.json to decide whether to arm, so arming before
    // the write lands is a no-op that leaves the product silently inert.
    expect(order).toEqual([`persist:${LEGAL_VERSION}`, "arm"]);
    update.mockRestore();
  });

  it("does not arm anything when the acceptance could not be saved", async () => {
    fresh();
    const update = vi
      .spyOn(useSettingsStore.getState(), "update")
      .mockRejectedValue(new Error("disk full"));
    vi.mocked(legalConsentGranted).mockClear();

    render(<App />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(
      screen.getByRole("button", { name: "Agree and Continue" })
    );

    // Fail closed: a consent we cannot produce later is a consent we do not
    // have, so the hooks stay unarmed and the gate stays up.
    expect(legalConsentGranted).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Scoped to the dialog: the browser-dev-mode banner is also role="alert".
    expect(
      await within(dialog).findByText(/couldn't save your choice/i)
    ).toBeInTheDocument();
    update.mockRestore();
  });

  it("shows both documents, including the arbitration clause", async () => {
    fresh();
    render(<App />);
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByRole("tab", { name: "Terms & Conditions" })
    ).toBeInTheDocument();
    expect(dialog.getByRole("tab", { name: "Privacy Policy" })).toBeInTheDocument();
    // The waiver has to be readable in the modal, not merely referenced by it.
    // Two hits by design: the pointer in section 1 and the clause in 23.
    expect(
      dialog.getAllByText(/BINDING INDIVIDUAL ARBITRATION/, { exact: false })
    ).toHaveLength(2);
  });

  it("offers a real way out instead of trapping the user", async () => {
    fresh();
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: "Decline and quit" })
    );
    expect(vi.mocked(quitApp)).toHaveBeenCalled();
  });
});
