#![cfg(target_os = "linux")]

//! Linux [`NativeTextProvider`] scaffold.
//!
//! # Required OS APIs
//!
//! ## Primary tier — AT-SPI2 (accessibility over D-Bus; `atspi` crate)
//! * Focused element: subscribe/query the AT-SPI registry
//!   (`org.a11y.atspi.Registry`) for the focused accessible, or walk the
//!   desktop's active application for the object with the `focused` state.
//! * Selection read: the `org.a11y.atspi.Text` interface —
//!   `GetNSelections`/`GetSelection` for the range, `GetText(start, end)` for
//!   the content, `GetRangeExtents` for the screen rect.
//! * Whole-field read: `Text.GetText(0, -1)`; password guard: the accessible
//!   role `password_text` / state `Protected` → `is_password: true`, NO text.
//! * Gotchas: the a11y bus must be enabled (`org.a11y.Bus` → `IsEnabled`);
//!   Electron apps only join it when launched with a11y active
//!   (GTK_MODULES=gail:atk-bridge or `--force-renderer-accessibility`), so
//!   the clipboard fallback carries most Electron/IDE targets — same shape
//!   as the Windows implementation.
//!
//! ## Fallback tier — chord synthesis
//! * X11: XTest (`x11rb`'s `xtest` extension or `libxdo`):
//!   `xtest::fake_input(KEY_PRESS/KEY_RELEASE, keycode, ...)` for
//!   Ctrl+C / Ctrl+A / Ctrl+V — and `Ctrl+Shift+V` when
//!   `TargetApp::is_terminal()` (GNOME Terminal, Konsole, etc. treat Ctrl+V
//!   as a literal control char).
//! * Wayland: there is NO global key injection. Options: the
//!   `org.freedesktop.portal.RemoteDesktop` portal (user-consented) or the
//!   wlroots `virtual-keyboard-unstable-v1` protocol (compositor-specific).
//!   Detect via `WAYLAND_DISPLAY`/`XDG_SESSION_TYPE` and degrade to
//!   clipboard-only staging (`insert:fallback` toast) when neither works.
//! * Clipboard change token: none portable (X11 selections have no sequence
//!   number) — return `None` so the generic wait degrades to a fixed sleep.
//!
//! ## Focus restore (`prepare` closure) & terminal detection
//! * X11: `_NET_ACTIVE_WINDOW` client message (EWMH) to re-activate the
//!   captured window id; verify by re-reading `_NET_ACTIVE_WINDOW`.
//! * `TargetApp::is_terminal`: window pid via `_NET_WM_PID` →
//!   `/proc/<pid>/comm` against a terminal list (gnome-terminal-server,
//!   konsole, alacritty, kitty, wezterm-gui, xterm, ...); wire it through
//!   `platform::foreground::process_name` like Windows does.
//!
//! Never synthesize Enter (no auto-submit).

use tauri::AppHandle;

use super::{FallbackOps, NativeTextProvider, TargetApp};
use crate::error::AppResult;
use crate::platform::selection::{FieldRead, SelectionRead};

pub(crate) struct LinuxTextProvider;

impl NativeTextProvider for LinuxTextProvider {
    fn read_selection(
        &self,
        _app: &AppHandle,
        _allow_clipboard_fallback: bool,
        _pointer_gesture: bool,
    ) -> Option<SelectionRead> {
        // AT-SPI2 Text.GetSelection first; X11 has a cheaper pre-check — the
        // PRIMARY selection often already holds the selected text. Then
        // fallback::capture_text(app, &LinuxFallbackOps, CaptureScope::Selection).
        unimplemented!("Linux: AT-SPI2 selection read (see module docs)")
    }

    fn read_focused_value(
        &self,
        _app: &AppHandle,
        _allow_clipboard_fallback: bool,
    ) -> Option<FieldRead> {
        // Role/state password guard FIRST, then Text.GetText(0, -1); fall
        // back to fallback::capture_text(.., CaptureScope::WholeField).
        unimplemented!("Linux: AT-SPI2 focused-value read (see module docs)")
    }

    fn replace_text(&self, _app: &AppHandle, _target: Option<isize>, _text: String) -> AppResult<()> {
        // fallback::paste_text(app, &LinuxFallbackOps, text, /*select_all*/ true,
        //     || EWMH-activate + verify the captured window, Ok(TargetApp {..}))
        unimplemented!("Linux: EWMH activate + XTest paste (see module docs)")
    }
}

/// XTest chord synthesis (X11) for the generic fallback lifecycle. Wayland
/// injection goes through the RemoteDesktop portal when available.
pub(crate) struct LinuxFallbackOps;

impl FallbackOps for LinuxFallbackOps {
    fn send_copy(&self) -> Result<(), String> {
        unimplemented!("Linux: XTest Ctrl+C / portal injection")
    }

    fn send_select_all(&self) -> Result<(), String> {
        unimplemented!("Linux: XTest Ctrl+A / portal injection")
    }

    fn send_paste(&self, target: &TargetApp) -> Result<(), String> {
        // Terminals take Ctrl+Shift+V; everything else plain Ctrl+V.
        let _ = target.is_terminal();
        unimplemented!("Linux: XTest Ctrl(+Shift)+V / portal injection")
    }

    fn clipboard_change_token(&self) -> Option<u64> {
        None // no portable X11/Wayland clipboard sequence — fixed-sleep waits
    }
}
