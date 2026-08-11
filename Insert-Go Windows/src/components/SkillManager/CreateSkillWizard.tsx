/**
 * Create Skill wizard — two ways to build a custom skill:
 *
 *   • AI Generator (default): the user gives a Title, picks an Icon, and
 *     describes in plain language how the skill should work. "Generate with AI"
 *     drafts the prompt template, description, and category, which the user then
 *     reviews, edits, tests, and saves.
 *   • Manual: the original 3-step flow (Title & Category → Prompt template →
 *     Icon & Description) for hand-authoring a template.
 *
 * The final Create re-runs the same pure `validateCustomSkill` the store
 * enforces on persist, so the inline error is the store's rule (catches a
 * duplicate id that per-step checks can't). On success it dispatches
 * `addCustomSkill`, which appends the skill and enables it on the bar.
 *
 * The AI call goes straight through `resolveActiveProvider(...).send()` with
 * local component state — NOT `useProviderRun`, which writes into this window's
 * shared promptStore and would clobber the composer's result/sending state
 * behind the modal. Same lane-resolution pipeline (SPEC §16.1), no cross-talk.
 *
 * SECURITY: the template is stored and later composed through
 * `composeSkillPrompt`, which escapes the user's editor text into a <content>
 * data boundary (OWASP LLM01); the generator's own request is likewise wrapped
 * and close-tag-escaped by `composeGenerateSkillPrompt`. The icon is constrained
 * to a `fa-*` token before it reaches `className`, and category to the known union.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import {
  SKILL_CATEGORIES,
  SKILL_GENERATOR_SYSTEM,
  composeGenerateSkillPrompt,
  getAllSkills,
  parseGeneratedSkillDraft,
  resolveSkillIcon,
  validateCustomSkill,
  type CustomSkillDraft,
} from "@/services/skills";
import { resolveActiveProvider } from "@/services/aiProviders";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { IconPickerModal } from "./IconPickerModal";

type Props = { onClose: () => void };

type Mode = "ai" | "manual";
/** AI mode has two phases: describe the skill, then review the generated draft. */
type AiPhase = "input" | "review";

const EMPTY_DRAFT: CustomSkillDraft = {
  label: "",
  template: "",
  icon: "",
  description: "",
  category: "writing",
};

const STEPS = ["Title & Category", "Prompt Template", "Icon & Description"];

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function CreateSkillWizard({ onClose }: Props) {
  const customSkills = useSettingsStore((s) => s.settings.customSkills);
  const addCustomSkill = useSettingsStore((s) => s.addCustomSkill);
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<Mode>("ai");
  const [aiPhase, setAiPhase] = useState<AiPhase>("input");
  const [intent, setIntent] = useState("");
  const [generating, setGenerating] = useState(false);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CustomSkillDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const allSkills = useMemo(() => getAllSkills(customSkills), [customSkills]);

  // Abort the in-flight generation on unmount (or a superseding run) so its
  // resolve/reject can't setState into an unmounted component.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // One Esc handler across both layers: the picker (top) closes first, then the
  // wizard — one owner for both layers, no racing capture listeners.
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

  const previewIcon = resolveSkillIcon({
    id: "preview",
    label: "",
    template: "",
    isCustom: true,
    icon: draft.icon,
  });

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setError(null);
    setStep(0);
    setAiPhase("input");
    setMode(m);
  };

  const generate = async () => {
    const title = draft.label.trim();
    if (!title) {
      setError("Give the skill a title.");
      return;
    }
    if (!intent.trim()) {
      setError("Describe what the skill should do.");
      return;
    }
    setError(null);

    let resolved;
    try {
      resolved = await resolveActiveProvider("chat");
    } catch (e) {
      setError(errMsg(e));
      return;
    }
    if (resolved.requiresLogin && !user) {
      setError("You must be logged in to use the AI assistant.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    try {
      const res = await resolved.provider.send(
        {
          prompt: composeGenerateSkillPrompt({ title, intent }),
          system: SKILL_GENERATOR_SYSTEM,
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const parsed = parseGeneratedSkillDraft(res.text, {
        fallbackCategory: draft.category,
      });
      setDraft((d) => ({ ...d, ...parsed }));
      setAiPhase("review");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(errMsg(e));
      toast.error(`Skill generation failed: ${errMsg(e)}`);
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  };

  const next = () => {
    if (step === 0 && !draft.label.trim()) {
      setError("Give the skill a title.");
      return;
    }
    if (step === 1 && !draft.template.trim()) {
      setError("The prompt template can't be empty.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const create = async () => {
    // Final gate: the store re-validates on persist, but running it here turns
    // a duplicate-id collision into an inline message instead of a toast.
    const res = validateCustomSkill(draft, allSkills);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const ok = await addCustomSkill(draft);
    if (ok) onClose();
  };

  // Shared field fragments (used by AI review + manual steps) ────────────────
  const titleField = (
    <div className="ig-field">
      <label htmlFor="wiz-title">Title</label>
      <input
        id="wiz-title"
        className="ig-input"
        autoFocus
        value={draft.label}
        placeholder="e.g. Make it Friendly"
        onChange={(e) => patch({ label: e.target.value })}
      />
    </div>
  );

  const categoryField = (
    <div className="ig-field">
      <span className="ig-field__label">Category</span>
      <div className="ig-chips ig-wizard__cats">
        {SKILL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={
              "ig-chip ig-chip--btn" +
              (draft.category === c.id ? " ig-chip--active" : "")
            }
            aria-pressed={draft.category === c.id}
            onClick={() => patch({ category: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  const iconField = (
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
  );

  const descriptionField = (
    <div className="ig-field">
      <label htmlFor="wiz-desc">Description (optional)</label>
      <input
        id="wiz-desc"
        className="ig-input"
        value={draft.description ?? ""}
        placeholder="Shown as the button tooltip"
        onChange={(e) => patch({ description: e.target.value })}
      />
    </div>
  );

  const templateField = (autoFocus = false) => (
    <div className="ig-field">
      <label htmlFor="wiz-template">Prompt template</label>
      <textarea
        id="wiz-template"
        className="ig-input ig-skillmgr__template"
        autoFocus={autoFocus}
        value={draft.template}
        placeholder={
          "Instructions for the model.\n\nUse [PASTE CONTENT HERE] where " +
          "the user's text goes — or leave it out and it's appended safely."
        }
        onChange={(e) => patch({ template: e.target.value })}
      />
      <span className="ig-skillmgr__hint">
        Your text is wrapped in a &lt;content&gt; data boundary at run time.
      </span>
    </div>
  );

  return (
    <>
      <div className="ig-modal" onClick={onClose}>
        <div
          className="ig-modal__card ig-wizard"
          role="dialog"
          aria-modal="true"
          aria-label="Create a skill"
          aria-busy={generating}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ig-modal__title">Create a Skill</div>

          {/* Mode toggle */}
          <div className="ig-chips ig-wizard__modes" role="tablist" aria-label="Creation mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "ai"}
              className={"ig-chip ig-chip--btn" + (mode === "ai" ? " ig-chip--active" : "")}
              onClick={() => switchMode("ai")}
            >
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> AI
              Generator
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "manual"}
              className={"ig-chip ig-chip--btn" + (mode === "manual" ? " ig-chip--active" : "")}
              onClick={() => switchMode("manual")}
            >
              <i className="fa-solid fa-pen" aria-hidden="true" /> Manual
            </button>
          </div>

          {/* Step rail — manual mode only */}
          {mode === "manual" && (
            <ol className="ig-wizard__steps">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  className={
                    "ig-wizard__step" +
                    (i === step ? " ig-wizard__step--active" : "") +
                    (i < step ? " ig-wizard__step--done" : "")
                  }
                  aria-current={i === step ? "step" : undefined}
                >
                  <span className="ig-wizard__num">{i + 1}</span>
                  <span className="ig-wizard__steplabel">{label}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="ig-wizard__body">
            {/* ── AI Generator ────────────────────────────────────────────── */}
            {mode === "ai" && aiPhase === "input" && (
              <>
                {titleField}
                {iconField}
                <div className="ig-field">
                  <label htmlFor="wiz-intent">How should this skill work?</label>
                  <textarea
                    id="wiz-intent"
                    className="ig-input ig-skillmgr__template"
                    value={intent}
                    placeholder={
                      "Describe the transformation in plain language.\n\n" +
                      "e.g. Rewrite the text in a warm, friendly tone while keeping " +
                      "its meaning and any names or numbers exactly the same."
                    }
                    onChange={(e) => {
                      setIntent(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                  <span className="ig-skillmgr__hint">
                    The AI drafts the prompt template, description, and category —
                    you review and edit before saving.
                  </span>
                </div>
              </>
            )}

            {mode === "ai" && aiPhase === "review" && (
              <>
                {titleField}
                {categoryField}
                {iconField}
                {descriptionField}
                {templateField()}
              </>
            )}

            {/* ── Manual ──────────────────────────────────────────────────── */}
            {mode === "manual" && step === 0 && (
              <>
                {titleField}
                {categoryField}
              </>
            )}
            {mode === "manual" && step === 1 && templateField(true)}
            {mode === "manual" && step === 2 && (
              <>
                {iconField}
                {descriptionField}
              </>
            )}

            {error && <div className="ig-error">{error}</div>}
          </div>

          {/* Footer nav */}
          <div className="ig-actions ig-wizard__footer">
            {mode === "ai" ? (
              <>
                <button
                  type="button"
                  className="ig-btn"
                  onClick={aiPhase === "review" ? () => setAiPhase("input") : onClose}
                  disabled={generating}
                >
                  {aiPhase === "review" ? "Back" : "Cancel"}
                </button>
                {aiPhase === "input" ? (
                  <button
                    type="button"
                    className="ig-btn ig-btn--primary"
                    style={{ marginLeft: "auto" }}
                    onClick={() => void generate()}
                    disabled={generating}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                    {generating ? "Generating…" : "Generate with AI"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ig-btn ig-btn--primary"
                    style={{ marginLeft: "auto" }}
                    onClick={() => void create()}
                  >
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                    Create skill
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ig-btn"
                  onClick={step === 0 ? onClose : back}
                >
                  {step === 0 ? "Cancel" : "Back"}
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    className="ig-btn ig-btn--primary"
                    style={{ marginLeft: "auto" }}
                    onClick={next}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ig-btn ig-btn--primary"
                    style={{ marginLeft: "auto" }}
                    onClick={() => void create()}
                  >
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                    Create skill
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

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
