import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  saveSettings: vi.fn(async (s: Settings) => s),
  loadSettings: vi.fn(),
  getHardwareId: vi.fn(async () => "hw"),
}));
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import {
  FALLBACK_PLANS,
  MonetizationOnboarding,
} from "./MonetizationOnboarding";

/** The paid tiers, by the names the cards actually render (offline catalog —
 *  the fetch is never resolved in these tests). */
const PAID = FALLBACK_PLANS.filter((p) => p.tier);

beforeEach(() => {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
});

describe("MonetizationOnboarding", () => {
  it("presents every tier with the relay named in the data route", () => {
    render(<MonetizationOnboarding />);
    for (const plan of FALLBACK_PLANS) {
      expect(
        screen.getByRole("list", { name: `What ${plan.name} includes` })
      ).toBeInTheDocument();
    }
    // The route diagram is the transparency promise — the relay must be in it.
    expect(
      screen.getByRole("img", { name: /through the InsertGo relay/i })
    ).toBeInTheDocument();
    // setup.ts user is subscribed → every plan CTA is already satisfied.
    expect(screen.getByRole("button", { name: "Free tier" })).toBeDisabled();
    const active = screen.getAllByRole("button", {
      name: "Subscription active",
    });
    expect(active).toHaveLength(PAID.length);
    active.forEach((cta) => expect(cta).toBeDisabled());
  });

  it("offers sign-in rather than checkout to a signed-out user", () => {
    useAuthStore.setState({ user: null });
    render(<MonetizationOnboarding />);
    expect(
      screen.getByRole("button", { name: "Sign in to start free" })
    ).toBeEnabled();
    for (const plan of PAID) {
      expect(
        screen.getByRole("button", { name: `Sign in for ${plan.name}` })
      ).toBeEnabled();
    }
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
    // Already on Free; the paid tiers are the ones that go to checkout.
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    for (const plan of PAID) {
      expect(
        screen.getByRole("button", { name: `Get ${plan.name}` })
      ).toBeEnabled();
    }
  });
});
