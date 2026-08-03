/**
 * Searchable dropdown — W3C APG "Editable Combobox with List Autocomplete"
 * pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), built like
 * `Tabs.tsx`: native ARIA, framer-motion for the popup enter/exit.
 *   - the <input> is the combobox (role="combobox", aria-expanded,
 *     aria-controls, aria-activedescendant); options are non-focusable
 *     role="option" divs, focus never leaves the input,
 *   - typing filters options (case-insensitive substring) and opens the list,
 *   - ArrowDown/ArrowUp traverse filtered options with wrap-around,
 *     Home/End jump, Enter selects, Escape closes (then clears the query),
 *   - closing without selecting reverts the input to the selected label;
 *     outside pointerdown or Tab/blur closes the list.
 * Styled by .ig-combobox (components.css), field chrome shared with .ig-input.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** macOS-menu expand: fast ease-out settle, slight scale + rise. */
const POP_TRANSITION = { duration: 0.2, ease: [0.32, 0.72, 0, 1] } as const;

export type SelectOption = { value: string; label: string };

type Props = {
  /** Id for the input, so an external <label htmlFor> associates normally. */
  id: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** false = plain select: no typing/filtering, list always shows all options. */
  searchable?: boolean;
};

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  autoFocus,
  placeholder,
  searchable = true,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);
  const q = searchable ? query.trim().toLowerCase() : "";
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  // While open the input shows the live query; closed, the selected label.
  const inputValue = open && searchable ? query : selected?.label ?? "";
  const listId = `${id}-listbox`;
  const activeId =
    open && filtered[activeIndex] ? `${id}-opt-${activeIndex}` : undefined;

  const openList = () => {
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const select = (opt: SelectOption) => {
    onChange(opt.value);
    close();
  };

  // Click outside closes (pointerdown so it beats focus juggling).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(id)}-opt-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, id]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (filtered.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + delta + filtered.length) % filtered.length);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      if (!open) return; // closed: let the surrounding form submit
      e.preventDefault();
      if (filtered[activeIndex]) select(filtered[activeIndex]);
      else close();
    } else if (e.key === "Escape") {
      if (!open) return; // closed: let the dialog's Esc handler run
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close(); // move on with the natural tab order
    }
  };

  return (
    <div className="ig-combobox" ref={rootRef}>
      <input
        id={id}
        className="ig-input ig-combobox__input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete={searchable ? "list" : "none"}
        autoComplete="off"
        autoFocus={autoFocus}
        readOnly={!searchable}
        placeholder={selected?.label ?? placeholder ?? "Search…"}
        value={inputValue}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Ignore blur into our own popup (option mousedown), close otherwise.
          if (!rootRef.current?.contains(e.relatedTarget as Node)) close();
        }}
      />
      <i className="fa-solid fa-chevron-down ig-combobox__chevron" aria-hidden="true" />
      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            className="ig-combobox__list"
            role="listbox"
            ref={listRef}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={reducedMotion ? { duration: 0 } : POP_TRANSITION}
          >
          {filtered.length === 0 && (
            <div className="ig-combobox__empty">No matches</div>
          )}
          {filtered.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`ig-combobox__option${
                i === activeIndex ? " is-active" : ""
              }`}
              // mousedown (not click) so the input's blur doesn't close first.
              onMouseDown={(e) => {
                e.preventDefault();
                select(o);
              }}
              onMouseMove={() => setActiveIndex(i)}
            >
              {o.label}
            </div>
          ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
