import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// Monorepo-root single source of truth, shared with the website (its
// lib/gemini.ts builds DEFAULT_ALLOWED_MODELS from the same key). Both sides
// have to name the same model or every generation is rejected as 400, which is
// why the value lives in one file instead of in each .env template.
import sharedConfig from "../shared-config.json";

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
function requireProductionApiUrl(
  mode: string,
  env: Record<string, string>
): void {
  if (mode !== "production") return;
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
  // Covers .env files AND prefixed process env, so CI can still override.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  requireProductionApiUrl(mode, env);
  return {
    plugins: [react()],
    define: {
      // Defensive guard: even if someone re-adds VITE_GEMINI_API_KEY to .env,
      // it can never be inlined into the shipped bundle (SECURITY.md).
      "import.meta.env.VITE_GEMINI_API_KEY": "undefined",
      // Model config, defaulted from the shared root JSON so the name is not
      // copied into .env.example and the release workflow as well. An explicit
      // VITE_GEMINI_MODEL (.env or CI env) still wins — this only supplies the
      // value when nothing sets one, replacing what .env.example used to
      // hardcode. `send()` in aiProviders.ts keeps its empty-model fail-fast:
      // it costs nothing and still covers a deliberately blanked default.
      "import.meta.env.VITE_GEMINI_MODEL": JSON.stringify(
        env.VITE_GEMINI_MODEL?.trim() || sharedConfig.defaultGeminiModel
      ),
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
