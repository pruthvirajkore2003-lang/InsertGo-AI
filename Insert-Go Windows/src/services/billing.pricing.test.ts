import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tauriBridge", () => ({ isTauri: () => false }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const httpMock = vi.fn();
vi.mock("@/services/http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import { fetchPricing, formatUsd, planFor } from "@/services/billing";
import { useMonetizationStore } from "@/store/monetizationStore";

const PLAN = {
  name: "Pro",
  tier: "pro",
  tagline: "…",
  price: { USD: 14.99, INR: 999 },
  per: "/ month",
  popular: false,
  dark: false,
  cta: "Get Pro",
  features: ["150 credits every day"],
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  httpMock.mockReset();
  useMonetizationStore.setState({ pricing: null });
});

describe("fetchPricing", () => {
  it("returns the catalog on a well-formed response", async () => {
    httpMock.mockResolvedValue(
      ok({ plans: [PLAN], packs: [{ credits: 50, price: { USD: 1.99, INR: 149 } }] })
    );
    const pricing = await fetchPricing();
    expect(planFor(pricing, "pro")?.price.USD).toBe(14.99);
  });

  it("rejects a malformed catalog rather than half-rendering it", async () => {
    httpMock.mockResolvedValue(ok({ plans: [{ ...PLAN, price: null }], packs: [] }));
    expect(await fetchPricing()).toBeNull();
    // Captive portal / offline: an HTML body or a thrown fetch are both null.
    httpMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await fetchPricing()).toBeNull();
    httpMock.mockRejectedValue(new Error("offline"));
    expect(await fetchPricing()).toBeNull();
  });

  it("leaves the store null on failure so the UI keeps its fallbacks", async () => {
    httpMock.mockResolvedValue(new Response(null, { status: 500 }));
    await useMonetizationStore.getState().loadPricing();
    expect(useMonetizationStore.getState().pricing).toBeNull();
  });

  it("fetches once per session, then serves the cached catalog", async () => {
    httpMock.mockResolvedValue(ok({ plans: [PLAN], packs: [] }));
    const { loadPricing } = useMonetizationStore.getState();
    await Promise.all([loadPricing(), loadPricing()]);
    await loadPricing();
    expect(httpMock).toHaveBeenCalledTimes(1);
  });
});

describe("formatUsd", () => {
  it("shows decimals only when the price has them", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(15)).toBe("$15");
    expect(formatUsd(7.99)).toBe("$7.99");
  });
});
