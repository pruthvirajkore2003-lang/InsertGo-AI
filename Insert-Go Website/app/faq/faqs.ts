import { HOTKEYS } from "@/lib/constants/hotkeys";

export const faqs: [string, string][] = [
  [
    "What exactly is InsertGo.AI?",
    "InsertGo.AI is a floating, always-on-top AI prompt assistant for Windows — think Spotlight, but for AI prompts. Press a hotkey anywhere, type or choose a prompt, and the reviewed AI response is inserted into the application you were using.",
  ],
  [
    "Which applications does it work with?",
    "Virtually all of them. Because InsertGo operates at the operating-system level, it works with any Windows application that supports standard clipboard pasting (Ctrl+V) — browsers, code editors, Word, Notion, Slack, Teams, Outlook, terminals, and more.",
  ],
  [
    "Does it work on Mac or Linux?",
    "Not yet. InsertGo is built exclusively for Windows 10 and 11, where it can integrate deeply with native input pathways. We're exploring other platforms based on demand.",
  ],
  [
    "How does the text actually get inserted?",
    `When you press ${HOTKEYS.primary.label}, InsertGo remembers which window was active. After the AI responds, it restores and verifies that window, temporarily stages the text on the clipboard, and sends the app's paste shortcut. Your previous clipboard value is restored after a successful insert.`,
  ],
  [
    "What are the default hotkeys?",
    `Three. ${HOTKEYS.primary.label} — ${HOTKEYS.primary.name} — ${HOTKEYS.primary.description}; the backquote/~ key is top-left under Esc. ${HOTKEYS.improve.label} — ${HOTKEYS.improve.name} — ${HOTKEYS.improve.description}. ${HOTKEYS.undo.label} — ${HOTKEYS.undo.name} — ${HOTKEYS.undo.description}.`,
  ],
  [
    "Can I change the hotkeys?",
    `Yes. All three are rebindable in Settings to any combination, including multi-key chords: ${HOTKEYS.primary.label} for the palette, ${HOTKEYS.improve.label} for ${HOTKEYS.improve.name}, and ${HOTKEYS.undo.label} for ${HOTKEYS.undo.name}. The three must stay distinct from each other — leave a field blank to disable that shortcut. You can also set separate hotkeys for specific templates.`,
  ],
  [
    "Can InsertGo rewrite text without opening the palette?",
    `Yes — that is ${HOTKEYS.improve.name}. Put your cursor in any text field, press ${HOTKEYS.improve.label}, and InsertGo reads the whole field, rewrites it, and writes the result back in place; the palette never appears. If you want the original wording back, press ${HOTKEYS.undo.label} (${HOTKEYS.undo.name}) and the pre-improvement draft is restored.`,
  ],
  [
    "Which AI models does it use?",
    "Every request runs through the managed InsertGo relay on a fast default model — there is no API key to paste and no provider account to create. Model selection is server-side, so upgrades reach you without an app update.",
  ],
  [
    "Is my data private?",
    "Prompt templates and settings are stored in local application data. The app holds no AI key — the only credential it keeps is your InsertGo session token, in the Windows credential store. Prompts leave your device only when you explicitly run one, and only to the managed InsertGo relay.",
  ],
  [
    "Does it slow down my PC?",
    "InsertGo stays in the system tray and does most work only after a hotkey or selection action. Actual CPU and memory use vary by Windows version, active features, and webview state; use Task Manager to confirm behavior on your device.",
  ],
  [
    "Is there really a free plan?",
    "Yes — 5 AI credits every day, forever, with the full overlay and universal compatibility. No credit card required. Plus and Pro raise the daily allowance to 50 and 150, and add-on credit packs never expire.",
  ],
];
