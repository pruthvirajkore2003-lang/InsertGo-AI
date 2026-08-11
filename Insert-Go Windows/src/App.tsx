import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, MotionConfig, type Variants } from "framer-motion";
import "./styles/components.css";
import { PromptPalette } from "@/components/PromptPalette/PromptPalette";
import { ProfilePanel } from "@/components/Profile/ProfilePanel";
import { SettingsPanel } from "@/components/Settings/SettingsPanel";
import { Toaster } from "@/components/Toaster";
import { ResizeHandles } from "@/components/WindowChrome/ResizeHandles";
import { Tabs, TabPanel, type TabDef } from "@/components/ui/Tabs";
import { AuthPanel } from "@/components/Settings/AuthPanel";
import { CreditBadge } from "@/components/ui/CreditBadge";
import { hideWindow, startWindowDrag } from "@/services/windowChrome";
import { isTauri } from "@/services/tauriBridge";
import { useHotkey } from "@/hooks/useHotkey";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import {
  AUTO_HEIGHT_TRANSITION,
  useAutoWindowHeight,
} from "@/hooks/useAutoWindowHeight";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { initLicense } from "@/store/licenseStore";
import { UpgradeModal } from "@/components/Monetization/UpgradeModal";
import { PlanUpgradeModal } from "@/components/Monetization/PlanUpgradeModal";

type View = "composer" | "settings" | "profile";

// Sign-in entrance — staggered rise; bezier mirrors --ig-ease.
const AUTH_STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const AUTH_RISE: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
  },
};

const TABS: (TabDef & { id: View })[] = [
  { id: "composer", label: "Composer", icon: "fa-pen-nib" },
  { id: "settings", label: "Settings", icon: "fa-gear" },
  { id: "profile", label: "Profile", icon: "fa-circle-user" },
];

export default function App() {
  // `view` drives the tab bar (urgent, so the indicator animates instantly);
  // `panel` drives which heavy panel is mounted (deferred via transition).
  const [view, setView] = useState<View>("composer");
  const [panel, setPanel] = useState<View>("composer");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Dynamic window cropping: the probe div reports natural content height;
  // the motion viewport animates the visible height while the hook sequences
  // the native window around it (expand: window first; shrink: DOM first).
  const autoHeightRef = useRef<HTMLDivElement>(null);
  const autoViewportRef = useRef<HTMLDivElement>(null);
  const { viewportHeight, onAnimationComplete } = useAutoWindowHeight(
    autoHeightRef,
    autoViewportRef
  );

  const selectView = useCallback((v: View) => {
    setView(v);
    startTransition(() => setPanel(v));
  }, []);

  // Sync path for flows that must focus the composer editor right after:
  // flushSync guarantees the panel is mounted before the next frame. Only
  // used when the window is hidden or on explicit "use prompt" commands,
  // so the synchronous render can't be seen as jank.
  const showComposerAndFocus = useCallback(() => {
    flushSync(() => {
      setView("composer");
      setPanel("composer");
    });
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const loadSettings = useSettingsStore((s) => s.load);
  const user = useAuthStore((s) => s.user);
  // Every request goes through the managed relay, which needs a session.
  const authRequired = !user;
  const initAuth = useAuthStore((s) => s.init);

  // Apply persisted theme/settings on startup.
  useEffect(() => {
    void loadSettings();
    void initAuth();
    // Re-check the cached lifetime license (quiet: offline keeps Pro).
    initLicense();
  }, [loadSettings, initAuth]);

  // Mod+Tab / Mod+Shift+Tab cycle the tab bar (web: Mod+Shift+] / [, since the
  // Tab chords belong to the browser's own tab strip). Bubble phase, like the
  // Escape fallback in useHotkey, so an open dialog's capture handler wins.
  const cycleView = useCallback(
    (delta: number) => {
      // The auth gate renders no tab bar — decline, leave the key alone.
      if (authRequired) return false;
      const i = TABS.findIndex((t) => t.id === view);
      // + TABS.length keeps the sum non-negative; the modulo wraps both ends
      // (and a stale `view` — findIndex -1 — still resolves in range).
      selectView(TABS[(i + delta + TABS.length) % TABS.length].id);
    },
    [authRequired, view, selectView]
  );
  useAppShortcuts(
    {
      onPrevTab: () => cycleView(-1),
      onNextTab: () => cycleView(1),
    },
    { capture: false }
  );

  // When the palette is shown via hotkey, jump to the composer and focus it.
  const onShown = useCallback(() => {
    showComposerAndFocus();
  }, [showComposerAndFocus]);
  useHotkey({ onShown });

  return (
    <div className="ig-overlay">
      <div className="ig-panel">
        <ResizeHandles />
        {!isTauri() && (
          <div
            role="alert"
            style={{
              background: "#7a5a00",
              color: "#fff",
              padding: "4px 10px",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Browser dev mode — secrets are kept in sessionStorage (1h TTL),
            not the OS credential store. Don't paste production keys here.
          </div>
        )}
        <div
          className="ig-header"
          onMouseDown={(e) => {
            // The strip (and the inert brand) drags the window; anything
            // interactive — tab buttons, the close button — still clicks.
            const el = e.target as HTMLElement;
            if (e.button === 0 && !el.closest("button")) {
              void startWindowDrag();
            }
          }}
        >
          <div className="ig-brand">
            <span className="ig-brand__mark">
              <img
                src="/main-logo.png"
                alt="InsertGo Logo"
                aria-hidden="true"
              />
            </span>
            <span className="ig-brand__name">
              InsertGo<span className="ig-brand__ai">.AI</span>
            </span>
          </div>

          {!authRequired && (
            <Tabs
              tabs={TABS}
              value={view}
              onChange={(id) => selectView(id as View)}
              aria-label="Views"
              idBase="ig-view"
            />
          )}

          <div className="ig-header__right">
            {!authRequired && <CreditBadge />}

            {isTauri() && (
              <div className="ig-header__actions">
                <button
                  className="ig-iconbtn"
                  aria-label="Hide window"
                  title="Hide (Esc)"
                  onClick={() => void hideWindow()}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Auto-height pair (useAutoWindowHeight): the motion viewport
            carries the animated visible height; the inner div is
            unconstrained so it always reports the content's natural height.
            initial={false} makes the first measured height apply instantly
            (no open-from-zero on launch). */}
        <motion.div
          ref={autoViewportRef}
          className="ig-autoheight"
          initial={false}
          animate={
            viewportHeight == null ? undefined : { height: viewportHeight }
          }
          transition={AUTO_HEIGHT_TRANSITION}
          onAnimationComplete={onAnimationComplete}
        >
          <div ref={autoHeightRef}>
            {/* Sign-in, then the app. Nothing stands ahead of the auth gate:
                every request goes through the managed relay, so a session is
                the one thing the palette cannot open without. It renders
                INSIDE the auto-height probe so the native window grows to fit
                the card like any other panel — an out-of-flow overlay would be
                cropped to whatever height the composer happened to need. */}
            {authRequired ? (
              <div className="ig-body ig-body--center">
                <MotionConfig reducedMotion="user">
                  <motion.div
                    className="ig-auth"
                    variants={AUTH_STAGGER}
                    initial="hidden"
                    animate="show"
                  >
                    <motion.header className="ig-auth__head" variants={AUTH_RISE}>
                      <h2 className="ig-auth__title">
                        Your prompts, one hotkey away.
                      </h2>
                      <p className="ig-auth__sub">
                        Start your 7-day free trial (50 credits). No credit
                        card required.
                      </p>
                    </motion.header>
                    {/* Trust bullets — compact echo of the website login's
                        brand pane (tick-circle icons in cobalt tile washes). */}
                    <motion.ul className="ig-auth__trust" variants={AUTH_RISE}>
                      <li>
                        <span className="ig-auth__tick" aria-hidden="true">
                          <i className="fa-solid fa-circle-check" />
                        </span>
                        No password to remember
                      </li>
                      <li>
                        <span className="ig-auth__tick" aria-hidden="true">
                          <i className="fa-solid fa-circle-check" />
                        </span>
                        7-day free trial included
                      </li>
                      <li>
                        <span className="ig-auth__tick" aria-hidden="true">
                          <i className="fa-solid fa-circle-check" />
                        </span>
                        Syncs with your InsertGo.AI account
                      </li>
                    </motion.ul>
                    <motion.div variants={AUTH_RISE}>
                      <AuthPanel />
                    </motion.div>
                  </motion.div>
                </MotionConfig>
              </div>
            ) : (
              <>
                {panel === "composer" && (
                  <TabPanel idBase="ig-view" id="composer" className="ig-tabpanel--view">
                    <PromptPalette editorRef={editorRef} />
                  </TabPanel>
                )}
                {panel === "settings" && (
                  <TabPanel idBase="ig-view" id="settings" className="ig-tabpanel--view">
                    <SettingsPanel />
                  </TabPanel>
                )}
                {panel === "profile" && (
                  <TabPanel idBase="ig-view" id="profile" className="ig-tabpanel--view">
                    <ProfilePanel />
                  </TabPanel>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
      <UpgradeModal />
      <PlanUpgradeModal />
      <Toaster />
    </div>
  );
}
