import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @tauri-apps/cli sets these; keep dev server stable for Tauri.
const host = process.env.TAURI_DEV_HOST;

/**
 * Fail the RELEASE build when VITE_API_URL still points at a dev origin.
 *
 * `src/services/apiConfig.ts` falls back to http://localhost:3000 so plain `npm
 * run dev` works with no .env, and the Tauri http capability still allows
 * `http://localhost` on any port so that dev server is reachable — so a
 * release built without the variable would happily send
 * `Authorization: Bearer <session token>` to whatever is listening on port 3000
 * of the user's machine. Vite inlines the value at build time, which makes build
 * time the only place this can be caught for free: no runtime branch, no
 * top-level throw that would take the whole app down on import (the reason
 * aiProviders.ts guards inside `send()` instead).
 */
function requireProductionApiUrl(mode: string): void {
  if (mode !== "production") return;
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (env.VITE_ALLOW_DEV_API_URL === "1") return; // deliberate local smoke build
  const url = env.VITE_API_URL?.trim();
  if (
    !url ||
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url)
  ) {
    throw new Error(
      `VITE_API_URL must be the production origin for a release build (got: ` +
        `${url || "unset"}). Set it in .env — see .env.example. To bundle ` +
        `against a local server on purpose, set VITE_ALLOW_DEV_API_URL=1.`
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  requireProductionApiUrl(mode);
  return {
    plugins: [react()],
    define: {
      // Defensive guard: even if someone re-adds VITE_GEMINI_API_KEY to .env,
      // it can never be inlined into the shipped bundle (SECURITY.md).
      "import.meta.env.VITE_GEMINI_API_KEY": "undefined",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    // Prevent Vite from obscuring Rust errors.
    clearScreen: false,
    build: {
      rollupOptions: {
        // Three windows, three entries: the palette (index.html), the selection
        // skill bar (skillbar.html) and the selection review floater
        // (selfloater.html) — each its own webview + JS context.
        input: {
          main: path.resolve(__dirname, "index.html"),
          skillbar: path.resolve(__dirname, "skillbar.html"),
          selfloater: path.resolve(__dirname, "selfloater.html"),
        },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // Tauri works on its own watch; ignore the Rust source tree here.
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
