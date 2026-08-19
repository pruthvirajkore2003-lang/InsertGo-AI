import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/* Arrow-key roving inside a row of buttons; Tab order stays natural. */
export function arrowNav(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const buttons = Array.from(
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
  );
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i === -1) return;
  e.preventDefault();
  const next = e.key === "ArrowRight" ? i + 1 : i - 1;
  buttons[(next + buttons.length) % buttons.length]?.focus();
}
