// ─── Core domain types ──────────────────────────────────────────────────────

import type { StringKey } from '../lib/i18n'

/**
 * A language-neutral piece of a test heading. Producers emit these instead of a
 * baked string so describeConfig() can resolve them against the CURRENT language
 * at render time - the heading then follows the EN/தமிழ்/both toggle live,
 * instead of freezing whichever language was active when the test was set up.
 */
export type QuizLabelSeg =
  | string // literal, language-neutral (e.g. "PYQ", a month name)
  | { t: StringKey } // a translation key
  | { subject: string } // subject name, resolved via subjectName(lang)
  | { topic: string } // topic name, resolved via topicName(lang)

/** A single Thirukkural couplet with all renderings + classical commentaries. */
export interface Kural {
  kural_no: number
  paal_no: number
  paal_ta: string
  paal_en: string
  iyal_no: number
  iyal_ta: string
  iyal_en: string
  adhigaram_no: number
  adhigaram_ta: string
  adhigaram_en: string
  adhigaram_translit: string
  line1_ta: string
  line2_ta: string
  transliteration: string
  couplet_en: string
  translation_en: string
  explanation_en: string
  urai_mu_varadarajan: string
  urai_solomon_pappaiya: string
  urai_mu_karunanidhi: string
}

export type Category =
  | 'pyq'
  | 'samacheer'
  | 'current_affairs'
  | 'aptitude'
  | 'outer'
  | 'subject'
  // Thirukkural quiz - a client-side bank (questions bundled with the app and
  // graded in the browser); it never touches the server question pipeline.
  | 'thirukural'
// The five question styles testable in the Subject Practice flow.
export type SubjectQType = 'chronological' | 'match' | 'assertion_reason' | 'statements' | 'direct'
export type GroupType = 'Group1' | 'Group2_2A' | 'Group4_VAO'
// Most banks are 4-option (A-D). A few imported sets (e.g. the IndiaBix analogy
// reasoning bank) carry a 5th option E - `option_e` is null on every 4-option
// row, and optionLetters() only surfaces E when that row actually has it.
export type AnswerLetter = 'A' | 'B' | 'C' | 'D' | 'E'
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
  // numerics/reasoning are the practice-bank types; data_interpretation +
  // general_studies come from the GOV (TNPSC Group I Mains) bank.
  aptitude_type?: 'numerics' | 'reasoning' | 'data_interpretation' | 'general_studies'
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
  // Whether the question is shown to students. false = hidden from quizzes/
  // revision but still visible in the admin bank. Only populated on admin reads.
  active?: boolean
  question_text: string
  // Ordered public URLs of figures that belong to the question stem (diagrams
  // for dice/seating/figure-counting items). Hosted in the Supabase Storage
  // `question-images` bucket; rendered with the question, never gated.
  images?: string[] | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // Optional 5th option - present only on 5-option imports (analogy reasoning
  // bank). Null/absent on every standard 4-option question.
  option_e?: string | null
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
  option_e_ta?: string | null
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
  /** Set by the API's topic-revision hook (see server/routes/tests.ts). */
  revision?: RevisionInfo
}

// ─── Topic revision (study-gate + similar-question re-tests) ────────────────

export type RevisionStatus = 'locked' | 'available' | 'cleared'

/** The summary the submit response carries so the Result page can react. */
export interface RevisionInfo {
  /** A low-scoring topic test was saved (or re-saved) to Revisions. */
  enqueued?: boolean
  /** A passing re-attempt cleared an existing revision. */
  cleared?: boolean
  status?: RevisionStatus
  /** ISO instant the re-test unlocks (awake-hours aware). */
  available_at?: string
  label?: string
}

/** One saved topic revision (list_revision_topics row + derived status). */
export interface RevisionTopic {
  id: string
  topic_key: string
  config: QuizConfig
  label: string | null
  first_score: number
  last_score: number
  best_score: number
  attempts: number
  available_at: string
  cleared_at: string | null
  last_session_id: string | null
  created_at: string
  status: RevisionStatus
}

export interface RevisionSubjectStat {
  subject: string
  count: number
  avg_score: number
}

export interface RevisionFocusItem {
  id: string
  label: string | null
  last_score: number
  best_score: number
  attempts: number
  status: RevisionStatus
}

/** Pure-logic aggregates for the revision dashboard (revision_analytics RPC). */
export interface RevisionAnalytics {
  total: number
  cleared: number
  pending: number
  available_now: number
  locked: number
  total_attempts: number
  avg_last_score: number
  avg_best_score: number
  improvement: number
  by_subject: RevisionSubjectStat[]
  focus: RevisionFocusItem[]
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
  /**
   * Free-form heading, used when the label has no structured equivalent (mock
   * blueprint titles, daily/weekly drills, "Outer Questions"). For flows built
   * from subject/topic/type, prefer `labelParts` so the heading stays reactive
   * to the language toggle.
   */
  label?: string
  /**
   * Language-neutral heading segments (joined with " · "), resolved against the
   * current language by describeConfig(). Takes precedence over `label`.
   */
  labelParts?: QuizLabelSeg[]
  /** Mock-test mode: mixed questions, fixed duration, optional negative marking. */
  mock?: boolean
  mockQuestionCount?: number
  mockDurationSeconds?: number
  /** Practice quiz: user-chosen number of questions (caps the random pool). */
  questionCount?: number
  /**
   * Size of the available question pool for this config, when the originating
   * picker page already knows it (e.g. the PYQ/Subject counts shown on its
   * cards). Lets the pre-test setup screen render the slider bound instantly
   * instead of flashing a "counting…" state while it re-fetches.
   */
  availableCount?: number
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
  /** Set when this quiz is a revision re-test (gates similar-question fetch). */
  revision?: boolean
  /** The revision_topics row id, threaded back through submit so a pass clears it. */
  revisionId?: string
  /** Thirukkural quiz: the chosen adhigaram number (omitted = all chapters). */
  tkAdhigaram?: number
  /** Thirukkural quiz: the chosen question format (omitted = mixed). */
  tkFormat?: string
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
  gender?: string
  target_group?: string
  role?: UserRole
  exam_date?: string | null
  daily_goal?: number | null
  /** Preferred UI language. Account-bound so it follows the user across devices
   * and is set ONCE at onboarding; changeable later from the Profile page. */
  language?: DisplayLang | null
  /** Profile picture URL - set from Google on Google sign-in; null otherwise. */
  avatar_url?: string | null
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
  /** Topic-revision outcome of this test, surfaced as a notice on the Result page. */
  revision?: RevisionInfo
}

// The four options every bank has. Use optionLetters(q) when rendering so a
// 5th option (E) is included only for the questions that actually carry one.
export const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

/**
 * The answer letters to render for a specific question: always A-D, plus E when
 * the question has non-empty `option_e`. This keeps standard 4-option questions
 * from showing a blank fifth choice while letting 5-option items render in full.
 */
export function optionLetters(q: Question): AnswerLetter[] {
  return q.option_e != null && String(q.option_e).trim() !== '' ? [...LETTERS, 'E'] : LETTERS
}

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
    case 'E':
      return q.option_e ?? ''
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
    case 'E':
      return q.option_e_ta
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
// separated by a pipe, a run of spaces, or a dash, e.g. "(a) Corn    1. Cotyledon",
// "A. s subshell | 1. 6", or "A. Karikala - 1. Pandya" (the subject bank's combined
// layout). Captures: I-label, I-text, II-label, II-text. The required "<digit>)." /
// "<digit>." after the separator keeps a bare dash from splitting hyphenated item
// text (e.g. "Heart-lung machine"), since that dash isn't followed by a number label.
const MATCH_COMBINED =
  /^\(?\s*([A-Za-z]{1,4}|[அ-ஔ])\s*[).]\s+(.+?)\s*(?:\||\s{2,}|[---])\s*\(?\s*(\d{1,2})\s*[).]\s+(.+?)\s*$/

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
    const parts = lines[headerLine]
      .split(/\s*\|\s*|\s{2,}|\s+[---]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
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
/**
 * Strip a leading correctness marker ("Correct." / "சரி.") that prefixes many
 * stored explanations - it's redundant since the option is already shown as the
 * answer, and reads awkwardly under the "Explanation:" label.
 */
function stripCorrectPrefix(text: string): string {
  return text.replace(/^\s*(correct|சரி)\s*[.:\---]\s*/i, '')
}

export function displayExplanation(q: Question, lang: DisplayLang): string {
  const en = stripCorrectPrefix(q.explanation ?? '')
  const ta = stripCorrectPrefix(q.explanation_ta?.trim() ?? '')
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${en}\n${ta}`
  return en
}

/** Why a specific (wrong) option is incorrect, if we have it. */
export function whyWrongFor(q: Question, letter: AnswerLetter): string {
  const reason = q.why_wrong?.[letter]
  return reason ? reason.trim() : ''
}
