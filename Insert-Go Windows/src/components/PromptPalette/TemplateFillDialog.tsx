/**
 * Fill-in dialog for AI Blaze dynamic prompts (SPEC §4.1). Renders one control
 * per distinct `{form…}` command in the template body; the fully expanded,
 * token-free text is handed back via `onInsert`. Mirrors `PromptEditorDialog`
 * for look/feel and keyboard behavior (Enter = Insert, Esc = Cancel).
 *
 * SECURITY: every value flows through React text nodes / controlled inputs and
 * the plain expander — no `dangerouslySetInnerHTML`, no eval. `{clipboard}` is
 * read only here, inside the user-initiated fill flow (SPEC §10).
 */
import { useEffect, useMemo, useState } from "react";
import { readClipboard } from "@/services/clipboard";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import {
  type BlazeField,
  expandBlaze,
  parseBlazeCommands,
} from "@/services/blazeCommands";
import type { Template } from "@/types";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Props = {
  template: Template;
  onInsert: (expanded: string) => void;
  onCancel: () => void;
};

function initText(fields: BlazeField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.kind === "toggle") continue;
    if (f.kind === "menu" && f.multiple) continue;
    if (f.kind === "menu") out[f.name] = f.default ?? f.options?.[0] ?? "";
    else out[f.name] = f.default ?? "";
  }
  return out;
}

function initToggles(fields: BlazeField[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of fields) {
    if (f.kind === "toggle") out[f.name] = (f.default ?? "").toLowerCase() === "yes";
  }
  return out;
}

function initMulti(fields: BlazeField[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of fields) {
    if (f.kind === "menu" && f.multiple) out[f.name] = f.default ? [f.default] : [];
  }
  return out;
}

export function TemplateFillDialog({ template, onInsert, onCancel }: Props) {
  const { fields, hasClipboard, unparsed } = useMemo(
    () => parseBlazeCommands(template.body),
    [template.body]
  );

  // Lazy init from field defaults; the parent remounts (key=template.id) per
  // selection, so a one-shot initializer is correct.
  const [text, setText] = useState<Record<string, string>>(() => initText(fields));
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => initToggles(fields));
  const [multi, setMulti] = useState<Record<string, string[]>>(() => initMulti(fields));
  const [clipboard, setClipboard] = useState("");

  // Explicit, user-initiated clipboard read (only when the prompt needs it).
  useEffect(() => {
    let alive = true;
    if (hasClipboard) void readClipboard().then((c) => alive && setClipboard(c));
    return () => {
      alive = false;
    };
  }, [hasClipboard]);

  // Esc closes without inserting — declined when an open combobox owns the
  // key (it closes its list instead).
  useAppShortcuts({
    onClose: (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.getAttribute("aria-expanded") === "true") return false;
      onCancel();
    },
  });

  const build = (): string => {
    const values: Record<string, string> = {};
    for (const f of fields) {
      if (f.kind === "toggle") {
        values[f.name] = toggles[f.name] ? "yes" : "no";
      } else if (f.kind === "menu" && f.multiple) {
        const picked = multi[f.name] ?? [];
        // Filter through options to keep author order in the joined output.
        values[f.name] = (f.options ?? []).filter((o) => picked.includes(o)).join(", ");
      } else {
        values[f.name] = text[f.name] ?? "";
      }
    }
    return expandBlaze(template.body, values, clipboard);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onInsert(build());
  };

  return (
    <div className="ig-modal" onClick={onCancel}>
      <form
        className="ig-modal__card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="ig-modal__title">{template.name}</div>

        {unparsed.length > 0 && (
          <div className="ig-error">
            Left unparsed (sent as-is): {unparsed.join("  ")}
          </div>
        )}

        {fields.map((f, idx) => {
          const id = `fill-${f.name}`;
          return (
            <div className="ig-field" key={f.name}>
              <label htmlFor={id}>{f.label}</label>

              {f.kind === "text" && (
                <input
                  id={id}
                  className="ig-input"
                  autoFocus={idx === 0}
                  value={text[f.name] ?? ""}
                  onChange={(e) => setText((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}

              {f.kind === "paragraph" && (
                <textarea
                  id={id}
                  className="ig-editor"
                  autoFocus={idx === 0}
                  value={text[f.name] ?? ""}
                  onChange={(e) => setText((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}

              {f.kind === "menu" && !f.multiple && (
                <SearchableSelect
                  id={id}
                  autoFocus={idx === 0}
                  options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
                  value={text[f.name] ?? ""}
                  onChange={(v) => setText((s) => ({ ...s, [f.name]: v }))}
                />
              )}

              {f.kind === "menu" && f.multiple && (
                <div className="ig-checklist">
                  {(f.options ?? []).map((o) => {
                    const picked = (multi[f.name] ?? []).includes(o);
                    return (
                      <label key={o} className="ig-check">
                        <input
                          type="checkbox"
                          checked={picked}
                          onChange={(e) =>
                            setMulti((s) => {
                              const cur = s[f.name] ?? [];
                              const next = e.target.checked
                                ? [...cur, o]
                                : cur.filter((x) => x !== o);
                              return { ...s, [f.name]: next };
                            })
                          }
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              )}

              {f.kind === "toggle" && (
                <label className="ig-check">
                  <input
                    id={id}
                    type="checkbox"
                    checked={toggles[f.name] ?? false}
                    onChange={(e) =>
                      setToggles((s) => ({ ...s, [f.name]: e.target.checked }))
                    }
                  />
                  Enabled
                </label>
              )}
            </div>
          );
        })}

        {hasClipboard && (
          <div className="ig-field">
            <label>Clipboard (inserted where the prompt uses it)</label>
            <div className="ig-modal__preview">{clipboard || "(clipboard empty)"}</div>
          </div>
        )}

        {fields.length === 0 && !hasClipboard && (
          <div className="ig-muted">No fields to fill — insert as-is.</div>
        )}

        <div className="ig-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ig-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="ig-btn ig-btn--primary">
            Insert
          </button>
        </div>
      </form>
    </div>
  );
}
