import { supabase } from './supabase'
import type { Question } from '../types'

// Spaced-repetition (SM-2-lite). Wrong/flagged questions are enqueued and
// resurface on a growing interval as the user gets them right.

const INTERVALS = [1, 3, 7, 16, 35, 75] // days by reps index

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
  const rows = questionIds.map((qid) => ({
    user_id: userId,
    question_id: qid,
    due_at: new Date().toISOString(),
    interval_days: 0,
    reps: 0,
  }))
  try {
    await supabase
      .from('review_items')
      .upsert(rows, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
  } catch {
    /* non-fatal — table may not exist until ALTERs are run */
  }
}

/** Items due now (with their question), oldest-due first. */
export async function fetchDueItems(userId: string, limit = 30): Promise<ReviewItem[]> {
  try {
    const { data, error } = await supabase
      .from('review_items')
      .select(
        'id,question_id,due_at,interval_days,reps,last_result,question:questions(*)'
      )
      .eq('user_id', userId)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit)
    if (error) return []
    return (data ?? []) as unknown as ReviewItem[]
  } catch {
    return []
  }
}

/** Total due count (for the dashboard badge). */
export async function dueCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('review_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('due_at', new Date().toISOString())
    return count ?? 0
  } catch {
    return 0
  }
}

/** Grade a review item and reschedule it. */
export async function gradeItem(item: ReviewItem, correct: boolean) {
  let reps = item.reps
  let intervalDays: number
  if (correct) {
    intervalDays = INTERVALS[Math.min(reps, INTERVALS.length - 1)]
    reps = reps + 1
  } else {
    reps = 0
    intervalDays = 0 // stays due (today) until answered correctly
  }
  const due = new Date()
  due.setDate(due.getDate() + intervalDays)
  try {
    await supabase
      .from('review_items')
      .update({
        reps,
        interval_days: intervalDays,
        last_result: correct ? 'correct' : 'wrong',
        due_at: due.toISOString(),
      })
      .eq('id', item.id)
  } catch {
    /* non-fatal */
  }
}
