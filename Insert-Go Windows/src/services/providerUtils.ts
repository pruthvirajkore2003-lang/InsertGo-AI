/**
 * Pure helpers for the one provider lane (SPEC §5.4). Kept free of React so
 * everything is unit-testable in isolation.
 */
import { MAX_PROMPT_CHARS, type ProviderConfig } from "@/types";

// The provider-editor UI (`emptyProvider`, `validateProvider`) went with BYOK
// on 2026-08-08 (R-15). The list helpers (`upsertProvider`, `removeProvider`,
// `setDefaultProvider`, `defaultProviderId`) followed on 2026-08-11: with one
// server-held lane there is no list to edit, so their only caller was a set of
// settingsStore actions no UI ever dispatched. What remains is what the single
// lane actually uses.

/** Throw when a prompt exceeds the hard length cap — called at the top of
 *  every provider `send()` so a runaway paste can't exhaust quota (M-4). */
export function enforcePromptLimit(prompt: string, providerName: string): void {
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(
      `Provider "${providerName}": prompt is too long ` +
        `(${prompt.length.toLocaleString()} chars; max ` +
        `${MAX_PROMPT_CHARS.toLocaleString()}). Shorten the input.`
    );
  }
}

/**
 * True when a provider's Base URL points at Google's Gemini API host.
 * Parses the URL and compares the hostname exactly — never substring-matches —
 * so a look-alike domain (generativelanguage.googleapis.com.evil.example) is
 * not treated as Gemini and never receives the key via the Gemini code path.
 */
export function isGeminiProvider(config: ProviderConfig): boolean {
  try {
    return (
      new URL(config.baseUrl).hostname === "generativelanguage.googleapis.com"
    );
  } catch {
    return false;
  }
}
