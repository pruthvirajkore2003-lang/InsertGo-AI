/**
 * Settings: theme, hotkeys, Inline Improve overrides, Provider Keys
 * (SPEC §5.2, §5.4, §5.6.3). Account lives in the Profile tab (§16.1).
 * Options are grouped into internal tabs; inactive panels unmount
 * (conditional render) so TabPanel's framer-motion enter animation runs.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { ThemePreference } from "@/types";
import { useSettingsStore } from "@/store/settingsStore";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Tabs, TabPanel, type TabDef } from "@/components/ui/Tabs";
import { PermissionsPanel } from "@/components/Permissions/PermissionsPanel";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "system" },
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
  { value: "high-contrast", label: "high contrast" },
];
const SCOPE_OPTIONS = [
  { value: "allowlist", label: "Allowlisted apps only (recommended)" },
  { value: "all", label: "Every app (except the blocklist)" },
];

const SETTINGS_TABS: TabDef[] = [
  { id: "theme", label: "Theme", icon: "fa-palette" },
  { id: "hotkeys", label: "Hotkeys", icon: "fa-keyboard" },
  { id: "improve", label: "Inline Improve", icon: "fa-wand-magic-sparkles" },
  { id: "selection", label: "Selection Bar", icon: "fa-highlighter" },
  // Was a mandatory onboarding step; lives here because "why isn't Improve
  // doing anything in this app" is a question asked on day 30, not day 0.
  { id: "access", label: "Access", icon: "fa-universal-access" },
];

/**
 * A chord is typed one character at a time, so persisting on every keystroke
 * writes half-finished chords: typing "Ctrl+Shift+Tab" stores "Ctrl+Shift"
 * along the way, and that's what registration reads at the next launch
 * ("invalid hotkey: Ctrl+Shift"). Edit locally, persist on blur or Enter —
 * the same pattern the app-list textareas below use.
 */
function HotkeyField({
  id,
  label,
  hint,
  placeholder,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  hint: ReactNode;
  placeholder: string;
  value: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync when the store settles (load, or a rejected save rolling back).
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="ig-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ig-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder={placeholder}
      />
      <span className="ig-muted">{hint}</span>
    </div>
  );
}

/** Split an app-list textarea into trimmed, non-empty executable entries. */
function parseAppList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SettingsPanel() {
  const { settings, error, load, update } = useSettingsStore();

  const [activeTab, setActiveTab] = useState("theme");

  // Edit app lists as raw text so typing a new line isn't eaten by the parse;
  // parsed and persisted on blur. Re-synced whenever settings change.
  // Lives at panel level (not inside the Selection Bar tab) so tab switches
  // can unmount the textareas without dropping text or the sync effects.
  const [allowlistText, setAllowlistText] = useState("");
  const [blocklistText, setBlocklistText] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAllowlistText(settings.selectionBarApps.join("\n"));
  }, [settings.selectionBarApps]);

  useEffect(() => {
    setBlocklistText(settings.selectionBarBlocklist.join("\n"));
  }, [settings.selectionBarBlocklist]);

  return (
    <div className="ig-body">
      {error && <div className="ig-error">{error}</div>}

      <div className="ig-subtabs">
        <Tabs
          tabs={SETTINGS_TABS}
          value={activeTab}
          onChange={setActiveTab}
          aria-label="Settings sections"
          idBase="settings"
        />
      </div>

      {activeTab === "theme" && (
        <TabPanel id="theme" idBase="settings">
          <div className="ig-field">
            <label htmlFor="theme">Theme</label>
            <SearchableSelect
              id="theme"
              searchable={false}
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(v) => void update({ theme: v as ThemePreference })}
            />
          </div>
        </TabPanel>
      )}

      {activeTab === "hotkeys" && (
        <TabPanel id="hotkeys" idBase="settings">
          <HotkeyField
            id="hotkey"
            label="Global hotkey"
            value={settings.hotkey}
            onCommit={(v) => void update({ hotkey: v })}
            placeholder="Ctrl+`"
            hint="Takes effect after restart in v1. Format: Ctrl+` (the backquote/~ key under Esc). Ctrl+Tab and Ctrl+Shift+Tab are reserved by Windows and can't be used."
          />

          <HotkeyField
            id="improveHotkey"
            label="Improve hotkey"
            value={settings.improveHotkey}
            onCommit={(v) => void update({ improveHotkey: v })}
            placeholder="Ctrl+Alt+Enter"
            hint="Rewrites the focused field in place. Takes effect after restart."
          />

          <HotkeyField
            id="improveUndoHotkey"
            label="Improve undo hotkey"
            value={settings.improveUndoHotkey}
            onCommit={(v) => void update({ improveUndoHotkey: v })}
            placeholder="Ctrl+Alt+Z"
            hint="Restores the pre-improve text. Takes effect after restart."
          />
        </TabPanel>
      )}

      {activeTab === "improve" && (
        <TabPanel id="improve" idBase="settings">
          <div className="ig-field">
            <label htmlFor="improveModel">Improve model override</label>
            <input
              id="improveModel"
              className="ig-input"
              value={settings.improveModel}
              onChange={(e) => void update({ improveModel: e.target.value })}
              placeholder="(lane's fastest model)"
            />
            <span className="ig-muted">
              Leave blank to use the active lane's fastest model.
            </span>
          </div>
        </TabPanel>
      )}

      {activeTab === "selection" && (
        <TabPanel id="selection" idBase="settings">
          <div className="ig-field">
            <label htmlFor="selectionBarScope">Read scope</label>
            <SearchableSelect
              id="selectionBarScope"
              searchable={false}
              options={SCOPE_OPTIONS}
              value={settings.selectionBarScope}
              onChange={(v) =>
                void update({ selectionBarScope: v as "allowlist" | "all" })
              }
            />
            <span className="ig-muted">
              {settings.selectionBarScope === "all"
                ? "The bar may read selected text in any app except InsertGo and the blocklist below. Broadest coverage — enable only if you trust every app you run."
                : "Privacy default: the bar reads selected text only in apps you allowlist. Nothing else is ever read."}
            </span>
          </div>

          {settings.selectionBarScope === "allowlist" && (
            <div className="ig-field">
              <label htmlFor="selectionBarApps">Allowed apps</label>
              <textarea
                id="selectionBarApps"
                className="ig-input"
                rows={4}
                value={allowlistText}
                onChange={(e) => setAllowlistText(e.target.value)}
                onBlur={() =>
                  void update({
                    selectionBarApps: parseAppList(allowlistText),
                  })
                }
                placeholder={"chrome.exe\ncode.exe"}
              />
              <span className="ig-muted">
                One executable per line. Selected text is read only from apps
                listed here.
              </span>
            </div>
          )}

          {settings.selectionBarScope === "all" && (
            <div className="ig-field">
              <label htmlFor="selectionBarBlocklist">
                Never read (blocklist)
              </label>
              <textarea
                id="selectionBarBlocklist"
                className="ig-input"
                rows={4}
                value={blocklistText}
                onChange={(e) => setBlocklistText(e.target.value)}
                onBlur={() =>
                  void update({
                    selectionBarBlocklist: parseAppList(blocklistText),
                  })
                }
                placeholder={"1password.exe\nkeepass*.exe"}
              />
              <span className="ig-muted">
                One executable per line. Password managers and credential UIs
                are seeded here and never read, even in “Every app” mode. A
                single “*” wildcard matches a family (e.g. keepass*.exe).
              </span>
            </div>
          )}
        </TabPanel>
      )}

      {activeTab === "access" && (
        <TabPanel id="access" idBase="settings">
          <PermissionsPanel />
        </TabPanel>
      )}

      <div className="ig-field">
        <span className="ig-muted" style={{ fontSize: 12 }}>
          Active provider: <strong>InsertGo Proxy (hosted)</strong>. Requests
          run through your InsertGo account.
        </span>
      </div>
    </div>
  );
}
