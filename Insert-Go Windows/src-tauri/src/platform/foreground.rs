//! Foreground-window capture, focus restore, and process/title lookup
//! (SPEC §4.1, §5.5, §7.1).
//!
//! All Win32 `unsafe` for the injection pipeline lives here, in small
//! functions with `// SAFETY:` notes (SPEC §6.2, §14). Handles are passed
//! around as raw `isize` because `HWND` is not `Send` and the captured target
//! must sit in Tauri managed state across threads.
//!
//! Focus restore uses the `AttachThreadInput` workaround: a background process
//! is normally denied `SetForegroundWindow` ("An application cannot force a
//! window to the foreground while the user is working with another window"),
//! but attaching our input queue to the current foreground thread makes the
//! OS accept it. Success is judged by re-reading `GetForegroundWindow()`, not
//! by the BOOL return — that BOOL is unreliable from a background process.

#[cfg(target_os = "windows")]
mod imp {
    use windows::Win32::Foundation::{CloseHandle, HWND};
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, IsIconic,
        IsWindow, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };

    /// Rebuild an `HWND` from the raw value produced by [`capture`].
    fn to_hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    /// Raw handle of the current foreground window, or `None` if there is
    /// none (e.g. a locked desktop).
    pub fn capture() -> Option<isize> {
        // SAFETY: GetForegroundWindow takes no arguments and returns a
        // possibly-null HWND; we only read it.
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_invalid() {
            None
        } else {
            Some(hwnd.0 as isize)
        }
    }

    /// Poll (~10ms × `attempts`) until `hwnd` is the foreground window.
    ///
    /// The cross-thread foreground handoff is asynchronous: when
    /// `SetForegroundWindow` returns, the target "is becoming the foreground
    /// window" but is not necessarily it yet (Old New Thing, 2016-11-18), so
    /// a synchronous `GetForegroundWindow()` check right after the call
    /// reports false negatives.
    fn wait_foreground(hwnd: HWND, attempts: u32) -> bool {
        for _ in 0..attempts {
            // SAFETY: GetForegroundWindow takes no arguments and returns a
            // possibly-null HWND; we only compare it.
            if unsafe { GetForegroundWindow() } == hwnd {
                return true;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        // SAFETY: as above.
        let fg = unsafe { GetForegroundWindow() };
        fg == hwnd
    }

    /// Bring the captured window back to the foreground. Returns whether the
    /// target actually ended up foreground — callers must not paste otherwise.
    ///
    /// Every attempt is followed by [`wait_foreground`] rather than a bare
    /// synchronous check, and in the `AttachThreadInput` branch the input
    /// queues stay attached until the switch is observed — detaching while
    /// the handoff is still in flight actively breaks it (pywinauto #117).
    /// Worst case this blocks ~500ms; it runs on the main thread (whose input
    /// queue `AttachThreadInput` needs) and callers guard with a timeout.
    pub fn focus_window(hwnd_raw: isize) -> bool {
        if hwnd_raw == 0 {
            return false;
        }
        let hwnd = to_hwnd(hwnd_raw);
        // SAFETY: hwnd came from our own GetForegroundWindow capture; every
        // call below tolerates a stale/destroyed handle (IsWindow guards, and
        // the Win32 calls fail benignly on invalid handles).
        unsafe {
            if !IsWindow(Some(hwnd)).as_bool() {
                return false;
            }
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            if GetForegroundWindow() == hwnd {
                return true;
            }
            // Plain attempt first — succeeds when the OS already considers us
            // the "last input" process (we just hid our own foreground
            // window). Short wait: enough for an accepted handoff to land,
            // cheap when the request was denied outright.
            let _ = SetForegroundWindow(hwnd);
            if wait_foreground(hwnd, 10) {
                return true;
            }
            // Denied: attach our input queue to the current foreground thread
            // so the OS accepts the request, wait for the switch to complete,
            // and only then detach.
            let fg = GetForegroundWindow();
            let fg_thread = if fg.is_invalid() {
                0
            } else {
                GetWindowThreadProcessId(fg, None)
            };
            let current = GetCurrentThreadId();
            if fg_thread != 0 && fg_thread != current {
                let attached = AttachThreadInput(current, fg_thread, true).as_bool();
                let _ = SetForegroundWindow(hwnd);
                let _ = BringWindowToTop(hwnd);
                let switched = wait_foreground(hwnd, 40);
                if attached {
                    let _ = AttachThreadInput(current, fg_thread, false);
                }
                return switched;
            }
            GetForegroundWindow() == hwnd
        }
    }

    /// Executable file name ("notepad.exe") of the process owning the window.
    pub fn process_name(hwnd_raw: isize) -> Option<String> {
        if hwnd_raw == 0 {
            return None;
        }
        let hwnd = to_hwnd(hwnd_raw);
        // SAFETY: pid is a valid out-pointer for the duration of the call; the
        // process handle is opened with the least-privilege query right and
        // closed on every path before returning.
        unsafe {
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return None;
            }
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let queried = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buf.as_mut_ptr()),
                &mut len,
            );
            let _ = CloseHandle(handle);
            queried.ok()?;
            let full = String::from_utf16_lossy(&buf[..len as usize]);
            full.rsplit(['\\', '/']).next().map(str::to_string)
        }
    }

    /// Title bar text of the window, or `None` when empty/unreadable.
    pub fn window_title(hwnd_raw: isize) -> Option<String> {
        if hwnd_raw == 0 {
            return None;
        }
        let hwnd = to_hwnd(hwnd_raw);
        // SAFETY: GetWindowTextW writes at most buf.len() u16s (slice binding
        // passes the length) and returns the count actually written.
        unsafe {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len <= 0 {
                return None;
            }
            Some(String::from_utf16_lossy(&buf[..len as usize]))
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn hwnd_round_trips_through_isize() {
            let raw: isize = 0x0000_7FF6_1234_ABC0_u64 as isize;
            let hwnd = to_hwnd(raw);
            assert_eq!(hwnd.0 as isize, raw);
        }

        #[test]
        fn null_handle_is_rejected_everywhere() {
            assert!(!focus_window(0));
            assert!(process_name(0).is_none());
            assert!(window_title(0).is_none());
        }

        #[test]
        fn stale_handle_fails_fast_without_polling() {
            // Real HWNDs are even (low bits reserved); 1 is never a window,
            // so the IsWindow guard must reject it before any wait loop.
            let start = std::time::Instant::now();
            assert!(!focus_window(1));
            assert!(start.elapsed() < std::time::Duration::from_millis(50));
        }
    }
}

/// Non-Windows stubs so the crate builds cross-platform (SPEC §2.1): capture
/// yields no target and focus restore always reports failure, which routes
/// `insert_text` to its clipboard-only fallback.
#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn capture() -> Option<isize> {
        None
    }

    pub fn focus_window(_hwnd_raw: isize) -> bool {
        false
    }

    pub fn process_name(_hwnd_raw: isize) -> Option<String> {
        None
    }

    pub fn window_title(_hwnd_raw: isize) -> Option<String> {
        None
    }
}

pub use imp::{capture, focus_window, process_name, window_title};
