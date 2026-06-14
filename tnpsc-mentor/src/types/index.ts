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
  // Short provenance marker (e.g. 'TU') — rendered as a small badge when set.
  source_tag?: string | null
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // Answer/explanation columns are NOT delivered to the client during a quiz
  // (they're stripped server-side). They're only populated for the admin bank
  // and merged in after a result is graded — hence optional.
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
// explanation fields are only present when the 80% gate unlocked them.
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
  /** Subject Practice: restrict to one question style (omit for "Mixed"). */
  question_type?: SubjectQType
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
  /** Negative mark per wrong answer (e.g. 0.33 for -1/3). 0 = none. */
  negativeMark?: number
  /** For mock mode: restrict the random pool to `category` (e.g. daily CA). */
  scopeToCategory?: boolean
  /** Daily Current-Affairs challenge — completing it grants the daily reward. */
  daily?: boolean
  /** Weekly Current-Affairs consolidation drill. */
  weekly?: boolean
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
