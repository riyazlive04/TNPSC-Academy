import { useEffect, useMemo, useState } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookOpen,
  Newspaper,
  Calculator,
  ShieldCheck,
  Flame,
  ChevronRight,
  Layers,
  Activity,
  ScrollText,
  CalendarDays,
  Sparkles,
  RefreshCw,
  BarChart3,
  Trophy,
} from 'lucide-react'
import ThirukuralModal from '../components/Thirukural/ThirukuralModal'
import Couplet from '../components/Thirukural/Couplet'
import OnboardingTour from '../components/Onboarding/OnboardingTour'
import StarterTestPrompt from '../components/Onboarding/StarterTestPrompt'
import MarathonFreeAlert from '../components/Onboarding/MarathonFreeAlert'
import { loadKurals, kuralOfDay, splitCoupletEn, type Kural } from '../lib/thirukural'
import CreditWall from '../components/UI/CreditWall'
import IconTile, { type Tint } from '../components/UI/IconTile'
import SectionHeader from '../components/UI/SectionHeader'
import MomentumPanel from '../components/Home/MomentumPanel'
import CaMagazineCarousel from '../components/Home/CaMagazineCarousel'
import DailyCaSheet from '../components/Home/DailyCaSheet'
import CurrentAffairsHubSheet from '../components/Home/CurrentAffairsHubSheet'
import { List, ListRow } from '../components/UI/ListRow'
import { CardGrid, GridCard } from '../components/UI/CardRow'
import { useAuth } from '../hooks/useAuth'
import { useStartTest } from '../hooks/useStartTest'
import { useTestSeriesEnabled } from '../hooks/useTestSeriesEnabled'
import { useRankBoosterEnabled } from '../hooks/useRankBoosterEnabled'
import { useVettriEnabled } from '../hooks/useVettriEnabled'
import { starterTestConfig } from '../lib/starterTest'
import { fetchHabit, type HabitState } from '../lib/habit'
import { SHOW_STREAK, SHOW_MOMENTUM, isHiddenBadge } from '../lib/features'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type Badge, type GameStats } from '../lib/achievements'
import { GROUP_SUBJECTS } from '../lib/constants'
import { useProgressStore } from '../store/progressStore'
import { useMomentumStore } from '../store/momentumStore'
import { useOnboardingStore } from '../store/onboardingStore'
import PushNudge from '../components/PushNudge'
import RewardOverlay from '../components/RewardOverlay'
import { toast } from '../store/toastStore'
import { tapScaleSubtle } from '../lib/motion'
import { api } from '../lib/api'
import type { GroupType } from '../types'
import { useT, type StringKey } from '../lib/i18n'

interface ArenaCard {
  to: string
  titleKey: StringKey
  subtitle: string
  icon: React.ReactNode
  tint: Tint
}

// Each category carries a tint for its IconTile (design-system.md §1). The
// first entry (Mock) is promoted to the single gradient hero; the rest render
// as cards. Every row uses the same icon idiom - a white Lucide glyph on a
// gradient tile - rather than mixing in the commissioned PNG illustrations
// used elsewhere (subject/topic pickers): on a dense set of small tiles the
// two styles read as two different apps stitched together.
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
    subtitle: 'Group 1 · Group 2 / 2A · Group 4',
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

// Live bank sizes, fetched once for the dashboard's practice cards (§ below).
// Keyed by the same ArenaCard.to so a card can look its own count up directly.
const COUNT_KEY: Record<string, 'subject' | 'pyq' | 'aptitude'> = {
  '/test-arena/subjects': 'subject',
  '/test-arena/pyq': 'pyq',
  '/test-arena/aptitude': 'aptitude',
}

/** Prefixes a live "N questions · " count onto a card's structural subtitle
 *  once it has loaded; falls back to the bare structural copy until then. */
function withCount(n: number | undefined, suffix: string, questionsWord: string): string {
  return n != null ? `${n} ${questionsWord} · ${suffix}` : suffix
}

export default function TestArenaPage() {
  const navigate = useNavigate()
  const startTest = useStartTest()
  const { user, profile, isAdmin, isSuperAdmin } = useAuth()
  const testSeriesOn = useTestSeriesEnabled()
  const rankBoosterOn = useRankBoosterEnabled()
  const vettriOn = useVettriEnabled()
  const { t, lang } = useT()
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [thirukuralOpen, setThirukuralOpen] = useState(false)
  const [dailyKural, setDailyKural] = useState<Kural | null>(null)
  // The Daily CA card opens its day picker as a popup rather than a screen.
  const [dailyCaOpen, setDailyCaOpen] = useState(false)
  // The consolidated Current Affairs card opens a picker over its three entry
  // points (Daily CA Test, month/topic practice, CA Questions) instead of each
  // getting its own dashboard card.
  const [caHubOpen, setCaHubOpen] = useState(false)

  // First-run sequence - shown ONLY to a freshly created account (signup arms
  // both flags; existing users never had them, admins skip the aspirant layer).
  // Order: the Starter Challenge prompt leads; the guided tour is HELD BACK
  // while the prompt is unanswered, so it fires when the user lands back here
  // after the test (or immediately if they skip the test).
  const onboardingPending = useOnboardingStore((s) => s.pending)
  const testPromptPending = useOnboardingStore((s) => s.testPrompt)
  const consumeTestPrompt = useOnboardingStore((s) => s.consumeTestPrompt)
  const marathonAlertPending = useOnboardingStore((s) => s.marathonAlert)
  const consumeMarathonAlert = useOnboardingStore((s) => s.consumeMarathonAlert)
  const onboardingOpen = useOnboardingStore((s) => s.open)
  const startOnboarding = useOnboardingStore((s) => s.start)
  const finishOnboarding = useOnboardingStore((s) => s.finish)
  useEffect(() => {
    if (!isAdmin && onboardingPending && !testPromptPending) startOnboarding()
  }, [isAdmin, onboardingPending, testPromptPending, startOnboarding])

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

  // Live bank sizes for the practice cards' subtitles (§ CARDS/withCount) -
  // purely decorative enrichment, so a failure here just leaves the structural
  // subtitles in place rather than surfacing an error.
  const [counts, setCounts] = useState<{ subject?: number; pyq?: number; aptitude?: number; current_affairs?: number }>(
    {}
  )
  useEffect(() => {
    if (isAdmin) return
    let cancelled = false
    // allSettled, not all: one slow/failed category shouldn't blank out the
    // other five cards' counts too.
    Promise.allSettled([
      api.countQuestions({ category: 'subject' }),
      api.countQuestions({ category: 'pyq' }),
      api.countQuestions({ category: 'pyq2' }),
      api.countQuestions({ category: 'pyq4' }),
      api.countQuestions({ category: 'aptitude' }),
      api.countQuestions({ category: 'current_affairs' }),
    ]).then((results) => {
      if (cancelled) return
      const [subject, pyq, pyq2, pyq4, aptitude, current_affairs] = results.map((r) =>
        r.status === 'fulfilled' ? r.value : undefined
      )
      setCounts({
        subject,
        pyq: pyq != null || pyq2 != null || pyq4 != null ? (pyq ?? 0) + (pyq2 ?? 0) + (pyq4 ?? 0) : undefined,
        aptitude,
        current_affairs,
      })
    })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const firstName = profile?.full_name?.split(' ')[0]
  const lvl = levelInfo(
    computeXp({
      totalCorrect: analytics?.overview.totalCorrect ?? 0,
      totalQuestions: analytics?.overview.totalQuestions ?? 0,
      testsTaken: analytics?.overview.testsTaken ?? 0,
    })
  )

  // One stat snapshot shared by the reward-baseline sync and the momentum
  // panel's badge counter, so both always agree.
  const stats: GameStats | null = useMemo(() => {
    if (!analytics || !habit) return null
    const group = (profile?.target_group as GroupType) || 'Group1'
    return {
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
  }, [analytics, habit, profile?.target_group])

  // Celebrate achievements the moment they're first seen here - including
  // streak badges, which unlock just by coming back a day later (no test run,
  // so the Result page never sees them). claim() seeds silently on a cold
  // store (never a backlog) and advances the shared baseline, so the Result
  // page and this popup can never both fire for the same unlock.
  const claimProgress = useProgressStore((s) => s.claim)
  const [rewards, setRewards] = useState<{ leveledTo: number | null; newBadges: Badge[] } | null>(
    null
  )
  useEffect(() => {
    if (!stats) return
    const all = computeBadges(stats).filter((b) => !isHiddenBadge(b.id))
    const res = claimProgress(all.filter((b) => b.unlocked).map((b) => b.id), lvl.level)
    if (res.newBadges.length || res.leveledTo != null) {
      setRewards({
        leveledTo: res.leveledTo,
        newBadges: all.filter((b) => res.newBadges.includes(b.id)),
      })
    }
  }, [stats, lvl.level, claimProgress])

  // The momentum panel shows once per sign-in: the auth store arms the flag on
  // every successful login/signup; we latch it at mount (so it stays for this
  // visit) and consume it only once the panel has really rendered - a failed
  // habit fetch keeps it pending for the next visit.
  const momentumPending = useMomentumStore((s) => s.pending)
  const consumeMomentum = useMomentumStore((s) => s.consume)
  const [showMomentum] = useState(momentumPending)
  useEffect(() => {
    // Only spend the once-per-sign-in flag when the panel actually rendered —
    // while it's hidden the visit stays "unshown", so re-enabling behaves as if
    // the panel had never been skipped.
    if (SHOW_MOMENTUM && showMomentum && habit && stats && !isAdmin) consumeMomentum()
  }, [showMomentum, habit, stats, isAdmin, consumeMomentum])

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

  // The first-test funnel: launches the Starter Challenge (a fixed hard mixed
  // paper). Reached from the tour's final step and — until the user has one
  // completed test — from the dashboard hero card below.
  const launchStarterTest = () => startTest(starterTestConfig())
  const showFirstTestHero = analytics !== null && analytics.overview.testsTaken === 0

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 lg:py-8">
        {/* Greeting - bare on the surface. Hierarchy from type + space, no box. */}
        <header className="px-1">
          <p className="tamil font-body text-sm text-muted">{t(greetingKey())}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink">
              {firstName || 'Aspirant'}
            </h1>
            {showStreak && (
              <span className="inline-flex items-center gap-1 font-display text-base font-semibold text-accent">
                <Flame size={15} /> {habit!.currentStreak}
                <span className="tamil font-body text-sm font-normal text-muted">
                  {t('dayStreak')}
                </span>
              </span>
            )}
          </div>
          {SHOW_MOMENTUM && showMomentum && habit && stats && (
            <MomentumPanel habit={habit} lvl={lvl} stats={stats} />
          )}
          {/* Kural of the day - the actual couplet, rotating daily. Tapping it
              opens the box straight at this kural's full detail. */}
          {dailyKural && (
            <button
              onClick={() => setThirukuralOpen(true)}
              className="focus-ring group mt-4 block w-full rounded-card border border-line bg-tint-violet/40 p-4 text-left transition-colors hover:bg-tint-violet/60"
            >
              <span className="flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
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
                <p className="mt-1 font-body text-xs italic leading-relaxed text-muted sm:text-sm">
                  {dailyKural.transliteration}
                </p>
              ) : (
                // English meaning as a two-line couplet, mirroring the Tamil.
                <p className="mt-1.5 font-body text-xs not-italic leading-relaxed text-muted sm:text-sm">
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

        {/* Daily Current-Affairs magazines - the last 7 published issues, swiped
            horizontally. Sits directly under the kural: the day's reading is the
            reason most aspirants open the app, so it never waits below a fold.
            Publication-driven (superadmin-approved); renders nothing until at
            least one daily issue is live. */}
        <CaMagazineCarousel />

        {/* First-test funnel - shown only while the account has ZERO completed
            tests, then gone forever. Leads the page so a brand-new aspirant has
            exactly one obvious next action: the Starter Challenge. */}
        {showFirstTestHero && (
          <section className="rounded-card border border-primary/30 bg-tint-violet/50 p-5">
            <span className="inline-flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
              <Sparkles size={13} />
              <span className="tamil">{t('firstTestBadge')}</span>
            </span>
            <h2 className="tamil mt-2 font-display text-lg font-bold leading-tight tracking-tight text-ink">
              {t('firstTestHeroTitle')}
            </h2>
            <p className="tamil mt-1 font-body text-sm leading-relaxed text-muted">
              {t('firstTestHeroSub')}
            </p>
            <button onClick={launchStarterTest} className="btn-gold mt-4 w-full py-2.5 text-sm">
              {t('firstTestHeroCta')} <ChevronRight size={16} />
            </button>
          </section>
        )}

        {/* Test Marathon + Rank Booster discovery banners removed from the
            dashboard - they were competing with the main Hero/practice list for
            attention right up front. Both products stay discoverable via the
            Vettri Nichayam / Test Marathon cards in the Practice list below,
            plus the plans nudge on the Profile page. */}

        {/* One-time web-push opt-in nudge (browsers only — the Android WebView
            has no Push API so it never renders there). Held back while the
            first-run sequence (starter-test prompt / guided tour) is active. */}
        <PushNudge holdBack={testPromptPending || onboardingPending || onboardingOpen} />

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

        {/* Practice - a two-column grid of icon-top cards (GridCard), matching
            the app's original card language rather than a wide-row "tile".
            Every card uses the same white-glyph-on-gradient IconTile - one icon
            idiom instead of mixing in the PNG illustrations used on the
            subject/topic pickers. */}
        <section className="space-y-2" data-tour="practice">
          <SectionHeader title={t('practice')} className="px-1" />
          <CardGrid>
            {/* Current Affairs - leads the section: it's the one card that
                changes every morning, and it pairs with the magazine strip
                above. This single card replaces what used to be three separate
                cards (Daily CA Test / Current Affairs / CA Questions) - the
                picker sheet keeps all three actions, just no longer competing
                for a slot each on the dashboard. */}
            <GridCard
              onClick={() => setCaHubOpen(true)}
              style={{ '--i': 0 } as React.CSSProperties}
              icon={<Newspaper size={20} />}
              tint="green"
              title={t('currentAffairsTitle')}
              subtitle={t('currentAffairsHubSub')}
            />
            {/* Vettri Nichayam bundle. */}
            {vettriOn && (
              <GridCard
                onClick={() => navigate('/vettri')}
                style={{ '--i': 1 } as React.CSSProperties}
                icon={<Trophy size={20} />}
                tint="coral"
                title={t('vettriTitle')}
                subtitle={t('vettriArenaSub')}
              />
            )}
            {/* Test Marathon - the scheduled test-series hub (Vettri Nichayam +
                Rank Booster tabs inside). Shows once EITHER product is
                enabled, so the card is never a dead end. */}
            {(testSeriesOn || rankBoosterOn) && (
              <GridCard
                onClick={() => navigate('/test-series')}
                style={{ '--i': 2 } as React.CSSProperties}
                icon={<CalendarDays size={20} />}
                tint="coral"
                title={t('testSeriesTitle')}
                subtitle={t('testSeriesArenaSub')}
              />
            )}
            {restCards
              .filter((card) => card.to !== '/test-arena/current-affairs')
              .map((card, i) => (
                <GridCard
                  key={card.to}
                  onClick={() => navigate(card.to)}
                  style={{ '--i': i + 3 } as React.CSSProperties}
                  icon={card.icon}
                  tint={card.tint}
                  title={t(card.titleKey)}
                  subtitle={withCount(counts[COUNT_KEY[card.to]], card.subtitle, t('questionsCount'))}
                  badge={
                    card.to === '/test-arena/subjects' && stats ? (
                      <span className="rounded-full bg-tint-violet px-2 py-0.5 font-heading text-2xs font-bold tabular-nums text-primary">
                        {stats.subjects}/{stats.totalSubjects}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            {/* Thirukkural quiz - a self-contained bilingual practice bank. */}
            <GridCard
              onClick={() => navigate('/test-arena/thirukural')}
              style={{ '--i': restCards.length + 2 } as React.CSSProperties}
              icon={<ScrollText size={20} />}
              tint="green"
              title={t('tkQuizTitle')}
              subtitle={t('tkQuizSub')}
            />
          </CardGrid>
        </section>

        {/* Payment banner - deliberately NOT permanent. It appears only when the
            credit balance actually blocks practice: a quiet strip while running
            low, the full Vettri + Premium cards once the balance hits zero.
            Plans stay discoverable meanwhile via the Vettri card above and the
            Profile screen. */}
        <CreditWall />

        {/* Keep going - study-loop quick links, matching the practice cards. */}
        <section className="space-y-2" data-tour="progress">
          <SectionHeader title={t('keepGoingShort')} className="px-1" />
          <CardGrid>
            <GridCard
              onClick={() => navigate('/revision')}
              icon={<RefreshCw size={20} />}
              tint="violet"
              title={t('revision')}
            />
            <GridCard
              onClick={() => navigate('/insights')}
              style={{ '--i': 1 } as React.CSSProperties}
              icon={<BarChart3 size={20} />}
              tint="blue"
              title={t('insights')}
            />
          </CardGrid>
        </section>
      </div>

      {/* The Daily CA day picker - today's paper + every earlier published day. */}
      <DailyCaSheet open={dailyCaOpen} onClose={() => setDailyCaOpen(false)} />

      {/* The consolidated Current Affairs picker - Daily CA Test / month & topic
          practice / CA Questions, opened from the single dashboard card above. */}
      <CurrentAffairsHubSheet
        open={caHubOpen}
        onClose={() => setCaHubOpen(false)}
        onOpenDaily={() => setDailyCaOpen(true)}
        topicPracticeCount={counts.current_affairs}
      />

      <ThirukuralModal
        open={thirukuralOpen}
        onClose={() => setThirukuralOpen(false)}
        initialKuralNo={dailyKural?.kural_no}
      />

      {rewards && (
        <RewardOverlay
          leveledTo={rewards.leveledTo}
          newBadges={rewards.newBadges}
          onClose={() => setRewards(null)}
        />
      )}

      {/* First login: the Starter Challenge prompt comes BEFORE the tour. Both
          buttons consume the prompt; the tour effect above then takes over -
          straight away on skip, or on the return to this dashboard after the
          test. The tour's final-step CTA only re-offers the test when it is
          still untaken (showFirstTestHero mirrors testsTaken === 0). */}
      {!isAdmin && testPromptPending && (
        <StarterTestPrompt
          onStart={() => {
            consumeTestPrompt()
            launchStarterTest()
          }}
          onSkip={consumeTestPrompt}
        />
      )}

      {/* New-signup promo: "Test Marathon Test 1 is FREE". Fires only after the
          starter prompt AND the tour have fully resolved (never stacks), and
          only while the Marathon feature is switched on. Shown once ever. */}
      {!isAdmin &&
        marathonAlertPending &&
        !testPromptPending &&
        !onboardingPending &&
        !onboardingOpen &&
        testSeriesOn && (
          <MarathonFreeAlert
            onTake={() => {
              consumeMarathonAlert()
              navigate('/test-series')
            }}
            onDismiss={consumeMarathonAlert}
          />
        )}

      <OnboardingTour
        open={onboardingOpen}
        onFinish={finishOnboarding}
        onStartTest={showFirstTestHero ? launchStarterTest : undefined}
      />
    </>
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

/** Time-of-day greeting key - a small warmth cue over a static "Welcome back".
 * Local device time is correct here (the audience is IST anyway). */
function greetingKey(): StringKey {
  const h = new Date().getHours()
  if (h < 12) return 'goodMorning'
  if (h < 17) return 'goodAfternoon'
  return 'goodEvening'
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
    <>
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 lg:py-8">
        {/* Admin greeting - bare, role-aware, no gamification, no gradient panel. */}
        <header className="px-1">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-accent">
            <ShieldCheck size={14} /> {isSuperAdmin ? t('superadmin') : t('admin')}
          </span>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight text-ink">
            {name || (isSuperAdmin ? 'Super Admin' : 'Admin')}
          </h1>
          <p className="mt-1 font-body text-base text-muted">{t('adminHomeSub')}</p>
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
          <p className="px-1 font-body text-sm text-muted">{t('pickCategoryAdmin')}</p>
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
    </>
  )
}
