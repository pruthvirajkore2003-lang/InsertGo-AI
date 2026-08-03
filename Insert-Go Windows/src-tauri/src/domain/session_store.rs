//! Managed session-token storage in the OS credential store.
//!
//! The InsertGo session token lives in the Windows Credential Manager (via the
//! `keyring` crate), never in JSON files, `localStorage`, and never in logs.
//! Exactly one credential: service `"InsertGo"` / account `"session"`.
//!
//! This replaces the lane-addressed `domain/secrets.rs` that went away with
//! BYOK. That module took a caller-supplied account name (`byok:<lane>`) and
//! format-validated it; with BYOK gone there is one fixed account, so the
//! account name is a constant here and no longer part of the command surface —
//! the validation that module needed is designed out rather than kept.

use crate::error::{AppError, AppResult};

const SERVICE: &str = "InsertGo";
const ACCOUNT: &str = "session";

fn entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| AppError::Os(format!("credential store: {e}")))
}

/// Store (or overwrite) the session token. Intentionally never echoed back.
#[tauri::command]
pub fn session_token_set(value: String) -> AppResult<()> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Config("session token must not be empty".into()));
    }
    entry()?
        .set_password(trimmed)
        .map_err(|e| AppError::Os(format!("credential store write: {e}")))
}

/// Read the stored session token; `None` when the user has never signed in.
#[tauri::command]
pub fn session_token_get() -> AppResult<Option<String>> {
    match entry()?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Os(format!("credential store read: {e}"))),
    }
}

/// Remove the stored token. Deleting when none exists is a no-op, so sign-out
/// is idempotent.
#[tauri::command]
pub fn session_token_delete() -> AppResult<()> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Os(format!("credential store delete: {e}"))),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn empty_token_is_rejected() {
        assert!(super::session_token_set("   ".into()).is_err());
    }

    // Roundtrip against the real credential store — Windows-only, where the
    // backend feature is enabled. Uses a dedicated test service so it can
    // never clobber the real stored session.
    #[cfg(target_os = "windows")]
    #[test]
    fn credential_store_roundtrip() {
        let e = keyring::Entry::new("InsertGoTest", "session").unwrap();
        e.set_password("test-token-roundtrip").unwrap();
        assert_eq!(e.get_password().unwrap(), "test-token-roundtrip");
        e.delete_credential().unwrap();
        assert!(matches!(e.get_password(), Err(keyring::Error::NoEntry)));
    }
}
