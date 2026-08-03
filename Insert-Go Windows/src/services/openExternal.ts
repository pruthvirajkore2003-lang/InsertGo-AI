/**
 * Open an external URL in the system browser. Uses Tauri's opener plugin inside
 * the app shell (subject to the `opener:allow-open-url` scope in
 * capabilities/default.json) and `window.open` during plain browser dev.
 * Used for the "Get your API key" provider links on the Provider Keys page.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./tauriBridge";

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
