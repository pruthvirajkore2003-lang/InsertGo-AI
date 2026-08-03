// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { insertTextAtCursor, preventFocusSteal } from "./insertTextAtCursor";

describe("insertTextAtCursor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
  });

  describe("textarea / input", () => {
    it("inserts at the caret and places the caret after the inserted text", () => {
      const ta = document.createElement("textarea");
      ta.value = "hello world";
      document.body.appendChild(ta);
      ta.focus();
      ta.setSelectionRange(5, 5);

      insertTextAtCursor(ta, ",");

      expect(ta.value).toBe("hello, world");
      expect(ta.selectionStart).toBe(6);
      expect(ta.selectionEnd).toBe(6);
    });

    it("replaces highlighted text", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = "hello world";
      document.body.appendChild(input);
      input.focus();
      input.setSelectionRange(6, 11); // "world"

      insertTextAtCursor(input, "there");

      expect(input.value).toBe("hello there");
      expect(input.selectionStart).toBe(11);
      expect(input.selectionEnd).toBe(11);
    });

    it("keeps the caret position after focus moves to a button", () => {
      const ta = document.createElement("textarea");
      ta.value = "abdef";
      const button = document.createElement("button");
      document.body.append(ta, button);

      ta.focus();
      ta.setSelectionRange(2, 2);
      button.focus(); // Insert button steals focus

      insertTextAtCursor(ta, "c");

      expect(ta.value).toBe("abcdef");
      expect(ta.selectionStart).toBe(3);
      expect(document.activeElement).toBe(ta);
    });

    it("dispatches a bubbling input event", () => {
      const ta = document.createElement("textarea");
      document.body.appendChild(ta);
      const onInput = vi.fn();
      document.body.addEventListener("input", onInput);

      insertTextAtCursor(ta, "x");

      expect(onInput).toHaveBeenCalledTimes(1);
    });
  });

  describe("contenteditable", () => {
    function makeEditable(html: string): HTMLElement {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      div.innerHTML = html;
      document.body.appendChild(div);
      return div;
    }

    function setCaret(node: Node, offset: number, endNode?: Node, endOffset?: number) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(endNode ?? node, endOffset ?? offset);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }

    it("inserts at the caret and collapses the selection after the text", () => {
      const div = makeEditable("hello world");
      setCaret(div.firstChild!, 5);

      insertTextAtCursor(div, ",");

      expect(div.textContent).toBe("hello, world");
      const range = window.getSelection()!.getRangeAt(0);
      expect(range.collapsed).toBe(true);
      // typing one more char lands right after the comma
      insertTextAtCursor(div, "!");
      expect(div.textContent).toBe("hello,! world");
    });

    it("replaces highlighted text", () => {
      const div = makeEditable("hello world");
      setCaret(div.firstChild!, 6, div.firstChild!, 11);

      insertTextAtCursor(div, "there");

      expect(div.textContent).toBe("hello there");
    });

    it("restores the selection from the tracker after blur", () => {
      const div = makeEditable("ab");
      const button = document.createElement("button");
      document.body.appendChild(button);

      setCaret(div.firstChild!, 1);
      // Snapshot happens on selectionchange; jsdom doesn't always fire it,
      // so simulate what the tracker listens for.
      document.dispatchEvent(new Event("selectionchange"));
      window.getSelection()!.removeAllRanges(); // blur nukes the selection
      button.focus();

      insertTextAtCursor(div, "X");

      expect(div.textContent).toBe("aXb");
    });

    it("appends at the end when there is no selection at all", () => {
      const div = makeEditable("abc");

      insertTextAtCursor(div, "!");

      expect(div.textContent).toBe("abc!");
    });
  });

  it("throws on non-editable elements", () => {
    const span = document.createElement("span");
    document.body.appendChild(span);
    expect(() => insertTextAtCursor(span, "x")).toThrow(/neither/);
  });

  it("preventFocusSteal calls preventDefault", () => {
    const preventDefault = vi.fn();
    preventFocusSteal({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });
});
