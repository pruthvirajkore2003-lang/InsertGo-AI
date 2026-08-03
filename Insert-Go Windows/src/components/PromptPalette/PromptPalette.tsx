/**
 * Prompt composer — the core Spotlight-like surface (SPEC §4.1).
 * A single Improvise zone: one editor, the capabilities ribbon and colocated
 * actions (Nielsen H5/H6/H8).
 */
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { copyToClipboard } from "@/services/clipboard";
import { insertText, isTauri } from "@/services/tauriBridge";
import { usePromptStore } from "@/store/promptStore";
import { useLibraryStore } from "@/store/libraryStore";
import { toast } from "@/store/toastStore";
import type { Prompt } from "@/types";
import { SkillButtons } from "./SkillButtons";
import { SkillComponentsFloater } from "./SkillComponentsFloater";
import { PromptEditorDialog } from "@/components/PromptLibrary/PromptEditorDialog";
import { HistoryPanel } from "./HistoryPanel";
import { SkillManagerPanel } from "@/components/SkillManager/SkillManagerPanel";
import { ProFeatureGate } from "@/components/Monetization/ProFeatureGate";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { canUseHistory } from "@/store/monetizationStore";
import { useHistoryStore } from "@/store/historyStore";
import { useAuthStore } from "@/store/authStore";
import { useProviderRun } from "@/hooks/useProviderRun";
import { startProCheckout } from "@/services/billing";
import { ProxyOverloadCard, isOverloadError } from "./ProxyOverloadCard";

type Props = {
  editorRef: RefObject<HTMLTextAreaElement>;
};

/** Nested composer views under the Composer top-level tab (SPEC §4.1/§4.3). */
type ComposerSubTab = "improvise" | "skills" | "history";

function deriveTitle(body: string): string {
  const firstLine = body.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 60) || "Untitled";
}

export function PromptPalette({ editorRef }: Props) {
  // Field selectors, never `useStore()` bare: a whole-store subscription here
  // re-renders the composer (editor, skill buttons AND the result floater) on
  // every streamed delta, because setResult/setThinking/setMetrics fire ~60x/s
  // during a run. This component reads none of those three — selecting per
  // field keeps a stream repainting only the floater.
  const user = useAuthStore((s) => s.user);
  const hardwareId = useAuthStore((s) => s.hardwareId);
  const body = usePromptStore((s) => s.body);
  const error = usePromptStore((s) => s.error);
  const editingId = usePromptStore((s) => s.editingId);
  const activeSkill = usePromptStore((s) => s.activeSkill);
  const isSending = usePromptStore((s) => s.isSending);
  const retryRun = usePromptStore((s) => s.retryRun);
  const setBody = usePromptStore((s) => s.setBody);
  const setActiveSkill = usePromptStore((s) => s.setActiveSkill);
  const save = useLibraryStore((s) => s.save);
  const prompts = useLibraryStore((s) => s.prompts);

  const [showSave, setShowSave] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [subTab, setSubTab] = useState<ComposerSubTab>("improvise");
  const editing = editingId ? prompts.find((p) => p.id === editingId) : undefined;

  // Lock is recomputed each render so an entitlement change (upgrade) unlocks
  // History live. Improvise/Skills are always open.
  const subTabs: TabDef[] = [
    { id: "improvise", label: "Improvise", icon: "fa-wand-magic-sparkles" },
    { id: "skills", label: "Skills", icon: "fa-list-check" },
    {
      id: "history",
      label: "History",
      icon: "fa-clock-rotate-left",
      locked: !canUseHistory(),
    },
  ];

  // History "Reuse": drop a past run's text back into the editor (raw text, no
  // editingId — it's a run, not a saved prompt).
  const handleReuse = useCallback(
    (text: string) => {
      setBody(text);
      setSubTab("improvise");
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [setBody, editorRef]
  );

  const hasText = body.trim().length > 0;

  const handleCheckout = () => void startProCheckout();

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Backend couldn't restore focus / paste — the prompt was left on the
  // clipboard and the palette re-shown so this toast is visible.
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen("insert:fallback", () => {
      toast.info("Copied to clipboard — press Ctrl+V to paste manually");
    });
    return () => {
      void unlisten.then((u) => u());
    };
  }, []);

  // Skill bar "More": selection arrives here; stage it in the editor (reset
  // first — reset() clears body, so order matters).
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen<string>("palette:set_text", (e) => {
      const store = usePromptStore.getState();
      store.reset();
      store.setBody(e.payload);
    });
    return () => {
      void unlisten.then((u) => u());
    };
  }, []);

  // Record completed composer runs into local history. Imperative subscribe
  // (not a selector) so the composer never re-renders on a history change —
  // only the History sub-tab reads the entries. This window's promptStore
  // never sees the selection floater's runs, so no selection text is logged.
  useEffect(
    () =>
      usePromptStore.subscribe((s, prev) => {
        if (prev.isSending && !s.isSending && s.result && !s.error) {
          useHistoryStore.getState().record({
            body: s.body,
            outputTokens: s.metrics?.outputTokens ?? null,
            totalMs: s.metrics?.totalMs ?? null,
          });
        }
      }),
    []
  );

  // Copy feedback: flash "Copied!" / fa-check for 2s (mirrors the floater's
  // Copy button). Without it a click on Copy is completely silent. One timer
  // ref, cleared before each re-arm so rapid clicks don't flicker.
  const onCopy = useCallback(async () => {
    try {
      await copyToClipboard(body);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [body]);

  const onInsert = useCallback(async (text: string) => {
    if (!isTauri()) return;
    try {
      // Backend owns the window from here: it hides the palette, refocuses
      // the target app and pastes (or re-shows + emits `insert:fallback`).
      await insertText(text);
    } catch (e) {
      toast.error(`Insert failed: ${e}`);
    }
  }, []);

  // Shared send path: plain Send and the skill buttons both funnel through
  // here (extracted to a hook so the selection review floater window runs
  // the exact same pipeline — see useProviderRun for the contract).
  const runProvider = useProviderRun();

  // Plain send (Ctrl+Enter — there is no Send button) reviews in the same
  // Skill Components card as skill runs:
  // set a synthetic activeSkill ("Result") before dispatching so the floater
  // is the single result surface for every run type (no inline ResultView).
  const onSend = useCallback(
    (text: string) => {
      setActiveSkill({
        id: "send",
        label: "Result",
        icon: "fa-paper-plane",
        source: "editor",
      });
      void runProvider(text);
    },
    [runProvider, setActiveSkill]
  );

  const onConfirmSave = useCallback(
    (title: string, tags: string[]) => {
      const now = new Date().toISOString();
      const prompt: Prompt = {
        id: editing?.id ?? crypto.randomUUID(),
        title,
        body,
        tags,
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
      };
      void save(prompt);
      setShowSave(false);
    },
    [body, editing, save]
  );

  // Every send goes through the managed relay, which needs a session.
  const canSend = Boolean(user);

  // Ctrl+Enter = default action for the editor: send if a lane can run, else
  // copy the body.
  const onEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (canSend) onSend(body);
        else void copyToClipboard(body);
      }
    },
    [canSend, onSend, body]
  );

  const isTrialExpired = user && user.subscriptionStatus === "trial" && user.credits <= 0;
  const isAccountExpired = user && user.subscriptionStatus === "expired";
  const showPaywall = isTrialExpired || isAccountExpired;

  return (
    <div className="ig-composer">
      <div className="ig-subtabs">
        <Tabs
          tabs={subTabs}
          value={subTab}
          onChange={(id) => setSubTab(id as ComposerSubTab)}
          aria-label="Composer views"
          idBase="ig-mode"
        />
      </div>

      {subTab === "improvise" && (
        <div className="ig-body">
      {user && showPaywall && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24, alignSelf: "center", width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div>
            <span style={{ fontSize: 40 }}>💳</span>
            <h2 className="ig-heading" style={{ fontSize: 20, marginTop: 8, marginBottom: 8 }}>Free Trial Expired</h2>
            <p className="ig-muted" style={{ fontSize: 13, margin: 0 }}>
              You've used all your free trial credits. Upgrade to Pro for unlimited access and advanced AI models.
            </p>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 6, textAlign: "left", fontSize: 13 }}>
            <div>✔️ Unlimited prompt generations</div>
            <div>✔️ Access to advanced reasoning models</div>
            <div>✔️ High-speed proxy streaming</div>
          </div>

          <button className="ig-btn ig-btn--primary" onClick={handleCheckout}>
            Upgrade to Pro
          </button>

          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Device: {hardwareId}
          </div>
        </div>
      )}

      {user && !showPaywall && (
        <>
          <div className="ig-zone">
            <div className="ig-zone__head">
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              <span>Improvise</span>
            </div>
            <div className="ig-editor-wrap">
              <textarea
                ref={editorRef}
                className="ig-editor"
                value={body}
                placeholder="Type or paste a prompt to improve…"
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onEditorKeyDown}
                autoFocus
              />
            </div>
            {!hasText && (
              <div className="ig-picker__empty">
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                Type or paste a prompt above, then pick a skill to improve it.
              </div>
            )}
            <SkillButtons onRun={runProvider} />
            {/* Do-something-with-the-draft row: Insert is the app's payoff
                action so it carries primary weight; Copy and Save are quiet
                alternates. Every label gets a title explaining where the text
                goes (Nielsen H2) — "Insert" alone doesn't say "into the app
                you came from". */}
            <div className="ig-actions ig-actions--zone">
              <button
                className="ig-btn"
                onClick={onCopy}
                disabled={!hasText}
                title="Copy the prompt to the clipboard"
                aria-label="Copy prompt to clipboard"
              >
                <i
                  className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}
                  aria-hidden="true"
                />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                className="ig-btn"
                onClick={() => setShowSave(true)}
                disabled={!hasText}
                title="Save the prompt to your library for reuse"
                aria-label="Save prompt to library"
              >
                <i className="fa-solid fa-bookmark" aria-hidden="true" />
                Save
              </button>
              {isTauri() && (
                <button
                  className="ig-btn ig-btn--primary"
                  onClick={() => void onInsert(body)}
                  disabled={!hasText}
                  title="Paste the prompt into the app you were typing in"
                  aria-label="Insert prompt into the active app"
                >
                  <i className="fa-solid fa-paste" aria-hidden="true" />
                  Insert
                </button>
              )}
            </div>
          </div>

          {/* A relay capacity 503 is transient and blameless — it gets the
              cooldown/retry card, not a red line. Everything else stays a
              plain error: those are actionable as written. */}
          {error &&
            activeSkill === null &&
            (isOverloadError(error) ? (
              <ProxyOverloadCard
                onRetry={() => (retryRun ? retryRun() : onSend(body))}
                busy={isSending}
              />
            ) : (
              <div className="ig-error">{error}</div>
            ))}

          <div className="ig-actions">
            <span className="ig-hint" style={{ marginLeft: "auto" }}>
              <span className="ig-kbd">Ctrl</span>+
              <span className="ig-kbd">Enter</span> run
              <span aria-hidden="true"> · </span>
              <span className="ig-kbd">Esc</span> hide
            </span>
          </div>
        </>
      )}
        </div>
      )}

      {subTab === "skills" && <SkillManagerPanel />}

      {subTab === "history" && (
        <div className="ig-body">
          <ProFeatureGate feature="Local History" reason="history">
            <HistoryPanel onReuse={handleReuse} />
          </ProFeatureGate>
        </div>
      )}

      {activeSkill && (
        <SkillComponentsFloater onRun={runProvider} editorRef={editorRef} />
      )}

      {showSave && (
        <PromptEditorDialog
          body={body}
          initialTitle={editing?.title ?? deriveTitle(body)}
          initialTags={editing?.tags ?? []}
          onSave={onConfirmSave}
          onCancel={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
