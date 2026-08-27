//! The legal-consent gate: the two commands the first-run clickwrap calls, and
//! the one function that starts everything capable of reading or writing
//! another application's text.
//!
//! It lives in its own module rather than in `lib.rs` because Tauri's
//! `generate_handler!` re-imports each command's generated macro into the
//! invoking scope — commands defined in that same scope collide with
//! themselves (E0255). Every other command in this app is in a submodule for
//! the same reason.

/// Set once the interception surfaces are live, so arming twice is a no-op.
/// `selection_watch::install` and `global_shortcut().register` both error on a
/// second call, and the command below is reachable whenever the frontend
/// re-runs its consent flow.
static ARMED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Start everything that reads or writes another application's text: the
/// global hotkey and the WH_KEYBOARD_LL / WH_MOUSE_LL selection hooks.
///
/// Split out of `setup` so it has exactly two callers — startup, only when
/// `Settings::consent_current()` already holds, and `legal_consent_granted`,
/// the moment the user accepts. Nothing else may call it, because those two
/// call sites are the whole CIPA §§631/632 argument: before acceptance no hook
/// exists to intercept anything, and after it the user does not have to
/// restart to get the product they just agreed to.
///
/// Log-and-continue, like the code it replaced: a hotkey the OS refuses must
/// degrade to "tray only", never to a crashed launch.
pub(crate) fn arm_interception(app: &tauri::AppHandle, hotkey: &str) {
    use std::sync::atomic::Ordering;
    if ARMED.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Err(e) = crate::platform::hotkey::register(app, hotkey) {
        log::error!("hotkey registration failed: {e}");
        // ...but don't leave the palette with no chord at all either: a
        // settings.json holding a half-typed or reserved chord would
        // otherwise make the app tray-only until the user edits it.
        let fallback = crate::domain::settings::Settings::default().hotkey;
        if fallback != hotkey {
            match crate::platform::hotkey::register(app, &fallback) {
                Ok(()) => log::warn!("falling back to default hotkey '{fallback}'"),
                Err(e) => log::error!("fallback hotkey registration failed: {e}"),
            }
        }
    }
    if let Err(e) = crate::platform::selection_watch::install(app) {
        log::error!("selection watch install failed: {e}");
    }
}

/// Called by `LegalConsentModal` immediately after it persists
/// `acceptedTermsVersion`. Re-reads settings from disk rather than trusting an
/// argument: the authority for "has this user consented" is the file the gate
/// checks at startup, so a frontend that called this without writing first
/// arms nothing.
#[tauri::command]
pub fn legal_consent_granted(app: tauri::AppHandle) -> Result<bool, String> {
    let settings = crate::domain::settings::load_settings(app.clone()).unwrap_or_default();
    if !settings.consent_current() {
        return Ok(false);
    }
    arm_interception(&app, &settings.hotkey);
    Ok(true)
}

/// Quit, from the consent modal's "Decline and quit". Same `app.exit(0)` the
/// tray's Quit item uses. It exists because declining has to actually end the
/// session: consent that leaves you trapped in the dialog is not freely given,
/// and a modal you cannot escape is the dark pattern the gate is meant to
/// avoid being.
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// True when this build's Terms & Privacy version has been accepted. The
/// frontend has its own copy of the answer (it reads the same settings), but
/// this is what the guards below actually test, so exposing it keeps the UI
/// from claiming a capability the backend will refuse.
#[tauri::command]
pub fn legal_consent_state(app: tauri::AppHandle) -> bool {
    crate::domain::settings::load_settings(app)
        .map(|s| s.consent_current())
        .unwrap_or(false)
}
