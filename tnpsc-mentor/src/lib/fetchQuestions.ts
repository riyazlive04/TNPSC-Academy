import { api } from './api'
import type { AnswerLetter, Question, QuizConfig } from '../types'

export const MAX_QUESTIONS = 100

/** Fisher–Yates shuffle (non-mutating). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Fetches questions for a quiz via the `get_quiz_questions` RPC. The RPC runs
 * SECURITY DEFINER and returns ONLY the safe columns (no correct_answer /
 * explanation) in random order, so answers never reach the browser during a
 * test. Random ordering also fixes the old "always the oldest N" sampling bug.
 */
export async function fetchQuestionsForConfig(
  config: QuizConfig
): Promise<Question[]> {
  const limit = config.mock
    ? (config.mockQuestionCount ?? 50)
    : Math.min(config.questionCount ?? MAX_QUESTIONS, MAX_QUESTIONS)
  return api.quizQuestions({ ...config, limit } as QuizConfig)
}

/**
 * Admin question bank fetch — full rows (answers + explanations) via the
 * `admin_list_questions` RPC, which is gated server-side by is_admin(). A
 * non-admin calling it simply gets an empty list.
 */
export async function fetchAdminQuestions(config: QuizConfig): Promise<Question[]> {
  return api.adminListQuestions(config)
}

/**
 * Payload for the admin question editor. A blank/absent `id` creates a new
 * question; a present `id` updates that row. The five content fields and a
 * `correct_answer` are always required.
 */
export type QuestionDraft = Partial<Question> & {
  id?: string
  category: Question['category']
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: AnswerLetter
}

/**
 * Create or update a question via the `admin_upsert_question` RPC (SECURITY
 * DEFINER, is_admin() gated server-side). Returns the saved row, including the
 * answer columns, so the caller can refresh its local list.
 */
export async function upsertAdminQuestion(draft: QuestionDraft): Promise<Question> {
  return api.adminUpsertQuestion(draft as Record<string, unknown>)
}

/** Delete a question via the is_admin()-gated `admin_delete_question` RPC. */
export async function deleteAdminQuestion(id: string): Promise<void> {
  await api.adminDeleteQuestion(id)
}

/** Build a readable label from a config when none was supplied. */
export function describeConfig(config: QuizConfig): string {
  if (config.label) return config.label
  const parts: string[] = [config.category.toUpperCase()]
  if (config.group_type) parts.push(config.group_type)
  if (config.subject) parts.push(config.subject)
  if (config.standard != null) parts.push(`${config.standard}th`)
  if (config.topic) parts.push(config.topic)
  if (config.ca_month) parts.push(config.ca_month)
  if (config.ca_topic) parts.push(config.ca_topic)
  if (config.aptitude_type) parts.push(config.aptitude_type)
  if (config.aptitude_topic) parts.push(config.aptitude_topic)
  return parts.join(' · ')
}
