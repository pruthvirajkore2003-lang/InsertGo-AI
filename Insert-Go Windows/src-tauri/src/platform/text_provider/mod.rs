//! Cross-platform text capture & insertion architecture (SPEC §0, §6.2).
//!
//! Hybrid OS-integration strategy, one trait per platform:
//!   * **Primary tier** — the native accessibility API (Windows UIA/MSAA,
//!     macOS AXUIElement, Linux AT-SPI2): instant, non-destructive reads.
//!   * **Fallback tier** — stateful clipboard manipulation ([`fallback`]):
//!     cache the user's clipboard → inject → synthesize a copy/paste chord →
//!     wait for consumption → restore. The lifecycle lives ONCE in
//!     `fallback.rs`; platforms only supply chord synthesis and a clipboard
//!     change token through [`FallbackOps`].
//!
//! Never auto-submits: no Enter keypress is ever synthesized, anywhere.
//! Terminal edge case: [`TargetApp::is_terminal`] lets the paste chord flip
//! to `Ctrl+Shift+V` on Windows/Linux (macOS terminals keep plain `Cmd+V`).

pub mod fallback;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "linux")]
mod linux;

pub use fallback::{CaptureScope, FallbackOps, PasteFailure};
#[cfg(target_os = "windows")]
pub(crate) use windows::WinFallbackOps;

use crate::error::AppResult;
use crate::platform::selection::{FieldRead, SelectionRead};
use tauri::AppHandle;

/// The window/app a paste is aimed at. The handle is platform-opaque:
/// Windows stores a raw `HWND` as `isize` (`HWND: !Send`, same convention as
/// `PriorWindow`); macOS will store a pid (AX activation is per-app), Linux
/// an X11 window id.
#[derive(Clone, Copy, Debug)]
pub struct TargetApp {
    pub window: isize,
}

impl TargetApp {
    /// `true` when the target hosts a terminal — those take `Ctrl+Shift+V`
    /// as the paste chord (Windows/Linux) and their input line can't be
    /// select-all-captured.
    pub fn is_terminal(&self) -> bool {
        crate::platform::foreground::process_name(self.window)
            .map(|p| crate::platform::clipboard::is_terminal_process(&p))
            .unwrap_or(false)
    }
}

/// Unified text capture & insertion across Windows/macOS/Linux.
///
/// Implementations try the native accessibility API first and degrade to the
/// generic clipboard fallback ([`fallback`]) when the tree is unavailable or
/// unpopulated (Electron/Chromium materialize accessibility lazily).
///
/// `allow_clipboard_fallback` gates the synthetic-chord paths on every read:
/// they must only fire on an explicit user gesture — a stray `Ctrl+C`/`Cmd+C`
/// on a caret click can trigger target-side behavior (copy-line) and churns
/// the clipboard for nothing.
pub trait NativeTextProvider: Send + Sync {
    /// Read the currently selected text in the foreground app.
    /// `pointer_gesture` gates pointer-only guards (e.g. the Windows I-beam
    /// cursor check) so a non-text drag never triggers a synthetic copy.
    fn read_selection(
        &self,
        app: &AppHandle,
        allow_clipboard_fallback: bool,
        pointer_gesture: bool,
    ) -> Option<SelectionRead>;

    /// Read the ENTIRE content of the focused text control. Password fields
    /// must return `is_password: true` with NO text — secrets never enter
    /// process memory.
    fn read_focused_value(
        &self,
        app: &AppHandle,
        allow_clipboard_fallback: bool,
    ) -> Option<FieldRead>;

    /// Replace the entire content of the focused field in `target` with
    /// `text` (select-all + paste semantics). Destructive by design: callers
    /// snapshot the prior content first (Undo). On an aborted paste the text
    /// stays staged on the clipboard and the frontend is told to toast
    /// "copied — paste manually"; `Err` is reserved for real failures like an
    /// unwritable clipboard.
    fn replace_text(&self, app: &AppHandle, target: Option<isize>, text: String) -> AppResult<()>;
}

/// The provider for the compiled platform.
pub fn provider() -> &'static dyn NativeTextProvider {
    #[cfg(target_os = "windows")]
    {
        &windows::WindowsTextProvider
    }
    #[cfg(target_os = "macos")]
    {
        &macos::MacosTextProvider
    }
    #[cfg(target_os = "linux")]
    {
        &linux::LinuxTextProvider
    }
}
