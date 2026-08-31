import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  saveSettings: vi.fn(async (s: Settings) => s),
  loadSettings: vi.fn(),
  getHardwareId: vi.fn(async () => "hw"),
}));
import { useSettingsStore } from "@/store/settingsStore";
import { useMonetizationStore } from "@/store/monetizationStore";
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
  localStorage.clear();
  useMonetizationStore.setState({ currency: "USD" });
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

  it("states the auto-renewal terms next to every live paid CTA", () => {
    // California ARL §17601(c) / FTC ROSCA: the disclosure has to be in visual
    // proximity to the control that consents to the recurring charge. This
    // button opens a real Dodo checkout, so the website's pricing page is not
    // the only surface that owes the notice.
    useAuthStore.setState({ user: null }); // signed out → paid CTAs are live
    render(<MonetizationOnboarding />);
    const notices = screen.getAllByText(/renews automatically each month/i);
    expect(notices).toHaveLength(PAID.length);
    for (const n of notices) {
      expect(n).toHaveTextContent(/until you cancel/i);
      expect(n).toHaveTextContent(/cancel any time in account settings/i);
    }
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

describe("single-currency display", () => {
  const plus = () => FALLBACK_PLANS.find((p) => p.tier === "plus")!;

  it("renders no manual currency switcher", () => {
    render(<MonetizationOnboarding />);
    expect(
      screen.queryByRole("group", { name: "Display currency" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /INR/ })).toBeNull();
  });

  it("shows USD prices from the catalog, and no other currency", () => {
    render(<MonetizationOnboarding />);
    expect(screen.getByText("$7.99 / month")).toBeInTheDocument();
    expect(plus().price.USD).toBe(7.99);
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it("states the prices are tax-exclusive rather than itemising a tax", () => {
    // Dodo adds the buyer's regional tax at its hosted checkout, so the page
    // may not imply the figure is the final one — that is the drip.
    render(<MonetizationOnboarding />);
    expect(screen.getByText(/exclude tax/i)).toBeInTheDocument();
    expect(screen.queryByText(/GST/i)).toBeNull();
  });

  it("keeps the renewal disclosure's tax wording currency-neutral", () => {
    useAuthStore.setState({ user: null }); // signed out → paid CTAs are live
    render(<MonetizationOnboarding />);
    const notes = screen.getAllByText(/renews automatically each month/i);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n).toHaveTextContent(/plus tax/i);
    }
  });
});
