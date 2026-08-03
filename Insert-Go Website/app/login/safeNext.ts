/**
 * Post-login destination handling, shared by the login page (already-signed-in
 * bounce) and the form (every sign-in lane), so `next` is validated in exactly
 * one place.
 *
 * Two consumers with different rules, both satisfied here:
 *
 *  - `router.push(next)` needs a same-origin *path*. `/foo` is fine; anything a
 *    browser can read as protocol-relative is not — and that includes `/\host`,
 *    because browsers normalize `\` to `/` before parsing.
 *
 *  - Better Auth's `callbackURL` (Google, SSO) only accepts a relative URL that
 *    matches `[\w\-.+/@]` in the path and `[\w\-.+/=&%@]` in the query
 *    (matchesOriginPattern in better-auth/dist/auth/trusted-origins). The
 *    desktop PKCE flow round-trips through `/login?next=/desktop/authorize?…`
 *    carrying `redirect_uri=insertgo://auth/callback`, whose `:` and `/` fail
 *    that check — Better Auth then 403s the whole sign-in with
 *    INVALID_CALLBACK_URL and the user never reaches the approve screen. So the
 *    query is re-serialized percent-encoded; the browser decodes it back on
 *    arrival, and `searchParams` on the destination sees the original values.
 */
const FALLBACK = "/account";

export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return FALLBACK;
  // `//host` and `/\host` both escape the origin.
  if (raw[1] === "/" || raw[1] === "\\") return FALLBACK;
  // A backslash anywhere else can still be re-read as a separator.
  if (raw.includes("\\")) return FALLBACK;

  const q = raw.indexOf("?");
  if (q === -1) return raw;
  const path = raw.slice(0, q);
  const query = new URLSearchParams(raw.slice(q + 1)).toString();
  return query ? `${path}?${query}` : path;
}
