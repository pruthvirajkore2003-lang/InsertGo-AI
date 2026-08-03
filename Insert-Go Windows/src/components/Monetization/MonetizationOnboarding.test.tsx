import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  saveSettings: vi.fn(async (s: Settings) => s),
  loadSettings: vi.fn(),
  loadProviders: vi.fn(),
  getHardwareId: vi.fn(async () => "hw"),
}));
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { MonetizationOnboarding } from "./MonetizationOnboarding";

beforeEach(() => {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
});

describe("MonetizationOnboarding", () => {
  it("presents the managed plan with the relay named in the data route", () => {
    render(<MonetizationOnboarding />);
    expect(screen.getByText("InsertGo Pro · Managed")).toBeInTheDocument();
    // The route diagram is the transparency promise — the relay must be in it.
    expect(
      screen.getByRole("img", { name: /through the InsertGo relay/i })
    ).toBeInTheDocument();
    // setup.ts user is subscribed → already on this plan.
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
  });

  it("offers sign-in rather than checkout to a signed-out user", () => {
    useAuthStore.setState({ user: null });
    render(<MonetizationOnboarding />);
    expect(
      screen.getByRole("button", { name: "Sign in for managed" })
    ).toBeEnabled();
  });

  it("offers the upgrade to a signed-in user without a subscription", () => {
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@example.com",
        subscriptionStatus: "trial",
        credits: 5,
      },
    });
    render(<MonetizationOnboarding />);
    expect(
      screen.getByRole("button", { name: "Upgrade to Pro" })
    ).toBeEnabled();
  });
});
