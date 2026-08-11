/**
 * Selection skill bar — the smart, in-situ floating toolbar shown by the Rust
 * selection watcher directly above a text selection in an external app (second
 * window, `skillbar` label). It reads the selection, ranks the vendored skills
 * for that context (email → reply, code → explain, foreign → translate, …,
 * blended with the user's own usage history), and shows ALL of them at once as
 * the large `.ig-skillbar` toolbar (same layout as the palette's SkillButtons).
 * A caret points at the selection; icons carry tooltips instead of labels.
 *
 * Clicking an icon hands the selection + skill over to the dedicated
 * selection review floater window (`open_selection_review`), where the run
 * streams into the Skill Components floater for review — the main palette
 * never opens, and the selection is only replaced when the user hits Apply
 * there. The trailing "More" button is the same handoff with NO skill: the
 * floater opens in its skill-picker state for the same selection. With no
 * provider (i.e. logged out) the bar shows a "Log in" button instead of the
 * unclickable skills, so the auth state is visible up front; the login
 * notice remains as a fallback inside the handoff.
 *
 * Deliberately does NOT import PromptPalette/ResultView or the prompt store:
 * this webview is a separate JS context and a separate surface. Show/hide is
 * driven entirely by backend events; the window itself never takes focus, so
 * there is no blur to react to (Esc is handled by the Rust keyboard hook, with
 * a local keydown fallback).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { getActiveSkills, resolveSkillIcon, type Skill } from "@/services/skills";
import { detectContext, rankSkills } from "@/services/selectionContext";
import { getSkillUsage, recordSkillUse } from "@/services/skillUsage";
import {
  hideSelectionBar,
  onSelectionFallback,
  onSelectionHide,
  onSelectionShow,
  openSelectionReview,
  type SelectionPlacement,
} from "@/services/selectionBar";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";

type Notice = { kind: "fallback" | "error"; message: string };

/** How long a notice stays up before the bar asks the backend to hide it. */
const NOTICE_HIDE_MS = 2400;

export function SelectionBar() {
  const [text, setText] = useState("");
  const [placement, setPlacement] = useState<SelectionPlacement>("above");
  const [notice, setNotice] = useState<Notice | null>(null);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSettings = useSettingsStore((s) => s.load);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const enabledSkillIds = useSettingsStore((s) => s.settings.enabledSkillIds);
  const customSkills = useSettingsStore((s) => s.settings.customSkills);

  const signInWithBrowser = useAuthStore((s) => s.signInWithBrowser);
  const authLoading = useAuthStore((s) => s.isLoading);
  // Sign-in failures (timeout, browser blocked) land here — surfaced under
  // the login button since this window has no AuthPanel to show them.
  const authError = useAuthStore((s) => s.error);
  // activeProvider() reads the token imperatively (getState), which is not
  // reactive on its own — subscribing to the token makes a login/logout
  // re-render the skills/login branch below.
  const authToken = useAuthStore((s) => s.token);

  // Fresh JS context: providers/settings must be loaded here too (App.tsx
  // does the same for the palette window). Auth likewise — this window skips
  // AuthGuard (must paint even logged-out), so the token has to be hydrated
  // here or activeProvider() reports "logged out" for logged-in users.
  useEffect(() => {
    void loadSettings();
    void useAuthStore.getState().init();
  }, [loadSettings]);

  // Only the skills the user enabled on the bar (built-in + custom), in their
  // chosen order — same source as the palette's SkillButtons, so toggling a
  // skill in the Skill Manager changes this floating bar too.
  const activeSkills = useMemo(
    () => getActiveSkills(enabledSkillIds, customSkills),
    [enabledSkillIds, customSkills]
  );

  // Context-aware order: recomputed when the selection or the enabled set
  // changes (usage is read at the same time so a click's recorded use shows up
  // on the next show).
  const ranked = useMemo(
    () =>
      text.trim()
        ? rankSkills(activeSkills, detectContext(text), getSkillUsage())
        : activeSkills,
    [text, activeSkills]
  );

  // Resolve each skill's Font Awesome glyph once per ranking, not per render —
  // the bar stays mounted (below), so this avoids re-resolving on every
  // show/hide toggle and re-laying-out the glyphs.
  const rankedWithIcons = useMemo(
    () => ranked.map((skill) => ({ skill, icon: resolveSkillIcon(skill) })),
    [ranked]
  );

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  /** Reset to idle (notice + its hide timer). */
  const resetRun = useCallback(() => {
    clearHideTimer();
    setNotice(null);
  }, []);

  useEffect(() => {
    // `listen` rejects outside the Tauri shell (plain `vite dev`); the catch
    // makes the bar simply inert there instead of spamming unhandled
    // rejections. The no-op stands in for the unlisten fn. Inside Tauri a
    // rejection is a real plumbing failure (capability/ACL) that would leave
    // the bar permanently dead — surface it instead of hiding it.
    const guard = (sub: Promise<() => void>) =>
      sub.catch((e) => {
        console.error("selection bar event subscription failed:", e);
        return () => {};
      });
    const subs = [
      guard(
        onSelectionShow((payload) => {
          // A new selection supersedes whatever was running for the old one.
          resetRun();
          setText(payload.text);
          setPlacement(payload.placement ?? "above");
        })
      ),
      guard(
        onSelectionHide(() => {
          resetRun();
          setText("");
        })
      ),
      guard(
        onSelectionFallback(() => {
          // Backend left the result on the clipboard and re-showed the bar.
          setNotice({ kind: "fallback", message: "Copied — paste manually" });
          clearHideTimer();
          hideTimerRef.current = setTimeout(
            () => void hideSelectionBar(),
            NOTICE_HIDE_MS
          );
        })
      ),
    ];
    return () => {
      resetRun();
      for (const sub of subs) void sub.then((unlisten) => unlisten());
    };
  }, [resetRun]);

  // Local Esc fallback (the primary Esc handler is the Rust keyboard hook —
  // this window is never focused, so it normally sees no keys at all).
  useAppShortcuts({
    onClose: () => {
      void hideSelectionBar();
    },
  });

  // Shared handoff to the selection review floater window: with a skill the
  // run starts there immediately; with null (the "More" button) the floater
  // opens in its skill-picker state for the same selection. Either way the
  // run streams into the Skill Components floater (the main palette never
  // opens), and only its Apply touches the selection.
  const handOff = useCallback(
    async (skill: Skill | null) => {
      if (!text.trim()) return;

      // Record the use before handing off — feeds the frequency tie-break in
      // future rankings (best-effort; never blocks the run). The picker
      // handoff records nothing; the floater records the skill picked there.
      if (skill) recordSkillUse(skill.id);

      const provider = activeProvider();
      if (!provider) {
        // No provider = not logged in (the proxy provider is synthesized from
        // the auth token). Never touch the user's selection here — pasting
        // anything over it would destroy their text. Tell them why instead.
        setNotice({
          kind: "error",
          message: "Log in to InsertGo to run skills",
        });
        clearHideTimer();
        hideTimerRef.current = setTimeout(
          () => void hideSelectionBar(),
          NOTICE_HIDE_MS
        );
        return;
      }

      try {
        await openSelectionReview(
          skill ? skill.id : null,
          skill ? resolveSkillIcon(skill) : null,
          text
        );
      } catch (e) {
        setNotice({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => void hideSelectionBar(), NOTICE_HIDE_MS);
      }
    },
    [text, activeProvider]
  );

  // Contextual toolbar: visible only while a selection is live (or a transient
  // fallback/error notice is up). Rather than unmounting when idle, the shell
  // stays MOUNTED and is hidden via a class + `aria-hidden` — so a show does
  // not remount the toolbar subtree or reflow the Font Awesome glyphs, and AT
  // never sees the parked bar. (The backend also parks the window off-screen.)
  const idle = !notice && !text.trim();

  // Logged out = no provider (the proxy provider is synthesized from the auth
  // token). Recomputed on render; authToken is in the deps because
  // activeProvider() reads it via getState() (not reactively).
  const loggedOut = useMemo(
    () => !activeProvider(),
    [activeProvider, authToken]
  );

  return (
    <div
      className={`ig-selbar-shell ig-selbar-shell--${placement}${idle ? " ig-selbar-shell--hidden" : ""}`}
      aria-hidden={idle || undefined}
    >
      <div className="ig-skillbar" role="toolbar" aria-label="Selection skills">
        {notice ? (
          <span
            className={`ig-selbar__note${notice.kind === "error" ? " ig-selbar__note--error" : ""}`}
            role="status"
          >
            {notice.message}
          </span>
        ) : loggedOut ? (
          <div className="ig-selbar__login">
            <span
              className={`ig-selbar__note${authError ? " ig-selbar__note--error" : ""}`}
              role="status"
            >
              {authError ?? "Sign in to InsertGo to run skills"}
            </span>
            <button
              className="ig-btn ig-btn--primary"
              onClick={() => void signInWithBrowser()}
              disabled={idle || authLoading}
            >
              {authLoading ? (
                <>
                  <span className="ig-btn__spinner" aria-hidden="true" />
                  Waiting for browser…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
                  Sign in
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {rankedWithIcons.map(({ skill, icon }) => (
              <button
                key={skill.id}
                className="ig-skillbtn"
                onClick={() => void handOff(skill)}
                disabled={idle}
                title={skill.label}
                aria-label={skill.label}
              >
                <i className={`fa-solid ${icon}`} aria-hidden="true" />
              </button>
            ))}
            {/* "More": open the floater's skill picker for this selection. */}
            <button
              className="ig-skillbtn"
              onClick={() => void handOff(null)}
              disabled={idle}
              title="More — pick a skill in the floater"
              aria-label="More"
            >
              <i className="fa-solid fa-ellipsis" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
