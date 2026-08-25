import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Users as UsersIcon,
  Activity,
  FileCheck2,
  FileMinus2,
  Database,
  Star,
  MessageSquare,
  ShieldCheck,
  Search,
  AlertTriangle,
  RefreshCw,
  Ticket,
  Plus,
  Copy,
  Trash2,
  Pencil,
  ShieldOff,
  Crown,
  IndianRupee,
  TrendingUp,
  Wallet,
  Bell,
  Megaphone,
  Send,
  Flag,
  BookOpen,
  Download,
  UploadCloud,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Monitor,
  LogOut,
  ClipboardList,
  Clock,
  X,
  Menu,
  Library,
  Video,
  FileText,
  Image as ImageIcon,
  Upload,
  Eye,
  EyeOff,
  CalendarDays,
  Trophy,
  TrendingDown,
  Coins,
  Newspaper,
  CheckCircle2,
  ListChecks,
  FileDown,
  Presentation,
  Rocket,
} from 'lucide-react'
import Avatar from '../components/UI/Avatar'
import Spinner from '../components/UI/Spinner'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import ErrorState from '../components/UI/ErrorState'
import ReportedQuestions from '../components/Admin/ReportedQuestions'
import ReportResolvedMessageEditor from '../components/SuperAdmin/ReportResolvedMessageEditor'
import {
  api,
  type PlatformMetrics,
  type RevenueMetrics,
  type AdminUserRow,
  type FeedbackRow,
  type CouponWithStats,
  type CouponInput,
  type DiscountType,
  type AdminNotification,
  type NotificationAudience,
  type NotificationKind,
  type AdminAlert,
  type AlertKind,
  type DeviceSession,
  type AppRelease,
  type WebBundle,
  type Material,
  type MaterialKind,
  type MaterialPlacement,
  type CaMagazineIssue,
  type CaQuestionSet,
  type CaQuestionSets,
  type CaQuestionItem,
  type UserInsights,
  type MessageItem,
} from '../lib/api'
import { useT, type StringKey } from '../lib/i18n'
import { youtubeThumb, kindLabel, formatFileSize } from '../lib/materials'
import { issueDateLabel, magazineName } from '../lib/caMagazine'
import { ALERT_KIND, ALERT_KINDS, alertKindOf } from '../lib/alertKinds'
import MagazineEditor from '../components/Materials/MagazineEditor'
import CaTelegramDialog from '../components/Materials/CaTelegramDialog'
import { toast } from '../store/toastStore'
import type { MockExamAdmin, TestSeriesAdmin, VettriExamAdmin, UserRole } from '../types'

type Tab = 'overview' | 'revenue' | 'users' | 'coupons' | 'notifications' | 'feedback' | 'reports' | 'notes' | 'app' | 'mockexams' | 'testseries' | 'vettri' | 'materials' | 'camagazine' | 'caslides' | 'caquestions'

export default function SuperAdminPage() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('overview')
  // Mobile-only nav drawer (the desktop rail is always visible).
  const [navOpen, setNavOpen] = useState(false)

  const TABS: { id: Tab; label: StringKey; icon: typeof Activity }[] = [
    { id: 'overview', label: 'overview', icon: Activity },
    { id: 'revenue', label: 'revenueTab', icon: IndianRupee },
    { id: 'users', label: 'users', icon: UsersIcon },
    { id: 'coupons', label: 'couponsTab', icon: Ticket },
    { id: 'notifications', label: 'notificationsTab', icon: Bell },
    { id: 'feedback', label: 'feedbackTab', icon: MessageSquare },
    { id: 'reports', label: 'reportsTab', icon: Flag },
    { id: 'notes', label: 'notesTab', icon: BookOpen },
    { id: 'mockexams', label: 'mockExamsTab', icon: ClipboardList },
    { id: 'testseries', label: 'testSeriesTab', icon: CalendarDays },
    { id: 'vettri', label: 'vettriTab', icon: Trophy },
    { id: 'materials', label: 'materialsTab', icon: Library },
    { id: 'camagazine', label: 'caMagazineTab', icon: Newspaper },
    { id: 'caslides', label: 'caSlidesTab', icon: Presentation },
    { id: 'caquestions', label: 'caQuestionsTab', icon: ListChecks },
    { id: 'app', label: 'appTab', icon: Smartphone },
  ]

  const activeTab = TABS.find((x) => x.id === tab)

  // Lock body scroll + close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [navOpen])

  // The vertical list of tab buttons, shared by the desktop rail and the mobile
  // drawer. `onPick` lets the drawer close itself after a selection.
  const navList = (onPick?: () => void) => (
    <nav className="space-y-1">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => {
              setTab(id)
              onPick?.()
            }}
            aria-current={active}
            className={`press flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-heading text-sm font-medium transition-colors duration-200 ${
              active ? 'bg-brand-soft text-brand' : 'text-ink2 hover:bg-tint hover:text-ink'
            }`}
          >
            <Icon size={17} className="flex-shrink-0" /> <span className="tamil truncate">{t(label)}</span>
          </button>
        )
      })}
    </nav>
  )

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
        <header className="mb-6 flex items-center gap-3 animate-slideDown">
          {/* Mobile menu trigger — opens the tab drawer. */}
          <button
            onClick={() => setNavOpen(true)}
            aria-label={t('chooseCategory')}
            className="focus-ring grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border border-line bg-card text-ink2 hover:text-ink lg:hidden"
          >
            <Menu size={22} />
          </button>
          <span className="hidden h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand lg:grid">
            <ShieldCheck size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-ink">
              {t('superadminConsole')}
            </h1>
            {/* Desktop: static subtitle. Mobile: the active tab, so the current
                section is always named next to the menu button. */}
            <p className="tamil truncate font-body text-sm text-ink2">
              <span className="lg:hidden">{activeTab ? t(activeTab.label) : t('chooseCategory')}</span>
              <span className="hidden lg:inline">{t('chooseCategory')}</span>
            </p>
          </div>
        </header>

        <div className="flex gap-6">
          {/* Desktop side panel — a sticky vertical rail. */}
          <aside className="hidden w-56 flex-shrink-0 lg:block">
            <div className="sticky top-6">{navList()}</div>
          </aside>

          {/* Content column */}
          <div key={tab} className="min-w-0 flex-1 animate-fadeIn">
            {tab === 'overview' && <OverviewTab />}
            {tab === 'revenue' && <RevenueTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'coupons' && <CouponsTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'feedback' && <FeedbackTab />}
            {tab === 'reports' && (
              <>
                {/* Superadmin-only: the copy students get when a report is resolved. */}
                <ReportResolvedMessageEditor />
                <ReportedQuestions />
              </>
            )}
            {tab === 'notes' && <StudyNotesTab />}
            {tab === 'mockexams' && <MockExamsTab />}
            {tab === 'testseries' && <TestSeriesTab />}
            {tab === 'vettri' && <VettriExamsTab />}
            {tab === 'materials' && <MaterialsTab />}
            {tab === 'camagazine' && <CaMagazineTab />}
            {tab === 'caslides' && <CaSlidesTab />}
            {tab === 'caquestions' && <CaQuestionsTab />}
            {tab === 'app' && <AppReleasesTab />}
          </div>
        </div>
      </div>

      {/* Mobile nav drawer — slide-in side panel over a scrim. */}
      {navOpen && (
        <div
          className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm animate-fadeInFast lg:hidden"
          onClick={() => setNavOpen(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('superadminConsole')}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col border-r border-line bg-card shadow-card animate-slideInLeft"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
                <ShieldCheck size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-ink">
                {t('superadminConsole')}
              </span>
              <button
                onClick={() => setNavOpen(false)}
                aria-label={t('close')}
                className="focus-ring grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted hover:bg-tint hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">{navList(() => setNavOpen(false))}</div>
          </div>
        </div>
      )}
    </>
  )
}

function SkeletonGrid() {
  const { t } = useT()
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="skeleton mb-3 h-9 w-9 rounded-lg" />
          <div className="skeleton mb-2 h-6 w-16" />
          <div className="skeleton h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

// ─── Overview ───────────────────────────────────────────────────────────────────
function OverviewTab() {
  const { t } = useT()
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError(false)
    api.superadmin
      .metrics()
      .then(setMetrics)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <SkeletonGrid />
  if (error || !metrics) return <ErrorState onRetry={load} />

  const cards: { icon: typeof UsersIcon; value: string; label: StringKey; tile: string }[] = [
    { icon: UsersIcon, value: String(metrics.totalUsers), label: 'totalUsers', tile: 'bg-brand-soft text-brand' },
    { icon: Activity, value: String(metrics.activeToday), label: 'activeToday', tile: 'bg-mintsoft text-mint' },
    { icon: Activity, value: String(metrics.active7d), label: 'active7d', tile: 'bg-skysoft text-sky' },
    { icon: FileCheck2, value: String(metrics.testsCompleted), label: 'testsCompleted', tile: 'bg-goldsoft text-gold' },
    { icon: FileMinus2, value: String(metrics.testsAbandoned ?? 0), label: 'testsAbandoned', tile: 'bg-coralsoft text-coral' },
    { icon: Database, value: String(metrics.totalQuestions), label: 'totalQuestions', tile: 'bg-brand-soft text-brand' },
    { icon: Star, value: metrics.avgRating ? metrics.avgRating.toFixed(2) : '-', label: 'avgRating', tile: 'bg-goldsoft text-gold' },
    { icon: MessageSquare, value: String(metrics.feedbackCount), label: 'totalFeedback', tile: 'bg-accentwarmsoft text-accentwarm' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item interactive p-4"
            >
              <span className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${c.tile}`}>
                <Icon size={18} />
              </span>
              <div className="font-heading text-2xl font-semibold leading-none text-ink">{c.value}</div>
              <div className="tamil mt-1.5 font-body text-2xs uppercase tracking-wide text-ink2">
                {t(c.label)}
              </div>
            </div>
          )
        })}
      </div>

      <SignupsChart data={metrics.signups14d} />

      <div className="grid gap-5 md:grid-cols-2">
        <BreakdownCard title={t('roleBreakdown')} data={metrics.roleBreakdown} />
        <BreakdownCard title={t('questionBank')} data={metrics.questionsByCategory} />
      </div>
    </div>
  )
}

function SignupsChart({ data = [] }: { data?: { date: string; count: number }[] }) {
  const { t } = useT()
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">{t('signups14d')}</h2>
      {data.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-ink2">{t('noData')}</p>
      ) : (
        <>
          {/* Bars: the track row stretches each column to its full height (default
              items-stretch) so a bar's percentage height resolves against a
              definite parent — the previous items-end collapsed every bar to 0. */}
          <div className="flex h-32 gap-1.5">
            {data.map((d) => (
              <div key={d.date} className="group relative flex flex-1 items-end">
                <div
                  style={{ height: `${(d.count / max) * 100}%` }}
                  className="w-full min-h-[3px] rounded-t-md bg-brand/80 transition-colors duration-200 group-hover:bg-brand"
                  title={`${d.date}: ${d.count}`}
                />
                <span className="pointer-events-none absolute inset-x-0 -top-4 text-center font-heading text-2xs font-semibold text-ink2 opacity-0 transition-opacity group-hover:opacity-100">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {data.map((d) => (
              <span key={d.date} className="flex-1 text-center font-body text-2xs text-ink2/70">
                {d.date.slice(8, 10)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BreakdownCard({ title, data = {} }: { title: string; data?: Record<string, number> }) {
  const entries = Object.entries(data)
  const total = Math.max(1, entries.reduce((s, [, v]) => s + v, 0))
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">{title}</h2>
      <div className="space-y-3">
        {entries.length === 0 && <p className="font-body text-sm text-ink2">-</p>}
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between font-body text-xs">
              <span className="capitalize text-ink2">{k.replace(/_/g, ' ')}</span>
              <span className="font-heading font-semibold text-ink">{v}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-tint">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${(v / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Revenue (founder analytics) ────────────────────────────────────────────────
// Amounts come from the API in paise; show them as whole rupees, Indian-grouped.
function formatINR(paise: number): string {
  return '₹' + Math.round(paise / 100).toLocaleString('en-IN')
}

function RevenueTab() {
  const [m, setM] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    api.superadmin
      .revenue()
      .then(setM)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <SkeletonGrid />
  if (error || !m) return <ErrorState onRetry={load} />

  const conversion = m.totalUsers
    ? `${((m.payingCustomers / m.totalUsers) * 100).toFixed(1)}%`
    : '-'

  const headline: { label: string; value: string; icon: typeof Wallet; tile: string }[] = [
    { label: 'This week', value: formatINR(m.revenueWeek), icon: Wallet, tile: 'bg-mintsoft text-mint' },
    { label: 'This month', value: formatINR(m.revenueMonth), icon: TrendingUp, tile: 'bg-brand-soft text-brand' },
    { label: 'This year', value: formatINR(m.revenueYear), icon: IndianRupee, tile: 'bg-goldsoft text-gold' },
    { label: 'All-time', value: formatINR(m.revenueAllTime), icon: IndianRupee, tile: 'bg-skysoft text-sky' },
  ]

  const stats: { label: string; value: string }[] = [
    { label: 'Paying customers', value: String(m.payingCustomers) },
    { label: 'Active premium', value: String(m.premiumActive) },
    { label: 'Conversion', value: conversion },
    { label: 'Avg order value', value: formatINR(m.avgOrderValue) },
    { label: 'Paid orders', value: String(m.paidOrders) },
    { label: 'Coupon orders', value: String(m.couponOrders) },
    { label: 'Discounts given', value: formatINR(m.totalDiscount) },
    { label: 'Failed payments', value: String(m.failedPayments) },
  ]

  return (
    <div className="space-y-6">
      <p className="font-body text-xs text-ink2">
        Today:{' '}
        <span className="font-heading font-semibold text-ink">{formatINR(m.revenueToday)}</span>
      </p>

      {/* Headline revenue windows */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {headline.map((c, i) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item interactive p-4"
            >
              <span className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${c.tile}`}>
                <Icon size={18} />
              </span>
              <div className="font-heading text-2xl font-semibold leading-none text-ink">
                {c.value}
              </div>
              <div className="mt-1.5 font-body text-2xs uppercase tracking-wide text-ink2">
                {c.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="font-heading text-xl font-semibold leading-none text-ink">{s.value}</div>
            <div className="mt-1.5 font-body text-2xs uppercase tracking-wide text-ink2">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <RevenueChart data={m.revenueByMonth} />

      {/* Top promoters */}
      <div className="card p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-ink">
          Top promoters by revenue
        </h2>
        {m.topPromoters.length === 0 ? (
          <p className="font-body text-sm text-ink2">No coupon-driven sales yet.</p>
        ) : (
          <div className="space-y-2.5">
            {m.topPromoters.map((p, i) => (
              <div key={p.code} className="flex items-center gap-3">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-soft font-heading text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">
                    {p.promoter}
                  </p>
                  <p className="truncate font-body text-xs text-ink2">
                    {p.code} · {p.redemptions} sale{p.redemptions === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="font-heading text-sm font-semibold text-ink">
                  {formatINR(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RevenueChart({ data = [] }: { data?: { month: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const allZero = data.length === 0 || data.every((d) => d.revenue === 0)
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">Revenue - last 12 months</h2>
      {allZero ? (
        <p className="py-6 text-center font-body text-sm text-ink2">No revenue recorded yet.</p>
      ) : (
        <>
          {/* items-stretch (default) gives each column a definite height so the
              percentage-height bars render; labels sit in a separate row below. */}
          <div className="flex h-40 gap-1.5">
            {data.map((d) => (
              <div key={d.month} className="group relative flex flex-1 items-end">
                <div
                  style={{ height: `${(d.revenue / max) * 100}%` }}
                  className="w-full min-h-[3px] rounded-t-md bg-brand/80 transition-colors duration-200 group-hover:bg-brand"
                  title={`${d.month}: ${formatINR(d.revenue)}`}
                />
                <span className="pointer-events-none absolute inset-x-0 -top-4 text-center font-heading text-2xs font-semibold text-ink2 opacity-0 transition-opacity group-hover:opacity-100">
                  {formatINR(d.revenue)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center font-body text-2xs text-ink2/70">
                {d.month.slice(5)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<UserRole, StringKey> = {
  user: 'roleUser',
  admin: 'roleAdmin',
  superadmin: 'roleSuperadmin',
}

// User-list filters (client-side, over the loaded page of users). Console
// tooling: kept in English like the rest of the superadmin screens.
type UserPlanFilter = 'all' | 'premium' | 'vettri' | 'free'
type UserActivityFilter = 'any' | '7d' | '30d' | 'inactive30'

/** Local-midnight epoch for a YYYY-MM-DD date-input value (null when empty). */
function parseDayLocal(s: string): number | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

/** Rows per page in the Users tab - filters still span every account. */
const USERS_PER_PAGE = 50

function UsersTab() {
  const { t } = useT()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [planFilter, setPlanFilter] = useState<UserPlanFilter>('all')
  const [activityFilter, setActivityFilter] = useState<UserActivityFilter>('any')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ user: AdminUserRow; role: UserRole } | null>(null)
  const [saving, setSaving] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [devicesTarget, setDevicesTarget] = useState<AdminUserRow | null>(null)
  // Detail popup: store the id and derive the row from `users`, so grant/revoke
  // updates inside the modal reflect immediately (a snapshot would go stale).
  const [detailId, setDetailId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    // EVERY account, not the newest page: the filters below run client-side over
    // the whole set, so a server-side page would silently narrow what they see.
    api.superadmin
      .allUsers()
      .then(setUsers)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromMs = parseDayLocal(joinedFrom)
    // "to" is inclusive: anything before the NEXT local midnight counts.
    const toEnd = parseDayLocal(joinedTo)
    const toMs = toEnd === null ? null : toEnd + 24 * 60 * 60 * 1000
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    return users.filter((u) => {
      if (
        term &&
        !(u.full_name ?? '').toLowerCase().includes(term) &&
        !(u.email ?? '').toLowerCase().includes(term)
      ) {
        return false
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (planFilter === 'premium' && !u.premium) return false
      if (planFilter === 'vettri' && !u.vettri) return false
      if (planFilter === 'free' && (u.premium || u.vettri)) return false
      const joined = new Date(u.created_at).getTime()
      if (fromMs !== null && joined < fromMs) return false
      if (toMs !== null && joined >= toMs) return false
      if (activityFilter !== 'any') {
        const last = u.last_active ? new Date(u.last_active).getTime() : null
        const activeWithin = (days: number) => last !== null && now - last <= days * DAY
        if (activityFilter === '7d' && !activeWithin(7)) return false
        if (activityFilter === '30d' && !activeWithin(30)) return false
        if (activityFilter === 'inactive30' && activeWithin(30)) return false
      }
      return true
    })
  }, [users, search, roleFilter, planFilter, activityFilter, joinedFrom, joinedTo])

  const filtersActive =
    roleFilter !== 'all' || planFilter !== 'all' || activityFilter !== 'any' || !!joinedFrom || !!joinedTo
  const clearFilters = () => {
    setRoleFilter('all')
    setPlanFilter('all')
    setActivityFilter('any')
    setJoinedFrom('')
    setJoinedTo('')
  }

  // ── Paging over the filtered set ───────────────────────────────────────────
  // The rows are rendered a page at a time so the tab stays fast with thousands
  // of accounts, while search and the filters still consider every one of them.
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE))
  // Any change to what is being filtered can shrink the list under the current
  // page - snap back rather than showing an empty one.
  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, planFilter, activityFilter, joinedFrom, joinedTo])
  const pageStart = (Math.min(page, pageCount) - 1) * USERS_PER_PAGE
  const visible = filtered.slice(pageStart, pageStart + USERS_PER_PAGE)

  const confirmRoleChange = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await api.superadmin.setRole(pending.user.id, pending.role)
      setUsers((prev) =>
        prev.map((u) => (u.id === pending.user.id ? { ...u, role: pending.role } : u))
      )
      toast.success(t('roleUpdated'))
      setPending(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('roleUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget) return
    setBusy(true)
    try {
      await api.superadmin.revokePremium(revokeTarget.id)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === revokeTarget.id ? { ...u, premium: false, premium_until: null } : u
        )
      )
      toast.success(t('premiumRevoked'))
      setRevokeTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('revokeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api.superadmin.deleteUser(deleteTarget.id)
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      toast.success(t('userDeleted'))
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('deleteUserFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    )
  }
  if (error) return <ErrorState onRetry={load} />

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 shadow-pill transition focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15">
        <Search size={18} className="text-ink2/60" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchUsers')}
          className="w-full bg-transparent font-body text-sm text-ink outline-none placeholder:text-ink2/50"
        />
      </div>

      {/* Filters — every facet mirrors a field shown on the user rows below. */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Role">
            <select
              className={COUPON_INPUT}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            >
              <option value="all">All roles</option>
              <option value="user">Student</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </Field>
          <Field label="Plan">
            <select
              className={COUPON_INPUT}
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as UserPlanFilter)}
            >
              <option value="all">All plans</option>
              <option value="premium">Premium</option>
              <option value="vettri">Group 1 Test Series</option>
              <option value="free">Free</option>
            </select>
          </Field>
          <Field label="Activity">
            <select
              className={COUPON_INPUT}
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as UserActivityFilter)}
            >
              <option value="any">Any activity</option>
              <option value="7d">Active in last 7 days</option>
              <option value="30d">Active in last 30 days</option>
              <option value="inactive30">Inactive 30+ days</option>
            </select>
          </Field>
          <Field label="Joined from">
            <input
              type="date"
              className={COUPON_INPUT}
              value={joinedFrom}
              onChange={(e) => setJoinedFrom(e.target.value)}
            />
          </Field>
          <Field label="Joined to">
            <input
              type="date"
              className={COUPON_INPUT}
              value={joinedTo}
              onChange={(e) => setJoinedTo(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-body text-xs text-ink2">
            {filtered.length === 0
              ? `0 of ${users.length} users`
              : `Showing ${pageStart + 1}-${pageStart + visible.length} of ${filtered.length}` +
                (filtered.length === users.length ? ' users' : ` matching (${users.length} total)`)}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="focus-ring press inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-heading text-xs font-semibold text-ink2 transition hover:bg-tint hover:text-ink"
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-body text-ink2">{t('noUsers')}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((u, i) => (
            <div
              key={u.id}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item flex flex-wrap items-center gap-3 p-3.5 sm:flex-nowrap"
            >
              <button
                type="button"
                onClick={() => setDetailId(u.id)}
                title="View details"
                className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:bg-tint/60"
              >
                <Avatar
                  src={u.avatar_url}
                  name={u.full_name ?? u.email}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft font-heading text-sm font-bold uppercase text-brand"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-heading text-sm font-semibold text-ink">
                      {u.full_name || '-'}
                    </p>
                    {/* Plan chips carry the subscription's expiry so validity is
                        readable straight off the list, without opening details. */}
                    {u.premium && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-amber-500">
                        <Crown size={11} />
                        {t('premiumBadge')}
                        {u.premium_until && ` · ${new Date(u.premium_until).toLocaleDateString()}`}
                      </span>
                    )}
                    {u.vettri && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                        <Trophy size={11} />
                        Vettri
                        {u.vettri_until && ` · ${new Date(u.vettri_until).toLocaleDateString()}`}
                      </span>
                    )}
                    {u.rank_booster && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                        <Rocket size={11} />
                        Group II/IIA Test Series
                        {u.rank_booster_until &&
                          ` · ${new Date(u.rank_booster_until).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-body text-xs text-ink2">{u.email}</p>
                  <p className="truncate font-body text-2xs text-ink2/80">
                    Joined {new Date(u.created_at).toLocaleDateString()}
                    {u.last_active ? ` · ${relativeTime(u.last_active)}` : ' · never active'}
                  </p>
                </div>
              </button>
              <div className="hidden text-center sm:block">
                <p className="font-heading text-sm font-semibold text-ink">{u.tests_taken}</p>
                <p className="font-body text-2xs uppercase tracking-wide text-ink2">{t('testsTakenCol')}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => setPending({ user: u, role: e.target.value as UserRole })}
                aria-label={`${t('role')} - ${u.email}`}
                className="focus-ring rounded-lg border border-line bg-card px-2.5 py-1.5 font-heading text-xs font-semibold text-ink transition hover:border-brand/40"
              >
                {(['user', 'admin', 'superadmin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABELS[r])}
                  </option>
                ))}
              </select>
              {u.premium && (
                <button
                  onClick={() => setRevokeTarget(u)}
                  aria-label={`${t('revokePremium')} - ${u.email}`}
                  title={t('revokePremium')}
                  className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-line bg-card text-amber-500 transition hover:border-amber-400/50 hover:bg-amber-400/10"
                >
                  <ShieldOff size={16} />
                </button>
              )}
              <button
                onClick={() => setDevicesTarget(u)}
                aria-label={`Devices - ${u.email}`}
                title="Devices / sessions"
                className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-line bg-card text-ink2 transition hover:border-brand/40 hover:text-brand"
              >
                <MonitorSmartphone size={16} />
              </button>
              <button
                onClick={() => setDeleteTarget(u)}
                aria-label={`${t('deleteUser')} - ${u.email}`}
                title={t('deleteUser')}
                className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-line bg-card text-rose-500 transition hover:border-rose-400/50 hover:bg-rose-400/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <Pager page={Math.min(page, pageCount)} pageCount={pageCount} onChange={setPage} />
      )}

      <ConfirmDialog
        open={!!pending}
        title={t('changeRoleTitle')}
        message={`${pending?.user.email ?? ''} → ${pending ? t(ROLE_LABELS[pending.role]) : ''}. ${t('changeRoleMsg')}`}
        confirmLabel={t('submit')}
        cancelLabel={t('back')}
        tone="brand"
        busy={saving}
        onConfirm={confirmRoleChange}
        onCancel={() => !saving && setPending(null)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title={t('revokePremiumTitle')}
        message={`${revokeTarget?.email ?? ''}. ${t('revokePremiumMsg')}`}
        confirmLabel={t('revoke')}
        cancelLabel={t('back')}
        tone="danger"
        busy={busy}
        onConfirm={confirmRevoke}
        onCancel={() => !busy && setRevokeTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('deleteUserTitle')}
        message={`${deleteTarget?.email ?? ''}. ${t('deleteUserMsg')}`}
        confirmLabel={t('delete')}
        cancelLabel={t('back')}
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => !busy && setDeleteTarget(null)}
      />

      {devicesTarget && (
        <DevicesModal user={devicesTarget} onClose={() => setDevicesTarget(null)} />
      )}

      {(() => {
        const detailUser = detailId ? users.find((u) => u.id === detailId) : undefined
        return detailUser ? (
          <UserDetailModal
            user={detailUser}
            onClose={() => setDetailId(null)}
            onChange={(patch) =>
              setUsers((prev) => prev.map((x) => (x.id === detailUser.id ? { ...x, ...patch } : x)))
            }
          />
        ) : null
      })()}
    </div>
  )
}

// ─── Devices / sessions (where a user is signed in) ──────────────────────────────
// Admin-only tooling: kept in English, matching the rest of the console.

/** "x min ago"-style label for a last-seen timestamp. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'active now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}

/** Pick a device icon + type label from the User-Agent-derived session label. */
function deviceKind(label: string | null): { Icon: typeof Monitor; type: string } {
  if (label && /iPad|Tablet/i.test(label)) return { Icon: Tablet, type: 'Tablet' }
  if (label && /iPhone|iPod|Android|Mobile/i.test(label)) return { Icon: Smartphone, type: 'Mobile' }
  return { Icon: Monitor, type: 'Desktop' }
}

function DevicesModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.superadmin
      .userSessions(user.id)
      .then(setSessions)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [user.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busyId, onClose])

  const signOut = async (id: string) => {
    setBusyId(id)
    try {
      await api.superadmin.revokeUserSession(user.id, id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      toast.success('Signed out of that device.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not sign out that device.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast"
      onClick={() => !busyId && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Device sessions"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <MonitorSmartphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-ink">Where they're signed in</h2>
            <p className="truncate font-body text-xs text-ink2">{user.email}</p>
          </div>
          <button
            onClick={() => !busyId && onClose()}
            aria-label="Close"
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle size={26} className="text-coral" />
            <p className="font-body text-sm text-ink2">Could not load sessions.</p>
            <button onClick={load} className="btn-soft press px-4 py-2 text-sm">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-10 text-center font-body text-sm text-ink2">
            No active sessions - this user isn't signed in on any device.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => {
              const { Icon, type } = deviceKind(s.label)
              const busy = busyId === s.id
              return (
                <li key={s.id} className="rounded-card border border-line bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-tint text-ink2">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-semibold text-ink">
                        {s.label || 'Unknown device'}
                        <span className="ml-1.5 font-body text-2xs uppercase tracking-wide text-ink2">
                          {type}
                        </span>
                      </p>
                      <p className="mt-0.5 font-body text-xs text-ink2">
                        Last active {relativeTime(s.last_seen_at)} · since{' '}
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut(s.id)}
                      disabled={!!busyId}
                      title="Sign out this device"
                      className="focus-ring inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-coral transition hover:border-coral/40 hover:bg-coral/5 disabled:opacity-50"
                    >
                      {busy ? <Spinner size={14} /> : <LogOut size={14} />}
                      Sign out
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── User detail popup ────────────────────────────────────────────────────────
// Opened by clicking a row in the Users tab: the full profile picture (name,
// email, phone, group, activity) plus each paid plan with grant/revoke controls.
// Grant comps the plan via a ₹0 paid ledger row (entitlement starts now for the
// plan's own window); revoke flips only THAT plan's paid rows to 'revoked'.
// Actions use an inline two-step confirm — ConfirmDialog sits at z-[55], below
// this z-[60] overlay, so a nested dialog would render behind the popup.

type PlanAction =
  | 'grant-premium'
  | 'revoke-premium'
  | 'grant-vettri'
  | 'revoke-vettri'
  | 'grant-rank-booster'
  | 'revoke-rank-booster'

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2">
      <p className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
        {label}
      </p>
      <p className="mt-0.5 truncate font-body text-sm text-ink" title={value}>
        {value}
      </p>
    </div>
  )
}

/** "42 min" / "3h 25m" from seconds of study time. */
function formatStudyTime(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Console label for a test_sessions.category value (unknown values pass through). */
const SECTION_LABELS: Record<string, string> = {
  pyq: 'PYQ · Group 1',
  pyq2: 'PYQ · Group 2',
  pyq4: 'PYQ · Group 4',
  subject: 'Subject practice',
  current_affairs: 'Current Affairs',
  aptitude: 'Aptitude',
  mock: 'Mock exams',
  testseries: 'Test Marathon',
  vettri: 'Vettri exams',
  samacheer: 'Samacheer',
  outer: 'Outer bank',
}
const sectionLabel = (c: string) => SECTION_LABELS[c] ?? c

/** Accuracy → traffic-light tone: the at-a-glance weakness signal. */
/** Human label for the profile's UI-language preference. */
function languageLabel(lang: 'en' | 'ta' | 'both' | null): string {
  if (lang === 'en') return 'English'
  if (lang === 'ta') return 'Tamil (தமிழ்)'
  if (lang === 'both') return 'Both (EN + தமிழ்)'
  return 'Not set'
}

/** "12 Oct 2026 · in 94d" (or overdue) for the profile's exam-date goal. */
function examDateLabel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
  const when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return days >= 0 ? `${when} · in ${days}d` : `${when} · passed`
}

/** Human label for a payments-ledger plan id. */
function planLabel(plan: string | null): string {
  if (plan === 'premium_annual') return 'Premium'
  if (plan === 'vettri_nichayam') return 'Vettri (full)'
  if (plan === 'vettri_month') return 'Vettri (monthly)'
  return plan ?? '—'
}

function accuracyTone(acc: number | null): { text: string; bar: string } {
  if (acc === null) return { text: 'text-ink2', bar: 'bg-ink2/40' }
  if (acc < 50) return { text: 'text-coral', bar: 'bg-coral' }
  if (acc < 75) return { text: 'text-amber-500', bar: 'bg-amber-400' }
  return { text: 'text-mint', bar: 'bg-mint' }
}

function UserDetailModal({
  user,
  onClose,
  onChange,
}: {
  user: AdminUserRow
  onClose: () => void
  onChange: (patch: Partial<AdminUserRow>) => void
}) {
  const [confirm, setConfirm] = useState<PlanAction | null>(null)
  const [busy, setBusy] = useState<PlanAction | null>(null)
  // Activity / weakness / credits snapshot — fetched per user when the popup
  // opens (too heavy to compute for every row of the list).
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setInsightsLoading(true)
    setInsights(null)
    api.superadmin
      .userInsights(user.id)
      .then((d) => {
        if (!cancelled) setInsights(d)
      })
      .catch(() => {}) // the section renders a quiet fallback
      .finally(() => !cancelled && setInsightsLoading(false))
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // Weak areas: subjects with enough evidence (≥10 attempted questions) and
  // accuracy under 60% — worst first. This is the coaching signal.
  const weakAreas = (insights?.subjects ?? [])
    .filter((s) => s.accuracy !== null && s.questions >= 10 && s.accuracy < 60)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, 4)

  const run = async (action: PlanAction) => {
    setBusy(action)
    try {
      if (action === 'revoke-premium') {
        await api.superadmin.revokePremium(user.id)
        onChange({ premium: false, premium_until: null })
        toast.success('Premium revoked.')
      } else if (action === 'grant-premium') {
        await api.superadmin.grantPlan(user.id, 'premium_annual')
        onChange({
          premium: true,
          premium_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        })
        toast.success('Premium granted for 180 days.')
      } else if (action === 'revoke-vettri') {
        await api.superadmin.revokeVettri(user.id)
        onChange({ vettri: false, vettri_until: null })
        toast.success('Group 1 Test Series revoked.')
      } else if (action === 'grant-vettri') {
        await api.superadmin.grantPlan(user.id, 'vettri_nichayam')
        onChange({
          vettri: true,
          vettri_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        })
        toast.success('Group 1 Test Series granted for 60 days.')
      } else if (action === 'revoke-rank-booster') {
        await api.superadmin.revokeRankBooster(user.id)
        onChange({ rank_booster: false, rank_booster_until: null })
        toast.success('Group II/IIA Test Series revoked.')
      } else {
        await api.superadmin.grantPlan(user.id, 'rank_booster_g2')
        onChange({
          rank_booster: true,
          rank_booster_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        toast.success('Group II/IIA Test Series granted for 30 days.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  const planRow = (opts: {
    icon: React.ReactNode
    iconClass: string
    name: string
    active: boolean
    until: string | null
    grant: PlanAction
    revoke: PlanAction
    grantLabel: string
  }) => {
    const action = opts.active ? opts.revoke : opts.grant
    const isBusy = busy === action
    const confirming = confirm === action
    return (
      <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
        <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg ${opts.iconClass}`}>
          {opts.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-ink">{opts.name}</p>
          <p className="font-body text-xs text-ink2">
            {opts.active
              ? `Active${opts.until ? ` · until ${new Date(opts.until).toLocaleDateString()}` : ''}`
              : 'Not active'}
          </p>
        </div>
        {confirming ? (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={() => run(action)}
              disabled={!!busy}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-heading text-xs font-semibold text-white transition disabled:opacity-60 ${
                opts.active ? 'bg-coral hover:bg-coral/90' : 'bg-brand hover:bg-brand-dark'
              }`}
            >
              {isBusy && <Spinner size={13} />} Confirm
            </button>
            <button
              onClick={() => setConfirm(null)}
              disabled={!!busy}
              className="focus-ring rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink2 transition hover:bg-tint disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(action)}
            disabled={!!busy}
            className={`focus-ring flex-shrink-0 rounded-lg border px-3 py-2 font-heading text-xs font-semibold transition disabled:opacity-50 ${
              opts.active
                ? 'border-line text-coral hover:border-coral/40 hover:bg-coral/5'
                : 'border-line text-brand hover:border-brand/40 hover:bg-brand-soft/50'
            }`}
          >
            {opts.active ? 'Revoke' : opts.grantLabel}
          </button>
        )}
      </div>
    )
  }

  const groupLabel = user.target_group
    ? GROUP_OPTIONS.find((g) => g.value === user.target_group)?.label ?? user.target_group
    : '—'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="User details"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card"
      >
        <div className="mb-5 flex items-start gap-3">
          <Avatar
            src={user.avatar_url}
            name={user.full_name ?? user.email}
            className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-brand-soft font-heading text-base font-bold uppercase text-brand"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-base font-semibold text-ink">
              {user.full_name || '—'}
            </h2>
            <p className="truncate font-body text-xs text-ink2">{user.email ?? '—'}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                {user.role}
              </span>
              {user.premium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-amber-500">
                  <Crown size={11} /> Premium
                </span>
              )}
              {user.vettri && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                  <Trophy size={11} /> Vettri
                </span>
              )}
              {user.rank_booster && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                  <Rocket size={11} /> Group II/IIA Test Series
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="focus-ring grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <DetailItem label="Phone" value={user.phone || '—'} />
          <DetailItem label="Target group" value={groupLabel} />
          <DetailItem label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
          <DetailItem
            label="Last active"
            value={user.last_active ? relativeTime(user.last_active) : 'Never'}
          />
          <DetailItem label="Tests taken" value={String(user.tests_taken)} />
          <DetailItem label="User ID" value={user.id} />
        </div>

        <h3 className="mb-2 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
          Plans
        </h3>
        <div className="space-y-2">
          {planRow({
            icon: <Crown size={18} />,
            iconClass: 'bg-amber-400/15 text-amber-500',
            name: 'Premium',
            active: user.premium,
            until: user.premium_until,
            grant: 'grant-premium',
            revoke: 'revoke-premium',
            grantLabel: 'Grant 180 days',
          })}
          {planRow({
            icon: <Trophy size={18} />,
            iconClass: 'bg-brand-soft text-brand',
            name: 'Group 1 Test Series',
            active: user.vettri,
            until: user.vettri_until,
            grant: 'grant-vettri',
            revoke: 'revoke-vettri',
            grantLabel: 'Grant 60 days',
          })}
          {planRow({
            icon: <Rocket size={18} />,
            iconClass: 'bg-brand-soft text-brand',
            name: 'Group II/IIA Test Series',
            active: user.rank_booster,
            until: user.rank_booster_until,
            grant: 'grant-rank-booster',
            revoke: 'revoke-rank-booster',
            grantLabel: 'Grant 30 days',
          })}
        </div>

        <MessageThreadSection userId={user.id} />

        {/* ── Targeting / activity / weakness / credits (superadmin_user_insights RPC) ── */}
        <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
          Insights
        </h3>
        {insightsLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
          </div>
        ) : !insights ? (
          <p className="font-body text-xs text-ink2">
            Could not load this user's activity. Close and reopen to retry.
          </p>
        ) : (
          <>
            {/* Reach & targeting: how to segment this user and which channels
                can actually deliver to them. */}
            {insights.targeting && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <DetailItem label="App language" value={languageLabel(insights.targeting.language)} />
                  <DetailItem
                    label="Gender"
                    value={
                      insights.targeting.gender
                        ? insights.targeting.gender[0].toUpperCase() + insights.targeting.gender.slice(1)
                        : '—'
                    }
                  />
                  <DetailItem label="Exam date" value={examDateLabel(insights.targeting.exam_date)} />
                  <DetailItem
                    label="Daily goal"
                    value={
                      insights.targeting.daily_goal != null
                        ? `${insights.targeting.daily_goal} questions`
                        : '—'
                    }
                  />
                  <DetailItem
                    label="Streak / active days 30d"
                    value={`${insights.targeting.streak} / ${insights.targeting.active_days_30d}`}
                  />
                  <DetailItem
                    label="Last login"
                    value={
                      insights.targeting.last_login_at
                        ? relativeTime(insights.targeting.last_login_at)
                        : 'Never'
                    }
                  />
                  <DetailItem
                    label="Push reachable"
                    value={
                      insights.targeting.push_devices > 0
                        ? `Yes · ${insights.targeting.push_devices} device${insights.targeting.push_devices === 1 ? '' : 's'}`
                        : 'No (in-app only)'
                    }
                  />
                  <DetailItem
                    label="Lifetime spend"
                    value={`₹${insights.targeting.payments.lifetime_rupees.toLocaleString()} · ${insights.targeting.payments.orders} order${insights.targeting.payments.orders === 1 ? '' : 's'}`}
                  />
                  <DetailItem label="Last plan" value={planLabel(insights.targeting.payments.last_plan)} />
                  <DetailItem
                    label="Feedback / error reports"
                    value={`${insights.targeting.feedback_count} / ${insights.targeting.report_count}`}
                  />
                  <DetailItem
                    label="Bookmarks / revision due"
                    value={`${insights.targeting.bookmark_count} / ${insights.targeting.revision_pending}`}
                  />
                  <DetailItem
                    label="Questions seen"
                    value={insights.targeting.seen_questions.toLocaleString()}
                  />
                </div>
                {insights.targeting.devices.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {insights.targeting.devices.map((d, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 font-heading text-2xs font-semibold text-ink2"
                      >
                        <MonitorSmartphone size={12} /> {d.label || 'Unknown device'} ·{' '}
                        {relativeTime(d.last_seen_at)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Activity
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailItem
                label="Study time"
                value={formatStudyTime(insights.totals.time_seconds)}
              />
              <DetailItem
                label="Questions attempted"
                value={String(insights.totals.questions)}
              />
              <DetailItem
                label="Avg accuracy"
                value={insights.totals.accuracy !== null ? `${insights.totals.accuracy}%` : '—'}
              />
              <DetailItem
                label="Tests · 7d / 30d"
                value={`${insights.totals.tests_7d} / ${insights.totals.tests_30d}`}
              />
            </div>

            <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Weak areas
            </h3>
            {weakAreas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {weakAreas.map((s) => (
                  <span
                    key={s.subject}
                    className="inline-flex items-center gap-1 rounded-full bg-coralsoft px-2.5 py-1 font-heading text-2xs font-semibold text-coral"
                  >
                    <TrendingDown size={12} /> {s.subject} · {s.accuracy}%
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-body text-xs text-ink2">
                No clear weak areas yet (needs ≥10 attempted questions under 60% in a subject).
              </p>
            )}

            <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Subjects practised
            </h3>
            {insights.subjects.length === 0 ? (
              <p className="font-body text-xs text-ink2">No subject-tagged tests yet.</p>
            ) : (
              <div className="space-y-2">
                {insights.subjects.map((s) => {
                  const tone = accuracyTone(s.accuracy)
                  return (
                    <div
                      key={s.subject}
                      className="rounded-card border border-line bg-surface px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-heading text-xs font-semibold text-ink">
                          {s.subject}
                        </p>
                        <span className={`flex-shrink-0 font-heading text-xs font-bold ${tone.text}`}>
                          {s.accuracy !== null ? `${s.accuracy}%` : '—'}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tint">
                        <div
                          className={`h-full rounded-full ${tone.bar}`}
                          style={{ width: `${Math.max(2, Math.min(100, s.accuracy ?? 0))}%` }}
                        />
                      </div>
                      <p className="mt-1 font-body text-2xs text-ink2">
                        {s.tests} tests · {s.questions} questions · {formatStudyTime(s.time_seconds)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Sections used
            </h3>
            {insights.categories.length === 0 ? (
              <p className="font-body text-xs text-ink2">No completed tests yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {insights.categories.map((c) => (
                  <span
                    key={c.category}
                    className="inline-flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 font-heading text-2xs font-semibold text-ink2"
                  >
                    {sectionLabel(c.category)} · {c.tests}
                    {c.accuracy !== null && (
                      <span className={accuracyTone(c.accuracy).text}>({c.accuracy}%)</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              <Coins size={12} /> Credits
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailItem label="Balance" value={String(insights.credits.balance)} />
              <DetailItem label="Used on tests" value={String(insights.credits.spent)} />
              <DetailItem label="Expiring today" value={String(insights.credits.daily_left)} />
              <DetailItem label="Expired unused" value={String(insights.credits.expired)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Compact "3h ago" / "2d ago" — relativeTime() above is worded for "last
 *  active" status ("active now") and reads oddly under a chat bubble. */
function msgTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** The shared thread with one student — same data ContactReporter's "Send
 *  in-app" writes into, so a Reports follow-up and a Users-tab conversation
 *  are one inbox, not two. Bubbles keep it scannable at a glance; a student
 *  replies from their own /messages page. */
function MessageThreadSection({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<MessageItem[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setMessages(null)
    api.superadmin.messages
      .thread(userId)
      .then((d) => !cancelled && setMessages(d.messages))
      .catch(() => !cancelled && setMessages([]))
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const { message } = await api.superadmin.messages.send(userId, { body })
      setMessages((prev) => [...(prev ?? []), message])
      setDraft('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <h3 className="mb-2 mt-5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
        Messages
      </h3>
      <div className="rounded-card border border-line bg-surface p-3">
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {messages === null ? (
            <p className="py-4 text-center font-body text-xs text-ink2">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="py-4 text-center font-body text-xs text-ink2">
              No messages yet — say hello.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 font-body text-xs ${
                    m.sender === 'admin' ? 'bg-brand text-white' : 'bg-tint text-ink'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p className={`mt-1 text-2xs ${m.sender === 'admin' ? 'text-white/70' : 'text-ink2'}`}>
                    {msgTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            placeholder="Type a message…"
            className="focus-ring flex-1 rounded-lg border border-line bg-card px-3 py-2 font-body text-xs text-ink outline-none transition hover:border-brand/40"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {sending ? <Spinner size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Mock exams (full, named papers) ─────────────────────────────────────────
function MockExamsTab() {
  const { t } = useT()
  const [exams, setExams] = useState<MockExamAdmin[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Mock Test section visibility flags (app_settings) — superadmin can hide the
  // random-sampled Group Exam and Subject/Topic tabs for all students.
  const [groupOn, setGroupOn] = useState(false)
  const [subjectOn, setSubjectOn] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([api.superadmin.mockExams(), api.superadmin.settings()])
      .then(([ex, settings]) => {
        setExams(ex)
        setGroupOn(Boolean(settings.mock_group_enabled))
        setSubjectOn(Boolean(settings.mock_subject_enabled))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggleSetting = async (key: 'mock_group_enabled' | 'mock_subject_enabled', next: boolean) => {
    setSavingKey(key)
    // Optimistic; revert on failure.
    if (key === 'mock_group_enabled') setGroupOn(next)
    else setSubjectOn(next)
    try {
      await api.superadmin.setSetting(key, next)
    } catch {
      toast.error(t('couldNotLoad'))
      if (key === 'mock_group_enabled') setGroupOn(!next)
      else setSubjectOn(!next)
    } finally {
      setSavingKey(null)
    }
  }

  const patch = async (
    id: string,
    p: Partial<{ enabled: boolean; tier: 'free' | 'paid'; duration_seconds: number }>
  ) => {
    setSavingId(id)
    try {
      const updated = await api.superadmin.setMockExam(id, p)
      setExams((xs) => xs.map((e) => (e.id === id ? { ...e, ...updated } : e)))
    } catch {
      toast.error(t('couldNotLoad'))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
    )
  }
  if (error) return <ErrorState onRetry={load} />

  const enabledCount = exams.filter((e) => e.enabled).length

  return (
    <div>
      <div className="card mb-4 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
            <ClipboardList size={20} />
          </span>
          <div>
            <p className="font-heading text-xl font-semibold text-ink">
              {enabledCount}/{exams.length}
            </p>
            <p className="font-body text-xs text-ink2">{t('mockExamsTab')} · enabled</p>
          </div>
        </div>
      </div>

      {/* Section visibility — hide/show the random-sampled mock tabs for students */}
      <div className="card mb-4 p-4">
        <p className="mb-1 font-heading text-sm font-semibold text-ink">{t('mockSectionsTitle')}</p>
        <p className="mb-3 font-body text-xs text-ink2">{t('mockSectionsSub')}</p>
        <div className="space-y-2.5">
          {(
            [
              { key: 'mock_group_enabled', label: t('mockGroupExam'), on: groupOn },
              { key: 'mock_subject_enabled', label: t('mockSubjectExam'), on: subjectOn },
            ] as const
          ).map(({ key, label, on }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="tamil font-body text-sm text-ink">{label}</span>
              <button
                disabled={savingKey === key}
                onClick={() => toggleSetting(key, !on)}
                aria-pressed={on}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                  on ? 'bg-correct' : 'bg-ink2/30'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    on ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {exams.map((e) => {
          const minutes = Math.round(e.duration_seconds / 60)
          const short = e.loaded_questions !== e.total_questions
          const busy = savingId === e.id
          return (
            <div key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="tamil font-heading text-sm font-semibold text-ink">{e.title}</p>
                  <p className="font-body text-xs text-ink2">
                    {e.loaded_questions}/{e.total_questions} questions
                    {short && <span className="text-wrong"> · mismatch</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tier selector */}
                  <div className="flex overflow-hidden rounded-lg border border-line">
                    {(['free', 'paid'] as const).map((tr) => (
                      <button
                        key={tr}
                        disabled={busy || e.tier === tr}
                        onClick={() => patch(e.id, { tier: tr })}
                        className={`px-3 py-1.5 font-heading text-xs font-medium capitalize transition-colors ${
                          e.tier === tr ? 'bg-brand text-white' : 'bg-card text-ink2 hover:text-ink'
                        } disabled:cursor-default`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>

                  {/* Duration (minutes) */}
                  <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <Clock size={14} className="text-ink2" />
                    <input
                      type="number"
                      min={1}
                      defaultValue={minutes}
                      disabled={busy}
                      onBlur={(ev) => {
                        const m = Math.trunc(Number(ev.target.value))
                        if (m > 0 && m !== minutes) patch(e.id, { duration_seconds: m * 60 })
                      }}
                      className="w-14 bg-transparent font-heading text-sm text-ink outline-none"
                    />
                    <span className="font-body text-xs text-ink2">{t('minutesUnit')}</span>
                  </label>

                  {/* Enabled toggle */}
                  <button
                    disabled={busy}
                    onClick={() => patch(e.id, { enabled: !e.enabled })}
                    aria-pressed={e.enabled}
                    className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                      e.enabled ? 'bg-correct' : 'bg-ink2/30'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        e.enabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Test Series ────────────────────────────────────────────────────────────────
type AdminSeries = 'g1_marathon' | 'g2a_rankbooster'

// Labeled to match the student-facing hub tabs exactly ("Group 1 Test Series" /
// "Rank Booster" inside the Test Marathon hub — see TestSeriesPage.tsx).
const SERIES_TABS: { key: AdminSeries; labelKey: 'vettriTitle' | 'rankBoosterTab'; settingKey: 'test_series_enabled' | 'rank_booster_enabled' }[] = [
  { key: 'g1_marathon', labelKey: 'vettriTitle', settingKey: 'test_series_enabled' },
  { key: 'g2a_rankbooster', labelKey: 'rankBoosterTab', settingKey: 'rank_booster_enabled' },
]

function TestSeriesTab() {
  const { t } = useT()
  const [series, setSeries] = useState<AdminSeries>('g1_marathon')
  const [tests, setTests] = useState<TestSeriesAdmin[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const active = SERIES_TABS.find((s) => s.key === series)!

  // Master visibility flag (app_settings) — hides the whole tab + Test Arena
  // tile for all students until turned on. One flag per series.
  const [seriesOn, setSeriesOn] = useState(false)
  const [savingFlag, setSavingFlag] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([api.superadmin.testSeries(series), api.superadmin.settings()])
      .then(([ts, settings]) => {
        setTests(ts)
        setSeriesOn(Boolean(settings[active.settingKey]))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [series])

  const toggleSeries = async (next: boolean) => {
    setSavingFlag(true)
    setSeriesOn(next) // optimistic
    try {
      await api.superadmin.setSetting(active.settingKey, next)
    } catch {
      toast.error(t('couldNotLoad'))
      setSeriesOn(!next)
    } finally {
      setSavingFlag(false)
    }
  }

  const patch = async (
    id: string,
    p: Partial<{
      enabled: boolean
      open_override: 'auto' | 'open' | 'closed'
      scheduled_date: string
      duration_seconds: number
      tier: 'free' | 'paid'
    }>
  ) => {
    setSavingId(id)
    try {
      const updated = await api.superadmin.setTestSeries(id, p)
      setTests((xs) => xs.map((e) => (e.id === id ? { ...e, ...updated } : e)))
    } catch {
      toast.error(t('couldNotLoad'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      {/* Series switcher — one catalog table, two products. */}
      <div className="mb-4 flex w-full rounded-field bg-tint p-0.5 sm:w-auto sm:inline-flex">
        {SERIES_TABS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSeries(s.key)}
            aria-pressed={series === s.key}
            className={`flex-1 rounded-[10px] px-3 py-1.5 text-center font-heading text-xs font-semibold leading-tight transition-colors sm:flex-none ${
              series === s.key ? 'bg-card text-brand shadow-sm' : 'text-ink2 hover:text-ink'
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : (
        <TestSeriesTabBody
          active={active}
          tests={tests}
          seriesOn={seriesOn}
          savingFlag={savingFlag}
          savingId={savingId}
          onToggleSeries={toggleSeries}
          onPatch={patch}
        />
      )}
    </div>
  )
}

function TestSeriesTabBody({
  active,
  tests,
  seriesOn,
  savingFlag,
  savingId,
  onToggleSeries,
  onPatch,
}: {
  active: (typeof SERIES_TABS)[number]
  tests: TestSeriesAdmin[]
  seriesOn: boolean
  savingFlag: boolean
  savingId: string | null
  onToggleSeries: (next: boolean) => void
  onPatch: (
    id: string,
    p: Partial<{
      enabled: boolean
      open_override: 'auto' | 'open' | 'closed'
      scheduled_date: string
      duration_seconds: number
      tier: 'free' | 'paid'
    }>
  ) => void
}) {
  const { t } = useT()
  const enabledCount = tests.filter((e) => e.enabled).length

  return (
    <div>
      <div className="card mb-4 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
            <CalendarDays size={20} />
          </span>
          <div>
            <p className="font-heading text-xl font-semibold text-ink">
              {enabledCount}/{tests.length}
            </p>
            <p className="font-body text-xs text-ink2">{t(active.labelKey)} · enabled</p>
          </div>
        </div>
      </div>

      {/* Master visibility — show/hide this series' tab + tile for students */}
      <div className="card mb-4 p-4">
        <p className="mb-1 font-heading text-sm font-semibold text-ink">{t('testSeriesShowTitle')}</p>
        <p className="mb-3 font-body text-xs text-ink2">{t('testSeriesShowSub')}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="tamil font-body text-sm text-ink">{t(active.labelKey)}</span>
          <button
            disabled={savingFlag}
            onClick={() => onToggleSeries(!seriesOn)}
            aria-pressed={seriesOn}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
              seriesOn ? 'bg-correct' : 'bg-ink2/30'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                seriesOn ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {tests.map((e) => {
          const minutes = Math.round(e.duration_seconds / 60)
          const short = e.loaded_questions !== e.total_questions
          const busy = savingId === e.id
          return (
            <div key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="tamil font-heading text-sm font-semibold text-ink">
                    {e.title}
                    {e.unit_label && (
                      <span className="ml-2 font-body text-xs text-ink2">· {e.unit_label}</span>
                    )}
                  </p>
                  <p className="font-body text-xs text-ink2">
                    {e.loaded_questions}/{e.total_questions} questions
                    {short && <span className="text-wrong"> · mismatch</span>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Tier: free trial vs paid-bundle-gated */}
                  <select
                    value={e.tier}
                    disabled={busy}
                    onChange={(ev) => onPatch(e.id, { tier: ev.target.value as 'free' | 'paid' })}
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 font-heading text-xs text-ink outline-none disabled:opacity-50"
                  >
                    <option value="paid">{t('testSeriesTierPaid')}</option>
                    <option value="free">{t('testSeriesTierFree')}</option>
                  </select>

                  {/* Availability override */}
                  <select
                    value={e.open_override}
                    disabled={busy}
                    onChange={(ev) =>
                      onPatch(e.id, {
                        open_override: ev.target.value as 'auto' | 'open' | 'closed',
                      })
                    }
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 font-heading text-xs text-ink outline-none disabled:opacity-50"
                  >
                    <option value="auto">{t('availabilityAuto')}</option>
                    <option value="open">{t('availabilityOpen')}</option>
                    <option value="closed">{t('availabilityClosed')}</option>
                  </select>

                  {/* Scheduled date */}
                  <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <CalendarDays size={14} className="text-ink2" />
                    <input
                      type="date"
                      defaultValue={e.scheduled_date ?? ''}
                      disabled={busy}
                      onBlur={(ev) => {
                        const v = ev.target.value
                        if (v && v !== e.scheduled_date) onPatch(e.id, { scheduled_date: v })
                      }}
                      className="bg-transparent font-heading text-xs text-ink outline-none"
                    />
                  </label>

                  {/* Duration (minutes) */}
                  <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <Clock size={14} className="text-ink2" />
                    <input
                      type="number"
                      min={1}
                      defaultValue={minutes}
                      disabled={busy}
                      onBlur={(ev) => {
                        const m = Math.trunc(Number(ev.target.value))
                        if (m > 0 && m !== minutes) onPatch(e.id, { duration_seconds: m * 60 })
                      }}
                      className="w-14 bg-transparent font-heading text-sm text-ink outline-none"
                    />
                    <span className="font-body text-xs text-ink2">{t('minutesUnit')}</span>
                  </label>

                  {/* Enabled toggle */}
                  <button
                    disabled={busy}
                    onClick={() => onPatch(e.id, { enabled: !e.enabled })}
                    aria-pressed={e.enabled}
                    className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                      e.enabled ? 'bg-correct' : 'bg-ink2/30'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        e.enabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vettri Nichayam exams ──────────────────────────────────────────────────────

function VettriExamsTab() {
  const { t } = useT()
  const [exams, setExams] = useState<VettriExamAdmin[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Master visibility flag (app_settings) — hides the whole Vettri tab + Test
  // Arena tile for all students until turned on.
  const [vettriOn, setVettriOn] = useState(false)
  const [savingFlag, setSavingFlag] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([api.superadmin.vettriExams(), api.superadmin.settings()])
      .then(([ex, settings]) => {
        setExams(ex)
        setVettriOn(Boolean(settings.vettri_enabled))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggleVettri = async (next: boolean) => {
    setSavingFlag(true)
    setVettriOn(next) // optimistic
    try {
      await api.superadmin.setSetting('vettri_enabled', next)
    } catch {
      toast.error(t('couldNotLoad'))
      setVettriOn(!next)
    } finally {
      setSavingFlag(false)
    }
  }

  const patch = async (
    id: string,
    p: Partial<{ enabled: boolean; total_questions: number; duration_seconds: number }>
  ) => {
    setSavingId(id)
    try {
      const updated = await api.superadmin.setVettriExam(id, p)
      setExams((xs) => xs.map((e) => (e.id === id ? { ...e, ...updated } : e)))
    } catch {
      toast.error(t('couldNotLoad'))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
    )
  }
  if (error) return <ErrorState onRetry={load} />

  const enabledCount = exams.filter((e) => e.enabled).length

  return (
    <div>
      <div className="card mb-4 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
            <Trophy size={20} />
          </span>
          <div>
            <p className="font-heading text-xl font-semibold text-ink">
              {enabledCount}/{exams.length}
            </p>
            <p className="font-body text-xs text-ink2">{t('vettriTab')} · enabled</p>
          </div>
        </div>
      </div>

      {/* Master visibility — show/hide the whole Vettri feature for students */}
      <div className="card mb-4 p-4">
        <p className="mb-1 font-heading text-sm font-semibold text-ink">{t('vettriShowTitle')}</p>
        <p className="mb-3 font-body text-xs text-ink2">{t('vettriShowSub')}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="tamil font-body text-sm text-ink">{t('vettriTitle')}</span>
          <button
            disabled={savingFlag}
            onClick={() => toggleVettri(!vettriOn)}
            aria-pressed={vettriOn}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
              vettriOn ? 'bg-correct' : 'bg-ink2/30'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                vettriOn ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {exams.map((e) => {
          const minutes = Math.round(e.duration_seconds / 60)
          const short = e.loaded_questions !== e.total_questions
          const empty = e.loaded_questions === 0
          const busy = savingId === e.id
          return (
            <div key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="tamil font-heading text-sm font-semibold text-ink">{e.title}</p>
                  <p className="font-body text-xs text-ink2">
                    {e.loaded_questions}/{e.total_questions} questions
                    {empty ? (
                      <span className="text-wrong"> · no questions loaded</span>
                    ) : (
                      short && <span className="text-wrong"> · mismatch</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Total questions */}
                  <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <FileText size={14} className="text-ink2" />
                    <input
                      type="number"
                      min={1}
                      defaultValue={e.total_questions}
                      disabled={busy}
                      onBlur={(ev) => {
                        const n = Math.trunc(Number(ev.target.value))
                        if (n > 0 && n !== e.total_questions) patch(e.id, { total_questions: n })
                      }}
                      className="w-14 bg-transparent font-heading text-sm text-ink outline-none"
                    />
                    <span className="font-body text-xs text-ink2">Q</span>
                  </label>

                  {/* Duration (minutes) */}
                  <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <Clock size={14} className="text-ink2" />
                    <input
                      type="number"
                      min={1}
                      defaultValue={minutes}
                      disabled={busy}
                      onBlur={(ev) => {
                        const m = Math.trunc(Number(ev.target.value))
                        if (m > 0 && m !== minutes) patch(e.id, { duration_seconds: m * 60 })
                      }}
                      className="w-14 bg-transparent font-heading text-sm text-ink outline-none"
                    />
                    <span className="font-body text-xs text-ink2">{t('minutesUnit')}</span>
                  </label>

                  {/* Enabled toggle (guarded: don't enable an empty exam) */}
                  <button
                    disabled={busy || (!e.enabled && empty)}
                    title={!e.enabled && empty ? 'Load questions before enabling' : undefined}
                    onClick={() => patch(e.id, { enabled: !e.enabled })}
                    aria-pressed={e.enabled}
                    className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                      e.enabled ? 'bg-correct' : 'bg-ink2/30'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        e.enabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Feedback ───────────────────────────────────────────────────────────────────
function FeedbackTab() {
  const { t } = useT()
  const [items, setItems] = useState<FeedbackRow[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError(false)
    api.superadmin
      .feedback()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const avg = items.length
    ? (items.reduce((s, f) => s + f.rating, 0) / items.length).toFixed(2)
    : '-'

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full" />
        ))}
      </div>
    )
  }
  if (error) return <ErrorState onRetry={load} />

  return (
    <div>
      <div className="card mb-4 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-goldsoft text-gold">
            <Star size={20} />
          </span>
          <div>
            <p className="font-heading text-xl font-semibold text-ink">{avg}</p>
            <p className="font-body text-xs text-ink2">{t('avgRating')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-semibold text-ink">{items.length}</p>
          <p className="font-body text-xs text-ink2">{t('totalFeedback')}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center font-body text-ink2">{t('noFeedback')}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((f, i) => (
            <div
              key={f.id}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item p-4"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Stars rating={f.rating} />
                <span className="font-body text-2xs text-ink2">
                  {new Date(f.created_at).toLocaleDateString()}
                </span>
              </div>
              {f.message && (
                <p className="tamil mb-2 whitespace-pre-line font-body text-sm text-ink">{f.message}</p>
              )}
              <p className="font-body text-xs text-ink2">
                {f.user_name || 'Anonymous'}
                {f.user_email ? ` · ${f.user_email}` : ''}
                {f.page ? ` · ${f.page}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={15}
          className={n <= rating ? 'fill-gold text-gold' : 'text-line'}
        />
      ))}
    </span>
  )
}

// ─── Coupons ────────────────────────────────────────────────────────────────────
// Admin-only tooling: kept in English (matches the rest of the console's intent).
const COUPON_INPUT =
  'focus-ring w-full rounded-lg border border-line bg-card px-3 py-2 font-body text-sm text-ink outline-none transition placeholder:text-ink2/50 hover:border-brand/40'

function paiseToRupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/** Human label for a coupon's discount, e.g. "20% (max ₹300)" or "₹150 off". */
function discountLabel(c: CouponWithStats): string {
  if (c.discount_type === 'flat') return `₹${paiseToRupees(c.discount_value)} off`
  const cap = c.max_discount != null ? ` (max ₹${paiseToRupees(c.max_discount)})` : ''
  return `${c.discount_value}% off${cap}`
}

const EMPTY_COUPON_FORM = {
  promoterName: '',
  code: '',
  discountType: 'percent' as DiscountType,
  value: '',
  maxDiscount: '',
  maxRedemptions: '',
  expiresAt: '',
}

/**
 * Pager for a long client-side list. Shows first/last and a window around the
 * current page, so 60 pages don't produce 60 buttons. Rendered only when there
 * is more than one page.
 */
function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (p: number) => void
}) {
  // First, last, and up to two either side of the current page - gaps become "…".
  const window = new Set<number>([1, pageCount])
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= pageCount) window.add(p)
  const pages = [...window].sort((a, b) => a - b)

  const step = (delta: number) => onChange(Math.min(Math.max(page + delta, 1), pageCount))
  const btn =
    'focus-ring press grid h-9 min-w-9 place-items-center rounded-lg px-2.5 font-heading text-sm font-semibold transition disabled:opacity-40'

  return (
    <nav className="mt-5 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`${btn} border border-line bg-card text-ink2 hover:text-ink`}
      >
        ‹
      </button>
      {pages.map((p, i) => (
        <Fragment key={p}>
          {i > 0 && p - pages[i - 1] > 1 && (
            <span className="px-1 font-body text-xs text-ink2">…</span>
          )}
          <button
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${
              p === page
                ? 'bg-brand text-white'
                : 'border border-line bg-card text-ink2 hover:text-ink'
            }`}
          >
            {p}
          </button>
        </Fragment>
      ))}
      <button
        type="button"
        onClick={() => step(1)}
        disabled={page === pageCount}
        aria-label="Next page"
        className={`${btn} border border-line bg-card text-ink2 hover:text-ink`}
      >
        ›
      </button>
    </nav>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
        {label}
      </span>
      {children}
    </label>
  )
}

function CouponsTab() {
  const [list, setList] = useState<CouponWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [form, setForm] = useState(EMPTY_COUPON_FORM)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CouponWithStats | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.coupons
      .list()
      .then(setList)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creating) return
    const promoterName = form.promoterName.trim()
    if (!promoterName) return toast.error('Promoter name is required.')
    const num = Number(form.value)
    if (!Number.isFinite(num) || num <= 0) return toast.error('Enter a valid discount value.')
    if (form.discountType === 'percent' && (num < 1 || num > 100)) {
      return toast.error('Percentage must be between 1 and 100.')
    }

    const payload: CouponInput = {
      promoterName,
      code: form.code.trim() || undefined,
      discountType: form.discountType,
      discountValue: form.discountType === 'flat' ? Math.round(num * 100) : Math.round(num),
      maxDiscount:
        form.discountType === 'percent' && form.maxDiscount.trim()
          ? Math.round(Number(form.maxDiscount) * 100)
          : null,
      maxRedemptions: form.maxRedemptions.trim() ? Math.round(Number(form.maxRedemptions)) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    }

    setCreating(true)
    try {
      const created = await api.coupons.create(payload)
      setList((prev) => [{ ...created, redemptions: 0, total_discount: 0 }, ...prev])
      setForm(EMPTY_COUPON_FORM)
      toast.success(`Coupon ${created.code} created.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create coupon.')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (c: CouponWithStats) => {
    setBusyId(c.id)
    try {
      const updated = await api.coupons.update(c.id, { active: !c.active })
      setList((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: updated.active } : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update coupon.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    try {
      await api.coupons.remove(pendingDelete.id)
      setList((prev) => prev.filter((x) => x.id !== pendingDelete.id))
      toast.success('Coupon deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete coupon.')
    } finally {
      setBusyId(null)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success(`Copied ${code}`),
      () => {}
    )
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Plus size={16} className="text-brand" /> New promoter coupon
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Promoter name *">
            <input
              className={COUPON_INPUT}
              value={form.promoterName}
              onChange={(e) => set('promoterName', e.target.value)}
              placeholder="e.g. Riyaz"
            />
          </Field>
          <Field label="Code (optional - auto-generated)">
            <input
              className={COUPON_INPUT}
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="e.g. RIYAZ20"
              spellCheck={false}
            />
          </Field>
          <Field label="Discount type">
            <select
              className={COUPON_INPUT}
              value={form.discountType}
              onChange={(e) => set('discountType', e.target.value)}
            >
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat amount (₹)</option>
            </select>
          </Field>
          <Field label={form.discountType === 'flat' ? 'Amount off (₹)' : 'Percentage (%)'}>
            <input
              className={COUPON_INPUT}
              type="number"
              min="1"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              placeholder={form.discountType === 'flat' ? '150' : '20'}
            />
          </Field>
          {form.discountType === 'percent' && (
            <Field label="Max discount cap (₹, optional)">
              <input
                className={COUPON_INPUT}
                type="number"
                min="1"
                value={form.maxDiscount}
                onChange={(e) => set('maxDiscount', e.target.value)}
                placeholder="e.g. 300"
              />
            </Field>
          )}
          <Field label="Max redemptions (optional)">
            <input
              className={COUPON_INPUT}
              type="number"
              min="1"
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
              placeholder="unlimited"
            />
          </Field>
          <Field label="Expires on (optional)">
            <input
              className={COUPON_INPUT}
              type="date"
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
            />
          </Field>
        </div>
        <button type="submit" disabled={creating} className="btn-brand press disabled:opacity-60">
          {creating ? <Spinner size={16} /> : <Plus size={16} />} Create coupon
        </button>
      </form>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : list.length === 0 ? (
        <p className="py-12 text-center font-body text-ink2">No coupons yet - create one above.</p>
      ) : (
        <div className="space-y-2">
          {list.map((c, i) => (
            <div
              key={c.id}
              style={{ '--i': i } as React.CSSProperties}
              className={`card stagger-item flex flex-wrap items-center gap-3 p-3.5 ${
                c.active ? '' : 'opacity-60'
              }`}
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Ticket size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-heading text-sm font-bold tracking-wide text-ink">
                    {c.code}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyCode(c.code)}
                    aria-label="Copy code"
                    className="text-ink2/60 transition-colors hover:text-brand"
                  >
                    <Copy size={13} />
                  </button>
                  {!c.active && (
                    <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-semibold uppercase text-ink2">
                      Paused
                    </span>
                  )}
                </div>
                <p className="truncate font-body text-xs text-ink2">
                  {c.promoter_name} · {discountLabel(c)}
                  {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ''}
                  {c.max_redemptions != null ? ` · limit ${c.max_redemptions}` : ''}
                </p>
              </div>
              <div className="text-center">
                <p className="font-heading text-sm font-semibold text-ink">{c.redemptions}</p>
                <p className="font-body text-2xs uppercase tracking-wide text-ink2">used</p>
              </div>
              <div className="text-center">
                <p className="font-heading text-sm font-semibold text-ink">
                  ₹{paiseToRupees(c.total_discount)}
                </p>
                <p className="font-body text-2xs uppercase tracking-wide text-ink2">given</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleActive(c)}
                  disabled={busyId === c.id}
                  className="focus-ring inline-flex min-h-9 items-center rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink transition hover:border-brand/40 disabled:opacity-50"
                >
                  {c.active ? 'Pause' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(c)}
                  disabled={busyId === c.id}
                  aria-label="Delete coupon"
                  className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-coral transition hover:border-coral/40 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete coupon?"
        message={`Delete ${pendingDelete?.code ?? ''}? Past payments keep their record, but the code stops working.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={busyId === pendingDelete?.id}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ─── Notifications ──────────────────────────────────────────────────────────────
// Two sub-tabs: "Send to Users" (a real Web Push + in-app feed entry) and
// "System" (in-app announcement only). Both target an audience. English copy,
// matching the rest of the console.
const AUDIENCE_OPTIONS: { value: NotificationAudience; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'premium', label: 'Premium users' },
  { value: 'free', label: 'Starter users' },
  { value: 'group', label: 'By target group' },
]

const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: 'Group1', label: 'Group 1' },
  { value: 'Group2_2A', label: 'Group 2 / 2A' },
  { value: 'Group4_VAO', label: 'Group 4 / VAO' },
]

const EMPTY_NOTIF_FORM = {
  title: '',
  body: '',
  titleTa: '',
  bodyTa: '',
  url: '',
  audience: 'all' as NotificationAudience,
  audienceValue: 'Group1',
}

function NotificationsTab() {
  const [sub, setSub] = useState<NotificationKind | 'alert'>('push')
  const [form, setForm] = useState(EMPTY_NOTIF_FORM)
  const [sending, setSending] = useState(false)
  const [list, setList] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AdminNotification | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.notifications
      .adminList()
      .then(setList)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || sub === 'alert') return // alerts have their own composer (AlertsPanel)
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title || !body) return toast.error('Title and message are required.')

    setSending(true)
    try {
      const res = await api.notifications.create({
        kind: sub,
        title,
        body,
        titleTa: form.titleTa.trim() || null,
        bodyTa: form.bodyTa.trim() || null,
        url: form.url.trim() || null,
        audience: form.audience,
        audienceValue: form.audience === 'group' ? form.audienceValue : null,
      })
      if (sub === 'push') {
        toast.success(
          res.pushEnabled
            ? `Sent to ${res.pushSent} device${res.pushSent === 1 ? '' : 's'} + in-app feed.`
            : 'Saved to in-app feed (Web Push not configured on the server).'
        )
      } else {
        toast.success('Announcement published to the in-app feed.')
      }
      setForm(EMPTY_NOTIF_FORM)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send notification.')
    } finally {
      setSending(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await api.notifications.remove(pendingDelete.id)
      setList((prev) => prev.filter((n) => n.id !== pendingDelete.id))
      toast.success('Notification deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const audienceLabel = (n: AdminNotification): string => {
    if (n.audience === 'group') {
      return GROUP_OPTIONS.find((g) => g.value === n.audience_value)?.label ?? n.audience_value ?? 'group'
    }
    return AUDIENCE_OPTIONS.find((a) => a.value === n.audience)?.label ?? n.audience
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSub('push')}
          className={`press flex items-center gap-2 rounded-lg px-4 py-2 font-heading text-sm font-medium transition ${
            sub === 'push' ? 'bg-brand text-white shadow-brand' : 'bg-tint text-ink2 hover:text-ink'
          }`}
        >
          <Send size={15} /> Send to Users
        </button>
        <button
          onClick={() => setSub('system')}
          className={`press flex items-center gap-2 rounded-lg px-4 py-2 font-heading text-sm font-medium transition ${
            sub === 'system' ? 'bg-brand text-white shadow-brand' : 'bg-tint text-ink2 hover:text-ink'
          }`}
        >
          <Megaphone size={15} /> System Notifications
        </button>
        <button
          onClick={() => setSub('alert')}
          className={`press flex items-center gap-2 rounded-lg px-4 py-2 font-heading text-sm font-medium transition ${
            sub === 'alert' ? 'bg-brand text-white shadow-brand' : 'bg-tint text-ink2 hover:text-ink'
          }`}
        >
          <AlertTriangle size={15} /> Popup Alerts
        </button>
      </div>

      {sub === 'alert' && <AlertsPanel />}
      {sub !== 'alert' && (
      <>
      {/* Composer */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="flex items-start gap-2">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            {sub === 'push' ? <Bell size={18} /> : <Megaphone size={18} />}
          </span>
          <div>
            <h2 className="font-heading text-sm font-semibold text-ink">
              {sub === 'push' ? 'Send a push notification' : 'Post a system announcement'}
            </h2>
            <p className="font-body text-xs text-ink2">
              {sub === 'push'
                ? 'Delivered to subscribed devices (desktop & Android) and the in-app feed.'
                : 'Shown only inside the app (in-app feed / bell). No device push.'}
            </p>
          </div>
        </div>

        <Field label="Title *">
          <input
            className={COUPON_INPUT}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. New mock test added"
            maxLength={120}
          />
        </Field>
        <Field label="Message *">
          <textarea
            className={COUPON_INPUT + ' min-h-[80px] resize-y'}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="Write the notification message…"
            maxLength={500}
          />
        </Field>

        {/* Bilingual variant — delivered by the user's chosen app language:
            Tamil users get this copy, "both" users see English + Tamil, and
            English users always get the fields above. Blank = English to all. */}
        <div className="rounded-card border border-dashed border-line bg-tint/40 p-3.5">
          <p className="mb-2.5 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
            Tamil version (optional) — sent to users whose app language is Tamil
          </p>
          <div className="space-y-3">
            <Field label="Title (Tamil)">
              <input
                className={COUPON_INPUT}
                value={form.titleTa}
                onChange={(e) => set('titleTa', e.target.value)}
                placeholder="எ.கா. புதிய மாதிரித் தேர்வு சேர்க்கப்பட்டது"
                maxLength={120}
              />
            </Field>
            <Field label="Message (Tamil)">
              <textarea
                className={COUPON_INPUT + ' min-h-[80px] resize-y'}
                value={form.bodyTa}
                onChange={(e) => set('bodyTa', e.target.value)}
                placeholder="அறிவிப்பு செய்தியை தமிழில் எழுதுங்கள்…"
                maxLength={500}
              />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Link (optional)">
            <input
              className={COUPON_INPUT}
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="/mock  or  https://…"
            />
          </Field>
          <Field label="Audience">
            <select
              className={COUPON_INPUT}
              value={form.audience}
              onChange={(e) => set('audience', e.target.value)}
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          {form.audience === 'group' && (
            <Field label="Target group">
              <select
                className={COUPON_INPUT}
                value={form.audienceValue}
                onChange={(e) => set('audienceValue', e.target.value)}
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <button type="submit" disabled={sending} className="btn-brand press disabled:opacity-60">
          {sending ? <Spinner size={16} /> : <Send size={16} />}
          {sub === 'push' ? 'Send notification' : 'Publish announcement'}
        </button>
      </form>

      {/* History */}
      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-ink">Sent history</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : list.length === 0 ? (
          <p className="py-10 text-center font-body text-ink2">Nothing sent yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map((n, i) => (
              <div
                key={n.id}
                style={{ '--i': i } as React.CSSProperties}
                className="card stagger-item flex items-start gap-3 p-3.5"
              >
                <span
                  className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg ${
                    n.kind === 'system' ? 'bg-goldsoft text-gold' : 'bg-brand-soft text-brand'
                  }`}
                >
                  {n.kind === 'system' ? <Megaphone size={18} /> : <Bell size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">{n.title}</p>
                  <p className="line-clamp-2 font-body text-xs text-ink2">{n.body}</p>
                  <p className="mt-1 font-body text-2xs text-ink2/80">
                    {n.kind === 'push' ? 'Push' : 'System'} · {audienceLabel(n)}
                    {(n.title_ta || n.body_ta) && ' · EN+TA'}
                    {n.kind === 'push' ? ` · ${n.push_sent} sent` : ''} ·{' '}
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(n)}
                  aria-label="Delete notification"
                  className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-coral transition hover:border-coral/40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete notification?"
        message={`Remove "${pendingDelete?.title ?? ''}" from the feed? Devices already notified keep their copy.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      </>
      )}
    </div>
  )
}

// ─── Popup Alerts ───────────────────────────────────────────────────────────────
// Superadmin-authored announcements shown to users as a blocking popup on app
// open. Each user sees an alert once per account ("Got it" is recorded server-
// side), so unlike notifications these interrupt — reserve them for things every
// user must see (downtime, exam-date changes, new-feature launches).
const EMPTY_ALERT_FORM = {
  kind: 'info' as AlertKind,
  title: '',
  body: '',
  titleTa: '',
  bodyTa: '',
  url: '',
  audience: 'all' as NotificationAudience,
  audienceValue: 'Group1',
  expiresAt: '',
}

function AlertsPanel() {
  const { t } = useT()
  const [form, setForm] = useState(EMPTY_ALERT_FORM)
  const [sending, setSending] = useState(false)
  const [list, setList] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminAlert | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.alerts
      .adminList()
      .then(setList)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const setKind = (k: AlertKind) => setForm((f) => ({ ...f, kind: k }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title || !body) return toast.error('Title and message are required.')

    setSending(true)
    try {
      await api.alerts.create({
        kind: form.kind,
        title,
        body,
        titleTa: form.titleTa.trim() || null,
        bodyTa: form.bodyTa.trim() || null,
        url: form.url.trim() || null,
        audience: form.audience,
        audienceValue: form.audience === 'group' ? form.audienceValue : null,
        // datetime-local gives a local wall-clock string; send it as an ISO instant.
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      })
      toast.success('Popup alert published — users see it on their next app open.')
      setForm(EMPTY_ALERT_FORM)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish the alert.')
    } finally {
      setSending(false)
    }
  }

  const toggleActive = async (a: AdminAlert) => {
    if (togglingId) return
    setTogglingId(a.id)
    try {
      const updated = await api.alerts.setActive(a.id, !a.active)
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: updated.active } : x)))
      toast.success(updated.active ? 'Alert is live again.' : 'Alert deactivated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the alert.')
    } finally {
      setTogglingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await api.alerts.remove(pendingDelete.id)
      setList((prev) => prev.filter((a) => a.id !== pendingDelete.id))
      toast.success('Alert deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const audienceLabel = (a: AdminAlert): string => {
    if (a.audience === 'group') {
      return GROUP_OPTIONS.find((g) => g.value === a.audience_value)?.label ?? a.audience_value ?? 'group'
    }
    return AUDIENCE_OPTIONS.find((o) => o.value === a.audience)?.label ?? a.audience
  }

  const expired = (a: AdminAlert) => !!a.expires_at && new Date(a.expires_at).getTime() <= Date.now()

  return (
    <div className="space-y-6">
      {/* Composer */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        {(() => {
          const cfg = ALERT_KIND[form.kind]
          const HeadIcon = cfg.icon
          return (
            <div className="flex items-start gap-2">
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${cfg.badge}`}>
                <HeadIcon size={18} />
              </span>
              <div>
                <h2 className="font-heading text-sm font-semibold text-ink">Publish a popup announcement</h2>
                <p className="font-body text-xs text-ink2">
                  Shown as a popup when a user opens the app, until they tap “Got it” (once per
                  account). Pick a type so it reads right — info, alert, update or good news.
                </p>
              </div>
            </div>
          )
        })()}

        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {ALERT_KINDS.map((k) => {
              const cfg = ALERT_KIND[k]
              const Icon = cfg.icon
              const active = form.kind === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`press tamil inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-xs font-semibold transition ${
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
                  }`}
                >
                  <Icon size={14} /> {t(cfg.labelKey)}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Title *">
          <input
            className={COUPON_INPUT}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Scheduled maintenance tonight"
            maxLength={120}
          />
        </Field>
        <Field label="Message *">
          <textarea
            className={COUPON_INPUT + ' min-h-[80px] resize-y'}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="Write the announcement…"
            maxLength={1000}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tamil title (optional)">
            <input
              className={COUPON_INPUT + ' tamil'}
              value={form.titleTa}
              onChange={(e) => set('titleTa', e.target.value)}
              placeholder="தமிழ் தலைப்பு"
              maxLength={120}
            />
          </Field>
          <Field label="Tamil message (optional)">
            <textarea
              className={COUPON_INPUT + ' tamil min-h-[42px] resize-y'}
              value={form.bodyTa}
              onChange={(e) => set('bodyTa', e.target.value)}
              placeholder="தமிழ் அறிவிப்பு"
              maxLength={1000}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Link (optional)">
            <input
              className={COUPON_INPUT}
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="/mock  or  https://…"
            />
          </Field>
          <Field label="Audience">
            <select
              className={COUPON_INPUT}
              value={form.audience}
              onChange={(e) => set('audience', e.target.value)}
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          {form.audience === 'group' && (
            <Field label="Target group">
              <select
                className={COUPON_INPUT}
                value={form.audienceValue}
                onChange={(e) => set('audienceValue', e.target.value)}
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Stop showing after (optional)">
            <input
              type="datetime-local"
              className={COUPON_INPUT}
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
            />
          </Field>
        </div>
        <button type="submit" disabled={sending} className="btn-brand press disabled:opacity-60">
          {sending ? <Spinner size={16} /> : <Send size={16} />}
          Publish alert
        </button>
      </form>

      {/* History */}
      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-ink">Published alerts</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : list.length === 0 ? (
          <p className="py-10 text-center font-body text-ink2">No alerts published yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map((a, i) => {
              const cfg = ALERT_KIND[alertKindOf(a.kind)]
              const RowIcon = cfg.icon
              const live = a.active && !expired(a)
              return (
              <div
                key={a.id}
                style={{ '--i': i } as React.CSSProperties}
                className="card stagger-item flex items-start gap-3 p-3.5"
              >
                <span
                  className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg ${
                    live ? cfg.badge : 'bg-tint text-ink2'
                  }`}
                >
                  <RowIcon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">
                    {a.title}
                    {!a.active && (
                      <span className="ml-2 rounded bg-tint px-1.5 py-0.5 font-heading text-2xs font-bold uppercase text-ink2">
                        Off
                      </span>
                    )}
                    {a.active && expired(a) && (
                      <span className="ml-2 rounded bg-goldsoft px-1.5 py-0.5 font-heading text-2xs font-bold uppercase text-gold">
                        Expired
                      </span>
                    )}
                  </p>
                  <p className="line-clamp-2 font-body text-xs text-ink2">{a.body}</p>
                  <p className="mt-1 font-body text-2xs text-ink2/80">
                    <span className={`mr-0.5 rounded px-1.5 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide ${cfg.chip}`}>
                      {t(cfg.labelKey)}
                    </span>{' '}
                    {audienceLabel(a)} · seen by {a.dismissed_count} ·{' '}
                    {new Date(a.created_at).toLocaleDateString()}
                    {a.expires_at ? ` · until ${new Date(a.expires_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(a)}
                  disabled={togglingId === a.id}
                  aria-label={a.active ? 'Deactivate alert' : 'Activate alert'}
                  title={a.active ? 'Deactivate' : 'Activate'}
                  className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
                >
                  {a.active ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(a)}
                  aria-label="Delete alert"
                  className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-coral transition hover:border-coral/40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete alert?"
        message={`Remove "${pendingDelete?.title ?? ''}"? Users who haven't seen it yet never will.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ─── Study Notes ──────────────────────────────────────────────────────────────
// Recreates the "quick notes" infographics as bilingual TNPSC Mentors PDFs with a
// faint "TNPSC Mentors" background watermark. One PDF per topic, generated
// client-side on demand (the heavy jspdf/html2canvas chunk is lazy-loaded).
function StudyNotesTab() {
  const { t } = useT()
  const [notes, setNotes] = useState<import('../lib/studyNotesPdf').StudyNote[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // Lazy-load the content (kept out of the main bundle alongside the generator).
  useEffect(() => {
    import('../lib/studyNotesData').then((m) => setNotes(m.STUDY_NOTES))
  }, [])

  const download = async (note: import('../lib/studyNotesPdf').StudyNote) => {
    setBusyId(note.id)
    try {
      const { generateStudyNotePdf } = await import('../lib/studyNotesPdf')
      await generateStudyNotePdf(note)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3 p-4">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <BookOpen size={20} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">{t('notesTab')}</h2>
          <p className="font-body text-xs text-ink2">
            Download bilingual (English + தமிழ்) study notes as branded PDFs with a TNPSC Mentors
            watermark.
          </p>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note, i) => (
            <div
              key={note.id}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item flex items-center gap-3 p-3.5"
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-goldsoft text-gold">
                <BookOpen size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold text-ink">
                  {note.title.en}
                  {note.period ? (
                    <span className="ml-1.5 font-body text-xs text-ink2">{note.period}</span>
                  ) : null}
                </p>
                <p className="tamil truncate font-body text-xs text-ink2">
                  {note.title.ta} · {note.entries.length}{' '}
                  {note.entries.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => download(note)}
                disabled={busyId === note.id}
                className="press focus-ring inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 font-heading text-xs font-semibold text-ink transition hover:border-brand-ring disabled:opacity-50"
              >
                {busyId === note.id ? <Spinner size={14} /> : <Download size={14} />}
                PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── App / APK releases ───────────────────────────────────────────────────────
// Upload a new Android build; the newest upload is what the public landing page
// links to. Keeps full history so a bad build can be deleted to roll back to the
// previous one. Admin tooling — kept in English, matching the rest of the console.
function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function AppReleasesTab() {
  const [releases, setReleases] = useState<AppRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AppRelease | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.appReleases
      .list()
      .then(setReleases)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const v = version.trim()
    if (!v) return toast.error('Enter a version name (e.g. 1.0.3).')
    if (!file) return toast.error('Choose an .apk file to upload.')
    if (!/\.apk$/i.test(file.name)) return toast.error('Only .apk files are accepted.')

    setUploading(true)
    try {
      const rel = await api.appReleases.upload(file, v, notes.trim())
      setReleases((prev) => [rel, ...prev])
      setVersion('')
      setNotes('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success(`Version ${rel.version_name} is live — students can download it now.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    try {
      await api.appReleases.remove(pendingDelete.id)
      setReleases((prev) => prev.filter((r) => r.id !== pendingDelete.id))
      toast.success('Release deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the release.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="card flex items-start gap-3 p-4">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <UploadCloud size={20} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">App build (Android APK)</h2>
          <p className="font-body text-xs text-ink2">
            Upload a new <code>.apk</code> and it instantly becomes the build the landing-page
            download button serves — no redeploy needed. The newest upload is live; older ones are
            kept so you can delete a bad build and roll back.
          </p>
        </div>
      </div>

      {/* Upload form */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Plus size={16} className="text-brand" /> Upload a new build
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Version name *">
            <input
              className={COUPON_INPUT}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.0.3"
              spellCheck={false}
            />
          </Field>
          <Field label="APK file *">
            <input
              ref={fileRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="focus-ring w-full rounded-lg border border-line bg-card px-3 py-2 font-body text-sm text-ink outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-heading file:text-xs file:font-semibold file:text-brand hover:border-brand/40"
            />
          </Field>
        </div>
        <Field label="Release notes (optional)">
          <textarea
            className={COUPON_INPUT + ' min-h-[70px] resize-y'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What changed in this build…"
            maxLength={500}
          />
        </Field>
        {file && (
          <p className="font-body text-xs text-ink2">
            Selected: <span className="font-heading text-ink">{file.name}</span> ·{' '}
            {formatBytes(file.size)}
          </p>
        )}
        <button type="submit" disabled={uploading} className="btn-brand press disabled:opacity-60">
          {uploading ? <Spinner size={16} /> : <UploadCloud size={16} />}
          {uploading ? 'Uploading…' : 'Upload & publish'}
        </button>
      </form>

      {/* History */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : releases.length === 0 ? (
        <p className="py-12 text-center font-body text-ink2">
          No builds uploaded yet — the download button stays disabled until you publish one.
        </p>
      ) : (
        <div className="space-y-2">
          {releases.map((r, i) => {
            const isCurrent = i === 0
            return (
              <div
                key={r.id}
                style={{ '--i': i } as React.CSSProperties}
                className={`card stagger-item flex flex-wrap items-center gap-3 p-3.5 ${
                  isCurrent ? 'ring-1 ring-brand/30' : 'opacity-80'
                }`}
              >
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Smartphone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-heading text-sm font-bold text-ink">
                      v{r.version_name}
                    </p>
                    {isCurrent && (
                      <span className="rounded-full bg-mintsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-mint">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="truncate font-body text-xs text-ink2">
                    {formatBytes(r.file_size)} · {new Date(r.created_at).toLocaleString()}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>
                <a
                  href={r.url}
                  download
                  className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink transition hover:border-brand/40"
                >
                  <Download size={14} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPendingDelete(r)}
                  disabled={busyId === r.id}
                  aria-label="Delete release"
                  className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-coral transition hover:border-coral/40 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this build?"
        message={
          pendingDelete
            ? `Delete v${pendingDelete.version_name}? ${
                releases[0]?.id === pendingDelete.id
                  ? 'It is the live build — the previous version becomes live again.'
                  : 'This removes it from history.'
              }`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={busyId === pendingDelete?.id}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <WebBundlesSection />
    </div>
  )
}

// ─── Live web bundles (OTA updates) ──────────────────────────────────────────
// Ships a rebuilt `dist` to apps ALREADY installed, without a store review. The
// newest active bundle whose minimum app version the device satisfies is what
// it downloads and swaps in on next background. Pausing a bundle sends every
// device back to the assets inside its store build — the rollback.
// See docs/LIVE-UPDATES.md for how a bundle is cut.
function WebBundlesSection() {
  const [bundles, setBundles] = useState<WebBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState('')
  const [minBuild, setMinBuild] = useState('')
  const [rollout, setRollout] = useState('100')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<WebBundle | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.webBundles
      .list()
      .then(setBundles)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const v = version.trim()
    const min = minBuild.trim()
    if (!v) return toast.error('Enter a bundle version (e.g. 2.0.5+w1).')
    if (!min) return toast.error('Enter the minimum app version this bundle needs.')
    if (!file) return toast.error('Choose the packed .zip to upload.')
    if (!/\.zip$/i.test(file.name)) return toast.error('Only .zip bundles are accepted.')

    setUploading(true)
    try {
      const b = await api.webBundles.upload(file, {
        version: v,
        minBuild: min,
        rollout: Number(rollout) || 0,
        notes: notes.trim(),
      })
      setBundles((prev) => [b, ...prev])
      setVersion('')
      setNotes('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success(`Bundle ${b.version} published to ${b.rollout_percent}% of devices.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const patch = async (b: WebBundle, changes: { active?: boolean; rollout_percent?: number }) => {
    setBusyId(b.id)
    try {
      const updated = await api.webBundles.update(b.id, changes)
      setBundles((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      if (changes.active === false) toast.success(`${b.version} paused — devices revert on next open.`)
      else if (changes.active === true) toast.success(`${b.version} resumed.`)
      else toast.success(`${b.version} now at ${updated.rollout_percent}%.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the bundle.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    try {
      await api.webBundles.remove(pendingDelete.id)
      setBundles((prev) => prev.filter((b) => b.id !== pendingDelete.id))
      toast.success('Bundle deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the bundle.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 border-t border-line pt-6">
      {/* Intro */}
      <div className="card flex items-start gap-3 p-4">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Rocket size={20} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">Live updates (no store review)</h2>
          <p className="font-body text-xs text-ink2">
            Upload a packed <code>dist</code> (<code>npm run build</code> then{' '}
            <code>npm run bundle:pack 2.0.5+w1</code>) and installed apps pick it up the next time
            they are backgrounded — screens, copy, subject lists, fixes. Anything <em>native</em> —
            a new plugin, a permission, a versionCode — still needs a real Play/App Store release.
            Pause a bundle to send every device back to the build it installed from the store.
          </p>
        </div>
      </div>

      {/* Upload form */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Plus size={16} className="text-brand" /> Publish a bundle
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bundle version *">
            <input
              className={COUPON_INPUT}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 2.0.5+w1"
              spellCheck={false}
            />
          </Field>
          <Field label="Minimum app version *">
            <input
              className={COUPON_INPUT}
              value={minBuild}
              onChange={(e) => setMinBuild(e.target.value)}
              placeholder="e.g. 2.0.6"
              spellCheck={false}
            />
          </Field>
          <Field label="Rollout %">
            <input
              className={COUPON_INPUT}
              type="number"
              min={0}
              max={100}
              value={rollout}
              onChange={(e) => setRollout(e.target.value)}
            />
          </Field>
          <Field label="Bundle zip *">
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="focus-ring w-full rounded-lg border border-line bg-card px-3 py-2 font-body text-sm text-ink outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-heading file:text-xs file:font-semibold file:text-brand hover:border-brand/40"
            />
          </Field>
        </div>
        <Field label="What changed (optional)">
          <textarea
            className={COUPON_INPUT + ' min-h-[70px] resize-y'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shown in this list only…"
            maxLength={500}
          />
        </Field>
        {file && (
          <p className="font-body text-xs text-ink2">
            Selected: <span className="font-heading text-ink">{file.name}</span> ·{' '}
            {formatBytes(file.size)}
          </p>
        )}
        <p className="font-body text-xs text-ink2">
          Start at 10-20% and raise it once the crash/error feed stays quiet — a bad bundle reaches
          only that slice, and pausing it pulls them back.
        </p>
        <button type="submit" disabled={uploading} className="btn-brand press disabled:opacity-60">
          {uploading ? <Spinner size={16} /> : <UploadCloud size={16} />}
          {uploading ? 'Uploading…' : 'Upload & publish'}
        </button>
      </form>

      {/* History */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : bundles.length === 0 ? (
        <p className="py-10 text-center font-body text-ink2">
          No live bundles yet — every device is running the assets from its store build.
        </p>
      ) : (
        <div className="space-y-2">
          {bundles.map((b, i) => (
            <div
              key={b.id}
              style={{ '--i': i } as React.CSSProperties}
              className={`card stagger-item flex flex-wrap items-center gap-3 p-3.5 ${
                b.active ? 'ring-1 ring-brand/30' : 'opacity-70'
              }`}
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Rocket size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-heading text-sm font-bold text-ink">{b.version}</p>
                  {b.active ? (
                    <span className="rounded-full bg-mintsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-mint">
                      Live · {b.rollout_percent}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-line px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                      Paused
                    </span>
                  )}
                </div>
                <p className="truncate font-body text-xs text-ink2">
                  app v{b.min_version_build}+ · {formatBytes(b.file_size)} ·{' '}
                  {new Date(b.created_at).toLocaleString()}
                  {b.notes ? ` · ${b.notes}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => patch(b, { active: !b.active })}
                disabled={busyId === b.id}
                className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink transition hover:border-brand/40 disabled:opacity-50"
              >
                {busyId === b.id ? <Spinner size={14} /> : b.active ? <EyeOff size={14} /> : <Eye size={14} />}
                {b.active ? 'Pause' : 'Resume'}
              </button>
              {b.active && b.rollout_percent < 100 && (
                <button
                  type="button"
                  onClick={() => patch(b, { rollout_percent: 100 })}
                  disabled={busyId === b.id}
                  className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink transition hover:border-brand/40 disabled:opacity-50"
                >
                  <TrendingUp size={14} /> 100%
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingDelete(b)}
                disabled={busyId === b.id}
                aria-label="Delete bundle"
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-coral transition hover:border-coral/40 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this bundle?"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.version}? Pausing is the safer rollback — deleting also removes the zip, so a device mid-download fails instead of finishing.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={busyId === pendingDelete?.id}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ─── Materials hub (videos, images, PDFs, documents) ───────────────────────────
const MATERIAL_KIND_ICON: Record<MaterialKind, typeof Video> = {
  video: Video,
  image: ImageIcon,
  pdf: FileText,
  document: FileText,
  magazine: Newspaper,
  questions: ListChecks,
}

const EMPTY_VIDEO_FORM = {
  title: '',
  title_ta: '',
  url: '',
  description: '',
  placement: 'materials' as MaterialPlacement,
  sort_order: '0',
}
const EMPTY_FILE_FORM = {
  title: '',
  title_ta: '',
  description: '',
  downloadable: false,
  sort_order: '0',
}

function MaterialsTab() {
  const [sub, setSub] = useState<'video' | 'file'>('video')
  const [vform, setVform] = useState(EMPTY_VIDEO_FORM)
  const [fform, setFform] = useState(EMPTY_FILE_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [list, setList] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Material | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    api.materials
      .adminList()
      .then(setList)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submitVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const title = vform.title.trim()
    if (!title) return toast.error('A title is required.')
    if (!vform.url.trim()) return toast.error('Paste a YouTube link.')
    setSaving(true)
    try {
      const m = await api.materials.createVideo({
        title,
        title_ta: vform.title_ta.trim() || null,
        url: vform.url.trim(),
        description: vform.description.trim() || null,
        placement: vform.placement,
        sort_order: Number(vform.sort_order) || 0,
      })
      setList((prev) => [m, ...prev])
      setVform(EMPTY_VIDEO_FORM)
      toast.success('Video added.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the video.')
    } finally {
      setSaving(false)
    }
  }

  const submitFile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const title = fform.title.trim()
    if (!title) return toast.error('A title is required.')
    if (!file) return toast.error('Choose a file to upload.')
    setSaving(true)
    try {
      const m = await api.materials.uploadFile(file, {
        title,
        title_ta: fform.title_ta.trim() || null,
        description: fform.description.trim() || null,
        downloadable: fform.downloadable,
        sort_order: Number(fform.sort_order) || 0,
      })
      setList((prev) => [m, ...prev])
      setFform(EMPTY_FILE_FORM)
      setFile(null)
      toast.success('File uploaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setSaving(false)
    }
  }

  // Patch one material in place (toggle active / downloadable / placement).
  const patch = async (m: Material, body: Parameters<typeof api.materials.update>[1]) => {
    setBusyId(m.id)
    try {
      const updated = await api.materials.update(m.id, body)
      setList((prev) => prev.map((x) => (x.id === m.id ? updated : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await api.materials.remove(pendingDelete.id)
      setList((prev) => prev.filter((x) => x.id !== pendingDelete.id))
      toast.success('Deleted.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSub('video')}
          className={`press flex items-center gap-2 rounded-lg px-4 py-2 font-heading text-sm font-medium transition ${
            sub === 'video' ? 'bg-brand text-white shadow-brand' : 'bg-tint text-ink2 hover:text-ink'
          }`}
        >
          <Video size={15} /> Add Video
        </button>
        <button
          onClick={() => setSub('file')}
          className={`press flex items-center gap-2 rounded-lg px-4 py-2 font-heading text-sm font-medium transition ${
            sub === 'file' ? 'bg-brand text-white shadow-brand' : 'bg-tint text-ink2 hover:text-ink'
          }`}
        >
          <Upload size={15} /> Upload File
        </button>
      </div>

      {/* Add video */}
      {sub === 'video' && (
        <form onSubmit={submitVideo} className="card space-y-4 p-5">
          <div className="flex items-start gap-2">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Video size={18} />
            </span>
            <div>
              <h2 className="font-heading text-sm font-semibold text-ink">Connect a YouTube video</h2>
              <p className="font-body text-xs text-ink2">
                Paste any YouTube link. Choose whether it appears in the Materials tab or on the Profile screen.
              </p>
            </div>
          </div>
          <Field label="Title *">
            <input className={COUPON_INPUT} value={vform.title} onChange={(e) => setVform((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Indian Polity — Crash Course" maxLength={160} />
          </Field>
          <Field label="Tamil title (optional)">
            <input className={COUPON_INPUT} value={vform.title_ta} onChange={(e) => setVform((f) => ({ ...f, title_ta: e.target.value }))} maxLength={160} />
          </Field>
          <Field label="YouTube link *">
            <input className={COUPON_INPUT} value={vform.url} onChange={(e) => setVform((f) => ({ ...f, url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <Field label="Description (optional)">
            <textarea className={COUPON_INPUT + ' min-h-[64px] resize-y'} value={vform.description} onChange={(e) => setVform((f) => ({ ...f, description: e.target.value }))} maxLength={500} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Show in">
              <select className={COUPON_INPUT} value={vform.placement} onChange={(e) => setVform((f) => ({ ...f, placement: e.target.value as MaterialPlacement }))}>
                <option value="materials">Materials tab</option>
                <option value="profile">Profile screen</option>
              </select>
            </Field>
            <Field label="Sort order">
              <input type="number" className={COUPON_INPUT} value={vform.sort_order} onChange={(e) => setVform((f) => ({ ...f, sort_order: e.target.value }))} />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="btn-brand press disabled:opacity-60">
            {saving ? <Spinner size={16} /> : <Plus size={16} />} Add video
          </button>
        </form>
      )}

      {/* Upload file */}
      {sub === 'file' && (
        <form onSubmit={submitFile} className="card space-y-4 p-5">
          <div className="flex items-start gap-2">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Upload size={18} />
            </span>
            <div>
              <h2 className="font-heading text-sm font-semibold text-ink">Upload an image, PDF or document</h2>
              <p className="font-body text-xs text-ink2">
                Appears in the Materials tab. Up to 50 MB. Turn on "Allow download" if students may save it.
              </p>
            </div>
          </div>
          <Field label="Title *">
            <input className={COUPON_INPUT} value={fform.title} onChange={(e) => setFform((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Polity mind-map (infographic)" maxLength={160} />
          </Field>
          <Field label="Tamil title (optional)">
            <input className={COUPON_INPUT} value={fform.title_ta} onChange={(e) => setFform((f) => ({ ...f, title_ta: e.target.value }))} maxLength={160} />
          </Field>
          <Field label="Description (optional)">
            <textarea className={COUPON_INPUT + ' min-h-[64px] resize-y'} value={fform.description} onChange={(e) => setFform((f) => ({ ...f, description: e.target.value }))} maxLength={500} />
          </Field>
          <Field label="File * (image, PDF, doc/ppt/xls, txt)">
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-heading file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5">
              <input type="checkbox" checked={fform.downloadable} onChange={(e) => setFform((f) => ({ ...f, downloadable: e.target.checked }))} className="h-4 w-4 accent-brand" />
              <span className="font-body text-sm text-ink">Allow download</span>
            </label>
            <Field label="Sort order">
              <input type="number" className={COUPON_INPUT} value={fform.sort_order} onChange={(e) => setFform((f) => ({ ...f, sort_order: e.target.value }))} />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="btn-brand press disabled:opacity-60">
            {saving ? <Spinner size={16} /> : <Upload size={16} />} Upload
          </button>
        </form>
      )}

      {/* Library */}
      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-ink">All materials</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : list.length === 0 ? (
          <p className="py-10 text-center font-body text-ink2">Nothing added yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map((m, i) => {
              const Icon = MATERIAL_KIND_ICON[m.kind]
              const isFile = m.kind === 'image' || m.kind === 'pdf' || m.kind === 'document'
              return (
                <div key={m.id} style={{ '--i': i } as React.CSSProperties} className="card stagger-item flex items-center gap-3 p-3">
                  {/* Thumb / icon */}
                  <div className="relative grid h-12 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-tint-violet text-primary">
                    {m.kind === 'video' && m.youtube_id ? (
                      <img src={youtubeThumb(m.youtube_id)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon size={20} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="tamil truncate font-heading text-sm font-semibold text-ink">{m.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
                        {kindLabel(m.kind)}
                      </span>
                      <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                        {m.placement === 'profile' ? 'Profile' : 'Materials'}
                      </span>
                      {isFile && m.downloadable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mintsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-mint">
                          <Download size={10} /> Download
                        </span>
                      )}
                      {!m.active && (
                        <span className="rounded-full bg-coral/15 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-coral">
                          Hidden
                        </span>
                      )}
                      {m.file_size > 0 && <span className="font-body text-2xs text-ink2">{formatFileSize(m.file_size)}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {m.kind === 'video' && (
                      <button
                        onClick={() => patch(m, { placement: m.placement === 'profile' ? 'materials' : 'profile' })}
                        disabled={busyId === m.id}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink disabled:opacity-50"
                        title={m.placement === 'profile' ? 'Move to Materials tab' : 'Move to Profile screen'}
                      >
                        {m.placement === 'profile' ? <Library size={15} /> : <UsersIcon size={15} />}
                      </button>
                    )}
                    {isFile && (
                      <button
                        onClick={() => patch(m, { downloadable: !m.downloadable })}
                        disabled={busyId === m.id}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-50 ${
                          m.downloadable ? 'text-mint hover:bg-mintsoft' : 'text-ink2 hover:bg-tint hover:text-ink'
                        }`}
                        title={m.downloadable ? 'Download enabled — click to disable' : 'Download disabled — click to enable'}
                      >
                        <Download size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => patch(m, { active: !m.active })}
                      disabled={busyId === m.id}
                      className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-50 ${
                        m.active ? 'text-mint hover:bg-mintsoft' : 'text-ink2 hover:bg-tint hover:text-ink'
                      }`}
                      title={m.active ? 'Visible — click to hide' : 'Hidden — click to show'}
                    >
                      {m.active ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      onClick={() => setPendingDelete(m)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-coralsoft hover:text-coral"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete material?"
        message="This removes it for all users. Uploaded files are deleted from storage too."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ─── CA Magazine (pipeline-pushed issues → approve into Materials) ─────────────
// The VPS pipeline drops daily/monthly magazine issues into ca_magazine every
// morning. Nothing reaches students until an issue is approved here — approval
// creates a kind='magazine' materials row, so Hide/Remove below (and the
// Materials tab) unpublish without touching the pipeline data.
// ─── CA Questions (read-only viewer) ──────────────────────────────────────────
const DIFF_BADGE: Record<string, string> = {
  Easy: 'bg-mintsoft text-mint',
  Medium: 'bg-amber-500/15 text-amber-600',
  Hard: 'bg-orange-500/15 text-orange-600',
  'Very Tough': 'bg-coral/15 text-coral',
}

function QuestionCard({ q, i }: { q: CaQuestionItem; i: number }) {
  const [ta, setTa] = useState(false)
  const letters = ['a', 'b', 'c', 'd'] as const
  const optKey = (l: string) => `option_${l}` as keyof CaQuestionItem
  const taKey = (l: string) => `option_${l}_ta` as keyof CaQuestionItem
  const hasTa = Boolean(q.question_text_ta)
  return (
    <div style={{ '--i': i } as React.CSSProperties} className="card stagger-item p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
          {q.topic}
        </span>
        <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
          {q.question_type.replace(/_/g, ' ')}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide ${DIFF_BADGE[q.difficulty] ?? 'bg-tint text-ink2'}`}>
          {q.difficulty}
        </span>
        <span className="ml-auto font-mono text-2xs text-ink2">{q.external_id}</span>
      </div>

      <p className="whitespace-pre-wrap font-body text-sm text-ink">
        {ta && hasTa ? q.question_text_ta : q.question_text}
      </p>

      <div className="mt-2 space-y-1">
        {letters.map((l) => {
          const correct = q.correct_answer?.toLowerCase() === l
          const text = String((ta && hasTa ? q[taKey(l)] : q[optKey(l)]) ?? '')
          return (
            <div
              key={l}
              className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 font-body text-sm ${
                correct ? 'bg-mintsoft text-mint' : 'text-ink2'
              }`}
            >
              <span className="font-heading font-bold uppercase">{l}.</span>
              <span className="whitespace-pre-wrap">{text}</span>
              {correct && <CheckCircle2 size={14} className="ml-auto mt-0.5 flex-shrink-0" />}
            </div>
          )
        })}
      </div>

      <p className="mt-2 font-body text-xs text-ink2">
        <span className="font-heading font-semibold text-ink">Answer: {q.correct_answer}</span>
        {' — '}
        {ta && hasTa ? q.explanation_ta : q.explanation}
      </p>

      {hasTa && (
        <button
          onClick={() => setTa((v) => !v)}
          className="mt-2 font-heading text-2xs font-semibold text-primary hover:underline"
        >
          {ta ? 'Show English' : 'Show தமிழ்'}
        </button>
      )}
    </div>
  )
}

function CaQuestionPreview({ set, onClose }: { set: CaQuestionSet; onClose: () => void }) {
  const { lang } = useT()
  const [items, setItems] = useState<CaQuestionItem[] | null>(null)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // Only DAILY sets are curatable — the monthly bank is the student-served
  // bank (corrected via update-ca.mjs), so it stays strictly read-only here.
  const editable = set.source === 'daily'

  const load = () => {
    setError(false)
    api.caQuestions.adminItems(set).then(setItems).catch(() => setError(true))
  }
  useEffect(load, [set])

  const label = set.source === 'daily' ? issueDateLabel('day_wise', set.date ?? '') : set.ca_month
  const count = items?.length ?? set.total
  const verified = (items ?? []).filter((q) => q.verified).length

  const downloadPdf = async () => {
    if (downloading || !items?.length) return
    setDownloading(true)
    try {
      const { generateCaQuestionsPdf } = await import('../lib/caQuestionsPdf')
      const title = set.source === 'daily' ? 'Daily Current Affairs' : 'Monthly Current Affairs'
      await generateCaQuestionsPdf({ items, title, label, lang })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const onSaved = (u: CaQuestionItem) =>
    setItems((list) => (list ?? []).map((q) => (q.id === u.id ? u : q)))
  const onDeleted = (id: number) => setItems((list) => (list ?? []).filter((q) => q.id !== id))
  const onAdded = (c: CaQuestionItem) => {
    setItems((list) => [c, ...(list ?? [])])
    setAdding(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-bg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <ListChecks size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-ink">{label}</p>
            <p className="font-body text-xs text-ink2">
              {editable ? 'Daily set' : 'Monthly bank'} · {count} questions
              {editable && ` · ${verified}/${count} verified`}
            </p>
          </div>
          {items && items.length > 0 && (
            <button
              onClick={downloadPdf}
              disabled={downloading}
              title="Download PDF"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink2 transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
            >
              {downloading ? <Spinner size={13} /> : <Download size={14} />} PDF
            </button>
          )}
          {editable && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-brand transition hover:border-brand/40 hover:bg-brand-soft/50"
            >
              <Plus size={14} /> Add
            </button>
          )}
          <button onClick={onClose} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-ink2 hover:bg-tint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {editable && adding && (
            <QuestionForm
              title="New question"
              submitLabel="Add question"
              onSubmit={(fields) => api.caQuestions.addDailyItem(set.date ?? '', fields)}
              onDone={onAdded}
              onCancel={() => setAdding(false)}
            />
          )}
          {items === null && !error && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
          {error && <ErrorState onRetry={load} />}
          {items?.map((q, i) =>
            editable ? (
              <EditableQuestionCard key={q.id} q={q} i={i} onSaved={onSaved} onDeleted={onDeleted} />
            ) : (
              <QuestionCard key={q.external_id} q={q} i={i} />
            )
          )}
          {items !== null && items.length === 0 && !adding && (
            <p className="py-10 text-center font-body text-ink2">No questions in this set.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** A daily question with the verify / edit / delete controls layered on the
 *  read view; switches to an inline QuestionForm while editing. */
function EditableQuestionCard({
  q,
  i,
  onSaved,
  onDeleted,
}: {
  q: CaQuestionItem
  i: number
  onSaved: (u: CaQuestionItem) => void
  onDeleted: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  if (editing) {
    return (
      <QuestionForm
        title={`Edit · ${q.external_id}`}
        submitLabel="Save changes"
        initial={q}
        onSubmit={(fields) => api.caQuestions.updateDailyItem(q.id!, fields)}
        onDone={(u) => { onSaved(u); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const toggleVerify = async () => {
    setBusy(true)
    try {
      const u = await api.caQuestions.updateDailyItem(q.id!, { verified: !q.verified })
      onSaved(u)
      toast.success(u.verified ? 'Marked verified.' : 'Verification cleared.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update.')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    setBusy(true)
    try {
      await api.caQuestions.deleteDailyItem(q.id!)
      onDeleted(q.id!)
      toast.success('Question removed.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove.')
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-card border ${q.verified ? 'border-mint/40' : 'border-line'} bg-card`}>
      <QuestionCard q={q} i={i} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <button
          onClick={toggleVerify}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-heading text-xs font-semibold transition disabled:opacity-50 ${
            q.verified ? 'bg-mintsoft text-mint' : 'border border-line text-ink2 hover:border-mint/40 hover:text-mint'
          }`}
        >
          <CheckCircle2 size={14} /> {q.verified ? 'Verified' : 'Verify'}
        </button>
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-heading text-xs font-semibold text-ink2 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          <Pencil size={14} /> Edit
        </button>
        {confirmDel ? (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <button
              onClick={del}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-2.5 py-1.5 font-heading text-xs font-semibold text-white transition hover:bg-coral/90 disabled:opacity-50"
            >
              {busy ? <Spinner size={13} /> : <Trash2 size={14} />} Confirm
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              disabled={busy}
              className="rounded-lg border border-line px-2.5 py-1.5 font-heading text-xs font-semibold text-ink2 hover:bg-tint disabled:opacity-50"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-heading text-xs font-semibold text-coral transition hover:border-coral/40 hover:bg-coral/5 disabled:opacity-50"
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>
    </div>
  )
}

const DIFF_OPTS = ['easy', 'medium', 'hard', 'Very Tough']
const ANS_OPTS = ['A', 'B', 'C', 'D']

/** Shared add/edit form for a daily CA question (EN + optional Tamil twins). */
function QuestionForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onDone,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial?: Partial<CaQuestionItem>
  onSubmit: (fields: Partial<CaQuestionItem>) => Promise<CaQuestionItem>
  onDone: (item: CaQuestionItem) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<Partial<CaQuestionItem>>({
    topic: initial?.topic ?? '',
    question_type: initial?.question_type ?? 'direct',
    difficulty: initial?.difficulty ?? 'medium',
    question_text: initial?.question_text ?? '',
    option_a: initial?.option_a ?? '',
    option_b: initial?.option_b ?? '',
    option_c: initial?.option_c ?? '',
    option_d: initial?.option_d ?? '',
    correct_answer: (initial?.correct_answer ?? 'A').toUpperCase(),
    explanation: initial?.explanation ?? '',
    question_text_ta: initial?.question_text_ta ?? '',
    option_a_ta: initial?.option_a_ta ?? '',
    option_b_ta: initial?.option_b_ta ?? '',
    option_c_ta: initial?.option_c_ta ?? '',
    option_d_ta: initial?.option_d_ta ?? '',
    explanation_ta: initial?.explanation_ta ?? '',
  })
  const [showTa, setShowTa] = useState(Boolean(initial?.question_text_ta))
  const [busy, setBusy] = useState(false)
  const set = (k: keyof CaQuestionItem, v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    setBusy(true)
    try {
      const item = await onSubmit(f)
      onDone(item)
      toast.success('Saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.')
      setBusy(false)
    }
  }

  // A plain render function (NOT a nested component) so the <input>/<textarea>
  // host nodes stay stable across renders and never lose focus while typing.
  const field = (label: string, k: keyof CaQuestionItem, area = false) => (
    <label className="block">
      <span className="mb-1 block font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">{label}</span>
      {area ? (
        <textarea
          value={String(f[k] ?? '')}
          onChange={(e) => set(k, e.target.value)}
          rows={2}
          className="input-soft w-full px-3 py-2 text-sm"
        />
      ) : (
        <input
          value={String(f[k] ?? '')}
          onChange={(e) => set(k, e.target.value)}
          className="input-soft w-full px-3 py-2 text-sm"
        />
      )}
    </label>
  )

  return (
    <div className="rounded-card border border-brand/30 bg-brand-soft/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-heading text-xs font-bold uppercase tracking-wide text-brand">{title}</p>
        <button onClick={onCancel} disabled={busy} className="grid h-7 w-7 place-items-center rounded-lg text-ink2 hover:bg-tint hover:text-ink disabled:opacity-50">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {field('Topic', 'topic')}
          {field('Type', 'question_type')}
          <label className="block">
            <span className="mb-1 block font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">Difficulty</span>
            <select value={String(f.difficulty ?? '')} onChange={(e) => set('difficulty', e.target.value)} className="input-soft w-full px-3 py-2 text-sm">
              {DIFF_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>

        {field('Question', 'question_text', true)}

        <div className="grid grid-cols-2 gap-2">
          {field('Option A', 'option_a')}
          {field('Option B', 'option_b')}
          {field('Option C', 'option_c')}
          {field('Option D', 'option_d')}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">Answer</span>
            <select value={String(f.correct_answer ?? 'A')} onChange={(e) => set('correct_answer', e.target.value)} className="input-soft w-full px-3 py-2 text-sm">
              {ANS_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <div className="col-span-2" />
        </div>

        {field('Explanation', 'explanation', true)}

        {showTa ? (
          <div className="space-y-3 rounded-lg border border-line bg-bg/60 p-3">
            <p className="font-heading text-2xs font-bold uppercase tracking-wide text-ink2">தமிழ் (optional)</p>
            {field('Question (TA)', 'question_text_ta', true)}
            <div className="grid grid-cols-2 gap-2">
              {field('Option A (TA)', 'option_a_ta')}
              {field('Option B (TA)', 'option_b_ta')}
              {field('Option C (TA)', 'option_c_ta')}
              {field('Option D (TA)', 'option_d_ta')}
            </div>
            {field('Explanation (TA)', 'explanation_ta', true)}
          </div>
        ) : (
          <button onClick={() => setShowTa(true)} className="font-heading text-2xs font-semibold text-primary hover:underline">
            + Add Tamil version
          </button>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={submit} disabled={busy} className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-60">
            {busy && <Spinner size={13} />} {submitLabel}
          </button>
          <button onClick={onCancel} disabled={busy} className="rounded-lg border border-line px-4 py-2 font-heading text-xs font-semibold text-ink2 hover:bg-tint disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function CaQuestionsTab() {
  const { lang } = useT()
  const [sets, setSets] = useState<CaQuestionSets | null>(null)
  const [error, setError] = useState(false)
  const [preview, setPreview] = useState<CaQuestionSet | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = () => {
    setError(false)
    setSets(null)
    api.caQuestions.adminSets().then(setSets).catch(() => setError(true))
  }
  useEffect(load, [])

  const setKey = (s: CaQuestionSet) => `${s.source}:${s.key}`
  const patchSet = (set: CaQuestionSet, material: CaQuestionSet['material']) =>
    setSets((prev) =>
      prev
        ? {
            daily: prev.daily.map((x) => (setKey(x) === setKey(set) ? { ...x, material } : x)),
            monthly: prev.monthly.map((x) => (setKey(x) === setKey(set) ? { ...x, material } : x)),
          }
        : prev
    )

  /** Whether students can currently download this set's PDF. */
  const studentPdfOn = (s: CaQuestionSet) => !!s.material?.active && !!s.material?.downloadable

  // Toggle the student-facing PDF. First enable publishes a Materials card;
  // later toggles just flip active+downloadable on that card.
  const toggleStudentPdf = async (set: CaQuestionSet) => {
    if (busyKey) return
    setBusyKey(setKey(set))
    try {
      if (!set.material) {
        const m = await api.caQuestions.publish(set)
        patchSet(set, { id: m.id, active: m.active, downloadable: m.downloadable })
        toast.success('Student PDF enabled — the set now appears in Materials.')
      } else {
        const on = studentPdfOn(set)
        const m = await api.materials.update(set.material.id, { active: !on, downloadable: !on })
        patchSet(set, { id: m.id, active: m.active, downloadable: m.downloadable })
        toast.success(!on ? 'Student PDF enabled.' : 'Student PDF disabled.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update.')
    } finally {
      setBusyKey(null)
    }
  }

  // Fetch the set's questions and export a bilingual Q&A + explanation PDF.
  const downloadSet = async (set: CaQuestionSet) => {
    const dlKey = `${set.source}:${set.key}`
    if (downloadingKey) return
    setDownloadingKey(dlKey)
    try {
      const items = await api.caQuestions.adminItems(set)
      if (!items.length) {
        toast.error('No questions in this set.')
        return
      }
      const label = set.source === 'daily' ? issueDateLabel('day_wise', set.date ?? '') : set.ca_month
      const title = set.source === 'daily' ? 'Daily Current Affairs' : 'Monthly Current Affairs'
      const { generateCaQuestionsPdf } = await import('../lib/caQuestionsPdf')
      await generateCaQuestionsPdf({ items, title, label, lang })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloadingKey(null)
    }
  }

  const Row = ({ set, i }: { set: CaQuestionSet; i: number }) => {
    const daily = set.source === 'daily'
    const label = daily ? issueDateLabel('day_wise', set.date ?? '') : set.ca_month
    const busy = downloadingKey === `${set.source}:${set.key}`
    const on = studentPdfOn(set)
    return (
      <div
        style={{ '--i': i } as React.CSSProperties}
        className="card stagger-item flex w-full items-center gap-2 p-3"
      >
        <button onClick={() => setPreview(set)} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary">
            <ListChecks size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-ink">{label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
                {daily ? 'Daily' : 'Monthly'}
              </span>
              <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                {set.total} questions
              </span>
            </div>
          </div>
        </button>
        <button
          onClick={() => downloadSet(set)}
          disabled={busy}
          title="Download PDF (admin copy)"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-brand disabled:opacity-50"
        >
          {busy ? <Spinner size={15} /> : <FileDown size={16} />}
        </button>
        <button
          onClick={() => toggleStudentPdf(set)}
          disabled={busyKey === setKey(set)}
          title={
            on
              ? 'Students CAN download this PDF — click to disable'
              : 'Students cannot download this PDF — click to enable'
          }
          className={`press inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-heading text-2xs font-semibold transition disabled:opacity-50 ${
            on ? 'bg-brand text-white' : 'border border-line text-ink2 hover:border-brand-ring hover:text-brand'
          }`}
        >
          {busyKey === setKey(set) ? <Spinner size={13} /> : <Download size={13} />} PDF {on ? 'On' : 'Off'}
        </button>
        <button
          onClick={() => setPreview(set)}
          title="Open set"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
        >
          <Search size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card flex items-start gap-3 p-5">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <ListChecks size={18} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">Current-affairs questions generated</h2>
          <p className="font-body text-xs text-ink2">
            The pipeline authors ~15 TNPSC-style MCQs from each day's paper (daily sets) and a 240-question bank
            each month. Open a set to review every question, its answer and explanation, in English and Tamil.
          </p>
        </div>
      </div>

      {sets === null && !error && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      )}

      {error && <ErrorState onRetry={load} />}

      {sets !== null && (
        <>
          <div>
            <h3 className="mb-2 font-heading text-xs font-bold uppercase tracking-wide text-ink2">Daily sets</h3>
            {sets.daily.length === 0 ? (
              <p className="py-6 text-center font-body text-sm text-ink2">
                No daily sets yet. The pipeline pushes the first at ~06:00 IST.
              </p>
            ) : (
              <div className="space-y-2">{sets.daily.map((s, i) => <Row key={s.key} set={s} i={i} />)}</div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-heading text-xs font-bold uppercase tracking-wide text-ink2">Monthly banks</h3>
            {sets.monthly.length === 0 ? (
              <p className="py-6 text-center font-body text-sm text-ink2">
                No monthly bank yet. The first is built on the 1st of the month.
              </p>
            ) : (
              <div className="space-y-2">{sets.monthly.map((s, i) => <Row key={s.key} set={s} i={i} />)}</div>
            )}
          </div>
        </>
      )}

      {preview && <CaQuestionPreview set={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function CaMagazineTab() {
  const { lang } = useT()
  const [issues, setIssues] = useState<CaMagazineIssue[] | null>(null)
  const [error, setError] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<CaMagazineIssue | null>(null)
  const [pendingRemove, setPendingRemove] = useState<CaMagazineIssue | null>(null)
  // Issue to broadcast to the Telegram channel, and the latest send per issue
  // and language (`${ca_type}|${date}` → { en, ta }) behind the row chips.
  const [telegramFor, setTelegramFor] = useState<CaMagazineIssue | null>(null)
  const [sent, setSent] = useState<Record<string, { en?: string; ta?: string }>>({})

  // Non-blocking: the list still works if the send log can't be read.
  const loadSent = () => {
    api.caTelegram
      .sent()
      .then(setSent)
      .catch(() => undefined)
  }

  const load = () => {
    setError(false)
    setIssues(null)
    api.caMagazine
      .adminIssues()
      .then(setIssues)
      .catch(() => setError(true))
    loadSent()
  }
  useEffect(load, [])

  const keyOf = (i: CaMagazineIssue) => `${i.ca_type}|${i.date}`

  // Admin export — available on EVERY issue, published or still pending review.
  const downloadIssue = async (issue: CaMagazineIssue) => {
    if (downloadingKey) return
    setDownloadingKey(keyOf(issue))
    try {
      const items = await api.caMagazine.adminItems(issue.ca_type, issue.date)
      if (!items.length) {
        toast.error('No items in this issue.')
        return
      }
      const { generateMagazinePdf } = await import('../lib/magazinePdf')
      await generateMagazinePdf({
        items,
        title: magazineName(lang),
        subtitle: issueDateLabel(issue.ca_type, issue.date, lang),
        lang,
        fileLabel: issueDateLabel(issue.ca_type, issue.date, 'en'),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloadingKey(null)
    }
  }
  const patchIssue = (issue: CaMagazineIssue, material: CaMagazineIssue['material']) =>
    setIssues((prev) => prev?.map((x) => (keyOf(x) === keyOf(issue) ? { ...x, material } : x)) ?? prev)

  const approve = async (issue: CaMagazineIssue) => {
    setBusyKey(keyOf(issue))
    try {
      const material = await api.caMagazine.publish(issue.ca_type, issue.date)
      patchIssue(issue, { id: material.id, active: material.active, downloadable: material.downloadable })
      toast.success('Approved — the issue is now live in the Materials tab.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish the issue.')
    } finally {
      setBusyKey(null)
    }
  }

  const toggleVisible = async (issue: CaMagazineIssue) => {
    if (!issue.material) return
    setBusyKey(keyOf(issue))
    try {
      const updated = await api.materials.update(issue.material.id, { active: !issue.material.active })
      patchIssue(issue, { id: updated.id, active: updated.active, downloadable: updated.downloadable })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setBusyKey(null)
    }
  }

  // Enable / disable the student "Download PDF" for a published issue.
  const toggleDownloadable = async (issue: CaMagazineIssue) => {
    if (!issue.material) return
    setBusyKey(keyOf(issue))
    try {
      const updated = await api.materials.update(issue.material.id, {
        downloadable: !issue.material.downloadable,
      })
      patchIssue(issue, { id: updated.id, active: updated.active, downloadable: updated.downloadable })
      toast.success(updated.downloadable ? 'PDF download enabled.' : 'PDF download disabled.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setBusyKey(null)
    }
  }

  const confirmRemove = async () => {
    if (!pendingRemove?.material) return
    try {
      await api.materials.remove(pendingRemove.material.id)
      patchIssue(pendingRemove, null)
      toast.success('Unpublished — the issue is back to pending review.')
      setPendingRemove(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unpublish.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="card flex items-start gap-3 p-5">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Newspaper size={18} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">Current-affairs magazine issues</h2>
          <p className="font-body text-xs text-ink2">
            The pipeline pushes a daily issue every morning (and a monthly compilation on the 1st). Preview an
            issue, then approve it to publish it in the students' Materials tab. Hide or remove a published
            issue to take it down — the underlying data is never deleted. The send icon posts the issue to the
            Telegram channel as an English and a Tamil PDF, with a caption you can edit before it goes out.
          </p>
        </div>
      </div>

      {issues === null && !error && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState onRetry={load} />}

      {issues !== null && issues.length === 0 && (
        <p className="py-10 text-center font-body text-ink2">
          No magazine issues have arrived yet. The pipeline pushes the first one at ~06:00 IST.
        </p>
      )}

      {issues !== null && issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, i) => {
            const busy = busyKey === keyOf(issue)
            const daily = issue.ca_type === 'day_wise'
            return (
              <div
                key={keyOf(issue)}
                style={{ '--i': i } as React.CSSProperties}
                className="card stagger-item flex items-center gap-3 p-3"
              >
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary">
                  <Newspaper size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">
                    {issueDateLabel(issue.ca_type, issue.date)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
                      {daily ? 'Daily' : 'Monthly'}
                    </span>
                    <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                      {issue.items} items
                    </span>
                    {issue.material ? (
                      issue.material.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mintsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-mint">
                          <CheckCircle2 size={10} /> Live
                        </span>
                      ) : (
                        <span className="rounded-full bg-coral/15 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-coral">
                          Hidden
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-amber-600">
                        Pending review
                      </span>
                    )}
                    {(() => {
                      const tg = sent[keyOf(issue)]
                      if (!tg) return null
                      const langs = [tg.en && 'EN', tg.ta && 'TA'].filter(Boolean).join(' + ')
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                          <Send size={10} /> {langs}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => setTelegramFor(issue)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-brand"
                    title="Send to the Telegram channel (English + Tamil PDF)"
                  >
                    <Send size={15} />
                  </button>
                  <button
                    onClick={() => setPreview(issue)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
                    title="Open — view / edit / add content"
                  >
                    <Search size={15} />
                  </button>
                  <button
                    onClick={() => downloadIssue(issue)}
                    disabled={downloadingKey === keyOf(issue)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-brand disabled:opacity-50"
                    title="Download PDF (admin copy)"
                  >
                    {downloadingKey === keyOf(issue) ? <Spinner size={14} /> : <FileDown size={15} />}
                  </button>
                  {issue.material ? (
                    <>
                      <button
                        onClick={() => toggleVisible(issue)}
                        disabled={busy}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-50 ${
                          issue.material.active ? 'text-mint hover:bg-mintsoft' : 'text-ink2 hover:bg-tint hover:text-ink'
                        }`}
                        title={issue.material.active ? 'Visible — click to hide' : 'Hidden — click to show'}
                      >
                        {issue.material.active ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button
                        onClick={() => toggleDownloadable(issue)}
                        disabled={busy}
                        className={`press inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-heading text-2xs font-semibold transition disabled:opacity-50 ${
                          issue.material.downloadable
                            ? 'bg-brand text-white'
                            : 'border border-line text-ink2 hover:border-brand-ring hover:text-brand'
                        }`}
                        title={
                          issue.material.downloadable
                            ? 'PDF download ON — click to disable'
                            : 'PDF download OFF — click to enable'
                        }
                      >
                        <Download size={13} /> PDF {issue.material.downloadable ? 'On' : 'Off'}
                      </button>
                      <button
                        onClick={() => setPendingRemove(issue)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-coralsoft hover:text-coral"
                        title="Unpublish (remove from Materials)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => approve(issue)}
                      disabled={busy}
                      className="btn-brand press px-3 py-1.5 text-xs disabled:opacity-60"
                    >
                      {busy ? <Spinner size={14} /> : <CheckCircle2 size={14} />} Approve
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <MagazineEditor
          issue={preview}
          onClose={() => setPreview(null)}
          onCountChange={(count) =>
            setIssues(
              (prev) =>
                prev?.map((x) =>
                  x.ca_type === preview.ca_type && x.date === preview.date ? { ...x, items: count } : x
                ) ?? prev
            )
          }
        />
      )}

      {telegramFor && (
        <CaTelegramDialog
          issue={telegramFor}
          onClose={() => setTelegramFor(null)}
          onSent={loadSent}
        />
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Unpublish this issue?"
        message={
          pendingRemove
            ? `Remove "${issueDateLabel(pendingRemove.ca_type, pendingRemove.date)}" from the Materials tab? The magazine data stays and you can approve it again later.`
            : ''
        }
        confirmLabel="Unpublish"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}

// ─── CA Slides ───────────────────────────────────────────────────────────────
// Every pushed issue as a downloadable class deck, in the layout the team
// hand-built in PowerPoint: branded background, issue date top-right, a title
// slide per section, then one item per slide with English left / Tamil right.
// Both formats come from one shared model (src/lib/caSlides) and are generated
// entirely in the browser — nothing is stored and the VPS is not involved.
function CaSlidesTab() {
  const [issues, setIssues] = useState<CaMagazineIssue[] | null>(null)
  const [error, setError] = useState(false)
  // `${ca_type}|${date}|${format}` of the export currently running, if any.
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  const load = () => {
    setError(false)
    setIssues(null)
    api.caMagazine.adminIssues().then(setIssues).catch(() => setError(true))
  }
  useEffect(load, [])

  const keyOf = (i: CaMagazineIssue) => `${i.ca_type}|${i.date}`

  const download = async (issue: CaMagazineIssue, format: 'pptx' | 'pdf') => {
    if (busy) return
    setBusy(`${keyOf(issue)}|${format}`)
    setProgress('')
    try {
      const items = await api.caMagazine.adminItems(issue.ca_type, issue.date)
      if (!items.length) {
        toast.error('No items in this issue.')
        return
      }
      const { buildCaSlides, slidesFileLabel } = await import('../lib/caSlides')
      const slides = buildCaSlides(items, issue.ca_type, issue.date)
      const filename = slidesFileLabel(issue.ca_type, issue.date)

      if (format === 'pptx') {
        const [{ buildCaSlidesPptx }, { saveBlob }] = await Promise.all([
          import('../lib/caSlidesPptx'),
          import('../lib/saveBlob'),
        ])
        setProgress(`${slides.length} slides…`)
        await saveBlob(await buildCaSlidesPptx(slides), filename, '.pptx')
      } else {
        const { generateCaSlidesPdf } = await import('../lib/caSlidesPdf')
        // The PDF rasterises slide by slide, so it is worth narrating.
        await generateCaSlidesPdf(slides, filename, (done, total) => setProgress(`${done} / ${total}`))
      }
      toast.success(`Downloaded ${slides.length} slides.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build the deck.')
    } finally {
      setBusy(null)
      setProgress('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="card flex items-start gap-3 p-5">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Presentation size={18} />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold text-ink">Current-affairs class slides</h2>
          <p className="font-body text-xs text-ink2">
            Any issue as a ready-to-teach bilingual deck — a title slide per section, then one news item per
            slide with English on the left and Tamil on the right. PPTX keeps the text editable; PDF is the
            same deck fixed for sharing. Built in your browser from the issue's live content, so edits made in
            the CA Magazine tab show up here immediately.
          </p>
        </div>
      </div>

      {issues === null && !error && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState onRetry={load} />}

      {issues !== null && issues.length === 0 && (
        <p className="py-10 text-center font-body text-ink2">
          No magazine issues have arrived yet. The pipeline pushes the first one at ~06:00 IST.
        </p>
      )}

      {issues !== null && issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, i) => {
            const pptxBusy = busy === `${keyOf(issue)}|pptx`
            const pdfBusy = busy === `${keyOf(issue)}|pdf`
            const thisBusy = pptxBusy || pdfBusy
            return (
              <div
                key={keyOf(issue)}
                style={{ '--i': i } as React.CSSProperties}
                className="card stagger-item flex items-center gap-3 p-3"
              >
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-tint-violet text-primary">
                  <Presentation size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-ink">
                    {issueDateLabel(issue.ca_type, issue.date)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
                      {issue.ca_type === 'day_wise' ? 'Daily' : 'Monthly'}
                    </span>
                    <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                      {issue.items} items
                    </span>
                    {thisBusy && progress && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                        {progress}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => download(issue, 'pptx')}
                    disabled={!!busy}
                    className="btn-soft press h-8 gap-1.5 px-2.5 text-xs disabled:opacity-50"
                    title="Download the editable PowerPoint deck"
                  >
                    {pptxBusy ? <Spinner size={13} /> : <Presentation size={14} />} PPTX
                  </button>
                  <button
                    onClick={() => download(issue, 'pdf')}
                    disabled={!!busy}
                    className="btn-soft press h-8 gap-1.5 px-2.5 text-xs disabled:opacity-50"
                    title="Download the same deck as a PDF"
                  >
                    {pdfBusy ? <Spinner size={13} /> : <FileDown size={14} />} PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
