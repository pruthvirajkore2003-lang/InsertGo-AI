//! Clipboard-backed text insertion (SPEC §2.2, §4.1, §5.5).
//!
//! The cache → stage → paste → wait → restore lifecycle itself lives in
//! `platform::text_provider::fallback` (shared with the future macOS/Linux
//! providers); this file supplies the Windows chord synthesis and the
//! app-level orchestration around it.
//!
//! Windows pipeline: cache the user's clipboard → stage the prompt on it →
//! hide the palette (frees the foreground) → restore focus to the window
//! captured when the hotkey fired → *verify* it really is foreground → send a
//! synthetic `Ctrl+V` → restore the original clipboard. If focus can't be
//! restored/verified (or UIPI blocks input into an elevated target), the
//! paste is aborted and the prompt stays on the clipboard: the palette is
//! re-shown and `insert:fallback` is emitted so the frontend can toast
//! "copied — paste manually". We never paste into an unverified window.
//!
//! Non-Windows keeps the v1 behavior: stage the text on the clipboard only.
//!
//! INVARIANT — no external apps, ever: insertion is clipboard + synthetic
//! paste, entirely in-process. The ONLY non-paste outcome is leaving the
//! prompt on the clipboard (signalled via `insert:fallback`). Never hand the
//! text to a system opener, temp file, or shell — no `tauri-plugin-shell`,
//! no `tauri-plugin-opener`, no `std::process`, no `ShellExecute`. A system
//! opener resolves `.txt` to the user's default handler (i.e. launches
//! Notepad) and is arbitrary-program-launch shaped (cf. Tauri advisory
//! GHSA-c9pr-q8gx-3mgp / CVE-2025-31477).
//!
//! Privacy (SPEC §10): the cached clipboard text stays in process memory and
//! is never logged.

use tauri::AppHandle;
#[cfg(not(target_os = "windows"))]
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::error::{AppError, AppResult};

/// Insert `text` into the previously focused app. Resolves `Ok` both on a
/// successful paste and on the clipboard-only fallback (which is signalled to
/// the frontend via the `insert:fallback` event); errors are reserved for
/// real failures like an unwritable clipboard.
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn insert_text(app: AppHandle, text: String) -> AppResult<()> {
    use crate::platform::window::PALETTE_LABEL;
    insert_from(&app, PALETTE_LABEL, text).map(|_| ())
}

/// Core of [`insert_text`], parametrized on WHICH InsertGo window is the
/// visible surface: that window is hidden before the paste and re-shown by
/// the fallback. The palette passes `PALETTE_LABEL`; the selection review
/// floater passes its own label so a failed paste never opens the palette.
/// Returns `true` on a landed paste, `false` on the clipboard fallback.
#[cfg(target_os = "windows")]
pub(crate) fn insert_from(app: &AppHandle, label: &str, text: String) -> AppResult<bool> {
    use crate::platform::text_provider::{fallback::paste_text, PasteFailure, TargetApp, WinFallbackOps};
    use crate::PriorWindow;
    use std::time::Duration;
    use tauri::{Emitter, Manager};

    let target = app.state::<PriorWindow>().get();

    // The generic lifecycle (cache → stage → paste → wait → restore) lives in
    // text_provider::fallback; the closure is the Windows focus dance run
    // between staging and the chord.
    let result = paste_text(app, &WinFallbackOps::new(false), text, || {
        // Hide the calling surface so InsertGo stops being the foreground
        // window, then give the OS a beat to settle the focus handoff.
        // `palette:hidden` is the palette's own lifecycle signal — never
        // emitted for the floater.
        if let Some(window) = app.get_webview_window(label) {
            window.hide().map_err(|e| format!("hide window: {e}"))?;
            if label == crate::platform::window::PALETTE_LABEL {
                let _ = app.emit("palette:hidden", ());
            }
        }
        std::thread::sleep(Duration::from_millis(50));

        let hwnd = target.ok_or_else(|| "no prior window captured".to_string())?;
        acquire_verified_focus(app, hwnd)?;
        Ok(TargetApp { window: hwnd })
    });

    match result {
        Ok(()) => Ok(true),
        Err(PasteFailure::Stage(e)) => Err(AppError::Os(e)),
        Err(PasteFailure::Staged(reason)) => fallback(app, label, &reason),
    }
}

/// Restore focus to `hwnd` and *verify* it really is foreground before any
/// chord is sent. Win32 focus calls run on the main thread (its input queue
/// is the one AttachThreadInput must attach); the pipeline itself stays off
/// it. Never paste into an unverified window.
#[cfg(target_os = "windows")]
fn acquire_verified_focus(app: &AppHandle, hwnd: isize) -> Result<(), String> {
    use crate::platform::foreground;

    let focused = focus_on_main_thread(app, hwnd).map_err(|e| e.to_string())?;
    if !focused {
        return Err("target window refused foreground".into());
    }
    // focus_window already waited for the foreground handoff to complete;
    // this is only a short beat for the target to settle its caret.
    std::thread::sleep(std::time::Duration::from_millis(30));

    // Focus could have drifted during the settle sleep — re-verify at the
    // last instant.
    if foreground::capture() != Some(hwnd) {
        return Err("foreground changed before paste".into());
    }
    Ok(())
}

/// Non-Windows: stage the text on the clipboard for manual paste, mirroring
/// `insert_text`'s v1 behavior. Never pastes, so always `false`.
#[cfg(not(target_os = "windows"))]
pub(crate) fn insert_from(app: &AppHandle, _label: &str, text: String) -> AppResult<bool> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| AppError::Os(format!("clipboard write: {e}")))?;
    Ok(false)
}

/// Non-Windows: stage the text on the clipboard for manual paste (v1
/// behavior); focus restore + key synthesis are Windows-only for now.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn insert_text(app: AppHandle, text: String) -> AppResult<()> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| AppError::Os(format!("clipboard write: {e}")))?;
    Ok(())
}

/// Abort the paste but keep the prompt on the clipboard: re-show the calling
/// window (so the toast is visible) and tell the frontend to surface the
/// fallback. Deliberately does NOT overwrite `PriorWindow` — mid-pipeline the
/// foreground is undefined, and the original capture stays valid for retry.
#[cfg(target_os = "windows")]
fn fallback(app: &AppHandle, label: &str, reason: &str) -> AppResult<bool> {
    use crate::platform::window::PALETTE_LABEL;
    use tauri::{Emitter, Manager};

    log::warn!("insert_text fallback (prompt left on clipboard): {reason}");
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        if label == PALETTE_LABEL {
            // tauri#12854: re-assert acrylic after show (see window.rs).
            crate::platform::window::apply_glass(&window);
        }
        let _ = window.set_focus();
        if label == PALETTE_LABEL {
            let _ = app.emit("palette:shown", ());
        }
    }
    let _ = app.emit("insert:fallback", ());
    Ok(false)
}

/// Run `foreground::focus_window` on the main thread and wait for its verdict.
#[cfg(target_os = "windows")]
fn focus_on_main_thread(app: &AppHandle, hwnd: isize) -> AppResult<bool> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(crate::platform::foreground::focus_window(hwnd));
    })
    .map_err(|e| AppError::Os(format!("main-thread dispatch: {e}")))?;
    // The closure runs within one event-loop turn; the timeout only guards a
    // wedged main thread.
    rx.recv_timeout(std::time::Duration::from_secs(2))
        .map_err(|e| AppError::Os(format!("focus restore did not report back: {e}")))
}

/// Send a synthetic `Ctrl+V` chord. Clipboard-paste (not per-key typing of
/// the text) keeps the injection instant, layout-independent, and never
/// interpreted as shortcuts by the target.
#[cfg(target_os = "windows")]
pub(crate) fn send_paste_chord() -> Result<(), String> {
    send_ctrl_chord('v')
}

/// Send a synthetic `Ctrl+C` chord — the clipboard-fallback read used by
/// `platform::selection` when UI Automation can't surface the selection.
#[cfg(target_os = "windows")]
pub(crate) fn send_copy_chord() -> Result<(), String> {
    send_ctrl_chord('c')
}

/// Terminal copy chord: modern terminals such as Warp use `Ctrl+Shift+C`;
/// plain `Ctrl+C` is forwarded to the hosted CLI as interrupt/clear.
#[cfg(target_os = "windows")]
pub(crate) fn send_terminal_copy_chord() -> Result<(), String> {
    send_chord(enigo::Key::C, true)
}

/// Terminal paste chord: terminals swallow `Ctrl+V` (or feed it to the
/// hosted CLI) and take `Ctrl+Shift+V` instead — Windows Terminal's
/// bracketed paste then keeps multiline text a paste, never an Enter press.
/// Chord selection lives in `text_provider` (`TargetApp::is_terminal`).
#[cfg(target_os = "windows")]
pub(crate) fn send_terminal_paste_chord() -> Result<(), String> {
    send_chord(enigo::Key::V, true)
}

/// `true` when `process` (an executable file name) hosts a terminal — the
/// targets whose clipboard chords are `Ctrl+Shift+C` / `Ctrl+Shift+V`.
pub(crate) fn is_terminal_process(process: &str) -> bool {
    const TERMINALS: [&str; 10] = [
        "windowsterminal.exe",
        "wt.exe",
        "openconsole.exe",
        "conhost.exe",
        "cmd.exe",
        "powershell.exe",
        "pwsh.exe",
        "alacritty.exe",
        "wezterm-gui.exe",
        "warp.exe",
    ];
    let p = process.trim();
    TERMINALS.iter().any(|t| t.eq_ignore_ascii_case(p))
}

#[cfg(test)]
mod tests {
    use super::is_terminal_process;

    #[test]
    fn terminal_processes_match_case_insensitively() {
        assert!(is_terminal_process("WindowsTerminal.exe"));
        assert!(is_terminal_process("wt.exe"));
        assert!(is_terminal_process(" pwsh.exe "));
        assert!(is_terminal_process("Warp.exe"));
    }

    #[test]
    fn non_terminals_do_not_match() {
        assert!(!is_terminal_process("chrome.exe"));
        assert!(!is_terminal_process("Code.exe"));
        assert!(!is_terminal_process(""));
    }
}

/// Shared `Ctrl+<letter>` chord core for the paste/copy chords.
#[cfg(target_os = "windows")]
fn send_ctrl_chord(letter: char) -> Result<(), String> {
    use enigo::Key;

    let key = match letter {
        'c' | 'C' => Key::C,
        'v' | 'V' => Key::V,
        _ => return Err(format!("unsupported ctrl chord: {letter}")),
    };
    send_chord(key, false)
}

/// Press `Ctrl(+Shift)+key` and release in reverse order.
#[cfg(target_os = "windows")]
fn send_chord(key: enigo::Key, shift: bool) -> Result<(), String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};

    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| format!("ctrl press: {e}"))?;
    let shift_press = if shift {
        enigo.key(Key::Shift, Direction::Press)
    } else {
        Ok(())
    };
    let click = if shift_press.is_ok() {
        enigo.key(key, Direction::Click)
    } else {
        Ok(())
    };
    // Always release the modifiers — even when the letter click failed — so a
    // fallback never leaves the user with a stuck modifier key.
    let shift_release = if shift {
        enigo.key(Key::Shift, Direction::Release)
    } else {
        Ok(())
    };
    let release = enigo.key(Key::Control, Direction::Release);
    shift_press.map_err(|e| format!("shift press: {e}"))?;
    click.map_err(|e| format!("key click: {e}"))?;
    shift_release.map_err(|e| format!("shift release: {e}"))?;
    release.map_err(|e| format!("ctrl release: {e}"))?;
    Ok(())
}
