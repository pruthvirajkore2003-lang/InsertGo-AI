/**
 * Settings › Access: the contracts that must not regress. The load-bearing one
 * is that a failed permission probe never becomes a dead end — nothing is
 * probed behind the user's back, and an unreadable status stays "unknown"
 * rather than becoming a red state they cannot act on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

const permissionReport = vi.fn();
const setAutostartMock = vi.fn(async (enabled: boolean) => enabled);

vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  loadSettings: vi.fn(),
  saveSettings: vi.fn(async (s: Settings) => s),
  sessionTokenSet: vi.fn(async () => {}),
  sessionTokenGet: vi.fn(async () => null),
  sessionTokenDelete: vi.fn(async () => {}),
  getHardwareId: vi.fn(async () => "hw"),
  checkPermissions: () => permissionReport(),
  setAutostart: (enabled: boolean) => setAutostartMock(enabled),
}));

import * as bridge from "@/services/tauriBridge";
import { PermissionsPanel } from "@/components/Permissions/PermissionsPanel";
import { usePermissionsStore } from "@/store/permissionsStore";
import { useSettingsStore } from "@/store/settingsStore";

beforeEach(() => {
  usePermissionsStore.getState().reset();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    hasLoaded: true,
  });
  permissionReport.mockReset().mockResolvedValue({
    accessibility: "granted",
    globalHotkey: "granted",
    clipboard: "granted",
    autostart: "off",
    elevated: false,
  });
  setAutostartMock.mockClear();
  vi.mocked(bridge.saveSettings).mockClear();
});

describe("Settings › Access", () => {
  it("never probes on its own — cards start unknown until asked", () => {
    render(<PermissionsPanel />);

    expect(Object.values(usePermissionsStore.getState().permissions)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ]);
    expect(permissionReport).not.toHaveBeenCalled();
  });

  it("shows all four capabilities with why hidden behind Learn more and no audio card", () => {
    render(<PermissionsPanel />);

    // One Check button per card — four cards, no microphone among them.
    expect(screen.getAllByRole("button", { name: "Check" })).toHaveLength(4);
    expect(screen.getAllByText("Not checked")).toHaveLength(4);
    expect(screen.queryByText(/microphone|audio|voice/i)).toBeNull();
    // The verbose "why" is hidden by default to reduce cognitive load.
    expect(
      screen.queryByText(/only at the moment you select it/)
    ).not.toBeInTheDocument();
    // It is reachable through the Learn-more control.
    fireEvent.click(
      screen.getByRole("button", {
        name: "Learn more about Read the text you select",
      })
    );
    expect(
      screen.getByText(/only at the moment you select it/)
    ).toBeInTheDocument();
  });

  it("surfaces recovery steps for a blocked hotkey instead of a dead end", async () => {
    permissionReport.mockResolvedValue({
      accessibility: "granted",
      globalHotkey: "blocked",
      clipboard: "granted",
      autostart: "off",
      elevated: false,
    });
    render(<PermissionsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Check all" }));

    await waitFor(() =>
      expect(screen.getByText("In use elsewhere")).toBeInTheDocument()
    );
    expect(screen.getByText(/Another app already owns this chord/)).toBeInTheDocument();
  });

  it("explains UIPI when running unelevated so a silent no-op isn't a mystery", async () => {
    render(<PermissionsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Check all" }));

    await waitFor(() =>
      expect(screen.getByText(/Run as administrator/)).toBeInTheDocument()
    );
  });

  it("reports a probe that could not run instead of faking a denial", async () => {
    permissionReport.mockRejectedValue(new Error("not in tauri"));
    await usePermissionsStore.getState().checkPermissions();

    const state = usePermissionsStore.getState();
    expect(state.probeError).toContain("not in tauri");
    // Back to "unknown" — never a red status the user cannot act on.
    expect(state.permissions.accessibility).toBe("unknown");
  });

  it("coerces an unrecognized backend status to unavailable, not garbage", async () => {
    permissionReport.mockResolvedValue({
      accessibility: "something-new",
      globalHotkey: "blocked",
      clipboard: "granted",
      autostart: "off",
      elevated: true,
    });
    await usePermissionsStore.getState().checkPermissions();

    const state = usePermissionsStore.getState();
    expect(state.permissions.accessibility).toBe("unavailable");
    expect(state.permissions.globalHotkey).toBe("blocked");
    expect(state.elevated).toBe(true);
  });

  it("autostart is optional: a failure degrades to off rather than erroring out", async () => {
    setAutostartMock.mockRejectedValueOnce(new Error("registry locked"));
    render(<PermissionsPanel />);

    fireEvent.click(screen.getByLabelText("Start InsertGo when I sign in"));
    await waitFor(() =>
      expect(usePermissionsStore.getState().permissions.autostart).toBe("off")
    );
  });
});
