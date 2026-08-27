import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

describe("currency toggle", () => {
  const plus = () => FALLBACK_PLANS.find((p) => p.tier === "plus")!;

  it("switches every price and its tax note together", () => {
    render(<MonetizationOnboarding />);
    expect(screen.getByText("$7.99 / month")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /INR/ }));

    // Price, and the GST line that has to travel with it — a rupee figure
    // shown without the tax added at checkout is drip pricing under the
    // CCPA's 2023 dark-pattern guidelines.
    expect(screen.getByText("₹499 / month")).toBeInTheDocument();
    expect(
      screen.getByText(`₹${plus().price.INR} + 18% GST = ₹588.82 total`)
    ).toBeInTheDocument();
    expect(screen.queryByText("$7.99 / month")).toBeNull();
  });

  it("says the toggle changes the display, not the charge", () => {
    // Dodo localises the real charge from the billing country on file, so a
    // ₹ column in front of a $-billed buyer must not read as a promise.
    render(<MonetizationOnboarding />);
    expect(
      screen.getByText(/Checkout charges in the currency of your billing country/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Display currency" })
    ).toBeInTheDocument();
  });

  it("keeps the renewal disclosure in the selected currency's tax words", () => {
    useAuthStore.setState({ user: null }); // signed out → paid CTAs are live
    render(<MonetizationOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /INR/ }));
    for (const n of screen.getAllByText(/renews automatically each month/i)) {
      expect(n).toHaveTextContent(/plus GST/i);
    }
  });
});
