/**
 * Icon picker popup (SkillManager → "Select Icon"). A dialog over the Skill
 * Manager that lets the user search and pick a glyph for a custom skill.
 *
 * LOCAL by design: it browses the curated `ICON_PRESETS` catalog, not an
 * online icon library. This app renders icons through a hand-mapped codepoint
 * table (styles/fontawesome.css) — there is no FA class→glyph resolver — so
 * any icon not in that table renders blank. Sourcing from an online API would
 * hand back thousands of `fa-*` names the bundled font can't draw; the picker
 * therefore only offers glyphs proven to render (guarded by a vitest check).
 *
 * Esc is intentionally NOT bound here: SkillManagerModal owns a single
 * window-level Escape handler that closes this picker first (it is the top
 * layer) and the manager only when the picker is shut — one listener, no
 * capture-phase race between two dialogs on the same window.
 */
import { useMemo, useRef, useState } from "react";
import { ICON_PRESETS } from "@/services/skills";

type Props = {
  isOpen: boolean;
  /** The skill's current glyph — the matching tile shows as selected. */
  currentIcon?: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
};

/** "fa-file-lines" → "file lines" for labels/search ("fa-" is noise here). */
const iconLabel = (icon: string): string =>
  icon.replace(/^fa-/, "").replace(/-/g, " ");

export function IconPickerModal({
  isOpen,
  currentIcon,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  // Local filter — instant, so no debounce/abort/loading machinery is needed.
  const icons = useMemo(
    () =>
      q
        ? ICON_PRESETS.filter(
            (i) => iconLabel(i).includes(q) || i.includes(q)
          )
        : ICON_PRESETS,
    [q]
  );

  if (!isOpen) return null;

  return (
    <div className="ig-iconpicker__overlay" onClick={onClose}>
      <div
        className="ig-iconpicker__card"
        role="dialog"
        aria-modal="true"
        aria-label="Select Icon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ig-iconpicker__head">
          <div className="ig-modal__title">Select Icon</div>
          <button
            type="button"
            className="ig-btn ig-skillfloater__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="ig-iconpicker__search">
          <i
            className="fa-solid fa-magnifying-glass ig-iconpicker__searchicon"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            className="ig-input"
            value={query}
            placeholder="Search icons…"
            aria-label="Search icons"
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="ig-iconpicker__clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>

        {icons.length === 0 ? (
          <div className="ig-iconpicker__empty">
            No icons found matching “{query}”.
          </div>
        ) : (
          <div
            className="ig-iconpicker__grid"
            role="group"
            aria-label="Icons"
          >
            {icons.map((icon) => {
              const active = currentIcon === icon;
              return (
                <button
                  key={icon}
                  type="button"
                  className={
                    "ig-iconpicker__tile" +
                    (active ? " ig-iconpicker__tile--active" : "")
                  }
                  aria-pressed={active}
                  title={iconLabel(icon)}
                  aria-label={iconLabel(icon)}
                  onClick={() => {
                    onSelect(icon);
                    onClose();
                  }}
                >
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
