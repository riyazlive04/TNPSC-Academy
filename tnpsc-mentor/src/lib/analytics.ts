import { supabase } from './supabase'
import type { Question, TestAnswer } from '../types'

// ─── Per-test (post-result) analysis ────────────────────────────────────────

export interface TopicScore {
  key: string // subject or topic label
  total: number
  correct: number
  attempted: number
  accuracy: number // 0-100 over attempted
}

/**
 * Compute per-topic (falling back to subject) scores for a single finished
 * test, straight from the in-memory questions + answers. Used on the Result
 * page to recommend focus areas immediately — no DB round-trip.
 */
export function scoreByTopic(
  questions: Question[],
  answers: Record<string, TestAnswer>
): TopicScore[] {
  const map = new Map<string, TopicScore>()
  for (const q of questions) {
    const key = q.topic || q.subject || q.aptitude_topic || q.ca_topic || 'General'
    const a = answers[q.id]
    const row = map.get(key) ?? { key, total: 0, correct: 0, attempted: 0, accuracy: 0 }
    row.total += 1
    if (a?.selected_answer) {
      row.attempted += 1
      if (a.is_correct) row.correct += 1
    }
    map.set(key, row)
  }
  const out = [...map.values()]
  out.forEach((r) => (r.accuracy = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0))
  return out.sort((a, b) => a.accuracy - b.accuracy)
}

/** Weak areas = attempted topics below the threshold, weakest first. */
export function weakAreas(scores: TopicScore[], threshold = 60): TopicScore[] {
  return scores.filter((s) => s.attempted >= 1 && s.accuracy < threshold)
}

// ─── Cumulative analytics (across all of a user's tests) ────────────────────

export interface SessionRow {
  id: string
  category: string
  subject: string | null
  score_percentage: number
  total_questions: number
  correct: number
  attempted: number
  completed_at: string | null
  time_taken_seconds: number | null
}

export interface Overview {
  testsTaken: number
  totalQuestions: number
  totalCorrect: number
  avgAccuracy: number
  avgScore: number
  bestScore: number
  totalTimeMinutes: number
}

export interface UserAnalytics {
  overview: Overview
  bySubject: TopicScore[]
  byTopic: TopicScore[]
  trend: { date: string; accuracy: number; label: string }[]
  loaded: boolean
}

const EMPTY: UserAnalytics = {
  overview: {
    testsTaken: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    avgAccuracy: 0,
    avgScore: 0,
    bestScore: 0,
    totalTimeMinutes: 0,
  },
  bySubject: [],
  byTopic: [],
  trend: [],
  loaded: true,
}

/**
 * Pull the user's completed sessions + their answers (with each question's
 * subject/topic embedded) and aggregate into subject/topic accuracy + trend.
 * All read via RLS-guarded queries with the user's own session.
 */
export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  // 1) Completed sessions.
  const { data: sessions, error: sErr } = await supabase
    .from('test_sessions')
    .select(
      'id,category,subject,score_percentage,total_questions,correct,attempted,completed_at,time_taken_seconds'
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })

  if (sErr || !sessions || sessions.length === 0) return EMPTY

  const rows = sessions as SessionRow[]
  const sessionIds = rows.map((r) => r.id)

  // 2) Answers for those sessions, with question subject/topic embedded.
  const { data: answers } = await supabase
    .from('test_answers')
    .select('is_correct,question:questions(subject,topic,category,aptitude_topic,ca_topic)')
    .in('session_id', sessionIds)

  // Aggregate subject + topic accuracy from answers.
  const subjMap = new Map<string, TopicScore>()
  const topicMap = new Map<string, TopicScore>()
  type EmbeddedAnswer = {
    is_correct: boolean | null
    question: {
      subject?: string | null
      topic?: string | null
      category?: string | null
      aptitude_topic?: string | null
      ca_topic?: string | null
    } | null
  }
  for (const a of (answers ?? []) as EmbeddedAnswer[]) {
    const q = a.question
    if (!q) continue
    const subj = q.subject || q.aptitude_topic || q.ca_topic || q.category || 'General'
    const topic = q.topic || q.aptitude_topic || q.ca_topic || subj
    bump(subjMap, subj, a.is_correct === true)
    bump(topicMap, topic, a.is_correct === true)
  }

  const bySubject = finalize(subjMap)
  const byTopic = finalize(topicMap)

  // Overview.
  const testsTaken = rows.length
  const totalQuestions = rows.reduce((s, r) => s + (r.total_questions || 0), 0)
  const totalCorrect = rows.reduce((s, r) => s + (r.correct || 0), 0)
  const avgScore = Math.round(rows.reduce((s, r) => s + (r.score_percentage || 0), 0) / testsTaken)
  const bestScore = Math.max(...rows.map((r) => r.score_percentage || 0))
  const totalAttempted = rows.reduce((s, r) => s + (r.attempted || 0), 0)
  const avgAccuracy = totalAttempted ? Math.round((totalCorrect / totalAttempted) * 100) : 0
  const totalTimeMinutes = Math.round(
    rows.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / 60
  )

  // Trend (last 12 tests).
  const trend = rows.slice(-12).map((r, i) => ({
    date: r.completed_at ?? '',
    accuracy: Math.round(r.score_percentage || 0),
    label: r.subject || r.category || `Test ${i + 1}`,
  }))

  return {
    overview: {
      testsTaken,
      totalQuestions,
      totalCorrect,
      avgAccuracy,
      avgScore,
      bestScore,
      totalTimeMinutes,
    },
    bySubject,
    byTopic,
    trend,
    loaded: true,
  }
}

function bump(map: Map<string, TopicScore>, key: string, correct: boolean) {
  const row = map.get(key) ?? { key, total: 0, correct: 0, attempted: 0, accuracy: 0 }
  row.total += 1
  row.attempted += 1
  if (correct) row.correct += 1
  map.set(key, row)
}

function finalize(map: Map<string, TopicScore>): TopicScore[] {
  const out = [...map.values()]
  out.forEach((r) => (r.accuracy = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0))
  return out.sort((a, b) => a.accuracy - b.accuracy)
}
