import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

const saveSettings = vi.fn<(settings: Settings) => Promise<Settings>>();

vi.mock("@/services/tauriBridge", () => ({
  saveSettings: (settings: Settings) => saveSettings(settings),
}));

import { useSettingsStore } from "./settingsStore";

beforeEach(() => {
  saveSettings.mockReset();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    error: null,
  });
});

describe("overlapping settings writes", () => {
  it("drops only a failed mutation and persists newer fields afterward", async () => {
    let rejectFirst!: (error: Error) => void;
    saveSettings
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          })
      )
      .mockImplementationOnce(async (settings) => settings);

    const first = useSettingsStore
      .getState()
      .update({ hasCompletedOnboarding: true });
    const second = useSettingsStore.getState().update({ theme: "light" });

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings).toMatchObject({
      hasCompletedOnboarding: true,
      theme: "light",
    });

    rejectFirst(new Error("disk busy"));
    await Promise.all([first, second]);

    expect(saveSettings).toHaveBeenCalledTimes(2);
    expect(saveSettings.mock.calls[1][0]).toMatchObject({
      hasCompletedOnboarding: false,
      theme: "light",
    });
    expect(useSettingsStore.getState().settings).toMatchObject({
      hasCompletedOnboarding: false,
      theme: "light",
    });
  });
});
