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
  Layers,
  Activity,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import ProgressBar from '../components/UI/ProgressBar'
import PremiumCard from '../components/UI/PremiumCard'
import StreakCalendar from '../components/StreakCalendar'
import { useAuth } from '../hooks/useAuth'
import { fetchHabit, type HabitState } from '../lib/habit'
import { SHOW_STREAK, SHOW_GOALS } from '../lib/features'
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

// Each category gets its own pastel tile (design-system.md §1) — soft tinted
// square + the icon in the matching strong colour, so the grid reads as a set
// of distinct destinations rather than a wall of violet.
const CARDS: ArenaCard[] = [
  {
    to: '/mock',
    titleKey: 'mockTests',
    subtitle: 'Group exam · subject · timed',
    icon: <ShieldCheck size={20} />,
    tile: 'bg-tint-coral text-accent',
  },
  {
    to: '/test-arena/subjects',
    titleKey: 'subjectPracticeTitle',
    subtitle: 'Subject · topic · question type',
    icon: <Layers size={20} />,
    tile: 'bg-tint-violet text-primary',
  },
  {
    to: '/test-arena/pyq',
    titleKey: 'pyqTitle',
    subtitle: 'Group 1',
    icon: <BookOpen size={20} />,
    tile: 'bg-tint-blue text-sky',
  },
  {
    to: '/test-arena/current-affairs',
    titleKey: 'currentAffairsTitle',
    subtitle: 'Month & topic wise',
    icon: <Newspaper size={20} />,
    tile: 'bg-tint-green text-mint',
  },
  {
    to: '/test-arena/aptitude',
    titleKey: 'aptitudeTitle',
    subtitle: 'Numerics · Reasoning',
    icon: <Calculator size={20} />,
    tile: 'bg-tint-coral text-accent',
  },
]

// The admin "Manage Question Bank" grid lists only the actual question-bank
// categories - the Mock Test card (a student exam mode, not a bank) is excluded.
const BANK_CARDS = CARDS.filter((c) => c.to.startsWith('/test-arena'))

export default function TestArenaPage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin } = useAuth()
  const { t } = useT()
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)

  useEffect(() => {
    // Admins/superadmins don't use the aspirant gamification layer - skip the
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
  // Streak / daily-goal / exam-countdown surfaces are hidden for now (the habit
  // data is still fetched so they light up instantly when re-enabled).
  const showRail = SHOW_STREAK || SHOW_GOALS
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
  // page) only fires for progress earned AFTER this point - never a backlog.
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
  // gamification - no level, streak, daily goal or achievements). ──────────────
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

  const [featured, ...restCards] = CARDS

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:py-8">
        {/* Greeting - compact royal-blue strip (no gamification) */}
        <div className="hero-panel relative flex items-center justify-between gap-4 p-5 animate-slideDown lg:p-6">
          <div
            className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
            style={{ backgroundSize: '18px 18px' }}
          />
          <div className="relative min-w-0">
            <p className="font-body text-sm text-white/60">{t('welcomeBack')}</p>
            <h1 className="truncate font-heading text-2xl font-semibold tracking-tight text-white">
              {firstName || 'Aspirant'}
            </h1>
            <p className="tamil mt-1 font-body text-sm text-white/70">{t('dashboardSub')}</p>
          </div>
        </div>

        {/* Premium upsell - 3-month plan (₹1899 → ₹1399). Dismissible on the
            dashboard; closing hides it for this view only — it returns on reload. */}
        <PremiumCard dismissible />

        {/* Progress rail - feature-flagged; rendered as a row when re-enabled */}
        {showRail && habit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SHOW_STREAK && (
                <StatTile
                  icon={<Flame size={18} />}
                  value={String(habit.currentStreak)}
                  label={t('dayStreak')}
                />
              )}
              {SHOW_GOALS &&
                (habit.daysToExam != null ? (
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
                ))}
              {SHOW_GOALS && (
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
                    color={habit.goalMetToday ? 'rgb(var(--c-mint))' : 'rgb(var(--c-brand))'}
                    height={6}
                  />
                </div>
              )}
            </div>
            {SHOW_STREAK && (
              <StreakCalendar last30={habit.last30} currentStreak={habit.currentStreak} />
            )}
          </div>
        )}

        {/* Practice categories - bento tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {restCards.map((card, i) => (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              style={{ '--i': i } as React.CSSProperties}
              className="card interactive stagger-item group flex min-h-[120px] flex-col justify-between gap-3 p-5 text-left"
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-tile transition-transform group-hover:scale-105 ${card.tile}`}
              >
                {card.icon}
              </span>
              <span className="min-w-0">
                <span className="tamil block font-heading text-sm font-semibold leading-snug text-ink">
                  {t(card.titleKey)}
                </span>
                <span className="mt-1 block font-body text-xs text-ink2">{card.subtitle}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Keep going - study-loop quick links */}
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

        {/* Mock Tests - full-width gradient CTA at the bottom */}
        <button
          onClick={() => navigate(featured.to)}
          className="hero-panel interactive group relative flex w-full items-center gap-4 p-6 text-left"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-hero-grid opacity-60"
            style={{ backgroundSize: '18px 18px' }}
          />
          <span className="relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-tile bg-white/15 text-white ring-1 ring-white/20">
            {featured.icon}
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="tamil block font-heading text-lg font-semibold tracking-tight text-white">
              {t(featured.titleKey)}
            </span>
            <span className="block font-body text-sm text-white/70">{featured.subtitle}</span>
          </span>
          <span className="relative hidden flex-shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 font-heading text-sm font-semibold text-brand-dark transition-all group-hover:gap-2.5 sm:inline-flex">
            {t('start')} <ChevronRight size={16} />
          </span>
        </button>
      </div>
    </AppLayout>
  )
}

/**
 * Admin / superadmin home - a clean content-management surface. No aspirant
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
        {/* Admin header - restrained, role-aware, no gamification */}
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
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-brand-gradient text-white shadow-brand">
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
              <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile ${card.tile}`}>
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
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-gold/15 text-gold">
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
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-tile bg-tint-violet text-primary">
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
      <span className="grid h-10 w-10 place-items-center rounded-tile bg-tint-violet text-primary">{icon}</span>
      <span className="tamil font-heading text-xs font-medium text-ink">{label}</span>
    </button>
  )
}
