/**
 * Blaze command engine — a parser + expander for the AI Blaze (blaze.today)
 * dynamic-prompt grammar (SPEC §3.2.4, §4.1). Sibling to the simpler
 * `{{placeholder}}` engine in `templates.ts`; both are pure and unit-testable
 * (no React / Tauri imports), so the fill-in UI can drive off the parse result.
 *
 * Supported command subset (case-sensitive `form…` keywords, brace-delimited,
 * `;`-separated args) — enough to cover the published prompt gallery:
 *   - {formtext: name=Label}                       single-line input
 *   - {formparagraph: name=content}                multi-line input
 *   - {formmenu: default=A; B; C; multiple=yes}    dropdown / multi-select
 *   - {formtoggle: name=X; default=yes}…{endformtoggle}  conditional span
 *   - {clipboard}                                  clipboard text (no field)
 * Legacy `{{selected_text}}` / `{{clipboard}}` are still honoured so existing
 * templates keep working. Unknown / malformed `{form…}` tokens are left intact
 * and reported via `unparsed` so nothing raw is sent silently.
 *
 * SECURITY: the scanner is a single left-to-right pass with no nested-quantifier
 * regex (ReDoS-safe) and never evaluates template text (no eval/new Function).
 */

export type BlazeFieldKind = "text" | "paragraph" | "menu" | "toggle";

/** One distinct fill-in field derived from the prompt body. */
export type BlazeField = {
  kind: BlazeFieldKind;
  /** Identity key; commands sharing a name map to one field. */
  name: string;
  /** Human label shown in the dialog. */
  label: string;
  /** Initial value (menus → selected option; toggles → "yes"/"no"). */
  default?: string;
  /** Menu choices, in author order. */
  options?: string[];
  /** Menu allows picking several values (joined with ", " on expand). */
  multiple?: boolean;
};

/** Internal command node produced by the tokenizer. */
type CommandNode =
  | { kind: "text"; name: string; label: string; default?: string }
  | { kind: "paragraph"; name: string; label: string; default?: string }
  | {
      kind: "menu";
      name: string;
      label: string;
      default?: string;
      options: string[];
      multiple: boolean;
    }
  | { kind: "toggle"; name: string; label: string; default?: string }
  | { kind: "endtoggle" }
  | { kind: "clipboard" }
  | { kind: "unknown"; raw: string };

type Node =
  | { type: "text"; value: string }
  | { type: "command"; cmd: CommandNode };

/** `{{selected_text}}` / `{{clipboard}}` — legacy, clipboard-sourced tokens. */
const LEGACY_CLIPBOARD_RE = /\{\{\s*(?:selected_text|clipboard)\s*\}\}/;
const LEGACY_CLIPBOARD_RE_G = /\{\{\s*(?:selected_text|clipboard)\s*\}\}/g;

/** Anchored keyword match — no backtracking. */
const FORM_RE = /^(formtext|formparagraph|formmenu|formtoggle)\b\s*:?\s*([\s\S]*)$/;

const FRIENDLY: Record<BlazeFieldKind, string> = {
  text: "Text",
  paragraph: "Paragraph",
  menu: "Choice",
  toggle: "Option",
};

/** Split `a; b; c` into trimmed, non-empty args. */
function splitArgs(s: string): string[] {
  return s
    .split(";")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/** Parse a `key=value` arg; returns null for bare tokens (e.g. menu options). */
function keyVal(arg: string): [string, string] | null {
  const m = /^([A-Za-z_][\w-]*)\s*=\s*([\s\S]*)$/.exec(arg);
  return m ? [m[1].toLowerCase(), m[2].trim()] : null;
}

/**
 * Parse the text *between* a `{ }` pair into a command, or return null when it
 * is not a recognized command (left as literal text by the tokenizer).
 */
function parseCommand(inner: string, counter: { n: number }): CommandNode | null {
  const trimmed = inner.trim();
  if (trimmed === "clipboard") return { kind: "clipboard" };
  if (trimmed === "endformtoggle") return { kind: "endtoggle" };

  const m = FORM_RE.exec(trimmed);
  if (!m) {
    // Looks like a form command but malformed → keep intact, flag it.
    if (/^form\w+/.test(trimmed)) return { kind: "unknown", raw: `{${inner}}` };
    return null; // not a command at all (e.g. `{foo}`, `{{x}}`)
  }

  const keyword = m[1];
  const args = splitArgs(m[2]);
  const gen = () => `__f${++counter.n}`;

  if (keyword === "formmenu") {
    const options: string[] = [];
    let name = "";
    let def: string | undefined;
    let multiple = false;
    for (const arg of args) {
      const kv = keyVal(arg);
      if (kv && kv[0] === "name") {
        name = kv[1];
      } else if (kv && kv[0] === "default") {
        options.push(kv[1]);
        if (def === undefined) def = kv[1];
      } else if (kv && kv[0] === "multiple") {
        const v = kv[1].toLowerCase();
        multiple = v === "yes" || v === "true";
      } else {
        // Bare token or unrecognized key=value → an option, in author order.
        options.push(arg);
      }
    }
    if (def === undefined) def = options[0];
    const generated = !name;
    if (!name) name = gen();
    return {
      kind: "menu",
      name,
      label: generated ? `${FRIENDLY.menu} ${counter.n}` : name,
      default: def,
      options,
      multiple,
    };
  }

  // formtext / formparagraph / formtoggle share name/default handling.
  let name = "";
  let def: string | undefined;
  for (const arg of args) {
    const kv = keyVal(arg);
    if (kv && kv[0] === "name") name = kv[1];
    else if (kv && kv[0] === "default") def = kv[1];
    else if (!kv && !name) name = arg; // tolerate a leading bare label
    // other keys (cols/rows/trim/…) are ignored
  }
  const kind: BlazeFieldKind =
    keyword === "formtext"
      ? "text"
      : keyword === "formparagraph"
        ? "paragraph"
        : "toggle";
  const generated = !name;
  if (!name) name = gen();
  return {
    kind,
    name,
    label: generated ? `${FRIENDLY[kind]} ${counter.n}` : name,
    default: def,
  };
}

/**
 * Single linear pass over `body`. Each `{` jumps to its next `}` and the pair
 * is consumed whole (recognized command → command node, otherwise skipped and
 * left as literal text), so no character is scanned twice — O(n), ReDoS-safe.
 */
function tokenize(body: string): Node[] {
  const nodes: Node[] = [];
  const counter = { n: 0 };
  const len = body.length;
  let i = 0;
  let textStart = 0;

  while (i < len) {
    if (body.charCodeAt(i) === 123 /* { */) {
      const close = body.indexOf("}", i + 1);
      if (close === -1) break; // no closing brace; remainder is literal text
      const cmd = parseCommand(body.slice(i + 1, close), counter);
      if (cmd) {
        if (textStart < i) nodes.push({ type: "text", value: body.slice(textStart, i) });
        nodes.push({ type: "command", cmd });
        textStart = close + 1;
      }
      // Recognized or not, skip past this brace pair (stays linear). When not a
      // command, textStart is untouched so the braces remain part of the text.
      i = close + 1;
    } else {
      i++;
    }
  }
  if (textStart < len) nodes.push({ type: "text", value: body.slice(textStart) });
  return nodes;
}

/**
 * Fields to fill for `body`, de-duplicated by name in first-seen order (mirrors
 * `extractPlaceholders`). Also reports whether clipboard is referenced and any
 * malformed `{form…}` tokens left intact.
 */
export function parseBlazeCommands(body: string): {
  fields: BlazeField[];
  hasClipboard: boolean;
  unparsed: string[];
} {
  const nodes = tokenize(body);
  const fields: BlazeField[] = [];
  const seen = new Set<string>();
  const unparsed: string[] = [];
  let hasClipboard = LEGACY_CLIPBOARD_RE.test(body);

  for (const node of nodes) {
    if (node.type !== "command") continue;
    const c = node.cmd;
    if (c.kind === "clipboard") {
      hasClipboard = true;
      continue;
    }
    if (c.kind === "endtoggle") continue;
    if (c.kind === "unknown") {
      unparsed.push(c.raw);
      continue;
    }
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    if (c.kind === "menu") {
      fields.push({
        kind: "menu",
        name: c.name,
        label: c.label,
        default: c.default,
        options: c.options,
        multiple: c.multiple,
      });
    } else {
      fields.push({ kind: c.kind, name: c.name, label: c.label, default: c.default });
    }
  }
  return { fields, hasClipboard, unparsed };
}

function isToggleOn(c: { name: string; default?: string }, values: Record<string, string>): boolean {
  const raw = Object.prototype.hasOwnProperty.call(values, c.name)
    ? values[c.name]
    : c.default ?? "no";
  const v = raw.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "on" || v === "1";
}

/** Replace legacy `{{selected_text}}` / `{{clipboard}}` inside literal text. */
function expandLegacy(text: string, clipboard: string): string {
  return text.replace(LEGACY_CLIPBOARD_RE_G, clipboard);
}

/**
 * Expand `body` into token-free text. `values` maps field name → chosen value
 * (multi-select values are pre-joined by the caller; toggles are "yes"/"no").
 * `formtoggle` spans whose toggle is off are dropped, including inner commands;
 * unparsed tokens and unknown `{…}` are preserved verbatim.
 */
export function expandBlaze(
  body: string,
  values: Record<string, string>,
  clipboard: string
): string {
  const nodes = tokenize(body);
  const out: string[] = [];
  const stack: boolean[] = []; // enclosing toggle states
  const emitting = () => stack.every(Boolean);

  for (const node of nodes) {
    if (node.type === "command") {
      const c = node.cmd;
      if (c.kind === "toggle") {
        // Still pushed while inside an off span so end tags stay balanced.
        stack.push(isToggleOn(c, values));
        continue;
      }
      if (c.kind === "endtoggle") {
        if (stack.length) stack.pop();
        continue;
      }
      if (!emitting()) continue;
      if (c.kind === "clipboard") {
        out.push(clipboard);
        continue;
      }
      if (c.kind === "unknown") {
        out.push(c.raw);
        continue;
      }
      // text | paragraph | menu
      const v = Object.prototype.hasOwnProperty.call(values, c.name)
        ? values[c.name]
        : c.default ?? "";
      out.push(v);
    } else {
      if (!emitting()) continue;
      out.push(expandLegacy(node.value, clipboard));
    }
  }
  return out.join("");
}
