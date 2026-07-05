import { api } from './api'
import type { TopicScore } from './analytics'
import type { TestSeriesAttempt, TestSeriesAnswerStat } from '../types'

// ─── Test Marathon analytics ────────────────────────────────────────────────
// Aggregates the user's Test Marathon attempts (score history) and every graded
// answer into weak-area breakdowns by subject and by question-type, so the
// Analytics tab can say WHAT to revise and the papers list can nudge WHERE to
// focus before the next attempt.

// Below this accuracy an area counts as "weak" (worth revising).
export const WEAK_THRESHOLD = 60
// Ignore areas the user has barely touched, so one stray question can't dominate.
const MIN_SAMPLE = 3

export interface TestSeriesOverview {
  attemptsCount: number
  papersAttempted: number
  avgScore: number
  bestScore: number
  lastScore: number | null
}

export interface TestSeriesAnalytics {
  attempts: TestSeriesAttempt[] // newest first
  bySubject: TopicScore[] // weakest first
  byType: TopicScore[] // weakest first
  weakSubjects: TopicScore[] // below threshold, enough sample, weakest first
  weakTypes: TopicScore[]
  overview: TestSeriesOverview
  loaded: boolean
}

const EMPTY: TestSeriesAnalytics = {
  attempts: [],
  bySubject: [],
  byType: [],
  weakSubjects: [],
  weakTypes: [],
  overview: { attemptsCount: 0, papersAttempted: 0, avgScore: 0, bestScore: 0, lastScore: null },
  loaded: true,
}

/** Roll answers up by a key (subject / qtype) into accuracy scores, weakest first. */
function aggregate(answers: TestSeriesAnswerStat[], keyOf: (a: TestSeriesAnswerStat) => string): TopicScore[] {
  const map = new Map<string, TopicScore>()
  for (const a of answers) {
    const key = keyOf(a)
    if (!key) continue
    const row = map.get(key) ?? { key, total: 0, correct: 0, attempted: 0, accuracy: 0 }
    row.total += 1
    row.attempted += 1 // graded answers are attempted by definition
    if (a.is_correct === true) row.correct += 1
    map.set(key, row)
  }
  const out = [...map.values()]
  out.forEach((r) => (r.accuracy = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0))
  return out.sort((a, b) => a.accuracy - b.accuracy)
}

/** Weak = enough sample AND below the pass threshold; weakest first (input order). */
const weakOf = (scores: TopicScore[]): TopicScore[] =>
  scores.filter((s) => s.attempted >= MIN_SAMPLE && s.accuracy < WEAK_THRESHOLD)

export async function fetchTestSeriesAnalytics(): Promise<TestSeriesAnalytics> {
  const { attempts, answers } = await api.testSeriesAnalytics()
  if (!attempts || attempts.length === 0) return EMPTY

  const bySubject = aggregate(answers ?? [], (a) => a.subject || 'General')
  const byType = aggregate(answers ?? [], (a) => a.qtype)

  const scores = attempts.map((a) => a.score || 0)
  const overview: TestSeriesOverview = {
    attemptsCount: attempts.length,
    papersAttempted: new Set(attempts.map((a) => a.test_id)).size,
    avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / attempts.length),
    bestScore: Math.max(...scores),
    // attempts come newest-first, so [0] is the latest.
    lastScore: attempts[0]?.score ?? null,
  }

  return {
    attempts,
    bySubject,
    byType,
    weakSubjects: weakOf(bySubject),
    weakTypes: weakOf(byType),
    overview,
    loaded: true,
  }
}

/** Where in the app to go and revise a weak subject. */
export function practiceRouteForSubject(subject: string): string {
  return subject === 'Aptitude' || subject === 'Reasoning'
    ? '/test-arena/aptitude'
    : '/test-arena/subjects'
}

// ─── Study plan (actionable advice) ─────────────────────────────────────────
// One structured item per recommendation; the view renders it as bilingual prose
// (+ an optional action) so it never has to build sentences in the lib.
export type Advice =
  | { kind: 'trend'; dir: 'up' | 'down' | 'flat'; delta: number; last: number }
  | { kind: 'focus'; subject: string; accuracy: number; route: string }
  | { kind: 'type'; typeKey: string; accuracy: number }
  | { kind: 'strength'; subject: string; accuracy: number }

const TREND_DELTA = 8 // ± points that counts as a real move, not noise

/**
 * Turn the aggregates into a short, prioritised study plan: how the trend is
 * going, the 1–2 subjects to revise (with where), the weakest question-type to
 * drill, and one strength to keep warm.
 */
export function buildStudyPlan(a: TestSeriesAnalytics): Advice[] {
  const out: Advice[] = []

  if (a.attempts.length >= 2) {
    const chron = [...a.attempts].reverse()
    const delta = (chron[chron.length - 1].score || 0) - (chron[0].score || 0)
    out.push({
      kind: 'trend',
      dir: delta >= TREND_DELTA ? 'up' : delta <= -TREND_DELTA ? 'down' : 'flat',
      delta: Math.abs(delta),
      last: a.overview.lastScore ?? 0,
    })
  }

  a.weakSubjects.slice(0, 2).forEach((s) =>
    out.push({ kind: 'focus', subject: s.key, accuracy: s.accuracy, route: practiceRouteForSubject(s.key) })
  )

  if (a.weakTypes[0]) out.push({ kind: 'type', typeKey: a.weakTypes[0].key, accuracy: a.weakTypes[0].accuracy })

  const strong = [...a.bySubject].filter((s) => s.attempted >= 3).sort((x, y) => y.accuracy - x.accuracy)[0]
  if (strong && strong.accuracy >= 70) out.push({ kind: 'strength', subject: strong.key, accuracy: strong.accuracy })

  return out
}
