/**
 * Pure helpers for managing the provider list (SPEC §5.4, §13.3.2). Kept free
 * of React so everything is unit-testable in isolation.
 */
import { MAX_PROMPT_CHARS, type ProviderConfig } from "@/types";

export function emptyProvider(): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    baseUrl: "",
    apiKey: "",
    isDefault: false,
  };
}

/** Validate a provider; returns human-readable errors (empty = valid). */
export function validateProvider(p: ProviderConfig): string[] {
  const errors: string[] = [];
  if (!p.name.trim()) errors.push("Name is required.");
  if (!p.baseUrl.trim()) {
    errors.push("Base URL is required.");
  } else if (!/^https:\/\/.+/i.test(p.baseUrl.trim())) {
    errors.push(
      "Base URL must start with https:// (a plaintext http:// URL would send your API key in cleartext)."
    );
  }
  return errors;
}

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

/** Insert or update by id. A provider marked default demotes the others. */
export function upsertProvider(
  list: ProviderConfig[],
  provider: ProviderConfig
): ProviderConfig[] {
  const exists = list.some((p) => p.id === provider.id);
  let next = exists
    ? list.map((p) => (p.id === provider.id ? provider : p))
    : [...list, provider];

  if (provider.isDefault) {
    next = next.map((p) =>
      p.id === provider.id ? p : { ...p, isDefault: false }
    );
  }
  // Guarantee at least one default when any provider exists.
  if (next.length > 0 && !next.some((p) => p.isDefault)) {
    next = next.map((p, i) => (i === 0 ? { ...p, isDefault: true } : p));
  }
  return next;
}

/** Mark `id` as the sole default. */
export function setDefaultProvider(
  list: ProviderConfig[],
  id: string
): ProviderConfig[] {
  return list.map((p) => ({ ...p, isDefault: p.id === id }));
}

/** Remove `id`; if it was the default, promote the first remaining provider. */
export function removeProvider(
  list: ProviderConfig[],
  id: string
): ProviderConfig[] {
  const next = list.filter((p) => p.id !== id);
  if (next.length > 0 && !next.some((p) => p.isDefault)) {
    next[0] = { ...next[0], isDefault: true };
  }
  return next;
}

/** The id of the current default provider, if any. */
export function defaultProviderId(list: ProviderConfig[]): string | null {
  return list.find((p) => p.isDefault)?.id ?? list[0]?.id ?? null;
}
