import "@testing-library/jest-dom";
import { webcrypto } from "node:crypto";
import { beforeEach } from "vitest";
import { useAuthStore } from "@/store/authStore";

// Default every test to a signed-in subscribed user — the managed relay and
// account UI need a session; per-tier tests override per-case.
beforeEach(() => {
  useAuthStore.setState({
    user: {
      name: "Test",
      email: "test@example.com",
      subscriptionStatus: "subscribed",
      credits: 100,
    },
  });
});

// jsdom's `crypto` may lack SubtleCrypto; the enterprise-cloud auth code
// (SigV4, GCP JWT) signs via crypto.subtle. Back it with Node's Web Crypto so
// those helpers run under Vitest exactly as they do in the Tauri WebView.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

// jsdom doesn't implement ResizeObserver; Tabs observes its tab list to
// re-measure the sliding indicator. A no-op keeps those renders working.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement matchMedia; settingsStore queries it at module
// scope for live system-theme tracking. matches:false resolves "system" to
// dark, the app default.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
