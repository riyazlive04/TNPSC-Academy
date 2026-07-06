import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import Avatar from '../components/UI/Avatar'
import PremiumCard from '../components/UI/PremiumCard'
import ProfileVideos from '../components/Profile/ProfileVideos'
import { toast } from '../store/toastStore'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { fetchHabit, type HabitState } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type GameStats } from '../lib/achievements'
import { isHiddenBadge } from '../lib/features'
import { GROUP_SUBJECTS } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { useCreditsStore } from '../store/creditsStore'
import { api, type DeviceSession } from '../lib/api'
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

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin, signOut } = useAuth()
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
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/20">
                  <ShieldCheck size={12} /> {roleLabel}
                </span>
              </div>
            </div>

            {/* Level */}
            <div className="card flex items-center gap-4 p-5">
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
              </div>
            </div>

            {/* Stats overview */}
            <div>
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                {t('statsOverview')}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard i={0} icon={<ClipboardCheck size={18} />} value={String(stats.tests)} labelKey="testsTaken" />
                <StatCard i={1} icon={<ListChecks size={18} />} value={String(stats.questions)} labelKey="totalQuestions" />
                <StatCard i={2} icon={<Crosshair size={18} />} value={`${Math.round(stats.avgAccuracy)}%`} labelKey="avgAccuracy" />
                <StatCard i={3} icon={<Trophy size={18} />} value={String(stats.bestScore)} labelKey="bestScore" />
                <StatCard i={4} icon={<Clock size={18} />} value={`${stats.minutes} min`} labelKey="timeSpent" />
                <StatCard i={5} icon={<Award size={18} />} value={`${earned}/${badges.length}`} labelKey="achievements" />
              </div>
            </div>

            {/* Credit balance - where the header credit pill taps through to.
                Free learners only; hidden for unlimited (paid/staff). */}
            <CreditsCard />

            {/* Premium upsell - 3-month plan (₹1,699) */}
            <PremiumCard />

            {/* Saved Questions - moved here from the top bar so the toolbar stays
                to language · theme · profile. */}
            <button
              onClick={() => navigate('/bookmarks')}
              className="group interactive flex w-full items-center gap-3 rounded-card border border-line bg-card px-4 py-3.5 text-left hover:border-primary/40"
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Bookmark size={16} />
              </span>
              <span className="tamil flex-1 font-display text-sm font-semibold text-ink">
                {t('questionBank')}
              </span>
              <ChevronRight size={18} className="flex-shrink-0 text-muted/40" />
            </button>

            {/* How it works - replay the first-run welcome tour. Aspirant-only
                (admins don't use the onboarding/gamification layer). */}
            {!isAdmin && (
              <button
                onClick={startTour}
                className="group interactive flex w-full items-center gap-3 rounded-card border border-line bg-card px-4 py-3.5 text-left hover:border-primary/40"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <Compass size={16} />
                </span>
                <span className="flex-1">
                  <span className="tamil block font-display text-sm font-semibold text-ink">
                    {t('howItWorks')}
                  </span>
                  <span className="tamil block font-body text-xs text-ink2">{t('howItWorksSub')}</span>
                </span>
                <ChevronRight size={18} className="flex-shrink-0 text-muted/40" />
              </button>
            )}

            {/* Video lessons - superadmin-assigned videos (placement='profile').
                Renders nothing until videos are added. */}
            <ProfileVideos />

            {/* Devices - manage the 2-device limit (sign out a lost/old device) */}
            <DevicesSection />

            {/* Sign out */}
            <button onClick={handleSignOut} className="btn-ghost w-full">
              <LogOut size={16} /> {t('signOut')}
            </button>

            <AppFooter />
          </div>
        )}
      </div>
    </AppLayout>
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

      <p className="tamil font-body text-[13px] text-muted">
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

      <div className="tamil flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-[12px] text-muted">
        <a
          href="mailto:support@sirahdigital.in"
          className="transition-colors hover:text-ink"
        >
          {t('contactSupport')}
        </a>
        <span className="text-muted/40">·</span>
        <a
          href="https://sirahdigital.in/privacy"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-ink"
        >
          {t('privacyPolicy')}
        </a>
        <span className="text-muted/40">·</span>
        <a
          href="https://sirahdigital.in/terms"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-ink"
        >
          {t('termsOfUse')}
        </a>
      </div>

      <p className="tamil font-body text-[11px] text-muted/70">
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
                      <span className="tamil ml-2 rounded-full bg-mintsoft px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-mint">
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
      <div className="tamil truncate font-body text-[11px] uppercase tracking-wide text-ink2">
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
