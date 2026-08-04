# InsertGo Security Notes

Security boundary decisions made during the 2026-07 remediation, with the
reasoning. Update this file when any of these boundaries move.

## ⚠️ ACTION REQUIRED — secret rotation (2026-07 audit)

The `JWT_SECRET` and `GEMINI_API_KEY` values that lived in `.env` must be
treated as compromised: the pinned Vite 5.4.3 dev server was exposed to
CVE-2026-39364 (directory traversal that can read `.env`) and
CVE-2025-31125 (arbitrary file read) before this remediation.

1. Regenerate `JWT_SECRET` (server-side) and invalidate sessions signed with
   the old one.
2. Revoke the old Gemini key in Google AI Studio and issue a new one.
3. Update `.env` with the new values. Never commit `.env`; never `VITE_`-prefix
   a secret (see "Secrets at rest").

## Dependency floors (CVE fixes)

- **`vite` ≥ 7.0 (currently 7.3.6) + `vitest` ≥ 3.2 (currently 3.2.7).** The
  `5.4.x` line reached its final release at `5.4.21` — there is no `5.4.23`,
  so an earlier "≥ 5.4.23" floor here could never be met — and it still
  bundled `esbuild` 0.21, exposed to GHSA-67mh-4wv8-2f99 (any web page can
  drive the running dev server and read the response) and to the earlier
  dev-server `.env`-read traversal. `vite` 7 pulls `esbuild` ≥ 0.25, which
  closes both; `npm audit` reports 0 vulnerabilities. These are dev-toolchain
  only (never in the shipped bundle), but the dev server is the surface that
  can read a local `.env`, so the floor stays here. Requires Node ≥ 22.12
  (vite 7 / vitest 3 engines).
- `@tauri-apps/api` / `@tauri-apps/cli` ≥ 2.10.3 and the `tauri` crate in
  `src-tauri/Cargo.toml` ≥ 2.10.3 — CVE-2026-42184 (`is_local_url` bypass on
  Windows, fixed 2.10.3). Satisfied: `Cargo.lock` pins `tauri` 2.11.3.

## Content Security Policy — `style-src 'unsafe-inline'` (accepted risk)

`src-tauri/tauri.conf.json` ships:

```
style-src 'self' 'unsafe-inline'
```

React's inline `style={{}}` prop requires `'unsafe-inline'` for styles; React
does not support nonces for the `style` attribute. Eliminating it would mean
rewriting all component styling to CSS Modules or a zero-runtime CSS-in-JS —
out of scope for a security patch.

**Why this is acceptable:** `script-src` stays strict (`default-src 'self'`,
no `unsafe-inline`/`unsafe-eval` for scripts, `object-src 'none'`), so
injected markup cannot execute code. Style injection alone is a cosmetic /
exfil-via-CSS class of risk, contained by the strict `connect-src`.

`connect-src` additionally lists `https://*`; in the packaged app, real egress
is governed by the per-window Tauri HTTP capabilities below, which remain the
effective network boundary.

## Tauri HTTP capability — `https://**`

| Window          | Capability file      | Network access |
|-----------------|----------------------|----------------|
| `main`          | `default.json`       | `https://**` + localhost |
| `selfloater`    | `selfloater.json`    | `https://**` + localhost — runs the selection-review provider stream |
| `skillbar`      | `skillbar.json`      | `insertgo.ai` + localhost only |
| `improvechip`   | `improvechip.json`   | none |
| `floating-icon` | `floating-icon.json` | none |

## Secrets at rest

- **The session token** lives in the OS credential store via the Rust
  `keyring` (`session_token_set`/`session_token_get` commands, one credential:
  service `InsertGo` / account `session`), never in `localStorage` in the
  packaged app. It is the app's only secret at rest — the desktop client holds
  no LLM key, because the managed relay holds it server-side.
- **`providers.json` holds no secret.** The persisted `ProviderConfig` carries
  only non-secret fields (id, name, base_url, default flag); the `api_key`
  field was removed from the Rust struct (`domain/providers.rs`), so a real
  key can never be written to plain JSON even if a caller passes one — any
  stray `apiKey` in an incoming payload or a legacy file is ignored.
- **Browser dev mode only** (`!isTauri()`): the session token falls back to
  `sessionStorage` with a 1-hour TTL. This path never runs in the packaged app.
- **Build-time env:** `VITE_`-prefixed vars are inlined into the shipped JS
  bundle, so no key may ever be `VITE_`-prefixed. `vite.config.ts`
  force-defines `import.meta.env.VITE_GEMINI_API_KEY` to `undefined` as a
  permanent guard.

## Session freshness

Session tokens carry a client-side timestamp (`auth_token_ts`); tokens older
than 55 minutes trigger a `refreshStatus()` re-validation before any proxy
request, plus a periodic background refresh while the app runs. Server-side
expiry (401/403) still logs the user out regardless.

## Input limits

Prompts are capped at `MAX_PROMPT_CHARS` (100,000 chars, `src/types/index.ts`)
in every provider `send()` to prevent accidental quota exhaustion. That cap is
advisory only — a caller with a valid bearer token can POST the proxy directly —
so the website mirrors it server-side in `lib/entitlements.ts`
(`requirePayloadWithinLimit`, 413) and refuses a request body over 1 MiB before
parsing it.

## Logging

`src/services/safeLog.ts` redacts Bearer tokens and API-key-shaped strings
before anything reaches the console / exported logs. Use `safeError` instead
of `console.error` in any code path that can touch a token.
