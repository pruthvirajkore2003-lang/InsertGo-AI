//! AI provider configurations persisted to `providers.json` (SPEC §5.4).
//!
//! SECURITY (SPEC §10): no secret is stored here. The session token lives in
//! the OS credential store (`domain::session_store`, Windows Credential
//! Manager via `keyring`). This file persists only non-secret
//! per-provider config — the frontend never routes a real key through it (see
//! the `apiKey` note on `ProviderConfig` in `src/types/index.ts`). Any legacy
//! `apiKey` field in an incoming payload or an old `providers.json` is ignored.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::domain::{read_json, write_json};
use crate::error::AppResult;

const FILE: &str = "providers.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn load_providers(app: AppHandle) -> AppResult<Vec<ProviderConfig>> {
    read_json(&app, FILE)
}

#[tauri::command]
pub fn save_providers(
    app: AppHandle,
    providers: Vec<ProviderConfig>,
) -> AppResult<Vec<ProviderConfig>> {
    write_json(&app, FILE, &providers)?;
    Ok(providers)
}
