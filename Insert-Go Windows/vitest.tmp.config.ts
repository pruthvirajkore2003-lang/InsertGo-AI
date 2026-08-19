/// <reference types="vitest" />
// TEMP verification config — repo config + dedupe so react-dom resolves to the
// app's 18.3.1 instead of the 19.2.8 hoisted at the monorepo root. Delete me.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
