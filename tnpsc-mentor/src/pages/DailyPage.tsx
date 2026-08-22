import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Newspaper, Flame, Gift, Check, Target } from 'lucide-react'
import YellowBadge from '../components/UI/YellowBadge'
import ProgressBar from '../components/UI/ProgressBar'
import StreakCalendar from '../components/StreakCalendar'
import { useAuth } from '../hooks/useAuth'
import { fetchHabit, todayIso, type HabitState } from '../lib/habit'
import { SHOW_STREAK, SHOW_GOALS } from '../lib/features'
import { useProgressStore } from '../store/progressStore'
import { toast } from '../store/toastStore'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

export default function DailyPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useT()

  const [habit, setHabit] = useState<HabitState | null>(null)
  const lastDailyDate = useProgressStore((s) => s.lastDailyDate)
  const dailyRewardPoints = useProgressStore((s) => s.dailyRewardPoints)

  // The reward ledger stamps lastDailyDate in IST (progressStore uses
  // todayIso()) - compare on the same calendar or the claim state flips wrongly
  // between midnight IST and midnight UTC.
  const today = todayIso()
  const claimedToday = lastDailyDate === today

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null)
      .then((h) => !cancelled && setHabit(h))
      .catch(() => {
        // Streak/habit strip failed to load - it falls back to 0 safely; surface
        // the failure quietly instead of swallowing it.
        if (!cancelled) toast.error(t('couldNotLoad'))
      })
    return () => {
      cancelled = true
    }
    // `t` is intentionally excluded: useT() returns a new function identity on
    // every render, and it's only read inside the catch above. Including it
    // re-runs this effect (and thus the fetch + its setState) after every
    // render the fetch itself causes, which never settles - a live-locked
    // refetch loop that pegs the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.daily_goal, profile?.exam_date])

  const start = () => {
    const config: QuizConfig = {
      category: 'current_affairs',
      mock: true,
      scopeToCategory: true,
      daily: true,
      mockQuestionCount: 10,
      mockDurationSeconds: 10 * 60,
      label: t('daily'),
    }
    navigate('/quiz', { state: config })
  }

  return (
    <>
      <div className="mx-auto max-w-md px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('daily')}</YellowBadge>
        </div>

        {/* Reward + streak status strip */}
        <div className={SHOW_STREAK ? 'mb-5 grid grid-cols-2 gap-3' : 'mb-5'}>
          {SHOW_STREAK && (
            <div className="card flex items-center gap-3 p-3.5">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-streaksoft text-streak">
                <Flame size={18} />
              </span>
              <div className="min-w-0">
                <div className="font-heading text-xl font-semibold leading-none text-ink">
                  {habit?.currentStreak ?? 0}
                </div>
                <div className="tamil mt-1 truncate font-body text-2xs uppercase tracking-wide text-ink2">
                  {t('dayStreak')}
                </div>
              </div>
            </div>
          )}
          <div className="card flex items-center gap-3 p-3.5">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Gift size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-heading text-xl font-semibold leading-none text-ink">
                {dailyRewardPoints}
              </div>
              <div className="tamil mt-1 truncate font-body text-2xs uppercase tracking-wide text-ink2">
                {t('totalRewards')}
              </div>
            </div>
          </div>
        </div>

        {/* Last 7 days at a glance - agrees with the streak number by design. */}
        {SHOW_STREAK && habit && (
          <StreakCalendar
            last30={habit.last30}
            currentStreak={habit.currentStreak}
            bestStreak={habit.longestStreak}
            className="mb-5"
          />
        )}

        {/* Today's question goal - fills as tests are submitted. */}
        {SHOW_GOALS && habit && (
          <div className="card mb-5 flex items-center gap-3 p-3.5">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Target size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="tamil truncate font-body text-2xs uppercase tracking-wide text-ink2">
                  {habit.goalMetToday ? t('goalDone') : t('dailyGoal')}
                </span>
                <span className="font-heading text-sm font-semibold text-ink">
                  {habit.questionsToday}/{habit.dailyGoal}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar
                  percent={Math.min(100, (habit.questionsToday / Math.max(1, habit.dailyGoal)) * 100)}
                  height={6}
                />
              </div>
            </div>
          </div>
        )}

        <div className="card p-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-tint text-ink">
            <Newspaper size={26} />
          </div>
          <p className="tamil mb-1 font-heading text-xl font-semibold tracking-tight text-ink">
            {t('daily')}
          </p>
          <p className="tamil mb-5 font-body text-sm text-ink2">{t('dailyCta')}</p>

          {/* Today's reward state: claimed vs ready */}
          <div
            className={[
              'mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-heading text-xs font-semibold',
              claimedToday
                ? 'bg-mintsoft text-mint'
                : 'bg-brand-soft text-brand',
            ].join(' ')}
          >
            {claimedToday ? (
              <>
                <Check size={14} /> {t('claimedToday')}
              </>
            ) : (
              <>
                <Gift size={14} /> {t('rewardReady')}
              </>
            )}
          </div>

          <button onClick={start} className="btn-brand w-full px-6 py-3 text-sm">
            {t('startMock')}
          </button>
        </div>
      </div>
    </>
  )
}
