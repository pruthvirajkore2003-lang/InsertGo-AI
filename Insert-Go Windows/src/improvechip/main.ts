/**
 * Improve progress chip — the third webview window (SPEC §4.4). A one-line
 * status pill shown near the cursor while an Inline Improve run is in
 * flight; the window itself is non-activating (`WS_EX_NOACTIVATE`, see
 * platform/improve.rs), so it can never steal the target field's focus.
 *
 * Deliberately not React: the chip renders one icon + one string. All state
 * arrives via the `improve:chip` event; show/hide is Rust's job.
 */
import { listen } from "@tauri-apps/api/event";

type ChipPayload = {
  /** "working" | "done" | "error" | "info" */
  state: string;
  message: string;
};

const ICONS: Record<string, string> = {
  working: "⟳",
  done: "✓",
  error: "✕",
  info: "ℹ",
};

const root = document.getElementById("root")!;

const style = document.createElement("style");
style.textContent = `
  html, body { margin: 0; background: transparent; overflow: hidden; }
  .chip {
    box-sizing: border-box;
    display: flex; align-items: center; gap: 8px;
    height: 36px; margin: 4px; padding: 0 14px;
    max-width: calc(100vw - 8px);
    border-radius: 18px;
    background: #1c1c22; color: #f2f2f5;
    border: 1px solid rgba(255, 255, 255, 0.14);
    font: 500 13px/1 system-ui, "Segoe UI", sans-serif;
    white-space: nowrap; overflow: hidden;
    user-select: none; cursor: default;
  }
  .chip__icon { flex: none; width: 14px; text-align: center; }
  .chip--working .chip__icon { animation: spin 0.9s linear infinite; }
  .chip--done .chip__icon { color: #6fdd8b; }
  .chip--error .chip__icon { color: #ff7d7d; }
  .chip__text { overflow: hidden; text-overflow: ellipsis; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

function render({ state, message }: ChipPayload) {
  const chip = document.createElement("div");
  chip.className = `chip chip--${state}`;

  const icon = document.createElement("span");
  icon.className = "chip__icon";
  icon.textContent = ICONS[state] ?? ICONS.info;

  const text = document.createElement("span");
  text.className = "chip__text";
  // textContent, never innerHTML: the message can echo provider error
  // strings and must stay inert text.
  text.textContent = message;

  chip.append(icon, text);
  root.replaceChildren(chip);
}

// Plain vite dev (no Tauri) has no event bridge — stay blank instead of an
// unhandled rejection (same tolerance as the App-level listeners).
void listen<ChipPayload>("improve:chip", (e) => render(e.payload)).catch(
  () => undefined
);
