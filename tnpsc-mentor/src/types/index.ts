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
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  target_group?: string
  role?: UserRole
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
