/**
 * Composer ▸ History sub-tab body — the local run log with a one-click reuse.
 * Entitlement gating (canUseHistory / ProFeatureGate) is the caller's job; this
 * only reads the store and renders. Reads `entries` as a selector so a
 * completed run repaints this panel alone, never the composer.
 */
import { useHistoryStore } from "@/store/historyStore";

type Props = {
  /** Load a past run's text back into the editor. */
  onReuse: (text: string) => void;
};

/** First line, trimmed to a card-friendly length. */
function preview(body: string): string {
  return body.trim().split("\n")[0]?.slice(0, 80) || "Untitled run";
}

export function HistoryPanel({ onReuse }: Props) {
  const entries = useHistoryStore((s) => s.entries);

  if (entries.length === 0) {
    return (
      <div className="ig-empty">
        <span className="ig-empty__icon">
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
        </span>
        <div className="ig-empty__title">No history yet</div>
        <div className="ig-empty__hint">
          Prompts you send from the composer show up here with their timing and
          token counts — reuse any of them with one click.
        </div>
      </div>
    );
  }

  return (
    <ul className="ig-list" aria-label="Prompt history">
      {entries.map((h) => (
        <li key={h.id} className="ig-history">
          {/* Title when the run carried one (floater runs log no body);
              preview() still covers entries written before titles existed. */}
          <div className="ig-history__body">{h.title || preview(h.body)}</div>
          <div className="ig-history__meta">
            <span>{new Date(h.at).toLocaleString()}</span>
            {h.outputTokens != null && (
              <span>{h.outputTokens.toLocaleString()} tok</span>
            )}
            {h.totalMs != null && <span>{Math.round(h.totalMs)} ms</span>}
          </div>
          <button className="ig-btn" onClick={() => onReuse(h.body)}>
            <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
            Reuse
          </button>
        </li>
      ))}
    </ul>
  );
}
