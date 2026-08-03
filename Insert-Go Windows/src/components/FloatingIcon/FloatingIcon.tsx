/**
 * FloatingIcon — the persistent, always-on-top launcher bubble rendered in
 * the `floating-icon` window (main.tsx routes here by window label).
 *
 * One 64px surface must both drag and click, which rules out a bare
 * `data-tauri-drag-region`: on Windows the injected handler enters the
 * native move loop on mousedown, that loop swallows the matching mouseup,
 * and a no-move press never produces a DOM `click`. So this uses the same
 * `startDragging()` API the attribute calls — but only once the cursor
 * travels past a small threshold; a release below it is treated as a click
 * (same manual-drag pattern as the palette header in App.tsx).
 *
 * The context menu is a native `Menu.popup()` — a DOM menu can't fit inside
 * a 64×64 window.
 */
import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Menu, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { isTauri } from "@/services/tauriBridge";
import "./floatingIcon.css";

const DRAG_THRESHOLD_PX = 4;

/** Show + focus the main palette window (it hides on blur, never closes). */
async function openMain(): Promise<void> {
  if (!isTauri()) return;
  const main = await WebviewWindow.getByLabel("main");
  if (!main) return;
  await main.show();
  await main.unminimize();
  await main.setFocus();
}

async function popupMenu(): Promise<void> {
  if (!isTauri()) return;
  const menu = await Menu.new({
    items: [
      { id: "open", text: "Open InsertGo", action: () => void openMain() },
      await PredefinedMenuItem.new({ item: "Separator" }),
      {
        id: "hide-icon",
        text: "Hide icon",
        action: () => void getCurrentWindow().hide(),
      },
      await PredefinedMenuItem.new({ item: "Quit", text: "Quit InsertGo" }),
    ],
  });
  await menu.popup();
}

export function FloatingIcon() {
  const press = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) press.current = { x: e.screenX, y: e.screenY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const p = press.current;
    if (!p || (e.buttons & 1) === 0) return;
    if (
      Math.abs(e.screenX - p.x) > DRAG_THRESHOLD_PX ||
      Math.abs(e.screenY - p.y) > DRAG_THRESHOLD_PX
    ) {
      // The native move loop takes over from here — no further DOM events
      // arrive until release, so the click branch below can't also fire.
      press.current = null;
      if (isTauri()) void getCurrentWindow().startDragging();
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const wasPress = press.current !== null;
    press.current = null;
    if (e.button === 0 && wasPress) void openMain();
  }, []);

  return (
    <div
      className="ig-float"
      role="button"
      tabIndex={0}
      aria-label="Open InsertGo"
      title="InsertGo — click to open, drag to move, right-click for menu"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") void openMain();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        void popupMenu();
      }}
    >
      {/* Animation lives on the inner visual only — the outer shell owns the
          pointer handlers and must not transform (its geometry is what the
          drag-threshold math and the OS window bounds see). whileTap can be
          left "pressed" if startDragging() steals the pointerup; framer
          resets the gesture on the next pointer enter/leave/down, so it
          self-heals the moment the cursor moves. */}
      <motion.div
        className="ig-float__inner"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
      >
        <img
          className="ig-float__logo"
          src="/main-logo.png"
          alt=""
          draggable={false}
        />
      </motion.div>
    </div>
  );
}
