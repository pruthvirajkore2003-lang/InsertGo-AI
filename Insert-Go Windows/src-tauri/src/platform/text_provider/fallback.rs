//! Generic clipboard-fallback machinery: the cache → inject → chord → wait →
//! restore lifecycle, written ONCE and shared by every platform (SPEC §2.2,
//! §4.1, §5.5).
//!
//! Platforms plug in through [`FallbackOps`]: chord synthesis (copy /
//! select-all / terminal-aware paste) and an optional clipboard change token
//! (Windows: `GetClipboardSequenceNumber`; macOS: `NSPasteboard.changeCount`;
//! Linux: none portable → fixed-sleep waits). Everything else — caching the
//! user's clipboard, the copy-equals-cache ambiguity rule, the post-paste
//! consumption wait before restore — is identical across platforms and lives
//! here so no implementation can get the restore discipline wrong.
//!
//! Privacy (SPEC §10): captured and cached text stays in process memory and
//! is never logged. No Enter is ever synthesized (no auto-submit).

use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

use super::TargetApp;

/// Platform hooks for the clipboard lifecycle. Implementations only
/// synthesize chords and report clipboard changes; they never touch the
/// cache/restore discipline.
pub trait FallbackOps {
    /// Synthesize the platform copy chord (`Ctrl+C` / `Cmd+C`).
    fn send_copy(&self) -> Result<(), String>;
    /// Synthesize the platform select-all chord (`Ctrl+A` / `Cmd+A`).
    fn send_select_all(&self) -> Result<(), String>;
    /// Synthesize the paste chord for `target` — terminals take
    /// `Ctrl+Shift+V` on Windows/Linux, plain `Cmd+V` on macOS.
    fn send_paste(&self, target: &TargetApp) -> Result<(), String>;
    /// Token that changes whenever the OS clipboard content changes, or
    /// `None` when the platform can't say (waits degrade to a fixed sleep).
    fn clipboard_change_token(&self) -> Option<u64>;
}

/// What a clipboard capture should read.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CaptureScope {
    /// The current selection (`copy` only).
    Selection,
    /// The whole focused field (`select-all` then `copy`). Leaves the field
    /// with an active select-all — callers replace or abort right after.
    WholeField,
}

/// How a paste attempt failed.
#[derive(Debug)]
pub enum PasteFailure {
    /// Staging the payload on the clipboard failed: nothing was injected and
    /// there is NO fallback deliverable. Hard error.
    Stage(String),
    /// The paste was aborted but the payload IS staged on the clipboard —
    /// the caller surfaces "copied, paste manually" (`insert:fallback`).
    Staged(String),
}

/// Let the target apply a select-all before the follow-up chord lands.
const SELECT_ALL_SETTLE: Duration = Duration::from_millis(60);
/// Cap on waiting for the target to service the copy and publish.
const COPY_WAIT_CAP: Duration = Duration::from_millis(180);
/// Post-paste settle before the original clipboard is restored. Generous on
/// purpose: heavyweight targets (e.g. Windows 11 Notepad) process the chord
/// noticeably after activation, and a restore that lands first races their
/// clipboard open and silently drops the paste.
const PASTE_CONSUME: Duration = Duration::from_millis(500);

/// Capture text via the clipboard: cache → (select-all →) synthetic copy →
/// bounded wait for the target to publish → read → restore the cache.
///
/// Returns `None` when nothing landed (no selection, or the target blocked
/// the chord — typical cause on Windows: UIPI vs. an elevated target) and
/// when the copy yields exactly the cached clipboard: that is ambiguous —
/// most likely the chord was a no-op and we re-read our own cache — so it is
/// treated as no capture rather than acting on stale data.
pub fn capture_text(
    app: &AppHandle,
    ops: &dyn FallbackOps,
    scope: CaptureScope,
) -> Option<String> {
    // Cache first. Best-effort: a non-text clipboard simply won't be restored.
    let original = app.clipboard().read_text().ok();

    if scope == CaptureScope::WholeField {
        ops.send_select_all().ok()?;
        std::thread::sleep(SELECT_ALL_SETTLE);
    }
    // Sampled after caching (a read never bumps the token) and before the copy.
    let before = ops.clipboard_change_token();
    ops.send_copy().ok()?;
    // Return the instant the target publishes its copy, capped — a fast
    // target never pays the worst-case wait, a slow one is still bounded.
    wait_clipboard_change(ops, before, COPY_WAIT_CAP);

    let copied = app.clipboard().read_text().ok();

    if let Some(ref original) = original {
        if let Err(e) = app.clipboard().write_text(original.clone()) {
            // Log the failure only — never the text (SPEC §10).
            log::error!("capture_text: restoring original clipboard failed: {e}");
        }
    }

    let copied = copied?.trim().to_string();
    if copied.is_empty() {
        return None;
    }
    if let Some(original) = original {
        if original.trim() == copied {
            return None; // ambiguous: likely re-read our own cache
        }
    }
    Some(copied)
}

/// Inject `text` into a target via the clipboard: cache → stage the payload →
/// `prepare()` → (select-all →) synthetic paste → wait for consumption →
/// restore the cache. Never synthesizes Enter.
///
/// `prepare` is the caller's focus dance (hide own window, restore focus to
/// the target, VERIFY it really is foreground) and returns the verified
/// [`TargetApp`]. It runs after staging so its failure still leaves the
/// payload on the clipboard — the fallback deliverable ([`PasteFailure::Staged`]).
///
/// `select_all_first` gives replace semantics: the whole field is selected in
/// the verified-foreground window immediately before the paste overwrites it.
pub fn paste_text(
    app: &AppHandle,
    ops: &dyn FallbackOps,
    text: String,
    select_all_first: bool,
    prepare: impl FnOnce() -> Result<TargetApp, String>,
) -> Result<(), PasteFailure> {
    // Cache the user's clipboard so it can be restored after the paste.
    let original = app.clipboard().read_text().ok();

    // Stage the payload. This is also the fallback deliverable, so it happens
    // before anything irreversible; failure here is a hard error.
    app.clipboard()
        .write_text(text)
        .map_err(|e| PasteFailure::Stage(format!("clipboard write: {e}")))?;

    let target = prepare().map_err(PasteFailure::Staged)?;

    if select_all_first {
        ops.send_select_all()
            .map_err(|e| PasteFailure::Staged(format!("select-all chord failed: {e}")))?;
    }
    // Typical failure cause on Windows: UIPI blocking SendInput into an
    // elevated window.
    ops.send_paste(&target)
        .map_err(|e| PasteFailure::Staged(format!("paste chord failed: {e}")))?;

    // Let the target consume the paste before swapping the clipboard back.
    std::thread::sleep(PASTE_CONSUME);
    if let Some(original) = original {
        if let Err(e) = app.clipboard().write_text(original) {
            log::error!("paste_text: restoring original clipboard failed: {e}");
        }
    }
    Ok(())
}

/// Poll the platform clipboard token until it moves past `before`, capped
/// (5 ms steps). Without a token the full cap is slept — the only safe
/// assumption on platforms that can't report clipboard changes.
fn wait_clipboard_change(ops: &dyn FallbackOps, before: Option<u64>, cap: Duration) {
    let Some(before) = before else {
        std::thread::sleep(cap);
        return;
    };
    let step = Duration::from_millis(5);
    let mut waited = Duration::ZERO;
    while waited < cap {
        if ops.clipboard_change_token() != Some(before) {
            return;
        }
        std::thread::sleep(step);
        waited += step;
    }
}
