/**
 * Console logging that cannot leak a credential or an email address (R-06).
 *
 * The desktop repo has `src/services/safeLog.ts` for the secret half of this;
 * the website never grew an equivalent, which is why it grew ad-hoc logging
 * with no boundary to enforce. This is that boundary, plus the pattern the
 * desktop does not need: PERSONAL DATA. Vercel logs are readable by every
 * project member, exportable to support, and drainable to a third party, so an
 * address interpolated into an error line is disclosed to all of them for as
 * long as the platform keeps it.
 *
 * The vector that justifies a module rather than four careful edits is the
 * ERROR OBJECT, not the format string. A `pg` error's `detail` quotes the
 * offending row verbatim (`Key (email)=(a@b.com) already exists`), and a
 * provider SDK's message quotes the request it failed on ("You can only send
 * testing emails to your own address (x@y.com)"). Neither is auditable call
 * site by call site, and both arrive at `console.error(msg, e)` looking
 * harmless.
 *
 * What this deliberately CANNOT do: redact a one-time code. Six digits are
 * indistinguishable from a token count, an HTTP status or a credit balance, so
 * a regex that caught OTPs would have to eat all of those. The code is
 * therefore kept out of production logs structurally, at the call site in
 * lib/auth.ts — this module is the second line of defence, never the first.
 */

/** Secret-shaped substrings: Bearer headers and common API-key prefixes
 *  (Google AIza/AQ. — `lib/gemini.ts` holds one, OpenAI sk-/sk-proj-,
 *  Anthropic sk-ant-, generic long blobs after a key/token/secret assignment). */
const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi,
  /\bsk-[A-Za-z0-9\-_]{16,}/g,
  /\bAIza[A-Za-z0-9\-_]{10,}/g,
  /\bAQ\.[A-Za-z0-9\-_]{16,}/g,
  /\b(api[-_]?key|token|secret)["']?\s*[:=]\s*["']?[A-Za-z0-9\-._~+/=]{16,}/gi,
];

/** Addresses, wherever they appear — including inside a database error's
 *  quoted row or a provider's echoed request. Deliberately greedy about the
 *  local part: `first.last+tag@` is one address, not three tokens. */
const EMAIL_PATTERN = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

/** Redact secret- and address-shaped substrings from a string. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, re) => out.replace(re, "[REDACTED]"),
    text,
  ).replace(EMAIL_PATTERN, "[EMAIL]");
}

/** Redact one log argument. Error objects are flattened to their redacted
 *  message (+ name) and never passed through as objects — a `pg` DatabaseError
 *  carries `detail`, `where` and the failing row on properties the format
 *  string never names, and a sink that serialises the object would print all
 *  of them. Non-strings are stringified, then redacted. */
function sanitize(arg: unknown): unknown {
  if (typeof arg === "string") return redact(arg);
  if (arg instanceof Error) return `${arg.name}: ${redact(arg.message)}`;
  try {
    return redact(JSON.stringify(arg) ?? String(arg));
  } catch {
    return "[unserializable]";
  }
}

/** Drop-in `console.error` replacement. Use it anywhere an error object, a
 *  provider response or user-supplied text can reach a log line. */
export function safeError(...args: unknown[]): void {
  console.error(...args.map(sanitize));
}
