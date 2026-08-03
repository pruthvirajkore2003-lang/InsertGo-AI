//! Log export for debugging (SPEC §9.3).
//!
//! The log file is written by `tauri-plugin-log` to `<app_log_dir>/insertgo.log`
//! (configured in `lib.rs`). `export_logs` copies it into the user's Downloads
//! folder and returns the destination path for display.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Must match the `file_name` configured for the log plugin in `lib.rs`.
pub const LOG_FILE: &str = "insertgo.log";

fn log_file_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Os(format!("app_log_dir: {e}")))?;
    Ok(dir.join(LOG_FILE))
}

/// Copy the current log file to Downloads. Returns the destination path.
#[tauri::command]
pub fn export_logs(app: AppHandle) -> AppResult<String> {
    let src = log_file_path(&app)?;
    if !src.exists() {
        return Err(AppError::Config(
            "No log file yet — use the app a bit first.".into(),
        ));
    }

    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| AppError::Os(format!("download_dir: {e}")))?;
    fs::create_dir_all(&downloads)?;

    let dest = downloads.join("insertgo-logs.log");
    fs::copy(&src, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}
