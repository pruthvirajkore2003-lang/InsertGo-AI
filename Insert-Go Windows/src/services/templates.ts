/**
 * Prompt templates with `{{placeholder}}` expansion (SPEC §3.2.4, §4.1, §4.3).
 * Engine is pure (unit-testable); built-ins ship with v1. Unknown placeholders
 * are intentionally left intact so they stay visible in the editor.
 */
import type { Template, TemplateCategory } from "@/types";

export const PLACEHOLDER_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Unique placeholder names found in `body`, in first-seen order. */
export function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER_RE)) {
    seen.add(m[1]);
  }
  return [...seen];
}

/** Replace placeholders present in `vars`; leave unknown ones untouched. */
export function expandTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(PLACEHOLDER_RE, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole
  );
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Code",
  "Writing",
  "Research",
  "Custom",
];

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "code-explain",
    name: "Explain code",
    category: "Code",
    body:
      "Role: You are a senior software engineer and technical educator.\n" +
      "Task: Explain what the following code does, step by step.\n\n" +
      "Instructions:\n" +
      "- Walk through the code's logic line by line or block by block.\n" +
      "- Explain the purpose and effect of each step in plain language.\n" +
      "- Highlight any important patterns, edge cases, or potential issues.\n" +
      "- Use numbered steps for the explanation.\n" +
      "- Do not modify the code.\n\n" +
      "Code:\n{{selected_text}}",
    description: "Get a step-by-step explanation of any code you paste.",
  },
  {
    id: "code-bugs",
    name: "Find bugs",
    category: "Code",
    body:
      "Role: You are a meticulous code reviewer and QA engineer.\n" +
      "Task: Find bugs, edge cases, and potential issues in this code and suggest fixes.\n\n" +
      "Instructions:\n" +
      "- Identify each bug or edge case with the specific line or expression.\n" +
      "- Explain why it is a problem and what could go wrong.\n" +
      "- Provide a concrete fix or mitigation for each issue.\n" +
      "- Format as a numbered list: issue → explanation → fix.\n" +
      "- If no bugs are found, state that clearly.\n\n" +
      "Code:\n{{selected_text}}",
    description: "Spot bugs and edge cases, with suggested fixes.",
  },
  {
    id: "code-comments",
    name: "Add comments",
    category: "Code",
    body:
      "Role: You are a senior developer writing documentation for a team.\n" +
      "Task: Add clear, concise comments to this code without changing its behavior.\n\n" +
      "Instructions:\n" +
      "- Add inline comments explaining the 'why', not just the 'what'.\n" +
      "- Add a brief docstring or header comment summarizing the function/block.\n" +
      "- Do not modify, reformat, or refactor the code itself.\n" +
      "- Match the existing code style and indentation.\n" +
      "- Return the full code with comments added.\n\n" +
      "Code:\n{{selected_text}}",
    description: "Add helpful comments without changing what the code does.",
  },
  {
    id: "write-improve",
    name: "Improve writing",
    category: "Writing",
    body:
      "Role: You are a professional editor and writing coach.\n" +
      "Task: Improve the clarity, flow, and tone of the following text.\n\n" +
      "Instructions:\n" +
      "- Fix awkward phrasing, wordiness, and weak transitions.\n" +
      "- Preserve the author's voice, meaning, and factual content.\n" +
      "- Keep the length comparable to the original.\n" +
      "- Do not add new claims or change the meaning.\n" +
      "- Return only the improved text, no commentary.\n\n" +
      "Text:\n{{selected_text}}",
    description: "Polish your text so it reads clearly and sounds right.",
  },
  {
    id: "write-summarize",
    name: "Summarize",
    category: "Writing",
    body:
      "Role: You are an expert summarizer and information analyst.\n" +
      "Task: Summarize the following in 3 concise bullet points.\n\n" +
      "Instructions:\n" +
      "- Each bullet should capture a key takeaway with specific details.\n" +
      "- Preserve critical facts: numbers, names, dates, decisions.\n" +
      "- Use clear, direct language — no filler or repetition.\n" +
      "- Return only the 3 bullet points, nothing else.\n\n" +
      "Text:\n{{selected_text}}",
    description: "Boil any text down to 3 quick bullet points.",
  },
  {
    id: "research-translate",
    name: "Translate to English",
    category: "Research",
    body:
      "Role: You are a professional translator with native-level fluency.\n" +
      "Task: Translate the following to English.\n\n" +
      "Instructions:\n" +
      "- Produce a natural, idiomatic English translation.\n" +
      "- Preserve the original meaning, tone, and register.\n" +
      "- Keep formatting, numbers, URLs, and proper nouns intact.\n" +
      "- Return only the translation, no annotations or source comparison.\n\n" +
      "Text:\n{{selected_text}}",
    description: "Turn text in any language into clear English.",
  },
];
