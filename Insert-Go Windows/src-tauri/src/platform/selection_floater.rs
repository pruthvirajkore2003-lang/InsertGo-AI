//! The selection review floater: a third, FOCUSABLE webview window that hosts
//! ONLY the Skill Components floater for selection-bar skill runs. The main
//! palette never opens for a bar click — the run streams and is reviewed here
//! (SPEC §4.1 extension).
//!
//! Unlike the skill bar this window MUST take focus (the refine input and the
//! Apply/Edit buttons are keyboard surfaces), so the paste-back target is
//! captured into `PriorWindow` BEFORE the floater is shown (same invariant as
//! window.rs) and Apply goes through the shared clipboard insert pipeline —
//! hide floater → refocus target → verify → paste → `insert:fallback` on
//! failure (which re-shows THIS window, not the palette).

use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition};

use crate::error::AppResult;
use crate::platform::bounds;
use crate::platform::skillbar_window::{imp, last_bar_anchor};

/// Native Windows acrylic for the floater. WebView2 transparent windows get
/// no glass from CSS `backdrop-filter` (it cannot sample the desktop), so we
/// ask DWM directly via the undocumented user32 `SetWindowCompositionAttribute`
/// with `ACCENT_ENABLE_ACRYLICBLURBEHIND`, plus a layered chroma key so
/// magenta-keyed pixels become the transparent "hole" the glass shows through.
/// Best-effort cosmetics — never fails window creation.
#[cfg(target_os = "windows")]
mod acrylic {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{COLORREF, HWND};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, GWL_STYLE,
        LWA_ALPHA, LWA_COLORKEY, WS_EX_LAYERED, WS_POPUP,
    };

    /// `ACCENT_POLICY` as consumed by `SetWindowCompositionAttribute`
    /// (undocumented; layout stable since Win 10 1803).
    #[repr(C)]
    struct AccentPolicy {
        accent_state: u32,
        accent_flags: u32,
        gradient_color: u32, // AABBGGRR
        animation_id: u32,
    }

    /// `WINDOWCOMPOSITIONATTRIBDATA` for attribute 19 (`WCA_ACCENT_POLICY`).
    #[repr(C)]
    struct WindowCompositionAttribData {
        attrib: u32,
        data: *mut core::ffi::c_void,
        size_of_data: usize,
    }

    const WCA_ACCENT_POLICY: u32 = 19;
    const ACCENT_ENABLE_ACRYLICBLURBEHIND: u32 = 4;
    /// ~15% black tint over the blur (AABBGGRR) — light enough that the
    /// frosted desktop reads through instead of a near-opaque black box.
    const ACRYLIC_TINT: u32 = 0x2600_0000;
    /// Pure magenta chroma key (COLORREF is 0x00BBGGRR).
    const CHROMA_KEY: COLORREF = COLORREF(0x00FF_00FF);

    /// Undocumented — exported by user32.dll but absent from user32.lib, so
    /// it must be resolved at runtime, not linked.
    type SetWindowCompositionAttributeFn =
        unsafe extern "system" fn(HWND, *mut WindowCompositionAttribData) -> BOOL;

    fn set_window_composition_attribute() -> Option<SetWindowCompositionAttributeFn> {
        use windows::core::s;
        use windows::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};
        // SAFETY: user32 is always loaded in a GUI process; the transmuted
        // pointer matches the documented (community-known) signature.
        unsafe {
            let user32 = GetModuleHandleA(s!("user32.dll")).ok()?;
            let proc = GetProcAddress(user32, s!("SetWindowCompositionAttribute"))?;
            Some(std::mem::transmute::<_, SetWindowCompositionAttributeFn>(
                proc,
            ))
        }
    }

    /// Enforce the layered/popup styles, set the chroma key, then hand DWM the
    /// acrylic accent policy.
    pub fn apply(window: &tauri::WebviewWindow) {
        let Ok(hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(hwnd.0 as *mut core::ffi::c_void);

        // SAFETY: hwnd is our own freshly built window. Get/SetWindowLongPtrW
        // and SetLayeredWindowAttributes only mutate its style/blend state;
        // the ACCENT_POLICY buffer outlives the SetWindowCompositionAttribute
        // call, which reads it synchronously.
        unsafe {
            // Tauri's transparent(true)/decorations(false) should already set
            // these; enforce per the DWM accent requirements.
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if ex & WS_EX_LAYERED.0 as isize == 0 {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED.0 as isize);
            }
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            if style & WS_POPUP.0 as isize == 0 {
                SetWindowLongPtrW(hwnd, GWL_STYLE, style | WS_POPUP.0 as isize);
            }

            // Magenta pixels punch fully through; everything else composites
            // at full alpha over the acrylic backdrop.
            let _ = SetLayeredWindowAttributes(hwnd, CHROMA_KEY, 255, LWA_COLORKEY | LWA_ALPHA);

            let mut policy = AccentPolicy {
                accent_state: ACCENT_ENABLE_ACRYLICBLURBEHIND,
                accent_flags: 0,
                gradient_color: ACRYLIC_TINT,
                animation_id: 0,
            };
            let mut data = WindowCompositionAttribData {
                attrib: WCA_ACCENT_POLICY,
                data: &mut policy as *mut _ as *mut core::ffi::c_void,
                size_of_data: std::mem::size_of::<AccentPolicy>(),
            };
            if let Some(swca) = set_window_composition_attribute() {
                let _ = swca(hwnd, &mut data);
            }
        }
    }
}

pub const SELFLOATER_LABEL: &str = "selfloater";

/// Floater counterpart of window.rs `apply_glass`, sharing its policy: the
/// accent-policy acrylic is only requested when `acrylic_available()` (else
/// the undocumented API paints a gray slab on pre-22H2 / transparency-off
/// systems), and the window is told its material via `glass:mode` so CSS can
/// raise the tint when there is no frost. Re-asserted on every focus gain
/// (lib.rs) — same tauri#12854 / focus-loss degradation as the palette.
/// Best-effort — never fails the window over cosmetics.
// ponytail: ACRYLIC_TINT is a fixed dark tint that ignores the light theme;
// derive it from settings.theme if the light floater ever looks muddy.
pub fn apply_floater_glass(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    let live = crate::platform::window::acrylic_available();
    #[cfg(not(target_os = "windows"))]
    let live = false;
    #[cfg(target_os = "windows")]
    if live {
        acrylic::apply(window);
    }
    let _ = window.emit_to(
        SELFLOATER_LABEL,
        "glass:mode",
        if live { "acrylic" } else { "flat" },
    );
}

/// Logical size of the floater window at OPEN: compact — header, skill row
/// and the working pulse (matches FLOATER_MIN in SelectionReviewFloater.tsx).
/// useAutoWindowHeight grows the window from here as the run streams; the
/// window must never open at a previous run's grown height.
const FLOATER_LOGICAL_WIDTH: f64 = 480.0;
const FLOATER_LOGICAL_HEIGHT: f64 = 160.0;

/// Build the (hidden) selection floater window once at startup. A normal
/// focusable window — it hosts text inputs — styled like the palette
/// (borderless, transparent, always on top, out of the taskbar).
pub fn create_selection_floater(app: &AppHandle) -> AppResult<()> {
    let window = tauri::WebviewWindowBuilder::new(
        app,
        SELFLOATER_LABEL,
        tauri::WebviewUrl::App("selfloater.html".into()),
    )
    .title("InsertGo Skill Components")
    .inner_size(FLOATER_LOGICAL_WIDTH, FLOATER_LOGICAL_HEIGHT)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .visible(false)
    .accept_first_mouse(true)
    .build()?;

    apply_floater_glass(&window);
    #[cfg(target_os = "windows")]
    if let Ok(hwnd) = window.hwnd() {
        bounds::imp::install(hwnd.0 as isize);
    }

    Ok(())
}

/// Show the floater near the skill bar's last on-screen anchor (i.e. next to
/// the selection the user acted on), clamped fully inside that monitor's work
/// area, then focus it. Callers must capture `PriorWindow` FIRST — once the
/// floater has focus the paste-back target is unrecoverable.
pub fn show_selection_floater(app: &AppHandle) -> AppResult<()> {
    let Some(window) = app.get_webview_window(SELFLOATER_LABEL) else {
        return Ok(());
    };

    // Open compact every time: hide/show keeps the last grown height, so
    // without this reset a new run flashes at the previous run's full size
    // instead of starting the small-to-big stream grow. The insert-fallback
    // re-show (clipboard.rs) deliberately bypasses this — the retryable card
    // is still up there and must keep its size.
    window.set_size(LogicalSize::new(
        FLOATER_LOGICAL_WIDTH,
        FLOATER_LOGICAL_HEIGHT,
    ))?;

    let (ax, ay) = last_bar_anchor();
    let size = window.outer_size()?;
    let (w, h) = (size.width as i32, size.height as i32);
    if let Some(work) = imp::work_area(ax, ay) {
        let (x, y) = bounds::clamp_to_work(ax, ay, w, h, work);
        window.set_position(PhysicalPosition::new(x, y))?;
    } else {
        window.center()?;
    }

    window.show()?;
    window.set_focus()?;
    Ok(())
}

/// Frontend-invoked hide (Esc / close / backdrop click in the floater).
#[tauri::command]
pub async fn hide_selection_floater(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window(SELFLOATER_LABEL) {
        window.hide()?;
    }
    Ok(())
}

/// Paste `text` into the window captured when the bar skill was clicked —
/// the floater window's Apply. Same pipeline as the palette's `insert_text`,
/// but it is the FLOATER that is hidden before the paste and re-shown on
/// fallback. Returns `true` when the paste landed, `false` when the text was
/// left on the clipboard (`insert:fallback` fired).
#[tauri::command]
pub async fn selection_floater_insert(app: AppHandle, text: String) -> AppResult<bool> {
    crate::platform::clipboard::insert_from(&app, SELFLOATER_LABEL, text)
}
