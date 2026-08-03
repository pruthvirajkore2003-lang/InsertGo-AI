//! Live capability probes for the first-run wizard's permission priming step.
//!
//! Windows has no permission-grant dialog for what InsertGo needs — UIA reads,
//! a global hotkey, and the clipboard either work or they don't, and the
//! failure is silent. So the wizard *probes* instead of asking: each card
//! explains why the capability is needed, and only then does the user press
//! Check and get a real answer.
//!
//! Every probe is capability-only and content-free (SPEC §10): the UIA probe
//! starts a client without walking any window's tree, and the clipboard probe
//! opens and closes the clipboard without reading what is on it. Nothing here
//! is persisted — a permission fixed in Windows shows up on the next check.
//!
//! Status strings mirror the TS `PermissionStatus` union (src/types/index.ts),
//! same convention as `Settings::theme`.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::AppResult;

/// Registry location + value name for the per-user autostart entry. Windows'
/// documented Run key: no new dependency needed (winreg is already in for
/// MachineGuid) and no elevation, unlike a scheduled task or a service.
#[cfg(target_os = "windows")]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(target_os = "windows")]
const RUN_VALUE: &str = "InsertGo";

const GRANTED: &str = "granted";
const UNAVAILABLE: &str = "unavailable";
const BLOCKED: &str = "blocked";
const OFF: &str = "off";

/// One probe pass. Mirrors the TS `PermissionReport`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionReport {
    /// UIA client starts → field capture and paste-back can work.
    pub accessibility: String,
    /// The configured palette chord is registered with the OS.
    pub global_hotkey: String,
    /// The configured Inline Improve chord is registered with the OS.
    pub improve_hotkey: String,
    /// The clipboard can be opened (the fallback capture/paste tier).
    pub clipboard: String,
    /// Per-user autostart entry present (`granted`) or absent (`off`).
    pub autostart: String,
    /// InsertGo itself runs elevated. Normal integrity cannot read from or
    /// paste into an elevated target window (UIPI) and Windows reports no
    /// error for it, so the wizard says so instead of letting it fail mutely.
    pub elevated: bool,
}

#[tauri::command]
pub async fn check_permissions(app: AppHandle) -> AppResult<PermissionReport> {
    let settings = crate::domain::settings::load_settings(app.clone()).unwrap_or_default();
    Ok(PermissionReport {
        accessibility: imp::probe_accessibility(),
        global_hotkey: hotkey_status(&app, &settings.hotkey),
        improve_hotkey: hotkey_status(&app, &settings.improve_hotkey),
        clipboard: imp::probe_clipboard(),
        autostart: imp::probe_autostart(),
        elevated: imp::is_elevated(),
    })
}

/// Enable or disable launching InsertGo at sign-in. Optional by design — the
/// wizard never turns it on silently.
#[tauri::command]
pub async fn set_autostart(enabled: bool) -> AppResult<bool> {
    imp::set_autostart(enabled)?;
    Ok(enabled)
}

/// A chord is `granted` when the OS accepted our registration, `blocked` when
/// it did not (another app owns it — the one failure mode users actually hit),
/// and `unavailable` when the chord string itself doesn't parse.
fn hotkey_status(app: &AppHandle, chord: &str) -> String {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    match crate::platform::hotkey::parse_shortcut(chord) {
        None => UNAVAILABLE.into(),
        Some(shortcut) => {
            if app.global_shortcut().is_registered(shortcut) {
                GRANTED.into()
            } else {
                BLOCKED.into()
            }
        }
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::*;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::DataExchange::{CloseClipboard, OpenClipboard};
    use windows::Win32::UI::Shell::IsUserAnAdmin;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
    use winreg::RegKey;

    /// Start a UIA client and throw it away. Runs on its own thread because
    /// `UIAutomation::new` initializes COM for the *calling* thread (MTA) and
    /// this command runs on a shared async worker — never leave an apartment
    /// behind on a pooled thread.
    pub fn probe_accessibility() -> String {
        let ok = std::thread::spawn(|| {
            uiautomation::UIAutomation::new()
                .or_else(|_| uiautomation::UIAutomation::new_direct())
                .is_ok()
        })
        .join()
        .unwrap_or(false);
        if ok {
            GRANTED.into()
        } else {
            UNAVAILABLE.into()
        }
    }

    /// Open + immediately close the clipboard. Deliberately does NOT read it:
    /// the question is "can the fallback tier work", not "what is on it".
    /// A denial here is real and transient — another process holding the
    /// clipboard open makes `OpenClipboard` fail.
    pub fn probe_clipboard() -> String {
        // SAFETY: null HWND requests ownership for the calling task, which is
        // the documented probe form; the handle is closed on both paths.
        unsafe {
            match OpenClipboard(Some(HWND::default())) {
                Ok(()) => {
                    let _ = CloseClipboard();
                    GRANTED.into()
                }
                Err(_) => UNAVAILABLE.into(),
            }
        }
    }

    pub fn probe_autostart() -> String {
        let present = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY, KEY_READ)
            .and_then(|k| k.get_value::<String, _>(RUN_VALUE))
            .is_ok();
        if present {
            GRANTED.into()
        } else {
            OFF.into()
        }
    }

    pub fn set_autostart(enabled: bool) -> AppResult<()> {
        let run = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY, KEY_READ | KEY_SET_VALUE)
            .map_err(|e| crate::error::AppError::Os(format!("open Run key: {e}")))?;
        if !enabled {
            // Absent already == disabled: deleting a missing value is success,
            // so the toggle is idempotent.
            match run.delete_value(RUN_VALUE) {
                Ok(()) => return Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
                Err(e) => {
                    return Err(crate::error::AppError::Os(format!(
                        "clear autostart entry: {e}"
                    )))
                }
            }
        }
        let exe = std::env::current_exe()
            .map_err(|e| crate::error::AppError::Os(format!("locate InsertGo.exe: {e}")))?;
        // Quoted: the install path contains spaces (Program Files), and an
        // unquoted Run value is parsed at the first space.
        let value = format!("\"{}\"", exe.display());
        run.set_value(RUN_VALUE, &value)
            .map_err(|e| crate::error::AppError::Os(format!("write autostart entry: {e}")))
    }

    /// True when this process holds an elevated administrator token.
    pub fn is_elevated() -> bool {
        // SAFETY: no arguments, no out-params; returns a plain BOOL.
        unsafe { IsUserAnAdmin().as_bool() }
    }
}

/// Non-Windows targets compile but report nothing usable — the shipped target
/// is Windows, and this keeps `cargo test`/`cargo check` green elsewhere.
#[cfg(not(target_os = "windows"))]
mod imp {
    use super::*;

    pub fn probe_accessibility() -> String {
        UNAVAILABLE.into()
    }

    pub fn probe_clipboard() -> String {
        UNAVAILABLE.into()
    }

    pub fn probe_autostart() -> String {
        OFF.into()
    }

    pub fn set_autostart(_enabled: bool) -> AppResult<()> {
        Err(crate::error::AppError::Os(
            "autostart is only supported on Windows".into(),
        ))
    }

    pub fn is_elevated() -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_serializes_camel_case() {
        let report = PermissionReport {
            accessibility: GRANTED.into(),
            global_hotkey: BLOCKED.into(),
            improve_hotkey: GRANTED.into(),
            clipboard: GRANTED.into(),
            autostart: OFF.into(),
            elevated: false,
        };
        let json = serde_json::to_string(&report).unwrap();
        // The TS `PermissionReport` reads these exact keys.
        assert!(json.contains("\"globalHotkey\""));
        assert!(json.contains("\"improveHotkey\""));
        assert!(json.contains("\"elevated\""));
        let back: PermissionReport = serde_json::from_str(&json).unwrap();
        assert_eq!(back, report);
    }

    /// The status vocabulary is a cross-language contract: these five strings
    /// are the only values the TS `PermissionStatus` union accepts from Rust.
    #[test]
    fn status_vocabulary_matches_typescript() {
        assert_eq!(GRANTED, "granted");
        assert_eq!(UNAVAILABLE, "unavailable");
        assert_eq!(BLOCKED, "blocked");
        assert_eq!(OFF, "off");
    }
}
