import { api } from './api'
import type { QuizConfig, TestAnswer } from '../types'

export interface AbandonTestInput {
  config: QuizConfig
  questions: { id: string }[]
  answers: Record<string, TestAnswer>
  timeLimitSeconds: number
  startedAt: number
}

/** Records an abandoned (exited mid-way) test in the DB without grading. Fire-and-forget safe. */
export async function abandonTest(input: AbandonTestInput): Promise<void> {
  const { config, questions, answers, timeLimitSeconds, startedAt } = input
  const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  const attempted = Object.values(answers).filter((a) => a.selected_answer).length

  const session = {
    category: config.category,
    group_type: config.group_type ?? null,
    subject: config.subject ?? null,
    standard: config.standard ?? null,
    ca_month: config.ca_month ?? null,
    ca_type: config.ca_type ?? null,
    aptitude_type: config.aptitude_type ?? null,
    aptitude_topic: config.aptitude_topic ?? null,
    total_questions: questions.length,
    attempted,
    time_limit_seconds: timeLimitSeconds,
    time_taken_seconds: timeTaken,
  }

  await api.abandonTest(session)
}
