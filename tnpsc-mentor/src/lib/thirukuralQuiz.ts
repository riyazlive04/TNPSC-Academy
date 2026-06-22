// ─── Thirukkural quiz data layer ────────────────────────────────────────────
// A self-contained, client-side practice bank for the Thirukkural quiz section.
// Unlike the main question banks (Supabase-backed, server-graded), these 288
// bilingual questions ship with their answers inline and are graded locally —
// they're reference-style practice, not a proctored test. The data is bundled
// (lazy chunk) from src/data/thirukkuralQuestions.json, generated from
// Thirukural/Thirukkural_Question_Bank_v2.json.

import raw from '../data/thirukkuralQuestions.json'
import type { AnswerLetter, DisplayLang, Question, QuizConfig } from '../types'

export type TkFormat =
  | 'meaning_choice'
  | 'fill_in_the_blank'
  | 'quote_identification'
  | 'multi_verse_synthesis'
  | 'match_the_following'

export type TkLetter = 'A' | 'B' | 'C' | 'D'
export const TK_LETTERS: TkLetter[] = ['A', 'B', 'C', 'D']

/** A piece of text in both languages. Match-option strings store the same value
 *  in `en` and `ta` (the mapping like "4 1 2 3" is language-neutral). */
export interface TkBilingual {
  en: string
  ta: string
}

export interface TkQuestion {
  id: string
  format: TkFormat
  difficulty: 'easy' | 'medium' | 'hard'
  /** The chapter (adhigaram) the verse belongs to. null for match items, which
   *  span several chapters. */
  adhigaram_en: string | null
  adhigaram_ta: string | null
  adhigaram_no: number | null
  /** The paal (section) the chapter sits under — null for match items. */
  paal_en: string | null
  paal_ta: string | null
  /** The kural number this question is built on (null for match items). */
  kural_no: number | null
  stem: TkBilingual
  answer: TkLetter
  /** Single-couplet formats (meaning / fill / quote). */
  couplet?: TkBilingual
  /** Two-verse synthesis: the pair of couplets being compared. */
  couplets?: TkBilingual[]
  /** Match: the lettered couplets (a–d). */
  left?: Record<string, TkBilingual>
  /** Match: the numbered chapters (1–4). */
  right?: Record<string, TkBilingual>
  options: Record<TkLetter, TkBilingual>
}

export const TK_QUESTIONS = raw as TkQuestion[]

/** Display order + label key for the question-type filter. */
export const TK_FORMATS: { format: TkFormat; labelKey: string }[] = [
  { format: 'meaning_choice', labelKey: 'tkFmtMeaning' },
  { format: 'fill_in_the_blank', labelKey: 'tkFmtFill' },
  { format: 'quote_identification', labelKey: 'tkFmtQuote' },
  { format: 'multi_verse_synthesis', labelKey: 'tkFmtSynthesis' },
  { format: 'match_the_following', labelKey: 'tkFmtMatch' },
]

export interface TkChapter {
  no: number
  en: string
  ta: string
}

/** A chapter row for the adhigaram picker — name, paal, question count, and the
 *  span of kural numbers it covers (e.g. 71–80). */
export interface TkAdhigaram {
  no: number
  en: string
  ta: string
  paal_en: string | null
  paal_ta: string | null
  /** Total questions across all formats in this chapter. */
  count: number
  /** Distinct kurals the questions are drawn from. */
  kuralCount: number
  /** [min, max] kural number, or null if unknown. */
  range: [number, number] | null
}

/** All adhigarams that have questions, sorted by adhigaram number — the data for
 *  the first (chapter) branch of the quiz. */
export function adhigaramList(): TkAdhigaram[] {
  const byNo = new Map<number, TkQuestion[]>()
  for (const q of TK_QUESTIONS) {
    if (q.adhigaram_no == null || q.adhigaram_en == null) continue
    const arr = byNo.get(q.adhigaram_no) ?? []
    arr.push(q)
    byNo.set(q.adhigaram_no, arr)
  }
  const out: TkAdhigaram[] = []
  for (const [no, qs] of byNo) {
    const kurals = qs.map((q) => q.kural_no).filter((k): k is number => k != null)
    out.push({
      no,
      en: qs[0].adhigaram_en as string,
      ta: qs[0].adhigaram_ta ?? (qs[0].adhigaram_en as string),
      paal_en: qs[0].paal_en,
      paal_ta: qs[0].paal_ta,
      count: qs.length,
      kuralCount: new Set(kurals).size,
      range: kurals.length ? [Math.min(...kurals), Math.max(...kurals)] : null,
    })
  }
  return out.sort((a, b) => a.no - b.no)
}

/** The question types present for a chapter (or across all), with their counts —
 *  the data for the second (question-type) branch. */
export function formatsFor(chapterNo: number | 'all'): { format: TkFormat; count: number }[] {
  return TK_FORMATS.map(({ format }) => ({
    format,
    count: filterQuestions(format, chapterNo).length,
  })).filter((f) => f.count > 0)
}

/**
 * The distinct chapters present among questions matching `format` (or all
 * formats), sorted by adhigaram number. Match questions carry no single chapter,
 * so they contribute none — they're only reachable via "All chapters".
 */
export function chaptersFor(format: TkFormat | 'all'): TkChapter[] {
  const byNo = new Map<number, TkChapter>()
  for (const q of TK_QUESTIONS) {
    if (format !== 'all' && q.format !== format) continue
    if (q.adhigaram_no == null || q.adhigaram_en == null) continue
    if (!byNo.has(q.adhigaram_no)) {
      byNo.set(q.adhigaram_no, {
        no: q.adhigaram_no,
        en: q.adhigaram_en,
        ta: q.adhigaram_ta ?? q.adhigaram_en,
      })
    }
  }
  return [...byNo.values()].sort((a, b) => a.no - b.no)
}

/** Pool matching the chosen format + chapter (either may be the "all" wildcard). */
export function filterQuestions(
  format: TkFormat | 'all',
  chapterNo: number | 'all'
): TkQuestion[] {
  return TK_QUESTIONS.filter(
    (q) =>
      (format === 'all' || q.format === format) &&
      (chapterNo === 'all' || q.adhigaram_no === chapterNo)
  )
}

/** A Fisher–Yates shuffle of up to `count` questions from the pool. */
export function sampleQuestions(pool: TkQuestion[], count: number): TkQuestion[] {
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.min(count, arr.length))
}

/** Render a bilingual value for the current language, stacking EN over TA in
 *  'both' mode (one per line). Falls back to English when Tamil is missing. */
export function tkText(b: TkBilingual | undefined, lang: DisplayLang): string {
  if (!b) return ''
  if (lang === 'ta') return b.ta || b.en
  if (lang === 'both' && b.ta && b.ta !== b.en) return `${b.en}\n${b.ta}`
  return b.en
}

/** Inline bilingual (EN / TA) — used for short option text. */
export function tkInline(b: TkBilingual | undefined, lang: DisplayLang): string {
  if (!b) return ''
  if (lang === 'ta') return b.ta || b.en
  if (lang === 'both' && b.ta && b.ta !== b.en) return `${b.en} / ${b.ta}`
  return b.en
}

// ─── Bridge into the shared quiz pipeline ───────────────────────────────────
// The Thirukkural quiz reuses the app's real screens (instructions → quiz →
// result). To do that we map each TkQuestion into the standard `Question` shape
// the rest of the app renders and grades. Match questions are serialised into
// the "List I / List II" text format that QuestionStem parses into side-by-side
// lists, so they render exactly like the subject-bank match questions.

/**
 * Render a couplet as its two metrical lines. Tamil stores them separated by a
 * "/"; English concatenates them with sentence punctuation immediately followed
 * by a capital (no space). Either way we break it into two lines and drop the
 * slash, so it reads as the printed couplet (≈4 words / ≈3 words).
 */
function coupletToLines(text: string): string {
  if (text.includes('/')) {
    return text
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n')
  }
  // Break once at the first "<punct><Capital>" boundary (the line join).
  return text.replace(/([.,;:?!])(?=[A-Z])/, '$1\n')
}

/** Single-line couplet (slash removed) — for the compact match list items. */
function coupletInline(text: string): string {
  return text.replace(/\s*\/\s*/g, ' ').trim()
}

/** Build the question stem + couplet(s) for one language. */
function stemText(q: TkQuestion, lang: 'en' | 'ta'): string {
  const pick = (b: TkBilingual) => (lang === 'ta' ? b.ta || b.en : b.en)
  const lines: string[] = [pick(q.stem)]
  if (q.format === 'match_the_following' && q.left && q.right) {
    lines.push('', 'List I')
    for (const [k, v] of Object.entries(q.left)) lines.push(`(${k}) ${coupletInline(pick(v))}`)
    lines.push('List II')
    for (const [k, v] of Object.entries(q.right)) lines.push(`${k}. ${pick(v)}`)
  } else if (q.couplet) {
    lines.push('', coupletToLines(pick(q.couplet)))
  } else if (q.couplets) {
    q.couplets.forEach((c, i) => lines.push('', `(${i + 1})`, coupletToLines(pick(c))))
  }
  return lines.join('\n')
}

/** Readable option text. For match, expand the "4 1 2 3" mapping to "a-4, b-1…". */
function optionText(q: TkQuestion, letter: TkLetter, lang: 'en' | 'ta'): string {
  const opt = q.options[letter]
  if (q.format === 'match_the_following' && q.left) {
    const keys = Object.keys(q.left)
    const nums = opt.en.trim().split(/\s+/)
    return keys.map((k, i) => `${k}-${nums[i] ?? '?'}`).join(', ')
  }
  return lang === 'ta' ? opt.ta || opt.en : opt.en
}

/** Map a single Thirukkural question into the app-wide `Question` shape. */
function toQuestion(q: TkQuestion): Question {
  return {
    id: q.id,
    category: 'thirukural',
    question_type: q.format === 'match_the_following' ? 'match' : undefined,
    difficulty: q.difficulty,
    topic: q.adhigaram_en ?? undefined,
    question_text: stemText(q, 'en'),
    question_text_ta: stemText(q, 'ta'),
    option_a: optionText(q, 'A', 'en'),
    option_b: optionText(q, 'B', 'en'),
    option_c: optionText(q, 'C', 'en'),
    option_d: optionText(q, 'D', 'en'),
    option_a_ta: optionText(q, 'A', 'ta'),
    option_b_ta: optionText(q, 'B', 'ta'),
    option_c_ta: optionText(q, 'C', 'ta'),
    option_d_ta: optionText(q, 'D', 'ta'),
    correct_answer: q.answer as AnswerLetter,
  }
}

/** Whether a quiz config targets the client-side Thirukkural bank. */
export function isThirukuralConfig(config: QuizConfig): boolean {
  return config.category === 'thirukural'
}

/**
 * The randomised question list for a Thirukkural quiz config — the client-side
 * equivalent of fetchQuestionsForConfig's server call. Filters by the chosen
 * chapter (tkAdhigaram) and format (tkFormat), shuffles, and caps at `limit`.
 */
export function buildThirukuralQuestions(config: QuizConfig, limit: number): Question[] {
  const pool = filterQuestions(
    (config.tkFormat as TkFormat | undefined) ?? 'all',
    config.tkAdhigaram ?? 'all'
  )
  return sampleQuestions(pool, limit).map(toQuestion)
}
