/**
 * Console logging that can never leak a credential (SECURITY.md "Logging").
 * Any code path that might touch a session token or API key must log through
 * `safeError` instead of `console.error` — exported logs include console
 * output, so a raw error interpolating a header would ship the secret.
 */

/** Secret-shaped substrings: Bearer headers and common API-key prefixes
 *  (OpenAI sk-/sk-proj-, Google AIza/AQ., Anthropic sk-ant-, OpenRouter
 *  sk-or-, generic long base64url blobs after "key"/"token" assignments). */
const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi,
  /\bsk-[A-Za-z0-9\-_]{16,}/g,
  /\bAIza[A-Za-z0-9\-_]{10,}/g,
  /\bAQ\.[A-Za-z0-9\-_]{16,}/g,
  /\b(api[-_]?key|token|secret)["']?\s*[:=]\s*["']?[A-Za-z0-9\-._~+/=]{16,}/gi,
];

/** Redact secret-shaped substrings from a string. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, re) => out.replace(re, "[REDACTED]"),
    text
  );
}

/** Redact one log argument. Error objects are flattened to their redacted
 *  message (+ name) — never the raw object, whose properties could carry
 *  request headers. Non-strings are stringified then redacted. */
function sanitize(arg: unknown): unknown {
  if (typeof arg === "string") return redact(arg);
  if (arg instanceof Error) return `${arg.name}: ${redact(arg.message)}`;
  try {
    return redact(JSON.stringify(arg));
  } catch {
    return "[unserializable]";
  }
}

/** Drop-in `console.error` replacement that redacts Bearer tokens / API keys. */
export function safeError(...args: unknown[]): void {
  console.error(...args.map(sanitize));
}
