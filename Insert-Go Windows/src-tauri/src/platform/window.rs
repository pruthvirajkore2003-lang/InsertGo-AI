//! Palette window show/hide/toggle (SPEC §7.1, §7.2).
//!
//! On hide we rely on the OS to return focus to the previously active app;
//! `insert_text` additionally restores focus explicitly via
//! `platform::foreground` when injecting.
//!
//! INVARIANT: every path that shows the palette must store
//! `foreground::capture()` into `PriorWindow` *before* `show()`/`set_focus()`
//! — afterwards InsertGo itself is the foreground window and the injection
//! target is lost. The window ships `"visible": false` (tauri.conf.json), so
//! the first show already goes through `toggle_palette` and first-use Insert
//! has a target. A future tray "open" action must capture first too. (The
//! `insert_text` fallback re-show is the one exception: it intentionally
//! keeps the original capture for retry.)
//!
//! INVARIANT: every path that `show()`s the palette must call
//! [`apply_glass`] afterwards. The palette carries NO OS backdrop anymore
//! (component-background architecture): apply_glass actively CLEARS window
//! effects — a stale material can otherwise survive show/hide cycles
//! (tauri#12854 territory) — and reports `glass:mode` "flat" so the
//! frontend raises component tints to near-opaque.

use tauri::{AppHandle, Emitter, Manager};

use crate::error::AppResult;
use crate::platform::foreground;
use crate::PriorWindow;

pub const PALETTE_LABEL: &str = "main";

/// Returns true when acrylic can actually render: Win 11 22H2+ (build 22621,
/// where `DWMWA_SYSTEMBACKDROP_TYPE` acrylic is reliable) AND the user's
/// "Transparency effects" toggle is on (HKCU\...\Themes\Personalize\
/// EnableTransparency — absent means the default, on). Anything else must
/// not request acrylic at all: DWM would substitute Mica or a flat gray
/// rectangle instead of failing.
#[cfg(target_os = "windows")]
pub(crate) fn acrylic_available() -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let transparency = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        .and_then(|k| k.get_value::<u32, _>("EnableTransparency"))
        .map_or(true, |v| v != 0);
    let build = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .and_then(|k| k.get_value::<String, _>("CurrentBuildNumber"))
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    transparency && build >= 22621
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn acrylic_available() -> bool {
    false
}

/// Component-background architecture: the palette window is fully
/// transparent — NO acrylic, no material, ever. Effects are actively CLEARED
/// (not merely unrequested) so nothing stale paints across the window's
/// rectangular bounds, and `glass:mode` "flat" tells the frontend to raise
/// component tints to near-opaque ([data-glass="flat"] token override —
/// the surfaces themselves must be legible over raw desktop).
/// `acrylic_available()` stays: the selfloater still uses its own acrylic
/// (selection_floater.rs), which this change deliberately does not touch.
/// Best-effort — never fail the show path over cosmetics.
pub(crate) fn apply_glass(window: &tauri::WebviewWindow) {
    let _ = window.set_effects(None);
    // emit_to, not emit: a broadcast would stamp this window's mode onto
    // every other window (the selfloater reports its own mode separately).
    let _ = window.emit_to(window.label(), "glass:mode", "flat");
}

/// Toggle palette visibility, emitting `palette:shown` / `palette:hidden`
/// so the frontend can focus the editor or reset state.
pub fn toggle_palette(app: &AppHandle) -> AppResult<()> {
    let Some(window) = app.get_webview_window(PALETTE_LABEL) else {
        return Ok(());
    };

    if window.is_visible().unwrap_or(false) {
        window.hide()?;
        let _ = app.emit("palette:hidden", ());
    } else {
        // Capture the injection target *before* the palette takes focus —
        // once shown, InsertGo itself is the foreground window (SPEC §7.1).
        app.state::<PriorWindow>().set(foreground::capture());
        window.show()?;
        apply_glass(&window);
        window.set_focus()?;
        let _ = app.emit("palette:shown", ());
    }
    Ok(())
}

/// Show the palette unconditionally (tray "Show" action). Unlike
/// [`toggle_palette`], an already-visible palette is refocused rather than
/// hidden. Captures the injection target *before* showing, per the module
/// invariant (SPEC §7.1).
pub fn show_palette(app: &AppHandle) -> AppResult<()> {
    let Some(window) = app.get_webview_window(PALETTE_LABEL) else {
        return Ok(());
    };

    if window.is_visible().unwrap_or(false) {
        window.set_focus()?;
        return Ok(());
    }

    app.state::<PriorWindow>().set(foreground::capture());
    window.show()?;
    apply_glass(&window);
    window.set_focus()?;
    let _ = app.emit("palette:shown", ());
    Ok(())
}
