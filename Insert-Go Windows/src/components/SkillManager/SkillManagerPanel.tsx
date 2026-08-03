/**
 * Skill Manager panel — the dedicated "Skills" tab (App.tsx). A full-surface
 * hub for curating the skill bar: filter by category chip + search, toggle any
 * skill on/off, create custom skills via the 3-step wizard, and delete customs.
 *
 * All state lives in the settings store; this panel dispatches its actions,
 * which persist to settings.json (through Rust) and re-render the PromptPalette
 * skill bar reactively — toggling a card here updates the bar with no reload.
 * The existing SkillManagerModal (opened from the palette) is untouched.
 */
import { useMemo, useState } from "react";
import {
  CATEGORY_FILTERS,
  filterSkills,
  getAllSkills,
  type SkillFilter,
} from "@/services/skills";
import { useSettingsStore } from "@/store/settingsStore";
import { SkillCard } from "./SkillCard";
import { CreateSkillWizard } from "./CreateSkillWizard";

export function SkillManagerPanel() {
  const enabledSkillIds = useSettingsStore((s) => s.settings.enabledSkillIds);
  const customSkills = useSettingsStore((s) => s.settings.customSkills);
  const toggleSkillEnabled = useSettingsStore((s) => s.toggleSkillEnabled);
  const removeCustomSkill = useSettingsStore((s) => s.removeCustomSkill);

  const [filter, setFilter] = useState<SkillFilter>("all");
  const [query, setQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const allSkills = useMemo(() => getAllSkills(customSkills), [customSkills]);
  const enabledSet = useMemo(() => new Set(enabledSkillIds), [enabledSkillIds]);
  const shown = useMemo(
    () => filterSkills(allSkills, filter, query, enabledSet),
    [allSkills, filter, query, enabledSet]
  );

  return (
    <div className="ig-body ig-skillpanel">
      <div className="ig-skillpanel__intro">
        <h2 className="ig-skillpanel__title">Manage Skills</h2>
        <p className="ig-muted">Curate your skill bar and build your own.</p>
      </div>

      {/* Category chips + search. */}
      <div className="ig-skillpanel__filters">
        <div className="ig-chips" role="group" aria-label="Filter by category">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={
                "ig-chip ig-chip--btn" +
                (filter === c.id ? " ig-chip--active" : "")
              }
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ig-skillpanel__search">
          <i
            className="fa-solid fa-magnifying-glass ig-iconpicker__searchicon"
            aria-hidden="true"
          />
          <input
            className="ig-input"
            value={query}
            placeholder="Search skills…"
            aria-label="Search skills"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="ig-iconpicker__clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Grid: matching skills + a "create" card that opens the wizard. */}
      <div className="ig-skillpanel__grid" role="group" aria-label="Skills">
        {shown.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            enabled={enabledSet.has(skill.id)}
            onToggle={() => void toggleSkillEnabled(skill.id)}
            onDelete={
              skill.isCustom
                ? () => void removeCustomSkill(skill.id)
                : undefined
            }
          />
        ))}

        <button
          type="button"
          className="ig-glass-card ig-skillcard ig-skillcard--create"
          onClick={() => setWizardOpen(true)}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Create skill</span>
        </button>
      </div>

      {shown.length === 0 && (
        <div className="ig-skillpanel__empty ig-muted">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> No skills
          match this filter.
        </div>
      )}

      {wizardOpen && <CreateSkillWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
