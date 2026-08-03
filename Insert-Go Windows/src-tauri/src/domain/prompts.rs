//! Saved prompt library — CRUD persisted to `prompts.json` (SPEC §4.3, §6.2).
//! Mutating commands return the full updated list so the frontend store can
//! mirror backend state without a separate reload.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::domain::{read_json, write_json};
use crate::error::AppResult;

const FILE: &str = "prompts.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Insert or update `prompt` (matched by id). Pure — unit-testable without IO.
fn upsert(mut prompts: Vec<Prompt>, prompt: Prompt) -> Vec<Prompt> {
    match prompts.iter_mut().find(|p| p.id == prompt.id) {
        Some(existing) => *existing = prompt,
        None => prompts.push(prompt),
    }
    prompts
}

/// Remove the prompt with `id`. Pure — unit-testable without IO.
fn remove_by_id(mut prompts: Vec<Prompt>, id: &str) -> Vec<Prompt> {
    prompts.retain(|p| p.id != id);
    prompts
}

#[tauri::command]
pub fn load_prompts(app: AppHandle) -> AppResult<Vec<Prompt>> {
    read_json(&app, FILE)
}

/// Insert or update `prompt` (matched by id), then persist.
#[tauri::command]
pub fn save_prompt(app: AppHandle, prompt: Prompt) -> AppResult<Vec<Prompt>> {
    let prompts = upsert(read_json(&app, FILE)?, prompt);
    write_json(&app, FILE, &prompts)?;
    Ok(prompts)
}

#[tauri::command]
pub fn delete_prompt(app: AppHandle, id: String) -> AppResult<Vec<Prompt>> {
    let prompts = remove_by_id(read_json(&app, FILE)?, &id);
    write_json(&app, FILE, &prompts)?;
    Ok(prompts)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(id: &str, title: &str) -> Prompt {
        Prompt {
            id: id.into(),
            title: title.into(),
            body: "body".into(),
            tags: vec!["t".into()],
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn upsert_inserts_new() {
        let out = upsert(vec![], sample("a", "A"));
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].id, "a");
    }

    #[test]
    fn upsert_updates_existing_in_place() {
        let initial = vec![sample("a", "A"), sample("b", "B")];
        let out = upsert(initial, sample("a", "A2"));
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].title, "A2");
        assert_eq!(out[1].title, "B");
    }

    #[test]
    fn remove_by_id_drops_match() {
        let initial = vec![sample("a", "A"), sample("b", "B")];
        let out = remove_by_id(initial, "a");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].id, "b");
    }

    #[test]
    fn prompt_json_roundtrips_camel_case() {
        let p = sample("a", "A");
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"updatedAt\""));
        let back: Prompt = serde_json::from_str(&json).unwrap();
        assert_eq!(p, back);
    }
}
