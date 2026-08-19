/**
 * Local run history — the "Local History" paid feature (gated by
 * canUseHistory()). A small localStorage-backed log of completed composer
 * runs: the prompt body, when it ran and its token/latency metrics, surfaced
 * in the Composer ▸ History sub-tab.
 *
 * Recorded from both windows: the main composer and the selection floater (a
 * separate webview) both call record() on a completed run. Neither writes the
 * selection text — the composer logs its editor body, the floater's run
 * leaves `body` empty (runProvider never sets it) — so selection text never
 * leaks into this log (SPEC §10 privacy invariant; same rule skillUsage.ts
 * follows). localStorage is shared across webviews, so a `storage` listener
 * refreshes the main window's in-memory entries when the floater appends.
 *
 * Best-effort persistence: every storage access is guarded, so a blocked or
 * quota-full store degrades to an in-memory log rather than throwing.
 */
import { create } from "zustand";

export type HistoryEntry = {
  id: string;
  /** The prompt text that was sent. */
  body: string;
  /** ISO-8601 wall-clock time the run completed. */
  at: string;
  /** Label of the skill that ran, shown instead of a `body` preview. Absent on
   *  entries written before this field existed. Never selection text — only a
   *  skill label (SPEC §10), so it is safe to persist for floater runs. */
  title?: string;
  /** Provider-reported output tokens; null when none were reported. */
  outputTokens: number | null;
  /** Total run time in ms; null if unavailable. */
  totalMs: number | null;
};

const STORAGE_KEY = "ig.runHistory";
// ponytail: flat cap, oldest dropped. Add paging/search if 100 isn't enough.
const CAP = 100;

/** The backing store, or null when unavailable (sandboxed webview, blocked). */
function backing(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Read the log. Never throws; a malformed value resets to empty. */
function load(): HistoryEntry[] {
  const s = backing();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as HistoryEntry).id === "string" &&
        typeof (e as HistoryEntry).body === "string" &&
        typeof (e as HistoryEntry).at === "string" &&
        // Optional: legacy entries have no title at all.
        ["string", "undefined"].includes(typeof (e as HistoryEntry).title)
    );
  } catch {
    return [];
  }
}

/** Best-effort write — silently no-ops if the store is unavailable/full. */
function persist(entries: HistoryEntry[]): void {
  const s = backing();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore — history is a nice-to-have, never load-bearing */
  }
}

type HistoryState = {
  entries: HistoryEntry[];
  /** Prepend a completed run (id + timestamp stamped here). */
  record: (run: Omit<HistoryEntry, "id" | "at">) => void;
  /** Re-read entries from storage (cross-window sync). */
  reload: () => void;
  clear: () => void;
};

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: load(),
  record: (run) =>
    set((s) => {
      const entry: HistoryEntry = {
        ...run,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      };
      const entries = [entry, ...s.entries].slice(0, CAP);
      persist(entries);
      return { entries };
    }),
  reload: () => set({ entries: load() }),
  clear: () => {
    persist([]);
    set({ entries: [] });
  },
}));

// Cross-window sync: `storage` fires only in OTHER windows, so when the
// selection floater appends a run the main window refreshes its History tab.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) useHistoryStore.getState().reload();
  });
}
