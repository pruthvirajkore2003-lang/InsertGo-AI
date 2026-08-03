//! Inline In-Place Improve orchestration (SPEC §4.4, §5.6): the Improve
//! hotkey captures the ENTIRE draft from the focused field of the foreground
//! app, hands it to the frontend for the LLM rewrite (provider lanes live in
//! TS), and the frontend writes the result back via `replace_text`. The Undo
//! hotkey restores the snapshot taken at capture time.
//!
//! Deliberate scope (the anti-Wispr-Flow guarantees, SPEC §4.4/§10):
//! - Capture happens ONLY on an explicit hotkey press — no always-on keyboard
//!   hook, no event tap, nothing buffered between presses.
//! - Only the focused element + `process_name`/`window_title` are read for
//!   the adapter lookup — never the target's wider accessibility tree.
//! - Password/PIN fields are refused outright (`FieldRead::is_password`).
//! - Nothing is ever auto-submitted: no synthetic `Enter`, anywhere.
//! - Captured/draft text stays in process memory and is NEVER logged.
//!
//! Progress surfaces through a tiny always-on-top, NON-ACTIVATING chip
//! window (same `WS_EX_NOACTIVATE` machinery as the skill bar): stealing
//! focus would break the focus-restore contract `replace_text` depends on.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppResult;
use crate::platform::skillbar_window::imp as chip_imp;

pub const CHIP_LABEL: &str = "improvechip";

/// Logical chip size: a one-line status pill.
const CHIP_LOGICAL_WIDTH: f64 = 260.0;
const CHIP_LOGICAL_HEIGHT: f64 = 44.0;

/// How long a terminal ("done"/"error") chip state stays visible.
const CHIP_LINGER_MS: u64 = 1800;

/// Hard backstop for a run whose frontend leg never reports back (webview
/// crash, unhandled rejection): clears `in_flight` so the hotkey works again.
/// Generous vs. the §5.6.3 15 s frontend timeout — this is the safety net,
/// not the UX timeout.
const RUN_WATCHDOG_MS: u64 = 20_000;

/// One captured draft: the field's full text and the window that owned it —
/// the Undo hotkey's restore target. Kept across runs (undo works after the
/// chip is long gone) and only overwritten by the next successful capture.
struct Snapshot {
    hwnd: isize,
    text: String,
}

/// Managed state for the Improve pipeline.
#[derive(Default)]
pub struct ImproveState {
    snapshot: Mutex<Option<Snapshot>>,
    /// Monotonic run id. `in_flight` is "current generation still running";
    /// bumping the generation implicitly invalidates stale watchdogs.
    generation: AtomicU64,
    in_flight: Mutex<bool>,
    /// Bumped on every chip show so a linger-hide never races a newer state.
    chip_generation: AtomicU64,
}

impl ImproveState {
    fn set_in_flight(&self, v: bool) {
        match self.in_flight.lock() {
            Ok(mut g) => *g = v,
            Err(p) => *p.into_inner() = v,
        }
    }

    fn is_in_flight(&self) -> bool {
        self.in_flight.lock().map_or_else(|p| *p.into_inner(), |g| *g)
    }

    fn set_snapshot(&self, s: Option<Snapshot>) {
        match self.snapshot.lock() {
            Ok(mut g) => *g = s,
            Err(p) => *p.into_inner() = s,
        }
    }

    /// Clone out the snapshot (undo is idempotent — repeat presses restore
    /// the same original until the next capture).
    fn snapshot(&self) -> Option<(isize, String)> {
        let read = |s: &Option<Snapshot>| s.as_ref().map(|s| (s.hwnd, s.text.clone()));
        self.snapshot
            .lock()
            .map_or_else(|p| read(&p.into_inner()), |g| read(&g))
    }
}

/// Payload of `improve:draft` — the captured field handed to the frontend
/// for adapter lookup (placeholder guard, target profile) and the LLM call.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DraftPayload {
    text: String,
    process_name: String,
    window_title: String,
}

/// Payload of `improve:chip` — what the chip webview renders.
#[derive(Clone, serde::Serialize)]
struct ChipPayload {
    /// "working" | "done" | "error" | "info"
    state: String,
    message: String,
}

/// Build the (hidden) progress chip window once at startup. Same
/// never-activating construction as the skill bar: taking focus here would
/// collapse the very field focus the pipeline is about to write back into.
pub fn create_improve_chip(app: &AppHandle) -> AppResult<()> {
    let window = WebviewWindowBuilder::new(
        app,
        CHIP_LABEL,
        WebviewUrl::App("improvechip.html".into()),
    )
    .title("InsertGo Improve")
    .inner_size(CHIP_LOGICAL_WIDTH, CHIP_LOGICAL_HEIGHT)
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
    .build()?;

    let hwnd = chip_hwnd(&window)?;
    chip_imp::apply_noactivate(hwnd);
    Ok(())
}

#[cfg(target_os = "windows")]
fn chip_hwnd(window: &tauri::WebviewWindow) -> AppResult<isize> {
    Ok(window.hwnd()?.0 as isize)
}

#[cfg(not(target_os = "windows"))]
fn chip_hwnd(_window: &tauri::WebviewWindow) -> AppResult<isize> {
    Ok(0)
}

/// Show the chip near the cursor with `state`/`message`. Terminal states
/// ("done"/"error"/"info") auto-hide after [`CHIP_LINGER_MS`]; "working"
/// stays until the run reports back. Never activates the chip.
fn chip_show(app: &AppHandle, state: &str, message: &str) {
    let Some(window) = app.get_webview_window(CHIP_LABEL) else {
        return;
    };

    let gen = {
        let s = app.state::<ImproveState>();
        s.chip_generation.fetch_add(1, Ordering::SeqCst) + 1
    };

    // Content first, show second — no stale flash (skill bar convention).
    let _ = app.emit_to(
        CHIP_LABEL,
        "improve:chip",
        ChipPayload {
            state: state.into(),
            message: message.into(),
        },
    );

    // Position just below-right of the cursor, clamped into the work area.
    let (cx, cy) = chip_imp::cursor_pos().unwrap_or((0, 0));
    let (w, h) = window
        .outer_size()
        .map(|s| (s.width as i32, s.height as i32))
        .unwrap_or((CHIP_LOGICAL_WIDTH as i32, CHIP_LOGICAL_HEIGHT as i32));
    let (mut x, mut y) = (cx + 16, cy + 20);
    if let Some(work) = chip_imp::work_area(cx, cy) {
        x = x.clamp(work.x, (work.x + work.w - w).max(work.x));
        y = y.clamp(work.y, (work.y + work.h - h).max(work.y));
    }

    if let Ok(hwnd) = chip_hwnd(&window) {
        let _ = app.run_on_main_thread(move || chip_imp::show_no_activate_at(hwnd, x, y));
    }

    if state != "working" {
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(CHIP_LINGER_MS));
            let still_current = app
                .state::<ImproveState>()
                .chip_generation
                .load(Ordering::SeqCst)
                == gen;
            if still_current {
                chip_hide(&app);
            }
        });
    }
}

fn chip_hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(CHIP_LABEL) {
        let _ = window.hide();
    }
}

/// Frontend report-back for a run: `state` ∈ "done" | "error" | "aborted".
/// Clears `in_flight` (ending the watchdog's authority) and updates the chip.
/// "aborted" is the quiet no-mutation path (placeholder-only field, not
/// logged in, sanitizer rejection) — the message says why, nothing changed.
#[tauri::command]
pub async fn improve_status(
    app: AppHandle,
    state: String,
    message: Option<String>,
) -> AppResult<()> {
    let s = app.state::<ImproveState>();
    s.generation.fetch_add(1, Ordering::SeqCst); // invalidate the watchdog
    s.set_in_flight(false);

    match state.as_str() {
        "done" => chip_show(&app, "done", &message.unwrap_or_else(|| "Improved".into())),
        "error" => chip_show(
            &app,
            "error",
            &message.unwrap_or_else(|| "Improve failed".into()),
        ),
        _ => chip_show(
            &app,
            "info",
            &message.unwrap_or_else(|| "Nothing to improve".into()),
        ),
    }
    Ok(())
}

/// Improve hotkey handler. Spawns off the main thread immediately: the UIA
/// reads and the clipboard-fallback sleeps must never block the event loop
/// (the pipeline itself dispatches back to the main thread for Win32 focus
/// calls, exactly like `insert_text`).
pub fn on_improve_hotkey(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || imp::run_improve(&app));
}

/// Undo hotkey handler: restore the last captured draft into its window.
pub fn on_undo_hotkey(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || imp::run_undo(&app));
}

#[cfg(target_os = "windows")]
mod imp {
    use super::*;
    use crate::platform::window::PALETTE_LABEL;
    use crate::platform::{clipboard, foreground, text_provider, window};
    use crate::PriorWindow;

    /// Capture leg of an Improve run (steps 1–3 of SPEC §4.4): guards, the
    /// whole-field read, the undo snapshot, then hand-off to the frontend.
    pub fn run_improve(app: &AppHandle) {
        let state = app.state::<ImproveState>();
        if state.is_in_flight() {
            return; // debounce: one run at a time
        }

        let Some(hwnd) = foreground::capture() else {
            return;
        };
        let process = foreground::process_name(hwnd).unwrap_or_default();
        let title = foreground::window_title(hwnd).unwrap_or_default();

        // Improving InsertGo's own windows makes no sense (the palette has
        // its own refine surface) and would confuse the focus contract — no
        // capture, no chip, no write-back.
        //
        // The chord still has to be OBSERVABLE to the webview, though: Windows
        // RegisterHotKey consumes the keystroke, so a focused webview never
        // receives the keydown. The onboarding sandbox exists to let the user
        // press the real chord once, so tell the palette the chord fired on our
        // own window and let the frontend decide whether anything is listening.
        // Any other surface ignores the event.
        if is_own_process(&process) {
            let _ = app.emit_to(PALETTE_LABEL, "improve:own-window", ());
            return;
        }

        let terminal = clipboard::is_terminal_process(&process);

        // Terminals: synthetic select-all is unsafe/meaningless in a console
        // (Ctrl+A reaches the hosted CLI, and the UIA tree exposes the
        // scrollback buffer, not the input line), so only a UIA read is
        // attempted; when it yields nothing, route to the palette — the
        // deliberate surface — instead of failing.
        let field = text_provider::provider().read_focused_value(app, !terminal);

        let Some(field) = field else {
            if terminal {
                route_to_palette(app);
            } else {
                chip_show(app, "info", "Couldn't read the field — copied nothing");
            }
            return;
        };

        if field.is_password {
            chip_show(app, "error", "Password field — Improve refused");
            return;
        }
        if field.text.trim().is_empty() {
            chip_show(app, "info", "Nothing to improve");
            return;
        }

        // Arm the run: snapshot for Undo, PriorWindow as the write-back
        // target (replace_text reads it, same contract as insert_text).
        let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
        state.set_in_flight(true);
        state.set_snapshot(Some(Snapshot {
            hwnd,
            text: field.text.clone(),
        }));
        app.state::<PriorWindow>().set(Some(hwnd));

        chip_show(app, "working", "Improving…");
        let _ = app.emit_to(
            PALETTE_LABEL,
            "improve:draft",
            DraftPayload {
                text: field.text,
                process_name: process,
                window_title: title,
            },
        );

        // Watchdog: if the frontend leg never calls improve_status, free the
        // hotkey and say so. A later improve_status bumps the generation, so
        // a stale watchdog does nothing.
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(RUN_WATCHDOG_MS));
            let state = app.state::<ImproveState>();
            if state.generation.load(Ordering::SeqCst) == gen && state.is_in_flight() {
                state.set_in_flight(false);
                chip_show(&app, "error", "Improve timed out — field unchanged");
            }
        });
    }

    /// Undo leg: replace the field with the snapshot taken at capture time.
    pub fn run_undo(app: &AppHandle) {
        let state = app.state::<ImproveState>();
        if state.is_in_flight() {
            return; // never fight an in-progress replace
        }
        let Some((hwnd, text)) = state.snapshot() else {
            chip_show(app, "info", "Nothing to undo");
            return;
        };
        match text_provider::provider().replace_text(app, Some(hwnd), text) {
            Ok(()) => chip_show(app, "done", "Original restored"),
            Err(e) => {
                log::warn!("improve undo failed: {e}");
                chip_show(app, "error", "Undo failed — original on clipboard");
            }
        }
    }

    /// Terminal escape hatch: open the palette (which captures the terminal
    /// as its injection target) and tell the frontend why.
    fn route_to_palette(app: &AppHandle) {
        if let Err(e) = window::show_palette(app) {
            log::error!("improve: palette route failed: {e}");
            return;
        }
        let _ = app.emit_to(PALETTE_LABEL, "improve:route-palette", ());
    }

    /// `true` when `process` is InsertGo's own executable.
    fn is_own_process(process: &str) -> bool {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
            .is_some_and(|own| own.eq_ignore_ascii_case(process.trim()))
    }
}

/// Non-Windows: capture/undo are inert (SPEC §2.1); the chip never shows.
#[cfg(not(target_os = "windows"))]
mod imp {
    use super::*;

    pub fn run_improve(_app: &AppHandle) {}

    pub fn run_undo(_app: &AppHandle) {}
}
