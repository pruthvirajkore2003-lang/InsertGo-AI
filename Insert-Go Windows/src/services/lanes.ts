/**
 * Provider resolution: every request runs through the hosted InsertGo backend
 * (the "proxy" lane, SPEC §5.4). The client holds no LLM key — the server does
 * (`aiProviders.ts`).
 *
 * The single route is resolved here rather than inlined at the four call sites
 * (composer, Inline Improve, prompt refiner, skill wizard). Keeping the seam
 * means a second route later is one edit, not four.
 */
import type { AiProvider } from "./aiProviders";
import { createProvider } from "./aiProviders";

/** Proxy-lane config (SPEC §5.4). `apiKey` is a placeholder: the real key is
 *  server-held and never reaches this process. */
const PROXY_CONFIG = {
  id: "backend",
  name: "Backend Proxy",
  baseUrl: "https://generativelanguage.googleapis.com",
  apiKey: "dummy",
  isDefault: true,
};

export type ResolvedLane = {
  provider: AiProvider;
  /** The hosted relay always needs an InsertGo session. */
  requiresLogin: boolean;
};

/**
 * Resolve the provider for a request. `purpose` is accepted (and ignored) so
 * the call sites keep documenting chat vs improve intent; the hosted lane
 * serves both from one server-side model config.
 */
export async function resolveActiveProvider(
  _purpose: "chat" | "improve" = "chat"
): Promise<ResolvedLane> {
  return { provider: createProvider(PROXY_CONFIG), requiresLogin: true };
}
