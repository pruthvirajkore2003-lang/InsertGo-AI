import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import * as bridge from "@/services/tauriBridge";
import { getFreshToken } from "@/store/authStore";

/**
 * Shared fetch for cross-origin calls to the InsertGo.AI website: Tauri's
 * Rust-side fetch when available (respects the capability allowlist and skips
 * webview CSP/CORS); plain fetch in browser dev mode. Every `${API_URL}` call
 * must go through this — plain `window.fetch` is blocked by the webview's
 * CORS rules inside the packaged app.
 *
 * Auth gate: any non-auth request without a valid session token is blocked
 * locally with a synthetic 401 — it never reaches the wire. The `/api/auth/`
 * and `/api/desktop/` namespaces are exempt: sign-in must work while logged
 * out (that's the point of it), and getFreshToken() itself validates stale
 * sessions through get-session, which would otherwise recurse through this
 * gate.
 */
const SIGNED_OUT_PATHS = ["/api/auth/", "/api/desktop/"];

export const http: typeof globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (
    !SIGNED_OUT_PATHS.some((p) => url.includes(p)) &&
    !(await getFreshToken())
  ) {
    return new Response(null, { status: 401, statusText: "Unauthorized" });
  }
  return bridge.isTauri()
    ? tauriFetch(input, init)
    : globalThis.fetch(input, init);
};
