/**
 * Root surface of the selection review floater window (`selfloater`, third
 * webview) — the ONLY thing that opens when a selection-bar skill is
 * clicked; the main palette window stays hidden. Wraps the shared
 * SkillComponentsFloater card as the window's whole surface (the
 * `.ig-panel--bare` treatment previously used when the palette hosted
 * selection reviews).
 *
 * Fresh JS context: stores start empty here, so settings/providers and auth
 * are loaded on mount (mirroring App.tsx / SelectionBar). The Rust side
 * emits `selection:review` to this window BEFORE showing it, captures the
 * paste-back target into `PriorWindow` first, and positions the window next
 * to the selection anchor.
 *
 * Lifecycle: `selection:review` → stage in the store → consume once. With a
 * skillId: open the card + start the run. With a null skillId (the bar's
 * "More" button): show the skill PICKER card for the same selection — the
 * run starts only when a skill is picked there. Closing either card (Esc /
 * ✕ / backdrop) hides the OS window via `hide_selection_floater`; Apply
 * goes through `selection_floater_insert`, which hides the window itself
 * and re-shows it with an `insert:fallback` toast when the paste couldn't
 * land.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { SkillComponentsFloater } from "@/components/PromptPalette/SkillComponentsFloater";
import { Toaster } from "@/components/Toaster";
import {
  AUTO_HEIGHT_TRANSITION,
  useAutoWindowHeight,
} from "@/hooks/useAutoWindowHeight";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { useProviderRun } from "@/hooks/useProviderRun";
import {
  hideSelectionFloater,
  onSelectionReview,
} from "@/services/selectionBar";
import {
  SKILL_SYSTEM,
  composeSkillPrompt,
  finalizeSkillOutput,
  getActiveSkills,
  getAllSkills,
  resolveSkillGrounding,
  resolveSkillIcon,
  streamThinking,
  visibleStreamText,
  type Skill,
} from "@/services/skills";
import { detectContext, rankSkills } from "@/services/selectionContext";
import { getSkillUsage, recordSkillUse } from "@/services/skillUsage";
import { isTauri } from "@/services/tauriBridge";
import { startWindowDrag } from "@/services/windowChrome";
import { usePromptStore } from "@/store/promptStore";
import { useHistoryStore } from "@/store/historyStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

/** Window-height clamp for the floater — tighter than the palette's: the
 *  card is a compact floating object next to a selection, not a full app. */
const FLOATER_MIN = 160;
const FLOATER_MAX = 640;

export function SelectionReviewFloater() {
  const runProvider = useProviderRun();

  const activeSkill = usePromptStore((s) => s.activeSkill);
  const pendingSelectionReview = usePromptStore(
    (s) => s.pendingSelectionReview
  );
  const setPendingSelectionReview = usePromptStore(
    (s) => s.setPendingSelectionReview
  );
  const setActiveSkill = usePromptStore((s) => s.setActiveSkill);
  const closeSkillFloater = usePromptStore((s) => s.closeSkillFloater);

  const loadSettings = useSettingsStore((s) => s.load);
  const initAuth = useAuthStore((s) => s.init);
  const enabledSkillIds = useSettingsStore((s) => s.settings.enabledSkillIds);
  const customSkills = useSettingsStore((s) => s.settings.customSkills);

  // Enabled skills (built-in + custom), the same set the bar shows — used for
  // the "More" picker and to resolve a custom-skill id in the handoff.
  const activeSkills = useMemo(
    () => getActiveSkills(enabledSkillIds, customSkills),
    [enabledSkillIds, customSkills]
  );

  // No composer in this window; the floater only touches this ref on
  // editor-source Apply, which never happens here (source is "selection").
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // "More" handoff state: the selection whose skill picker is on screen.
  // Null = no picker (idle or a review card is up).
  const [pickerText, setPickerText] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Dynamic window cropping (useAutoWindowHeight, edge-to-edge mode): the
  // card animates to the OS-window target height; screenRef is the scroll
  // cell inside whichever card is up, measureRef the unconstrained probe in
  // it. resetKey re-attaches the observers when the card type swaps.
  const screenRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const cardMode = activeSkill ? "card" : pickerText !== null ? "picker" : "none";
  const { windowHeight, onAnimationComplete } = useAutoWindowHeight(
    measureRef,
    screenRef,
    { min: FLOATER_MIN, max: FLOATER_MAX, resetKey: cardMode }
  );

  useEffect(() => {
    void loadSettings();
    void initAuth();
  }, [loadSettings, initAuth]);

  // Record completed selection-bar skill runs into the shared local history,
  // same completion gate as the composer (PromptPalette). runProvider never
  // writes `body`, so it stays "" — the selection text is deliberately NOT
  // logged (SPEC §10); the main window picks the entry up via historyStore's
  // storage listener. Empty-dep imperative subscribe so a history write never
  // re-renders this window.
  useEffect(
    () =>
      usePromptStore.subscribe((s, prev) => {
        if (prev.isSending && !s.isSending && s.result && !s.error) {
          useHistoryStore.getState().record({
            body: s.body,
            outputTokens: s.metrics?.outputTokens ?? null,
            totalMs: s.metrics?.totalMs ?? null,
          });
        }
      }),
    []
  );

  // Stage each bar handoff; the catch makes plain `vite dev` (no Tauri
  // events) inert instead of an unhandled rejection.
  useEffect(() => {
    const sub = onSelectionReview((payload) =>
      setPendingSelectionReview(payload)
    ).catch(() => () => { });
    return () => {
      void sub.then((unlisten) => unlisten());
    };
  }, [setPendingSelectionReview]);

  // Open the review card for `skill` and stream the run into it — shared by
  // the direct bar handoff and the picker's skill click.
  const startRun = useCallback(
    (skill: Skill, icon: string, text: string) => {
      setActiveSkill({
        id: skill.id,
        label: skill.label,
        icon,
        source: "selection",
      });
      void runProvider(
        composeSkillPrompt(skill.template, text),
        SKILL_SYSTEM,
        finalizeSkillOutput,
        visibleStreamText,
        streamThinking,
        resolveSkillGrounding(skill)
      );
    },
    [setActiveSkill, runProvider]
  );

  // Consume the staged handoff exactly once: a skill opens the card and
  // streams the run; a null skill (the bar's "More") shows the skill picker
  // instead. A new handoff while a run is up simply supersedes it
  // (runProvider aborts the previous stream; closeSkillFloater for picker).
  useEffect(() => {
    if (!pendingSelectionReview) return;
    const { skillId, icon, text } = pendingSelectionReview;
    setPendingSelectionReview(null);
    if (skillId === null) {
      // The hide-on-close effect below sees the picker state in the same
      // commit, so superseding a live card never hides the window.
      closeSkillFloater();
      setPickerText(text);
      return;
    }
    // Resolve against ALL skills (built-in + custom) — a custom skill id from
    // the bar isn't in the vendored SKILLS list; missing it left the shown
    // window blank (the black-screen bug).
    const skill = getAllSkills(customSkills).find((s) => s.id === skillId);
    if (!skill) return;
    setPickerText(null);
    startRun(skill, icon ?? resolveSkillIcon(skill), text);
  }, [
    pendingSelectionReview,
    setPendingSelectionReview,
    closeSkillFloater,
    startRun,
    customSkills,
  ]);

  // Dismissing the card (Esc / ✕ / backdrop → activeSkill goes null) must
  // also hide the OS window — there is nothing else in it. Tracked via a ref
  // so the startup null never fires a hide; skipped when the picker took
  // over (a "More" handoff superseding a live card — the backend just
  // showed the window for it).
  const hadSkillRef = useRef(false);
  useEffect(() => {
    if (activeSkill) {
      hadSkillRef.current = true;
      return;
    }
    if (hadSkillRef.current) {
      hadSkillRef.current = false;
      if (pickerText === null && isTauri()) {
        void hideSelectionFloater().catch(() => { });
      }
    }
  }, [activeSkill, pickerText]);

  // Picker dismissal: clear it and hide the OS window (nothing else is in
  // the window while the picker is up).
  const closePicker = useCallback(() => {
    setPickerText(null);
    if (isTauri()) {
      void hideSelectionFloater().catch(() => { });
    }
  }, []);

  // Picking a skill starts the exact run the bar would have started —
  // recorded for the frequency tie-break, same as a bar click.
  const onPick = useCallback(
    (skill: Skill) => {
      const text = pickerText;
      if (text === null) return;
      recordSkillUse(skill.id);
      setPickerText(null);
      startRun(skill, resolveSkillIcon(skill), text);
    },
    [pickerText, startRun]
  );

  // Context-aware picker order — same ranking the bar shows for this text,
  // over the same enabled set (built-in + custom).
  const rankedPicker = useMemo(
    () =>
      pickerText !== null
        ? rankSkills(activeSkills, detectContext(pickerText), getSkillUsage())
        : activeSkills,
    [pickerText, activeSkills]
  );

  // Esc closes the picker (mirroring SkillComponentsFloater's own Esc
  // handling — which only exists while the review card is mounted).
  useAppShortcuts({
    onClose:
      pickerText !== null
        ? () => {
            closePicker();
          }
        : undefined,
  });

  // Click outside the picker card closes it (mousedown, not click — a drag
  // that starts inside and ends outside must not dismiss).
  useEffect(() => {
    if (pickerText === null) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerText, closePicker]);

  // Apply's paste couldn't land: Rust left the text on the clipboard and
  // re-showed this window so the toast (and the retryable card) is visible.
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen("insert:fallback", () => {
      toast.info("Copied to clipboard — press Ctrl+V to paste manually");
    });
    return () => {
      void unlisten.then((u) => u());
    };
  }, []);

  // The card is the whole window surface here, so grabbing its glass maps to
  // a native window drag (same manual-startDragging affordance as the review
  // card — the drag-region attribute never fired from child elements). Skill
  // buttons and the close button keep their own mousedown behavior.
  const onDragStart = (e: React.MouseEvent) => {
    if (!isTauri() || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    void startWindowDrag();
  };

  return (
    <div className="ig-overlay">
      <div className="ig-panel ig-panel--bare">
        {activeSkill ? (
          <SkillComponentsFloater
            onRun={runProvider}
            editorRef={editorRef}
            autoHeight={{
              height: windowHeight,
              onAnimationComplete,
              screenRef,
              contentRef: measureRef,
            }}
          />
        ) : pickerText !== null ? (
          <motion.div
            ref={pickerRef}
            className="ig-modal__card ig-skillfloater"
            role="dialog"
            aria-label="Pick a skill"
            initial={false}
            animate={windowHeight == null ? undefined : { height: windowHeight }}
            transition={AUTO_HEIGHT_TRANSITION}
            onAnimationComplete={onAnimationComplete}
            onMouseDown={onDragStart}
          >
            <div className="ig-skillfloater__head">
              <div className="ig-modal__title">Skills</div>
              <button
                type="button"
                className="ig-btn ig-skillfloater__close"
                onClick={closePicker}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            {/* Same measurement pair the review card exposes: scroll cell +
                unconstrained probe, so the window crops to the skill list. */}
            <div className="ig-autoheight" ref={screenRef}>
              <div ref={measureRef}>
                <div className="ig-skillbar" role="toolbar" aria-label="Selection skills">
                  {rankedPicker.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className="ig-btn ig-skill"
                      onClick={() => onPick(skill)}
                      title={skill.label}
                      aria-label={skill.label}
                    >
                      <i
                        className={`fa-solid ${resolveSkillIcon(skill)}`}
                        aria-hidden="true"
                      />
                      <span>{skill.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
      <Toaster />
    </div>
  );
}
