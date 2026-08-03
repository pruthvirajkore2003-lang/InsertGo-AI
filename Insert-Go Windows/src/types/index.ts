/**
 * Shared domain types for InsertGo.
 * Mirrors the data model in SPEC.md §8.1 and the Rust `domain` structs,
 * so the JS <-> Rust bridge stays in sync.
 */

export type Prompt = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type ProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  /**
   * @deprecated No real API key ever belongs here: this object is persisted
   * to plain JSON by the Rust backend, and the app holds no LLM key at all
   * (the managed relay does). Kept only because the field is part of the
   * persisted shape; always "" or a dummy marker.
   */
  apiKey?: string;
  isDefault: boolean;
};

/** Hard cap on a single prompt's length, enforced in every provider `send()`
 *  — prevents an accidental megabyte paste from exhausting quota/credits. */
export const MAX_PROMPT_CHARS = 100_000;

export type ThemePreference = "light" | "dark" | "system" | "high-contrast";

/** Skill Manager filter category. Built-in skills are mapped by id in
 *  `services/skills.ts`; custom skills carry their own (chosen in the Create
 *  Skill wizard). "custom" is also the implicit bucket for any `isCustom` skill
 *  in the "Custom" chip, regardless of the stored category. */
export type SkillCategory = "writing" | "coding" | "research" | "ops" | "custom";

/** One prompt-transformation skill. The 10 vendored skills (`src/skills/*.md`)
 *  are parsed into this shape at build time (see `services/skills.ts`); users
 *  can also create their own via the Skill Manager (`isCustom: true`). The
 *  canonical definition lives here so the settings layer and the pure engine
 *  share one type; `services/skills.ts` re-exports it for its call sites. */
export type Skill = {
  /** Slug id. Vendored: filename minus the numeric prefix
   *  (`01-summarize-this.md` → `summarize-this`). Custom: `custom-<slug>` so a
   *  user skill can never collide with a built-in id. */
  id: string;
  /** Button label / heading. */
  label: string;
  /** Prompt template with a single content marker, or none (append fallback). */
  template: string;
  /** True for user-created skills; absent/false for the vendored set. */
  isCustom?: boolean;
  /** Font Awesome solid glyph class (e.g. `"fa-bolt"`); falls back to fa-bolt. */
  icon?: string;
  /** One-line description shown in the Skill Manager. */
  description?: string;
  /** Filter category (Skill Manager). Built-ins resolve theirs by id; custom
   *  skills persist the wizard's choice. Absent → treated as "custom" for
   *  customs, "ops" for built-ins (see `skillCategory` in services/skills.ts). */
  category?: SkillCategory;
  /** Run this skill through the backend's two-pass Google Search grounding.
   *  Only meaningful for custom skills — the built-in research pair is
   *  resolved by id (see `resolveSkillGrounding` in services/skills.ts). */
  grounded?: boolean;
};

/** A named skill-bar combination the user can save and re-apply with one click
 *  (Skill Manager presets). `skillIds` is the `enabledSkillIds` snapshot taken
 *  at save time; stale ids are tolerated at apply time (see `getActiveSkills`).
 *  Persisted in Settings, mirrored by the Rust `SkillSetPreset`. */
export type SkillSetPreset = {
  id: string;
  name: string;
  skillIds: string[];
};

/** Self-segmentation answer from the first-run card (Slack's pattern, applied
 *  to a single-user app). It ORDERS the starter prompts and the skill bar and
 *  nothing else — no feature is hidden by it, so a wrong pick costs a re-pick
 *  rather than a reinstall. `null` = never asked; "general" = deliberately
 *  skipped, which is a real answer and must not re-prompt. */
export type WritingSegment = "ai" | "email" | "docs" | "code" | "general";

/** The OS capabilities the Access panel primes, one per PermissionCard.
 *  Deliberately
 *  contains NO microphone/audio entry — voice is out of scope, so onboarding
 *  must never ask for it. */
export type PermissionId =
  | "accessibility"
  | "globalHotkey"
  | "improveHotkey"
  | "clipboard"
  | "autostart";

/** Live state of one primed capability. Mirrors the Rust `PermissionReport`
 *  string values (platform/permissions.rs).
 *  - `unknown`     — not probed yet (the pre-prompt state: we explain first).
 *  - `checking`    — a probe is in flight (frontend-only, never from Rust).
 *  - `granted`     — usable right now.
 *  - `unavailable` — the capability isn't reachable on this machine
 *                    (UIA client won't start, clipboard locked by another app).
 *  - `blocked`     — refused: a hotkey chord another app already owns.
 *  - `off`         — optional and not enabled (autostart). Not a failure. */
export type PermissionStatus =
  | "unknown"
  | "checking"
  | "granted"
  | "unavailable"
  | "blocked"
  | "off";

/** One `check_permissions` probe result. Every field is a live read — nothing
 *  is persisted, so a permission fixed in Windows shows up on the next check.
 *  The probes are capability-only: none of them read the user's clipboard
 *  contents or any window's text (SPEC §10). */
export type PermissionReport = {
  accessibility: PermissionStatus;
  globalHotkey: PermissionStatus;
  improveHotkey: PermissionStatus;
  clipboard: PermissionStatus;
  autostart: PermissionStatus;
  /** True when InsertGo itself runs elevated. Drives the UIPI explainer: a
   *  normal-integrity InsertGo cannot read or paste into an elevated target
   *  window, and Windows gives no error for it — so we say so up front. */
  elevated: boolean;
};

/** Explicit legal consent captured on the welcome screen. `accepted` is only
 *  ever set by the user checking the box; `version` pins WHICH text they
 *  agreed to, so a later revision can re-ask instead of assuming. */
export type TermsConsentState = {
  version: string;
  accepted: boolean;
};

export type Settings = {
  theme: ThemePreference;
  hotkey: string; // e.g. "Ctrl+`"
  defaultProviderId: string | null;
  /** In-situ selection skill bar on/off (the watcher's kill switch). */
  selectionBar: boolean;
  /** Executables the selection watcher may read from (privacy scope). */
  selectionBarApps: string[];
  /** Read-scope model (SPEC §10): "allowlist" (read only `selectionBarApps`)
   *  or "all" (read every foreground app except InsertGo + the blocklist).
   *  Defaults to "allowlist" — an explicit, off-by-default opt-in to widen. */
  selectionBarScope: "allowlist" | "all";
  /** Executables never read even in "all" scope — password managers and
   *  credential UIs. Case-insensitive; a single trailing/embedded `*` matches
   *  a family (e.g. "keepass*.exe"). */
  selectionBarBlocklist: string[];
  /** Inline Improve hotkey (SPEC §4.4), e.g. "Ctrl+Alt+Enter". */
  improveHotkey: string;
  /** Inline Improve undo hotkey — restores the pre-improve snapshot. */
  improveUndoHotkey: string;
  /** Inline Improve model override (SPEC §5.6.3, "" = the hosted lane's fast
   *  default). */
  improveModel: string;
  /** Ids of the skills shown on the skill bar, in display order (built-in or
   *  custom). An empty array is a real state — the user cleared the bar — and
   *  renders the empty-bar hint, not the defaults. Ids that no longer resolve
   *  (a deleted custom skill) are ignored at render time. Seeded with all 10
   *  vendored ids; the Rust side mirrors this default so a pre-feature
   *  settings.json upgrades to the full bar rather than an empty one. */
  enabledSkillIds: string[];
  /** User-created custom skills (each `isCustom: true`), persisted verbatim. */
  customSkills: Skill[];
  /** Saved skill-bar combinations (Skill Manager presets). Empty until the user
   *  saves one. Mirrored by the Rust side so presets survive a restart. */
  skillSetPresets: SkillSetPreset[];
  /** Dead to the UI since setup was removed — no screen reads or writes it.
   *  Kept because the Rust settings struct still carries the field, and
   *  dropping it here would break settings.json round-tripping. */
  hasCompletedOnboarding: boolean;
  /** What the user said they write most. Ordering only — see `WritingSegment`.
   *  Nothing asks the question since setup was removed; the field and its
   *  Rust mirror stay so an answer recorded by an older build survives. */
  writingSegment: WritingSegment | null;
  /** True once one Improve run has actually produced improved text — the app's
   *  only activation signal, written by the hotkey pipeline. */
  firstImproveDone: boolean;
  /** Version of the Terms & Privacy text the user explicitly accepted
   *  (`LEGAL_VERSION`), or null when consent was never given. No in-app screen
   *  collects it since setup was removed; kept for the Rust settings contract
   *  and so a future consent flow can tell old acceptances apart. */
  acceptedTermsVersion: string | null;
};

export type AppContext = {
  processName: string;
  windowTitle: string;
};

export type TemplateCategory =
  | "Code"
  | "Writing"
  | "Research"
  | "Custom"
  | "Text Editing"
  | "Business & Marketing"
  | "Recruiting & Career"
  | "Education"
  | "Personal";

/** A reusable prompt skeleton with `{{placeholder}}` slots (SPEC §3.2.4, §4.1). */
export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  /** Plain-language one-liner shown in the composer's prompt picker. */
  description?: string;
};

/** Request/response shape for the generic v1 provider call (SPEC.md §5.4). */
export type ProviderRequest = {
  prompt: string;
  /** Per-call system message (skill runs). The provider's built-in default
   *  (the refiner system prompt) is used when this is absent. */
  system?: string;
  /** Sampling temperature (SPEC §15.4: ≈0.3 for Improve). Only lanes whose
   *  API accepts it send it — current Anthropic models reject sampling
   *  params, so that lane always omits it. */
  temperature?: number;
  metadata?: Record<string, unknown>;
  /** Opt into the backend's two-pass web-grounded run (POST body `grounded`).
   *  Absent/false keeps the pre-existing single-pass contract byte-for-byte. */
  grounded?: boolean;
};

export type ProviderResponse = {
  text: string;
};

/** One web source behind a grounded answer (title + link), display-only.
 *  Mirrors the website's `Citation` (Insert-Go Website/lib/gemini.ts) — the
 *  wire contract between the two, so both sides must change together. */
export type Citation = { uri: string; title: string };

/** Citations from a grounded run, delivered as the one trailing custom SSE
 *  frame `{"insertgo":{"grounding":…}}` after the Gemini chunks end. */
export type GroundingResult = {
  /** The web-search queries Gemini ran to ground the answer. */
  queries: string[];
  /** Deduplicated web sources (title → uri). */
  chunks: Citation[];
  /** Google's "Search Suggestions" HTML. Carried for parity with the server
   *  payload; the desktop client does NOT render it (no innerHTML on this
   *  surface — see the SkillComponentsFloater security note). */
  searchSuggestionHtml?: string;
};

/** One normalized turn of an ingested AI-conversation transcript — the
 *  canonical shape every Prompt Refiner parser emits (promptRefiner.ts). */
export type TranscriptMessage = {
  role: "user" | "assistant" | "system";
  text: string;
  /** ISO 8601, only when the source export carried one. */
  timestamp?: string;
};

/** Machine-validated intermediate between the Prompt Refiner's two LLM
 *  stages: the Summarizer emits it as JSON, `parseSummaryOutput` validates
 *  it, and the Synthesizer consumes it. Structured (not prose) so drift
 *  between stages is a parse error instead of silent corruption. */
export type StructuredSummary = {
  project: string;
  stack: string;
  decisions: Array<{ topic: string; decision: string; rationale: string }>;
  constraints: string[];
  openQuestions: string[];
  keyFiles: string[];
  rejectedApproaches: Array<{ approach: string; reason: string }>;
};

/** Transcript input formats the Prompt Refiner ingests; "auto" defers to
 *  `detectAndParse`. */
export type TranscriptFormat =
  | "raw"
  | "openai-export"
  | "openai-api"
  | "claude-export"
  | "gemini-export"
  | "auto";

/** Default settings used before any user config is loaded.
 *  Must mirror the Rust `Settings::default()` (domain/settings.rs). */
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  hotkey: "Ctrl+`",
  defaultProviderId: null,
  selectionBar: true,
  // Must mirror default_selection_bar_apps() in src-tauri/src/domain/settings.rs.
  selectionBarApps: [
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
    // Editors / IDEs (covering the host process covers its extensions).
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
  ],
  selectionBarScope: "allowlist",
  // Must mirror default_selection_bar_blocklist() in settings.rs.
  selectionBarBlocklist: [
    "1password.exe",
    "keepass*.exe",
    "keepassxc.exe",
    "bitwarden.exe",
    "lastpass.exe",
    "dashlane.exe",
    "logonui.exe",
    "consent.exe",
  ],
  improveHotkey: "Ctrl+Alt+Enter",
  improveUndoHotkey: "Ctrl+Alt+Z",
  improveModel: "",
  // All 10 vendored skills enabled by default, in repo order. Must mirror
  // default_enabled_skill_ids() in src-tauri/src/domain/settings.rs and stay in
  // sync with SKILLS in services/skills.ts (guarded by a unit test).
  enabledSkillIds: [
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
  ],
  customSkills: [],
  skillSetPresets: [],
  // First run until the welcome screen says otherwise. Must mirror
  // Settings::default() in src-tauri/src/domain/settings.rs.
  hasCompletedOnboarding: false,
  acceptedTermsVersion: null,
  writingSegment: null,
  firstImproveDone: false,
};
