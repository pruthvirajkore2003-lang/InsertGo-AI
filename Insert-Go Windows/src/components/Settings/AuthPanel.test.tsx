import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthPanel } from "./AuthPanel";
import { useAuthStore, type User } from "@/store/authStore";

// The panel shows the real balance for everyone — the daily + add-on total
// when the server stamps the 3-tier fields, the legacy flat `credits` total
// otherwise. No "Unlimited" entitlement: paid tiers have finite credits too.
const renderAs = (patch: Partial<User>) => {
  const user = useAuthStore.getState().user!;
  useAuthStore.setState({ user: { ...user, ...patch } });
  render(<AuthPanel />);
};

describe("AuthPanel credits", () => {
  it("shows the real balance for expired users", () => {
    renderAs({ subscriptionStatus: "expired", credits: 0 });
    expect(screen.getByText("0 remaining")).toBeInTheDocument();
  });

  it("shows the real balance for subscribed users", () => {
    renderAs({ subscriptionStatus: "subscribed", credits: 0 });
    expect(screen.getByText("0 remaining")).toBeInTheDocument();
  });

  it("sums daily and add-on credits when the server stamps them", () => {
    renderAs({
      subscriptionStatus: "subscribed",
      tier: "pro",
      dailyCreditsRemaining: 30,
      addOnCredits: 200,
      credits: 230,
    });
    expect(screen.getByText("230 remaining")).toBeInTheDocument();
  });

  it("shows the remaining count for trial users", () => {
    renderAs({ subscriptionStatus: "trial", credits: 7 });
    expect(screen.getByText("7 remaining")).toBeInTheDocument();
  });
});

describe("AuthPanel plan tier", () => {
  it("shows the capitalized tier for a Plus user", () => {
    renderAs({ subscriptionStatus: "subscribed", tier: "plus" });
    expect(screen.getByText("Plus")).toBeInTheDocument();
  });

  it("shows the capitalized tier for a Pro user", () => {
    renderAs({ subscriptionStatus: "subscribed", tier: "pro" });
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("maps a legacy subscribed session to Pro when no tier is stamped", () => {
    renderAs({ subscriptionStatus: "subscribed", tier: undefined });
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows Free for a trial user", () => {
    renderAs({ subscriptionStatus: "trial", tier: undefined });
    expect(screen.getByText("Free")).toBeInTheDocument();
  });
});
