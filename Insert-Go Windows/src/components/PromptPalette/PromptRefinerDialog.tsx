/**
 * Prompt Refiner dialog (SPEC §4.1 extension) — paste a raw AI-conversation
 * transcript, pick (or auto-detect) its format, run the two-stage
 * Summarizer → Synthesizer pipeline (`promptRefiner.ts`), and review the
 * resulting Role/Context/Constraints/Task master prompt. Mirrors
 * `TemplateFillDialog` for look/feel and keyboard behavior (Esc = Cancel).
 *
 * Owns its run state locally (two sequential calls don't fit promptStore's
 * single-run shape) with the same abort-on-supersede contract as
 * useProviderRun: one AbortController per run; a new run, Cancel, or unmount
 * aborts the in-flight call, and an aborted run writes nothing.
 *
 * SECURITY: the transcript and both stage outputs render only through React
 * text nodes / controlled textareas — no dangerouslySetInnerHTML. The
 * pipeline itself enforces the <transcript>/<summary> data boundaries
 * (see promptRefiner.ts).
 */
import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/services/clipboard";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { resolveActiveProvider } from "@/services/lanes";
import {
  detectAndParse,
  parseChatGptApiFormat,
  parseClaudeExport,
  parseGeminiExport,
  parseOpenAiExport,
  parseRawText,
  runRefinerPipeline,
  type RefinerPipelineResult,
  type RefinerStage,
} from "@/services/promptRefiner";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";
import { usePromptStore } from "@/store/promptStore";
import { toast } from "@/store/toastStore";
import type { Prompt, TranscriptFormat, TranscriptMessage } from "@/types";
import { PromptEditorDialog } from "@/components/PromptLibrary/PromptEditorDialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Props = {
  onClose: () => void;
};

const FORMAT_OPTIONS: Array<{ value: TranscriptFormat; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: "raw", label: "Raw [User]/[Assistant] text" },
  { value: "openai-export", label: "ChatGPT export (conversations.json)" },
  { value: "openai-api", label: "OpenAI API messages" },
  { value: "claude-export", label: "Claude export" },
  { value: "gemini-export", label: "Gemini Takeout" },
];

const STAGE_LABEL: Record<Exclude<RefinerStage, "done">, string> = {
  summarizing: "Summarizing… (1/2)",
  synthesizing: "Synthesizing… (2/2)",
};

/** Dispatch to the user-selected parser, or auto-detect. */
function parseWithFormat(
  format: TranscriptFormat,
  raw: string
): TranscriptMessage[] {
  switch (format) {
    case "raw":
      return parseRawText(raw);
    case "openai-export":
      return parseOpenAiExport(raw);
    case "openai-api":
      return parseChatGptApiFormat(raw);
    case "claude-export":
      return parseClaudeExport(raw);
    case "gemini-export":
      return parseGeminiExport(raw);
    case "auto":
      return detectAndParse(raw).messages;
  }
}

function deriveTitle(body: string): string {
  const firstLine = body.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 60) || "Refined master prompt";
}

export function PromptRefinerDialog({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setBody = usePromptStore((s) => s.setBody);
  const save = useLibraryStore((s) => s.save);

  const [format, setFormat] = useState<TranscriptFormat>("auto");
  const [raw, setRaw] = useState("");
  const [stage, setStage] = useState<Exclude<RefinerStage, "done"> | null>(null);
  const [result, setResult] = useState<RefinerPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Esc closes without inserting — declined when the nested save dialog is
  // open (its own layer handles Esc) or an open combobox owns the key.
  useAppShortcuts({
    onClose: (e) => {
      const target = e.target as HTMLElement | null;
      if (showSave || target?.getAttribute("aria-expanded") === "true") {
        return false;
      }
      onClose();
    },
  });

  const onRefine = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isStale = () =>
      abortRef.current !== controller || controller.signal.aborted;

    setError(null);
    setResult(null);

    let transcript: TranscriptMessage[];
    try {
      transcript = parseWithFormat(format, raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Transcript parse failed: ${msg}`);
      return;
    }

    try {
      // Same gate as useProviderRun: the managed relay needs a login.
      const resolved = await resolveActiveProvider("chat");
      if (resolved.requiresLogin && !user) {
        throw new Error("You must be logged in to use the AI assistant.");
      }
      const out = await runRefinerPipeline(resolved.provider, transcript, {
        signal: controller.signal,
        onStageChange: (s) => {
          if (!isStale() && s !== "done") setStage(s);
        },
      });
      if (isStale()) return;
      setResult(out);
    } catch (e) {
      if (isStale()) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Refine failed: ${msg}`);
    } finally {
      if (!isStale()) setStage(null);
    }
  };

  const onInsert = () => {
    if (!result) return;
    setBody(result.masterPrompt);
    toast.success("✅ Master prompt loaded — review it and hit Send");
    onClose();
  };

  const onConfirmSave = (title: string, tags: string[]) => {
    if (!result) return;
    const now = new Date().toISOString();
    const prompt: Prompt = {
      id: crypto.randomUUID(),
      title,
      body: result.masterPrompt,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    void save(prompt);
    setShowSave(false);
    toast.success("✅ Master prompt saved to library");
  };

  return (
    <div className="ig-modal" onClick={onClose}>
      <div
        className="ig-modal__card"
        style={{ maxWidth: 560, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ig-modal__title">Prompt Refiner</div>

        <div className="ig-field">
          <label htmlFor="refiner-format">Transcript format</label>
          <SearchableSelect
            id="refiner-format"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={(v) => setFormat(v as TranscriptFormat)}
          />
        </div>

        <div className="ig-field">
          <label htmlFor="refiner-transcript">
            Conversation transcript (paste an export or copied chat)
          </label>
          <textarea
            id="refiner-transcript"
            className="ig-editor"
            style={{ minHeight: 140 }}
            autoFocus
            value={raw}
            placeholder={"[User]\n…\n\n[Assistant]\n…"}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>

        {error && <div className="ig-error">{error}</div>}

        {result && (
          <>
            <div className="ig-field">
              <label htmlFor="refiner-master">Master prompt</label>
              <textarea
                id="refiner-master"
                className="ig-editor"
                style={{ minHeight: 180 }}
                readOnly
                value={result.masterPrompt}
              />
            </div>
            <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ig-btn"
                onClick={() => void copyToClipboard(result.masterPrompt)}
              >
                <i className="fa-solid fa-copy" aria-hidden="true" />
                Copy
              </button>
              <button
                type="button"
                className="ig-btn"
                onClick={() => setShowSave(true)}
              >
                <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                Save
              </button>
              <button
                type="button"
                className="ig-btn ig-btn--primary"
                onClick={onInsert}
              >
                <i className="fa-solid fa-paste" aria-hidden="true" />
                Insert to Editor
              </button>
            </div>
          </>
        )}

        <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ig-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ig-btn ig-btn--primary"
            onClick={() => void onRefine()}
            disabled={raw.trim().length === 0 || stage !== null}
          >
            <i className="fa-solid fa-filter" aria-hidden="true" />
            {stage ? STAGE_LABEL[stage] : "Refine"}
          </button>
        </div>

        {showSave && result && (
          <PromptEditorDialog
            body={result.masterPrompt}
            initialTitle={deriveTitle(result.masterPrompt)}
            initialTags={["refined"]}
            onSave={onConfirmSave}
            onCancel={() => setShowSave(false)}
          />
        )}
      </div>
    </div>
  );
}
