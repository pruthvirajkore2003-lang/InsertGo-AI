/**
 * Context-aware skill ranking for the selection bar (SPEC §4.1 extension —
 * the "smart floating toolbar" work). Two pure, framework-free functions:
 *
 *  - `detectContext` classifies a selection into a coarse ContextKind using
 *    cheap local heuristics (no AI call, no network) — regex + character-class
 *    ratios only, so it is instant and adds no cost/latency to showing the bar.
 *  - `rankSkills` reorders the vendored skills so the ones most useful for that
 *    context surface first, blended with a small personal-frequency bonus so
 *    the bar gradually adapts to how one user works without ever overriding a
 *    strong context signal.
 *
 * Pure and dependency-free (no React / Tauri) so it stays unit-testable and
 * can run in either webview context. SECURITY: fixed-alternation linear regexes
 * only (no nested quantifiers → ReDoS-safe), and the selection text is only
 * ever read, never interpreted as a pattern.
 */
import type { Skill } from "@/services/skills";

/** Coarse selection categories the bar ranks against. */
export type ContextKind = "email" | "code" | "foreign" | "question" | "markdown" | "data" | "generic";

/**
 * Per-context preferred skill order (most relevant first). Ids must match the
 * vendored `src/skills/*.md` slugs. A skill absent from a list still appears in
 * the bar — it just sorts after the affinity picks (see `rankSkills`).
 */
const AFFINITY: Record<ContextKind, string[]> = {
  email: [
    "reply-to-this",
    "reply-with-instructions",
    "improve-this",
    "fix-mistakes",
    "summarize-this",
  ],
  code: [
    "answer-this-question",
    "learn-more",
    "simplify-this",
    "fix-mistakes",
    "summarize-this",
  ],
  foreign: ["translate-this", "summarize-this", "learn-more", "answer-this-question"],
  question: ["answer-this-question", "learn-more", "reply-to-this", "summarize-this"],
  markdown: [
    "improve-this",
    "fix-mistakes",
    "simplify-this",
    "summarize-this",
    "expand-this",
  ],
  data: [
    "summarize-this",
    "simplify-this",
    "learn-more",
    "answer-this-question",
  ],
  generic: ["summarize-this", "improve-this", "reply-to-this", "learn-more"],
};

/** Non-Latin letter scripts — any hit means the text wants translation. Covers
 *  CJK ideographs, Hiragana/Katakana, Hangul, Cyrillic, Greek, Arabic, Hebrew.
 *  Latin-with-accents is intentionally NOT here: it is indistinguishable from
 *  English prose with names/loanwords without a real language model. */
const NON_LATIN_RE =
  /[぀-ヿ㐀-䶿一-鿿가-힯Ѐ-ӿͰ-Ͽ֐-׿؀-ۿ]/;

/** Interrogatives that, as the FIRST word, mark a question even without a `?`. */
const QUESTION_LEAD_RE =
  /^(who|what|why|how|when|where|which|whose|whom|is|are|am|do|does|did|can|could|would|should|will|shall|may|might|has|have|had)\b/i;

/** Code keywords across a few common languages. Word-boundary anchored. */
const CODE_KEYWORD_RE =
  /\b(function|const|let|var|def|class|import|export|return|public|private|static|void|async|await|for|while|if|else|elif|switch|struct|enum|interface|package|namespace|fn|impl|println|printf|console\.log|System\.out)\b/;

/** Email salutation at the very start ("Hi John," / "Dear team," / "Hey,"). */
const SALUTATION_RE = /^(hi|hello|hey|dear|greetings|good (morning|afternoon|evening))\b/i;

/** Email sign-off phrases. */
const SIGNOFF_RE =
  /\b(regards|best regards|kind regards|sincerely|cheers|thanks(,| in advance| so much)?|thank you|best,|yours truly|sent from my)\b/i;

const EMAIL_ADDRESS_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Markdown heading, bold, or list marker at line start. */
const MARKDOWN_RE =
  /^(?:#{1,6}\s|\*\*|\- |\* |\d+\.\s|>\s|```)/m;

/** JSON-like or CSV-like structured data patterns. */
const DATA_RE =
  /^\s*[{\[]|"[^"]+"\s*:|^[^,\n]+(?:,[^,\n]+){2,}$/m;

/** Ratio of code-punctuation to total chars above which text reads as code. */
function symbolDensity(text: string): number {
  const symbols = text.match(/[{}()[\];=<>|&/*+]/g);
  return symbols ? symbols.length / text.length : 0;
}

/**
 * Classify a selection. Order matters: the most specific / highest-confidence
 * signals are tested first so a polite email that happens to end in a question
 * still reads as `email` (→ reply), and any non-Latin script wins outright
 * (→ translate). Everything unclassified falls through to `generic`.
 */
export function detectContext(text: string): ContextKind {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "generic";

  // 1. Non-Latin script → translation is almost always the intent.
  if (NON_LATIN_RE.test(trimmed)) return "foreign";

  // 2. Code: needs two independent signals so prose with a stray brace or an
  //    "if"/"for" sentence doesn't misfire. Signals: a code keyword, dense
  //    code punctuation, or a line that looks indented+braced.
  let codeSignals = 0;
  if (CODE_KEYWORD_RE.test(trimmed)) codeSignals++;
  if (symbolDensity(trimmed) > 0.06) codeSignals++;
  if (/[;{}]\s*$/m.test(trimmed) || /^\s{2,}\S/m.test(trimmed)) codeSignals++;
  if (codeSignals >= 2) return "code";

  // 3. Email: a salutation or explicit address, paired with a sign-off — the
  //    two-signal rule keeps a bare "Hi there" or a lone address out.
  const hasOpen = SALUTATION_RE.test(trimmed) || EMAIL_ADDRESS_RE.test(trimmed);
  if (hasOpen && SIGNOFF_RE.test(trimmed)) return "email";

  // 4. Question: an explicit `?` terminator, or an interrogative lead-in on a
  //    reasonably short selection (a long essay that opens with "How" is prose).
  if (trimmed.endsWith("?")) return "question";
  if (QUESTION_LEAD_RE.test(trimmed) && trimmed.length <= 200) return "question";

  // 5. Structured data: JSON, CSV, or similar tabular/nested formats.
  if (DATA_RE.test(trimmed)) return "data";

  // 6. Markdown: headings, bold, lists, blockquotes, or fenced code markers
  //    appearing alongside prose (code was ruled out above by the two-signal gate).
  if (MARKDOWN_RE.test(trimmed)) return "markdown";

  return "generic";
}

/**
 * Rank the vendored skills for a context. Each skill scores on two axes:
 *
 *  - affinity: its position in the context's preferred list (earlier = higher),
 *    scaled to dominate — a strong context match always beats frequency alone.
 *  - frequency: how often the user has run this skill (capped so a single
 *    heavily-used skill can't permanently bury a strong context match).
 *
 * Stable: skills with equal scores keep their original `SKILLS` (repo) order,
 * so with no context signal and no usage history the bar looks exactly as
 * before. Returns a new array; never mutates the input.
 */
export function rankSkills(
  skills: Skill[],
  context: ContextKind,
  usage: Record<string, number> = {}
): Skill[] {
  const pref = AFFINITY[context];
  const score = (skill: Skill): number => {
    const idx = pref.indexOf(skill.id);
    const affinity = idx === -1 ? 0 : (pref.length - idx) * 100;
    const freq = Math.min(usage[skill.id] ?? 0, 20);
    return affinity + freq;
  };
  // Decorate-sort-undecorate keeps the sort stable regardless of the engine's
  // Array.sort stability guarantees (index is the final tie-breaker).
  return skills
    .map((skill, index) => ({ skill, index, s: score(skill) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((d) => d.skill);
}
