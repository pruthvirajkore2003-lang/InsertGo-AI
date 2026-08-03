# InsertGo

Floating, always-on-top AI prompt assistant for Windows — **Spotlight for AI prompts**.
Tauri 2.0 (Rust) shell + React 18 / TypeScript / Vite frontend. See `SPEC.md` for the
authoritative specification.

## Status — Milestone 1 (MVP) scaffold

End-to-end foundation is in place:

- Global hotkey (default ``Ctrl+` ``) toggles the palette window (starts hidden; the hotkey captures the target app *before* showing).
- `Esc` and **click-outside / focus-loss** dismiss the palette (SPEC §5.2).
- Prompt composer: type/paste, **Copy**, **Insert** (pastes into the previously focused app), **Send** (provider), **Save**.
- Save flow uses `PromptEditorDialog` for title + tags (SPEC §4.3, §5.3).
- Prompt library (save / use / delete), JSON-persisted.
- Settings: theme, hotkey, and **multiple AI providers** — add / edit / delete, set default, inline validation (SPEC §13.3.2, §9.1).
- Composer **provider picker** when more than one is configured.
- **Dynamic prompt library** with AI Blaze form-commands (`{formtext}`, `{formparagraph}`, `{formmenu … multiple=yes}`, `{formtoggle}/{endformtoggle}`, `{clipboard}`), grouped by category. Picking a prompt opens a fill-in dialog; only fully-expanded, token-free text reaches the composer. Legacy `{{selected_text}}` placeholders still work (SPEC §3.2.4, §4.1).
- Generic provider call: `POST { prompt, metadata } -> { text }` (SPEC §5.4).
- Non-blocking **toast** notifications for errors/success (SPEC §9.1).
- **Export logs** to Downloads for debugging (SPEC §9.3).
- Tests — Rust (`cargo test`): hotkey parsing, prompt upsert/remove, settings/prompt JSON round-trips. Frontend (`npm test`): provider list logic + `PromptCard` component (SPEC §12).

## Prerequisites

- Node.js 18+ and npm
- Rust (stable) + Cargo — https://rustup.rs
- Tauri 2 system deps for Windows (WebView2 — preinstalled on Win 11; MSVC build tools)

## ⚠️ Required before first build: app icons

This scaffold does **not** include binary icon files. Tauri embeds `icons/icon.ico`
into the Windows binary, so a build fails without them. Generate icons once from any
square PNG (≥512×512):

```sh
npm install
npm run tauri icon path\to\logo.png
```

That populates `src-tauri/icons/` to match the paths in `src-tauri/tauri.conf.json`.

## Run

```sh
npm install        # JS deps
npm run tauri:dev  # builds Rust + launches the app (first build is slow)
```

Build a release bundle:

```sh
npm run tauri:build
```

Frontend-only (no Tauri shell — limited; backend calls no-op):

```sh
npm run dev
```

## The AI key (server-held)

The app holds **no LLM key**. Every generation is proxied to the InsertGo
website's `/api/ai/generate` with an `Authorization: Bearer <session token>`;
the Gemini key lives only in the website's server env (SPEC §10) and never
enters this client or its JS bundle. There is therefore no per-user API key to
configure in the app.

The only client config is in `.env` (copy from `.env.example`, git-ignored):
`VITE_API_URL` (the website base URL that hosts auth + the proxy) and
`VITE_GEMINI_MODEL` (the model the proxy is asked to use). Both are non-secret
and are inlined into the build by design.

## Test

```sh
npm test           # frontend (vitest, watch) — or: npm run test:run
cd src-tauri && cargo test   # backend (Rust)
```

## Project layout

```
src/                      React + TS frontend
  components/             PromptPalette, PromptLibrary, Settings
  hooks/                  useHotkey, useActiveContext
  store/                  Zustand: prompt / library / settings
  services/               tauriBridge, aiProviders, clipboard
  types/                  shared data model (mirrors Rust structs)
src-tauri/                Rust backend
  src/domain/             prompts, settings, providers, context (app logic + JSON persistence)
  src/platform/           window, hotkey, clipboard (Windows-first integration)
  src/lib.rs              plugin setup, hotkey wiring, command registry
  capabilities/           Tauri 2 permission grants
```

Data is stored locally as JSON under the OS app-data dir (`prompts.json`,
`settings.json`, `providers.json`). Nothing leaves the machine except explicit
provider calls (SPEC §10).

## Text insertion — how it works

**Insert** copies the prompt to the clipboard, hides the palette, restores focus
to the window that was active when the hotkey fired (waiting for Windows'
asynchronous foreground handoff to complete), **verifies** that window really is
foreground, and sends a synthetic `Ctrl+V`. Your original clipboard is restored
afterwards. If the target can't be focused/verified (closed window, elevated
app blocking input), the prompt stays on the clipboard and a toast says so.

**Invariant:** InsertGo never launches an external app to insert text — no
system opener, no temp files, no shell. The only non-paste outcome is
"copied to clipboard".

## Prompt library — credits & safety

The seeded dynamic prompts under `src/services/promptLibrary.ts` are ported from
the **AI Blaze** public prompt gallery and docs (https://blaze.today) and are
bundled as ready-to-use examples; credit belongs to AI Blaze / Blaze.today.
Bodies keep the original `{form…}`/`{clipboard}` syntax verbatim — the pure
engine in `src/services/blazeCommands.ts` parses them into fill-in fields.

Diagnostic / medical-advice prompts from the gallery (e.g. "Virtual Doctor")
are intentionally **excluded** — bundling prompts that instruct the model to
output a diagnosis is a product-safety/liability concern.

## Known limitations / gated on approval (SPEC §14)

| Area | Current behavior | Real impl needs |
|------|------------------|-----------------|
| API key storage | plaintext in `providers.json` (never logged) | OS keyring / Stronghold |
| Hotkey change | takes effect on restart | live re-register |
| Insert on non-Windows | clipboard stage only | per-OS focus restore + key synthesis |

## Defaults chosen during scaffold

State = **Zustand**, persistence = **JSON files**, pkg manager = **npm**. Adjust freely.
