import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  Minus,
  Pencil,
  Plus,
  Target,
  X,
} from 'lucide-react'
import CircularProgress from '../UI/CircularProgress'
import ProgressBar from '../UI/ProgressBar'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { saveGoals, lastNDaysIso, type HabitState } from '../../lib/habit'
import { computeBadges, type GameStats } from '../../lib/achievements'
import type { LevelInfo } from '../../lib/game'
import { SHOW_GOALS, SHOW_STREAK, isHiddenBadge } from '../../lib/features'
import { toast } from '../../store/toastStore'
import { tapScaleSubtle } from '../../lib/motion'
import { useT } from '../../lib/i18n'

// ─── MomentumPanel ───────────────────────────────────────────────────────────
// The dashboard's gamification module: daily-goal ring, a 7-day activity strip,
// streak milestone, level/XP progression and habit chips - every metric is a
// door (practice / setup / profile / insights), not a static number. The goal
// is editable in place (preset pills + a stepper) and persists through the same
// saveGoals → fetchProfile path the Setup screen uses, so the page's habit
// fetch re-runs with the new goal automatically.

/** Streak milestones - aligned with the streak badges (3/7/30) then aspirational. */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365]

const GOAL_PRESETS = [10, 20, 30, 50]
const GOAL_MIN = 5
const GOAL_MAX = 100
const GOAL_STEP = 5

// Weekday names, Sunday-first (Date.getUTCDay order). Short forms label the
// week cells; full forms go to aria-labels and the tap toast.
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_EN_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி']
const DAYS_TA_SHORT = ['ஞா', 'தி', 'செ', 'பு', 'வி', 'வெ', 'ச']

const chipClass =
  'focus-ring press tamil inline-flex items-center gap-1.5 rounded-pill border border-line bg-card px-3.5 py-2 font-heading text-[12.5px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand-dark'

export default function MomentumPanel({
  habit,
  lvl,
  stats,
}: {
  habit: HabitState
  lvl: LevelInfo
  stats: GameStats
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const { t, lang } = useT()
  const reduce = useReducedMotion()

  // ── Inline goal editing - optimistic draft, debounced persist ─────────────
  // The draft drives all the maths immediately; the write settles 700ms after
  // the last tap so stepping doesn't spam the API. A pending value is flushed
  // on unmount so navigating away never drops an edit.
  const [editing, setEditing] = useState(false)
  const [goalDraft, setGoalDraft] = useState<number | null>(null)
  const pendingGoal = useRef<number | null>(null)
  const saveTimer = useRef<number | null>(null)

  const goal = goalDraft ?? Math.max(1, habit.dailyGoal)
  const met = habit.questionsToday >= goal
  const pct = Math.min(100, (habit.questionsToday / goal) * 100)
  const remaining = Math.max(0, goal - habit.questionsToday)

  const commitGoal = async (showToast: boolean) => {
    const value = pendingGoal.current
    if (value == null) return
    pendingGoal.current = null
    await saveGoals(user?.id ?? '', { daily_goal: value })
    await fetchProfile()
    if (showToast) toast.success(t('goalSaved'))
  }

  const applyGoal = (value: number) => {
    const clamped = Math.min(GOAL_MAX, Math.max(GOAL_MIN, value))
    setGoalDraft(clamped)
    pendingGoal.current = clamped
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => commitGoal(true), 700)
  }

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      void commitGoal(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Week strip data (IST days, same boundaries the streak uses) ───────────
  const qByDay = new Map(habit.last30.map((d) => [d.date, d.questions]))
  const week = lastNDaysIso(7).map((iso, i) => {
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
    return { iso, dow, q: qByDay.get(iso) ?? 0, isToday: i === 6 }
  })
  const dayNames = lang === 'ta' ? DAYS_TA : DAYS_EN
  const dayShort = lang === 'ta' ? DAYS_TA_SHORT : DAYS_EN_SHORT

  const nextMilestone = STREAK_MILESTONES.find((m) => m > habit.currentStreak)
  // Evening + no questions yet + a live streak = the one moment nudging helps.
  const streakAtRisk =
    SHOW_STREAK &&
    habit.currentStreak > 0 &&
    habit.questionsToday === 0 &&
    new Date().getHours() >= 17

  const badges = computeBadges(stats).filter((b) => !isHiddenBadge(b.id))
  const earned = badges.filter((b) => b.unlocked).length

  const showExamChip = SHOW_GOALS && habit.daysToExam != null && habit.daysToExam >= 0
  const showSetupChip = SHOW_GOALS && !habit.examDate

  return (
    <div className="mt-5 space-y-2.5">
      <section
        aria-label={t('dailyGoal')}
        className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-soft"
      >
        {/* ── Daily goal: ring + status; the row practices, the pencil edits ── */}
        {SHOW_GOALS && (
          <div className="flex items-stretch">
            <motion.button
              type="button"
              onClick={() => navigate('/test-arena/subjects')}
              whileTap={reduce ? undefined : tapScaleSubtle}
              className="focus-ring group flex min-w-0 flex-1 items-center gap-4 p-4 text-left"
            >
              <CircularProgress
                value={pct}
                size={72}
                stroke={7}
                progressClassName={met ? 'text-mint' : 'text-primary'}
              >
                {met ? (
                  <Check size={24} strokeWidth={3} className="animate-checkPop text-mint" />
                ) : (
                  <span className="font-display text-[13px] font-bold leading-none text-ink">
                    {habit.questionsToday}/{goal}
                  </span>
                )}
              </CircularProgress>
              <span className="min-w-0 flex-1">
                <span className="tamil block font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
                  {t('dailyGoal')}
                </span>
                <span
                  className={`tamil mt-1 block font-display text-[17px] font-bold leading-tight ${
                    met ? 'text-mint' : 'text-ink'
                  }`}
                >
                  {met ? t('goalDone') : `${remaining} ${t('questionsToGo')}`}
                </span>
                <span
                  className={`tamil mt-0.5 block font-body text-[12px] leading-snug ${
                    streakAtRisk ? 'font-medium text-accent' : 'text-muted'
                  }`}
                >
                  {met
                    ? t('comeBackTomorrow')
                    : streakAtRisk
                      ? t('streakAtRisk')
                      : `${habit.questionsToday}/${goal} ${t('questionsToday')}`}
                </span>
              </span>
              <span className="hidden flex-shrink-0 items-center gap-1 rounded-pill bg-brand-soft px-3.5 py-2 font-heading text-[12px] font-semibold text-brand-dark transition-all group-hover:gap-2 sm:inline-flex">
                {t('start')} <ChevronRight size={14} />
              </span>
              <ChevronRight
                size={18}
                className="flex-shrink-0 text-muted transition-transform group-hover:translate-x-0.5 sm:hidden"
              />
            </motion.button>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-label={t('adjustGoal')}
              aria-expanded={editing}
              aria-controls="goal-editor"
              className="icon-btn focus-ring mr-2 h-9 w-9 flex-shrink-0 self-center"
            >
              {editing ? <X size={16} /> : <Pencil size={15} />}
            </button>
          </div>
        )}

        {/* ── Inline goal editor: presets + stepper, saves as you tap ──────── */}
        {SHOW_GOALS && editing && (
          <div id="goal-editor" className="animate-slideDown px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tamil mr-1 font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
                {t('adjustGoal')}
              </span>
              {GOAL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyGoal(p)}
                  aria-pressed={goal === p}
                  className={`focus-ring press rounded-pill px-3.5 py-1.5 font-heading text-[12.5px] font-semibold transition-colors ${
                    goal === p
                      ? 'bg-brand text-white'
                      : 'border border-line bg-card text-ink hover:border-brand/40 hover:text-brand-dark'
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="ml-auto inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyGoal(goal - GOAL_STEP)}
                  disabled={goal <= GOAL_MIN}
                  aria-label={`−${GOAL_STEP}`}
                  className="icon-btn focus-ring h-8 w-8 rounded-lg border border-line disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span
                  aria-live="polite"
                  className="w-10 text-center font-display text-[15px] font-bold text-ink"
                >
                  {goal}
                </span>
                <button
                  type="button"
                  onClick={() => applyGoal(goal + GOAL_STEP)}
                  disabled={goal >= GOAL_MAX}
                  aria-label={`+${GOAL_STEP}`}
                  className="icon-btn focus-ring h-8 w-8 rounded-lg border border-line disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </span>
            </div>
          </div>
        )}

        {/* ── This week: 7 IST day cells; tap any day for its count ────────── */}
        {SHOW_STREAK && (
          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tamil font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
                {t('thisWeek')}
              </span>
              {nextMilestone != null && (
                <span className="tamil inline-flex items-center gap-1 font-body text-[11.5px] text-muted">
                  <Flame size={12} className="text-accent" aria-hidden />
                  <span className="font-heading font-semibold text-ink">
                    {habit.currentStreak}/{nextMilestone}
                  </span>
                  {t('nextMilestone')}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {week.map((d) => {
                const label = `${dayNames[d.dow]}: ${d.q} ${t('questionsCount')}`
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toast.info(label)}
                    aria-label={label}
                    className={`focus-ring press flex flex-col items-center gap-1.5 rounded-lg py-1.5 ${
                      d.isToday ? 'bg-tint/50' : 'hover:bg-tint/40'
                    }`}
                  >
                    <span
                      className={`tamil font-heading text-[10px] font-semibold uppercase ${
                        d.isToday ? 'text-brand' : 'text-muted'
                      }`}
                    >
                      {dayShort[d.dow]}
                    </span>
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full font-display text-[10px] font-bold ${
                        d.q >= goal
                          ? 'border border-mint/40 bg-mintsoft text-mint'
                          : d.q > 0
                            ? 'bg-brand-soft text-brand-dark'
                            : d.isToday
                              ? `border border-dashed ${
                                  streakAtRisk ? 'border-accent/70' : 'border-brand/60'
                                }`
                              : 'border border-line'
                      }`}
                    >
                      {d.q >= goal ? (
                        <Check size={13} strokeWidth={3} aria-hidden />
                      ) : d.q > 0 ? (
                        d.q > 99 ? (
                          '99+'
                        ) : (
                          d.q
                        )
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Progression: level + XP toward the next one → profile ────────── */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="focus-ring group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-tint/30"
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-brand-soft font-display text-[13px] font-bold text-brand-dark">
            {lvl.level}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="tamil truncate font-heading text-[12.5px] font-semibold text-ink">
                {t('level')} {lvl.level} · {lvl.title}
              </span>
              <span className="flex-shrink-0 font-body text-[11px] text-muted">
                {lvl.toNext} {t('xp')} → {lvl.level + 1}
              </span>
            </span>
            <span className="mt-1.5 block">
              <ProgressBar percent={lvl.pct} height={5} />
            </span>
          </span>
          <ChevronRight
            size={16}
            className="flex-shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </section>

      {/* ── Habit chips - countdown / goal setup / streak record / awards ──── */}
      <div className="flex flex-wrap items-center gap-2">
        {showExamChip && (
          <button type="button" onClick={() => navigate('/setup')} className={chipClass}>
            <CalendarDays size={14} className="text-primary" aria-hidden />
            <span className="text-primary">{habit.daysToExam}</span> {t('daysToExam')}
          </button>
        )}
        {showSetupChip && (
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className={`${chipClass} border-transparent bg-brand-soft text-brand-dark hover:bg-tint`}
          >
            <Target size={14} aria-hidden /> {t('setExamDate')}
            <ChevronRight size={14} className="-mr-1" aria-hidden />
          </button>
        )}
        {SHOW_STREAK && habit.longestStreak > 1 && (
          <button type="button" onClick={() => navigate('/insights')} className={chipClass}>
            <Flame size={14} className="text-accent" aria-hidden />
            <span className="text-accent">{habit.longestStreak}</span> {t('bestStreak')}
          </button>
        )}
        <button type="button" onClick={() => navigate('/profile')} className={chipClass}>
          <Award size={14} className="text-gold" aria-hidden />
          <span className="text-gold">
            {earned}/{badges.length}
          </span>{' '}
          {t('achievements')}
        </button>
      </div>
    </div>
  )
}
