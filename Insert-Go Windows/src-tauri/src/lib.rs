//! InsertGo Tauri application: plugin setup, global hotkey, command registry.

mod domain;
mod error;
mod platform;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};
use tauri_plugin_log::{Target, TargetKind};

/// Managed state: which parsed shortcut belongs to which surface, so the
/// plugin's single shared handler can route a press. `None` = that hotkey
/// failed to parse/register (surface disabled, app still runs). Anything not
/// matching Improve/Undo falls through to the palette toggle — the pre-Improve
/// behavior, kept as the default arm.
#[derive(Default)]
pub struct RegisteredHotkeys {
    pub improve: Option<Shortcut>,
    pub improve_undo: Option<Shortcut>,
}

/// Managed state: the window that was foreground when the palette hotkey
/// fired — the injection target for `insert_text` (SPEC §4.1, §7.1). Stored
/// as a raw `isize` because `HWND` is not `Send`; `None` when nothing was
/// captured (or on non-Windows).
#[derive(Default)]
pub struct PriorWindow(std::sync::Mutex<Option<isize>>);

impl PriorWindow {
    pub fn get(&self) -> Option<isize> {
        // A poisoned lock only means a panic elsewhere mid-write; the isize
        // inside is still valid, so recover it rather than propagate.
        self.0.lock().map_or_else(|p| *p.into_inner(), |g| *g)
    }

    pub fn set(&self, hwnd: Option<isize>) {
        match self.0.lock() {
            Ok(mut g) => *g = hwnd,
            Err(p) => *p.into_inner() = hwnd,
        }
    }
}

/// Managed state: the window that owned the text selection when the skill
/// bar was shown — the paste target for `apply_to_selection`. Deliberately
/// separate from [`PriorWindow`]: the palette and the skill bar are
/// independent surfaces and must never share/clobber each other's target.
#[derive(Default)]
pub struct SelectionTarget(std::sync::Mutex<Option<isize>>);

impl SelectionTarget {
    pub fn get(&self) -> Option<isize> {
        self.0.lock().map_or_else(|p| *p.into_inner(), |g| *g)
    }

    pub fn set(&self, hwnd: Option<isize>) {
        match self.0.lock() {
            Ok(mut g) => *g = hwnd,
            Err(p) => *p.into_inner() = hwnd,
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // Sign-in hand-back: Windows launches a NEW process for `insertgo://…`, so
    // single-instance (built with the `deep-link` feature) forwards that argv to
    // the already-running app, where the deep-link plugin turns it into the
    // open-url event authStore listens for. It must be the FIRST plugin
    // registered. A plain second launch lands here too — surface the palette
    // rather than silently doing nothing.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window(platform::window::PALETTE_LABEL) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }
    builder
        .manage(PriorWindow::default())
        .manage(SelectionTarget::default())
        .manage(platform::improve::ImproveState::default())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                // Deterministic log file at <app_log_dir>/insertgo.log so the
                // export command (domain::logs) knows where to find it.
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("insertgo".into()),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    // Act on key-down only (ignore the release event).
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    // Route by shortcut: Improve / Undo are headless
                    // pipelines; everything else is the palette toggle.
                    if let Some(hotkeys) = app.try_state::<RegisteredHotkeys>() {
                        if hotkeys.improve.as_ref() == Some(shortcut) {
                            platform::improve::on_improve_hotkey(app);
                            return;
                        }
                        if hotkeys.improve_undo.as_ref() == Some(shortcut) {
                            platform::improve::on_undo_hotkey(app);
                            return;
                        }
                    }
                    if let Err(e) = platform::window::toggle_palette(app) {
                        log::error!("toggle_palette failed: {e}");
                    }
                })
                .build(),
        )
        // Re-assert window materials on every focus gain. Palette:
        // apply_glass now CLEARS effects (component-background architecture —
        // the window stays per-pixel transparent) and re-emits glass:mode
        // "flat" for webviews reloaded since the last show. Selfloater keeps
        // its own acrylic.
        .on_window_event(|window, event| {
            if !matches!(event, tauri::WindowEvent::Focused(true)) {
                return;
            }
            let label = window.label();
            let Some(webview) = window.app_handle().get_webview_window(label) else {
                return;
            };
            if label == platform::window::PALETTE_LABEL {
                platform::window::apply_glass(&webview);
            } else if label == platform::selection_floater::SELFLOATER_LABEL {
                platform::selection_floater::apply_floater_glass(&webview);
            }
        })
        .setup(|app| {
            // The installer registers `insertgo://` from tauri.conf.json, but a
            // dev build was never installed — register at runtime so sign-in is
            // testable under `tauri dev`. Log-and-continue: no scheme means
            // sign-in can't complete, not that the app fails to start.
            #[cfg(all(debug_assertions, desktop))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    log::error!("deep link scheme registration failed: {e}");
                }
            }
            // Register the configured hotkey; fall back to defaults on first run.
            let settings =
                domain::settings::load_settings(app.handle().clone()).unwrap_or_default();
            if let Err(e) = platform::hotkey::register(app.handle(), &settings.hotkey) {
                // Don't crash startup on a bad/occupied hotkey — log and continue.
                log::error!("hotkey registration failed: {e}");
                // ...but don't leave the palette with no chord at all either: a
                // settings.json holding a half-typed or reserved chord would
                // otherwise make the app tray-only until the user edits it.
                let fallback = domain::settings::Settings::default().hotkey;
                if fallback != settings.hotkey {
                    match platform::hotkey::register(app.handle(), &fallback) {
                        Ok(()) => log::warn!("falling back to default hotkey '{fallback}'"),
                        Err(e) => log::error!("fallback hotkey registration failed: {e}"),
                    }
                }
            }
            // Inline Improve + Undo hotkeys (SPEC §4.4). Each is independent
            // log-and-continue: a bad/occupied chord disables only that
            // surface. The parsed shortcuts go into managed state so the
            // shared handler above can route presses.
            let mut hotkeys = RegisteredHotkeys::default();
            for (name, chord, slot) in [
                ("improve", &settings.improve_hotkey, 0),
                ("improve undo", &settings.improve_undo_hotkey, 1),
            ] {
                match platform::hotkey::parse_shortcut(chord) {
                    Some(shortcut) => {
                        if let Err(e) = platform::hotkey::register(app.handle(), chord) {
                            log::error!("{name} hotkey registration failed: {e}");
                        } else {
                            match slot {
                                0 => hotkeys.improve = Some(shortcut),
                                _ => hotkeys.improve_undo = Some(shortcut),
                            }
                        }
                    }
                    None => log::error!("{name} hotkey is invalid: {chord}"),
                }
            }
            app.manage(hotkeys);
            // Improve progress chip: hidden non-activating window, same
            // log-and-continue degradation as the skill bar (a failure means
            // "no chip", never a broken pipeline).
            if let Err(e) = platform::improve::create_improve_chip(app.handle()) {
                log::error!("improve chip window creation failed: {e}");
            }
            // Tray icon: the only on-screen sign the app is running (the palette
            // is hidden + skipTaskbar). Log-and-continue like the hotkey.
            if let Err(e) = platform::tray::create_tray(app.handle()) {
                log::error!("tray icon creation failed: {e}");
            }
            // Selection skill bar: hidden non-activating window + gesture
            // watcher. Both are log-and-continue like the hotkey above — a
            // failure degrades to "no skill bar", never a crashed palette.
            if let Err(e) = platform::skillbar_window::create_skillbar(app.handle()) {
                log::error!("skill bar window creation failed: {e}");
            } else if let Err(e) = platform::selection_watch::install(app.handle()) {
                log::error!("selection watch install failed: {e}");
            }
            // Selection review floater: the dedicated window a bar skill click
            // streams into (the main palette never opens for bar clicks).
            // Log-and-continue: a failure degrades to "bar clicks do nothing".
            if let Err(e) =
                platform::selection_floater::create_selection_floater(app.handle())
            {
                log::error!("selection floater window creation failed: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            domain::context::get_active_context,
            domain::device::get_hardware_id,
            domain::prompts::load_prompts,
            domain::prompts::save_prompt,
            domain::prompts::delete_prompt,
            domain::settings::load_settings,
            domain::settings::save_settings,
            domain::providers::load_providers,
            domain::providers::save_providers,
            domain::session_store::session_token_set,
            domain::session_store::session_token_get,
            domain::session_store::session_token_delete,
            domain::ollama::ollama_list_models,
            domain::logs::export_logs,
            platform::bounds::resize_within_work_area,
            platform::clipboard::insert_text,
            platform::clipboard::replace_text,
            platform::improve::improve_status,
            platform::permissions::check_permissions,
            platform::permissions::set_autostart,
            platform::skillbar_window::apply_to_selection,
            platform::skillbar_window::hide_selection_bar,
            platform::skillbar_window::open_selection_review,
            platform::selection_floater::hide_selection_floater,
            platform::selection_floater::selection_floater_insert,
        ])
        .run(tauri::generate_context!())
        .expect("error while running InsertGo");
}
