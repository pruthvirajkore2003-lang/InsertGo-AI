//! App-level domain logic: prompts, settings, and active-app context.
//! Persistence is local-first JSON under the OS app-data dir (SPEC §8.2, §10).

pub mod context;
pub mod device;
pub mod logs;
// `ollama` (local-model auto-discovery) was deleted 2026-08-08: BYOK and local
// models are a decided non-feature (R-15). Nothing in the UI ever routed to it.
pub mod prompts;
pub mod session_store;
pub mod settings;

use std::fs;
use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Resolve (and create) the per-user app-data directory for InsertGo.
fn data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Os(format!("app_data_dir: {e}")))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

/// Read a JSON file from app-data, returning `T::default()` when absent/empty.
pub fn read_json<T: DeserializeOwned + Default>(app: &AppHandle, file: &str) -> AppResult<T> {
    let path = data_dir(app)?.join(file);
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes = fs::read(&path)?;
    if bytes.is_empty() {
        return Ok(T::default());
    }
    Ok(serde_json::from_slice(&bytes)?)
}

/// Write a JSON file to app-data atomically (temp file + rename).
pub fn write_json<T: Serialize>(app: &AppHandle, file: &str, value: &T) -> AppResult<()> {
    let dir = data_dir(app)?;
    let path = dir.join(file);
    let tmp = path.with_extension("tmp");
    let bytes = serde_json::to_vec_pretty(value)?;
    fs::write(&tmp, &bytes)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}
