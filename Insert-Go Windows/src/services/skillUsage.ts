/**
 * Per-skill usage frequency for the smart selection bar (SPEC §4.1 extension).
 * A tiny localStorage-backed counter: each time the user runs a skill from the
 * bar, its count ticks up, and `rankSkills` (selectionContext.ts) uses those
 * counts as a small tie-breaker so the bar gradually adapts to how one person
 * works. localStorage is per-origin, and both the palette and skillbar windows
 * share the app origin, so a use recorded in either surface is visible to both.
 *
 * Best-effort by design: every access is guarded, so a disabled/quota-full/
 * exception-throwing storage (private-mode webviews, corrupt JSON) degrades to
 * "no history" rather than breaking the bar. Framework-free and pure enough to
 * unit-test with a mocked storage.
 *
 * Privacy (SPEC §10): only skill IDs and counts are stored — never any
 * selection text.
 */

const STORAGE_KEY = "ig.skillUsage";

/** The backing store, or null when unavailable (SSR, sandboxed webview). */
function store(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    // Accessing localStorage can itself throw (blocked cookies / storage).
    return null;
  }
}

/** Read the full usage map. Never throws; a malformed value resets to empty. */
export function getSkillUsage(): Record<string, number> {
  const s = store();
  if (!s) return {};
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    // Keep only well-formed numeric entries — defends against hand-edited or
    // partially-written storage.
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Increment `skillId`'s counter by one. Best-effort — silently no-ops if the
 *  store is unavailable or the write fails (quota, private mode). */
export function recordSkillUse(skillId: string): void {
  const s = store();
  if (!s) return;
  try {
    const usage = getSkillUsage();
    usage[skillId] = (usage[skillId] ?? 0) + 1;
    s.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    /* ignore — usage history is a nice-to-have, never load-bearing */
  }
}
