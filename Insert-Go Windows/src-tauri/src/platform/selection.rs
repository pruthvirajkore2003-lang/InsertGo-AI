//! Cross-process selected-text read for the skill bar (SPEC §4.1 extension).
//!
//! Three-tier strategy, mirroring 0xfullex/selection-hook:
//!   1. **UI Automation** — non-destructive (`TextPattern::GetSelection`
//!      + `GetBoundingRectangles` give the text and its screen rect). Read in
//!      a short bounded retry loop: Chromium/WebView2 build the UIA tree
//!      asynchronously, so the first read after the watcher's 90 ms debounce
//!      often lands ~100–200 ms before the provider exists. Native apps with
//!      a live provider return on the first attempt.
//!   2. **IAccessible / MSAA** — a middle tier for legacy controls that expose
//!      their selection as an accessible child object (`accSelection` →
//!      `get_accName`/`get_accValue`), resolved with NO clipboard churn.
//!   3. **Clipboard fallback** — cache the user's clipboard → synthetic `Ctrl+C`
//!      → read → restore, for targets whose UIA/MSAA trees are unreliable
//!      (Electron/Chromium materialize accessibility lazily, so a plain read
//!      often comes back empty there). Guarded by an I-beam cursor check for
//!      pointer gestures so a synthetic copy never fires on a non-text drag,
//!      and its post-copy wait is a bounded clipboard-sequence poll (returns
//!      the instant the target publishes) rather than a fixed sleep.
//!
//! All UIA/MSAA property reads are SYNCHRONOUS, on the caller's thread. UIA
//! event subscriptions are deliberately absent: registering handlers for
//! array-typed properties via windows-rs corrupts the heap (windows-rs
//! #3818), and the `uiautomation` crate's `event` feature stays off. The MSAA
//! tier honors only the single-object selection case for the same reason — the
//! `VT_ARRAY` multi-select path's manual `SAFEARRAY<VARIANT>` teardown is the
//! exact double-`VariantClear` hazard behind that bug.
//!
//! Privacy (SPEC §10, clipboard.rs note): the selected text and the cached
//! clipboard text stay in process memory and are NEVER logged.

/// Screen-space rectangle in physical pixels (UIA reports physical
/// coordinates; `SetWindowPos` consumes the same space).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// One selection snapshot: what is selected, where it is on screen (when UIA
/// could say), and which window owns it (the later paste target).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SelectionRead {
    pub text: String,
    /// `None` on the clipboard-fallback path — position at the cursor instead.
    pub rect: Option<ScreenRect>,
    /// Raw HWND of the owning (foreground) window, as `isize` because `HWND`
    /// is not `Send` (same convention as `PriorWindow`).
    pub source_hwnd: isize,
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{ScreenRect, SelectionRead};
    use crate::platform::foreground;
    use crate::platform::text_provider::{fallback, WinFallbackOps};
    use std::cell::RefCell;
    use tauri::AppHandle;
    use uiautomation::patterns::UITextPattern;
    use uiautomation::UIAutomation;
    use windows::Win32::System::Ole::{SafeArrayDestroy, SafeArrayGetElement, SafeArrayGetUBound};
    use windows::Win32::UI::Accessibility::IUIAutomationTextRange;

    thread_local! {
        /// One UIA client per calling thread. `UIAutomation::new` initializes
        /// COM (MTA) for the thread; `new_direct` is the fallback when the
        /// thread already holds an incompatible apartment (RPC_E_CHANGED_MODE).
        static AUTOMATION: RefCell<Option<UIAutomation>> = const { RefCell::new(None) };
    }

    /// Read the current selection from the foreground app.
    ///
    /// `allow_clipboard_fallback` gates the synthetic-`Ctrl+C` path: it must
    /// only run on an explicit selection gesture — on a plain caret click a
    /// stray `Ctrl+C` could trigger target-side behavior (e.g. copy-line) and
    /// would churn the user's clipboard for nothing.
    ///
    /// `pointer_gesture` says the triggering gesture was a mouse gesture. It
    /// gates the clipboard I-beam guard: a pointer gesture that ended off a
    /// text cursor (dragging icons, a canvas) is not a text selection, so the
    /// clipboard tier is skipped; a keyboard Shift+nav selection (cursor may be
    /// anywhere) is exempt and still reaches the clipboard.
    pub fn read_selection(
        app: &AppHandle,
        allow_clipboard_fallback: bool,
        pointer_gesture: bool,
    ) -> Option<SelectionRead> {
        let source_hwnd = foreground::capture()?;

        // UIA tier, polled: Chromium/WebView2 materialize their UIA tree
        // asynchronously after a drag ends, so a single read right after the
        // watcher's debounce often finds nothing even though the DOM has long
        // painted — and the clipboard tier then usually loses too (the cursor
        // rarely still reads as an I-beam at drag end). The tree is eventually
        // consistent, so retry a few times. First success returns immediately:
        // native apps with a live provider pay zero extra latency; only reads
        // where UIA comes up empty wait, and 4 × 40 ms brackets the observed
        // Chromium lag without stalling genuine non-text reads for long.
        // Synchronous polling only — UIA event handlers stay off (windows-rs
        // #3818 heap corruption, see module docs).
        const UIA_ATTEMPTS: u32 = 4;
        const UIA_RETRY_GAP: std::time::Duration = std::time::Duration::from_millis(40);
        for attempt in 0..UIA_ATTEMPTS {
            if attempt > 0 {
                std::thread::sleep(UIA_RETRY_GAP);
            }
            if let Some((text, rect)) = uia_selection() {
                return Some(SelectionRead {
                    text,
                    rect,
                    source_hwnd,
                });
            }
        }
        // MSAA middle tier: legacy controls that expose the selection as an
        // accessible child, resolved without any clipboard churn.
        if let Some((text, rect)) = msaa_selection(source_hwnd) {
            return Some(SelectionRead {
                text,
                rect,
                source_hwnd,
            });
        }
        if !allow_clipboard_fallback {
            return None;
        }
        let is_terminal = foreground::process_name(source_hwnd)
            .map(|p| crate::platform::clipboard::is_terminal_process(&p))
            .unwrap_or(false);
        // I-beam guard (pointer gestures only): skip the synthetic copy when
        // the cursor is not a text caret. Terminals are exempt because their
        // selection cursor is commonly not the standard Windows I-beam.
        if pointer_gesture && !cursor_is_ibeam() && !is_terminal {
            return None;
        }
        clipboard_selection(app, is_terminal).map(|text| SelectionRead {
            text,
            rect: None,
            source_hwnd,
        })
    }

    /// UIA path: focused element → TextPattern → first selected range.
    /// Any error (no pattern, empty tree, Chromium a11y not materialized)
    /// collapses to `None` so the caller can decide about the fallback.
    fn uia_selection() -> Option<(String, Option<ScreenRect>)> {
        AUTOMATION.with(|slot| {
            let mut slot = slot.borrow_mut();
            if slot.is_none() {
                *slot = UIAutomation::new()
                    .or_else(|_| UIAutomation::new_direct())
                    .ok();
            }
            let automation = slot.as_ref()?;

            let element = automation.get_focused_element().ok()?;
            let pattern: UITextPattern = element.get_pattern().ok()?;
            let ranges = pattern.get_selection().ok()?;
            let range = ranges.first()?;

            let text = range.get_text(-1).ok()?;
            let text = text.trim();
            if text.is_empty() {
                return None;
            }
            // Rect is best-effort: a missing rect only degrades positioning
            // (cursor anchor), never the read itself.
            let rect = range_rect(range).or_else(|| element_rect(range));
            Some((text.to_string(), rect))
        })
    }

    /// MSAA / IAccessible middle tier (SPEC §4.1): resolves controls that
    /// expose their selection as an accessible child object — legacy Win32
    /// lists and some rich controls — with no clipboard churn. Faithful to
    /// selection-hook's IAccessible path: `AccessibleObjectFromWindow` on the
    /// foreground window → `accSelection` → the selected child's `accName`
    /// (falling back to `accValue`) → `accLocation` for the rect.
    ///
    /// Only the single selected-object (`VT_DISPATCH`) case is honored. The
    /// `VT_ARRAY` multi-select path packs a `SAFEARRAY<VARIANT>` whose manual
    /// teardown is the double-`VariantClear` heap-corruption hazard behind
    /// windows-rs #3818 — it is deliberately skipped, falling through to the
    /// clipboard tier. For plain edit controls (no selected child objects)
    /// this returns `None` too, so it never regresses today's behavior.
    fn msaa_selection(hwnd_raw: isize) -> Option<(String, Option<ScreenRect>)> {
        use windows::core::Interface;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::Com::IDispatch;
        use windows::Win32::System::Variant::{VARIANT, VT_DISPATCH};
        use windows::Win32::UI::Accessibility::{AccessibleObjectFromWindow, IAccessible};
        use windows::Win32::UI::WindowsAndMessaging::{CHILDID_SELF, OBJID_CLIENT};

        let hwnd = HWND(hwnd_raw as *mut core::ffi::c_void);
        // SAFETY: `hwnd` is our captured foreground window. AccessibleObjectFrom-
        // Window fills a fresh out-pointer (or errors); `IAccessible::from_raw`
        // takes sole ownership of that reference. Every COM object below is
        // dropped exactly once by windows-rs (one Release / one VariantClear),
        // so nothing double-frees — and the VT_ARRAY path (the #3818 hazard) is
        // never entered. All the called methods are `unsafe fn`s invoked here.
        unsafe {
            let mut raw: *mut core::ffi::c_void = core::ptr::null_mut();
            AccessibleObjectFromWindow(hwnd, OBJID_CLIENT.0 as u32, &IAccessible::IID, &mut raw)
                .ok()?;
            if raw.is_null() {
                return None;
            }
            let acc = IAccessible::from_raw(raw);

            let selection = acc.accSelection().ok()?;
            if selection.vt() != VT_DISPATCH {
                return None; // empty, multi-select array, or bare string
            }
            let dispatch = IDispatch::try_from(&selection).ok()?;
            let selected: IAccessible = dispatch.cast().ok()?;

            let child = VARIANT::from(CHILDID_SELF as i32);
            // Prefer accName (the selected text for text-bearing objects); fall
            // back to accValue. (No closure: unsafe calls stay in this block.)
            let text = match selected.get_accName(&child).ok().filter(|b| !b.is_empty()) {
                Some(name) => name.to_string(),
                None => selected.get_accValue(&child).ok()?.to_string(),
            };
            let text = text.trim();
            if text.is_empty() {
                return None;
            }

            // Best-effort rect (physical screen px, same space as UIA): a
            // missing/degenerate rect only degrades positioning, never the read.
            let (mut x, mut y, mut w, mut h) = (0, 0, 0, 0);
            let rect = if selected
                .accLocation(&mut x, &mut y, &mut w, &mut h, &child)
                .is_ok()
                && w > 0
                && h > 0
            {
                Some(ScreenRect { x, y, w, h })
            } else {
                None
            };
            Some((text.to_string(), rect))
        }
    }

    /// `true` when the mouse cursor is currently the text I-beam. Gates the
    /// clipboard fallback for pointer gestures (SPEC §4.1 / selection-hook's
    /// `ShouldProcessViaClipboard`): a drag that ends off a text caret is not
    /// a text selection, so no synthetic `Ctrl+C` fires. Fails OPEN (returns
    /// `true`) on any query error so a transient failure never suppresses the
    /// fallback.
    fn cursor_is_ibeam() -> bool {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetCursorInfo, LoadCursorW, CURSORINFO, IDC_IBEAM,
        };
        // SAFETY: `info` is a valid out-param sized via `cbSize`; LoadCursorW
        // returns a shared, process-lifetime system cursor handle we only
        // compare, never free.
        unsafe {
            let mut info = CURSORINFO {
                cbSize: core::mem::size_of::<CURSORINFO>() as u32,
                ..Default::default()
            };
            if GetCursorInfo(&mut info).is_err() {
                return true;
            }
            match LoadCursorW(None, IDC_IBEAM) {
                Ok(ibeam) => info.hCursor == ibeam,
                Err(_) => true,
            }
        }
    }

    /// First rectangle of the selected range, via the raw COM interface —
    /// `uiautomation` 0.22 has no wrapper for `GetBoundingRectangles`. The
    /// returned SAFEARRAY packs rectangles as flat `[left, top, width,
    /// height, ...]` doubles in physical screen coordinates (UIA docs) and is
    /// owned by the caller.
    fn range_rect(range: &uiautomation::patterns::UITextRange) -> Option<ScreenRect> {
        let raw: &IUIAutomationTextRange = range.as_ref();
        // SAFETY: GetBoundingRectangles returns a caller-owned SAFEARRAY (or
        // errors); every exit path below destroys it exactly once. Element
        // reads stay inside the bounds reported by SafeArrayGetUBound.
        unsafe {
            let sa = raw.GetBoundingRectangles().ok()?;
            if sa.is_null() {
                return None;
            }
            let result = (|| {
                let ubound = SafeArrayGetUBound(sa, 1).ok()?;
                if ubound < 3 {
                    return None; // fewer than 4 doubles = no full rectangle
                }
                let mut vals = [0f64; 4];
                for (i, v) in vals.iter_mut().enumerate() {
                    let idx = i as i32;
                    SafeArrayGetElement(sa, &idx, v as *mut f64 as *mut core::ffi::c_void).ok()?;
                }
                Some(ScreenRect {
                    x: vals[0] as i32,
                    y: vals[1] as i32,
                    w: vals[2] as i32,
                    h: vals[3] as i32,
                })
            })();
            let _ = SafeArrayDestroy(sa);
            result
        }
    }

    /// Fallback rect: the element enclosing the selection (e.g. the input
    /// control). Coarser than the range rect but still anchors the bar to
    /// the right control.
    fn element_rect(range: &uiautomation::patterns::UITextRange) -> Option<ScreenRect> {
        let element = range.get_enclosing_element().ok()?;
        let r = element.get_bounding_rectangle().ok()?;
        let (w, h) = (r.get_right() - r.get_left(), r.get_bottom() - r.get_top());
        if w <= 0 || h <= 0 {
            return None;
        }
        Some(ScreenRect {
            x: r.get_left(),
            y: r.get_top(),
            w,
            h,
        })
    }

    /// Clipboard fallback: the shared cache → synthetic `Ctrl+C` → read →
    /// restore lifecycle in `text_provider::fallback`. Returns `None` when
    /// nothing landed (no selection, or the target blocked the copy).
    fn clipboard_selection(app: &AppHandle, terminal: bool) -> Option<String> {
        fallback::capture_text(app, &WinFallbackOps::new(terminal))
    }
}

/// Non-Windows stub (SPEC §2.1): no selection source, the watcher never
/// installs, the bar never shows.
#[cfg(not(target_os = "windows"))]
mod imp {
    use super::SelectionRead;
    use tauri::AppHandle;

    pub fn read_selection(
        _app: &AppHandle,
        _allow_clipboard_fallback: bool,
        _pointer_gesture: bool,
    ) -> Option<SelectionRead> {
        None
    }
}

pub use imp::read_selection;
