/**
 * Seeded prompt library for InsertGo, organized by category.
 *
 * The dynamic prompts below are ported from the AI Blaze (blaze.today) public
 * prompt gallery and docs, and are bundled as ready-to-use examples:
 *   - https://blaze.today/gallery/gpt/chatgpt-prompts-library/
 *   - https://blaze.today/aiblaze/docs/writing-better-prompts/  (PTCF template)
 *   - https://blaze.today/aiblaze/docs/rewrite/                 (Rewrite pack)
 * Credit: AI Blaze / Blaze.today. Bodies keep the original `{form…}` /
 * `{clipboard}` command syntax verbatim — the Blaze engine (`blazeCommands.ts`)
 * parses them into fill-in fields, so DO NOT hand-flatten the syntax here.
 *
 * SAFETY: diagnostic / medical-advice prompts from the gallery (e.g. "Virtual
 * Doctor / create a treatment plan") are intentionally excluded — bundling
 * prompts that instruct the model to output a diagnosis is a product-liability
 * concern, not just a style choice.
 */
import type { Template, TemplateCategory } from "@/types";
import { BUILTIN_TEMPLATES } from "./templates";

/** Category order used by the composer picker (empty groups are skipped). */
export const LIBRARY_CATEGORIES: TemplateCategory[] = [
  "Text Editing",
  "Writing",
  "Business & Marketing",
  "Recruiting & Career",
  "Education",
  "Personal",
  "Code",
  "Research",
  "Custom",
];

/** AI Blaze gallery prompts (dynamic `{form…}` bodies). */
const BLAZE_TEMPLATES: Template[] = [
  // ── Text Editing (Rewrite pack) ──────────────────────────────────────────
  {
    id: "blaze-rewrite-general",
    name: "Rewrite text (length + tone)",
    category: "Text Editing",
    description:
      "Make any text shorter, longer, or more engaging — you pick the tone.",
    body:
      "Rewrite the following to make it {formmenu: default=shorter; longer; more engaging; simpler}.{clipboard}\n\nThe length should be {formtext: name=length; default=about the same}. The tone should be: {formmenu: default=Professional; Friendly; Humorous; Conversational; Neutral; Foreboding; multiple=yes}.",
  },
  {
    id: "blaze-rewrite-email",
    name: "Rewrite email",
    category: "Text Editing",
    description: "Tidy up an email so it lands exactly the way you want.",
    body:
      "Rewrite the following email to make it {formmenu: default=more professional; more concise; friendlier; more persuasive}. Keep the tone {formmenu: default=Professional; Friendly; Neutral; Formal; multiple=yes}.\n\n{clipboard}",
  },
  {
    id: "blaze-paraphrase",
    name: "Paraphrase",
    category: "Text Editing",
    description: "Say the same thing in fresh words, same meaning and length.",
    body:
      "Paraphrase the following text in a {formmenu: default=Neutral; Formal; Casual; Academic} tone, keeping the original meaning and roughly the same length:\n\n{clipboard}",
  },
  {
    id: "blaze-humanize",
    name: "Humanize text",
    category: "Text Editing",
    description: "Make AI-sounding text feel natural and human.",
    body:
      "Rewrite the following AI-generated text so it sounds natural and human, at a {formmenu: default=Neutral; Casual; Professional} tone. Avoid clichés and filler, and vary sentence length:\n\n{clipboard}",
  },
  {
    id: "blaze-expand",
    name: "Expand text",
    category: "Text Editing",
    description: "Grow a short note into a fuller, more detailed version.",
    body:
      "Expand the following into a more detailed version, adding {formtext: name=what to add; default=examples and explanations}. Keep the original meaning:\n\n{clipboard}",
  },

  // ── Writing (best-practice / PTCF universal template) ─────────────────────
  {
    id: "blaze-ptcf",
    name: "Universal prompt (Persona · Task · Context · Format)",
    category: "Writing",
    description:
      "A fill-in-the-blanks recipe for a great prompt: who, what, why, how.",
    body:
      "Persona: Act as {formtext: name=persona; default=an expert assistant}.\nTask: {formparagraph: name=task}.\nContext: {formparagraph: name=context}.\nFormat: Respond as {formmenu: default=a concise summary; a bulleted list; a step-by-step guide; a table; an essay}.\n{formtoggle: name=Include an example; default=yes}Include at least one concrete example.{endformtoggle}",
  },

  // ── Business & Marketing ─────────────────────────────────────────────────
  {
    id: "blaze-marketing-email",
    name: "Marketing email",
    category: "Business & Marketing",
    description: "Announce a product to your audience with a clear call to action.",
    body:
      "Write a marketing email announcing {formtext: name=product}. Target audience: {formtext: name=audience}. Call to action: {formtext: name=cta; default=Sign up today}. Tone: {formmenu: default=Persuasive; Friendly; Urgent; Professional}.",
  },
  {
    id: "blaze-social-post",
    name: "Social media post",
    category: "Business & Marketing",
    description: "Draft a post for LinkedIn, X, Instagram, or Facebook.",
    body:
      "Write a {formmenu: default=LinkedIn; Twitter/X; Instagram; Facebook} post about {formtext: name=topic}. Tone: {formmenu: default=Professional; Casual; Inspirational}. {formtoggle: name=Add hashtags; default=yes}End with 3–5 relevant hashtags.{endformtoggle}",
  },
  {
    id: "blaze-product-description",
    name: "Product description",
    category: "Business & Marketing",
    description: "Show off a product's best features in a few lines.",
    body:
      "Write a product description for {formtext: name=product}. Highlight these features: {formparagraph: name=features}. Length: {formmenu: default=short; medium; long}.",
  },

  // ── Recruiting & Career ──────────────────────────────────────────────────
  {
    id: "blaze-resume-bullet",
    name: "Rewrite resume bullet",
    category: "Recruiting & Career",
    description: "Turn a plain resume line into a results-driven one.",
    body:
      "Rewrite this resume bullet to be results-oriented and start with a strong action verb. Emphasize {formtext: name=focus; default=measurable impact}:\n\n{clipboard}",
  },
  {
    id: "blaze-cover-letter",
    name: "Cover letter",
    category: "Recruiting & Career",
    description: "A tailored cover letter for the exact role and company.",
    body:
      "Write a cover letter for the role of {formtext: name=role} at {formtext: name=company}. Highlight my experience in {formparagraph: name=experience}. Keep the tone {formmenu: default=Professional; Enthusiastic; Confident} and under {formtext: name=word limit; default=250} words.",
  },
  {
    id: "blaze-interview-questions",
    name: "Interview questions",
    category: "Recruiting & Career",
    description: "Ready-made questions for your next interview round.",
    body:
      "Generate {formtext: name=count; default=10} {formmenu: default=behavioral; technical; situational} interview questions for a {formtext: name=role} candidate.",
  },

  // ── Education ────────────────────────────────────────────────────────────
  {
    id: "blaze-explain-concept",
    name: "Explain a concept",
    category: "Education",
    description: "Break down any topic for exactly the level you choose.",
    body:
      "Explain {formtext: name=concept} to a {formmenu: default=beginner; high school student; undergraduate; expert}. Use {formmenu: default=simple analogies; formal definitions; real-world examples}. {formtoggle: name=Add a quiz; default=no}End with 3 quiz questions.{endformtoggle}",
  },
  {
    id: "blaze-lesson-plan",
    name: "Lesson plan",
    category: "Education",
    description: "A full lesson plan with goals, activities, and assessment.",
    body:
      "Create a lesson plan on {formtext: name=topic} for {formtext: name=grade level}. Duration: {formtext: name=duration; default=45 minutes}. Include objectives, activities, and assessment.",
  },
  {
    id: "blaze-study-notes",
    name: "Study notes from clipboard",
    category: "Education",
    description: "Turn copied text into tidy study notes or flashcards.",
    body:
      "Summarize the following into study notes as a {formmenu: default=bulleted list; outline; table; set of flashcards}:\n\n{clipboard}",
  },

  // ── Personal ─────────────────────────────────────────────────────────────
  {
    id: "blaze-email-reply",
    name: "Reply to a message",
    category: "Personal",
    description: "Write the reply for you — polite, firm, or friendly.",
    body:
      "Write a {formmenu: default=polite; friendly; firm; apologetic} reply to the following message. Keep it {formmenu: default=short; medium; detailed}:\n\n{clipboard}",
  },
  {
    id: "blaze-plan",
    name: "Make a plan",
    category: "Personal",
    description: "Turn any goal into a simple day-by-day plan.",
    body:
      "Create a {formtext: name=duration; default=7-day} plan to {formtext: name=goal}. Break it into daily steps. {formtoggle: name=Include reminders; default=no}Add a reminder tip for each day.{endformtoggle}",
  },

  // ── Code ─────────────────────────────────────────────────────────────────
  {
    id: "blaze-refactor",
    name: "Refactor code",
    category: "Code",
    description: "Clean up code for readability or speed — behavior unchanged.",
    body:
      "Refactor the following code to improve {formmenu: default=readability; performance; error handling; testability}. Keep behavior identical. Explain the changes {formmenu: default=briefly; in detail}:\n\n{clipboard}",
  },
];

/**
 * Full composer library: the legacy `{{selected_text}}` built-ins plus the
 * AI Blaze dynamic prompts. Both flow through the same fill-in dialog.
 */
export const PROMPT_LIBRARY: Template[] = [...BUILTIN_TEMPLATES, ...BLAZE_TEMPLATES];
