//! The in-situ selection skill bar: a second, NON-ACTIVATING webview window
//! that floats above a text selection in an external app and replaces that
//! selection in place (SPEC §4.1 extension).
//!
//! Physically separate from the palette: its own label, its own managed
//! state (`SelectionTarget`), its own command. `PriorWindow`,
//! `toggle_palette` and `insert_text` are untouched — the palette is a
//! focus-stealing overlay, this window must NEVER take focus, or the target
//! app would collapse the very selection the bar is about to replace. Two
//! layers enforce that: the window is built `.focusable(false)` /
//! `.focused(false)`, and `WS_EX_NOACTIVATE` is OR-ed into its extended
//! style; it is shown with `SetWindowPos(SWP_NOACTIVATE | SWP_SHOWWINDOW)`.
//!
//! Because the bar never owns focus, the target keeps both foreground and
//! its live selection, so `apply_to_selection` needs no focus restore and no
//! `AttachThreadInput` — it only VERIFIES the target is still foreground
//! (the "never paste into an unverified window" invariant from clipboard.rs)
//! and then pastes over the selection. On any failure the transformed text
//! is left on the clipboard and `selection:fallback` tells the bar UI to say
//! "copied — paste manually".
//!
//! Privacy (SPEC §10): selection/transformed text is never logged.

use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};
use crate::platform::bounds;
use crate::platform::selection::{ScreenRect, SelectionRead};
use crate::SelectionTarget;

pub const SKILLBAR_LABEL: &str = "skillbar";

/// Off-screen "parked" (logically hidden) state. The bar is NEVER `hide()`den:
/// hiding a `transparent(true)` + `decorations(false)` WebView2 window forces a
/// compositor re-realize that white-flashes and lags the next show (Tauri
/// #14515). Instead it is moved off every monitor and moved back — so a plain
/// visibility check can't tell "shown" from "parked". This flag is the source
/// of truth for [`is_point_in_bar`] and the fallback re-show. Starts `true`
/// (the window is parked off-screen at creation to warm the compositor).
static PARKED: AtomicBool = AtomicBool::new(true);
/// Last on-screen anchor, remembered so the fallback notice can un-park the bar
/// back to where it was (parking moved it off-screen).
static LAST_X: AtomicI32 = AtomicI32::new(0);
static LAST_Y: AtomicI32 = AtomicI32::new(0);

/// Logical size of the bar window. Width carries the full toolbar (all ten
/// skill icons in one row, no wrapping); height leaves room below/above the
/// toolbar for the caret that points at the selection. The toolbar sizes to
/// its content and is centered inside this canvas by CSS, so the window
/// itself stays a fixed size and never resizes per selection.
const BAR_LOGICAL_WIDTH: f64 = 800.0;
const BAR_LOGICAL_HEIGHT: f64 = 56.0;

/// Gap between the selection rect and the bar, physical pixels.
const BAR_GAP: i32 = 8;

#[derive(Clone, serde::Serialize)]
struct ShowPayload {
    text: String,
    /// Which side of the selection the bar landed on, so the frontend can point
    /// the caret the right way: `"above"` (caret points down at the selection)
    /// or `"below"` (caret points up).
    placement: &'static str,
}

/// Build the (hidden) skill bar window once at startup. Never focusable:
/// `focusable(false)` maps to `WS_EX_NOACTIVATE` in tao, and
/// [`imp::apply_noactivate`] re-asserts it (plus `WS_EX_TOOLWINDOW`, keeping
/// the bar out of Alt+Tab) directly on the extended style.
pub fn create_skillbar(app: &AppHandle) -> AppResult<()> {
    let window = WebviewWindowBuilder::new(
        app,
        SKILLBAR_LABEL,
        WebviewUrl::App("skillbar.html".into()),
    )
    .title("InsertGo Skillbar")
    .inner_size(BAR_LOGICAL_WIDTH, BAR_LOGICAL_HEIGHT)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .focusable(false)
    .focused(false)
    .visible(false)
    .accept_first_mouse(true)
    .build()?;

    let hwnd = window_hwnd(&window)?;
    imp::apply_noactivate(hwnd);
    bounds::imp::install(hwnd);
    // Realize the transparent surface off-screen now (this runs on the setup/
    // main thread, the window's owner) so the FIRST real show is just an
    // on-screen move, not a compositor re-realize — no white flash (Tauri
    // #14515). PARKED already starts `true`, matching this off-screen state.
    imp::park_offscreen(hwnd);
    Ok(())
}

/// Position the bar next to `sel` and show it without activation. Runs the
/// raw `SetWindowPos` on the main thread (the window's owner thread).
pub fn show_at(app: &AppHandle, sel: &SelectionRead) -> AppResult<()> {
    let Some(window) = app.get_webview_window(SKILLBAR_LABEL) else {
        return Ok(());
    };

    app.state::<SelectionTarget>().set(Some(sel.source_hwnd));

    // Anchor: the selection rect when UIA produced one, else a zero-sized
    // rect at the cursor (the clipboard-fallback path).
    let anchor = sel
        .rect
        .or_else(|| {
            imp::cursor_pos().map(|(x, y)| ScreenRect { x, y, w: 0, h: 0 })
        })
        .unwrap_or(ScreenRect {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        });

    let bar = window.outer_size()?;
    let work = imp::work_area(anchor.x, anchor.y).unwrap_or(ScreenRect {
        x: 0,
        y: 0,
        w: i32::MAX,
        h: i32::MAX,
    });
    let (x, y) = bar_position(anchor, bar.width as i32, bar.height as i32, work);

    // The bar sits above the selection unless placement flipped it below (near
    // the top of the work area) — decides which way the caret points.
    let placement = if y < anchor.y { "above" } else { "below" };

    // Text first, position+show second, so the bar never flashes stale
    // content: the webview already holds the new selection when it appears.
    app.emit_to(
        SKILLBAR_LABEL,
        "selection:show",
        ShowPayload {
            text: sel.text.clone(),
            placement,
        },
    )?;

    // Remember the anchor and mark on-screen BEFORE the async move dispatches,
    // so the fallback re-show knows where to un-park to and `is_point_in_bar`
    // stops treating the bar as hidden.
    LAST_X.store(x, Ordering::Relaxed);
    LAST_Y.store(y, Ordering::Relaxed);
    PARKED.store(false, Ordering::Relaxed);

    let hwnd = window_hwnd(&window)?;
    app.run_on_main_thread(move || imp::show_no_activate_at(hwnd, x, y))
        .map_err(|e| AppError::Os(format!("main-thread dispatch: {e}")))?;
    Ok(())
}

/// `true` when the (physical, screen-space) point lies inside the visible
/// bar. The selection watcher uses this to ignore click gestures on the bar
/// itself — otherwise the click that starts a skill run would immediately
/// re-check the (now unreadable) selection and tear the bar down mid-run.
pub fn is_point_in_bar(app: &AppHandle, x: i32, y: i32) -> bool {
    // Parked ⇒ logically hidden (the window is still realized, just off-screen,
    // so `is_visible()` can't be used to decide this).
    if PARKED.load(Ordering::Relaxed) {
        return false;
    }
    let Some(window) = app.get_webview_window(SKILLBAR_LABEL) else {
        return false;
    };
    let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) else {
        return false;
    };
    x >= pos.x
        && x < pos.x + size.width as i32
        && y >= pos.y
        && y < pos.y + size.height as i32
}

/// Hide the bar and drop the paste target. Emits `selection:hide` so the bar
/// UI resets (and aborts any in-flight provider run).
pub fn hide_skillbar(app: &AppHandle) {
    // Flag first (synchronously) so `is_point_in_bar` reports hidden at once,
    // even before the off-screen move dispatches.
    PARKED.store(true, Ordering::Relaxed);
    if let Some(window) = app.get_webview_window(SKILLBAR_LABEL) {
        if let Ok(hwnd) = window_hwnd(&window) {
            // Park off-screen instead of `window.hide()`: keeps the window
            // realized (no re-realize flash on the next show, Tauri #14515);
            // SWP_NOACTIVATE keeps the target's focus + live selection.
            let _ = app.run_on_main_thread(move || imp::park_offscreen(hwnd));
        }
    }
    app.state::<SelectionTarget>().set(None);
    let _ = app.emit_to(SKILLBAR_LABEL, "selection:hide", ());
}

/// Frontend-invoked hide (Esc in the bar, fallback-notice timeout).
#[tauri::command]
pub async fn hide_selection_bar(app: AppHandle) -> AppResult<()> {
    hide_skillbar(&app);
    Ok(())
}

/// Last on-screen bar anchor, for positioning the selection review floater
/// next to the selection the user acted on.
pub(crate) fn last_bar_anchor() -> (i32, i32) {
    (LAST_X.load(Ordering::Relaxed), LAST_Y.load(Ordering::Relaxed))
}

/// Payload of `selection:review` — the skill the bar chose plus the selected
/// text, handed to the selection review floater window (`selfloater`).
/// `icon` is the bar's resolved FA class, forwarded so the floater never
/// re-derives it (the icon maps live per-window by design). A `None` skill is
/// the bar's "More" handoff: the floater opens in its skill-picker state and
/// the run starts only when the user picks a skill there.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewPayload {
    skill_id: Option<String>,
    icon: Option<String>,
    text: String,
}

/// Hand a selection-bar click over. With a `skill_id` the dedicated selection
/// review floater runs it immediately; with `None` (the bar's "More" button)
/// the MAIN PALETTE opens instead, its editor pre-filled with the selection —
/// the full palette is the working surface for an unscoped selection. The
/// paste-back target moves from `SelectionTarget` to `PriorWindow` — both
/// destinations Apply/Insert through the shared insert pipeline (hide →
/// refocus → paste → `insert:fallback` on failure).
#[tauri::command]
pub async fn open_selection_review(
    app: AppHandle,
    skill_id: Option<String>,
    icon: Option<String>,
    text: String,
) -> AppResult<()> {
    use crate::platform::foreground;
    use crate::platform::selection_floater::{self, SELFLOATER_LABEL};
    use crate::PriorWindow;

    // Retract the bar first (clears SelectionTarget — ownership of the paste
    // target moves to PriorWindow below). The bar never held focus, so the
    // target app is still foreground after this.
    hide_skillbar(&app);

    if skill_id.is_none() {
        // "More": stage the text in the palette's always-mounted listener,
        // then show. show_palette captures PriorWindow itself before taking
        // focus (window.rs invariant).
        app.emit_to(
            crate::platform::window::PALETTE_LABEL,
            "palette:set_text",
            text,
        )?;
        crate::platform::window::show_palette(&app)?;
        return Ok(());
    }

    // INVARIANT (window.rs): capture the injection target BEFORE the floater
    // takes focus — afterwards InsertGo itself is the foreground window.
    app.state::<PriorWindow>().set(foreground::capture());

    // Payload before show: the floater webview lives (hidden) from startup,
    // so its always-mounted listener has the review staged before any paint.
    app.emit_to(
        SELFLOATER_LABEL,
        "selection:review",
        ReviewPayload {
            skill_id,
            icon,
            text,
        },
    )?;

    selection_floater::show_selection_floater(&app)?;
    Ok(())
}

/// Paste `text` over the live selection in the window captured at bar-show
/// time. The bar never took focus, so the target still owns both foreground
/// and the selection — no refocus, no `AttachThreadInput` (those belong to
/// the palette's `insert_text` and stay there).
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn apply_to_selection(app: AppHandle, text: String) -> AppResult<()> {
    use crate::platform::{clipboard, foreground};
    use std::time::Duration;
    use tauri_plugin_clipboard_manager::ClipboardExt;

    let target = app.state::<SelectionTarget>().get();

    // Park first: the bar overlaps the selection area and must be gone before
    // the paste lands. Parking off-screen (not `hide()`) avoids the re-realize
    // flash on any later show and, being non-activating, leaves the target's
    // focus + live selection intact. The 30 ms settle lets the queued
    // main-thread move run before the paste.
    PARKED.store(true, Ordering::Relaxed);
    if let Some(window) = app.get_webview_window(SKILLBAR_LABEL) {
        if let Ok(hwnd) = window_hwnd(&window) {
            let _ = app.run_on_main_thread(move || imp::park_offscreen(hwnd));
        }
    }
    std::thread::sleep(Duration::from_millis(30));

    let Some(hwnd) = target else {
        return fallback(&app, text, "no selection target captured");
    };
    // Never paste into an unverified window (clipboard.rs invariant). The
    // bar being non-activating means the target *should* still be foreground;
    // if the user switched apps meanwhile, deliver via clipboard instead.
    if foreground::capture() != Some(hwnd) {
        return fallback(&app, text, "selection target no longer foreground");
    }

    // Cache the user's clipboard so it can be restored after the paste.
    // Best-effort: a non-text or empty clipboard simply won't be restored.
    let original = app.clipboard().read_text().ok();

    app.clipboard()
        .write_text(text.clone())
        .map_err(|e| AppError::Os(format!("clipboard write: {e}")))?;

    if let Err(e) = clipboard::send_paste_chord() {
        // Typical cause: UIPI blocking SendInput into an elevated window.
        return fallback(&app, text, &format!("paste chord failed: {e}"));
    }

    // Let the target consume the paste before swapping the clipboard back —
    // a restore that lands first races the target's OpenClipboard and
    // silently drops the paste (same tuning as insert_text).
    std::thread::sleep(Duration::from_millis(400));
    if let Some(original) = original {
        if let Err(e) = app.clipboard().write_text(original) {
            log::error!("apply_to_selection: restoring original clipboard failed: {e}");
        }
    }

    app.state::<SelectionTarget>().set(None);
    let _ = app.emit_to(SKILLBAR_LABEL, "selection:hide", ());
    Ok(())
}

/// Non-Windows: stage the text on the clipboard for manual paste, mirroring
/// `insert_text`'s v1 behavior.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn apply_to_selection(app: AppHandle, text: String) -> AppResult<()> {
    fallback(&app, text, "selection paste is Windows-only")
}

/// Abort the paste but keep the deliverable: leave `text` on the clipboard,
/// re-show the bar without activation (so the notice is visible), and emit
/// `selection:fallback` for the "copied — paste manually" affordance.
fn fallback(app: &AppHandle, text: String, reason: &str) -> AppResult<()> {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    log::warn!("apply_to_selection fallback (result left on clipboard): {reason}");
    app.clipboard()
        .write_text(text)
        .map_err(|e| AppError::Os(format!("clipboard write: {e}")))?;

    // Un-park back to the last on-screen anchor (the apply parked the bar
    // off-screen; a plain re-show would leave it there) so the notice is seen.
    let (x, y) = (LAST_X.load(Ordering::Relaxed), LAST_Y.load(Ordering::Relaxed));
    PARKED.store(false, Ordering::Relaxed);
    if let Some(window) = app.get_webview_window(SKILLBAR_LABEL) {
        if let Ok(hwnd) = window_hwnd(&window) {
            let _ = app.run_on_main_thread(move || imp::show_no_activate_at(hwnd, x, y));
        }
    }
    let _ = app.emit_to(SKILLBAR_LABEL, "selection:fallback", ());
    Ok(())
}

/// Raw HWND of a webview window as `isize` (the `HWND: !Send` convention).
#[cfg(target_os = "windows")]
fn window_hwnd(window: &tauri::WebviewWindow) -> AppResult<isize> {
    Ok(window.hwnd()?.0 as isize)
}

#[cfg(not(target_os = "windows"))]
fn window_hwnd(_window: &tauri::WebviewWindow) -> AppResult<isize> {
    Ok(0)
}

/// Pure placement math (unit-tested): center the bar horizontally on the
/// anchor, prefer just above it, flip below when the top would leave the
/// work area, and clamp fully inside the work area.
pub fn bar_position(anchor: ScreenRect, bar_w: i32, bar_h: i32, work: ScreenRect) -> (i32, i32) {
    let x = anchor.x + anchor.w / 2 - bar_w / 2;

    let above = anchor.y - bar_h - BAR_GAP;
    let y = if above < work.y {
        anchor.y + anchor.h + BAR_GAP
    } else {
        above
    };
    bounds::clamp_to_work(x, y, bar_w, bar_h, work)
}

// pub(crate): the Improve progress chip (platform::improve) reuses these
// no-activate show/position helpers instead of duplicating the unsafe.
#[cfg(target_os = "windows")]
pub(crate) mod imp {
    use super::ScreenRect;
    use windows::Win32::Foundation::{HWND, POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetCursorPos, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
        HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW,
    };

    /// Off-screen slot for a parked window. Windows' canonical "hidden but
    /// realized" position — safely off every monitor.
    const PARK_COORD: i32 = -32000;

    /// Rebuild an `HWND` from its raw `isize` (see `foreground::to_hwnd`).
    fn to_hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    /// OR `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW` into the extended style so
    /// the bar can never be activated by a click and stays out of Alt+Tab.
    /// Belt-and-braces on top of tao's `focusable(false)`.
    ///
    /// ACCESSIBILITY TRADEOFF (SPEC §10 / a11y): a `WS_EX_NOACTIVATE` window
    /// cannot own keyboard focus without stealing it from the target — which
    /// would collapse the very selection the bar exists to act on. So the bar
    /// is deliberately pointer-first and makes NO in-bar keyboard/AT focus
    /// promise (its DOM `role="toolbar"`/`aria-label`/high-contrast styles serve
    /// pointer + screen-reader *labelling*, not focus traversal). Keyboard and
    /// AT users run the same skills on the current selection through the
    /// focus-capable palette (its global hotkey), which is the honest
    /// keyboard/AT path. Do not "fix" this by making the bar activatable.
    pub fn apply_noactivate(hwnd_raw: isize) {
        if hwnd_raw == 0 {
            return;
        }
        let hwnd = to_hwnd(hwnd_raw);
        // SAFETY: hwnd is our own freshly built window; Get/SetWindowLongPtrW
        // fail benignly (return 0) on an invalid handle.
        unsafe {
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let wanted = ex | (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) as isize;
            if wanted != ex {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted);
            }
        }
    }

    /// Move the bar to `(x, y)` (physical) and show it WITHOUT activation.
    /// Must run on the window's owner (main) thread.
    pub fn show_no_activate_at(hwnd_raw: isize, x: i32, y: i32) {
        if hwnd_raw == 0 {
            return;
        }
        crate::platform::bounds::imp::set_suppressed(hwnd_raw, false);
        // SAFETY: hwnd is our own window; SetWindowPos on a stale handle
        // fails benignly. SWP_NOACTIVATE keeps the target app's focus (and
        // therefore its live selection) untouched.
        unsafe {
            let _ = SetWindowPos(
                to_hwnd(hwnd_raw),
                Some(HWND_TOPMOST),
                x,
                y,
                0,
                0,
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSIZE,
            );
        }
    }

    /// Move the bar fully off every monitor WITHOUT activation or resize,
    /// keeping it realized (composited). This is how the bar "hides": a later
    /// on-screen move is then just a move, never a WebView2 re-realize, so
    /// there is no white flash (Tauri #14515). Must run on the owner (main)
    /// thread. SWP_SHOWWINDOW realizes the surface off-screen on the first
    /// (startup) park so subsequent shows are flash-free.
    pub fn park_offscreen(hwnd_raw: isize) {
        if hwnd_raw == 0 {
            return;
        }
        crate::platform::bounds::imp::set_suppressed(hwnd_raw, true);
        // SAFETY: hwnd is our own window; SetWindowPos on a stale handle fails
        // benignly. SWP_NOACTIVATE keeps the target app's focus (and therefore
        // its live selection) untouched while the bar leaves the screen.
        unsafe {
            let _ = SetWindowPos(
                to_hwnd(hwnd_raw),
                Some(HWND_TOPMOST),
                PARK_COORD,
                PARK_COORD,
                0,
                0,
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSIZE,
            );
        }
    }

    /// Current cursor position, physical pixels.
    pub fn cursor_pos() -> Option<(i32, i32)> {
        let mut pt = POINT::default();
        // SAFETY: pt is a valid out-pointer for the duration of the call.
        unsafe { GetCursorPos(&mut pt).ok()? };
        Some((pt.x, pt.y))
    }

    /// Work area (screen minus taskbar) of the monitor nearest to `(x, y)`.
    pub fn work_area(x: i32, y: i32) -> Option<ScreenRect> {
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        // SAFETY: MonitorFromPoint(NEAREST) always yields a valid monitor
        // handle; info.cbSize is set as GetMonitorInfoW requires.
        unsafe {
            let monitor = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
            if !GetMonitorInfoW(monitor, &mut info).as_bool() {
                return None;
            }
        }
        let RECT {
            left,
            top,
            right,
            bottom,
        } = info.rcWork;
        Some(ScreenRect {
            x: left,
            y: top,
            w: right - left,
            h: bottom - top,
        })
    }
}

/// Non-Windows stubs: the watcher never installs, so these are never hit in
/// practice; they keep the module cross-compilable (SPEC §2.1).
#[cfg(not(target_os = "windows"))]
pub(crate) mod imp {
    use super::ScreenRect;

    pub fn apply_noactivate(_hwnd_raw: isize) {}

    pub fn show_no_activate_at(_hwnd_raw: isize, _x: i32, _y: i32) {}

    pub fn park_offscreen(_hwnd_raw: isize) {}

    pub fn cursor_pos() -> Option<(i32, i32)> {
        None
    }

    pub fn work_area(_x: i32, _y: i32) -> Option<ScreenRect> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: ScreenRect = ScreenRect {
        x: 0,
        y: 0,
        w: 1920,
        h: 1040, // 1080 minus a 40px taskbar
    };
    const BAR_W: i32 = 372;
    const BAR_H: i32 = 46;

    #[test]
    fn bar_sits_centered_above_the_selection() {
        let anchor = ScreenRect {
            x: 800,
            y: 500,
            w: 200,
            h: 20,
        };
        let (x, y) = bar_position(anchor, BAR_W, BAR_H, WORK);
        assert_eq!(x, 800 + 100 - BAR_W / 2);
        assert_eq!(y, 500 - BAR_H - BAR_GAP);
    }

    #[test]
    fn bar_flips_below_when_selection_touches_the_top() {
        let anchor = ScreenRect {
            x: 800,
            y: 10,
            w: 200,
            h: 20,
        };
        let (_, y) = bar_position(anchor, BAR_W, BAR_H, WORK);
        assert_eq!(y, 10 + 20 + BAR_GAP);
    }

    #[test]
    fn bar_clamps_inside_the_work_area_horizontally() {
        let left = ScreenRect {
            x: -50,
            y: 500,
            w: 10,
            h: 20,
        };
        assert_eq!(bar_position(left, BAR_W, BAR_H, WORK).0, WORK.x);

        let right = ScreenRect {
            x: 1900,
            y: 500,
            w: 10,
            h: 20,
        };
        assert_eq!(
            bar_position(right, BAR_W, BAR_H, WORK).0,
            WORK.x + WORK.w - BAR_W
        );
    }

    #[test]
    fn bar_clamps_to_the_work_area_bottom() {
        // Selection at the very bottom, near the top of nothing: flipping
        // below would leave the work area, so the y is clamped back inside.
        let anchor = ScreenRect {
            x: 800,
            y: 20,
            w: 200,
            h: 2000,
        };
        let (_, y) = bar_position(anchor, BAR_W, BAR_H, WORK);
        assert_eq!(y, WORK.y + WORK.h - BAR_H);
    }

    #[test]
    fn degenerate_work_area_never_panics() {
        let anchor = ScreenRect {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
        let tiny = ScreenRect {
            x: 0,
            y: 0,
            w: 10,
            h: 10,
        };
        let (x, y) = bar_position(anchor, BAR_W, BAR_H, tiny);
        assert_eq!((x, y), (0, 0));
    }
}
