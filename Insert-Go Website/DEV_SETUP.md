# Local dev setup — auth for the desktop app

The InsertGo desktop app signs in through **this website's** Better Auth server
using OAuth 2.0 Authorization Code + PKCE over the `insertgo://` URI scheme
(RFC 8252). If the website's auth env isn't configured, the desktop's "Sign in
with browser" can't complete. This is the minimum to make it work locally.

## 1. Database schema

Apply the auth schema once against your Postgres (Supabase), then the RPC
surface the Edge generate route calls:

```bash
psql "$DATABASE_URL" -f supabase-auth-schema.sql
psql "$DATABASE_URL" -f supabase-edge-rpc.sql
psql "$DATABASE_URL" -f supabase-audit-log.sql          # CERT-In 180-day log + detector
psql "$DATABASE_URL" -f supabase-session-hardening.sql  # hashed session tokens (R-04)
```

Order matters for the last one against an existing database: it rewrites live
session tokens into the hashed form the app looks them up by, so run it **after**
deploying the code, not before. Both orders fail closed (a mismatch is a 401),
but running it first signs everyone out until the deploy lands.

## 2. Environment

Copy `.env.example` to `.env.local` and fill at least these:

| Var | Why | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Sessions, users and short-lived authorization codes live here | Supabase → Database → Connection string (URI). Don't append `?sslmode=…` (see the note in `.env.example`). |
| `BETTER_AUTH_URL` | **Must equal the origin the desktop targets** | Match the desktop's `VITE_API_URL`. If the site runs on `http://localhost:3005`, set both to that exact origin. A mismatch breaks the token exchange. |
| `BETTER_AUTH_SECRET` | Signs sessions/tokens | `openssl rand -base64 32` |

### `/api/ai/generate` (Edge runtime)

That route runs on the Edge runtime and cannot open a socket, so it reaches
Postgres over PostgREST and its caches over Upstash. Everything below is
optional for auth work but required to actually generate.

| Var | Why | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | PostgREST origin for the quota/credit RPCs | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The only role granted `EXECUTE` on those functions | Server-only. Never expose it to a client bundle. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Shared grounding cache + session memo | Unset ⇒ both silently degrade to "no cache" |
| `UPSTASH_VECTOR_REST_URL` / `_TOKEN` | Shared semantic cache | Create the index with **dimension = `SEMCACHE_EMBED_DIM` (768)** and **similarity = COSINE**. Unset ⇒ semantic caching is off. |

Point `DATABASE_URL` at Supabase's **transaction pooler** (port `6543`) in any
deployed environment: the Node surfaces that still use `pg` (Better Auth, the
billing webhook, the account page) each hold a small pool per instance, and the
pooler is what keeps N instances from exhausting Postgres.

### Origin must match on both sides

The desktop reads `VITE_API_URL` (defaults to `http://localhost:3000`); the
website reads `BETTER_AUTH_URL`. **These two must be the same origin** (scheme +
host + port). Better Auth's `trustedOrigins` already lists `http://localhost:3005`,
so `:3005` works out of the box — just point `VITE_API_URL` at it too.

## 3. Sign-in methods

- **Email OTP** — works with **no extra config**. Without `RESEND_API_KEY`, the
  one-time code is **printed to the website's dev server console** (not emailed).
  Read it from the terminal and enter it in the browser. This is the fastest path
  for local testing.
- **Google / SSO** — needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
  (authorized redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google`). Without
  these, the Google button on `/login` can't complete — fall back to email OTP.

### Contact form (`/contact` → `POST /api/contact`)

Shares the OTP mailer, and sends **two** mails per submission:

| # | To | Reply-to | Purpose |
|---|----|----------|---------|
| 1 | `CONTACT_TO` | the visitor | the enquiry — reply to it to answer the sender |
| 2 | the visitor | `CONTACT_TO` | instant acknowledgement receipt |

The receipt carries RFC 3834's `Auto-Submitted: auto-replied` and
`X-Auto-Response-Suppress: All`, and is **withheld** from machine addresses
(`noreply@`, `no-reply@`, `mailer-daemon@`, `postmaster@`, `bounce@`) — both
guard against a mail loop with a vacation responder or bounce daemon. If only
the receipt fails the route still answers `200 {ok, submissionId}`: the enquiry
is already filed, and a 502 there would just duplicate the ticket.

Without `RESEND_API_KEY` the submission is **printed to the dev server console**
instead of sent, same as the OTP path, together with the envelope both mails
would have used; in production that branch returns 503 rather than reporting a
false success.

Set `CONTACT_TO` to the inbox that should receive enquiries (default
`support@insertgo.ai`).

**Resend sandbox rule — this is what bites in local dev.** On an unverified
Resend account the shared `onboarding@resend.dev` sender only delivers to **the
Resend account owner's own address**. That now applies to *both* mails, so to
see the full flow locally:

1. `RESEND_API_KEY=re_…` in `.env.local`.
2. `CONTACT_TO=` your Resend account's own email.
3. Type **that same address** into the form's Email field.

Any other recipient comes back 403: on mail 1 the route answers 502, on mail 2
it answers 200 and logs `[contact] acknowledgement failed`. Verify a domain in
Resend and point `EMAIL_FROM` at an address on it to mail arbitrary visitors —
required before going live.

Rate limit: 5 submissions per hour per IP, enforced twice — `withinIpRateLimit`
(shared via `UPSTASH_REDIS_REST_*`, fails open) plus a per-instance floor, so an
unconfigured Redis still bounds mail sent to a caller-supplied address.

## 4. Verify the desktop flow

1. Start the website (`npm run dev`) on whatever port; note the origin.
2. Point the desktop's `VITE_API_URL` and this app's `BETTER_AUTH_URL` at that
   same origin.
3. In the desktop app: Settings → Account → **Sign in with browser**. The system
   browser should open to `/desktop/authorize?code_challenge=…`. Run the desktop
   as a real app (`npm run tauri:dev`), not browser dev mode — a browser has no
   `insertgo://` handler, so the callback could never come back.
4. Sign in there if needed (email OTP or Google), then **Approve and open
   InsertGo**. The browser hands the app an authorization code and the desktop
   trades it for a session.

If the browser doesn't open, the desktop panel shows a **Copy** button for the
authorize URL — paste it manually. If approving does nothing, the `insertgo://`
scheme isn't registered: dev builds register it at startup, so check the app's
log for "deep link scheme registration failed".
