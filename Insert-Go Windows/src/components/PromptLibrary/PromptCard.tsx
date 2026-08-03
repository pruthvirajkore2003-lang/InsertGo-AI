/** A single saved prompt row in the library list. */
import type { Prompt } from "@/types";

type Props = {
  prompt: Prompt;
  onUse: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
};

export function PromptCard({ prompt, onUse, onDelete }: Props) {
  return (
    <div className="ig-card">
      <div>
        <div className="ig-card__title">{prompt.title || "Untitled"}</div>
        {prompt.tags.length > 0 && (
          <div className="ig-card__tags">{prompt.tags.join(" · ")}</div>
        )}
      </div>
      <div className="ig-actions">
        <button className="ig-btn ig-btn--primary" onClick={() => onUse(prompt)}>
          Use
        </button>
        <button
          className="ig-btn ig-btn--danger"
          onClick={() => onDelete(prompt.id)}
        >
          <i className="fa-solid fa-trash-can" aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  );
}
