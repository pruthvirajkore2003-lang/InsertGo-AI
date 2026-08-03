/**
 * Reusable tab bar — W3C APG "Tabs" pattern with automatic activation and a
 * roving tabindex (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
 *   - only the active tab sits in the Tab order (tabIndex 0 / -1),
 *   - ArrowLeft/ArrowRight move focus with wrap-around and activate the
 *     focused tab immediately (panels render instantly from local state, so
 *     automatic activation is the right variant),
 *   - Home/End jump to the first/last tab.
 * Styled by the existing .ig-tabs / .ig-tab segmented control.
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Crisp, bounceless settle (damping 20 prevents overshoot). */
const INDICATOR_SPRING = { type: "spring", stiffness: 200, damping: 20 } as const;

export type TabDef = {
  id: string;
  label: string;
  icon?: string;
  /** Show a lock glyph — the tab stays clickable so its panel can explain why. */
  locked?: boolean;
};

type TabsProps = {
  tabs: TabDef[];
  /** Id of the active tab (controlled). */
  value: string;
  onChange: (id: string) => void;
  "aria-label": string;
  /** Prefix for the tab/panel id pairs (`${idBase}-tab-*` / `${idBase}-panel-*`). */
  idBase: string;
};

export function Tabs({
  tabs,
  value,
  onChange,
  "aria-label": ariaLabel,
  idBase,
}: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // null until first measurement lands — the indicator stays invisible.
  const [ind, setInd] = useState<{ x: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const el = refs.current[tabs.findIndex((t) => t.id === value)];
    if (!el) return;
    setInd({ x: el.offsetLeft, width: el.offsetWidth });
  }, [tabs, value]);

  // Before paint, so the first position never animates in from 0.
  useLayoutEffect(measure, [measure]);

  // Container is inline-flex, so any label/font/window resize changes its
  // box — one observer covers all re-measure triggers.
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = tabs.findIndex((t) => t.id === value);
      let next: number;
      if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    },
    [tabs, value, onChange]
  );

  return (
    <div
      ref={listRef}
      className="ig-tabs"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className="ig-tab-indicator"
        aria-hidden="true"
        initial={false}
        animate={{ x: ind?.x ?? 0, width: ind?.width ?? 0, opacity: ind ? 1 : 0 }}
        transition={reducedMotion ? { duration: 0 } : INDICATOR_SPRING}
      />
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.id}`}
          aria-controls={`${idBase}-panel-${t.id}`}
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          className="ig-tab"
          onClick={() => onChange(t.id)}
        >
          {t.icon && <i className={`fa-solid ${t.icon}`} aria-hidden="true" />}
          {t.label}
          {t.locked && (
            <i
              className="fa-solid fa-lock ig-tab-lock"
              role="img"
              aria-label="Requires Pro"
            />
          )}
        </button>
      ))}
    </div>
  );
}

type TabPanelProps = {
  /** Tab id this panel belongs to (matches a TabDef.id). */
  id: string;
  idBase: string;
  className?: string;
  children: ReactNode;
};

/** Render only the active panel (unmount inactive ones, matching the app's
 *  conditional-render style) — the caller owns that conditional. */
export function TabPanel({ id, idBase, className, children }: TabPanelProps) {
  return (
    <motion.div
      role="tabpanel"
      id={`${idBase}-panel-${id}`}
      aria-labelledby={`${idBase}-tab-${id}`}
      className={`ig-tabpanel${className ? ` ${className}` : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
