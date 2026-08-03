import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import {
  SKILLS,
  SKILL_SYSTEM,
  finalizeSkillOutput,
  visibleStreamText,
} from "@/services/skills";
import { DEFAULT_SETTINGS, type ProviderConfig, type Skill } from "@/types";
import { usePromptStore } from "@/store/promptStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import { SkillButtons } from "./SkillButtons";

// Persist through the store without a real Tauri backend: echo the settings.
vi.mock("@/services/tauriBridge", async (orig) => {
  const actual = await orig<typeof import("@/services/tauriBridge")>();
  return { ...actual, saveSettings: vi.fn(async (s) => s) };
});

const provider: ProviderConfig = {
  id: "p1",
  name: "Gemini",
  baseUrl: "https://generativelanguage.googleapis.com",
  apiKey: "g-test",
  isDefault: true,
};

const customSkill: Skill = {
  id: "custom-friendly",
  label: "Make it Friendly",
  template: "Rewrite warmly:\n[PASTE CONTENT HERE]",
  isCustom: true,
  icon: "fa-face-smile",
  description: "Warmer tone",
};

/** The skill chips — the bar is run-only, managing lives in the Skills tab. */
const skillChips = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".ig-skill"));

beforeEach(() => {
  usePromptStore.setState({ body: "", isSending: false });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    providers: [],
    selectedProviderId: null,
  });
  useToastStore.setState({ toasts: [] });
});

describe("SkillButtons", () => {
  it("renders the enabled skills in order, with no Manage trigger", () => {
    render(<SkillButtons onRun={() => {}} />);
    expect(skillChips().map((b) => b.getAttribute("aria-label"))).toEqual(
      SKILLS.map((s) => s.label)
    );
    expect(screen.queryByRole("button", { name: "Manage skills" })).toBeNull();
    // Built-in glyphs resolve (e.g. Summarize → fa-align-left).
    expect(document.querySelector("i.fa-align-left")).not.toBeNull();
  });

  it("disables skill chips while the editor is empty", () => {
    render(<SkillButtons onRun={() => {}} />);
    for (const b of skillChips()) expect(b).toBeDisabled();
  });

  it("disables skill chips while a send is in flight", () => {
    usePromptStore.setState({ body: "some text", isSending: true });
    render(<SkillButtons onRun={() => {}} />);
    for (const b of skillChips()) expect(b).toBeDisabled();
  });

  it("only renders the enabled subset, in enabledSkillIds order", () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        enabledSkillIds: ["improve-this", "summarize-this"],
      },
    });
    render(<SkillButtons onRun={() => {}} />);
    expect(skillChips().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Improve This",
      "Summarize This",
    ]);
  });

  it("runs the composed prompt with the skill system message and transform", () => {
    usePromptStore.setState({ body: "my draft" });
    useSettingsStore.setState({ providers: [provider] });
    const onRun = vi.fn();
    render(<SkillButtons onRun={onRun} />);

    fireEvent.click(screen.getByRole("button", { name: "Summarize This" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    const [composed, system, transform, visible] = onRun.mock.calls[0];
    expect(composed).toContain("my draft");
    expect(composed).not.toContain("[PASTE CONTENT HERE]");
    expect(system).toBe(SKILL_SYSTEM);
    expect(transform).toBe(finalizeSkillOutput);
    expect(visible).toBe(visibleStreamText);
  });

  it("renders and runs a custom skill using its own icon", () => {
    usePromptStore.setState({ body: "hey there" });
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        enabledSkillIds: ["custom-friendly"],
        customSkills: [customSkill],
      },
      providers: [provider],
    });
    const onRun = vi.fn();
    render(<SkillButtons onRun={onRun} />);

    expect(document.querySelector("i.fa-face-smile")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Make it Friendly" }));

    const [composed, system] = onRun.mock.calls[0];
    expect(composed).toContain("Rewrite warmly:");
    expect(composed).toContain("hey there");
    expect(system).toBe(SKILL_SYSTEM);
  });

  it("falls back to fa-bolt for a custom skill with an invalid icon", () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        enabledSkillIds: ["custom-bad"],
        customSkills: [{ ...customSkill, id: "custom-bad", icon: "nope" }],
      },
    });
    render(<SkillButtons onRun={() => {}} />);
    expect(document.querySelector(".ig-skill i.fa-bolt")).not.toBeNull();
  });

  it("falls back offline: inserts the composed prompt and toasts, no run", () => {
    usePromptStore.setState({ body: "my draft" });
    const onRun = vi.fn();
    render(<SkillButtons onRun={onRun} />);

    fireEvent.click(screen.getByRole("button", { name: "Translate This" }));

    expect(onRun).not.toHaveBeenCalled();
    const body = usePromptStore.getState().body;
    expect(body).toContain("my draft");
    expect(body).toContain("professional translator");
    expect(useToastStore.getState().toasts[0]?.kind).toBe("info");
  });

  it("shows the empty state pointing at the Skills tab when the bar is cleared", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, enabledSkillIds: [] },
    });
    render(<SkillButtons onRun={() => {}} />);

    expect(skillChips()).toHaveLength(0);
    expect(document.querySelector(".ig-skillbar__empty")).toHaveTextContent(
      /add one in the Skills tab/
    );
  });

  it("toggling a skill off in settings removes it from the bar (reactive)", () => {
    render(<SkillButtons onRun={() => {}} />);
    expect(skillChips().map((b) => b.getAttribute("aria-label"))).toContain(
      "Summarize This"
    );

    // The Skill Manager writes settings; the bar must follow with no reload.
    const settings = useSettingsStore.getState().settings;
    act(() =>
      useSettingsStore.setState({
        settings: {
          ...settings,
          enabledSkillIds: settings.enabledSkillIds.filter(
            (id) => id !== "summarize-this"
          ),
        },
      })
    );

    expect(skillChips().map((b) => b.getAttribute("aria-label"))).not.toContain(
      "Summarize This"
    );
  });
});
