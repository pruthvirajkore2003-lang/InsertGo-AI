/**
 * Skill-set presets bar (Skill Manager panel). Saves the current skill bar as a
 * named combination and re-applies it in one click. All state lives in the
 * settings store (persisted through Rust), so applying a preset re-renders the
 * PromptPalette skill bar reactively, same as toggling a single skill.
 *
 * "Save current" snapshots `enabledSkillIds`; the store's `addSkillSetPreset`
 * re-validates (non-empty name, ≥1 skill, unique name) and surfaces the reason
 * as a toast, so this component only drives the inline name field.
 */
import { useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";

export function SkillSetPresets() {
  const presets = useSettingsStore((s) => s.settings.skillSetPresets);
  const enabledCount = useSettingsStore(
    (s) => s.settings.enabledSkillIds.length
  );
  const addPreset = useSettingsStore((s) => s.addSkillSetPreset);
  const applyPreset = useSettingsStore((s) => s.applySkillSetPreset);
  const removePreset = useSettingsStore((s) => s.removeSkillSetPreset);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await addPreset(name);
    if (ok) {
      setName("");
      setSaving(false);
    }
  };

  return (
    <div className="ig-presets">
      <span className="ig-presets__label">Skill set presets</span>
      <div className="ig-presets__row" role="group" aria-label="Skill set presets">
        {presets.length === 0 && !saving && (
          <span className="ig-muted ig-presets__empty">No saved sets yet.</span>
        )}

        {presets.map((p) => (
          <span key={p.id} className="ig-preset">
            <button
              type="button"
              className="ig-preset__apply"
              onClick={() => void applyPreset(p.id)}
              title={`Apply "${p.name}" (${p.skillIds.length} skills)`}
            >
              <i className="fa-solid fa-layer-group" aria-hidden="true" />
              {p.name}
            </button>
            <button
              type="button"
              className="ig-preset__del"
              onClick={() => void removePreset(p.id)}
              title={`Delete preset "${p.name}"`}
              aria-label={`Delete preset "${p.name}"`}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </span>
        ))}

        {saving ? (
          <form className="ig-presets__save" onSubmit={submit}>
            <input
              className="ig-input"
              autoFocus
              value={name}
              placeholder="Preset name"
              aria-label="Preset name"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="ig-btn ig-btn--primary">
              Save
            </button>
            <button
              type="button"
              className="ig-btn"
              onClick={() => {
                setSaving(false);
                setName("");
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="ig-btn ig-preset__add"
            onClick={() => setSaving(true)}
            disabled={enabledCount === 0}
            title={
              enabledCount === 0
                ? "Turn on at least one skill first"
                : "Save the current skills as a preset"
            }
          >
            <i className="fa-solid fa-bookmark" aria-hidden="true" />
            Save current
          </button>
        )}
      </div>
    </div>
  );
}
