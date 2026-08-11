//! Global hotkey parsing + registration (SPEC §5.1).
//! Parses strings like "Ctrl+`" into a `Shortcut`. The actual press
//! handler is wired once in `lib.rs` via the plugin builder.

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::error::{AppError, AppResult};

/// Parse a "Mod+Mod+Key" string. Returns `None` on any unrecognized token.
pub fn parse_shortcut(input: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = input
        .split('+')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let (key_str, mod_strs) = parts.split_last()?;

    let mut mods = Modifiers::empty();
    for m in mod_strs {
        match m.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" | "option" => mods |= Modifiers::ALT,
            "super" | "meta" | "cmd" | "command" | "win" => mods |= Modifiers::SUPER,
            // Tauri accelerator convention: Cmd on macOS, Ctrl elsewhere —
            // lets one config string serve both platforms.
            "cmdorctrl" | "commandorcontrol" => {
                if cfg!(target_os = "macos") {
                    mods |= Modifiers::SUPER
                } else {
                    mods |= Modifiers::CONTROL
                }
            }
            _ => return None,
        }
    }

    let code = parse_code(key_str)?;
    let modifiers = if mods.is_empty() { None } else { Some(mods) };
    Some(Shortcut::new(modifiers, code))
}

fn parse_code(key: &str) -> Option<Code> {
    let k = key.to_ascii_lowercase();
    let code = match k.as_str() {
        "space" => Code::Space,
        // "~" accepted because the key is popularly named "the tilde key";
        // the chord itself fires on the unshifted backquote.
        "`" | "~" | "backquote" | "grave" => Code::Backquote,
        "enter" | "return" => Code::Enter,
        "tab" => Code::Tab,
        "esc" | "escape" => Code::Escape,
        "up" => Code::ArrowUp,
        "down" => Code::ArrowDown,
        "left" => Code::ArrowLeft,
        "right" => Code::ArrowRight,
        "backspace" => Code::Backspace,
        "delete" | "del" => Code::Delete,
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        "f1" => Code::F1,
        "f2" => Code::F2,
        "f3" => Code::F3,
        "f4" => Code::F4,
        "f5" => Code::F5,
        "f6" => Code::F6,
        "f7" => Code::F7,
        "f8" => Code::F8,
        "f9" => Code::F9,
        "f10" => Code::F10,
        "f11" => Code::F11,
        "f12" => Code::F12,
        _ => return None,
    };
    Some(code)
}

/// Refuse chords the OS keeps for itself.
///
/// `Ctrl+Tab` / `Ctrl+Shift+Tab` are tab navigation everywhere: `RegisterHotKey`
/// either refuses them or wins them away from the foreground app, so the
/// binding is broken either way — and the palette already cycles its own tabs
/// with them (`src/hooks/useAppShortcuts.ts`). Enforced on the parsed
/// `Shortcut` rather than in `parse_code`, so `Tab` stays available to other
/// modifier combinations.
///
/// Split out of [`register`] for two reasons: `save_settings` must reject the
/// chord at save time (`register` only runs at launch, so the UI would
/// otherwise accept a hotkey that silently never fires until the next restart),
/// and the rule stays testable without a Tauri `AppHandle`.
///
/// Unparseable input is deliberately `Ok` here — the settings field saves on
/// every keystroke, so half-typed chords must pass. [`register`] rejects those.
pub fn ensure_not_reserved(hotkey: &str) -> AppResult<()> {
    let Some(shortcut) = parse_shortcut(hotkey) else {
        return Ok(());
    };
    let reserved = shortcut.key == Code::Tab
        && (shortcut.mods == Modifiers::CONTROL
            || shortcut.mods == (Modifiers::CONTROL | Modifiers::SHIFT));
    if reserved {
        return Err(AppError::Config(format!(
            "hotkey '{hotkey}' is reserved by the OS for tab switching — Windows \
             never delivers it to InsertGo, and the palette already uses it to \
             cycle its own tabs. Pick another combination."
        )));
    }
    Ok(())
}

/// Register the configured global hotkey. The plugin's shared handler (set in
/// `lib.rs`) routes the press to the palette toggle.
pub fn register(app: &AppHandle, hotkey: &str) -> AppResult<()> {
    let shortcut = parse_shortcut(hotkey)
        .ok_or_else(|| AppError::Config(format!("invalid hotkey: {hotkey}")))?;
    ensure_not_reserved(hotkey)?;
    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| AppError::Os(format!("register hotkey '{hotkey}': {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_hotkey() {
        assert!(parse_shortcut("Ctrl+`").is_some());
    }

    #[test]
    fn parses_backquote_aliases_and_legacy_chord() {
        // Legacy "Ctrl+Shift+Space" must keep parsing: it lives in settings
        // files saved by older builds.
        for s in ["Ctrl+Backquote", "Ctrl+~", "Ctrl+grave", "Ctrl+Shift+Space"] {
            assert!(parse_shortcut(s).is_some(), "failed: {s}");
        }
    }

    #[test]
    fn parses_single_letter_with_mod() {
        assert!(parse_shortcut("Alt+K").is_some());
    }

    #[test]
    fn parses_cmdorctrl_as_platform_modifier() {
        let s = parse_shortcut("CmdOrCtrl+K").expect("should parse");
        let expected = if cfg!(target_os = "macos") {
            Shortcut::new(Some(Modifiers::SUPER), Code::KeyK)
        } else {
            Shortcut::new(Some(Modifiers::CONTROL), Code::KeyK)
        };
        assert_eq!(s, expected);
    }

    /// `register` itself needs an `AppHandle`, so the rule is asserted through
    /// the validator it delegates to — same error, no Tauri context.
    #[test]
    fn rejects_os_reserved_tab_chords() {
        for s in ["Ctrl+Tab", "Ctrl+Shift+Tab", "ctrl+shift+tab", "Control+Tab"] {
            match ensure_not_reserved(s) {
                Err(AppError::Config(m)) => {
                    assert!(m.contains("reserved by the OS"), "wrong message for {s}: {m}")
                }
                other => panic!("expected a Config error for {s}, got {other:?}"),
            }
        }
    }

    #[test]
    fn allows_tab_with_other_modifiers_and_partial_input() {
        // Parser untouched: only Ctrl / Ctrl+Shift + Tab are refused. Empty and
        // half-typed chords pass — the settings field saves per keystroke.
        for s in ["Super+Tab", "Ctrl+Alt+Tab", "Alt+Shift+Tab", "Ctrl+`", "Ctrl+Ta", ""] {
            assert!(ensure_not_reserved(s).is_ok(), "wrongly rejected: {s}");
        }
    }

    #[test]
    fn rejects_unknown_token() {
        assert!(parse_shortcut("Ctrl+Frobnicate").is_none());
    }

    #[test]
    fn rejects_empty() {
        assert!(parse_shortcut("").is_none());
    }
}
