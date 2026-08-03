//! Local Ollama auto-discovery (SPEC §16.2).
//!
//! Best-effort ping of a local Ollama instance's `/api/tags` to populate the
//! model picker. Discovery is deliberately local-only: the base URL's host
//! must be loopback, so this command can never be used as a generic HTTP
//! probe. "Ollama isn't running" is not an error — it returns an empty list
//! and the UI shows "not detected".

use serde::Deserialize;
use std::time::Duration;
use tauri_plugin_http::reqwest;

pub const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

#[derive(Deserialize)]
struct TagsResponse {
    #[serde(default)]
    models: Vec<TaggedModel>,
}

#[derive(Deserialize)]
struct TaggedModel {
    name: String,
}

fn validate_local(base: &str) -> crate::error::AppResult<reqwest::Url> {
    let url = reqwest::Url::parse(base)
        .map_err(|e| crate::error::AppError::Config(format!("invalid Ollama URL: {e}")))?;
    match url.host_str() {
        Some("localhost") | Some("127.0.0.1") | Some("[::1]") | Some("::1") => Ok(url),
        _ => Err(crate::error::AppError::Config(
            "Ollama discovery is local-only - use a localhost URL".into(),
        )),
    }
}

/// List the models of a locally running Ollama instance. Empty list when
/// Ollama is unreachable (not running is the common case, not a failure).
#[tauri::command]
pub async fn ollama_list_models(
    base_url: Option<String>,
) -> crate::error::AppResult<Vec<String>> {
    let base = base_url.unwrap_or_else(|| DEFAULT_OLLAMA_URL.to_string());
    let url = validate_local(base.trim_end_matches('/'))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| crate::error::AppError::Os(format!("http client: {e}")))?;

    let endpoint = format!("{}api/tags", ensure_trailing_slash(url.as_str()));
    let resp = match client.get(&endpoint).send().await {
        Ok(r) => r,
        Err(_) => return Ok(Vec::new()), // not running / refused — not an error
    };
    if !resp.status().is_success() {
        return Ok(Vec::new());
    }
    // The plugin's reqwest ships without the `json` feature — read text and
    // parse with the serde_json this crate already carries.
    let body = match resp.text().await {
        Ok(b) => b,
        Err(_) => return Ok(Vec::new()),
    };
    let tags: TagsResponse = match serde_json::from_str(&body) {
        Ok(t) => t,
        Err(_) => return Ok(Vec::new()),
    };
    Ok(tags.models.into_iter().map(|m| m.name).collect())
}

fn ensure_trailing_slash(s: &str) -> String {
    if s.ends_with('/') {
        s.to_string()
    } else {
        format!("{s}/")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_loopback_hosts_pass() {
        assert!(validate_local("http://localhost:11434").is_ok());
        assert!(validate_local("http://127.0.0.1:11434").is_ok());
        assert!(validate_local("http://192.168.1.10:11434").is_err());
        assert!(validate_local("https://example.com").is_err());
        assert!(validate_local("not a url").is_err());
    }

    #[test]
    fn trailing_slash_is_normalized() {
        assert_eq!(
            ensure_trailing_slash("http://localhost:11434"),
            "http://localhost:11434/"
        );
        assert_eq!(
            ensure_trailing_slash("http://localhost:11434/"),
            "http://localhost:11434/"
        );
    }
}
