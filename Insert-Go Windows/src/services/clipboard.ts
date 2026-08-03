/**
 * Clipboard helper. Uses Tauri's clipboard plugin inside the app shell and
 * falls back to the Web Clipboard API during plain browser dev.
 */
import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "./tauriBridge";

export async function copyToClipboard(text: string): Promise<void> {
  if (isTauri()) {
    await tauriWriteText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

/** Read clipboard text. Used to fill `{{selected_text}}` from a prior copy. */
export async function readClipboard(): Promise<string> {
  try {
    if (isTauri()) return await tauriReadText();
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
