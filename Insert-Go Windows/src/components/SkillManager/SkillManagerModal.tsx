/**
 * Skill Manager (SPEC — customizable skills). A modal over the palette that
 * lets the user curate their skill bar:
 *   • toggle any skill (built-in or custom) on/off the bar,
 *   • create custom skills (title, icon, description, prompt template),
 *   • delete custom skills.
 *
 * All state lives in the settings store; this component only dispatches its
 * actions, which persist to settings.json and re-render the bar reactively.
 * Validation reuses the pure `validateCustomSkill` from the skill engine, so
 * the inline error shown here is the same rule the store enforces on save.
 *
 * SECURITY: the template is stored and later composed through
 * `composeSkillPrompt` (which escapes user content into the <content> data
 * boundary — OWASP LLM01). The icon string is constrained to a `fa-*` glyph
 * token before it ever reaches `className`, so it can't inject a class.
 */
import { useMemo, useState } from "react";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import {
  getAllSkills,
  resolveSkillIcon,
  validateCustomSkill,
  type CustomSkillDraft,
} from "@/services/skills";
import { useSettingsStore } from "@/store/settingsStore";
import { IconPickerModal } from "./IconPickerModal";

type Props = { onClose: () => void };

const EMPTY_DRAFT: CustomSkillDraft = {
  label: "",
  icon: "",
  description: "",
  template: "",
};

export function SkillManagerModal({ onClose }: Props) {
  const enabledSkillIds = useSettingsStore((s) => s.settings.enabledSkillIds);
  const customSkills = useSettingsStore((s) => s.settings.customSkills);
  const addCustomSkill = useSettingsStore((s) => s.addCustomSkill);
  const removeCustomSkill = useSettingsStore((s) => s.removeCustomSkill);
  const toggleSkillEnabled = useSettingsStore((s) => s.toggleSkillEnabled);

  const [draft, setDraft] = useState<CustomSkillDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const allSkills = useMemo(() => getAllSkills(customSkills), [customSkills]);
  const enabledSet = useMemo(() => new Set(enabledSkillIds), [enabledSkillIds]);

  // Single Esc handler for both layers: the icon picker (top) closes first,
  // the manager only once the picker is shut. Avoids two window-capture
  // listeners racing (stopPropagation can't stop a sibling on the same target).
  useAppShortcuts({
    onClose: () => {
      if (iconPickerOpen) {
        setIconPickerOpen(false);
        return;
      }
      onClose();
    },
  });

  const patch = (p: Partial<CustomSkillDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    if (error) setError(null);
  };

  const submitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pre-validate for an inline message; the store re-validates on persist.
    const res = validateCustomSkill(draft, allSkills);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const ok = await addCustomSkill(draft);
    if (ok) setDraft(EMPTY_DRAFT);
  };

  const previewIcon = resolveSkillIcon({
    id: "preview",
    label: "",
    template: "",
    isCustom: true,
    icon: draft.icon,
  });

  return (
    <>
    <div className="ig-modal" onClick={onClose}>
      <div
        className="ig-modal__card ig-skillmgr"
        role="dialog"
        aria-modal="true"
        aria-label="Manage skills"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ig-modal__title">Manage Skills</div>
        <p className="ig-muted">
          Toggle which skills show on your skill bar, or create your own.
        </p>

        {/* Scrollable body — the title/intro above and the footer below stay
            pinned; only this region scrolls on a short viewport. */}
        <div className="ig-skillmgr__body">
        {/* Available skills — toggle visibility; delete customs. */}
        <div className="ig-skillmgr__list" role="group" aria-label="Available skills">
          {allSkills.map((skill) => {
            const on = enabledSet.has(skill.id);
            return (
              <div className="ig-skillmgr__row" key={skill.id}>
                <label className="ig-skillmgr__toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => void toggleSkillEnabled(skill.id)}
                    aria-label={`Show "${skill.label}" on the skill bar`}
                  />
                  <i
                    className={`fa-solid ${resolveSkillIcon(skill)} ig-skillmgr__icon`}
                    aria-hidden="true"
                  />
                  <span className="ig-skillmgr__meta">
                    <span className="ig-skillmgr__label">
                      {skill.label}
                      {skill.isCustom && (
                        <span className="ig-skillmgr__badge">Custom</span>
                      )}
                    </span>
                    {skill.description && (
                      <span className="ig-skillmgr__desc">{skill.description}</span>
                    )}
                  </span>
                </label>

                {skill.isCustom &&
                  (confirmDeleteId === skill.id ? (
                    <span className="ig-skillmgr__confirm">
                      <button
                        type="button"
                        className="ig-btn ig-btn--danger"
                        onClick={() => {
                          void removeCustomSkill(skill.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="ig-btn"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="ig-btn ig-skillmgr__del"
                      onClick={() => setConfirmDeleteId(skill.id)}
                      title={`Delete "${skill.label}"`}
                      aria-label={`Delete "${skill.label}"`}
                    >
                      <i className="fa-solid fa-trash-can" aria-hidden="true" />
                    </button>
                  ))}
              </div>
            );
          })}
        </div>

        {/* Create a custom skill. */}
        <form className="ig-skillmgr__form" onSubmit={submitDraft}>
          <div className="ig-skillmgr__section">New custom skill</div>

          <div className="ig-field">
            <label htmlFor="skill-title">Title</label>
            <input
              id="skill-title"
              className="ig-input"
              value={draft.label}
              placeholder="e.g. Make it Friendly"
              onChange={(e) => patch({ label: e.target.value })}
            />
          </div>

          {/* Icon: no glyphs shown until "Select Icon" opens the picker. The
              badge previews the resolved icon (the picked one, or the fa-bolt
              fallback while nothing valid is chosen). */}
          <div className="ig-field">
            <span className="ig-field__label">Icon</span>
            <div className="ig-skillmgr__iconrow">
              <span className="ig-skillmgr__iconpreview" aria-hidden="true">
                <i className={`fa-solid ${previewIcon}`} />
              </span>
              <span className="ig-skillmgr__iconname">
                {previewIcon.replace(/^fa-/, "").replace(/-/g, " ")}
              </span>
              <button
                type="button"
                className="ig-btn ig-btn--primary ig-skillmgr__iconbtn"
                onClick={() => setIconPickerOpen(true)}
              >
                <i className="fa-solid fa-palette" aria-hidden="true" />
                Select Icon
              </button>
            </div>
          </div>

          <div className="ig-field">
            <label htmlFor="skill-desc">Description (optional)</label>
            <input
              id="skill-desc"
              className="ig-input"
              value={draft.description ?? ""}
              placeholder="Shown as the button tooltip"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div className="ig-field">
            <label htmlFor="skill-template">Prompt template</label>
            <textarea
              id="skill-template"
              className="ig-input ig-skillmgr__template"
              value={draft.template}
              placeholder={
                "Instructions for the model.\n\nUse [PASTE CONTENT HERE] where the " +
                "user's text goes — or leave it out and it's appended safely."
              }
              onChange={(e) => patch({ template: e.target.value })}
            />
            <span className="ig-skillmgr__hint">
              Your text is wrapped in a &lt;content&gt; data boundary at run time.
            </span>
          </div>

          {error && <div className="ig-error">{error}</div>}

          <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="ig-btn ig-btn--primary">
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add skill
            </button>
          </div>
        </form>
        </div>

        {/* Footer — done. */}
        <div className="ig-actions ig-skillmgr__footer">
          <button
            type="button"
            className="ig-btn ig-btn--primary"
            onClick={onClose}
            style={{ marginLeft: "auto" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>

      {/* Top layer over the manager. Mounted only while open so its search
          state resets on each open; Esc is handled by the manager's single
          shortcut handler (see useAppShortcuts above). */}
      {iconPickerOpen && (
        <IconPickerModal
          isOpen
          currentIcon={previewIcon}
          onSelect={(icon) => patch({ icon })}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </>
  );
}
