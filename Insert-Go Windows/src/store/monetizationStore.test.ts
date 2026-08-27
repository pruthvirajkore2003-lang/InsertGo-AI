import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

// Mock the bridge so settings saves echo without touching the backend.
vi.mock("@/services/tauriBridge", () => ({
  isTauri: () => false,
  saveSettings: vi.fn(async (s: Settings) => s),
  loadSettings: vi.fn(),
  getHardwareId: vi.fn(async () => "hw"),
}));
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { useLicenseStore } from "@/store/licenseStore";
import {
  canUseHistory,
  deriveTier,
  useMonetizationStore,
} from "@/store/monetizationStore";
import { detectCurrency, storedCurrency } from "@/services/billing";

function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over };
}

/** Expired subscription + no license: the canonical "free" user. */
function makeFree() {
  useAuthStore.setState({
    user: {
      name: "T",
      email: "t@example.com",
      subscriptionStatus: "expired",
      credits: 0,
    },
  });
  useLicenseStore.setState({
    licenseKey: null,
    status: "unlicensed",
    lastValidatedAt: null,
    error: null,
  });
}

beforeEach(() => {
  useSettingsStore.setState({ settings: settings() });
  // License state persists (zustand/persist) — reset so a lifetime-license
  // test can't leak Pro into a later free-user test.
  useLicenseStore.setState({
    licenseKey: null,
    status: "unlicensed",
    lastValidatedAt: null,
    error: null,
  });
});

describe("deriveTier", () => {
  it("maps entitlement onto the two managed tiers", () => {
    expect(deriveTier(false)).toBe("managed_trial");
    expect(deriveTier(true)).toBe("managed_pro");
  });
});

describe("canUseHistory", () => {
  const baseUser = { name: "T", email: "t@example.com" } as const;

  it("denies a free-tier user", () => {
    makeFree();
    expect(canUseHistory()).toBe(false);
  });

  it("allows it when the server stamps the paid-tier flag", () => {
    makeFree();
    useAuthStore.setState({
      user: {
        ...baseUser,
        subscriptionStatus: "trial",
        credits: 0,
        tier: "plus",
        historyAllowed: true,
      },
    });
    expect(canUseHistory()).toBe(true);
  });

  it("the server flag wins over the legacy status fallback in BOTH directions", () => {
    // Explicit false must gate even a legacy-subscribed-looking user…
    useAuthStore.setState({
      user: {
        ...baseUser,
        subscriptionStatus: "subscribed",
        credits: 0,
        tier: "free",
        historyAllowed: false,
      },
    });
    expect(canUseHistory()).toBe(false);
    // …and a legacy session (no flag) falls back to subscribed = allowed.
    useAuthStore.setState({
      user: { ...baseUser, subscriptionStatus: "subscribed", credits: 0 },
    });
    expect(canUseHistory()).toBe(true);
  });

  it("a lifetime license grants it regardless of tier", () => {
    makeFree();
    useLicenseStore.setState({ licenseKey: "KEY", status: "pro" });
    expect(canUseHistory()).toBe(true);
  });
});

describe("tier reactivity / upgrade modal", () => {
  it("recomputes the tier when the subscription changes", () => {
    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@example.com",
        subscriptionStatus: "subscribed",
        credits: 0,
      },
    });
    expect(useMonetizationStore.getState().tier).toBe("managed_pro");

    useAuthStore.setState({
      user: {
        name: "T",
        email: "t@example.com",
        subscriptionStatus: "expired",
        credits: 0,
      },
    });
    expect(useMonetizationStore.getState().tier).toBe("managed_trial");
  });

  it("a lifetime license reaches managed_pro without a subscription", () => {
    makeFree();
    expect(useMonetizationStore.getState().tier).toBe("managed_trial");
    useLicenseStore.setState({ licenseKey: "KEY", status: "pro" });
    expect(useMonetizationStore.getState().tier).toBe("managed_pro");
  });

  it("opens and closes the contextual upsell", () => {
    useMonetizationStore.getState().openUpgrade("history");
    expect(useMonetizationStore.getState().upgradeReason).toBe("history");
    useMonetizationStore.getState().closeUpgrade();
    expect(useMonetizationStore.getState().upgradeReason).toBeNull();
  });
});

describe("display currency", () => {
  beforeEach(() => {
    localStorage.clear();
    useMonetizationStore.setState({ currency: "USD" });
  });

  it("remembers the choice across launches", () => {
    // Re-detecting on every start would throw the choice away the moment the
    // laptop's timezone disagreed with it — which is the case it exists for.
    useMonetizationStore.getState().setCurrency("INR");
    expect(useMonetizationStore.getState().currency).toBe("INR");
    expect(storedCurrency()).toBe("INR");
    expect(detectCurrency()).toBe("INR");
  });

  it("survives an auth or license change", () => {
    // The tier is recomputed from those stores on every change; a full
    // setState there would silently reset the column mid-session.
    useMonetizationStore.getState().setCurrency("INR");
    useAuthStore.setState({ user: null });
    useLicenseStore.setState({ status: "inactive" });
    expect(useMonetizationStore.getState().currency).toBe("INR");
  });
});
