/**
 * Insert text exactly at the user's caret in <input type="text">, <textarea>,
 * or [contenteditable] elements, replacing any highlighted text and leaving
 * the caret immediately after the inserted chunk.
 *
 * Survives the classic "Insert button steals focus" problem via a passive
 * caret tracker: the last known selection is snapshotted on every
 * `selectionchange` / `focusin`, so it can be restored even after the
 * editable element blurred.
 *
 * Uses only Selection/Range/setRangeText — no `document.execCommand`,
 * no innerHTML string mutation.
 */

type TextField = HTMLInputElement | HTMLTextAreaElement;

interface TextFieldSnapshot {
  kind: "textfield";
  element: TextField;
  start: number;
  end: number;
}

interface ContentEditableSnapshot {
  kind: "contenteditable";
  element: HTMLElement;
  range: Range; // cloned, so later selection changes can't mutate it
}

type CaretSnapshot = TextFieldSnapshot | ContentEditableSnapshot;

function isTextField(el: Element): el is TextField {
  if (el instanceof HTMLTextAreaElement) return true;
  // setRangeText/selectionStart only exist on textual input types.
  return (
    el instanceof HTMLInputElement &&
    /^(text|search|url|tel|password|email|number)?$/.test(el.type)
  );
}

function closestContentEditable(node: Node | null): HTMLElement | null {
  const el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  return el?.closest<HTMLElement>("[contenteditable]:not([contenteditable='false'])") ?? null;
}

let lastSnapshot: CaretSnapshot | null = null;
let trackerInstalled = false;

function snapshotCurrent(): void {
  const active = document.activeElement;

  if (active && isTextField(active)) {
    lastSnapshot = {
      kind: "textfield",
      element: active,
      start: active.selectionStart ?? active.value.length,
      end: active.selectionEnd ?? active.value.length,
    };
    return;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const host = closestContentEditable(range.startContainer);
  // Only remember selections that live inside an editable region; a selection
  // elsewhere (e.g. the button label) must not clobber a good snapshot.
  if (host && host.contains(range.endContainer)) {
    lastSnapshot = { kind: "contenteditable", element: host, range: range.cloneRange() };
  }
}

/** Install the passive caret tracker (idempotent, called lazily). */
function ensureTracker(): void {
  if (trackerInstalled || typeof document === "undefined") return;
  trackerInstalled = true;
  document.addEventListener("selectionchange", snapshotCurrent, { passive: true });
  document.addEventListener("focusin", snapshotCurrent, { passive: true });
}
ensureTracker();

/**
 * Attach to the Insert button's `mousedown`/`pointerdown` to stop it from
 * taking focus away from the editable element in the first place:
 *
 *   <button onMouseDown={preventFocusSteal} onClick={...}>Insert</button>
 */
export function preventFocusSteal(event: { preventDefault(): void }): void {
  event.preventDefault();
}

function dispatchInput(element: HTMLElement, text: string): void {
  // Bubbling InputEvent keeps framework-controlled state (React, Vue, ...)
  // in sync with the DOM mutation setRangeText/insertNode just made.
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  );
}

function insertIntoTextField(element: TextField, text: string): void {
  element.focus({ preventScroll: true });

  let start = element.selectionStart;
  let end = element.selectionEnd;

  // Blur can leave selection null in some engines; fall back to the tracker
  // snapshot if it belongs to this element, else append at the end.
  if (start === null || end === null) {
    if (lastSnapshot?.kind === "textfield" && lastSnapshot.element === element) {
      ({ start, end } = lastSnapshot);
    } else {
      start = end = element.value.length;
    }
  }

  const max = element.value.length;
  start = Math.min(start, max);
  end = Math.min(Math.max(end, start), max);

  // Replaces [start, end) with `text` and, thanks to "end", collapses the
  // caret to just after the inserted text.
  element.setRangeText(text, start, end, "end");
  dispatchInput(element, text);
}

function rangeForContentEditable(element: HTMLElement): Range {
  // 1. Live selection already inside the element (button used preventFocusSteal,
  //    or focus never left).
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const live = sel.getRangeAt(0);
    if (element.contains(live.startContainer) && element.contains(live.endContainer)) {
      return live;
    }
  }

  // 2. Tracker snapshot for this element, if its nodes are still attached.
  if (
    lastSnapshot?.kind === "contenteditable" &&
    lastSnapshot.element === element &&
    element.contains(lastSnapshot.range.startContainer) &&
    element.contains(lastSnapshot.range.endContainer)
  ) {
    return lastSnapshot.range.cloneRange();
  }

  // 3. Fallback: caret at the very end of the content.
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
}

function insertIntoContentEditable(element: HTMLElement, text: string): void {
  // Resolve the target range BEFORE focusing: focusing an editing host can
  // move the live selection (to the start of the content), which would
  // clobber the caret we're trying to insert at. Clone so that side effect
  // can't mutate the range we hold.
  const range = rangeForContentEditable(element).cloneRange();

  element.focus({ preventScroll: true });

  range.deleteContents(); // replaces highlighted text, no-op when collapsed
  const node = document.createTextNode(text);
  range.insertNode(node);

  // Collapse the caret to immediately after the inserted text.
  range.setStartAfter(node);
  range.collapse(true);

  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  // Future inserts should target this fresh caret even if focus is lost again.
  lastSnapshot = { kind: "contenteditable", element, range: range.cloneRange() };

  dispatchInput(element, text);
}

/**
 * Insert `text` at the caret of `element`, replacing any current selection.
 * Caret ends up right after the inserted text. Falls back to appending at the
 * end when no caret/selection can be determined.
 */
export function insertTextAtCursor(element: HTMLElement, text: string): void {
  ensureTracker();

  if (isTextField(element)) {
    insertIntoTextField(element, text);
    return;
  }

  if (element.isContentEditable || element.hasAttribute("contenteditable")) {
    insertIntoContentEditable(element, text);
    return;
  }

  throw new Error(
    "insertTextAtCursor: element is neither a text input, a textarea, nor contenteditable",
  );
}
