"use client";

import { useEffect, useState } from "react";

const prompts = [
  "Rewrite this email to sound more confident",
  "Summarize the selected paragraph in 2 lines",
  "Write a SQL query for monthly signups",
  "Translate this reply into French",
];

export function Typewriter() {
  const [text, setText] = useState("");
  useEffect(() => {
    // A JS-driven ticker is invisible to the global prefers-reduced-motion
    // block, so it has to opt out here: show one prompt, never animate it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(prompts[0]);
      return;
    }
    let p = 0,
      i = 0,
      deleting = false,
      pause = 0;
    const t = setInterval(() => {
      const full = prompts[p];
      if (!deleting) {
        i++;
        if (i >= full.length) {
          i = full.length;
          if (pause) {
            if (--pause === 0) deleting = true;
          } else pause = 26;
        }
      } else {
        i -= 3;
        if (i <= 0) {
          i = 0;
          deleting = false;
          p = (p + 1) % prompts.length;
        }
      }
      setText(full.slice(0, Math.max(0, i)));
    }, 55);
    return () => clearInterval(t);
  }, []);
  return <span>{text}</span>;
}
