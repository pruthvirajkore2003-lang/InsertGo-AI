/**
 * Skill bar — one button per skill the user has enabled on the bar
 * (`settings.enabledSkillIds`, built-in or custom). Clicking wraps the editor
 * text in that skill's template and runs it through the active provider via the
 * palette's shared send path; with no provider configured it degrades to
 * inserting the composed prompt into the editor.
 *
 * The active set is read reactively from the settings store, so adding,
 * removing, toggling, or reordering skills in the Skill Manager updates this
 * bar immediately — no reload. The bar itself is run-only: managing skills
 * lives in the Skills sub-tab (SkillManagerPanel).
 */
import { useCallback, useMemo } from "react";
import {
  SKILL_SYSTEM,
  composeSkillPrompt,
  finalizeSkillOutput,
  getActiveSkills,
  resolveSkillGrounding,
  resolveSkillIcon,
  streamThinking,
  visibleStreamText,
  type Skill,
} from "@/services/skills";
import { usePromptStore } from "@/store/promptStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "@/store/toastStore";

type Props = {
  /** The palette's provider-send callback (sets isSending/result/error).
   *  `transform` shapes the complete response; `visible` gates what a
   *  partially streamed response may display (null = keep working state). */
  onRun: (
    promptText: string,
    system?: string,
    transform?: (text: string) => string,
    visible?: (accumulated: string) => string | null,
    getThinking?: (accumulated: string) => string | null,
    grounded?: boolean
  ) => void | Promise<void>;
};

export function SkillButtons({ onRun }: Props) {
  const body = usePromptStore((s) => s.body);
  const isSending = usePromptStore((s) => s.isSending);
  const setBody = usePromptStore((s) => s.setBody);
  const setActiveSkill = usePromptStore((s) => s.setActiveSkill);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const enabledSkillIds = useSettingsStore((s) => s.settings.enabledSkillIds);
  const customSkills = useSettingsStore((s) => s.settings.customSkills);

  // New array refs from `update()` on every change → this recomputes and the
  // bar re-renders. Stale/missing ids are filtered inside getActiveSkills.
  const activeSkills = useMemo(
    () => getActiveSkills(enabledSkillIds, customSkills),
    [enabledSkillIds, customSkills]
  );

  const hasText = body.trim().length > 0;

  const onSkill = useCallback(
    (skill: Skill) => {
      const composed = composeSkillPrompt(skill.template, body);
      if (!activeProvider()) {
        setBody(composed);
        toast.info(
          "Enhanced prompt inserted — add an AI provider in Settings to run it"
        );
        return;
      }
      // Open the Skill Components floater before dispatching; the resolved
      // icon travels through state so the floater never re-derives it.
      setActiveSkill({
        id: skill.id,
        label: skill.label,
        icon: resolveSkillIcon(skill),
        source: "editor",
      });
      // finalizeSkillOutput shapes the finished deliverable; visibleStreamText
      // gates the artifact; streamThinking surfaces the <analysis> reasoning
      // live as collapsible "thinking" so the analysis phase isn't a blank wait;
      // resolveSkillGrounding opts the research skills into the web-grounded lane.
      void onRun(
        composed,
        SKILL_SYSTEM,
        finalizeSkillOutput,
        visibleStreamText,
        streamThinking,
        resolveSkillGrounding(skill)
      );
    },
    [body, activeProvider, setBody, setActiveSkill, onRun]
  );

  // No wrapper/label: the ribbon renders directly inside the Improvise zone,
  // whose zone head already names the section.
  return (
    <div className="ig-skillbar" role="toolbar" aria-label="Prompt skills">
      {activeSkills.length === 0 ? (
        <span className="ig-skillbar__empty">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          No skills on the bar — add one in the Skills tab.
        </span>
      ) : (
        activeSkills.map((skill) => {
          const icon = resolveSkillIcon(skill);
          return (
            <button
              key={skill.id}
              className="ig-btn ig-skill"
              onClick={() => onSkill(skill)}
              disabled={!hasText || isSending}
              title={skill.description || skill.label}
              aria-label={skill.label}
            >
              <i className={`fa-solid ${icon}`} aria-hidden="true" />
              <span>{skill.label}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
