/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// Same monorepo-root source of truth the app build uses (vite.config.ts). The
// suite needs it: GEMINI_MODEL is inlined at transform time and `send()`
// fail-fasts on an empty one, so without this default every GeminiProvider test
// would depend on a git-ignored .env existing.
import sharedConfig from "../shared-config.json";

/** Absolute path to one of THIS package's dependencies, with posix separators.
 *  Vite alias replacements must be posix-style — a Windows path with
 *  backslashes silently fails to resolve and falls through to Node, which is
 *  the whole bug this exists to avoid. */
const localDep = (name: string) =>
  path.resolve(__dirname, "node_modules", name).split(path.sep).join("/");

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // Mirrors vite.config.ts: an explicit VITE_GEMINI_MODEL still wins, the
    // shared default only fills the gap. Kept here as well because Vitest reads
    // THIS config, not vite.config.ts.
    "import.meta.env.VITE_GEMINI_MODEL": JSON.stringify(
      loadEnv(mode, __dirname, "VITE_").VITE_GEMINI_MODEL?.trim() ||
        sharedConfig.defaultGeminiModel
    ),
  },
  resolve: {
    // @testing-library/* is hoisted to the REPO ROOT node_modules, which also
    // holds the website's React 19. Left alone, the library pulls react-dom 19
    // from beside itself while the app under test renders with this package's
    // React 18, and every component test dies on "a React Element from an
    // older version of React was rendered".
    //
    // `dedupe` does not fix it (vitest externalises the hoisted package, so
    // Vite never sees its imports) and neither does inlining alone. Hard
    // aliases do: react and react-dom always mean THIS package's copies,
    // subpaths (react-dom/client, react/jsx-runtime) included.
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: /^react$/, replacement: localDep("react") },
      { find: /^react-dom$/, replacement: localDep("react-dom") },
      { find: /^react-dom\/(.*)$/, replacement: `${localDep("react-dom")}/$1` },
      { find: /^react\/(.*)$/, replacement: `${localDep("react")}/$1` },
    ],
    dedupe: ["react", "react-dom"],
  },
  test: {
    // ...and the aliases above only bite if Vite actually resolves the import.
    // @testing-library's CJS `require("react-dom/client")` is handled by Node,
    // not Vite, so inlining alone changes nothing (verified: `inline: true`
    // still loaded React 19). Pre-bundling it through the web optimizer is
    // what routes the import back through Vite, where the aliases apply.
    // Both settings stay: inline keeps it out of the external path, the
    // optimizer rewrites what is left.
    server: { deps: { inline: [/@testing-library/] } },
    deps: {
      optimizer: {
        web: {
          enabled: true,
          // Every hoisted package that touches React has to be pre-bundled
          // against the aliased copy, not just the renderer: zustand reaches
          // React through use-sync-external-store, and framer-motion through
          // its own hooks. Miss one and its hooks run on a second React
          // instance, which fails as "Invalid hook call" instead of anything
          // that names the real cause.
          include: [
            "@testing-library/react",
            "@testing-library/user-event",
            "zustand",
            "use-sync-external-store",
            "framer-motion",
          ],
        },
      },
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
