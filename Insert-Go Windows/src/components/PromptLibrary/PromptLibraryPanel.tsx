/** Saved-prompt library view (SPEC §4.3). */
import { useEffect } from "react";
import type { Prompt } from "@/types";
import { useLibraryStore } from "@/store/libraryStore";
import { PromptCard } from "./PromptCard";

type Props = {
  /** Called when a prompt is chosen — caller loads it and switches view. */
  onUse: (prompt: Prompt) => void;
};

export function PromptLibraryPanel({ onUse }: Props) {
  const { prompts, isLoading, error, load, remove } = useLibraryStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <div className="ig-muted">Loading…</div>;

  return (
    <div className="ig-body">
      {error && <div className="ig-error">{error}</div>}
      {prompts.length === 0 ? (
        <div className="ig-empty">
          <span className="ig-empty__icon">
            <i className="fa-solid fa-inbox" aria-hidden="true" />
          </span>
          <div className="ig-empty__title">No saved prompts yet</div>
          <div className="ig-empty__hint">
            Compose a prompt and hit “Save” — it will show up here, ready to
            reuse with one click.
          </div>
        </div>
      ) : (
        <div className="ig-list">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              onUse={onUse}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
