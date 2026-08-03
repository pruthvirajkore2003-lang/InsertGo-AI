//! Screen-bounds enforcement for the floating windows (skill bar, selection
//! review floater): no InsertGo window may sit outside its monitor's WORK
//! area (`MONITORINFO.rcWork` — screen minus taskbar/dock), whatever moved
//! it. Four failure paths are covered:
//!
//! 1. INITIAL SHOW — `skillbar_window::bar_position` and
//!    `selection_floater::show_selection_floater` clamp with
//!    [`clamp_to_work`] before the window appears.
//! 2. STREAMING HEIGHT GROWTH — `useAutoWindowHeight` resizes through the
//!    [`resize_within_work_area`] command, which shifts the window up in the
//!    SAME atomic `SetWindowPos` when the new height would push the bottom
//!    past the work area (no bleed frame, no double-move flicker).
//! 3. USER DRAG — `startWindowDrag` hands the move to DWM; only a WndProc
//!    intercept can bound it, so `imp::install` subclasses the window and
//!    rewrites `WM_WINDOWPOSCHANGING`'s proposed rect before it is applied.
//! 4. TOPOLOGY CHANGE — the same subclass re-clamps the current rect on
//!    `WM_DISPLAYCHANGE` (hotplugged extenders: DisplayLink, Spacedesk,
//!    Sidecar, virtual monitors, resolution changes), `WM_DPICHANGED`
//!    (mixed-DPI moves), and `WM_SETTINGCHANGE(SPI_SETWORKAREA)` (taskbar
//!    moved or auto-hide toggled).
//!
//! The skill bar "hides" by parking at (-32000, -32000) — deliberately off
//! every work area (Tauri #14515) — so `imp::set_suppressed` suspends
//! clamping around park/un-park to keep the two systems from fighting.

use tauri::{AppHandle, LogicalSize};

use crate::error::AppResult;
use crate::platform::selection::ScreenRect;

/// Clamp the outer rect `(x, y, w, h)` (physical px) fully inside `work`.
/// Pure and unit-tested: every position InsertGo computes goes through here.
/// A window larger than the work area pins to its origin (`max` with the
/// work origin keeps the clamp range valid instead of inverting it), and
/// negative monitor origins work because everything is plain i32 math.
pub fn clamp_to_work(x: i32, y: i32, w: i32, h: i32, work: ScreenRect) -> (i32, i32) {
    let max_x = (work.x + work.w - w).max(work.x);
    let max_y = (work.y + work.h - h).max(work.y);
    (x.clamp(work.x, max_x), y.clamp(work.y, max_y))
}

/// Frontend `useAutoWindowHeight` resize entry point (all auto-height windows
/// route here — palette, selection floater). Grows/shrinks the invoking
/// window to logical `height` and, in the SAME `SetWindowPos`, shifts it back
/// inside the work area when the new height would push the bottom past it —
/// atomic, so the card never paints a frame bleeding below the taskbar and
/// there is no multi-frame position jump. Falls back to a plain `set_size`
/// off-Windows or when the monitor lookup fails.
#[tauri::command]
pub async fn resize_within_work_area(
    app: AppHandle,
    window: tauri::WebviewWindow,
    height: f64,
) -> AppResult<()> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let Ok(size) = window.outer_size() else {
        return Ok(());
    };

    #[cfg(target_os = "windows")]
    {
        use crate::platform::skillbar_window::imp as skillbar_imp;

        if let (Ok(pos), Ok(hwnd)) = (window.outer_position(), window.hwnd()) {
            if let Some(work) = skillbar_imp::work_area(pos.x, pos.y) {
                let h = ((height * scale).round() as i32).max(1).min(work.h.max(1));
                let w = size.width as i32;
                let (x, y) = clamp_to_work(pos.x, pos.y, w, h, work);
                let raw = hwnd.0 as isize;
                // Owner (main) thread, same convention as the skill bar's moves.
                app.run_on_main_thread(move || imp::set_pos_and_size(raw, x, y, w, h))
                    .map_err(|e| {
                        crate::error::AppError::Os(format!("main-thread dispatch: {e}"))
                    })?;
                return Ok(());
            }
        }
    }

    let _ = &app; // the Windows path above dispatches through it
    let logical_w = size.width as f64 / scale;
    window.set_size(LogicalSize::new(logical_w, height))?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) mod imp {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromRect, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, SetWindowPos, SPI_SETWORKAREA, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_NOZORDER, WINDOWPOS, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_SETTINGCHANGE,
        WM_WINDOWPOSCHANGING,
    };

    use super::{clamp_to_work, ScreenRect};

    /// hwnd → clamp-suspended flag (the skill bar's off-screen parking must
    /// not be fought). Looked up per message; InsertGo windows live from
    /// setup to process exit, so entries are never removed.
    fn flags() -> &'static Mutex<HashMap<isize, bool>> {
        static FLAGS: OnceLock<Mutex<HashMap<isize, bool>>> = OnceLock::new();
        FLAGS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn to_hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    fn is_suppressed(raw: isize) -> bool {
        flags()
            .lock()
            .map(|m| m.get(&raw).copied().unwrap_or(false))
            .unwrap_or(false)
    }

    /// Suspend/resume bounds clamping for a window. The skill bar sets this
    /// around its off-screen park/un-park; a hwnd that was never `install`ed
    /// is harmless (the entry is simply never read).
    pub fn set_suppressed(hwnd_raw: isize, suppressed: bool) {
        if hwnd_raw == 0 {
            return;
        }
        if let Ok(mut m) = flags().lock() {
            m.insert(hwnd_raw, suppressed);
        }
    }

    /// Subclass the window so drags, programmatic moves and display-topology
    /// changes can never leave it outside a work area. Idempotent per hwnd.
    pub fn install(hwnd_raw: isize) {
        if hwnd_raw == 0 {
            return;
        }
        {
            let Ok(mut m) = flags().lock() else {
                return;
            };
            if m.contains_key(&hwnd_raw) {
                return;
            }
            m.insert(hwnd_raw, false);
        }
        // SAFETY: hwnd is our own window, alive until process exit (no
        // RemoveWindowSubclass needed). dwRefData carries the raw hwnd so the
        // proc can find its suppression flag without captured state.
        let installed = unsafe {
            SetWindowSubclass(
                to_hwnd(hwnd_raw),
                Some(bounds_proc),
                hwnd_raw as usize,
                hwnd_raw as usize,
            )
            .as_bool()
        };
        if !installed {
            if let Ok(mut m) = flags().lock() {
                m.remove(&hwnd_raw);
            }
            log::error!("window bounds subclass install failed");
        }
    }

    /// Atomic position+size write for streaming height growth (the
    /// `resize_within_work_area` command): one SetWindowPos, so the window
    /// never paints a frame half-outside the work area. SWP_NOACTIVATE keeps
    /// focus exactly where the caller left it. Must run on the owner (main)
    /// thread.
    pub fn set_pos_and_size(hwnd_raw: isize, x: i32, y: i32, w: i32, h: i32) {
        if hwnd_raw == 0 {
            return;
        }
        // SAFETY: hwnd is our own window; a stale handle fails benignly.
        unsafe {
            if let Err(e) = SetWindowPos(
                to_hwnd(hwnd_raw),
                None,
                x,
                y,
                w,
                h,
                SWP_NOACTIVATE | SWP_NOZORDER,
            ) {
                log::error!("atomic bounded resize failed: {e}");
            }
        }
    }

    /// Work area of the monitor nearest `rect` (negative origins included).
    fn work_area_for_rect(rect: &RECT) -> Option<ScreenRect> {
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        // SAFETY: MonitorFromRect(NEAREST) always yields a valid monitor
        // handle; info.cbSize is set as GetMonitorInfoW requires.
        unsafe {
            let monitor = MonitorFromRect(rect, MONITOR_DEFAULTTONEAREST);
            if !GetMonitorInfoW(monitor, &mut info).as_bool() {
                return None;
            }
        }
        Some(ScreenRect {
            x: info.rcWork.left,
            y: info.rcWork.top,
            w: info.rcWork.right - info.rcWork.left,
            h: info.rcWork.bottom - info.rcWork.top,
        })
    }

    /// Re-clamp the window's CURRENT rect after a topology change. No-op when
    /// already inside. The corrective SetWindowPos fires its own (already
    /// clamped) WM_WINDOWPOSCHANGING — one recursion level, terminates.
    fn clamp_into_work_area(hwnd: HWND) {
        let mut rc = RECT::default();
        // SAFETY: rc is a valid out-pointer for the duration of the call.
        if unsafe { GetWindowRect(hwnd, &mut rc) }.is_err() {
            return;
        }
        let Some(work) = work_area_for_rect(&rc) else {
            return;
        };
        let (w, h) = (rc.right - rc.left, rc.bottom - rc.top);
        let (x, y) = clamp_to_work(rc.left, rc.top, w, h, work);
        if x == rc.left && y == rc.top {
            return;
        }
        // SAFETY: hwnd is our own window; SWP_NOACTIVATE keeps focus (and
        // the skill bar's live-selection invariant) untouched.
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                None,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
            );
        }
    }

    /// Rewrite a proposed move so the outer rect stays inside the nearest
    /// monitor's work area — the drag clamp. The monitor is resolved from the
    /// PROPOSED rect, so dragging toward another display is bounded by that
    /// display's work area.
    fn clamp_windowpos(hwnd: HWND, pos: &mut WINDOWPOS) {
        let (mut w, mut h) = (pos.cx, pos.cy);
        if pos.flags.contains(SWP_NOSIZE) {
            let mut rc = RECT::default();
            // SAFETY: rc is a valid out-pointer for the duration of the call.
            if unsafe { GetWindowRect(hwnd, &mut rc) }.is_err() {
                return;
            }
            w = rc.right - rc.left;
            h = rc.bottom - rc.top;
        }
        let proposed = RECT {
            left: pos.x,
            top: pos.y,
            right: pos.x + w,
            bottom: pos.y + h,
        };
        let Some(work) = work_area_for_rect(&proposed) else {
            return;
        };
        let (x, y) = clamp_to_work(pos.x, pos.y, w, h, work);
        pos.x = x;
        pos.y = y;
    }

    /// Subclass proc: clamp proposed geometry BEFORE the default proc applies
    /// it (drags and programmatic moves); re-clamp current geometry AFTER
    /// topology messages — the default proc runs first so tao's own DPI
    /// handling wins the size, we only correct the position.
    unsafe extern "system" fn bounds_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _subclass_id: usize,
        ref_data: usize,
    ) -> LRESULT {
        let raw = ref_data as isize;
        match msg {
            WM_WINDOWPOSCHANGING if !is_suppressed(raw) => {
                let pos = &mut *(lparam.0 as *mut WINDOWPOS);
                if !pos.flags.contains(SWP_NOMOVE) {
                    clamp_windowpos(hwnd, pos);
                }
                DefSubclassProc(hwnd, msg, wparam, lparam)
            }
            WM_DISPLAYCHANGE | WM_DPICHANGED => {
                let r = DefSubclassProc(hwnd, msg, wparam, lparam);
                if !is_suppressed(raw) {
                    clamp_into_work_area(hwnd);
                }
                r
            }
            // Taskbar moved/resized or auto-hide toggled: the work area
            // changed without any display change.
            WM_SETTINGCHANGE if wparam.0 as u32 == SPI_SETWORKAREA.0 => {
                let r = DefSubclassProc(hwnd, msg, wparam, lparam);
                if !is_suppressed(raw) {
                    clamp_into_work_area(hwnd);
                }
                r
            }
            _ => DefSubclassProc(hwnd, msg, wparam, lparam),
        }
    }
}

/// Non-Windows stubs: keep the module cross-compilable (SPEC §2.1).
#[cfg(not(target_os = "windows"))]
pub(crate) mod imp {
    pub fn set_suppressed(_hwnd_raw: isize, _suppressed: bool) {}

    pub fn install(_hwnd_raw: isize) {}

    pub fn set_pos_and_size(_hwnd_raw: isize, _x: i32, _y: i32, _w: i32, _h: i32) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 1920x1080 primary at origin with a 40px taskbar.
    const WORK: ScreenRect = ScreenRect {
        x: 0,
        y: 0,
        w: 1920,
        h: 1040,
    };

    #[test]
    fn rect_inside_work_area_is_unchanged() {
        assert_eq!(clamp_to_work(100, 200, 480, 300, WORK), (100, 200));
    }

    #[test]
    fn bottom_overflow_shifts_up() {
        // Streaming growth near the bottom: y stays only when it fits;
        // otherwise the window moves up so its bottom lands on work bottom.
        assert_eq!(clamp_to_work(100, 900, 480, 640, WORK), (100, 400));
    }

    #[test]
    fn growth_that_still_fits_keeps_position() {
        assert_eq!(clamp_to_work(100, 800, 480, 240, WORK), (100, 800));
    }

    #[test]
    fn right_and_top_overflow_clamp_to_edges() {
        assert_eq!(clamp_to_work(1800, -50, 480, 300, WORK), (1440, 0));
    }

    #[test]
    fn negative_origin_monitor_clamps_correctly() {
        // Secondary display left of primary: x in [-1920, 0).
        let left = ScreenRect {
            x: -1920,
            y: 0,
            w: 1920,
            h: 1040,
        };
        assert_eq!(clamp_to_work(-2500, 100, 480, 300, left), (-1920, 100));
        // Right edge of that monitor is x=0: max x = 0 - 480 = -480.
        assert_eq!(clamp_to_work(-100, 100, 480, 300, left), (-480, 100));
    }

    #[test]
    fn negative_origin_above_primary_clamps_correctly() {
        // Secondary display above primary: y in [-1080, 0).
        let above = ScreenRect {
            x: 0,
            y: -1080,
            w: 1920,
            h: 1040,
        };
        assert_eq!(clamp_to_work(50, -1200, 480, 300, above), (50, -1080));
        assert_eq!(clamp_to_work(50, -100, 480, 300, above), (50, -340));
    }

    #[test]
    fn window_larger_than_work_area_pins_to_origin() {
        assert_eq!(clamp_to_work(500, 500, 3000, 2000, WORK), (0, 0));
    }

    #[test]
    fn degenerate_work_area_never_panics() {
        let tiny = ScreenRect {
            x: 10,
            y: 20,
            w: 5,
            h: 5,
        };
        assert_eq!(clamp_to_work(-100, -100, 480, 300, tiny), (10, 20));
    }
}
