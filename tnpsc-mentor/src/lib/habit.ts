import { supabase } from './supabase'

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

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()
  return Math.round(ms / 86400000)
}

/** Record today's activity (called after a quiz). Upserts + increments. */
export async function recordActivity(userId: string, questions: number, tests = 1) {
  if (!userId) return
  const today = isoDate(new Date())
  try {
    // Read existing (RLS: own rows).
    const { data } = await supabase
      .from('daily_activity')
      .select('questions,tests')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle()
    const prevQ = (data?.questions as number) ?? 0
    const prevT = (data?.tests as number) ?? 0
    await supabase.from('daily_activity').upsert(
      {
        user_id: userId,
        activity_date: today,
        questions: prevQ + questions,
        tests: prevT + tests,
      },
      { onConflict: 'user_id,activity_date' }
    )
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

function longestRun(sortedDates: string[]): number {
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
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const { data, error } = await supabase
      .from('daily_activity')
      .select('activity_date,questions')
      .eq('user_id', userId)
      .gte('activity_date', isoDate(since))
      .order('activity_date', { ascending: true })
    if (error || !data) return empty

    const rows = data as { activity_date: string; questions: number }[]
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
  userId: string,
  fields: { exam_date?: string | null; daily_goal?: number; target_group?: string }
) {
  try {
    await supabase.from('profiles').update(fields).eq('id', userId)
  } catch {
    /* non-fatal */
  }
}

/** Percentile vs all aspirants (via SECURITY DEFINER RPC). */
export async function fetchPercentile(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('user_percentile', { p_user: userId })
    if (error || data == null) return null
    return Math.round(Number(data))
  } catch {
    return null
  }
}
