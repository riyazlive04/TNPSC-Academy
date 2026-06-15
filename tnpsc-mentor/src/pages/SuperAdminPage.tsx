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
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import Spinner from '../components/UI/Spinner'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import { api, type PlatformMetrics, type AdminUserRow, type FeedbackRow } from '../lib/api'
import { useT, type StringKey } from '../lib/i18n'
import { toast } from '../store/toastStore'
import type { UserRole } from '../types'

type Tab = 'overview' | 'users' | 'feedback'

export default function SuperAdminPage() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('overview')

  const TABS: { id: Tab; label: StringKey; icon: typeof Activity }[] = [
    { id: 'overview', label: 'overview', icon: Activity },
    { id: 'users', label: 'users', icon: UsersIcon },
    { id: 'feedback', label: 'feedbackTab', icon: MessageSquare },
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
                className={`press flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-heading text-sm font-medium transition-all duration-200 ${
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
          {tab === 'users' && <UsersTab />}
          {tab === 'feedback' && <FeedbackTab />}
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
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
    { icon: Star, value: metrics.avgRating ? metrics.avgRating.toFixed(2) : '—', label: 'avgRating', tile: 'bg-goldsoft text-gold' },
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
        {entries.length === 0 && <p className="font-body text-sm text-ink2">—</p>}
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
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft font-heading text-sm font-bold uppercase text-brand">
                {(u.full_name ?? u.email ?? '?').charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold text-ink">
                  {u.full_name || '—'}
                </p>
                <p className="truncate font-body text-xs text-ink2">{u.email}</p>
              </div>
              <div className="hidden text-center sm:block">
                <p className="font-heading text-sm font-semibold text-ink">{u.tests_taken}</p>
                <p className="font-body text-[10px] uppercase tracking-wide text-ink2">{t('testsTakenCol')}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => setPending({ user: u, role: e.target.value as UserRole })}
                aria-label={`${t('role')} — ${u.email}`}
                className="focus-ring rounded-lg border border-line bg-card px-2.5 py-1.5 font-heading text-xs font-semibold text-ink transition hover:border-brand/40"
              >
                {(['user', 'admin', 'superadmin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABELS[r])}
                  </option>
                ))}
              </select>
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
    : '—'

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
