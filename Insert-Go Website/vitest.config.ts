import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirror the tsconfig `@/*` -> project-root alias so tests can import app
// modules the same way the app does. Node environment: the units under test are
// server-side (pure decision helpers + a pg-backed quota with the DB mocked).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
