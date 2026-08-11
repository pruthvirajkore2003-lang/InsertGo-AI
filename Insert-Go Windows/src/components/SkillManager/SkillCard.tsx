/**
 * One skill tile in the Skill Manager panel's grid. Presentational: it reads
 * nothing from the store — the panel passes `enabled` and the toggle/delete
 * handlers, so the same card renders a built-in (toggle only) or a custom
 * (toggle + delete-with-confirm). The delete confirm is card-local so the grid
 * stays a plain map.
 *
 * SECURITY: the glyph comes from `resolveSkillIcon`, which only ever returns a
 * validated `fa-*` token (or the fa-bolt fallback), so it can't inject a class.
 */
import { useState } from "react";
import { resolveSkillIcon, skillCategory, type Skill } from "@/services/skills";

type Props = {
  skill: Skill;
  enabled: boolean;
  onToggle: () => void;
  /** Present only for custom skills — built-ins can't be deleted, only hidden. */
  onDelete?: () => void;
};

export function SkillCard({ skill, enabled, onToggle, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false);
  const icon = resolveSkillIcon(skill);

  return (
    <div
      className={"ig-glass-card ig-skillcard" + (enabled ? " ig-skillcard--on" : "")}
    >
      <div className="ig-skillcard__head">
        <span className="ig-skillcard__icon" aria-hidden="true">
          <i className={`fa-solid ${icon}`} />
        </span>
        <label
          className="ig-switch"
          title={enabled ? "On the skill bar" : "Off the skill bar"}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            aria-label={`Show "${skill.label}" on the skill bar`}
          />
          <span className="ig-switch__track" aria-hidden="true">
            <span className="ig-switch__thumb" />
          </span>
        </label>
      </div>

      <div className="ig-skillcard__label">
        <span className="ig-skillcard__title">{skill.label}</span>
        {skill.isCustom && <span className="ig-skillmgr__badge">Custom</span>}
      </div>

      {skill.description && (
        <div className="ig-skillcard__desc">{skill.description}</div>
      )}

      <div className="ig-skillcard__foot">
        <span className="ig-chip">{skillCategory(skill)}</span>
        {onDelete &&
          (confirm ? (
            <span className="ig-skillmgr__confirm">
              <button
                type="button"
                className="ig-btn ig-btn--danger"
                onClick={() => {
                  onDelete();
                  setConfirm(false);
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="ig-btn"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="ig-btn ig-skillcard__del"
              onClick={() => setConfirm(true)}
              title={`Delete "${skill.label}"`}
              aria-label={`Delete "${skill.label}"`}
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" />
            </button>
          ))}
      </div>
    </div>
  );
}
