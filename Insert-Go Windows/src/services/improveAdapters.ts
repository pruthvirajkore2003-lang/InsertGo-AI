/**
 * Target-app adapter registry for Inline Improve (SPEC §5.6.2, §15.3).
 * Maps the captured window's `processName` + `windowTitle` to an adapter:
 * which placeholder text to ignore and which one-paragraph `<target>`
 * profile shapes the rewrite for that tool.
 *
 * Pure and framework-free (sibling of skills.ts) so it stays unit-testable.
 * Placeholder regexes are anchored, fixed-alternation patterns (ReDoS-safe)
 * — they mirror Wispr Flow's "ignore AI-chat placeholder hints" behavior:
 * an empty composer often *reads back* its placeholder ("Reply to Claude…")
 * through the clipboard capture, and improving that would be a no-op run
 * that mutates a field the user considers empty.
 */

export type ImproveAdapter = {
  id: string;
  /** One-paragraph <target> hint appended by `composeImprovePrompt`. */
  targetProfile: string;
  /** Captured text matching this is placeholder chrome, not a draft. */
  placeholderRe: RegExp;
  /** Dynamic Refine (hotkey condense-question flow) runs only on AI-app
   *  surfaces — reading a window's conversation region is scoped to tools
   *  that HAVE one. Generic apps get a refusal chip, never a capture. */
  supportsDynamicRefine: boolean;
};

/** Browsers that host the web chat surfaces. */
const BROWSERS = new Set([
  "chrome.exe",
  "msedge.exe",
  "firefox.exe",
  "brave.exe",
  "arc.exe",
  "opera.exe",
]);

/** Terminal hosts (mirrors `is_terminal_process` in clipboard.rs). */
const TERMINALS = new Set([
  "windowsterminal.exe",
  "wt.exe",
  "openconsole.exe",
  "conhost.exe",
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "alacritty.exe",
  "wezterm-gui.exe",
]);

/** Matches nothing — adapters whose surface has no known placeholder. */
const NO_PLACEHOLDER = /^\0$/;

const CLAUDE_WEB: ImproveAdapter = {
  id: "claude-web",
  targetProfile:
    "Claude.ai, a chat assistant. Strong prompts lead with the deliverable " +
    "and its audience, specify format, length, and tone, include the " +
    "necessary background inline, and ask for one thing per message.",
  placeholderRe: /^Reply to Claude(\.{3}|…)?$/,
  supportsDynamicRefine: true,
};

const CHATGPT_WEB: ImproveAdapter = {
  id: "chatgpt-web",
  targetProfile:
    "ChatGPT, a chat assistant. Strong prompts lead with the deliverable " +
    "and its audience, specify format, length, and tone, include the " +
    "necessary background inline, and ask for one thing per message.",
  placeholderRe: /^(Ask anything|Message ChatGPT(\.{3}|…)?)$/,
  supportsDynamicRefine: true,
};

const VSCODE_COPILOT: ImproveAdapter = {
  id: "vscode-copilot",
  targetProfile:
    "an inline IDE chat (VS Code Copilot Chat). Strong prompts are short " +
    "and code-anchored: reference the current selection, file, or symbols " +
    "by name, and specify language and framework versions when they matter.",
  placeholderRe: NO_PLACEHOLDER,
  supportsDynamicRefine: true,
};

const CURSOR: ImproveAdapter = {
  id: "cursor",
  targetProfile:
    "Cursor, an agentic coding IDE. Strong prompts state the goal, name " +
    "the relevant files or directories, give explicit constraints and " +
    "non-goals (what must not change), and define verifiable success " +
    "criteria such as passing tests or expected command output.",
  placeholderRe: NO_PLACEHOLDER,
  supportsDynamicRefine: true,
};

const CLAUDE_CODE_CLI: ImproveAdapter = {
  id: "claude-code-cli",
  targetProfile:
    "Claude Code, an agentic coding CLI. Strong prompts state the goal, " +
    "name the relevant files or directories, give explicit constraints and " +
    "non-goals (what must not change), and define verifiable success " +
    "criteria such as passing tests or expected command output; prefer " +
    "imperative, scoped tasks over open-ended ones.",
  placeholderRe: NO_PLACEHOLDER,
  supportsDynamicRefine: true,
};

const GENERIC: ImproveAdapter = {
  id: "generic",
  targetProfile:
    "an AI assistant. Where the draft lacks structure, apply a " +
    "role-task-constraints-output-format skeleton; do not add structure " +
    "the draft already has.",
  placeholderRe: NO_PLACEHOLDER,
  supportsDynamicRefine: false,
};

/**
 * Resolve the adapter for a captured window. Case-insensitive on the
 * process file name; title matching is substring/regex on the window title
 * (browser tabs put the page title there).
 */
export function resolveImproveAdapter(
  processName: string,
  windowTitle: string
): ImproveAdapter {
  const process = processName.trim().toLowerCase();
  const title = windowTitle.trim();

  if (BROWSERS.has(process)) {
    if (/claude/i.test(title)) return CLAUDE_WEB;
    if (/chatgpt/i.test(title)) return CHATGPT_WEB;
    return GENERIC;
  }
  if (process === "code.exe" || process === "code - insiders.exe") {
    return VSCODE_COPILOT;
  }
  if (process === "cursor.exe") return CURSOR;
  if (TERMINALS.has(process) && /claude/i.test(title)) return CLAUDE_CODE_CLI;
  return GENERIC;
}

/** `true` when the captured text is only the surface's placeholder hint —
 *  the field is effectively empty and must not be mutated (SPEC §4.4). */
export function isPlaceholderText(
  adapter: ImproveAdapter,
  text: string
): boolean {
  return adapter.placeholderRe.test(text.trim());
}
