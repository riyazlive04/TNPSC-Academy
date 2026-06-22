import { useEffect, useMemo, useState } from 'react'
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
  ShieldOff,
  Crown,
  IndianRupee,
  TrendingUp,
  Wallet,
  Bell,
  Megaphone,
  Send,
  Flag,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Monitor,
  LogOut,
  X,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import Avatar from '../components/UI/Avatar'
import Spinner from '../components/UI/Spinner'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import ReportedQuestions from '../components/Admin/ReportedQuestions'
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
  type DeviceSession,
} from '../lib/api'
import { useT, type StringKey } from '../lib/i18n'
import { toast } from '../store/toastStore'
import type { UserRole } from '../types'

type Tab = 'overview' | 'revenue' | 'users' | 'coupons' | 'notifications' | 'feedback' | 'reports'

export default function SuperAdminPage() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('overview')

  const TABS: { id: Tab; label: StringKey; icon: typeof Activity }[] = [
    { id: 'overview', label: 'overview', icon: Activity },
    { id: 'revenue', label: 'revenueTab', icon: IndianRupee },
    { id: 'users', label: 'users', icon: UsersIcon },
    { id: 'coupons', label: 'couponsTab', icon: Ticket },
    { id: 'notifications', label: 'notificationsTab', icon: Bell },
    { id: 'feedback', label: 'feedbackTab', icon: MessageSquare },
    { id: 'reports', label: 'reportsTab', icon: Flag },
  ]

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-8">
        <header className="mb-6 flex items-center gap-3 animate-slideDown">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">
              {t('superadminConsole')}
            </h1>
            <p className="font-body text-sm text-ink2">{t('chooseCategory')}</p>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex w-full overflow-x-auto rounded-xl bg-tint p-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active}
                className={`press flex flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-heading text-sm font-medium transition-all duration-200 lg:flex-1 ${
                  active ? 'bg-card text-brand shadow-pill' : 'text-ink2 hover:text-ink'
                }`}
              >
                <Icon size={16} /> <span className="tamil">{t(label)}</span>
              </button>
            )
          })}
        </div>

        <div key={tab} className="animate-fadeIn">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'revenue' && <RevenueTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'coupons' && <CouponsTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'feedback' && <FeedbackTab />}
          {tab === 'reports' && <ReportedQuestions />}
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Shared: load states ───────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useT()
  return (
    <div className="flex animate-fadeIn flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle size={30} className="text-coral" />
      <p className="font-body text-ink2">{t('couldNotLoad')}</p>
      <button onClick={onRetry} className="btn-soft press mt-1 px-4 py-2 text-sm">
        <RefreshCw size={15} /> {t('retry')}
      </button>
    </div>
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
              <div className="tamil mt-1.5 font-body text-[11px] uppercase tracking-wide text-ink2">
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

function SignupsChart({ data }: { data: { date: string; count: number }[] }) {
  const { t } = useT()
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">{t('signups14d')}</h2>
      {data.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-ink2">{t('noData')}</p>
      ) : (
        <div className="flex h-32 items-end gap-1.5">
          {data.map((d, i) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-heading text-[10px] font-semibold text-ink2 opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                style={{ height: `${(d.count / max) * 100}%`, '--i': i } as React.CSSProperties}
                className="w-full origin-bottom rounded-t-md bg-brand/80 transition-all duration-300 hover:bg-brand"
                title={`${d.date}: ${d.count}`}
              />
              <span className="font-body text-[9px] text-ink2/70">{d.date.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
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
              <div className="mt-1.5 font-body text-[11px] uppercase tracking-wide text-ink2">
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
            <div className="mt-1.5 font-body text-[11px] uppercase tracking-wide text-ink2">
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

function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const allZero = data.every((d) => d.revenue === 0)
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">Revenue — last 12 months</h2>
      {allZero ? (
        <p className="py-6 text-center font-body text-sm text-ink2">No revenue recorded yet.</p>
      ) : (
        <div className="flex h-40 items-end gap-1.5">
          {data.map((d, i) => (
            <div key={d.month} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-heading text-[9px] font-semibold text-ink2 opacity-0 transition-opacity group-hover:opacity-100">
                {formatINR(d.revenue)}
              </span>
              <div
                style={{ height: `${(d.revenue / max) * 100}%`, '--i': i } as React.CSSProperties}
                className="w-full origin-bottom rounded-t-md bg-brand/80 transition-all duration-300 hover:bg-brand"
                title={`${d.month}: ${formatINR(d.revenue)}`}
              />
              <span className="font-body text-[9px] text-ink2/70">{d.month.slice(5)}</span>
            </div>
          ))}
        </div>
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

function UsersTab() {
  const { t } = useT()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ user: AdminUserRow; role: UserRole } | null>(null)
  const [saving, setSaving] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [devicesTarget, setDevicesTarget] = useState<AdminUserRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    api.superadmin
      .users()
      .then(setUsers)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term)
    )
  }, [users, search])

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

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-body text-ink2">{t('noUsers')}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u, i) => (
            <div
              key={u.id}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item flex flex-wrap items-center gap-3 p-3.5 sm:flex-nowrap"
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
                  {u.premium && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide text-amber-500">
                      <Crown size={11} />
                      {t('premiumBadge')}
                    </span>
                  )}
                </div>
                <p className="truncate font-body text-xs text-ink2">{u.email}</p>
              </div>
              <div className="hidden text-center sm:block">
                <p className="font-heading text-sm font-semibold text-ink">{u.tests_taken}</p>
                <p className="font-body text-[10px] uppercase tracking-wide text-ink2">{t('testsTakenCol')}</p>
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

/** Pick a device icon + type label from the User-Agent–derived session label. */
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
            No active sessions — this user isn't signed in on any device.
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
                        <span className="ml-1.5 font-body text-[10px] uppercase tracking-wide text-ink2">
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
                <span className="font-body text-[11px] text-ink2">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2">
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
          <Field label="Code (optional — auto-generated)">
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
        <p className="py-12 text-center font-body text-ink2">No coupons yet — create one above.</p>
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
                    <span className="rounded-full bg-tint px-2 py-0.5 font-heading text-[10px] font-semibold uppercase text-ink2">
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
                <p className="font-body text-[10px] uppercase tracking-wide text-ink2">used</p>
              </div>
              <div className="text-center">
                <p className="font-heading text-sm font-semibold text-ink">
                  ₹{paiseToRupees(c.total_discount)}
                </p>
                <p className="font-body text-[10px] uppercase tracking-wide text-ink2">given</p>
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
  { value: 'free', label: 'Free users' },
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
  url: '',
  audience: 'all' as NotificationAudience,
  audienceValue: 'Group1',
}

function NotificationsTab() {
  const [sub, setSub] = useState<NotificationKind>('push')
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
    if (sending) return
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title || !body) return toast.error('Title and message are required.')

    setSending(true)
    try {
      const res = await api.notifications.create({
        kind: sub,
        title,
        body,
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
      <div className="flex gap-2">
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
      </div>

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
                  <p className="mt-1 font-body text-[11px] text-ink2/80">
                    {n.kind === 'push' ? 'Push' : 'System'} · {audienceLabel(n)}
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
    </div>
  )
}
