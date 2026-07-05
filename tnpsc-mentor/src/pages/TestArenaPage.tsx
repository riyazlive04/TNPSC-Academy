import { cloneElement, useEffect, useState, type ReactElement } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookOpen,
  Newspaper,
  Calculator,
  ShieldCheck,
  RefreshCw,
  Flame,
  ChevronRight,
  Layers,
  Activity,
  BarChart3,
  ScrollText,
  CalendarDays,
  Trophy,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import ThirukuralModal from '../components/Thirukural/ThirukuralModal'
import Couplet from '../components/Thirukural/Couplet'
import OnboardingTour from '../components/Onboarding/OnboardingTour'
import { loadKurals, kuralOfDay, splitCoupletEn, type Kural } from '../lib/thirukural'
import PremiumCard from '../components/UI/PremiumCard'
import IconTile, { type Tint } from '../components/UI/IconTile'
import SectionHeader from '../components/UI/SectionHeader'
import { List, ListRow } from '../components/UI/ListRow'
import { useAuth } from '../hooks/useAuth'
import { useTestSeriesEnabled } from '../hooks/useTestSeriesEnabled'
import { useVettriEnabled } from '../hooks/useVettriEnabled'
import { fetchHabit, type HabitState } from '../lib/habit'
import { SHOW_STREAK } from '../lib/features'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { computeXp, levelInfo } from '../lib/game'
import { unlockedBadgeIds, type GameStats } from '../lib/achievements'
import { GROUP_SUBJECTS } from '../lib/constants'
import { useProgressStore } from '../store/progressStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { toast } from '../store/toastStore'
import { tapScaleSubtle } from '../lib/motion'
import type { GroupType } from '../types'
import { useT, type StringKey } from '../lib/i18n'

interface ArenaCard {
  to: string
  titleKey: StringKey
  subtitle: string
  icon: React.ReactNode
  tint: Tint
}

// Each category carries a tint for its in-row IconTile (design-system.md §1) -
// a small tinted square, never a large category card. The first entry (Mock) is
// promoted to the single gradient hero; the rest render as a hairline list.
const CARDS: ArenaCard[] = [
  {
    to: '/mock',
    titleKey: 'mockTests',
    subtitle: 'Group exam · subject · timed',
    icon: <ShieldCheck size={20} />,
    tint: 'coral',
  },
  {
    to: '/test-arena/subjects',
    titleKey: 'subjectPracticeTitle',
    subtitle: 'Subject · topic · question type',
    icon: <Layers size={19} />,
    tint: 'violet',
  },
  {
    to: '/test-arena/pyq',
    titleKey: 'pyqTitle',
    subtitle: 'Group 1 · Group 2 / 2A',
    icon: <BookOpen size={19} />,
    tint: 'blue',
  },
  {
    to: '/test-arena/current-affairs',
    titleKey: 'currentAffairsTitle',
    subtitle: 'Month & topic wise',
    icon: <Newspaper size={19} />,
    tint: 'green',
  },
  {
    to: '/test-arena/aptitude',
    titleKey: 'aptitudeTitle',
    subtitle: 'Numerics · Reasoning',
    icon: <Calculator size={19} />,
    tint: 'coral',
  },
]

// The admin "Manage Question Bank" list shows only the actual question-bank
// categories - the Mock Test entry (a student exam mode, not a bank) is excluded.
const BANK_CARDS = CARDS.filter((c) => c.to.startsWith('/test-arena'))

// Gradient stops per tint for the dashboard category cards. Each pairs two real
// theme colours (br direction) so the icon tile reads as a designed, dimensional
// chip rather than a flat pastel square. White glyph sits on top.
const GRADIENTS: Record<Tint, string> = {
  violet: 'from-brand to-brand-deep',
  coral: 'from-accentwarm to-coral',
  blue: 'from-sky to-brand',
  green: 'from-mint to-sky',
}

export default function TestArenaPage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin } = useAuth()
  const testSeriesOn = useTestSeriesEnabled()
  const vettriOn = useVettriEnabled()
  const { t, lang } = useT()
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [thirukuralOpen, setThirukuralOpen] = useState(false)
  const [dailyKural, setDailyKural] = useState<Kural | null>(null)

  // First-run guided tour - shown ONLY to a freshly created account. Signup arms
  // `pending`; the dashboard consumes it once here and opens the spotlight tour.
  // Existing users never had it armed, so it never fires for them. Admins skip
  // the aspirant layer entirely.
  const onboardingPending = useOnboardingStore((s) => s.pending)
  const onboardingOpen = useOnboardingStore((s) => s.open)
  const startOnboarding = useOnboardingStore((s) => s.start)
  const finishOnboarding = useOnboardingStore((s) => s.finish)
  useEffect(() => {
    if (!isAdmin && onboardingPending) startOnboarding()
  }, [isAdmin, onboardingPending, startOnboarding])

  // Load the kural bank once and pick today's couplet for the header. The modal
  // shares the same module-level cache, so opening it makes no extra request.
  useEffect(() => {
    if (isAdmin) return
    let cancelled = false
    loadKurals()
      .then((all) => !cancelled && setDailyKural(kuralOfDay(all) ?? null))
      .catch(() => {
        // Decorative header content; leave it absent (safe fallback) rather than
        // crash, but keep a console trail for diagnosis.
        if (!cancelled) setDailyKural(null)
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

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
      .catch(() => {
        // Dashboard stats failed to load - keep the page usable (null state) and
        // tell the user quietly rather than silently swallowing the failure.
        if (!cancelled) toast.error(t('couldNotLoad'))
      })
    return () => {
      cancelled = true
    }
  }, [user, isAdmin, profile?.daily_goal, profile?.exam_date, t])

  const firstName = profile?.full_name?.split(' ')[0]
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
  const showStreak = SHOW_STREAK && (habit?.currentStreak ?? 0) > 0

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 lg:py-8">
        {/* Greeting - bare on the surface. Hierarchy from type + space, no box. */}
        <header className="px-1">
          <p className="font-body text-[13px] text-muted">{t('welcomeBack')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink">
              {firstName || 'Aspirant'}
            </h1>
            {showStreak && (
              <span className="inline-flex items-center gap-1 font-display text-[15px] font-semibold text-accent">
                <Flame size={15} /> {habit!.currentStreak}
                <span className="tamil font-body text-[13px] font-normal text-muted">
                  {t('dayStreak')}
                </span>
              </span>
            )}
          </div>
          {/* Kural of the day - the actual couplet, rotating daily. Tapping it
              opens the box straight at this kural's full detail. */}
          {dailyKural && (
            <button
              onClick={() => setThirukuralOpen(true)}
              className="focus-ring group mt-4 block w-full rounded-card border border-line bg-tint-violet/40 p-4 text-left transition-colors hover:bg-tint-violet/60"
            >
              <span className="flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-primary">
                <ScrollText size={13} />
                <span className="tamil">{t('kuralOfTheDay')}</span>
                <ChevronRight
                  size={15}
                  className="ml-auto text-primary/50 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              {/* The kural is ALWAYS shown in Tamil — line 1 (4 சீர்) above
                  line 2 (3 சீர்) — and auto-fits so each line stays on one line
                  even on a narrow phone. */}
              <Couplet
                line1={dailyKural.line1_ta}
                line2={dailyKural.line2_ta}
                className="tamil mt-2 font-display font-semibold leading-relaxed text-ink"
                max={17}
              />
              {lang === 'ta' ? (
                <p className="mt-1 font-body text-[12px] italic leading-relaxed text-muted sm:text-[13px]">
                  {dailyKural.transliteration}
                </p>
              ) : (
                // English meaning as a two-line couplet, mirroring the Tamil.
                <p className="mt-1.5 font-body text-[12px] not-italic leading-relaxed text-muted sm:text-[13px]">
                  {splitCoupletEn(dailyKural.translation_en).map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              )}
            </button>
          )}
        </header>

        {/* The one gradient hero - the single elevated element on the screen.
            data-tour anchors the onboarding spotlight to the mock-test card. */}
        <div data-tour="mock">
          <Hero
            icon={featured.icon}
            title={t(featured.titleKey)}
            subtitle={featured.subtitle}
            cta={t('start')}
            onClick={() => navigate(featured.to)}
          />
        </div>

        {/* Practice - a two-column grid of tactile category cards. */}
        <section className="space-y-3" data-tour="practice">
          <SectionHeader title={t('practice')} className="px-1" />
          <div className="grid grid-cols-2 gap-3">
            {/* Vettri Nichayam bundle - gold to signal the flagship paid product. */}
            {vettriOn && (
              <CategoryCard
                onClick={() => navigate('/vettri')}
                icon={<Trophy />}
                gradient="from-gold to-accentwarm"
                title={t('vettriTitle')}
                subtitle={t('vettriArenaSub')}
                index={0}
              />
            )}
            {/* Test Marathon - only once the superadmin has enabled it. */}
            {testSeriesOn && (
              <CategoryCard
                onClick={() => navigate('/test-series')}
                icon={<CalendarDays />}
                gradient={GRADIENTS.coral}
                title={t('testSeriesTitle')}
                subtitle={t('testSeriesArenaSub')}
                index={1}
              />
            )}
            {restCards.map((card, i) => (
              <CategoryCard
                key={card.to}
                onClick={() => navigate(card.to)}
                icon={card.icon}
                gradient={GRADIENTS[card.tint]}
                title={t(card.titleKey)}
                subtitle={card.subtitle}
                index={i + 2}
              />
            ))}
            {/* Thirukkural quiz - a self-contained bilingual practice bank. */}
            <CategoryCard
              onClick={() => navigate('/test-arena/thirukural')}
              icon={<ScrollText />}
              gradient={GRADIENTS.green}
              title={t('tkQuizTitle')}
              subtitle={t('tkQuizSub')}
              index={restCards.length + 2}
            />
          </div>
        </section>

        {/* Premium upsell - the one deliberately distinct surface (its own coral
            identity), kept as a self-contained monetisation unit. */}
        <PremiumCard dismissible />

        {/* Keep going - study-loop quick links, matching the practice cards. */}
        <section className="space-y-3" data-tour="progress">
          <SectionHeader title={t('keepGoingShort')} className="px-1" />
          <div className="grid grid-cols-2 gap-3">
            <CategoryCard
              onClick={() => navigate('/revision')}
              icon={<RefreshCw />}
              gradient={GRADIENTS.violet}
              title={t('revision')}
            />
            <CategoryCard
              onClick={() => navigate('/insights')}
              icon={<BarChart3 />}
              gradient={GRADIENTS.blue}
              title={t('insights')}
            />
          </div>
        </section>
      </div>

      <ThirukuralModal
        open={thirukuralOpen}
        onClose={() => setThirukuralOpen(false)}
        initialKuralNo={dailyKural?.kural_no}
      />

      <OnboardingTour open={onboardingOpen} onFinish={finishOnboarding} />
    </AppLayout>
  )
}

/** A dashboard category as a clean, compact card: a gradient icon chip, title +
 * optional (clamped) subtitle. Presses via motion; lifts subtly on hover. */
function CategoryCard({
  onClick,
  icon,
  gradient,
  title,
  subtitle,
  index = 0,
}: {
  onClick: () => void
  icon: React.ReactNode
  /** Tailwind gradient stops, e.g. 'from-brand to-brand-deep'. */
  gradient: string
  title: string
  subtitle?: string
  index?: number
}) {
  const glyph = icon as ReactElement<{ size?: number }>
  return (
    <motion.button
      type="button"
      onClick={onClick}
      style={{ '--i': index } as React.CSSProperties}
      className="stagger-item group focus-ring flex h-full flex-col items-start gap-2.5 rounded-card border border-line bg-card p-3.5 text-left shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
      {...tapScaleSubtle}
    >
      <span
        className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}
      >
        {cloneElement(glyph, { size: 20 })}
      </span>
      <span className="min-w-0">
        <span className="tamil block font-heading text-sm font-semibold leading-tight text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="tamil mt-0.5 line-clamp-2 block font-body text-[11.5px] leading-snug text-muted">
            {subtitle}
          </span>
        )}
      </span>
    </motion.button>
  )
}

/** The single gradient hero - the only elevated/shadowed element on a screen
 * (design-system.md elevation budget). Full-bleed brand gradient, dotted
 * overlay, white "Start" pill. Tactile press via motion. */
function Hero({
  icon,
  title,
  subtitle,
  cta,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  cta: string
  onClick: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      onClick={onClick}
      whileTap={reduce ? undefined : tapScaleSubtle}
      className="hero-panel focus-ring group relative flex w-full items-center gap-4 p-6 text-left"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-hero-grid opacity-60"
        style={{ backgroundSize: '18px 18px' }}
      />
      <span className="relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-tile bg-white/15 text-white ring-1 ring-white/20">
        {icon}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="tamil block font-display text-lg font-semibold tracking-tight text-white">
          {title}
        </span>
        <span className="block font-body text-sm text-white/70">{subtitle}</span>
      </span>
      <span className="relative hidden flex-shrink-0 items-center gap-1.5 rounded-pill bg-white px-4 py-2 font-display text-sm font-semibold text-primary-deep transition-all group-hover:gap-2.5 sm:inline-flex">
        {cta} <ChevronRight size={16} />
      </span>
      <ChevronRight size={20} className="relative flex-shrink-0 text-white/70 sm:hidden" />
    </motion.button>
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
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 lg:py-8">
        {/* Admin greeting - bare, role-aware, no gamification, no gradient panel. */}
        <header className="px-1">
          <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold uppercase tracking-wide text-accent">
            <ShieldCheck size={14} /> {isSuperAdmin ? t('superadmin') : t('admin')}
          </span>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight text-ink">
            {name || (isSuperAdmin ? 'Super Admin' : 'Admin')}
          </h1>
          <p className="mt-1 font-body text-[15px] text-muted">{t('adminHomeSub')}</p>
        </header>

        {/* Superadmin-only: the platform console is the primary action → hero. */}
        {isSuperAdmin && (
          <Hero
            icon={<Activity size={20} />}
            title={t('superadminConsole')}
            subtitle={t('platformMetricsSub')}
            cta={t('start')}
            onClick={() => onNavigate('/superadmin')}
          />
        )}

        {/* Question bank management - a list, not a card grid. */}
        <section className="space-y-2">
          <SectionHeader title={t('manageBank')} className="px-1" />
          <p className="px-1 font-body text-[13px] text-muted">{t('pickCategoryAdmin')}</p>
          <List>
            {BANK_CARDS.map((card, i) => (
              <ListRow
                key={card.to}
                onClick={() => onNavigate(card.to)}
                style={{ '--i': i } as React.CSSProperties}
                leading={<IconTile tint={card.tint}>{card.icon}</IconTile>}
                title={t(card.titleKey)}
                subtitle={t('browseEditBank')}
              />
            ))}
            <ListRow
              onClick={() =>
                onNavigate('/admin/questions', {
                  state: { category: 'outer', label: 'Outer Questions' },
                })
              }
              leading={
                <IconTile tint="coral">
                  <Layers size={20} />
                </IconTile>
              }
              title="Outer Questions"
              subtitle={t('outerQuestionsSub')}
            />
          </List>
        </section>
      </div>
    </AppLayout>
  )
}
