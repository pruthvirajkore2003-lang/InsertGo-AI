/**
 * 8 edge/corner hit-targets that drive native window resize via
 * `startResizeDragging`. Needed because borderless windows can't be
 * mouse-resized from their OS edges on Windows (tauri #8519) — these are
 * decorative, `isTauri()`-gated, and no-op outside the Tauri shell.
 */
import { isTauri } from "@/services/tauriBridge";
import { startWindowResize, type ResizeDirection } from "@/services/windowChrome";

const HANDLES: readonly [string, ResizeDirection][] = [
  ["n", "North"],
  ["s", "South"],
  ["e", "East"],
  ["w", "West"],
  ["ne", "NorthEast"],
  ["nw", "NorthWest"],
  ["se", "SouthEast"],
  ["sw", "SouthWest"],
];

export function ResizeHandles() {
  if (!isTauri()) return null;

  return (
    <>
      {HANDLES.map(([pos, dir]) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`ig-resize ig-resize--${pos}`}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            void startWindowResize(dir);
          }}
        />
      ))}
    </>
  );
}
