import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tauriBridge", () => ({ isTauri: () => false }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const httpMock = vi.fn();
vi.mock("@/services/http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  CURRENCY_KEY,
  detectCurrency,
  fetchPricing,
  formatMoney,
  gstNote,
  isIndianLocale,
  planFor,
  storedCurrency,
} from "@/services/billing";
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
  // The manual choice outranks every signal below it, so a leftover from one
  // test would silently decide the next one.
  localStorage.clear();
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

describe("formatMoney", () => {
  it("shows decimals only when the price has them", () => {
    expect(formatMoney(0, "USD")).toBe("$0");
    expect(formatMoney(15, "USD")).toBe("$15");
    expect(formatMoney(7.99, "USD")).toBe("$7.99");
    expect(formatMoney(499, "INR")).toBe("₹499");
  });
});

describe("detectCurrency", () => {
  /** Stubs what `Intl.DateTimeFormat().resolvedOptions().timeZone` returns. */
  const withZone = (timeZone: string | undefined, run: () => void) => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);
    try {
      run();
    } finally {
      spy.mockRestore();
    }
  };

  it("returns INR for both Indian zone spellings", () => {
    withZone("Asia/Kolkata", () => expect(detectCurrency()).toBe("INR"));
    // Windows and older ICU builds still resolve the legacy alias.
    withZone("Asia/Calcutta", () => expect(detectCurrency()).toBe("INR"));
  });

  it("falls back to USD for anything else", () => {
    withZone("America/New_York", () => expect(detectCurrency()).toBe("USD"));
    withZone("Asia/Tokyo", () => expect(detectCurrency()).toBe("USD"));
    // No prefix matching: a zone that merely starts with "Asia/" is not India.
    withZone("Asia/Kolkata_Bogus", () => expect(detectCurrency()).toBe("USD"));
    withZone(undefined, () => expect(detectCurrency()).toBe("USD"));
  });

  it("falls back to USD when Intl throws", () => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new Error("no ICU data");
      });
    expect(detectCurrency()).toBe("USD");
    spy.mockRestore();
  });

  /** Stubs `navigator.languages` / `navigator.language` for one call. */
  const withLanguages = (tags: string[], run: () => void) => {
    const original = Object.getOwnPropertyDescriptor(
      window.navigator,
      "languages"
    );
    Object.defineProperty(window.navigator, "languages", {
      value: tags,
      configurable: true,
    });
    try {
      run();
    } finally {
      if (original) Object.defineProperty(window.navigator, "languages", original);
      else delete (window.navigator as { languages?: unknown }).languages;
    }
  };

  it("lets a stored choice outrank every detected signal", () => {
    // The whole point of the toggle: a machine that geolocates or reads as
    // American, owned by someone who wants rupees, and the reverse.
    localStorage.setItem(CURRENCY_KEY, "INR");
    withZone("America/New_York", () => expect(detectCurrency()).toBe("INR"));
    localStorage.setItem(CURRENCY_KEY, "USD");
    withZone("Asia/Kolkata", () => expect(detectCurrency()).toBe("USD"));
  });

  it("ignores a tampered or half-written stored value", () => {
    // localStorage is editable text. Anything that is not one of the two
    // literals has to fall back to detection, not become a third column.
    for (const bad of ["", "EUR", "inr; DROP", "null"]) {
      localStorage.setItem(CURRENCY_KEY, bad);
      expect(storedCurrency()).toBeNull();
      withZone("Asia/Kolkata", () => expect(detectCurrency()).toBe("INR"));
      withZone("America/New_York", () => expect(detectCurrency()).toBe("USD"));
    }
    // Casing is a user's business, not a reason to lose their choice.
    localStorage.setItem(CURRENCY_KEY, "inr");
    expect(storedCurrency()).toBe("INR");
  });

  it("reads the UI language when the clock says nothing", () => {
    // A corporate UTC clock or a VPN is exactly how an Indian buyer used to
    // end up pinned to dollars: the timezone missed and nothing else looked.
    withZone("UTC", () =>
      withLanguages(["en-IN", "en-US"], () => expect(detectCurrency()).toBe("INR"))
    );
    withZone("Europe/London", () =>
      withLanguages(["hi"], () => expect(detectCurrency()).toBe("INR"))
    );
    withZone("UTC", () =>
      withLanguages(["en-US"], () => expect(detectCurrency()).toBe("USD"))
    );
  });

  it("still reads the language when Intl has no ICU data", () => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new Error("no ICU data");
      });
    withLanguages(["ta-IN"], () => expect(detectCurrency()).toBe("INR"));
    spy.mockRestore();
  });
});

describe("isIndianLocale", () => {
  it("matches the India region subtag and bare Hindi", () => {
    for (const tag of ["en-IN", "hi", "hi-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "bn-IN"]) {
      expect(isIndianLocale(tag)).toBe(true);
    }
  });

  it("does not claim a language shared with another country", () => {
    // Bare `in` is the deprecated ISO-639 code for INDONESIAN, still emitted
    // by older webviews; `bn` alone is as likely Bangladesh.
    for (const tag of ["en-US", "in", "bn", "ta", "de", "", null, undefined]) {
      expect(isIndianLocale(tag)).toBe(false);
    }
  });
});

describe("gstNote", () => {
  it("itemises the tax an Indian buyer will actually be charged", () => {
    // Prices are tax-exclusive; showing ₹499 alone is a price nobody can pay.
    expect(gstNote(499, "INR")).toBe("₹499 + 18% GST = ₹588.82 total");
    expect(gstNote(999, "INR")).toBe("₹999 + 18% GST = ₹1178.82 total");
  });

  it("says nothing for USD or for free plans", () => {
    // USD buyers see their own regional tax at Dodo's checkout; a GST line
    // there would be wrong, and a "+18% GST" on ₹0 is just noise.
    expect(gstNote(7.99, "USD")).toBe("");
    expect(gstNote(0, "INR")).toBe("");
  });
});
