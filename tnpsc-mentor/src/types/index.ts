// ─── Core domain types ──────────────────────────────────────────────────────

export type Category = 'pyq' | 'samacheer' | 'current_affairs' | 'aptitude' | 'outer' | 'subject'
// The five question styles testable in the Subject Practice flow.
export type SubjectQType = 'chronological' | 'match' | 'assertion_reason' | 'statements' | 'direct'
export type GroupType = 'Group1' | 'Group2_2A' | 'Group4_VAO'
export type AnswerLetter = 'A' | 'B' | 'C' | 'D'
export type Difficulty = 'easy' | 'medium' | 'hard'
// Role hierarchy: superadmin ⊃ admin ⊃ user. A superadmin inherits every admin
// ability (the DB `is_admin()` check is widened to include it) and additionally
// owns the platform console (metrics, user management, feedback inbox).
export type UserRole = 'user' | 'admin' | 'superadmin'

export interface Question {
  id: string
  category: Category
  group_type?: GroupType
  year?: number
  standard?: number
  ca_month?: string
  ca_year?: number
  ca_type?: 'topic_wise' | 'month_wise'
  ca_topic?: string
  aptitude_type?: 'numerics' | 'reasoning'
  aptitude_topic?: string
  subject?: string
  // Broad unit/section grouping above topic. Used by the "Outer" subject banks
  // (e.g. unit 'Polity', topic 'Fundamental Rights').
  unit?: string
  topic?: string
  // Subject Practice style tag (chronological / match / assertion_reason / …).
  question_type?: string
  // Short provenance marker (e.g. 'TU') - rendered as a small badge when set.
  source_tag?: string | null
  question_text: string
  // Ordered public URLs of figures that belong to the question stem (diagrams
  // for dice/seating/figure-counting items). Hosted in the Supabase Storage
  // `question-images` bucket; rendered with the question, never gated.
  images?: string[] | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // Answer/explanation columns are NOT delivered to the client during a quiz
  // (they're stripped server-side). They're only populated for the admin bank
  // and merged in after a result is graded - hence optional.
  correct_answer?: AnswerLetter
  explanation?: string
  // Per-option rationale: for each WRONG option letter, why it is incorrect.
  // Powers the targeted "your answer is wrong because…" feedback.
  why_wrong?: Partial<Record<AnswerLetter, string>> | null
  // Tamil counterpart of why_wrong (per wrong option), when available.
  why_wrong_ta?: Partial<Record<AnswerLetter, string>> | null
  difficulty?: Difficulty
  // Provenance of a scraped/imported question (admin-only; never shown to users).
  source_url?: string | null
  // Optional Tamil content (bilingual-ready). When present and the user's
  // language is Tamil/both, the UI renders these instead of/alongside English.
  question_text_ta?: string | null
  option_a_ta?: string | null
  option_b_ta?: string | null
  option_c_ta?: string | null
  option_d_ta?: string | null
  explanation_ta?: string | null
}

export interface TestSession {
  id: string
  user_id: string
  category: string
  group_type?: string
  subject?: string
  standard?: number
  ca_month?: string
  ca_type?: string
  aptitude_type?: string
  aptitude_topic?: string
  total_questions: number
  attempted: number
  correct: number
  score_percentage: number
  pdf_unlocked: boolean
  passed_80_percent: boolean
  time_limit_seconds: number
  time_taken_seconds?: number
  started_at: string
  completed_at?: string
  status: 'in_progress' | 'completed' | 'abandoned'
}

export interface TestAnswer {
  question_id: string
  selected_answer: AnswerLetter
  // Unknown until the server grades the submission (the client has no answer key).
  is_correct?: boolean
  time_spent_seconds: number
  flagged?: boolean
}

// Per-question result returned by the `submit_test` RPC. correct_answer /
// explanation fields are only present when the attendance gate (>=25%) unlocked
// them. NOTE: the `passed_80*` field names are historical - the gate is 25%.
export interface GradedResult {
  question_id: string
  selected_answer: AnswerLetter | null
  is_correct: boolean
  correct_answer?: AnswerLetter | null
  explanation?: string | null
  explanation_ta?: string | null
  why_wrong?: Partial<Record<AnswerLetter, string>> | null
}

// Shape of the whole `submit_test` RPC response.
export interface SubmitResult {
  session_id: string
  total: number
  attempted: number
  correct: number
  score_percentage: number
  passed_80: boolean
  unlocked: boolean
  results: GradedResult[]
}

export interface QuizConfig {
  category: Category
  group_type?: string
  subject?: string
  standard?: number
  topic?: string
  /**
   * Broad unit/section filter (the `questions.unit` column). Used by the PYQ
   * History selector to scope a test to one period - 'ancient' | 'medieval' |
   * 'modern' (the 214 History PYQs are tagged this way).
   */
  unit?: string
  /** Subject Practice: restrict to one question style (omit for "Mixed"). */
  question_type?: SubjectQType
  /** Difficulty filter (easy/medium/hard) - used by subject/topic mock tests. */
  difficulty?: Difficulty
  ca_month?: string
  ca_type?: string
  ca_topic?: string
  aptitude_type?: string
  aptitude_topic?: string
  /** Human-friendly label shown in the quiz header & result page. */
  label?: string
  /** Mock-test mode: mixed questions, fixed duration, optional negative marking. */
  mock?: boolean
  mockQuestionCount?: number
  mockDurationSeconds?: number
  /** Practice quiz: user-chosen number of questions (caps the random pool). */
  questionCount?: number
  /** Practice quiz: user-chosen time limit in seconds (overrides the per-question default). */
  durationSeconds?: number
  /** Negative mark per wrong answer (e.g. 0.33 for -1/3). 0 = none. */
  negativeMark?: number
  /** For mock mode: restrict the random pool to `category` (e.g. daily CA). */
  scopeToCategory?: boolean
  /** Daily Current-Affairs challenge - completing it grants the daily reward. */
  daily?: boolean
  /** Weekly Current-Affairs consolidation drill. */
  weekly?: boolean
  /**
   * Proctored mock-test mode. When set, the quiz runs through the dedicated
   * OMR-style engine (fullscreen, question palette, violation tracking) instead
   * of the regular timed quiz. `mockKind` distinguishes a full group-pattern
   * exam from a single subject/topic drill.
   */
  proctored?: boolean
  mockKind?: 'group' | 'subject'
  /** Which TNPSC group blueprint a group mock follows (2024/2025 pattern). */
  mockGroup?: GroupType
}

// ─── Mock-test blueprint (group-exam patterns) ──────────────────────────────

/** One subject slot in a group-exam blueprint (label + how many questions). */
export interface MockSlot {
  label: string
  count: number
}

/** A full group-exam template following the TNPSC 2024/2025 pattern. */
export interface MockBlueprint {
  id: GroupType
  title: string
  totalQuestions: number
  durationMinutes: number
  negativeMark: number
  slots: MockSlot[]
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  target_group?: string
  role?: UserRole
  exam_date?: string | null
  daily_goal?: number | null
  /** Preferred UI language. Account-bound so it follows the user across devices
   * and is set ONCE at onboarding; changeable later from the Profile page. */
  language?: DisplayLang | null
}

// ─── Result payload passed via router state to /result ──────────────────────

export interface ResultPayload {
  config: QuizConfig
  questions: Question[]
  answers: Record<string, TestAnswer>
  totalQuestions: number
  attempted: number
  correct: number
  scorePercentage: number
  pdfUnlocked: boolean
  passed80: boolean
  timeLimitSeconds: number
  timeTakenSeconds: number
  sessionId?: string
}

// Letter helpers for mapping option index <-> letter
export const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

export function optionText(q: Question, letter: AnswerLetter): string {
  switch (letter) {
    case 'A':
      return q.option_a
    case 'B':
      return q.option_b
    case 'C':
      return q.option_c
    case 'D':
      return q.option_d
  }
}

function optionTextTa(q: Question, letter: AnswerLetter): string | null | undefined {
  switch (letter) {
    case 'A':
      return q.option_a_ta
    case 'B':
      return q.option_b_ta
    case 'C':
      return q.option_c_ta
    case 'D':
      return q.option_d_ta
  }
}

export type DisplayLang = 'en' | 'ta' | 'both'

/**
 * Returns the question text to render for the given UI language. Falls back to
 * English when Tamil content isn't available. For 'both' it stacks EN + TA.
 */
export function displayQuestion(q: Question, lang: DisplayLang): string {
  const ta = q.question_text_ta?.trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${q.question_text}\n${ta}`
  return q.question_text
}

// ─── Match (List I / List II) parsing ───────────────────────────────────────
// "Match the following" questions store both lists inline in question_text as
// newline-separated lines, e.g.
//   <preamble>
//   List I (Extremity)
//   (a) Eastern extremity        ← subject style: (a)-(d)
//   ...
//   List II (Place)
//   1. Hills of Anaimalai        ← 1.-4.
//   ...
//   Select the correct match.    ← optional trailing prompt
// (current-affairs style uses "List I:" with A.-D. labels.) Rendering this as a
// single pre-wrapped blob stacks the two lists vertically; parsing it lets the
// UI lay List I and List II out side-by-side like the printed exam paper.

export interface MatchItem {
  /** Raw label token, e.g. 'a' or 'A' or '1'. */
  label: string
  text: string
}
export interface MatchList {
  /** Full header line as authored, e.g. 'List I (Extremity)'. */
  header: string
  items: MatchItem[]
}
export interface ParsedMatch {
  preamble: string
  listI: MatchList
  listII: MatchList
  /** Trailing prompt after List II, e.g. 'Select the correct match.'. */
  trailing: string
}

// An item line: optional "(", a short label, a closing ")" or ".", then the
// item text. The label tells us which list it belongs to - letters → List I,
// numbers → List II. Roman numerals (i, ii, iii, iv…) are allowed up to 4 chars
// so List I items labelled (i)-(iv) aren't truncated.
const MATCH_ITEM = /^\(?\s*([ivxlcdm]{1,4}|[IVXLCDM]{1,4}|[A-Za-z]{1,2}|\d{1,2}|[அ-ஔ])\s*[).]\s*(.+)$/

// A single line that pairs a List I item with a List II item side-by-side,
// separated by a pipe or a run of spaces, e.g. "(a) Corn    1. Cotyledon" or
// "A. s subshell | 1. 6". Captures: I-label, I-text, II-label, II-text.
const MATCH_COMBINED =
  /^\(?\s*([A-Za-z]{1,4}|[அ-ஔ])\s*[).]\s+(.+?)\s*(?:\||\s{2,})\s*\(?\s*(\d{1,2})\s*[).]\s+(.+?)\s*$/

/** A line that is a prompt/instruction ("Match the following…"), not a header. */
const isMatchPrompt = (s: string): boolean =>
  /\b(match|following|select|correct|codes|given below|use:|பொருத்த|தேர்ந்தெடு)\b/i.test(s)

interface ClassifiedLine {
  label: string
  text: string
  kind: 'alpha' | 'num'
}
function classifyMatchLine(line: string): ClassifiedLine | null {
  const m = line.match(MATCH_ITEM)
  if (!m) return null
  const label = m[1]
  return { label, text: m[2].trim(), kind: /^\d+$/.test(label) ? 'num' : 'alpha' }
}

/**
 * Parse the side-by-side layout where each line carries one List I item and its
 * List II counterpart (split by a pipe or 2+ spaces). Returns null when fewer
 * than two such rows are present or the List II labels aren't distinct.
 */
function parseCombinedMatch(lines: string[]): ParsedMatch | null {
  const rowIdx: number[] = []
  const listI: MatchItem[] = []
  const listII: MatchItem[] = []
  for (let idx = 0; idx < lines.length; idx++) {
    const m = lines[idx].match(MATCH_COMBINED)
    if (!m) continue
    rowIdx.push(idx)
    listI.push({ label: m[1], text: m[2].trim() })
    listII.push({ label: m[3], text: m[4].trim() })
  }
  if (listI.length < 2) return null
  // List II labels must be distinct - guards against matching stray punctuation.
  const nums = listII.map((i) => i.label)
  if (new Set(nums).size !== nums.length) return null

  const first = rowIdx[0]
  const last = rowIdx[rowIdx.length - 1]
  // A header is the line directly above the first row, when it isn't a row or a
  // prompt sentence. Split it into the two column headers.
  let headerLine = -1
  if (first > 0 && !lines[first - 1].match(MATCH_COMBINED) && !isMatchPrompt(lines[first - 1])) {
    headerLine = first - 1
  }
  let hI = '',
    hII = ''
  if (headerLine >= 0) {
    const parts = lines[headerLine].split(/\s*\|\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean)
    hI = parts[0] ?? lines[headerLine]
    hII = parts[1] ?? ''
  }
  const preEnd = headerLine >= 0 ? headerLine : first
  return {
    preamble: lines.slice(0, preEnd).join(' ').trim(),
    listI: { header: hI, items: listI },
    listII: { header: hII, items: listII },
    trailing: lines.slice(last + 1).join(' ').trim(),
  }
}

/**
 * Parse a "Match the following" question body into its two lists. List I is the
 * first run of letter-labelled items ((a)-(d) or A-D); List II is the following
 * run of number-labelled items (1-4). Each list's header is the plain line just
 * above it - works for "List I/List II", "Schedule/Subject", "Extremity/Place",
 * etc. Returns null when the text isn't a recognisable two-list match (callers
 * then fall back to plain text). Operates on a single language's raw text - for
 * bilingual display, call once per language string.
 */
export function parseMatchQuestion(text: string | null | undefined): ParsedMatch | null {
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  // First try the side-by-side single-line layout (List I + List II on one row).
  const combined = parseCombinedMatch(lines)
  if (combined) return combined
  if (lines.length < 5) return null
  const cls = lines.map(classifyMatchLine)

  // List I = first contiguous run of letter-labelled items.
  const i1 = cls.findIndex((c) => c?.kind === 'alpha')
  if (i1 < 0) return null
  let i1end = i1
  while (i1end + 1 < cls.length && cls[i1end + 1]?.kind === 'alpha') i1end++

  // List II = first contiguous run of number-labelled items after List I.
  let i2 = -1
  for (let k = i1end + 1; k < cls.length; k++) {
    if (cls[k]?.kind === 'num') {
      i2 = k
      break
    }
  }
  if (i2 < 0) return null
  let i2end = i2
  while (i2end + 1 < cls.length && cls[i2end + 1]?.kind === 'num') i2end++

  const toItems = (start: number, end: number): MatchItem[] =>
    cls.slice(start, end + 1).map((c) => ({ label: c!.label, text: c!.text }))
  const listIItems = toItems(i1, i1end)
  const listIIItems = toItems(i2, i2end)
  if (listIItems.length < 2 || listIIItems.length < 2) return null

  // A list's header is the short plain line immediately above its first item
  // (e.g. 'List I', 'Schedule'). A full prompt sentence ('Match the following…')
  // is the preamble, not a header.
  const headerAbove = (start: number): number =>
    start > 0 && !cls[start - 1] && !isMatchPrompt(lines[start - 1]) ? start - 1 : -1
  const hI = headerAbove(i1)
  const hII = headerAbove(i2)

  return {
    preamble: lines.slice(0, hI >= 0 ? hI : i1).join(' ').trim(),
    listI: { header: hI >= 0 ? lines[hI] : '', items: listIItems },
    listII: { header: hII >= 0 ? lines[hII] : '', items: listIIItems },
    trailing: lines.slice(i2end + 1).join(' ').trim(),
  }
}

/** Format a parsed match label for display: letters as "(a)", numbers as "1.". */
export function formatMatchLabel(label: string): string {
  return /^\d+$/.test(label) ? `${label}.` : `(${label})`
}

/** Same fallback logic for an individual option. */
export function displayOption(q: Question, letter: AnswerLetter, lang: DisplayLang): string {
  const en = optionText(q, letter)
  const ta = optionTextTa(q, letter)?.toString().trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${en} / ${ta}`
  return en
}

/** Explanation with the same fallback. */
export function displayExplanation(q: Question, lang: DisplayLang): string {
  const en = q.explanation ?? ''
  const ta = q.explanation_ta?.trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${en}\n${ta}`
  return en
}

/** Why a specific (wrong) option is incorrect, if we have it. */
export function whyWrongFor(q: Question, letter: AnswerLetter): string {
  const reason = q.why_wrong?.[letter]
  return reason ? reason.trim() : ''
}
