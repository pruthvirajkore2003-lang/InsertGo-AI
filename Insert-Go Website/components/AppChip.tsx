/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SPRING } from "./Reveal";

// A span, not a div: the marquee's duplicate track wraps these in a <span>, and
// a block-level element inside it is invalid HTML — React hydrates it into a
// different tree than the server rendered.
//
// Icons live in public/app-icons — self-hosted copies of the Iconify originals,
// so the marquee costs zero third-party requests.
//
// Every glyph sits on a white tile: several source SVGs (openai-icon,
// github-copilot) have no fill and default to black — invisible on the dark
// glass chip. The tile also normalizes visual weight across brands. Tile text
// colour is pinned dark so currentColor icons (cursor, windowsterminal) render
// dark-on-white instead of inheriting the page's light ink.
export function AppChip({ name, icon }: { name: string; icon: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      whileHover={reduce ? undefined : { scale: 1.05 }}
      transition={SPRING}
      className="glass-chip inline-flex items-center gap-3 rounded-full py-2.5 pr-6 pl-[11px] text-base font-medium whitespace-nowrap text-ink"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[#141414] shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]">
        <img
          src={`/app-icons/${icon}.svg`}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          className="block h-5 w-5 object-contain"
        />
      </span>
      {name}
    </motion.span>
  );
}
