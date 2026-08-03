//! User settings persisted to `settings.json` (SPEC §8.1).

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::domain::{read_json, write_json};
use crate::error::AppResult;

const FILE: &str = "settings.json";

/// One user-created custom skill (SPEC — customizable skills). Mirrors the TS
/// `Skill` when `isCustom: true`; built-in skills are bundled from `src/skills`
/// and never persisted here. Keys nothing — pure prompt text.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CustomSkill {
    pub id: String,
    pub label: String,
    pub template: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub is_custom: bool,
    /// Skill Manager filter category ("writing" | "coding" | "research" |
    /// "ops" | "custom"). `default` ("") keeps pre-feature customs loading; the
    /// UI treats an empty/unknown value as "custom".
    #[serde(default)]
    pub category: String,
    /// Opt this custom skill into the relay's web-grounded two-pass run
    /// (TS `Skill.grounded`, read by `resolveSkillGrounding`). `default`
    /// (false) keeps pre-feature customs loading unchanged; the field exists
    /// here so the flag survives a settings round-trip.
    #[serde(default)]
    pub grounded: bool,
}

/// One saved skill-bar combination (Skill Manager presets). Mirrors the TS
/// `SkillSetPreset`: a name plus the `enabled_skill_ids` snapshot at save time.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SkillSetPreset {
    pub id: String,
    pub name: String,
    pub skill_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// "light" | "dark" | "system" | "high-contrast" (kept as a string to
    /// mirror the TS `ThemePreference` union).
    pub theme: String,
    pub hotkey: String,
    pub default_provider_id: Option<String>,
    /// In-situ selection skill bar on/off (privacy kill switch for the
    /// selection watcher; the palette is unaffected). `default` keeps
    /// pre-existing settings.json files loading.
    #[serde(default = "default_selection_bar")]
    pub selection_bar: bool,
    /// Foreground executables the selection watcher may read from — the
    /// default privacy scope (SPEC §10): never silently read every app.
    /// Compared case-insensitively against the process file name.
    #[serde(default = "default_selection_bar_apps")]
    pub selection_bar_apps: Vec<String>,
    /// Read-scope model (SPEC §10): `"allowlist"` (default — read only the
    /// `selection_bar_apps` set) or `"all"` (read every foreground app except
    /// InsertGo itself and the `selection_bar_blocklist`). Defaults to
    /// `"allowlist"` so an upgrade never silently widens what is read; `"all"`
    /// is an explicit, off-by-default opt-in.
    #[serde(default = "default_selection_bar_scope")]
    pub selection_bar_scope: String,
    /// Executables NEVER read even in `"all"` scope (SPEC §10): password
    /// managers and credential UIs. Compared case-insensitively; supports a
    /// trailing `*` wildcard (e.g. `keepass*.exe`).
    #[serde(default = "default_selection_bar_blocklist")]
    pub selection_bar_blocklist: Vec<String>,
    /// Inline Improve hotkey (SPEC §4.4). `default` keeps pre-existing
    /// settings.json files loading.
    #[serde(default = "default_improve_hotkey")]
    pub improve_hotkey: String,
    /// Inline Improve undo hotkey — restores the pre-improve snapshot.
    #[serde(default = "default_improve_undo_hotkey")]
    pub improve_undo_hotkey: String,
    /// Inline Improve model override (SPEC §5.6.3): "" = the hosted lane's
    /// fastest default.
    #[serde(default)]
    pub improve_model: String,
    /// Ids of the skills shown on the skill bar, in display order. `default`
    /// seeds the full built-in set so a pre-feature settings.json upgrades to
    /// the whole bar; an explicit empty list is the "user cleared the bar"
    /// state and is preserved verbatim.
    #[serde(default = "default_enabled_skill_ids")]
    pub enabled_skill_ids: Vec<String>,
    /// User-created custom skills. `default` (empty) keeps pre-feature files
    /// loading; built-in skills are never stored here.
    #[serde(default)]
    pub custom_skills: Vec<CustomSkill>,
    /// Saved skill-bar combinations (Skill Manager presets). `default` (empty)
    /// keeps pre-feature files loading.
    #[serde(default)]
    pub skill_set_presets: Vec<SkillSetPreset>,
    /// False until the first-run wizard completes. `default` (false) is
    /// deliberate for pre-feature files too: legal consent has to be collected
    /// from existing installs as well, so they run the wizard once rather than
    /// inheriting a consent they never gave.
    #[serde(default)]
    pub has_completed_onboarding: bool,
    /// Version of the Terms & Privacy text the user explicitly accepted
    /// (TS `LEGAL_VERSION`), or `None` when consent was never given. Pinning
    /// the version is what lets a later revision re-ask.
    #[serde(default)]
    pub accepted_terms_version: Option<String>,
    /// What the user said they write most, from the first-run card
    /// ("ai" | "email" | "docs" | "code" | "general"), or `None` when never
    /// asked. Kept as a string to mirror the TS `WritingSegment` union. Used
    /// only to order starter prompts and the skill bar — it gates nothing.
    #[serde(default)]
    pub writing_segment: Option<String>,
    /// True once one Improve run has produced improved text. The composer's
    /// first-run card stays pinned until this flips, so an onboarding that
    /// never reached the payoff resumes on the next launch.
    #[serde(default)]
    pub first_improve_done: bool,
}

/// The 10 vendored skill slugs in repo order. Must mirror BUILTIN_SKILL_IDS /
/// DEFAULT_SETTINGS.enabledSkillIds on the TS side.
fn default_enabled_skill_ids() -> Vec<String> {
    [
        "summarize-this",
        "learn-more",
        "answer-this-question",
        "reply-to-this",
        "translate-this",
        "improve-this",
        "fix-mistakes",
        "expand-this",
        "simplify-this",
        "reply-with-instructions",
    ]
    .map(String::from)
    .to_vec()
}

fn default_improve_hotkey() -> String {
    "Ctrl+Alt+Enter".into()
}

fn default_improve_undo_hotkey() -> String {
    "Ctrl+Alt+Z".into()
}

fn default_selection_bar() -> bool {
    true
}

fn default_selection_bar_scope() -> String {
    "allowlist".into()
}

/// Password managers / credential UIs that must never be read even in `"all"`
/// scope (SPEC §10). Entries support a single `*` wildcard so a family of
/// versioned executables (e.g. `keepass*.exe`) is covered by one line.
fn default_selection_bar_blocklist() -> Vec<String> {
    [
        "1password.exe",
        "keepass*.exe",
        "keepassxc.exe",
        "bitwarden.exe",
        "lastpass.exe",
        "dashlane.exe",
        "logonui.exe",
        "consent.exe",
    ]
    .map(String::from)
    .to_vec()
}

fn default_selection_bar_apps() -> Vec<String> {
    [
        // AI clients + coding surfaces.
        "claude.exe",
        "perplexity.exe",
        "codex.exe",
        // Browsers (webmail, web IDEs, chat UIs, local-LLM front-ends).
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "arc.exe",
        // Mail + terminals.
        "outlook.exe",
        "windowsterminal.exe",
        "wt.exe",
        "powershell.exe",
        "pwsh.exe",
        // Editors / IDEs (extensions run inside the host process, so covering
        // the host covers its extensions).
        "code.exe",
        "code - insiders.exe",
        "cursor.exe",
        "antigravity ide.exe", // actual exe name has a space, not a hyphen
        "zed.exe",
        "fleet.exe",
        "sublime_text.exe",
        "notepad++.exe",
        "notepad.exe",
        "devenv.exe",
        "idea64.exe",
        "webstorm64.exe",
        "pycharm64.exe",
        "rider64.exe",
        "goland64.exe",
        "phpstorm64.exe",
        "rustrover64.exe",
        "clion64.exe",
        "studio64.exe",
    ]
    .map(String::from)
    .to_vec()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            hotkey: "Ctrl+`".into(),
            default_provider_id: None,
            selection_bar: default_selection_bar(),
            selection_bar_apps: default_selection_bar_apps(),
            selection_bar_scope: default_selection_bar_scope(),
            selection_bar_blocklist: default_selection_bar_blocklist(),
            improve_hotkey: default_improve_hotkey(),
            improve_undo_hotkey: default_improve_undo_hotkey(),
            improve_model: String::new(),
            enabled_skill_ids: default_enabled_skill_ids(),
            custom_skills: Vec::new(),
            skill_set_presets: Vec::new(),
            has_completed_onboarding: false,
            accepted_terms_version: None,
            writing_segment: None,
            first_improve_done: false,
        }
    }
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> AppResult<Settings> {
    // The allowlist is user-owned privacy scope (SPEC §10): a settings.json
    // predating the field gets the defaults via `#[serde(default)]`, but an
    // existing list is never merged with the defaults — re-adding entries the
    // user removed would silently widen what the watcher may read.
    read_json(&app, FILE)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> AppResult<Settings> {
    validate_hotkey_uniqueness(&settings)?;
    // Reserved chords are refused here as well as at registration: `register`
    // only runs at launch, so otherwise the UI accepts a hotkey that silently
    // never fires until the next restart.
    for chord in [
        &settings.hotkey,
        &settings.improve_hotkey,
        &settings.improve_undo_hotkey,
    ] {
        crate::platform::hotkey::ensure_not_reserved(chord.trim())?;
    }
    write_json(&app, FILE, &settings)?;
    Ok(settings)
}

/// Global hotkeys must be pairwise distinct: the shared dispatcher routes a
/// press by chord (first match wins), so two actions on one chord means one
/// of them silently never fires. Rejecting at save time surfaces the
/// conflict in the settings UI instead of resolving it by registration order.
fn validate_hotkey_uniqueness(settings: &Settings) -> AppResult<()> {
    let chords = [
        ("Open palette", &settings.hotkey),
        ("Improve", &settings.improve_hotkey),
        ("Improve undo", &settings.improve_undo_hotkey),
    ];
    for (i, (name_a, a)) in chords.iter().enumerate() {
        let a = a.trim();
        if a.is_empty() {
            continue;
        }
        for (name_b, b) in &chords[i + 1..] {
            if a.eq_ignore_ascii_case(b.trim()) {
                return Err(crate::error::AppError::Config(format!(
                    "'{name_a}' and '{name_b}' share the hotkey '{a}' — pick distinct chords"
                )));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_hotkeys_are_rejected() {
        let mut s = Settings::default();
        assert!(validate_hotkey_uniqueness(&s).is_ok());
        // Case-insensitive collision with the palette chord.
        s.improve_hotkey = "ctrl+`".into();
        assert!(validate_hotkey_uniqueness(&s).is_err());
        // Empty chords never collide with each other.
        s.improve_hotkey = String::new();
        s.improve_undo_hotkey = String::new();
        assert!(validate_hotkey_uniqueness(&s).is_ok());
    }

    #[test]
    fn default_settings_are_sane() {
        let s = Settings::default();
        assert_eq!(s.hotkey, "Ctrl+`");
        assert_eq!(s.theme, "system");
        assert!(s.default_provider_id.is_none());
        assert!(s.selection_bar);
        assert!(s.selection_bar_apps.contains(&"claude.exe".to_string()));
        // Expanded defaults now cover browsers, mail and terminals too.
        assert!(s.selection_bar_apps.contains(&"chrome.exe".to_string()));
        assert!(s.selection_bar_apps.contains(&"outlook.exe".to_string()));
        // Privacy default: allowlist scope, blocklist seeded with cred UIs.
        assert_eq!(s.selection_bar_scope, "allowlist");
        assert!(s
            .selection_bar_blocklist
            .contains(&"1password.exe".to_string()));
        assert_eq!(s.improve_hotkey, "Ctrl+Alt+Enter");
        assert_eq!(s.improve_undo_hotkey, "Ctrl+Alt+Z");
        assert_eq!(s.improve_model, "");
        // Fresh install: onboarding pending, no consent recorded, and the
        // first-run card still owed a successful Improve.
        assert!(!s.has_completed_onboarding);
        assert!(s.accepted_terms_version.is_none());
        assert!(s.writing_segment.is_none());
        assert!(!s.first_improve_done);
    }

    #[test]
    fn settings_json_roundtrips_camel_case() {
        let s = Settings {
            theme: "dark".into(),
            hotkey: "Alt+Space".into(),
            default_provider_id: Some("p1".into()),
            selection_bar: false,
            selection_bar_apps: vec!["claude.exe".into()],
            selection_bar_scope: "all".into(),
            selection_bar_blocklist: vec!["1password.exe".into()],
            improve_hotkey: "Ctrl+Alt+I".into(),
            improve_undo_hotkey: "Ctrl+Alt+U".into(),
            improve_model: "claude-haiku-4-5".into(),
            enabled_skill_ids: vec!["summarize-this".into(), "custom-my-skill".into()],
            custom_skills: vec![CustomSkill {
                id: "custom-my-skill".into(),
                label: "My Skill".into(),
                template: "Do the thing:\n[PASTE CONTENT HERE]".into(),
                icon: "fa-bolt".into(),
                description: "A test skill".into(),
                is_custom: true,
                category: "coding".into(),
                grounded: true,
            }],
            skill_set_presets: vec![SkillSetPreset {
                id: "preset-writing-mode".into(),
                name: "Writing Mode".into(),
                skill_ids: vec!["summarize-this".into(), "improve-this".into()],
            }],
            has_completed_onboarding: true,
            accepted_terms_version: Some("1.0.0".into()),
            writing_segment: Some("code".into()),
            first_improve_done: true,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"defaultProviderId\""));
        assert!(json.contains("\"selectionBarApps\""));
        assert!(json.contains("\"selectionBarScope\""));
        assert!(json.contains("\"selectionBarBlocklist\""));
        assert!(json.contains("\"improveHotkey\""));
        assert!(json.contains("\"improveModel\""));
        assert!(json.contains("\"enabledSkillIds\""));
        assert!(json.contains("\"customSkills\""));
        // CustomSkill fields serialize camelCase (isCustom, not is_custom).
        assert!(json.contains("\"isCustom\""));
        let back: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.theme, "dark");
        assert_eq!(back.hotkey, "Alt+Space");
        assert_eq!(back.default_provider_id.as_deref(), Some("p1"));
        assert!(!back.selection_bar);
        assert_eq!(back.enabled_skill_ids.len(), 2);
        assert_eq!(back.custom_skills.len(), 1);
        assert_eq!(back.custom_skills[0].id, "custom-my-skill");
        assert!(back.custom_skills[0].is_custom);
        assert_eq!(back.custom_skills[0].category, "coding");
        assert!(back.custom_skills[0].grounded);
        assert!(json.contains("\"skillSetPresets\""));
        assert!(json.contains("\"skillIds\""));
        assert_eq!(back.skill_set_presets.len(), 1);
        assert_eq!(back.skill_set_presets[0].id, "preset-writing-mode");
        assert_eq!(back.skill_set_presets[0].skill_ids.len(), 2);
        assert!(json.contains("\"hasCompletedOnboarding\""));
        assert!(json.contains("\"acceptedTermsVersion\""));
        assert!(json.contains("\"writingSegment\""));
        assert!(json.contains("\"firstImproveDone\""));
        assert!(back.has_completed_onboarding);
        assert_eq!(back.accepted_terms_version.as_deref(), Some("1.0.0"));
        assert_eq!(back.writing_segment.as_deref(), Some("code"));
        assert!(back.first_improve_done);
    }

    #[test]
    fn settings_json_missing_new_fields_defaults() {
        // A pre-skill-bar settings.json must keep loading (serde defaults).
        let back: Settings = serde_json::from_str(
            r#"{"theme":"dark","hotkey":"Alt+Space","defaultProviderId":null}"#,
        )
        .unwrap();
        assert!(back.selection_bar);
        assert!(!back.selection_bar_apps.is_empty());
        // New scope fields default to the privacy-preserving allowlist mode.
        assert_eq!(back.selection_bar_scope, "allowlist");
        assert!(!back.selection_bar_blocklist.is_empty());
        assert_eq!(back.improve_hotkey, "Ctrl+Alt+Enter");
        assert_eq!(back.improve_undo_hotkey, "Ctrl+Alt+Z");
        assert_eq!(back.improve_model, "");
        // A pre-feature file has no skill fields: the bar defaults to the full
        // built-in set (never an empty bar on upgrade), customs default empty.
        assert_eq!(back.enabled_skill_ids.len(), 10);
        assert_eq!(back.enabled_skill_ids[0], "summarize-this");
        assert!(back.custom_skills.is_empty());
        assert!(back.skill_set_presets.is_empty());
        // A pre-onboarding settings.json has given no consent: the welcome
        // screen runs once for that install rather than assuming acceptance.
        assert!(!back.has_completed_onboarding);
        assert!(back.accepted_terms_version.is_none());
        // ...and an upgrade from before the first-run card is owed one too, so
        // the card appears once for existing installs rather than never.
        assert!(back.writing_segment.is_none());
        assert!(!back.first_improve_done);
    }

    #[test]
    fn legacy_byok_fields_are_ignored_not_fatal() {
        // Every installed copy has a settings.json still carrying the removed
        // BYOK keys. Serde ignores unknown fields by default, so the file must
        // keep loading AND the surviving fields must round-trip intact —
        // that's the whole upgrade path for existing users.
        let back: Settings = serde_json::from_str(
            r#"{
                "theme":"dark",
                "hotkey":"Alt+Space",
                "defaultProviderId":null,
                "byokLane":"anthropic",
                "byokModel":"claude-haiku-4-5",
                "byokBaseUrl":"",
                "byokProfiles":[{"id":"p-abc","name":"Work key","lane":"openrouter","model":"meta/llama","baseUrl":""}],
                "activeByokProfileId":"p-abc",
                "improveModel":"gemini-2.5-flash-lite",
                "improveHotkey":"Ctrl+Alt+I",
                "enabledSkillIds":["summarize-this"]
            }"#,
        )
        .unwrap();
        assert_eq!(back.theme, "dark");
        assert_eq!(back.hotkey, "Alt+Space");
        assert_eq!(back.improve_hotkey, "Ctrl+Alt+I");
        assert_eq!(back.improve_model, "gemini-2.5-flash-lite");
        assert_eq!(back.enabled_skill_ids, vec!["summarize-this".to_string()]);
        // Absent fields still take their defaults alongside the ignored ones.
        assert_eq!(back.improve_undo_hotkey, "Ctrl+Alt+Z");
        assert!(back.selection_bar);
        // Re-serializing drops the stale keys: the next save cleans the file.
        let json = serde_json::to_string(&back).unwrap();
        assert!(!json.contains("byok"));
        assert!(!json.contains("Byok"));
    }

    #[test]
    fn cleared_skill_bar_is_preserved_not_reset() {
        // An explicit empty array must survive (real "user cleared the bar"
        // state) — distinct from the field being absent (→ full default set).
        let back: Settings =
            serde_json::from_str(r#"{"theme":"dark","hotkey":"x","enabledSkillIds":[]}"#)
                .unwrap();
        assert!(back.enabled_skill_ids.is_empty());
    }
}
