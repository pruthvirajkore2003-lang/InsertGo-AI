/**
 * User settings (theme, hotkey, default provider) and provider configs.
 * Backend persists both; this store mirrors them and applies the theme to the
 * document so the palette restyles immediately.
 */
import { create } from "zustand";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { DEFAULT_SETTINGS, type ProviderConfig, type Settings } from "@/types";
import * as bridge from "@/services/tauriBridge";
import {
  BUILTIN_SKILL_IDS,
  addCustomSkill as addCustomSkillPure,
  addPreset as addPresetPure,
  removeCustomSkill as removeCustomSkillPure,
  removePreset as removePresetPure,
  toggleSkill,
  type CustomSkillDraft,
} from "@/services/skills";
import { toast } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import {
  defaultProviderId as computeDefaultId,
  removeProvider as removeFromList,
  setDefaultProvider as setDefaultInList,
  upsertProvider,
} from "@/services/providerUtils";

// WebView2 defaults to the Auto color scheme, so this media query tracks the
// Windows appearance setting and fires `change` live when it flips.
const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
let currentTheme: Settings["theme"] = "system";

function setThemeAttr(theme: Settings["theme"]) {
  currentTheme = theme;
  const resolved =
    theme === "system" ? (systemTheme.matches ? "light" : "dark") : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

// Every window (main, skillbar, selfloater, floating-icon) is a separate
// webview with its own document: setting the attribute locally restyles only
// the window that changed the setting. Broadcast so parked windows restyle
// live too; the emitter already set its own attribute, so the listener
// re-applying it is idempotent (no re-emit — no loop).
function applyTheme(theme: Settings["theme"]) {
  setThemeAttr(theme);
  if (isTauri()) void emit("theme:apply", theme).catch(() => {});
}

if (isTauri()) {
  void listen<Settings["theme"]>("theme:apply", (e) => setThemeAttr(e.payload));
}

systemTheme.addEventListener("change", () => {
  if (currentTheme === "system") applyTheme("system");
});

/** Wire the backend's window-material report (window.rs apply_glass /
 *  selection_floater.rs apply_floater_glass): "acrylic" when the DWM backdrop
 *  is live, "flat" when effects were cleared (transparency off / pre-22H2).
 *  CSS raises --ig-bg to near-opaque under [data-glass="flat"] so the window
 *  reads as smoked glass over the bare desktop, never a gray rect. Emitted
 *  per-window (emit_to) and re-emitted on every show/focus, so a missed
 *  early event self-heals. Call once from each glassed window's entry. */
export function listenGlassMode() {
  if (!isTauri()) return;
  void listen<string>("glass:mode", (e) => {
    document.documentElement.dataset.glass = e.payload;
  });
}

/** One-shot theme init for windows that never load the full settings store
 *  (floating-icon bubble): fetch persisted settings, apply theme locally. */
export async function syncThemeFromBackend() {
  try {
    const s = await bridge.loadSettings();
    setThemeAttr(s.theme);
  } catch {
    setThemeAttr(DEFAULT_SETTINGS.theme);
  }
}

type SettingsState = {
  settings: Settings;
  providers: ProviderConfig[];
  /** Session-only override of which provider the composer sends to. */
  selectedProviderId: string | null;
  isLoading: boolean;
  /** True once `load()` has settled (persisted values or the defaults
   *  fallback). Gates anything that must not act on the *pre-load* defaults,
   *  which would otherwise flash for one frame on every launch. */
  hasLoaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;

  // Provider management (SPEC §13.3.2).
  upsertProvider: (provider: ProviderConfig) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  setSelectedProvider: (id: string | null) => void;

  // Skill management (custom skills + skill-bar visibility). Each persists the
  // full settings via `update()`, so the change round-trips to settings.json
  // and every subscribed SkillButtons re-renders immediately.
  addCustomSkill: (draft: CustomSkillDraft) => Promise<boolean>;
  removeCustomSkill: (id: string) => Promise<void>;
  toggleSkillEnabled: (id: string) => Promise<void>;
  resetSkillsToDefault: () => Promise<void>;

  // Skill-set presets: save the current bar as a named combination, re-apply
  // it, or delete it. Each persists via `update()` like the skill actions.
  addSkillSetPreset: (name: string) => Promise<boolean>;
  applySkillSetPreset: (id: string) => Promise<void>;
  removeSkillSetPreset: (id: string) => Promise<void>;

  defaultProvider: () => ProviderConfig | null;
  /** Provider the composer should use: explicit selection, else default. */
  activeProvider: () => ProviderConfig | null;
};

type PendingSettingsUpdate = {
  patch: Partial<Settings>;
  resolve: () => void;
};

const settingsWriteQueue: PendingSettingsUpdate[] = [];
let settingsWriteActive = false;
let persistedSettings: Settings | null = null;

/**
 * Keep optimistic UI, but persist one mutation at a time. Each save starts
 * from last confirmed backend state; removing a failed mutation therefore
 * preserves later queued fields instead of restoring an old full snapshot.
 */
function enqueueSettingsUpdate(
  set: (partial: Partial<SettingsState>) => void,
  get: () => SettingsState,
  patch: Partial<Settings>
): Promise<void> {
  if (!settingsWriteActive && settingsWriteQueue.length === 0) {
    persistedSettings = get().settings;
  }

  const optimistic = { ...get().settings, ...patch };
  applyTheme(optimistic.theme);
  set({ settings: optimistic });

  return new Promise((resolve) => {
    settingsWriteQueue.push({ patch, resolve });
    void flushSettingsUpdates(set, get);
  });
}

async function flushSettingsUpdates(
  set: (partial: Partial<SettingsState>) => void,
  get: () => SettingsState
): Promise<void> {
  if (settingsWriteActive) return;
  settingsWriteActive = true;

  while (settingsWriteQueue.length > 0) {
    const mutation = settingsWriteQueue[0];
    const base = persistedSettings ?? get().settings;
    let error: unknown = null;

    try {
      persistedSettings = await bridge.saveSettings({
        ...base,
        ...mutation.patch,
      });
    } catch (cause) {
      error = cause;
    }

    settingsWriteQueue.shift();
    const visible = settingsWriteQueue.reduce(
      (settings, pending) => ({ ...settings, ...pending.patch }),
      persistedSettings ?? base
    );
    applyTheme(visible.theme);
    set({
      settings: visible,
      error: error === null ? null : String(error),
    });

    if (error !== null) {
      toast.error(`Couldn't save settings: ${error}`);
    }
    mutation.resolve();
  }

  persistedSettings = null;
  settingsWriteActive = false;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  providers: [],
  selectedProviderId: null,
  isLoading: false,
  hasLoaded: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const [settings, providers] = await Promise.all([
        bridge.loadSettings(),
        bridge.loadProviders(),
      ]);
      applyTheme(settings.theme);
      set({ settings, providers, isLoading: false, hasLoaded: true });
    } catch (e) {
      // Fall back to defaults so the UI still renders during dev / first run.
      applyTheme(DEFAULT_SETTINGS.theme);
      set({ error: String(e), isLoading: false, hasLoaded: true });
    }
  },

  update: (patch) => enqueueSettingsUpdate(set, get, patch),

  upsertProvider: async (provider) => {
    const next = upsertProvider(get().providers, provider);
    await persistProviders(set, get, next);
    toast.success("Provider saved");
  },

  removeProvider: async (id) => {
    const next = removeFromList(get().providers, id);
    const wasSelected = get().selectedProviderId === id;
    await persistProviders(set, get, next);
    if (wasSelected) set({ selectedProviderId: null });
  },

  setDefaultProvider: async (id) => {
    const next = setDefaultInList(get().providers, id);
    await persistProviders(set, get, next);
  },

  setSelectedProvider: (id) => set({ selectedProviderId: id }),

  addCustomSkill: async (draft) => {
    const { customSkills, enabledSkillIds } = get().settings;
    try {
      const next = addCustomSkillPure(customSkills, enabledSkillIds, draft);
      await get().update({
        customSkills: next.customSkills,
        enabledSkillIds: next.enabledSkillIds,
      });
      toast.success(`Added "${next.skill.label}"`);
      return true;
    } catch (e) {
      // Invalid draft (empty/duplicate) — the modal pre-validates, so this is
      // the belt-and-suspenders path; surface the reason and don't persist.
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    }
  },

  removeCustomSkill: async (id) => {
    const { customSkills, enabledSkillIds } = get().settings;
    const next = removeCustomSkillPure(customSkills, enabledSkillIds, id);
    await get().update({
      customSkills: next.customSkills,
      enabledSkillIds: next.enabledSkillIds,
    });
  },

  toggleSkillEnabled: async (id) => {
    const { enabledSkillIds } = get().settings;
    await get().update({ enabledSkillIds: toggleSkill(enabledSkillIds, id) });
  },

  resetSkillsToDefault: async () => {
    await get().update({
      enabledSkillIds: [...BUILTIN_SKILL_IDS],
      customSkills: [],
    });
  },

  addSkillSetPreset: async (name) => {
    const { enabledSkillIds, skillSetPresets } = get().settings;
    try {
      const next = addPresetPure(skillSetPresets, name, enabledSkillIds);
      await get().update({ skillSetPresets: next.presets });
      toast.success(`Saved preset "${next.preset.name}"`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    }
  },

  applySkillSetPreset: async (id) => {
    const preset = get().settings.skillSetPresets.find((p) => p.id === id);
    if (!preset) return;
    await get().update({ enabledSkillIds: [...preset.skillIds] });
    toast.success(`Applied "${preset.name}"`);
  },

  removeSkillSetPreset: async (id) => {
    const { skillSetPresets } = get().settings;
    await get().update({ skillSetPresets: removePresetPure(skillSetPresets, id) });
  },

  defaultProvider: () => {
    const { providers, settings } = get();
    return (
      providers.find((p) => p.id === settings.defaultProviderId) ??
      providers.find((p) => p.isDefault) ??
      providers[0] ??
      null
    );
  },

  activeProvider: () => {
    // A user-configured provider (SPEC §13.3.2) is used as-is; falling back to
    // the backend proxy needs an InsertGo session.
    const auth = useAuthStore.getState();
    const { providers, selectedProviderId } = get();
    const existing =
      providers.find((p) => p.id === selectedProviderId) ??
      get().defaultProvider();
    if (existing) return existing;

    if (!auth.token) return null;
    return {
      id: "backend",
      name: "Backend Proxy",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "dummy",
      isDefault: true,
    };
  },
}));

/**
 * Record that Improve has worked at least once on this install — the app's
 * activation signal, written by `services/inlineImprove` when the hotkey
 * produces improved text. Idempotent and fire-and-forget: a failed write only
 * costs the signal, never the run.
 */
export async function markFirstImproveDone(): Promise<void> {
  const store = useSettingsStore.getState();
  if (store.settings.firstImproveDone) return;
  await store.update({ firstImproveDone: true });
}

/**
 * Persist a new provider list and keep `settings.defaultProviderId` in sync
 * with whichever provider is now marked default.
 */
async function persistProviders(
  set: (partial: Partial<SettingsState>) => void,
  get: () => SettingsState,
  next: ProviderConfig[]
) {
  set({ providers: next });
  try {
    const saved = await bridge.saveProviders(next);
    set({ providers: saved, error: null });

    const newDefaultId = computeDefaultId(saved);
    if (newDefaultId !== get().settings.defaultProviderId) {
      await get().update({ defaultProviderId: newDefaultId });
    }
  } catch (e) {
    set({ error: String(e) });
    toast.error(`Couldn't save providers: ${e}`);
  }
}
