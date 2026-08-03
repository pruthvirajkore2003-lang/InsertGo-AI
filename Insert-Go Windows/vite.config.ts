import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @tauri-apps/cli sets these; keep dev server stable for Tauri.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
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
      // Four windows, four entries: the palette (index.html), the selection
      // skill bar (skillbar.html), the selection review floater
      // (selfloater.html) and the Improve progress chip (improvechip.html) —
      // each its own webview + JS context.
      input: {
        main: path.resolve(__dirname, "index.html"),
        skillbar: path.resolve(__dirname, "skillbar.html"),
        selfloater: path.resolve(__dirname, "selfloater.html"),
        improvechip: path.resolve(__dirname, "improvechip.html"),
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
});
