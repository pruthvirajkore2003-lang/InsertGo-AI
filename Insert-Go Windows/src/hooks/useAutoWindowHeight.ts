/**
 * Dynamic window cropping, sequenced hybrid edition: the DOM animates the
 * VISIBLE height (framer-motion, premium ease) while the native window only
 * ever jumps between settled bounds — never per-frame (continuous setSize
 * under DWM acrylic makes the compositor re-blur every frame and jitters).
 *
 * Sequencing rules (the whole point):
 *  - EXPAND: grow the native window FIRST (the extra transparent area is
 *    already there to contain the animation), THEN animate the DOM open.
 *  - SHRINK: animate the DOM closed FIRST, and only when the consumer's
 *    motion.div fires onAnimationComplete shrink the native window — so the
 *    leftover transparent strip never outlives the animation and can't sit
 *    around intercepting clicks.
 *
 * Measurement (unchanged from v1): a ResizeObserver watches an UNCONSTRAINED
 * content probe for the content's natural height. It additionally watches the
 * viewport cell, because sibling "chrome" (the floater's thinking/chips rows)
 * grows by squeezing the flexed viewport box without touching the probe.
 * chrome = chromeBox.offsetHeight − viewport.clientHeight, where chromeBox is
 * the viewport's parent (main: .ig-panel, auto-height = header + viewport;
 * floater: the card, controlled = fixed rows + screen) — the difference is
 * the non-viewport UI at every phase of the animation, so it is always valid.
 *
 * Two consumption modes:
 *  - inset viewport (App.tsx): animate motion.div height to `viewportHeight`
 *    (window minus chrome) — the panel above it stays auto-height.
 *  - edge-to-edge surface (selfloater card): animate the card itself to
 *    `windowHeight` — the card IS the window surface, chrome lives inside it.
 *
 * Loop-safety is structural: only the height is written, the width never
 * changes, so no rewrap → the probe's height is independent of the resize.
 * Known cosmetic tradeoff: while a sequence is in flight the window area not
 * covered by DOM shows as a bare acrylic strip (DWM paints the whole window
 * rect); it exists for at most one 300ms animation leg.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Transition } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isTauri,
  resizeWithinWorkArea,
} from "@/services/tauriBridge";
import { isManipulatingWindow } from "@/services/windowChrome";

export const MIN_HEIGHT = 200;
export const MAX_HEIGHT = 800;
/** Ignore deltas at or below this (px) — kills sub-pixel/rounding churn. */
const THRESHOLD_PX = 4;
const DEBOUNCE_MS = 60;
/** Pure trailing debounce starves under continuous growth (a streaming
 *  response mutates faster than the debounce); force an apply this often. */
const MAX_WAIT_MS = 250;
/** Back-off after a native resize we did not initiate. Needed on top of
 *  isManipulatingWindow(): the focus-regain fired at manual drag START
 *  clears that flag (useHotkey), so mid-drag it can already read false. */
const MANUAL_HOLDOFF_MS = 400;
/** Owner-thread SetWindowPos may emit after invoke resolves. */
const AUTO_RESIZE_ECHO_MS = 200;

/** The one height transition every consumer wires to its motion.div. */
export const AUTO_HEIGHT_TRANSITION: Transition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
};

/** getCurrentWindow throws where the Tauri internals are absent (jsdom tests
 *  that mock isTauri() true) — treat that as "no window", like !isTauri. */
function tauriWindow(): ReturnType<typeof getCurrentWindow> | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/** Window height for a given content height + non-viewport chrome, clamped. */
export function computeTargetHeight(
  contentPx: number,
  chromePx: number,
  min: number = MIN_HEIGHT,
  max: number = MAX_HEIGHT
): number {
  return Math.min(max, Math.max(min, Math.ceil(contentPx + chromePx)));
}

export type AutoWindowHeight = {
  /** Clamped target OS-window height (logical px). Animate an edge-to-edge
   *  surface (the selfloater card) to this. Null until the first measure —
   *  render natural CSS height then. */
  windowHeight: number | null;
  /** windowHeight minus measured chrome. Animate an inset viewport
   *  (App.tsx's .ig-autoheight) to this. */
  viewportHeight: number | null;
  /** Wire to the SAME motion.div's onAnimationComplete — it performs the
   *  deferred native shrink of the shrink sequence. */
  onAnimationComplete: () => void;
};

/**
 * @param contentRef unconstrained probe whose height IS the content's natural
 *   height (inside the scroll viewport, never clipped by it).
 * @param viewportRef the scroll cell the probe lives in; its parentElement is
 *   measured as the chrome box (see file comment).
 * @param opts.resetKey change it when the measured DOM is swapped out (the
 *   floater remounts a different card per mode) so observers re-attach.
 */
export function useAutoWindowHeight(
  contentRef: RefObject<HTMLElement>,
  viewportRef: RefObject<HTMLElement>,
  opts: { min?: number; max?: number; resetKey?: unknown } = {}
): AutoWindowHeight {
  const { min = MIN_HEIGHT, max = MAX_HEIGHT, resetKey } = opts;
  const [heights, setHeights] = useState<{ win: number; vp: number } | null>(
    null
  );
  const heightsRef = useRef(heights);
  /** Non-null = a shrink sequence is waiting for its DOM leg to finish. */
  const pendingShrinkRef = useRef<number | null>(null);
  const applyingRef = useRef(false);
  const autoResizeEchoUntilRef = useRef(0);
  const manualUntilRef = useRef(0);
  /** True after a manual edge-drag: the user's size stands until the CONTENT
   *  itself changes (v1 semantics — auto-crop never fights the user). */
  const manualOverrideRef = useRef(false);

  const setSizeSafe = useCallback((to: number) => {
    if (!tauriWindow()) return Promise.resolve();
    applyingRef.current = true;
    return resizeWithinWorkArea(to)
      .catch(() => {
        // window torn down mid-flight — nothing to fix
      })
      .finally(() => {
        autoResizeEchoUntilRef.current = Date.now() + AUTO_RESIZE_ECHO_MS;
        applyingRef.current = false;
      });
  }, []);

  const onAnimationComplete = useCallback(() => {
    const to = pendingShrinkRef.current;
    if (to == null) return; // expand legs (and unrelated animations) end here
    pendingShrinkRef.current = null;
    void setSizeSafe(to);
  }, [setSizeSafe]);

  useEffect(() => {
    // Fresh measurement session (mount / resetKey swap): drop the previous
    // session's targets so the next card renders its natural height until
    // the first measure — otherwise a re-opened floater animates from the
    // old card's grown height and opens full-size instead of small.
    heightsRef.current = null;
    setHeights(null);
    pendingShrinkRef.current = null;
    if (!isTauri()) return;
    const appWindow = tauriWindow();
    const content = contentRef.current;
    const viewport = viewportRef.current;
    const chromeBox = viewport?.parentElement;
    if (!appWindow || !content || !viewport || !chromeBox) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastApply = 0;
    let disposed = false;

    const setTargets = (win: number, vp: number) => {
      const next = { win, vp };
      heightsRef.current = next;
      setHeights((prev) =>
        prev && prev.win === win && prev.vp === vp ? prev : next
      );
    };

    const apply = async () => {
      const chrome = chromeBox.offsetHeight - viewport.clientHeight;
      const target = computeTargetHeight(content.offsetHeight, chrome, min, max);
      const vp = Math.max(0, target - chrome);
      const win = window.innerHeight;
      if (target > win + THRESHOLD_PX) {
        // EXPAND: native window first, DOM opens into the new space.
        pendingShrinkRef.current = null;
        lastApply = Date.now();
        await setSizeSafe(target);
        if (!disposed) setTargets(target, vp);
      } else if (target < win - THRESHOLD_PX) {
        // SHRINK: DOM first; the native shrink waits in pendingShrinkRef for
        // the consumer's onAnimationComplete.
        lastApply = Date.now();
        const h = heightsRef.current;
        if (h && h.win === target && h.vp === vp) {
          // DOM is already closed (e.g. a prior deferred setSize failed), so
          // no animation — and no completion callback — will run: shrink now.
          pendingShrinkRef.current = null;
          await setSizeSafe(target);
        } else {
          pendingShrinkRef.current = target;
          setTargets(target, vp);
        }
      } else {
        // Window already right. Cancel any stale deferred shrink (a shrink
        // superseded by re-growth before its DOM leg finished — letting it
        // fire would cut the window below the regrown content) and retarget
        // the DOM back to the window.
        pendingShrinkRef.current = null;
        setTargets(target, vp);
      }
    };

    const schedule = () => {
      if (disposed) return;
      const now = Date.now();
      const guarded = isManipulatingWindow() || now < manualUntilRef.current;
      const overdue = now - lastApply >= MAX_WAIT_MS;
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          // Guards may have flipped during the wait — recheck, and retry
          // later instead of dropping the resize.
          if (isManipulatingWindow() || Date.now() < manualUntilRef.current) {
            schedule();
          } else {
            void apply();
          }
        },
        guarded ? MANUAL_HOLDOFF_MS : overdue ? 0 : DEBOUNCE_MS
      );
    };

    // The viewport box also re-fires during our own DOM animation; those
    // schedules land on an already-correct target and no-op at the threshold.
    let lastContentH = content.offsetHeight;
    const ro = new ResizeObserver(() => {
      const ch = content.offsetHeight;
      if (ch !== lastContentH) {
        lastContentH = ch;
        manualOverrideRef.current = false; // content moved — auto resumes
      }
      if (manualOverrideRef.current) return; // user-chosen size stands
      schedule();
    });
    ro.observe(content);
    ro.observe(viewport);
    schedule(); // initial fit

    // A resize this hook didn't initiate = the user (or OS) drives the
    // window: sync the DOM to it (the motion.div chases smoothly), drop any
    // deferred shrink, and hold auto-crop off until the content changes. A
    // late echo of our own resize command is ignored by the grace window.
    const unlisten = appWindow.onResized(() => {
      if (
        applyingRef.current ||
        Date.now() < autoResizeEchoUntilRef.current
      )
        return;
      manualUntilRef.current = Date.now() + MANUAL_HOLDOFF_MS;
      manualOverrideRef.current = true;
      pendingShrinkRef.current = null;
      const chrome = chromeBox.offsetHeight - viewport.clientHeight;
      setTargets(window.innerHeight, Math.max(0, window.innerHeight - chrome));
    });

    return () => {
      disposed = true;
      ro.disconnect();
      clearTimeout(timer);
      void unlisten.then((u) => u());
    };
  }, [contentRef, viewportRef, min, max, resetKey, setSizeSafe]);

  return {
    windowHeight: heights?.win ?? null,
    viewportHeight: heights?.vp ?? null,
    onAnimationComplete,
  };
}
