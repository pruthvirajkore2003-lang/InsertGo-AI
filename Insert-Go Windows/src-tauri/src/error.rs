//! Structured, typed errors that cross the Tauri command boundary.
//! Frontend receives the `Display` string (see `Serialize` impl) and surfaces
//! it as a toast / inline message (SPEC §9.1).

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    /// OS / platform-level failure (clipboard, window, hotkey).
    #[error("os error: {0}")]
    Os(String),

    /// Invalid or missing configuration (e.g. unparseable hotkey, no API key).
    #[error("configuration error: {0}")]
    Config(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
