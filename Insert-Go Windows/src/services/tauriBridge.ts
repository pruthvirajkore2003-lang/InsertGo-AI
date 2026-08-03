/**
 * Single choke-point for calls into the Rust backend.
 * Keeps Tauri `invoke` command names in one place so the rest of the app
 * never depends on raw string command identifiers.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  AppContext,
  PermissionReport,
  Prompt,
  ProviderConfig,
  Settings,
} from "@/types";

/** Rust command identifiers — must match `#[tauri::command]` fn names. */
export const Commands = {
  getActiveContext: "get_active_context",
  insertText: "insert_text",
  loadPrompts: "load_prompts",
  savePrompt: "save_prompt",
  deletePrompt: "delete_prompt",
  loadSettings: "load_settings",
  saveSettings: "save_settings",
  loadProviders: "load_providers",
  saveProviders: "save_providers",
  sessionTokenSet: "session_token_set",
  sessionTokenGet: "session_token_get",
  sessionTokenDelete: "session_token_delete",
  ollamaListModels: "ollama_list_models",
  exportLogs: "export_logs",
  getHardwareId: "get_hardware_id",
  resizeWithinWorkArea: "resize_within_work_area",
  checkPermissions: "check_permissions",
  setAutostart: "set_autostart",
} as const;

/** Probe the OS capabilities the onboarding wizard primes (platform/
 *  permissions.rs). Content-free: no window text and no clipboard contents are
 *  read. Rejects outside the Tauri shell — callers surface that as "can't
 *  check here" rather than a fake grant. */
export function checkPermissions(): Promise<PermissionReport> {
  return invoke(Commands.checkPermissions);
}

/** Enable/disable the per-user autostart entry; resolves to the new state. */
export function setAutostart(enabled: boolean): Promise<boolean> {
  return invoke(Commands.setAutostart, { enabled });
}

export function getHardwareId(): Promise<string> {
  return invoke(Commands.getHardwareId);
}

export function getActiveContext(): Promise<AppContext> {
  return invoke(Commands.getActiveContext);
}

/** Optional synthetic insertion into the previously focused app (SPEC §4.1). */
export function insertText(text: string): Promise<void> {
  return invoke(Commands.insertText, { text });
}

/** Resize current window and atomically keep its outer rect inside rcWork. */
export function resizeWithinWorkArea(height: number): Promise<void> {
  return invoke(Commands.resizeWithinWorkArea, { height });
}

export function loadPrompts(): Promise<Prompt[]> {
  return invoke(Commands.loadPrompts);
}

export function savePrompt(prompt: Prompt): Promise<Prompt[]> {
  return invoke(Commands.savePrompt, { prompt });
}

export function deletePrompt(id: string): Promise<Prompt[]> {
  return invoke(Commands.deletePrompt, { id });
}

export function loadSettings(): Promise<Settings> {
  return invoke(Commands.loadSettings);
}

export function saveSettings(settings: Settings): Promise<Settings> {
  return invoke(Commands.saveSettings, { settings });
}

export function loadProviders(): Promise<ProviderConfig[]> {
  return invoke(Commands.loadProviders);
}

export function saveProviders(
  providers: ProviderConfig[]
): Promise<ProviderConfig[]> {
  return invoke(Commands.saveProviders, { providers });
}

/** Copy the log file to Downloads; resolves to the destination path. */
export function exportLogs(): Promise<string> {
  return invoke(Commands.exportLogs);
}

// --- Managed session token (SECURITY.md "Secrets at rest") ------------------
// The token lives in the OS credential store (Rust `keyring`). These are the
// packaged app's path only: `authStore` guards every call with `isTauri()` and
// keeps its own session-scoped fallback for plain browser dev.

/** Store the InsertGo session token in the OS credential store. */
export function sessionTokenSet(value: string): Promise<void> {
  return invoke(Commands.sessionTokenSet, { value });
}

/** Read the stored session token (`null` when signed out). */
export function sessionTokenGet(): Promise<string | null> {
  return invoke(Commands.sessionTokenGet);
}

/** Remove the stored session token (idempotent). */
export function sessionTokenDelete(): Promise<void> {
  return invoke(Commands.sessionTokenDelete);
}

/** Models of a locally running Ollama instance; [] when it isn't running. */
export function ollamaListModels(baseUrl?: string): Promise<string[]> {
  return invoke(Commands.ollamaListModels, { baseUrl: baseUrl || null });
}

/** True when running inside the Tauri shell (vs. plain browser dev). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
