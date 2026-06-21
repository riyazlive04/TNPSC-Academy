import { api } from './api'
import type { AnswerLetter, Question } from '../types'

// Spaced-repetition (SM-2-lite). Wrong/flagged questions are enqueued and
// resurface on a growing interval as the user gets them right. Enqueueing,
// grading and rescheduling all happen server-side (see secure.sql) so the
// answer key is never shipped to the browser - this module is the thin client.

export interface ReviewItem {
  id: string
  question_id: string
  due_at: string
  interval_days: number
  reps: number
  last_result: 'correct' | 'wrong' | null
  question: Question | null
}

/** Add wrong/flagged question ids to the user's review deck (no schedule reset). */
export async function enqueueReviewItems(userId: string, questionIds: string[]) {
  if (!userId || questionIds.length === 0) return
  try {
    await api.enqueueReviews(questionIds)
  } catch {
    /* non-fatal - table may not exist until ALTERs are run */
  }
}

// Flat row shape returned by the get_due_reviews RPC (review meta + safe
// question columns, NO answer key).
interface DueRow {
  item_id: string
  reps: number
  interval_days: number
  due_at: string
  last_result: 'correct' | 'wrong' | null
  id: string
  category: Question['category']
  group_type?: Question['group_type']
  year?: number
  standard?: number
  ca_month?: string
  ca_year?: number
  ca_type?: Question['ca_type']
  ca_topic?: string
  aptitude_type?: Question['aptitude_type']
  aptitude_topic?: string
  subject?: string
  topic?: string
  question_type?: Question['question_type']
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string | null
  difficulty?: Question['difficulty']
  question_text_ta?: string | null
  option_a_ta?: string | null
  option_b_ta?: string | null
  option_c_ta?: string | null
  option_d_ta?: string | null
  option_e_ta?: string | null
}

/** Items due now (with their question - no answers), oldest-due first. */
export async function fetchDueItems(_userId: string, limit = 30): Promise<ReviewItem[]> {
  try {
    const data = await api.dueReviews(limit)
    if (!data) return []
    return (data as DueRow[]).map((r) => ({
      id: r.item_id,
      question_id: r.id,
      due_at: r.due_at,
      interval_days: r.interval_days,
      reps: r.reps,
      last_result: r.last_result,
      question: {
        id: r.id,
        category: r.category,
        group_type: r.group_type,
        year: r.year,
        standard: r.standard,
        ca_month: r.ca_month,
        ca_year: r.ca_year,
        ca_type: r.ca_type,
        ca_topic: r.ca_topic,
        aptitude_type: r.aptitude_type,
        aptitude_topic: r.aptitude_topic,
        subject: r.subject,
        topic: r.topic,
        // Needed so "Match the Following" questions render as the side-by-side
        // grid (QuestionStem keys off question_type === 'match') in revision too.
        question_type: r.question_type,
        question_text: r.question_text,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        option_e: r.option_e,
        difficulty: r.difficulty,
        question_text_ta: r.question_text_ta,
        option_a_ta: r.option_a_ta,
        option_b_ta: r.option_b_ta,
        option_c_ta: r.option_c_ta,
        option_d_ta: r.option_d_ta,
        option_e_ta: r.option_e_ta,
      },
    }))
  } catch {
    return []
  }
}

// Reveal payload returned after grading a review item.
export interface ReviewGrade {
  is_correct: boolean
  correct_answer: AnswerLetter | null
  explanation: string | null
  explanation_ta: string | null
}

/** Total due count (for the dashboard badge). */
export async function dueCount(_userId: string): Promise<number> {
  try {
    return await api.reviewCount()
  } catch {
    return 0
  }
}

/**
 * Grade a review item server-side (the client has no answer key) and return the
 * reveal payload. The RPC also reschedules the item on the SM-2-lite curve.
 */
export async function gradeReview(
  itemId: string,
  selected: AnswerLetter
): Promise<ReviewGrade | null> {
  try {
    const data = await api.gradeReview(itemId, selected)
    if (!data) return null
    return data as ReviewGrade
  } catch {
    return null
  }
}
