//! System tray icon (SPEC §7): gives InsertGo a visible, clickable presence
//! while it runs. The palette window ships `visible: false` + `skipTaskbar:
//! true` (tauri.conf.json), so without a tray there is *no* on-screen sign the
//! app is alive — the only affordance is the global hotkey.
//!
//! Left-click toggles the palette; the right-click menu offers an explicit
//! "Show InsertGo" and "Quit". All palette activation routes through
//! `platform::window`, so the `PriorWindow` capture invariant is preserved.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

use crate::error::{AppError, AppResult};
use crate::platform::window;

/// Build the tray icon and install its menu + click handlers. Called from
/// `setup()`; a failure is log-and-continue (the hotkey still works).
pub fn create_tray(app: &AppHandle) -> AppResult<()> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| AppError::Os("no default window icon for tray".into()))?;

    let show = MenuItem::with_id(app, "tray_show", "Show InsertGo", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("InsertGo")
        .menu(&menu)
        // Left-click toggles the palette (handled below); keep the menu on
        // right-click only so a quick click doesn't pop the menu.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => {
                if let Err(e) = window::show_palette(app) {
                    log::error!("tray show failed: {e}");
                }
            }
            "tray_quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(e) = window::toggle_palette(tray.app_handle()) {
                    log::error!("tray toggle failed: {e}");
                }
            }
        })
        .build(app)?;

    Ok(())
}
