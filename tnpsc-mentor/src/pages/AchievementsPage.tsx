import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Lock, Check } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import StreakCalendar from '../components/StreakCalendar'
import { badgeIcon } from '../components/badgeIcons'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { fetchHabit, type HabitState } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type GameStats } from '../lib/achievements'
import { GROUP_SUBJECTS } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

export default function AchievementsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useT()
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      fetchUserAnalytics(user.id),
      fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null),
    ])
      .then(([a, h]) => {
        if (cancelled) return
        setAnalytics(a)
        setHabit(h)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user, profile?.daily_goal, profile?.exam_date])

  const group = (profile?.target_group as GroupType) || 'Group1'
  const totalSubjects = (GROUP_SUBJECTS[group] ?? []).length

  const o = analytics?.overview
  const stats: GameStats = {
    tests: o?.testsTaken ?? 0,
    questions: o?.totalQuestions ?? 0,
    correct: o?.totalCorrect ?? 0,
    bestScore: o?.bestScore ?? 0,
    avgAccuracy: o?.avgAccuracy ?? 0,
    minutes: o?.totalTimeMinutes ?? 0,
    longestStreak: habit?.longestStreak ?? 0,
    currentStreak: habit?.currentStreak ?? 0,
    subjects: analytics?.bySubject.length ?? 0,
    totalSubjects,
  }

  const xp = computeXp({
    totalCorrect: stats.correct,
    totalQuestions: stats.questions,
    testsTaken: stats.tests,
  })
  const lvl = levelInfo(xp)

  const badges = computeBadges(stats)
  const earned = badges.filter((b) => b.unlocked).length

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : (
          <>
            {/* Level hero */}
            <div className="card mb-5 p-5">
              <div className="flex items-center gap-4">
                <LevelRing level={lvl.level} pct={lvl.pct} />
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-lg font-semibold tracking-tight text-ink">
                    {t('level')} {lvl.level}
                  </div>
                  <div className="font-body text-sm text-ink2">
                    {lvl.title} · {earned}/{badges.length} {t('badgesEarned')}
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${lvl.pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 font-body text-[11px] text-ink2">
                      {lvl.into} / {lvl.span} {t('xp')} · {lvl.toNext} {t('toNextLevel')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak */}
            {habit && (
              <StreakCalendar
                last30={habit.last30}
                currentStreak={habit.currentStreak}
                className="mb-5"
              />
            )}

            {/* Badge grid */}
            <div className="grid grid-cols-2 gap-3">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="card relative flex flex-col items-center p-4 text-center"
                >
                  {b.unlocked && (
                    <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                      <Check size={12} />
                    </span>
                  )}
                  <span
                    className={[
                      'mb-2 grid h-12 w-12 place-items-center rounded-xl',
                      b.unlocked ? 'bg-brand-soft text-brand' : 'bg-tint text-ink2/40',
                    ].join(' ')}
                  >
                    {b.unlocked ? badgeIcon(b.iconKey, 20) : <Lock size={18} />}
                  </span>
                  <span className="font-heading text-sm font-semibold text-ink">{b.title}</span>
                  <span className="mt-0.5 font-body text-[11px] leading-snug text-ink2">
                    {b.desc}
                  </span>
                  {!b.unlocked && (
                    <div className="mt-2.5 w-full">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                      <div className="mt-1 font-heading text-[10px] font-medium text-ink2">
                        {Math.min(b.value, b.target)}/{b.target}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="tamil mt-6 text-center font-body text-sm text-ink2">
              {t('keepGoing')}
            </p>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function LevelRing({ level, pct, size = 56 }: { level: number; pct: number; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, pct) / 100)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9E9EC" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#18181B"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-heading text-base font-semibold text-ink">
        {level}
      </span>
    </div>
  )
}
