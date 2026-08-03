import { describe, expect, it } from "vitest";
import {
  isPlaceholderText,
  resolveImproveAdapter,
} from "./improveAdapters";

describe("resolveImproveAdapter", () => {
  it("maps browser + Claude title to claude-web", () => {
    expect(
      resolveImproveAdapter("chrome.exe", "Claude - Google Chrome").id
    ).toBe("claude-web");
    expect(resolveImproveAdapter("MSEDGE.EXE", "Chat — Claude").id).toBe(
      "claude-web"
    );
  });

  it("maps browser + ChatGPT title to chatgpt-web", () => {
    expect(resolveImproveAdapter("firefox.exe", "ChatGPT").id).toBe(
      "chatgpt-web"
    );
  });

  it("maps a browser with an unrelated title to generic", () => {
    expect(resolveImproveAdapter("chrome.exe", "GitHub - repo").id).toBe(
      "generic"
    );
  });

  it("maps editors by process name", () => {
    expect(resolveImproveAdapter("Code.exe", "file.ts - VS Code").id).toBe(
      "vscode-copilot"
    );
    expect(resolveImproveAdapter("cursor.exe", "project").id).toBe("cursor");
  });

  it("maps a terminal with a claude title to claude-code-cli", () => {
    expect(
      resolveImproveAdapter("WindowsTerminal.exe", "claude — repo").id
    ).toBe("claude-code-cli");
    // A terminal without claude in the title stays generic.
    expect(resolveImproveAdapter("wt.exe", "PowerShell").id).toBe("generic");
  });

  it("falls back to generic for unknown processes", () => {
    expect(resolveImproveAdapter("notepad.exe", "Untitled").id).toBe(
      "generic"
    );
    expect(resolveImproveAdapter("", "").id).toBe("generic");
  });

  it("every adapter ships a non-empty target profile", () => {
    for (const [process, title] of [
      ["chrome.exe", "Claude"],
      ["chrome.exe", "ChatGPT"],
      ["code.exe", ""],
      ["cursor.exe", ""],
      ["wt.exe", "claude"],
      ["notepad.exe", ""],
    ]) {
      const adapter = resolveImproveAdapter(process, title);
      expect(adapter.targetProfile.length).toBeGreaterThan(20);
    }
  });
});

describe("supportsDynamicRefine (AI-apps-only gate)", () => {
  it("is true for every AI-app adapter", () => {
    for (const [process, title] of [
      ["chrome.exe", "Claude"],
      ["chrome.exe", "ChatGPT"],
      ["code.exe", "file.ts - VS Code"],
      ["cursor.exe", "project"],
      ["wt.exe", "claude — repo"],
    ]) {
      expect(resolveImproveAdapter(process, title).supportsDynamicRefine).toBe(
        true
      );
    }
  });

  it("is false for generic surfaces — unknown apps get a refusal", () => {
    expect(
      resolveImproveAdapter("notepad.exe", "Untitled").supportsDynamicRefine
    ).toBe(false);
    // A browser tab that is not a chat surface is generic too.
    expect(
      resolveImproveAdapter("chrome.exe", "GitHub - repo").supportsDynamicRefine
    ).toBe(false);
    // A terminal without claude in the title is generic.
    expect(
      resolveImproveAdapter("wt.exe", "PowerShell").supportsDynamicRefine
    ).toBe(false);
  });
});

describe("isPlaceholderText (SPEC §4.4 empty-field guard)", () => {
  const claude = resolveImproveAdapter("chrome.exe", "Claude");
  const chatgpt = resolveImproveAdapter("chrome.exe", "ChatGPT");
  const generic = resolveImproveAdapter("notepad.exe", "");

  it("flags the Claude.ai composer placeholder, ellipsis or dots", () => {
    expect(isPlaceholderText(claude, "Reply to Claude…")).toBe(true);
    expect(isPlaceholderText(claude, "Reply to Claude...")).toBe(true);
    expect(isPlaceholderText(claude, "  Reply to Claude  ")).toBe(true);
  });

  it("flags the ChatGPT placeholders", () => {
    expect(isPlaceholderText(chatgpt, "Ask anything")).toBe(true);
    expect(isPlaceholderText(chatgpt, "Message ChatGPT…")).toBe(true);
  });

  it("never flags a real draft that merely mentions the placeholder", () => {
    expect(
      isPlaceholderText(claude, "Reply to Claude about my auth bug")
    ).toBe(false);
    expect(isPlaceholderText(chatgpt, "Ask anything you want, model")).toBe(
      false
    );
  });

  it("generic adapter flags nothing (empty-only guard lives in Rust)", () => {
    expect(isPlaceholderText(generic, "Reply to Claude…")).toBe(false);
    expect(isPlaceholderText(generic, "anything")).toBe(false);
  });
});
