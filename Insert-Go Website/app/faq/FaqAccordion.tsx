"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LinearAdd } from "@/components/icons/LinearAdd";
import { faqs } from "./faqs";

export function FaqAccordion() {
  const uid = useId();
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {faqs.map(([q, a], i) => {
        const isOpen = open === i;
        const panelId = `${uid}-panel-${i}`;
        const headerId = `${uid}-header-${i}`;
        return (
          <div
            key={q}
            className={`glass-card overflow-hidden transition-colors duration-300 ${
              isOpen ? "border-brand" : ""
            }`}
          >
            {/* h2, not h3 — the page's only h1 is the hero, so a h3 here would
                skip a level and break the outline for screen-reader users. */}
            <h2 className="m-0">
              <button
                type="button"
                id={headerId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                // Without aria-controls the toggle and the text it reveals are
                // two unrelated nodes to a screen reader.
                aria-controls={panelId}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-[22px] py-5 text-left text-base font-medium text-ink transition-colors duration-200 hover:bg-muted/5"
              >
                {q}
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                  className="flex shrink-0 text-brand"
                >
                  <LinearAdd size={18} />
                </motion.span>
              </button>
            </h2>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key={panelId}
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <p className="m-0 px-[22px] pb-5 text-[15px] leading-[1.7] text-muted">
                    {a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
