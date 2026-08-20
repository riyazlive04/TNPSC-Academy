import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  LogOut,
  User,
  ShieldCheck,
  ClipboardCheck,
  ListChecks,
  Crosshair,
  Trophy,
  Clock,
  Award,
  Globe,
  Smartphone,
  Bookmark,
  ChevronRight,
  Pencil,
  Check,
  Compass,
  Coins,
  Target,
  CalendarDays,
  Bell,
  BellOff,
  Library,
  Shield,
} from 'lucide-react'
import Avatar from '../components/UI/Avatar'
import PasswordInput from '../components/UI/PasswordInput'
import PremiumCard from '../components/UI/PremiumCard'
import VettriCard from '../components/UI/VettriCard'
import RankBoosterCard from '../components/UI/RankBoosterCard'
import StackedCards from '../components/UI/StackedCards'
import ProfileVideos from '../components/Profile/ProfileVideos'
import AccountSection from '../components/Profile/AccountSection'
import { Skeleton, SkeletonStatGrid } from '../components/UI/Skeleton'
import { toast } from '../store/toastStore'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { fetchHabit, type HabitState } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type GameStats } from '../lib/achievements'
import { isHiddenBadge } from '../lib/features'
import { GROUP_SUBJECTS } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useHasMaterials } from '../hooks/useHasMaterials'
import { useAuthStore } from '../store/authStore'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { useCreditsStore } from '../store/creditsStore'
import { api, type DeviceSession } from '../lib/api'
import { isPushSupported, pushPermission, isPushSubscribed, enablePush, disablePush } from '../lib/push'
import { useT, type StringKey } from '../lib/i18n'

// Each language is shown in its OWN script (English in English, Tamil in Tamil)
// regardless of the active UI language - the standard language-picker pattern.
const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'both', label: 'English + தமிழ்' },
]

// Stored values stay 'male' | 'female' | 'other' (consistent with the signup /
// complete-profile forms); 'other' is surfaced as "Do not prefer" via i18n.
const GENDER_OPTIONS: { id: string; labelKey: StringKey }[] = [
  { id: 'male', labelKey: 'genderMale' },
  { id: 'female', labelKey: 'genderFemale' },
  { id: 'other', labelKey: 'genderOther' },
]

// Daily-question goal presets (habit layer). A custom value set elsewhere still
// shows up as its own active chip so it is never silently lost.
const GOAL_OPTIONS = [10, 20, 30, 50, 100]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin, signOut } = useAuth()
  const hasMaterials = useHasMaterials()
  const { t } = useT()
  const lang = useLanguageStore((s) => s.lang) ?? 'en'
  const setLang = useLanguageStore((s) => s.setLang)

  // Replay the first-run welcome tour. The tour modal lives on the dashboard, so
  // open it in the store and navigate there to show it.
  const replayTour = useOnboardingStore((s) => s.replay)
  const startTour = () => {
    replayTour()
    navigate('/test-arena')
  }

  // Change the account's language preference: update the UI instantly (local
  // store) and persist to the profile (best-effort - survives across devices).
  const changeLanguage = (next: Lang) => {
    if (next === lang) return
    setLang(next)
    api.updateProfile({ language: next }).catch(() => {})
  }

  // Gender - editable here. Optimistic chip highlight, persisted to the profile
  // and synced back into the auth store (best-effort; reverts on failure).
  const refreshProfile = useAuthStore((s) => s.fetchProfile)
  const [genderSel, setGenderSel] = useState(profile?.gender ?? '')
  useEffect(() => {
    setGenderSel(profile?.gender ?? '')
  }, [profile?.gender])
  const changeGender = (next: string) => {
    if (next === genderSel) return
    const prev = genderSel
    setGenderSel(next)
    api
      .updateProfile({ gender: next })
      .then(() => refreshProfile())
      .catch(() => {
        setGenderSel(prev)
        toast.error(t('genderSaveFailed'))
      })
  }

  // Daily-question goal + exam date - the "goals" half of the habit layer. Same
  // optimistic pattern as gender: save immediately, revert + toast on failure.
  const [goalSel, setGoalSel] = useState<number>(profile?.daily_goal ?? 20)
  useEffect(() => {
    setGoalSel(profile?.daily_goal ?? 20)
  }, [profile?.daily_goal])
  const changeGoal = (next: number) => {
    if (next === goalSel) return
    const prev = goalSel
    setGoalSel(next)
    api
      .updateProfile({ daily_goal: next })
      .then(() => refreshProfile())
      .catch(() => {
        setGoalSel(prev)
        toast.error(t('saveFailed'))
      })
  }
  const [examSel, setExamSel] = useState<string>(profile?.exam_date ?? '')
  useEffect(() => {
    setExamSel(profile?.exam_date ?? '')
  }, [profile?.exam_date])
  const changeExamDate = (next: string) => {
    if (next === examSel) return
    const prev = examSel
    setExamSel(next)
    api
      .updateProfile({ exam_date: next || null })
      .then(() => refreshProfile())
      .catch(() => {
        setExamSel(prev)
        toast.error(t('saveFailed'))
      })
  }
  const goalChips = GOAL_OPTIONS.includes(goalSel)
    ? GOAL_OPTIONS
    : [...GOAL_OPTIONS, goalSel].sort((a, b) => a - b)

  // Account details start read-only; the pencil toggles inline editing of the
  // gender + language chips. Selections still save immediately while editing.
  const [editing, setEditing] = useState(false)
  const genderLabel = genderSel
    ? t(GENDER_OPTIONS.find((o) => o.id === genderSel)?.labelKey ?? 'genderOther')
    : t('notSet')
  const languageLabel = LANG_OPTIONS.find((o) => o.id === lang)?.label ?? 'English'

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
      .catch(() => {
        // Stats failed to load - the page still renders with safe zero defaults
        // (see the GameStats fallbacks below); surface the failure quietly.
        if (!cancelled) toast.error(t('couldNotLoad'))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user, profile?.daily_goal, profile?.exam_date, t])

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

  const lvl = levelInfo(
    computeXp({ totalCorrect: stats.correct, totalQuestions: stats.questions, testsTaken: stats.tests })
  )
  const badges = computeBadges(stats).filter((b) => !isHiddenBadge(b.id))
  const earned = badges.filter((b) => b.unlocked).length

  const name = profile?.full_name || t('aspirant')
  const initial = name.trim().charAt(0).toUpperCase() || 'A'
  const roleLabel = isSuperAdmin ? t('superadmin') : isAdmin ? t('admin') : t('aspirant')

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Daily credit balance - surfaced as a compact pill in the integrated top
  // dashboard; the full explanation + low-balance warning stays in CreditsCard
  // (Profile tab) so this stays a glance, not a duplicate of that card.
  const creditsLoaded = useCreditsStore((s) => s.loaded)
  const creditsUnlimited = useCreditsStore((s) => s.unlimited)
  const creditsBalance = useCreditsStore((s) => s.balance)
  const creditsLow = creditsBalance < 10

  const [tab, setTab] = useState<'profile' | 'security'>('profile')

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        {loading ? (
          // Identity header, then the integrated dashboard - the two blocks that land.
          <div className="space-y-5">
            <Skeleton className="h-28 w-full rounded-card" />
            <SkeletonStatGrid count={6} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identity header */}
            <div className="hero-panel relative flex items-center gap-4 p-6 animate-slideDown">
              <div
                className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
                style={{ backgroundSize: '18px 18px' }}
              />
              <Avatar
                src={profile?.avatar_url}
                name={name}
                className="relative grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl bg-white/15 font-heading text-2xl font-bold text-white ring-1 ring-white/20"
              >
                {initial}
              </Avatar>
              <div className="relative min-w-0 flex-1">
                <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-white">
                  {name}
                </h1>
                <p className="truncate font-body text-sm text-white/70">{profile?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-heading text-2xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/20">
                  <ShieldCheck size={12} /> {roleLabel}
                </span>
              </div>
            </div>

            {/* Integrated dashboard - level/XP progress, daily credit balance and
                the three headline test stats (accuracy, questions, time) all in
                one glanceable block. The rest of the stat breakdown, plus the
                full credit explanation, live one tab down. */}
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <LevelRing level={lvl.level} pct={lvl.pct} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-heading text-lg font-semibold tracking-tight text-ink">
                      {t('level')} {lvl.level}
                    </div>
                    {creditsLoaded && !creditsUnlimited && (
                      <span
                        title={t('creditsTitle')}
                        className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-heading text-xs font-bold tabular-nums ${
                          creditsLow ? 'bg-coralsoft text-coral' : 'bg-brand-soft text-brand-dark'
                        }`}
                      >
                        <Coins size={12} /> {creditsBalance}
                      </span>
                    )}
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
                    <div className="mt-1.5 font-body text-2xs text-ink2">
                      {lvl.into} / {lvl.span} {t('xp')} · {lvl.toNext} {t('toNextLevel')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
                <MiniStat icon={<Crosshair size={16} />} value={`${Math.round(stats.avgAccuracy)}%`} labelKey="avgAccuracy" />
                <MiniStat icon={<ListChecks size={16} />} value={String(stats.questions)} labelKey="totalQuestions" />
                <MiniStat icon={<Clock size={16} />} value={`${stats.minutes}m`} labelKey="timeSpent" />
              </div>
            </div>

            {/* Plans nudge - stacked on scroll (StackedCards), shown up front
                (not tucked behind a tab) so it still surfaces the upgrade path.
                Vettri (₹899 / ₹499 monthly) leads as the cheaper entry and
                hides itself once any paid plan is owned; Group II/IIA - Rank
                Booster (₹1,249 Independence Day offer/90 days) is its own
                standalone plan - NOT included by Vettri, so it stays visible
                to Vettri owners too (self-gates only on
                rankBoosterUnlocked/Premium); Premium (₹1,699, 6 months)
                follows - Profile is the ONE place a Vettri owner still sees
                the Premium upgrade path. Every card self-hides for
                isAdmin/isSuperAdmin, so this is a no-op for staff accounts. */}
            <StackedCards>
              <VettriCard />
              <RankBoosterCard />
              <PremiumCard showForVettri />
            </StackedCards>

            {/* Section tabs - the rest reorganised into two focused tabs
                instead of one long scroll: account/gamification detail, and
                every security/account control. */}
            <div className="seg-wrap w-full">
              <button
                onClick={() => setTab('profile')}
                className={[
                  'seg flex flex-1 items-center justify-center gap-1.5',
                  tab === 'profile' ? 'seg-active' : '',
                ].join(' ')}
              >
                <User size={14} /> {t('profile')}
              </button>
              <button
                onClick={() => setTab('security')}
                className={[
                  'seg flex flex-1 items-center justify-center gap-1.5',
                  tab === 'security' ? 'seg-active' : '',
                ].join(' ')}
              >
                <Shield size={14} /> {t('securityTab')}
              </button>
            </div>

            {tab === 'profile' && (
              <div className="animate-fadeIn space-y-5">
                {/* Account details */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-heading text-base font-semibold tracking-tight text-ink">
                      {t('accountDetails')}
                    </h2>
                    {/* Pencil toggles inline editing of gender + language. */}
                    <button
                      onClick={() => setEditing((v) => !v)}
                      aria-pressed={editing}
                      aria-label={editing ? t('done') : t('edit')}
                      title={editing ? t('done') : t('edit')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-heading text-xs font-semibold text-ink2 transition hover:border-brand hover:text-brand"
                    >
                      {editing ? <Check size={14} /> : <Pencil size={14} />}
                      {editing ? t('done') : t('edit')}
                    </button>
                  </div>
                  <div className="card divide-y divide-line">
                    {/* Gender - read-only value by default; chips appear (right-aligned)
                        in edit mode and save on selection. */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <User size={16} />
                      </span>
                      <span className="tamil font-body text-sm text-ink2">{t('gender')}</span>
                      {editing ? (
                        <div className="ml-auto flex flex-wrap justify-end gap-2" role="group" aria-label={t('gender')}>
                          {GENDER_OPTIONS.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => changeGender(o.id)}
                              aria-pressed={genderSel === o.id}
                              className={genderSel === o.id ? 'chip chip-active' : 'chip'}
                            >
                              {t(o.labelKey)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="tamil ml-auto truncate text-right font-heading text-sm font-semibold text-ink">
                          {genderLabel}
                        </span>
                      )}
                    </div>
                    {profile?.phone && (
                      <DetailRow icon={<ShieldCheck size={16} />} label={t('phone')} value={profile.phone} />
                    )}
                    {/* Language preference - read-only value by default; chips appear
                        (right-aligned) in edit mode. Each language shown in its own script. */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Globe size={16} />
                      </span>
                      <span className="tamil font-body text-sm text-ink2">{t('language')}</span>
                      {editing ? (
                        <div className="ml-auto flex flex-wrap justify-end gap-2" role="group" aria-label={t('language')}>
                          {LANG_OPTIONS.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => changeLanguage(o.id)}
                              aria-pressed={lang === o.id}
                              className={lang === o.id ? 'chip chip-active' : 'chip'}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="ml-auto truncate text-right font-heading text-sm font-semibold text-ink">
                          {languageLabel}
                        </span>
                      )}
                    </div>
                    {/* Daily question goal - preset chips in edit mode; powers the
                        dashboard goal progress + goal-met state. */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Target size={16} />
                      </span>
                      <span className="tamil font-body text-sm text-ink2">{t('dailyGoalQ')}</span>
                      {editing ? (
                        <div className="ml-auto flex flex-wrap justify-end gap-2" role="group" aria-label={t('dailyGoalQ')}>
                          {goalChips.map((n) => (
                            <button
                              key={n}
                              onClick={() => changeGoal(n)}
                              aria-pressed={goalSel === n}
                              className={goalSel === n ? 'chip chip-active' : 'chip'}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="ml-auto truncate text-right font-heading text-sm font-semibold text-ink">
                          {goalSel}
                        </span>
                      )}
                    </div>
                    {/* Exam date - powers the days-to-exam countdown. */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <CalendarDays size={16} />
                      </span>
                      <span className="tamil font-body text-sm text-ink2">{t('examDate')}</span>
                      {editing ? (
                        <input
                          type="date"
                          value={examSel}
                          onChange={(e) => changeExamDate(e.target.value)}
                          aria-label={t('examDate')}
                          className="input-soft ml-auto w-44 px-3 py-1.5 text-sm"
                        />
                      ) : (
                        <span className="tamil ml-auto truncate text-right font-heading text-sm font-semibold text-ink">
                          {examSel ? new Date(examSel + 'T00:00:00').toLocaleDateString() : t('notSet')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* More stats - the rest of the breakdown beyond the dashboard's
                    headline trio above. */}
                <div>
                  <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                    {t('moreStats')}
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard i={0} icon={<ClipboardCheck size={18} />} value={String(stats.tests)} labelKey="testsTaken" />
                    <StatCard i={1} icon={<Trophy size={18} />} value={String(stats.bestScore)} labelKey="bestScore" />
                    <StatCard i={2} icon={<Award size={18} />} value={`${earned}/${badges.length}`} labelKey="achievements" />
                  </div>
                </div>

                {/* Credit balance detail - how credits work + low-balance warning.
                    The dashboard above only shows the number. Free learners only;
                    hidden for unlimited (paid/staff). */}
                <CreditsCard />

                {/* Quick links - auxiliary navigation, gathered into one list
                    menu instead of three separate floating buttons. */}
                <div>
                  <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                    {t('quickLinks')}
                  </h2>
                  <div className="card divide-y divide-line overflow-hidden">
                    <NavRow onClick={() => navigate('/bookmarks')} icon={<Bookmark size={16} />} label={t('questionBank')} />
                    {/* Materials - moved off the mobile bottom bar (see AppLayout's
                        MOBILE_LEARNER_NAV) to keep that at 5 tabs; same hasMaterials
                        gate so this never shows an empty hub. */}
                    {hasMaterials && (
                      <NavRow onClick={() => navigate('/materials')} icon={<Library size={16} />} label={t('materials')} />
                    )}
                    {/* How it works - replay the first-run welcome tour.
                        Aspirant-only (admins don't use the onboarding/gamification
                        layer). */}
                    {!isAdmin && (
                      <NavRow
                        onClick={startTour}
                        icon={<Compass size={16} />}
                        label={t('howItWorks')}
                        sub={t('howItWorksSub')}
                      />
                    )}
                  </div>
                </div>

                {/* Video lessons - superadmin-assigned videos (placement='profile').
                    Renders nothing until videos are added. */}
                <ProfileVideos />
              </div>
            )}

            {tab === 'security' && (
              <div className="animate-fadeIn space-y-5">
                {/* Notifications - the persistent enable/disable control for Web Push
                    on this device (the bell/nudge only turn it on). */}
                <NotificationsSection />

                {/* Devices - manage the 2-device limit (sign out a lost/old device) */}
                <DevicesSection />

                {/* Security - TOTP two-factor authentication (admin/superadmin only;
                    renders nothing for an ordinary account). */}
                <SecuritySection />

                {/* Account - Restore purchases (native) + Delete account. Both are
                    store requirements: Apple 5.1.1(v) and Play's User Data policy
                    make in-app account deletion mandatory, and Apple expects a
                    restore path in any app that sells through the store. */}
                <AccountSection />

                {/* Sign out */}
                <button onClick={handleSignOut} className="btn-ghost w-full">
                  <LogOut size={16} /> {t('signOut')}
                </button>
              </div>
            )}

            <AppFooter />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Credit balance card for free learners: the current balance and how credits
 * work (10 per test, +10 daily), with a low-balance warning that points to the
 * paid plans. This is the surface the header credit pill deep-links to. Hidden
 * for unlimited (paid/staff) users and until the balance has loaded.
 */
function CreditsCard() {
  const { t } = useT()
  const loaded = useCreditsStore((s) => s.loaded)
  const unlimited = useCreditsStore((s) => s.unlimited)
  const balance = useCreditsStore((s) => s.balance)
  if (!loaded || unlimited) return null
  const low = balance < 10
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${
              low ? 'bg-coralsoft text-coral' : 'bg-brand-soft text-brand-dark'
            }`}
          >
            <Coins size={20} />
          </span>
          <h2 className="tamil font-heading text-base font-semibold tracking-tight text-ink">
            {t('creditsTitle')}
          </h2>
        </div>
        <span
          className={`font-display text-2xl font-bold tabular-nums tracking-tight ${
            low ? 'text-coral' : 'text-ink'
          }`}
        >
          {balance}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 font-body text-sm text-ink2">
        <li className="tamil flex items-start gap-2">
          <Check size={15} className="mt-0.5 flex-shrink-0 text-brand" />
          <span>{t('creditsPerTest')}</span>
        </li>
        <li className="tamil flex items-start gap-2">
          <Check size={15} className="mt-0.5 flex-shrink-0 text-brand" />
          <span>{t('creditsDaily')}</span>
        </li>
      </ul>
      {low && (
        <p className="tamil mt-3 rounded-field bg-coralsoft px-3 py-2.5 font-body text-xs leading-snug text-coral">
          {t('outOfCredits')}
        </p>
      )}
    </div>
  )
}

// App version - bump on release (kept in one place so the footer always matches).
const APP_VERSION = '1.0.0'

/**
 * Profile footer: brand mark, developer credit, support + legal links, version
 * and copyright. The single place the app advertises who built it.
 */
function AppFooter() {
  const { t } = useT()
  const year = new Date().getFullYear()
  return (
    <footer className="mt-2 flex flex-col items-center gap-3 border-t border-line pb-2 pt-6 text-center">
      <div className="flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
        <span className="font-display text-sm font-semibold tracking-tight text-ink">
          TNPSC <span className="text-primary">Mentors</span>
        </span>
      </div>

      <p className="tamil font-body text-sm text-muted">
        {t('developedBy')}{' '}
        <a
          href="https://sirahdigital.in"
          target="_blank"
          rel="noreferrer"
          className="font-display font-semibold text-accent transition-opacity hover:opacity-80"
        >
          Sirah Digital
        </a>
      </p>

      {/* Policy links point at THIS app's own pages, not sirahdigital.in. Those
          external URLs were the ones a store reviewer would open from the
          listing, and they are not the policies that actually govern this app —
          the routes below are (see PolicyPage). In-app <Link> also keeps a
          reviewer inside the app instead of bouncing them to a browser. */}
      <div className="tamil flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-xs text-muted">
        <a
          href="mailto:support@sirahdigital.in"
          className="transition-colors hover:text-ink"
        >
          {t('contactSupport')}
        </a>
        <span className="text-muted/40">·</span>
        <Link to="/privacy" className="transition-colors hover:text-ink">
          {t('privacyPolicy')}
        </Link>
        <span className="text-muted/40">·</span>
        <Link to="/guidelines" className="transition-colors hover:text-ink">
          {t('termsOfUse')}
        </Link>
        <span className="text-muted/40">·</span>
        <Link to="/refund-policy" className="transition-colors hover:text-ink">
          {t('refundPolicyLink')}
        </Link>
      </div>

      {/* Independence notice — Play Impersonation / Apple 5.2. */}
      <p className="tamil max-w-sm font-body text-2xs leading-relaxed text-muted/70">
        {t('notAffiliated')}
      </p>

      <p className="tamil font-body text-2xs text-muted/70">
        Version {APP_VERSION} · © {year} Sirah Digital. {t('allRightsReserved')}
      </p>
    </footer>
  )
}

/** Compact relative time for "last active" (e.g. "5m ago", "2d ago"). The unit
 *  letters stay universal; only "just now" / "ago" are translated. */
function relTime(iso: string, t: (k: StringKey) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('relJustNow')
  const ago = t('relAgo')
  if (m < 60) return `${m}m ${ago}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${ago}`
  return `${Math.floor(h / 24)}d ${ago}`
}

/**
 * Enable/disable Web Push on THIS device — the persistent settings control that
 * used to live only as a one-shot opt-in row in the bell dropdown. Renders
 * nothing where Web Push can't work (e.g. the Android WebView app, which has no
 * Push API — so no dead toggle for those users). When the OS permission is
 * 'denied' the toggle is shown disabled with a note, since the browser blocks
 * re-prompting. Otherwise the switch subscribes (enablePush) / unsubscribes
 * (disablePush) this browser.
 */
function NotificationsSection() {
  const { t } = useT()
  const supported = isPushSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    setPermission(pushPermission())
    isPushSubscribed()
      .then((s) => !cancelled && setSubscribed(s))
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [supported])

  if (!supported) return null

  const blocked = permission === 'denied'
  const on = subscribed && permission === 'granted'

  const toggle = async () => {
    if (busy || blocked) return
    setBusy(true)
    try {
      if (on) {
        await disablePush()
        setSubscribed(false)
        toast.success(t('pushDisabled'))
      } else {
        const result = await enablePush()
        setPermission(pushPermission())
        if (result === 'subscribed') {
          setSubscribed(true)
          toast.success(t('pushEnabled'))
        } else if (result === 'denied') toast.error(t('pushDenied'))
        else if (result === 'unconfigured') toast.info(t('pushUnavailable'))
        else toast.error(t('pushFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${
            on ? 'bg-brand-soft text-brand' : 'bg-tint text-ink2'
          }`}
        >
          {on ? <Bell size={18} /> : <BellOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="tamil font-heading text-base font-semibold text-ink">
            {t('pushSettingTitle')}
          </h3>
          <p className="tamil font-body text-xs text-ink2">{t('pushSettingSub')}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={t('pushSettingTitle')}
          disabled={busy || blocked || !ready}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus-ring ${
            on ? 'bg-brand' : 'bg-line'
          }`}
        >
          <span
            className={`grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-transform ${
              on ? 'translate-x-6' : 'translate-x-1'
            }`}
          >
            {busy && <Loader2 size={12} className="animate-spin text-ink2" />}
          </span>
        </button>
      </div>
      {blocked ? (
        <p className="tamil mt-3 rounded-field bg-coralsoft px-3 py-2.5 font-body text-xs leading-snug text-coral">
          {t('pushSettingBlocked')}
        </p>
      ) : (
        <p className="tamil mt-3 font-body text-xs font-semibold text-ink2">
          {on ? t('pushSettingOn') : t('pushSettingOff')}
        </p>
      )}
    </div>
  )
}

/**
 * Manage the account's active device sessions (the 2-device limit). Lists each
 * active device, marks the current one, and lets the user sign out the others -
 * the self-service escape hatch if a lost/old device is holding a slot.
 */
function DevicesSection() {
  const { t } = useT()
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.auth
      .listSessions()
      .then((r) => !cancelled && setSessions(r.sessions))
      .catch(() => !cancelled && setSessions([]))
    return () => {
      cancelled = true
    }
  }, [])

  const revoke = async (id: string) => {
    setRevoking(id)
    try {
      await api.auth.revokeSession(id)
      setSessions((s) => (s ?? []).filter((x) => x.id !== id))
      toast.success(t('devicesSignedOut'))
    } catch {
      /* ignore - list will reconcile on next load */
    } finally {
      setRevoking(null)
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current)

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Smartphone size={18} className="text-brand" />
        <h3 className="font-heading text-base font-semibold text-ink">{t('devicesTitle')}</h3>
      </div>
      <p className="tamil mb-4 font-body text-sm text-ink2">{t('devicesSub')}</p>

      {sessions === null ? (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-brand" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const current = !!s.current
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-field border border-line bg-canvas px-3.5 py-3"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Smartphone size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">
                    {s.label || t('devicesUnknown')}
                    {current && (
                      <span className="tamil ml-2 rounded-full bg-mintsoft px-2 py-0.5 align-middle text-2xs font-bold uppercase tracking-wide text-mint">
                        {t('devicesThis')}
                      </span>
                    )}
                  </p>
                  <p className="tamil font-body text-xs text-ink2">
                    {t('devicesLastActive')}: {relTime(s.last_seen_at, t)}
                  </p>
                </div>
                {!current && (
                  <button
                    onClick={() => revoke(s.id)}
                    disabled={revoking === s.id}
                    className="btn-ghost btn-sm flex-shrink-0"
                  >
                    {revoking === s.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      t('devicesSignOut')
                    )}
                  </button>
                )}
              </li>
            )
          })}
          {others.length === 0 && (
            <p className="tamil py-1 text-center font-body text-xs text-ink2">{t('devicesEmpty')}</p>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * TOTP two-factor authentication (admin/superadmin only — renders nothing for
 * an ordinary account). Enroll shows a QR + manual key, confirming the first
 * code activates it and reveals one-time backup codes; turning it off requires
 * re-proving ownership with the current password or an unused backup code.
 */
function SecuritySection() {
  const { t } = useT()
  const { profile, isAdmin, isSuperAdmin, totpEnroll, totpConfirm, totpDisable } = useAuth()
  const [step, setStep] = useState<'idle' | 'enroll' | 'backup' | 'disable'>('idle')
  const [enrollment, setEnrollment] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState('')
  const [disableBackupCode, setDisableBackupCode] = useState('')
  const [useBackupToDisable, setUseBackupToDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!isAdmin && !isSuperAdmin) return null
  const enabled = !!profile?.totp_enabled

  const resetToIdle = () => {
    setStep('idle')
    setEnrollment(null)
    setCode('')
    setDisablePassword('')
    setDisableBackupCode('')
    setUseBackupToDisable(false)
    setError('')
  }

  const startEnroll = async () => {
    setBusy(true)
    setError('')
    const res = await totpEnroll()
    setBusy(false)
    if (res.error || !res.secret || !res.qr) {
      setError(res.error ?? t('unexpectedError'))
      return
    }
    setEnrollment({ secret: res.secret, qr: res.qr })
    setCode('')
    setStep('enroll')
  }

  const confirmEnroll = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError('')
    const res = await totpConfirm(code.trim())
    setBusy(false)
    if (res.error || !res.backupCodes) {
      setError(res.error ?? t('unexpectedError'))
      return
    }
    setBackupCodes(res.backupCodes)
    setStep('backup')
  }

  const confirmDisable = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await totpDisable(
      useBackupToDisable ? { backupCode: disableBackupCode.trim() } : { password: disablePassword }
    )
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    resetToIdle()
    toast.success(t('totpDisabledToast'))
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand" />
        <h3 className="font-heading text-base font-semibold text-ink">{t('totpSectionTitle')}</h3>
      </div>
      <p className="tamil mb-4 font-body text-sm text-ink2">{t('totpSectionDesc')}</p>

      {step === 'idle' && (
        <div className="flex items-center justify-between gap-3 rounded-field border border-line bg-canvas px-3.5 py-3">
          <span
            className={`tamil rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              enabled ? 'bg-mintsoft text-mint' : 'bg-tint text-ink2'
            }`}
          >
            {enabled ? t('totpStatusOn') : t('totpStatusOff')}
          </span>
          <button
            onClick={() => (enabled ? setStep('disable') : startEnroll())}
            disabled={busy}
            className="btn-ghost btn-sm"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {enabled ? t('totpTurnOff') : t('totpTurnOn')}
          </button>
        </div>
      )}

      {step === 'enroll' && enrollment && (
        <form onSubmit={confirmEnroll} className="flex flex-col gap-3">
          <p className="tamil font-body text-xs text-ink2">{t('totpEnrollIntro')}</p>
          <img
            src={enrollment.qr}
            alt=""
            className="mx-auto h-40 w-40 rounded-lg border border-line"
          />
          <p className="tamil break-all rounded-field bg-canvas px-3 py-2 text-center font-mono text-xs text-ink2">
            {t('totpManualKeyLabel')}{' '}
            <span className="font-semibold text-ink">{enrollment.secret}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="input-soft text-center text-lg tracking-[0.4em]"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p className="text-center font-body text-xs font-medium text-coral">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={resetToIdle} className="btn-ghost btn-sm flex-1">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="btn-brand btn-sm flex-1"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {t('totpActivate')}
            </button>
          </div>
        </form>
      )}

      {step === 'backup' && (
        <div className="flex flex-col gap-3">
          <p className="tamil font-heading text-sm font-semibold text-ink">
            {t('totpBackupCodesTitle')}
          </p>
          <p className="tamil font-body text-xs text-ink2">{t('totpBackupCodesIntro')}</p>
          <div className="grid grid-cols-2 gap-2 rounded-field bg-canvas p-3 font-mono text-sm text-ink">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            onClick={() => {
              resetToIdle()
              toast.success(t('totpEnabledToast'))
            }}
            className="btn-brand btn-sm"
          >
            {t('totpBackupCodesDone')}
          </button>
        </div>
      )}

      {step === 'disable' && (
        <form onSubmit={confirmDisable} className="flex flex-col gap-3">
          <p className="tamil font-body text-sm font-semibold text-ink">
            {t('totpDisableConfirmTitle')}
          </p>
          {useBackupToDisable ? (
            <input
              type="text"
              className="input-soft"
              placeholder={t('totpBackupCodeLabel')}
              value={disableBackupCode}
              onChange={(e) => setDisableBackupCode(e.target.value.trim())}
            />
          ) : (
            <PasswordInput
              id="totp-disable-password"
              value={disablePassword}
              onChange={setDisablePassword}
              placeholder={t('totpDisablePasswordLabel')}
            />
          )}
          {error && <p className="text-center font-body text-xs font-medium text-coral">{error}</p>}
          <button
            type="button"
            onClick={() => setUseBackupToDisable((v) => !v)}
            className="mx-auto font-heading text-xs font-semibold text-accent"
          >
            {useBackupToDisable ? t('totpUseAppCodeInstead') : t('totpUseBackupCode')}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={resetToIdle} className="btn-ghost btn-sm flex-1">
              {t('cancel')}
            </button>
            <button type="submit" disabled={busy} className="btn-brand btn-sm flex-1">
              {busy && <Loader2 size={14} className="animate-spin" />}
              {t('totpTurnOff')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="tamil flex-1 font-body text-sm text-ink2">{label}</span>
      <span className="tamil truncate text-right font-heading text-sm font-semibold text-ink">
        {value}
      </span>
    </div>
  )
}

/** Compact headline stat for the integrated top dashboard (accuracy, questions,
 *  time spent) - smaller and label-first, distinct from the fuller StatCard
 *  tiles used for the secondary "More Stats" breakdown. */
function MiniStat({
  icon,
  value,
  labelKey,
}: {
  icon: React.ReactNode
  value: string
  labelKey: StringKey
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
      <span className="font-heading text-sm font-semibold leading-none text-ink">{value}</span>
      <span className="tamil truncate font-body text-2xs uppercase tracking-wide text-ink2">{t(labelKey)}</span>
    </div>
  )
}

/** One row in the "Quick links" list menu - a unified, divided list instead of
 *  several separate floating buttons. */
function NavRow({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 bg-card px-4 py-3.5 text-left transition-colors hover:bg-tint/40 active:bg-tint/60"
    >
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="tamil block font-display text-sm font-semibold text-ink">{label}</span>
        {sub && <span className="tamil block font-body text-xs text-ink2">{sub}</span>}
      </span>
      <ChevronRight size={18} className="flex-shrink-0 text-muted/40" />
    </button>
  )
}

function StatCard({
  icon,
  value,
  labelKey,
  i = 0,
}: {
  icon: React.ReactNode
  value: string
  labelKey: StringKey
  /** Position in the grid - drives the staggered entrance delay. */
  i?: number
}) {
  const { t } = useT()
  return (
    <div
      style={{ '--i': i } as React.CSSProperties}
      className="card stagger-item interactive group flex flex-col gap-2 p-4"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        {icon}
      </span>
      <div className="font-heading text-xl font-semibold leading-none text-ink">{value}</div>
      <div className="tamil truncate font-body text-2xs uppercase tracking-wide text-ink2">
        {t(labelKey)}
      </div>
    </div>
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="stroke-brand transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-heading text-base font-semibold text-ink">
        {level}
      </span>
    </div>
  )
}
