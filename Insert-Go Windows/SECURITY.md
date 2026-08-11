# InsertGo Security Notes

Security boundary decisions made during the 2026-07 remediation, with the
reasoning. Update this file when any of these boundaries move.

## Secret exposure (2026-07 audit) — one action outstanding

Any value that sat in this repo's `.env` during the 2026-07 window must be
treated as disclosed: the pinned Vite 5.4.3 dev server was exposed to
CVE-2026-39364 (directory traversal that can read `.env`) and CVE-2025-31125
(arbitrary file read). Both are closed by the dependency floors below.

- **`JWT_SECRET` — removed, not rotated (2026-08-06).** It signed a local auth
  server that no longer exists. Verified unused before deletion: no
  `jsonwebtoken`/`jose` dependency in either `package.json` and no signing code
  in either tree. Sessions are issued and signed by the website's Better Auth
  server (`BETTER_AUTH_SECRET`); this app only *stores* the resulting bearer
  token. Do not reintroduce a secret into `.env` — the dev server can serve it.
- **`GEMINI_API_KEY` — revoke and reissue still open.** It is no longer in this
  repo (the website holds it server-side), but the exposed *value* may still be
  the live one. Procedure: `compliance/secret-rotation.md` §3.1.
- **`BETTER_AUTH_SECRET` — not part of this exposure.** It lives only in the
  website's `.env.local`, which this dev server could not reach. Quarterly
  rotation only.
- `.env` was never committed in either repo — no history scrub needed.

Full inventory, per-secret procedures, and the quarterly checklist live in
`compliance/secret-rotation.md` (R-01).

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

**These floors are now enforced, not remembered (R-07).**
`.github/workflows/security.yml` runs `npm audit` and `cargo audit` on every PR
and weekly, blocking on High/Critical. Neither tool holds its own ignore list:
both read `compliance/vulnerability-exceptions.md` through
`scripts/audit-gate.mjs`, so an advisory can only be carried with a written
reason, an owner and a review date — and the build fails the day that date
lapses. Run it locally the way CI does:

```
npm audit --json | node scripts/audit-gate.mjs npm
cd "Insert-Go Windows/src-tauri" && cargo audit $(node ../../scripts/audit-gate.mjs cargo-ignores)
```

Carried today: postcss 8.4.31 and sharp 0.34.x (both pinned by `next` 15;
build-time only), quick-xml 0.39.4 (compiles only inside a proc-macro), rkyv
0.7.46 (never compiled). Reachability arguments are in the register.

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
