import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  LogOut,
  Target,
  CalendarClock,
  Users,
  ShieldCheck,
  ClipboardCheck,
  ListChecks,
  Crosshair,
  Trophy,
  Clock,
  Award,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import { fetchUserAnalytics, type UserAnalytics } from '../lib/analytics'
import { fetchHabit, type HabitState } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type GameStats } from '../lib/achievements'
import { isHiddenBadge } from '../lib/features'
import { GROUP_SUBJECTS, groupLabel } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useT, type StringKey } from '../lib/i18n'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isSuperAdmin, signOut } = useAuth()
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

  const lvl = levelInfo(
    computeXp({ totalCorrect: stats.correct, totalQuestions: stats.questions, testsTaken: stats.tests })
  )
  const badges = computeBadges(stats).filter((b) => !isHiddenBadge(b.id))
  const earned = badges.filter((b) => b.unlocked).length

  const name = profile?.full_name || 'Aspirant'
  const initial = name.trim().charAt(0).toUpperCase() || 'A'
  const roleLabel = isSuperAdmin ? t('superadmin') : isAdmin ? t('admin') : 'Aspirant'
  const examDate = profile?.exam_date
    ? new Date(profile.exam_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : t('notSet')

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
              <span className="relative grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl bg-white/15 font-heading text-2xl font-bold text-white ring-1 ring-white/20">
                {initial}
              </span>
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
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                {t('accountDetails')}
              </h2>
              <div className="card divide-y divide-line">
                <DetailRow icon={<Users size={16} />} label={t('targetGroup')} value={groupLabel(group)} />
                <DetailRow icon={<CalendarClock size={16} />} label={t('examDate')} value={examDate} />
                <DetailRow
                  icon={<Target size={16} />}
                  label={t('dailyGoal')}
                  value={profile?.daily_goal ? String(profile.daily_goal) : t('notSet')}
                />
                {profile?.phone && (
                  <DetailRow icon={<ShieldCheck size={16} />} label={t('phone')} value={profile.phone} />
                )}
              </div>
            </div>

            {/* Stats overview */}
            <div>
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-ink">
                {t('statsOverview')}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon={<ClipboardCheck size={18} />} value={String(stats.tests)} labelKey="testsTaken" />
                <StatCard icon={<ListChecks size={18} />} value={String(stats.questions)} labelKey="totalQuestions" />
                <StatCard icon={<Crosshair size={18} />} value={`${Math.round(stats.avgAccuracy)}%`} labelKey="avgAccuracy" />
                <StatCard icon={<Trophy size={18} />} value={String(stats.bestScore)} labelKey="bestScore" />
                <StatCard icon={<Clock size={18} />} value={`${stats.minutes} min`} labelKey="timeSpent" />
                <StatCard icon={<Award size={18} />} value={`${earned}/${badges.length}`} labelKey="achievements" />
              </div>
            </div>

            {/* Sign out */}
            <button onClick={handleSignOut} className="btn-ghost w-full">
              <LogOut size={16} /> {t('signOut')}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
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
}: {
  icon: React.ReactNode
  value: string
  labelKey: StringKey
}) {
  const { t } = useT()
  return (
    <div className="card flex flex-col gap-2 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EAF4" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2563EB"
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
