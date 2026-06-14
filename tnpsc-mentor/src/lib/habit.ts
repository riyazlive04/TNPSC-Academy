import { api } from './api'

// ─── Habit layer: streaks, daily goal, exam countdown ───────────────────────

export interface HabitState {
  currentStreak: number
  longestStreak: number
  questionsToday: number
  dailyGoal: number
  goalMetToday: boolean
  examDate: string | null
  daysToExam: number | null
  last30: { date: string; questions: number }[]
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()
  return Math.round(ms / 86400000)
}

/** Record today's activity (called after a quiz). Upserts + increments. */
export async function recordActivity(userId: string, questions: number, tests = 1) {
  if (!userId) return
  try {
    // The server reads-modifies-writes today's row (RLS: own rows).
    await api.recordActivity(questions, tests)
  } catch {
    /* non-fatal — table may not exist until migration is run */
  }
}

/** Compute the current consecutive-day streak ending today or yesterday. */
function computeStreak(dates: Set<string>): number {
  let streak = 0
  const cursor = new Date()
  // Allow today to be missing (streak continues from yesterday until today ends).
  if (!dates.has(isoDate(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(isoDate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function longestRun(sortedDates: string[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0 || daysBetween(sortedDates[i - 1], sortedDates[i]) === 1) run += 1
    else run = 1
    best = Math.max(best, run)
  }
  return best
}

/** Fetch the user's habit state (streak, today's progress, exam countdown). */
export async function fetchHabit(
  userId: string,
  dailyGoal = 20,
  examDate: string | null = null
): Promise<HabitState> {
  const empty: HabitState = {
    currentStreak: 0,
    longestStreak: 0,
    questionsToday: 0,
    dailyGoal,
    goalMetToday: false,
    examDate,
    daysToExam: examDate ? daysBetween(isoDate(new Date()), examDate) : null,
    last30: [],
  }
  try {
    const rows = await api.activityRows(60)
    if (!rows) return empty

    const dateSet = new Set(rows.map((r) => r.activity_date))
    const sorted = [...dateSet].sort()
    const today = isoDate(new Date())
    const questionsToday = rows.find((r) => r.activity_date === today)?.questions ?? 0

    return {
      currentStreak: computeStreak(dateSet),
      longestStreak: longestRun(sorted),
      questionsToday,
      dailyGoal,
      goalMetToday: questionsToday >= dailyGoal,
      examDate,
      daysToExam: examDate ? daysBetween(today, examDate) : null,
      last30: rows.slice(-30).map((r) => ({ date: r.activity_date, questions: r.questions })),
    }
  } catch {
    return empty
  }
}

/** Save onboarding/setup fields to the profile. */
export async function saveGoals(
  _userId: string,
  fields: { exam_date?: string | null; daily_goal?: number; target_group?: string }
) {
  try {
    await api.updateProfile(fields)
  } catch {
    /* non-fatal */
  }
}

/** Percentile vs all aspirants (via SECURITY DEFINER RPC). */
export async function fetchPercentile(_userId: string): Promise<number | null> {
  try {
    return await api.percentile()
  } catch {
    return null
  }
}
