//! Active-app context detection (SPEC §1.2, §5).
//!
//! Reports the app that was foreground when the palette hotkey fired — the
//! HWND captured by `platform::window::toggle_palette` into the `PriorWindow`
//! managed state (capture must happen *before* the palette is shown, since
//! afterwards InsertGo itself is the foreground window). Process name and
//! window title come from the `platform::foreground` Win32 wrappers; on
//! non-Windows (or when nothing was captured) this returns empty values.

use serde::Serialize;
use tauri::State;

use crate::platform::foreground;
use crate::PriorWindow;

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppContext {
    pub process_name: String,
    pub window_title: String,
}

#[tauri::command]
pub fn get_active_context(prior: State<'_, PriorWindow>) -> AppContext {
    let Some(hwnd) = prior.get() else {
        return AppContext::default();
    };
    AppContext {
        process_name: foreground::process_name(hwnd).unwrap_or_default(),
        window_title: foreground::window_title(hwnd).unwrap_or_default(),
    }
}
