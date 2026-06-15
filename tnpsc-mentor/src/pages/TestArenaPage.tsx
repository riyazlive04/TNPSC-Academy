import { useEffect, useState } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import {
  BookOpen,
  Newspaper,
  Calculator,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  FileText,
  Flame,
  CalendarClock,
  Target,
  ChevronRight,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import ProgressBar from '../components/UI/ProgressBar'
import StreakCalendar from '../components/StreakCalendar'
import { useAuth } from '../hooks/useAuth'
import { fetchHabit, type HabitState } from '../lib/habit'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { computeXp, levelInfo } from '../lib/game'
import { unlockedBadgeIds, type GameStats } from '../lib/achievements'
import { GROUP_SUBJECTS } from '../lib/constants'
import { useProgressStore } from '../store/progressStore'
import type { GroupType } from '../types'
import { useT, type StringKey } from '../lib/i18n'

interface ArenaCard {
  to: string
  titleKey: StringKey
  subtitle: string
  icon: React.ReactNode
  tile: string // icon-tile colour classes
}

const CARDS: ArenaCard[] = [
  {
    to: '/mock',
    titleKey: 'mockTests',
    subtitle: 'Group exam · subject · timed',
    icon: <ShieldCheck size={20} />,
    tile: 'bg-accentwarmsoft text-accentwarm',
  },
  {
    to: '/test-arena/subjects',
    titleKey: 'subjectPracticeTitle',
    subtitle: 'Subject · topic · question type',
    icon: <Layers size={20} />,
    tile: 'bg-brand-soft text-brand',
  },
  {
    to: '/test-arena/pyq',
    titleKey: 'pyqTitle',
    subtitle: 'Group 1 · 2/2A · 4 & VAO',
    icon: <BookOpen size={20} />,
    tile: 'bg-brand-soft text-brand',
  },
  {
    to: '/test-arena/current-affairs',
    titleKey: 'currentAffairsTitle',
    subtitle: 'Month & topic wise',
    icon: <Newspaper size={20} />,
    tile: 'bg-brand-soft text-brand',
  },
  {
    to: '/test-arena/aptitude',
    titleKey: 'aptitudeTitle',
    subtitle: 'Numerics · Reasoning',
    icon: <Calculator size={20} />,
    tile: 'bg-brand-soft text-brand',
  },
]

// The admin "Manage Question Bank" grid lists only the actual question-bank
// categories — the Mock Test card (a student exam mode, not a bank) is excluded.
const BANK_CARDS = CARDS.filter((c) => c.to.startsWith('/test-arena'))

export default function TestArenaPage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin } = useAuth()
  const { t } = useT()
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)

  useEffect(() => {
    // Admins/superadmins don't use the aspirant gamification layer — skip the
    // habit/analytics fetches entirely for them.
    if (!user || isAdmin) return
    let cancelled = false
    Promise.all([
      fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null),
      fetchUserAnalytics(user.id),
    ])
      .then(([h, a]) => {
        if (cancelled) return
        setHabit(h)
        setAnalytics(a)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, isAdmin, profile?.daily_goal, profile?.exam_date])

  const firstName = profile?.full_name?.split(' ')[0]
  const goalPct = habit
    ? Math.min(100, (habit.questionsToday / Math.max(1, habit.dailyGoal)) * 100)
    : 0
  const lvl = levelInfo(
    computeXp({
      totalCorrect: analytics?.overview.totalCorrect ?? 0,
      totalQuestions: analytics?.overview.totalQuestions ?? 0,
      testsTaken: analytics?.overview.testsTaken ?? 0,
    })
  )

  // Seed the reward baseline once, so the celebration overlay (on the Result
  // page) only fires for progress earned AFTER this point — never a backlog.
  const syncProgress = useProgressStore((s) => s.sync)
  useEffect(() => {
    if (!analytics || !habit) return
    const group = (profile?.target_group as GroupType) || 'Group1'
    const stats: GameStats = {
      tests: analytics.overview.testsTaken,
      questions: analytics.overview.totalQuestions,
      correct: analytics.overview.totalCorrect,
      bestScore: analytics.overview.bestScore,
      avgAccuracy: analytics.overview.avgAccuracy,
      minutes: analytics.overview.totalTimeMinutes,
      longestStreak: habit.longestStreak,
      currentStreak: habit.currentStreak,
      subjects: analytics.bySubject.length,
      totalSubjects: (GROUP_SUBJECTS[group] ?? []).length,
    }
    syncProgress(unlockedBadgeIds(stats), lvl.level)
  }, [analytics, habit, profile, lvl.level, syncProgress])

  // ─── Admin / superadmin: a focused content-management home (no aspirant
  // gamification — no level, streak, daily goal or achievements). ──────────────
  if (isAdmin) {
    return (
      <AdminDashboard
        name={firstName}
        isSuperAdmin={isSuperAdmin}
        onNavigate={navigate}
        t={t}
      />
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
        {/* Level hero — royal-blue panel */}
        <button
          onClick={() => navigate('/achievements')}
          className="hero-panel mb-5 flex w-full items-center justify-between gap-4 p-6 text-left transition hover:brightness-[1.04]"
        >
          <div className="min-w-0 flex-1">
            <p className="font-body text-sm text-white/55">{t('welcome')}</p>
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-white">
              {firstName || 'Aspirant'}
            </h1>
            <div className="mt-3 flex items-center gap-2 font-body text-sm text-white/65">
              <span className="font-heading font-medium text-white">
                {t('level')} {lvl.level}
              </span>
              <span className="text-white/30">·</span>
              <span>{lvl.title}</span>
            </div>
            <div className="mt-2.5 max-w-[260px]">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-white/90 transition-all duration-500"
                  style={{ width: `${lvl.pct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {habit && habit.currentStreak > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-heading text-sm font-medium text-white">
                <Flame size={14} className="text-accentwarm" /> {habit.currentStreak}
              </span>
            )}
            <ChevronRight size={18} className="text-white/40" />
          </div>
        </button>

        {/* Responsive body — stacked on phones, two columns from tablet up. */}
        <div className="grid items-start gap-5 md:grid-cols-3 md:gap-6">
          {/* Right rail: progress at a glance (first on mobile, right on tablet+) */}
          <aside className="min-w-0 space-y-5 md:order-2 md:col-span-1">
            {habit && (
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  icon={<Flame size={18} />}
                  value={String(habit.currentStreak)}
                  label={t('dayStreak')}
                />
                {habit.daysToExam != null ? (
                  <StatTile
                    icon={<CalendarClock size={18} />}
                    value={String(Math.max(0, habit.daysToExam))}
                    label={t('daysToExam')}
                  />
                ) : (
                  <button
                    onClick={() => navigate('/setup')}
                    className="card interactive flex flex-col items-start gap-2 p-3.5 text-left"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
                      <CalendarClock size={18} />
                    </span>
                    <span className="tamil font-heading text-xs font-semibold text-ink">
                      {t('setExamDate')}
                    </span>
                  </button>
                )}

                {/* Daily goal */}
                <div className="card col-span-2 flex flex-col justify-center gap-2 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="tamil flex items-center gap-1.5 font-heading text-xs font-semibold uppercase tracking-wide text-ink2">
                      <Target size={13} /> {t('dailyGoal')}
                    </span>
                    <span className="font-heading text-xs font-semibold text-ink">
                      {habit.questionsToday}/{habit.dailyGoal}
                    </span>
                  </div>
                  <ProgressBar
                    percent={goalPct}
                    color={habit.goalMetToday ? '#16A34A' : '#2563EB'}
                    height={6}
                  />
                </div>
              </div>
            )}

            {habit && (
              <StreakCalendar last30={habit.last30} currentStreak={habit.currentStreak} />
            )}
          </aside>

          {/* Main column: the things to do */}
          <div className="min-w-0 space-y-6 md:order-1 md:col-span-2">
            {/* Daily drill — the primary suggestion, a single restrained accent */}
            <button
              onClick={() => navigate('/daily')}
              className="group interactive flex w-full items-center gap-4 rounded-2xl border border-brand/15 bg-brand-soft p-4 text-left lg:p-5"
            >
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand text-white">
                <Sparkles size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="tamil block font-heading text-[15px] font-semibold text-ink">
                  {t('daily')}
                </span>
                <span className="tamil block truncate font-body text-sm text-ink2">
                  {t('dailyCta')}
                </span>
              </span>
              <ChevronRight
                size={20}
                className="flex-shrink-0 text-brand/40 transition group-hover:text-brand"
              />
            </button>

            {/* Practice categories */}
            <div>
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                Practice
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CARDS.map((card) => (
                  <button
                    key={card.to}
                    onClick={() => navigate(card.to)}
                    className="card interactive group flex items-center gap-4 p-4 text-left"
                  >
                    <span
                      className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg ${card.tile}`}
                    >
                      {card.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="tamil block font-heading text-sm font-semibold leading-tight text-ink">
                        {t(card.titleKey)}
                      </span>
                      <span className="mt-0.5 block truncate font-body text-xs text-ink2">
                        {card.subtitle}
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      className="flex-shrink-0 text-ink2/30 transition group-hover:text-ink2"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick links — study loop */}
            <div>
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                Keep going
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <QuickLink
                  icon={<RefreshCw size={18} />}
                  label={t('revision')}
                  onClick={() => navigate('/revision')}
                />
                <QuickLink
                  icon={<FileText size={18} />}
                  label={t('mockTests')}
                  onClick={() => navigate('/mock')}
                />
                <QuickLink
                  icon={<TrendingUp size={18} />}
                  label={t('insights')}
                  onClick={() => navigate('/insights')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/**
 * Admin / superadmin home — a clean content-management surface. No aspirant
 * gamification (level, streak, daily goal, achievements). Picking a category
 * routes (via useStartTest) into the full question-bank view with answers shown.
 */
function AdminDashboard({
  name,
  isSuperAdmin,
  onNavigate,
  t,
}: {
  name?: string
  isSuperAdmin: boolean
  onNavigate: NavigateFunction
  t: (key: StringKey) => string
}) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-8">
        {/* Admin header — restrained, role-aware, no gamification */}
        <div className="hero-panel mb-6 flex items-center justify-between gap-4 p-6 animate-slideDown">
          <div className="min-w-0">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/20">
              <ShieldCheck size={13} /> {isSuperAdmin ? t('superadmin') : t('admin')}
            </div>
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-white">
              {name || (isSuperAdmin ? 'Super Admin' : 'Admin')}
            </h1>
            <p className="mt-1 font-body text-sm text-white/70">{t('adminHomeSub')}</p>
          </div>
          <ShieldCheck size={40} className="hidden flex-shrink-0 text-white/25 sm:block" />
        </div>

        {/* Superadmin-only: platform console */}
        {isSuperAdmin && (
          <button
            onClick={() => onNavigate('/superadmin')}
            className="card interactive group mb-6 flex w-full items-center gap-4 p-4 text-left"
          >
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-brand">
              <Activity size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold leading-tight text-ink">
                {t('superadminConsole')}
              </span>
              <span className="mt-0.5 block truncate font-body text-xs text-ink2">
                {t('platformMetricsSub')}
              </span>
            </span>
            <ChevronRight size={18} className="flex-shrink-0 text-ink2/30 transition group-hover:text-brand" />
          </button>
        )}

        {/* Question bank management */}
        <h2 className="mb-1 font-heading text-base font-semibold tracking-tight text-ink">
          {t('manageBank')}
        </h2>
        <p className="mb-3 font-body text-sm text-ink2">{t('pickCategoryAdmin')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BANK_CARDS.map((card, i) => (
            <button
              key={card.to}
              onClick={() => onNavigate(card.to)}
              style={{ '--i': i } as React.CSSProperties}
              className="card interactive stagger-item group flex items-center gap-4 p-4 text-left"
            >
              <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg ${card.tile}`}>
                {card.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="tamil block font-heading text-sm font-semibold leading-tight text-ink">
                  {t(card.titleKey)}
                </span>
                <span className="mt-0.5 block truncate font-body text-xs text-ink2">
                  {t('browseEditBank')}
                </span>
              </span>
              <ChevronRight size={18} className="flex-shrink-0 text-ink2/30 transition group-hover:text-ink2" />
            </button>
          ))}

          {/* Outer subject bank (admin-only content) */}
          <button
            onClick={() => onNavigate('/admin/questions', { state: { category: 'outer', label: 'Outer Questions' } })}
            style={{ '--i': BANK_CARDS.length } as React.CSSProperties}
            className="card interactive stagger-item group flex items-center gap-4 p-4 text-left"
          >
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
              <Layers size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold leading-tight text-ink">
                Outer Questions
              </span>
              <span className="mt-0.5 block truncate font-body text-xs text-ink2">
                {t('outerQuestionsSub')}
              </span>
            </span>
            <ChevronRight size={18} className="flex-shrink-0 text-ink2/30 transition group-hover:text-ink2" />
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-heading text-xl font-semibold leading-none text-ink">{value}</div>
        <div className="tamil mt-1 truncate font-body text-[11px] uppercase tracking-wide text-ink2">
          {label}
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card interactive flex flex-col items-center gap-2 p-3"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>
      <span className="tamil font-heading text-xs font-medium text-ink">{label}</span>
    </button>
  )
}
