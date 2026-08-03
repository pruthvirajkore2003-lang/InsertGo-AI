import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProFeatureGate } from "./ProFeatureGate";
import { useLicenseStore } from "@/store/licenseStore";
import { useAuthStore } from "@/store/authStore";

// setup.ts defaults every test to a subscribed user; the gate only bites
// for free-tier users, so drop the subscription here.
beforeEach(() => {
  const user = useAuthStore.getState().user!;
  useAuthStore.setState({ user: { ...user, subscriptionStatus: "trial" } });
  useLicenseStore.setState({ status: "unlicensed", upsellFeature: null });
});

describe("ProFeatureGate", () => {
  it("intercepts the click for free users and opens the upsell instead", async () => {
    const featureAction = vi.fn();
    render(
      <ProFeatureGate feature="Multi-Model Routing">
        <button onClick={featureAction}>Route</button>
      </ProFeatureGate>
    );
    await userEvent.click(screen.getByRole("button", { name: "Route" }));
    expect(featureAction).not.toHaveBeenCalled();
    expect(useLicenseStore.getState().upsellFeature).toBe("Multi-Model Routing");
  });

  it("passes clicks through untouched for licensed users", async () => {
    useLicenseStore.setState({ status: "pro" });
    const featureAction = vi.fn();
    render(
      <ProFeatureGate feature="Multi-Model Routing">
        <button onClick={featureAction}>Route</button>
      </ProFeatureGate>
    );
    await userEvent.click(screen.getByRole("button", { name: "Route" }));
    expect(featureAction).toHaveBeenCalledOnce();
    expect(useLicenseStore.getState().upsellFeature).toBeNull();
  });

  it("also unlocks via the managed subscription (shared entitlement predicate)", async () => {
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({
      user: { ...user, subscriptionStatus: "subscribed" },
    });
    const featureAction = vi.fn();
    render(
      <ProFeatureGate feature="Local History">
        <button onClick={featureAction}>History</button>
      </ProFeatureGate>
    );
    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(featureAction).toHaveBeenCalledOnce();
  });
});
