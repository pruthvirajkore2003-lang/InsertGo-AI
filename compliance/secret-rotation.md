# Secret rotation runbook

**Remediation item:** R-01
**Legal basis:** DPDP Act 2023 §8(5) (reasonable security safeguards); IT Act 2000
§43A read with IT (Reasonable Security Practices) Rules 2011 Rule 8; ISO/IEC 27001
A.5.17 (authentication information), A.8.24 (use of cryptography).
**Owner:** Engineering lead
**Cadence:** quarterly, plus immediately on any exposure event or personnel departure.

---

## 1. Secret inventory

Everything below lives in the website's `.env.local` (dev) and Vercel project
environment (prod). **The desktop app holds no secret of its own** — it stores only
the runtime bearer token, in Windows Credential Manager, issued by the website.

| Secret | Purpose | Blast radius if leaked | Rotation |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | Signs every session | Forge any user's session | Quarterly + on exposure |
| `SUPABASE_SERVICE_ROLE_KEY` | PostgREST service role | Full read/write of all personal data, bypasses RLS | Quarterly + on exposure |
| `DATABASE_URL` | Postgres URI (embeds password) | Full DB access | Quarterly + on exposure |
| `GEMINI_API_KEY` | Server-held model key | Billed quota abuse; prompt egress under our identity | Quarterly + on exposure |
| `DODO_API_KEY` | Payment API | Create/read checkouts | Quarterly + on exposure |
| `DODO_WEBHOOK_SECRET` | Verifies billing webhooks | Forge `subscription.*` events → free tier grants | Quarterly + on exposure |
| `GOOGLE_CLIENT_SECRET` | OAuth client | Impersonate the OAuth client | Annually + on exposure |
| `RESEND_API_KEY` | Transactional email | Send mail as InsertGo (phishing) | Quarterly + on exposure |

**Not secrets — do not rotate:** `SUPABASE_CA_CERT` (public root cert),
`SUPABASE_URL`, `DODO_PRODUCT_ID_*`, `NEXT_PUBLIC_*`, model names, `SSO_ADMIN_EMAILS`,
`OPS_ALERT_TO`.

**Invariant:** no secret may ever carry a `VITE_` or `NEXT_PUBLIC_` prefix — both are
inlined into a shipped browser bundle. `Insert-Go Windows/vite.config.ts` force-defines
`import.meta.env.VITE_GEMINI_API_KEY` to `undefined` as a standing guard.

---

## 2. Exposure event — 2026-07 Vite dev-server CVEs

**What happened.** The pinned Vite 5.4.3 dev server in `Insert-Go Windows` was exposed
to CVE-2026-39364 (directory traversal reading `.env`) and CVE-2025-31125 (arbitrary
file read). Any value that sat in that repo's `.env` during the exposure window must be
treated as disclosed.

**What was in that file:** `JWT_SECRET`, `VITE_API_URL`, `VITE_GEMINI_MODEL`, and
historically `GEMINI_API_KEY`. Only the first and last are secrets.

**Status as of 2026-08-06:**

| Item | Finding | Action taken |
|---|---|---|
| `JWT_SECRET` | **Dead variable.** It signed a local auth server that no longer exists. Verified unused: no `jsonwebtoken`/`jose` dependency in either `package.json`, and no signing code in either tree — the only remaining "JWT" mentions are comments describing the Better Auth *bearer* token. | **Removed** from `Insert-Go Windows/.env` and `.env.example` rather than rotated. A compromised secret that nothing reads is liability with no function; deleting it is the root-cause fix. |
| `GEMINI_API_KEY` | No longer present in the desktop `.env`; now server-held in the website only. The **value** exposed during the window may still be the live one — this cannot be determined from the repo. | **Revoke and reissue regardless** (§3.1). Cheap, definitive, and removes the ambiguity permanently. |
| `BETTER_AUTH_SECRET` | Never present in the desktop `.env` — it lives only in the website's `.env.local`, which the vulnerable dev server could not read. **Not part of this exposure.** | Routine quarterly rotation only. |
| Git history | `.env` was never committed in either repo (`.env` / `.env.*` git-ignored since inception; `git ls-files` returns only `.env.example`). No history scrub needed. | None. |
| Dependency floor | Vite ≥ 7.0 / Vitest ≥ 3.2 now pinned, closing both CVEs. | Already done, see `Insert-Go Windows/SECURITY.md`. |

**Remaining open action:** §3.1 (revoke and reissue the Gemini key). Everything else in
this exposure is closed.

---

## 3. Procedures

### 3.1 Google Gemini API key — revoke and reissue

Must be done by a human in the browser; there is no API for key revocation.

1. https://aistudio.google.com/apikey → locate the key in use → **Delete**. Delete
   first, not after: an un-deleted old key stays billable and usable.
2. **Create API key** → copy the new value.
3. Set it in Vercel production, then redeploy so the new value is picked up:

```bash
cd "Insert-Go Website"
vercel env rm  GEMINI_API_KEY production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" --yes
vercel env add GEMINI_API_KEY production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE"
vercel --prod                            --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE"
```

Both `--token` and `--scope` are mandatory in this project; interactive `vercel login`
is not usable from an agent shell. Framework autodetect also fails here — `vercel.json`
pins `nextjs`, leave it in place.

4. Update local `Insert-Go Website/.env.local` with the same value.
5. Verify: one real generation through `/api/ai/generate` returns 200 with a
   `usage: prompt=…` line. A 502 from the grounded path usually means
   `GEMINI_GROUNDING_MODEL` points at a retired model, not a key problem.

### 3.2 `BETTER_AUTH_SECRET` — rotate and invalidate sessions

Rotating this secret makes every outstanding session unverifiable. Purge the table in
the same maintenance window so no user sits on a token that half-works.

**Since R-04 this secret is also an encryption key.** `account.encryptOAuthTokens`
(lib/auth.ts) encrypts stored Google access / refresh / id tokens with AES-256-GCM
under this value, so rotating it orphans every stored OAuth token — they become
undecryptable ciphertext, not merely stale. That is harmless here and must stay
checked: nothing in this codebase reads those columns (Google is a sign-in lane, not
an API this app calls for the user), and Better Auth rewrites them on the next OAuth
sign-in. **If that ever changes, this rotation needs a decrypt-and-re-encrypt step
before the swap, or every Google-linked user loses offline access silently.**

Session tokens are *not* affected: they are stored as a keyless `sha256` digest
(lib/sessionTokenHash.ts), so rotation neither breaks nor protects them — the purge
below is what invalidates them.

```bash
vercel env rm  BETTER_AUTH_SECRET production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE" --yes
# generate: openssl rand -base64 32
vercel env add BETTER_AUTH_SECRET production --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE"
vercel --prod                                 --token="$VERCEL_TOKEN" --scope="$VERCEL_SCOPE"
```

Then, in the Supabase SQL editor:

```sql
-- R-01 §3.2 — invalidate every session issued under the previous signing secret.
-- Run AFTER the new BETTER_AUTH_SECRET is live, so no session is minted under the old one.
delete from "session";

-- Outstanding email OTPs and desktop PKCE authorization codes. Short-lived, but in an
-- exposure event assume they are suspect. Safe to run any time — worst case a user
-- re-requests a code.
delete from "verification" where "expiresAt" > now();
```

**Expected client behaviour after the purge** — no support action required:

- Web: next request 401s → redirect to sign-in.
- Desktop: the token in Windows Credential Manager fails validation. `refreshStatus()`
  already re-validates any token older than 55 minutes before a proxy request, and a
  401/403 logs the user out regardless, so the app returns to the PKCE sign-in flow on
  its own.

### 3.3 `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`

Supabase dashboard → Project Settings → API → **Roll** the `service_role` key
(Database → **Reset database password** for `DATABASE_URL`). Update both Vercel and
`.env.local`, redeploy, then confirm a generation succeeds — `/api/ai/generate` runs on
the Edge runtime and reaches the quota RPCs over PostgREST, so a stale service-role key
surfaces as a failing generation while sign-in still looks perfectly healthy. Always
verify with a generation, never with a login.

When re-pasting `DATABASE_URL`: use the **Transaction pooler** URI and do **not** append
`?sslmode=require` — `node-postgres` reads it as `verify-full` and lets it override the
in-code TLS config, which then fails without a CA. TLS is configured in `lib/pgSsl.ts`
via `SUPABASE_CA_CERT`, and any `ssl*` URL parameter is stripped.

### 3.4 `DODO_API_KEY` / `DODO_WEBHOOK_SECRET`

Dodo dashboard → Developer → API Keys → issue new, update Vercel, redeploy, then revoke
the old key (payments is the one place to overlap rather than delete-first — an
in-flight checkout must not 500). Webhook signing secret: Developer → Webhooks → roll
the signing secret and update `DODO_WEBHOOK_SECRET` in the same window; a mismatch makes
every webhook fail signature verification, which means paid upgrades silently do not
apply. Verify with a test-mode checkout end to end before closing the window.

### 3.5 `RESEND_API_KEY` / `GOOGLE_CLIENT_SECRET`

Resend → API Keys → create new, update, redeploy, delete old. Verify by requesting one
email OTP. Google Cloud Console → Credentials → OAuth client → **Add secret**, update,
redeploy, then delete the old secret. Verify with one Google sign-in. Existing Google
refresh tokens in `account` survive a client-secret rotation — no user is signed out.

---

## 4. Quarterly rotation checklist

Run on the first business day of each quarter. Tick every line; the completed checklist
is the audit evidence for DPDP §8(5) and IT Act §43A.

- [ ] `BETTER_AUTH_SECRET` rotated + `session` purged (§3.2)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` rolled (§3.3)
- [ ] `DATABASE_URL` password reset (§3.3)
- [ ] `GEMINI_API_KEY` reissued (§3.1)
- [ ] `DODO_API_KEY` + `DODO_WEBHOOK_SECRET` rolled, test checkout passes (§3.4)
- [ ] `RESEND_API_KEY` rolled, OTP email verified (§3.5)
- [ ] `GOOGLE_CLIENT_SECRET` rolled if annual due, sign-in verified (§3.5)
- [ ] No secret appears under a `VITE_` or `NEXT_PUBLIC_` prefix in either repo
- [ ] `git ls-files | grep -i '\.env'` returns only `.env.example` in both repos
- [ ] Vercel project members and Supabase collaborators reviewed; departed accounts removed
- [ ] Date, operator, and outcome recorded below

## 5. Rotation log

| Date | Secrets rotated | Operator | Notes |
|---|---|---|---|
| 2026-08-06 | `JWT_SECRET` **removed** (dead variable, 2026-07 CVE exposure) | — | R-01. `GEMINI_API_KEY` reissue still open — see §3.1. |
