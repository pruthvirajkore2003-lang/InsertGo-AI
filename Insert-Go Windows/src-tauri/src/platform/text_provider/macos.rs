#![cfg(target_os = "macos")]

//! macOS [`NativeTextProvider`] scaffold.
//!
//! # Required OS APIs
//!
//! ## Permission gate (both tiers)
//! `AXIsProcessTrustedWithOptions(kAXTrustedCheckOptionPrompt)` — the
//! Accessibility permission (System Settings → Privacy & Security →
//! Accessibility) is required for AX reads AND for CGEvent posting. Check it
//! up front and surface a settings deep-link toast when missing; every call
//! below fails silently without it.
//!
//! ## Primary tier — AXUIElement (ApplicationServices framework)
//! * Focused element: `AXUIElementCreateSystemWide()` →
//!   `AXUIElementCopyAttributeValue(kAXFocusedUIElementAttribute)`.
//! * Selection read: `kAXSelectedTextAttribute` on the focused element.
//!   Selection rect: `kAXSelectedTextRangeAttribute` →
//!   `AXUIElementCopyParameterizedAttributeValue(kAXBoundsForRangeParameterizedAttribute)`
//!   (CGRect in flipped screen coords — convert before storing `ScreenRect`).
//! * Electron/Chromium gotcha: the AX tree is materialized lazily. Setting
//!   the target app's `AXManualAccessibility` (Chromium ≥ M65) or
//!   `AXEnhancedUserInterface` attribute to `true` via
//!   `AXUIElementSetAttributeValue` forces it on, but the latter causes
//!   window-resize side effects in some apps — prefer degrading to the
//!   clipboard fallback, exactly like the Windows implementation does.
//!
//! ## Fallback tier — CGEvent chord synthesis (CoreGraphics)
//! * `CGEventCreateKeyboardEvent(source, keycode, keydown)` +
//!   `CGEventSetFlags(kCGEventFlagMaskCommand)` posted to `kCGHIDEventTap`
//!   via `CGEventPost`. Keycodes: kVK_ANSI_C (0x08), kVK_ANSI_V (0x09).
//!   Press/release order mirrors clipboard.rs's
//!   `send_chord`: modifiers released even when the letter event fails.
//! * Terminals take plain `Cmd+V` on macOS — `TargetApp::is_terminal` exists
//!   for the Windows/Linux `Ctrl+Shift+V` chord and is a no-op here.
//! * Clipboard change token: `NSPasteboard.generalPasteboard.changeCount`
//!   (monotonic i64 — return it as the `FallbackOps` token so copy waits
//!   poll instead of fixed-sleeping).
//!
//! ## Focus restore (the `prepare` closure for `fallback::paste_text`)
//! macOS activation is per-APP, not per-window: capture the frontmost app's
//! pid at hotkey time (`NSWorkspace.frontmostApplication.processIdentifier`,
//! stored as the `TargetApp::window` isize) and restore with
//! `NSRunningApplication(processIdentifier:).activate(options: [.activateIgnoringOtherApps])`.
//! Verify by re-reading `frontmostApplication` before the chord — never paste
//! into an unverified app (same invariant as Windows).
//!
//! Suggested crates: `objc2` + `objc2-app-kit` (NSPasteboard/NSWorkspace/
//! NSRunningApplication), `core-graphics` (CGEvent), `accessibility-sys`
//! (AXUIElement). Never synthesize Enter (no auto-submit).

use tauri::AppHandle;

use super::{FallbackOps, NativeTextProvider, TargetApp};
use crate::platform::selection::SelectionRead;

pub(crate) struct MacosTextProvider;

impl NativeTextProvider for MacosTextProvider {
    fn read_selection(
        &self,
        _app: &AppHandle,
        _allow_clipboard_fallback: bool,
        _pointer_gesture: bool,
    ) -> Option<SelectionRead> {
        // AXUIElementCopyAttributeValue(kAXSelectedTextAttribute), then
        // fallback::capture_text(app, &MacFallbackOps) when gated on and the
        // AX read comes back empty (lazy Electron tree).
        unimplemented!("macOS: AXUIElement selection read (see module docs)")
    }
}

/// CGEvent chord synthesis + NSPasteboard changeCount for the generic
/// fallback lifecycle.
pub(crate) struct MacFallbackOps;

impl FallbackOps for MacFallbackOps {
    fn send_copy(&self) -> Result<(), String> {
        unimplemented!("macOS: CGEventPost Cmd+C (kVK_ANSI_C + kCGEventFlagMaskCommand)")
    }

    fn send_paste(&self, _target: &TargetApp) -> Result<(), String> {
        // Plain Cmd+V for every target — macOS terminals do NOT need the
        // Ctrl+Shift+V chord.
        unimplemented!("macOS: CGEventPost Cmd+V")
    }

    fn clipboard_change_token(&self) -> Option<u64> {
        unimplemented!("macOS: NSPasteboard.generalPasteboard.changeCount")
    }
}
