/**
 * Modal for setting a saved prompt's title and tags before persisting
 * (SPEC §4.3, §5.3). Body is shown read-only as a preview — it comes from the
 * composer editor.
 */
import { useState } from "react";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";

type Props = {
  body: string;
  initialTitle?: string;
  initialTags?: string[];
  onSave: (title: string, tags: string[]) => void;
  onCancel: () => void;
};

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function PromptEditorDialog({
  body,
  initialTitle = "",
  initialTags = [],
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags.join(", "));

  // Esc closes without saving; Mod+S saves (works while typing the title).
  const commit = () => onSave(title.trim() || "Untitled", parseTags(tags));
  useAppShortcuts({
    onClose: () => {
      onCancel();
    },
    onSave: () => {
      commit();
    },
  });

  return (
    <div className="ig-modal" onClick={onCancel}>
      <div
        className="ig-modal__card"
        role="dialog"
        aria-modal="true"
        aria-label="Save prompt"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ig-modal__title">Save prompt</div>

        <div className="ig-field">
          <label htmlFor="prompt-title">Title</label>
          <input
            id="prompt-title"
            className="ig-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title"
            autoFocus
          />
        </div>

        <div className="ig-field">
          <label htmlFor="prompt-tags">Tags (comma-separated)</label>
          <input
            id="prompt-tags"
            className="ig-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="code, writing, research"
          />
        </div>

        <div className="ig-field">
          <label>Preview</label>
          <div className="ig-modal__preview">{body}</div>
        </div>

        <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
          <button className="ig-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="ig-btn ig-btn--primary" onClick={commit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
