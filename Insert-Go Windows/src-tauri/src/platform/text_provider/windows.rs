#![cfg(target_os = "windows")]

//! Windows [`NativeTextProvider`]: UI Automation / MSAA primary tiers
//! (`platform::selection`) with the generic clipboard fallback wired through
//! Win32 chord synthesis and `GetClipboardSequenceNumber`.
//!
//! The accessibility tiers themselves stay in `selection.rs` (they carry the
//! windows-rs #3818 safety notes and the Chromium lazy-a11y handling); this
//! file is the seam that binds them to the cross-platform trait.

use tauri::AppHandle;

use super::{FallbackOps, NativeTextProvider, TargetApp};
use crate::platform::selection::SelectionRead;
use crate::platform::{clipboard, selection};

pub(crate) struct WindowsTextProvider;

impl NativeTextProvider for WindowsTextProvider {
    fn read_selection(
        &self,
        app: &AppHandle,
        allow_clipboard_fallback: bool,
        pointer_gesture: bool,
    ) -> Option<SelectionRead> {
        selection::read_selection(app, allow_clipboard_fallback, pointer_gesture)
    }
}

/// Win32 hooks for the generic fallback: enigo chord synthesis (terminals
/// get `Ctrl+Shift+C` / `Ctrl+Shift+V`) and the OS clipboard sequence number
/// as change token.
pub(crate) struct WinFallbackOps {
    terminal_copy: bool,
}

impl WinFallbackOps {
    pub(crate) const fn new(terminal_copy: bool) -> Self {
        Self { terminal_copy }
    }
}

impl FallbackOps for WinFallbackOps {
    fn send_copy(&self) -> Result<(), String> {
        if self.terminal_copy {
            clipboard::send_terminal_copy_chord()
        } else {
            clipboard::send_copy_chord()
        }
    }

    fn send_paste(&self, target: &TargetApp) -> Result<(), String> {
        if target.is_terminal() {
            clipboard::send_terminal_paste_chord()
        } else {
            clipboard::send_paste_chord()
        }
    }

    fn clipboard_change_token(&self) -> Option<u64> {
        // SAFETY: GetClipboardSequenceNumber takes no arguments.
        Some(unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() } as u64)
    }
}
