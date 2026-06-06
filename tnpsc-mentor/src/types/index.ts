// ─── Core domain types ──────────────────────────────────────────────────────

export type Category = 'pyq' | 'samacheer' | 'current_affairs' | 'aptitude'
export type GroupType = 'Group1' | 'Group2_2A' | 'Group4_VAO'
export type AnswerLetter = 'A' | 'B' | 'C' | 'D'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type UserRole = 'user' | 'admin'

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
  topic?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: AnswerLetter
  explanation?: string
  difficulty?: Difficulty
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
  is_correct: boolean
  time_spent_seconds: number
  flagged?: boolean
}

export interface QuizConfig {
  category: Category
  group_type?: string
  subject?: string
  standard?: number
  topic?: string
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
