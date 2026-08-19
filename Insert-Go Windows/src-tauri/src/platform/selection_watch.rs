//! Selection-gesture detection for the skill bar (SPEC §5.1 platform hook —
//! flagged surface, kill switch: `settings.selection_bar`).
//!
//! Low-level `WH_MOUSE_LL` / `WH_KEYBOARD_LL` hooks — NOT UIA events, which
//! are unreliable on Chromium targets and, via windows-rs array-property
//! handlers, heap-corrupting (windows-rs #3818). The hook procs do the bare
//! minimum (classify the gesture, push one enum onto a channel, call
//! `CallNextHookEx`); a worker thread debounces the *Check* path ~90 ms (a
//! *Hide* runs immediately, so a deselect never waits out the debounce),
//! applies the scope gate (allowlist or opt-in "all"), reads the selection
//! (`platform::selection`) and shows/hides the bar (`platform::skillbar_window`).
//!
//! Gestures split into two routes: [`imp::Route::Check`] for a gesture that
//! plausibly CREATED a selection (drag, double-click, Shift+navigation
//! release) — worth a real UIA/clipboard read — and `Route::Hide` for one
//! that ALWAYS collapses a selection (a plain click, a bare navigation key
//! with no Shift, Escape) — hidden unconditionally, without reading first.
//! That split matters: without UIA event subscriptions there is no signal
//! for when Chromium/Electron's a11y cache catches up to a mere selection
//! collapse, so re-reading on every gesture would sometimes see stale,
//! still-selected text and leave the bar stuck open after a plain deselect.
//!
//! Privacy (SPEC §10): the keyboard hook never inspects character keys — it
//! matches only Shift transitions, the eight navigation keys, and Escape.
//! Nothing typed is stored, forwarded, or logged. Reads are scoped to the
//! allowlist (or, only behind the explicit off-by-default "all" opt-in, every
//! app except InsertGo and the credential-UI blocklist); merely showing the
//! bar makes no network call.

use crate::error::AppResult;
use tauri::AppHandle;

/// `true` when `process` (an executable file name) is in the user's
/// allowlist. Case-insensitive — Windows process names aren't case-stable.
pub fn allowlisted(process: &str, allow: &[String]) -> bool {
    let process = process.trim();
    allow
        .iter()
        .any(|entry| entry.trim().eq_ignore_ascii_case(process))
}

/// `true` when `process` matches `pattern` case-insensitively. `pattern` may
/// carry a single `*` wildcard standing for any (possibly empty) run of
/// characters, so one blocklist line (`keepass*.exe`) covers a family of
/// versioned executables. Process names are ASCII, so byte slicing is safe.
fn matches_pattern(process: &str, pattern: &str) -> bool {
    let process = process.trim();
    let pattern = pattern.trim();
    match pattern.split_once('*') {
        None => pattern.eq_ignore_ascii_case(process),
        Some((prefix, suffix)) => {
            process.len() >= prefix.len() + suffix.len()
                && process
                    .get(..prefix.len())
                    .is_some_and(|p| p.eq_ignore_ascii_case(prefix))
                && process
                    .get(process.len() - suffix.len()..)
                    .is_some_and(|s| s.eq_ignore_ascii_case(suffix))
        }
    }
}

/// `true` when `process` is on the blocklist — read from it NEVER, even in
/// `"all"` scope (SPEC §10: password managers / credential UIs). Supports the
/// `*` wildcard via [`matches_pattern`].
pub fn blocklisted(process: &str, block: &[String]) -> bool {
    block
        .iter()
        .any(|pattern| matches_pattern(process, pattern))
}

/// Pure scope decision (SPEC §10): may the watcher read `process`? `is_own`
/// (whether the foreground is InsertGo itself) is supplied by the caller so
/// this stays a pure, unit-testable function.
///
/// - `"all"`  ⇒ read anything except InsertGo and the blocklist (explicit,
///   off-by-default opt-in).
/// - anything else (default `"allowlist"`) ⇒ read only the allowlist — the
///   privacy-preserving default that never silently widens on upgrade.
pub fn scope_allows(
    process: &str,
    is_own: bool,
    scope: &str,
    allow: &[String],
    block: &[String],
) -> bool {
    if is_own {
        return false;
    }
    if scope == "all" {
        !blocklisted(process, block)
    } else {
        allowlisted(process, allow)
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::scope_allows;
    use crate::error::{AppError, AppResult};
    use crate::platform::{foreground, skillbar_window};
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};
    use std::sync::mpsc::{Receiver, Sender};
    use std::sync::OnceLock;
    use std::time::Duration;
    use tauri::AppHandle;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetDoubleClickTime, VK_DOWN, VK_END, VK_ESCAPE, VK_HOME, VK_LEFT, VK_LSHIFT, VK_NEXT,
        VK_PRIOR, VK_RIGHT, VK_RSHIFT, VK_SHIFT, VK_UP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, HC_ACTION,
        KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
        WM_LBUTTONDOWN, WM_LBUTTONUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    /// What a hook proc observed.
    enum WatchEvent {
        /// A gesture that plausibly CREATED or EXTENDED a selection (drag,
        /// double-click, Shift+navigation release) — worth a real read
        /// (UIA, with the clipboard fallback allowed).
        Gesture {
            /// Screen point of a mouse gesture — the worker drops gestures
            /// landing on the bar itself (a skill-icon click must not
            /// re-trigger a selection check that would tear the bar down).
            /// `None` for keyboard gestures.
            point: Option<(i32, i32)>,
        },
        /// A gesture that ALWAYS collapses/removes any existing selection —
        /// a plain click (press+release, no drag, not a double-click) or a
        /// bare navigation key (no Shift held). Hidden unconditionally,
        /// WITHOUT re-reading the selection first: without UIA event
        /// subscriptions (avoided deliberately — see module docs) there is
        /// no signal for when Chromium/Electron's a11y cache actually
        /// catches up to a mere selection collapse, so a fresh read coming
        /// back non-empty here would likely be stale, not real (this was
        /// the actual bug — the bar stayed up after a plain deselect click).
        Cleared {
            point: Option<(i32, i32)>,
        },
        Dismiss,
    }

    /// Channel into the worker. `OnceLock` because the hook procs are plain
    /// `extern "system"` fns with no capture.
    static TX: OnceLock<Sender<WatchEvent>> = OnceLock::new();

    // Last WM_LBUTTONDOWN, for drag distance + double-click detection.
    // Atomics: hook procs must not block on a lock.
    static DOWN_X: AtomicI32 = AtomicI32::new(0);
    static DOWN_Y: AtomicI32 = AtomicI32::new(0);
    static DOWN_TIME: AtomicU32 = AtomicU32::new(0);
    static PREV_DOWN_TIME: AtomicU32 = AtomicU32::new(0);

    // Shift-selection tracking: a Shift release only counts as a selection
    // gesture when a NAVIGATION key was pressed while Shift was held
    // (Shift+arrows/Home/End/…). Otherwise every capital letter typed in an
    // allowlisted app would fire a pointless (and clipboard-churning) check.
    static SHIFT_DOWN: AtomicBool = AtomicBool::new(false);
    static SHIFT_NAV: AtomicBool = AtomicBool::new(false);

    /// Manhattan drag distance (px) beyond which a press-release counts as a
    /// selection drag rather than a click.
    const DRAG_THRESHOLD: i32 = 6;

    /// Quiet window after the last gesture before reading the selection —
    /// collapses gesture bursts (double-click = two ups) into one read. Only
    /// the Check path pays this; a Hide runs immediately. Trimmed from 180 ms
    /// to 90 ms to cut the "coming" latency without splitting a double-click
    /// (the system double-click time is ~500 ms, well outside this window).
    const DEBOUNCE: Duration = Duration::from_millis(90);

    use windows::Win32::System::LibraryLoader::GetModuleHandleW;

    /// Install both hooks (caller must be the main thread — LL hooks need a
    /// thread that pumps messages) and spawn the worker.
    pub fn install(app: &AppHandle) -> AppResult<()> {
        let (tx, rx) = std::sync::mpsc::channel();
        TX.set(tx)
            .map_err(|_| AppError::Os("selection watch installed twice".into()))?;

        let worker_app = app.clone();
        std::thread::Builder::new()
            .name("selection-watch".into())
            .spawn(move || worker(worker_app, rx))
            .map_err(|e| AppError::Os(format!("selection watch worker: {e}")))?;

        std::thread::Builder::new()
            .name("windows-hooks".into())
            .spawn(move || {
                let hmod = unsafe { GetModuleHandleW(None) }.unwrap_or_default();
                let hinstance = windows::Win32::Foundation::HINSTANCE(hmod.0);
                unsafe {
                    if let Err(e) =
                        SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), Some(hinstance), 0)
                    {
                        log::warn!("WH_MOUSE_LL hook failed: {e:?}");
                    }
                    if let Err(e) =
                        SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), Some(hinstance), 0)
                    {
                        log::warn!("WH_KEYBOARD_LL hook failed: {e:?}");
                    }
                }

                // Run a message loop for this thread!
                unsafe {
                    let mut msg = MSG::default();
                    while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                        DispatchMessageW(&msg);
                    }
                }
            })
            .map_err(|e| AppError::Os(format!("windows hooks thread spawn failed: {e}")))?;

        Ok(())
    }

    /// Mouse hook: classify left-button gestures. Runs on the main thread's
    /// message pump with a hard OS timeout — do (almost) nothing here.
    unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            // SAFETY: for WH_MOUSE_LL with code == HC_ACTION, lparam points
            // to a valid MSLLHOOKSTRUCT for the duration of the call.
            let ms = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };
            match wparam.0 as u32 {
                WM_LBUTTONDOWN => {
                    PREV_DOWN_TIME.store(DOWN_TIME.load(Ordering::Relaxed), Ordering::Relaxed);
                    DOWN_X.store(ms.pt.x, Ordering::Relaxed);
                    DOWN_Y.store(ms.pt.y, Ordering::Relaxed);
                    DOWN_TIME.store(ms.time, Ordering::Relaxed);
                }
                WM_LBUTTONUP => {
                    let dx = (ms.pt.x - DOWN_X.load(Ordering::Relaxed)).abs();
                    let dy = (ms.pt.y - DOWN_Y.load(Ordering::Relaxed)).abs();
                    let dragged = dx + dy >= DRAG_THRESHOLD;
                    // Double-click = this press started within the system
                    // double-click time of the previous press.
                    let down = DOWN_TIME.load(Ordering::Relaxed);
                    let prev = PREV_DOWN_TIME.load(Ordering::Relaxed);
                    // SAFETY: GetDoubleClickTime takes no arguments.
                    let double =
                        prev != 0 && down.wrapping_sub(prev) <= unsafe { GetDoubleClickTime() };
                    let shift_held = SHIFT_DOWN.load(Ordering::Relaxed);
                    let point = Some((ms.pt.x, ms.pt.y));
                    if dragged || double || shift_held {
                        send(WatchEvent::Gesture { point });
                    } else {
                        // A plain click always collapses whatever was
                        // selected (whether inside or outside it) to a
                        // caret — deterministic deselect, no read needed.
                        send(WatchEvent::Cleared { point });
                    }
                }
                _ => {}
            }
        }
        // SAFETY: forwarding the event unchanged, as every hook must.
        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    /// Keyboard hook: a Shift release after Shift+navigation ends a keyboard
    /// selection (real check); a bare navigation key (Shift NOT held)
    /// always collapses any existing selection (deterministic clear, same
    /// as a plain click); Escape dismisses the bar. The only non-Shift keys
    /// examined are the eight navigation keys — never characters (privacy
    /// note above).
    unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let msg = wparam.0 as u32;
            // SAFETY: for WH_KEYBOARD_LL with code == HC_ACTION, lparam
            // points to a valid KBDLLHOOKSTRUCT for the call's duration.
            let kb = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
            let vk = kb.vkCode as u16;
            let is_shift = vk == VK_SHIFT.0 || vk == VK_LSHIFT.0 || vk == VK_RSHIFT.0;
            let is_nav = [
                VK_LEFT, VK_RIGHT, VK_UP, VK_DOWN, VK_HOME, VK_END, VK_PRIOR, VK_NEXT,
            ]
            .iter()
            .any(|nav| vk == nav.0);

            if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
                if is_shift {
                    SHIFT_DOWN.store(true, Ordering::Relaxed);
                } else if is_nav {
                    if SHIFT_DOWN.load(Ordering::Relaxed) {
                        SHIFT_NAV.store(true, Ordering::Relaxed);
                    } else {
                        // Arrow/Home/End/… with no Shift: collapses any
                        // existing selection to a caret.
                        send(WatchEvent::Cleared { point: None });
                    }
                }
            } else if msg == WM_KEYUP || msg == WM_SYSKEYUP {
                if is_shift {
                    SHIFT_DOWN.store(false, Ordering::Relaxed);
                    if SHIFT_NAV.swap(false, Ordering::Relaxed) {
                        send(WatchEvent::Gesture { point: None });
                    }
                } else if vk == VK_ESCAPE.0 {
                    send(WatchEvent::Dismiss);
                }
            }
        }
        // SAFETY: forwarding the event unchanged.
        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    fn send(event: WatchEvent) {
        if let Some(tx) = TX.get() {
            let _ = tx.send(event);
        }
    }

    /// What one routed event asks the worker to do.
    #[derive(Clone, Copy, PartialEq, Eq)]
    enum Route {
        /// Worth a real selection read (UIA + clipboard fallback).
        Check,
        /// Guaranteed no selection — hide without reading.
        Hide,
    }

    /// Worker: debounce gestures, apply the settings gate + allowlist, read
    /// the selection, drive the bar. All the heavy/blocking work lives here,
    /// never in the hook procs.
    fn worker(app: AppHandle, rx: Receiver<WatchEvent>) {
        // Gestures on the bar itself are dropped outright: the click that
        // starts a skill run must not trigger a re-check that would hide the
        // bar and clear the paste target mid-run. The returned bool is the
        // gesture's pointer-ness (Some point ⇒ mouse), carried to the read so
        // the clipboard I-beam guard applies only to pointer selections.
        let route = |event: WatchEvent| -> Option<(Route, bool)> {
            let (point, kind) = match event {
                WatchEvent::Dismiss => return Some((Route::Hide, false)),
                WatchEvent::Gesture { point } => (point, Route::Check),
                WatchEvent::Cleared { point } => (point, Route::Hide),
            };
            if let Some((x, y)) = point {
                if skillbar_window::is_point_in_bar(&app, x, y) {
                    return None;
                }
            }
            Some((kind, point.is_some()))
        };

        while let Ok(event) = rx.recv() {
            let (routed, mut pointer) = match route(event) {
                None => continue,
                Some(r) => r,
            };

            // A Hide runs immediately — a deselect (plain click, bare arrow,
            // Escape) must never wait out the debounce; that lag was the
            // "going" latency. Only the Check path debounces.
            if routed == Route::Hide {
                skillbar_window::hide_skillbar(&app);
                continue;
            }

            // Check: absorb the rest of the burst (double-click emits two ups;
            // drag-release plus Shift-up can coincide) into one read. A real
            // gesture anywhere in the burst wins, carrying its pointer-ness.
            std::thread::sleep(DEBOUNCE);
            while let Ok(next) = rx.try_recv() {
                if let Some((Route::Check, p)) = route(next) {
                    pointer = p;
                }
            }
            check_selection(&app, pointer);
        }
    }

    /// One debounced check: settings gate → scope → read → show/hide. Only
    /// reached for a real gesture (drag, double-click, Shift+nav). `pointer`
    /// is true for a mouse gesture: it gates the clipboard I-beam guard so a
    /// synthetic `Ctrl+C` never fires on a non-text pointer drag, while a
    /// keyboard Shift+nav selection (cursor not over text) still reaches it.
    fn check_selection(app: &AppHandle, pointer: bool) {
        // Re-read settings every gesture (µs-scale JSON read, user-paced
        // cadence) so toggling the feature or editing the scope/allowlist
        // applies live, without a settings-changed plumbing channel.
        let settings = crate::domain::settings::load_settings(app.clone()).unwrap_or_default();

        if !settings.selection_bar {
            skillbar_window::hide_skillbar(app);
            return;
        }

        let process = foreground::capture().and_then(foreground::process_name);
        let allowed = match process.as_deref() {
            None => false,
            Some(name) => scope_allows(
                name,
                is_own_process(name),
                &settings.selection_bar_scope,
                &settings.selection_bar_apps,
                &settings.selection_bar_blocklist,
            ),
        };
        if !allowed {
            // Foreground is out of scope (blocklisted, unlisted, or InsertGo
            // itself): retract the bar, and never read from it.
            skillbar_window::hide_skillbar(app);
            return;
        }

        match crate::platform::text_provider::provider().read_selection(app, true, pointer) {
            Some(sel) if !sel.text.trim().is_empty() => {
                if let Err(e) = skillbar_window::show_at(app, &sel) {
                    // Positioning/emit plumbing only — never the text.
                    log::warn!("skill bar show failed: {e}");
                }
            }
            _ => skillbar_window::hide_skillbar(app),
        }
    }

    /// InsertGo's own executable file name, resolved once. Used to keep the
    /// "all" scope from ever reading InsertGo's own windows (the allowlist
    /// scope excludes them implicitly by never listing them).
    fn is_own_process(name: &str) -> bool {
        static OWN_EXE: OnceLock<Option<String>> = OnceLock::new();
        OWN_EXE
            .get_or_init(|| {
                std::env::current_exe()
                    .ok()
                    .and_then(|p| p.file_name().map(|f| f.to_string_lossy().into_owned()))
            })
            .as_deref()
            .is_some_and(|own| own.eq_ignore_ascii_case(name))
    }
}

/// Non-Windows stub: no hooks, the bar simply never appears (SPEC §2.1).
#[cfg(not(target_os = "windows"))]
mod imp {
    use crate::error::AppResult;
    use tauri::AppHandle;

    pub fn install(_app: &AppHandle) -> AppResult<()> {
        Ok(())
    }
}

/// Install the selection watcher. Must be called from the main thread (the
/// LL hooks bind to the calling thread's message pump).
pub fn install(app: &AppHandle) -> AppResult<()> {
    imp::install(app)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allow() -> Vec<String> {
        vec!["claude.exe".into(), "Perplexity.exe".into()]
    }

    #[test]
    fn allowlist_matches_case_insensitively() {
        assert!(allowlisted("Claude.exe", &allow()));
        assert!(allowlisted("perplexity.EXE", &allow()));
    }

    #[test]
    fn allowlist_rejects_unlisted_and_similar_names() {
        assert!(!allowlisted("explorer.exe", &allow()));
        assert!(!allowlisted("claude", &allow()));
        assert!(!allowlisted("", &allow()));
    }

    #[test]
    fn allowlist_tolerates_padded_entries() {
        assert!(allowlisted(" claude.exe ", &allow()));
        assert!(allowlisted("codex.exe", &[" Codex.exe".to_string()]));
    }

    #[test]
    fn empty_allowlist_matches_nothing() {
        assert!(!allowlisted("claude.exe", &[]));
    }

    fn block() -> Vec<String> {
        vec![
            "1password.exe".into(),
            "keepass*.exe".into(),
            "bitwarden.exe".into(),
        ]
    }

    #[test]
    fn blocklist_matches_exact_and_wildcard_case_insensitively() {
        assert!(blocklisted("1Password.exe", &block()));
        // `keepass*.exe` covers the whole versioned family.
        assert!(blocklisted("KeePass.exe", &block()));
        assert!(blocklisted("keepassxc.exe", &block()));
        assert!(blocklisted("KeePass2.exe", &block()));
        assert!(!blocklisted("keepass.txt", &block())); // suffix must match
        assert!(!blocklisted("notepad.exe", &block()));
    }

    #[test]
    fn wildcard_requires_prefix_and_suffix_room() {
        // The `*` may match an empty run, but prefix+suffix must both fit.
        assert!(matches_pattern("keepass.exe", "keepass*.exe"));
        assert!(!matches_pattern("kee.exe", "keepass*.exe"));
        assert!(!matches_pattern("", "keepass*.exe"));
    }

    #[test]
    fn scope_allowlist_reads_only_listed_apps() {
        let apps = allow();
        assert!(scope_allows(
            "claude.exe",
            false,
            "allowlist",
            &apps,
            &block()
        ));
        assert!(!scope_allows(
            "explorer.exe",
            false,
            "allowlist",
            &apps,
            &block()
        ));
        // In allowlist scope the blocklist is irrelevant — an unlisted app is
        // rejected regardless.
        assert!(!scope_allows(
            "1password.exe",
            false,
            "allowlist",
            &apps,
            &block()
        ));
    }

    #[test]
    fn scope_all_reads_anything_but_blocklist_and_self() {
        let apps = allow();
        // An unlisted app is now readable in "all" scope.
        assert!(scope_allows("explorer.exe", false, "all", &apps, &block()));
        // …but never a blocklisted credential UI, even in "all".
        assert!(!scope_allows(
            "1password.exe",
            false,
            "all",
            &apps,
            &block()
        ));
        assert!(!scope_allows(
            "KeePassXC.exe",
            false,
            "all",
            &apps,
            &block()
        ));
    }

    #[test]
    fn own_process_is_never_read_in_any_scope() {
        let apps = allow();
        assert!(!scope_allows("claude.exe", true, "all", &apps, &block()));
        assert!(!scope_allows(
            "claude.exe",
            true,
            "allowlist",
            &apps,
            &block()
        ));
    }
}
