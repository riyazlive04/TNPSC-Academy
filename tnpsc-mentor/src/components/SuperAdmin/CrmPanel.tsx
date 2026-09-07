import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  GripVertical,
  Headphones,
  Inbox,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  TrendingUp,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Spinner from '../UI/Spinner'
import ConfirmDialog from '../UI/ConfirmDialog'
import CrmLiveAnswers from './CrmLiveAnswers'
import CrmAssign from './CrmAssign'
import { api, type CrmAgentRow, type CrmIntentInput } from '../../lib/api'
import { toast } from '../../store/toastStore'
import {
  INTENT_CLASS,
  INTENT_COLORS,
  OUTCOME_LABEL,
  STATUS_LABEL,
  formatDuration,
  parseLeadCsv,
  type CrmAgentDay,
  type CrmIntent,
  type CrmPipelineMetrics,
  type ImportRow,
  type IntentColor,
  type IntentOutcome,
  type LeadStatus,
} from '../../lib/crm'

/**
 * The superadmin half of the CRM: the intent taxonomy the telecallers log
 * against, the cold-lead importer, the agent roster with daily volume, and the
 * pipeline snapshot.
 *
 * Kept in its own file rather than folded into SuperAdminPage, which is already
 * ~5.8k lines — a new console section should not make that worse.
 */
export default function CrmPanel() {
  const [section, setSection] = useState<
    'pipeline' | 'intents' | 'agents' | 'assign' | 'import'
  >('pipeline')

  const SECTIONS = [
    { id: 'pipeline' as const, label: 'Pipeline', icon: TrendingUp },
    { id: 'intents' as const, label: 'Intent categories', icon: Tags },
    { id: 'agents' as const, label: 'Telecallers', icon: Headphones },
    { id: 'assign' as const, label: 'Assign leads', icon: UserPlus },
    { id: 'import' as const, label: 'Import leads', icon: UploadCloud },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg-wrap flex-wrap">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`seg flex items-center gap-1.5 ${section === s.id ? 'seg-active' : ''}`}
            >
              <s.icon size={14} /> {s.label}
            </button>
          ))}
        </div>
        {/* A superadmin supervises from here but can also work the desk itself —
            the same queues the telecallers see, with everyone's follow-ups. */}
        <Link to="/crm" className="btn btn-sm btn-ghost ml-auto">
          <ExternalLink size={14} /> Open the lead desk
        </Link>
      </div>

      {section === 'pipeline' && <PipelineSection />}
      {section === 'intents' && <IntentsSection />}
      {section === 'agents' && <AgentsSection />}
      {section === 'assign' && <CrmAssign />}
      {section === 'import' && <ImportSection />}
    </div>
  )
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

function PipelineSection() {
  const [metrics, setMetrics] = useState<CrmPipelineMetrics | null>(null)
  const [days, setDays] = useState(7)
  const [stats, setStats] = useState<CrmAgentDay[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([api.crm.bootstrap(), api.crm.stats({ days })])
      .then(([b, s]) => {
        setMetrics(b.metrics)
        setStats(s)
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Could not load the pipeline.')
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [days])

  /**
   * Refresh the counters on the live feed's own tick, so the numbers above and
   * the answers below never disagree. Quiet on purpose — no spinner and no
   * toast on failure: this fires every few seconds behind a dashboard someone
   * is reading, and a transient blip must not flash chrome at them.
   *
   * useCallback because CrmLiveAnswers holds this in a polling effect; a fresh
   * identity each render would tear that poll down and restart it.
   */
  const refreshQuietly = useCallback(() => {
    Promise.all([api.crm.bootstrap(), api.crm.stats({ days })])
      .then(([b, s]) => {
        setMetrics(b.metrics)
        setStats(s)
      })
      .catch(() => {})
  }, [days])

  // Roll the per-agent-per-day rows up into one row per agent for the window.
  const byAgent = useMemo(() => {
    const map = new Map<string, CrmAgentDay & { days: number }>()
    for (const row of stats) {
      const key = row.agent_id ?? 'unknown'
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...row, days: 1 })
        continue
      }
      map.set(key, {
        ...prev,
        calls: prev.calls + row.calls,
        whatsapps: prev.whatsapps + row.whatsapps,
        emails: prev.emails + row.emails,
        outcomes: prev.outcomes + row.outcomes,
        conversions: prev.conversions + row.conversions,
        leads_touched: prev.leads_touched + row.leads_touched,
        days: prev.days + 1,
      })
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls)
  }, [stats])

  if (loading && !metrics) return <Spinner className="mx-auto my-10" />

  const cards = [
    { label: 'Total leads', value: metrics?.total ?? 0, icon: Users },
    { label: 'Unclaimed', value: metrics?.unclaimed ?? 0, icon: Inbox },
    { label: 'Arrived today', value: metrics?.new_today ?? 0, icon: TrendingUp },
    { label: 'Never contacted', value: metrics?.awaiting_first_contact ?? 0, icon: Clock },
    { label: 'Follow-ups due', value: metrics?.follow_ups_due ?? 0, icon: Clock },
    { label: 'Calls today', value: metrics?.calls_today ?? 0, icon: Phone },
  ]

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-2 font-body text-2xs text-ink2">
              <c.icon size={13} /> {c.label}
            </div>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      {metrics?.median_response_secs != null && (
        <p className="font-body text-sm text-ink2">
          Median time from a lead arriving to its first contact:{' '}
          <span className="font-heading font-semibold text-ink">
            {formatDuration(metrics.median_response_secs)}
          </span>
        </p>
      )}

      {metrics?.by_status && Object.keys(metrics.by_status).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.entries(metrics.by_status) as [LeadStatus, number][]).map(([status, n]) => (
            <span
              key={status}
              className="rounded-pill bg-tint px-3 py-1.5 font-heading text-xs font-medium text-ink2"
            >
              {STATUS_LABEL[status] ?? status}
              <span className="ml-1.5 font-bold tabular-nums text-ink">{n}</span>
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h3 className="font-heading text-sm font-semibold text-ink">Agent volume</h3>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="input-soft w-auto py-1.5 text-xs"
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button onClick={load} className="icon-btn h-8 w-8" aria-label="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
            </button>
          </div>
        </div>

        {byAgent.length === 0 ? (
          <p className="card p-6 text-center font-body text-sm text-ink2">
            No calls logged in this window yet.
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left">
              <thead>
                <tr className="border-b border-line font-heading text-2xs uppercase tracking-wide text-ink2">
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-3 py-2.5 text-right">Calls</th>
                  <th className="px-3 py-2.5 text-right">WhatsApp</th>
                  <th className="px-3 py-2.5 text-right">Logged</th>
                  <th className="px-3 py-2.5 text-right">Converted</th>
                  <th className="px-4 py-2.5 text-right">Avg response</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {byAgent.map((a) => (
                  <tr key={a.agent_id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-heading font-medium text-ink">{a.agent_name ?? '—'}</p>
                      <p className="text-2xs text-ink2">{a.agent_email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {a.calls}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{a.whatsapps}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{a.outcomes}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-correct">
                      {a.conversions}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink2">
                      {a.avg_response_secs != null ? formatDuration(a.avg_response_secs) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CrmLiveAnswers metrics={metrics ?? {}} onTick={refreshQuietly} />
    </section>
  )
}

// ─── Intent categories ───────────────────────────────────────────────────────

const OUTCOMES: IntentOutcome[] = [
  'interested',
  'callback',
  'converted',
  'not_interested',
  'unreachable',
  'neutral',
]

const BLANK: CrmIntentInput = {
  label: '',
  labelTa: '',
  outcome: 'neutral',
  color: 'slate',
  sortOrder: 0,
}

function IntentsSection() {
  const [intents, setIntents] = useState<CrmIntent[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<CrmIntentInput>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.crm
      .allIntents()
      .then(setIntents)
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Could not load intent categories.')
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const submit = async () => {
    if (!draft.label.trim()) {
      toast.error('Give the category a label.')
      return
    }
    setBusy(true)
    try {
      if (editingId) {
        const updated = await api.crm.updateIntent(editingId, draft)
        setIntents((s) => s.map((i) => (i.id === editingId ? { ...i, ...updated } : i)))
        toast.success('Category updated.')
      } else {
        const created = await api.crm.createIntent({
          ...draft,
          sortOrder: draft.sortOrder || (intents[intents.length - 1]?.sort_order ?? 0) + 10,
        })
        setIntents((s) => [...s, created])
        toast.success('Category added.')
      }
      setDraft(BLANK)
      setEditingId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the category.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setConfirmId(null)
    try {
      const { retired } = await api.crm.removeIntent(id)
      if (retired) {
        setIntents((s) => s.map((i) => (i.id === id ? { ...i, active: false } : i)))
        toast.info('This category has call history, so it was retired rather than deleted.')
      } else {
        setIntents((s) => s.filter((i) => i.id !== id))
        toast.success('Category deleted.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the category.')
    }
  }

  /** Swap this category's position with its neighbour. The desk renders the
   *  chips in sort_order, so this is what decides which answers an agent
   *  reaches for first. */
  const move = async (intent: CrmIntent, delta: number) => {
    const i = intents.indexOf(intent)
    const other = intents[i + delta]
    if (!other) return
    // Optimistic swap so the list does not jump twice.
    setIntents((s) => {
      const next = [...s]
      next[i] = other
      next[i + delta] = intent
      return next
    })
    try {
      await Promise.all([
        api.crm.updateIntent(intent.id, { sortOrder: other.sort_order }),
        api.crm.updateIntent(other.id, { sortOrder: intent.sort_order }),
      ])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reorder.')
      load()
    }
  }

  const toggleActive = async (intent: CrmIntent) => {
    try {
      const updated = await api.crm.updateIntent(intent.id, { active: !intent.active })
      setIntents((s) => s.map((i) => (i.id === intent.id ? { ...i, ...updated } : i)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the category.')
    }
  }

  return (
    <section className="space-y-4">
      <p className="font-body text-sm leading-relaxed text-ink2">
        These are the buttons a telecaller taps to say what a lead wanted. The{' '}
        <span className="font-semibold text-ink">outcome</span> decides where the lead moves in the
        pipeline when that category is logged — pick “Call back later” and the lead goes to the
        follow-up queue automatically.
      </p>

      {/* ─── Editor ─────────────────────────────────────────────────────── */}
      <div className="card space-y-3 p-4">
        <h3 className="font-heading text-sm font-semibold text-ink">
          {editingId ? 'Edit category' : 'New category'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Label (English)
            </span>
            <input
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              maxLength={60}
              placeholder="e.g. Wants a demo class"
              className="input-soft mt-1 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Label (Tamil, optional)
            </span>
            <input
              value={draft.labelTa ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, labelTa: e.target.value }))}
              maxLength={80}
              className="input-soft tamil mt-1 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Moves the lead to
            </span>
            <select
              value={draft.outcome}
              onChange={(e) => setDraft((d) => ({ ...d, outcome: e.target.value as IntentOutcome }))}
              className="input-soft mt-1 py-2 text-sm"
            >
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Chip colour
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {INTENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, color: c as IntentColor }))}
                  aria-pressed={draft.color === c}
                  className={`rounded-pill px-3 py-1.5 font-heading text-2xs font-semibold ring-2 transition-all ${
                    INTENT_CLASS[c]
                  } ${draft.color === c ? 'ring-brand' : 'ring-transparent'}`}
                >
                  {draft.label.trim() || 'Aa'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void submit()} disabled={busy} className="btn btn-sm btn-brand">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? 'Save changes' : 'Add category'}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null)
                setDraft(BLANK)
              }}
              className="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ─── List ───────────────────────────────────────────────────────── */}
      {loading ? (
        <Spinner className="mx-auto my-8" />
      ) : (
        <ul className="space-y-2">
          {intents.map((intent, i) => (
            <li
              key={intent.id}
              className={`card flex flex-wrap items-center gap-3 p-3 ${intent.active ? '' : 'opacity-60'}`}
            >
              <GripVertical size={15} className="hidden shrink-0 text-ink2/40 sm:block" />
              <span
                className={`rounded-pill px-3 py-1 font-heading text-xs font-semibold ${INTENT_CLASS[intent.color]}`}
              >
                {intent.label}
              </span>
              <div className="min-w-0 flex-1">
                {intent.label_ta && (
                  <p className="tamil truncate font-body text-2xs text-ink2">{intent.label_ta}</p>
                )}
                <p className="font-body text-2xs text-ink2">
                  → {OUTCOME_LABEL[intent.outcome]}
                  {typeof intent.uses === 'number' && ` · used ${intent.uses}×`}
                  {!intent.active && ' · retired'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void toggleActive(intent)}
                  className="btn btn-sm btn-ghost px-2.5 py-1.5 text-2xs"
                  title={intent.active ? 'Stop offering this on the desk' : 'Offer this again'}
                >
                  {intent.active ? <X size={13} /> : <Check size={13} />}
                  {intent.active ? 'Retire' : 'Restore'}
                </button>
                <button
                  onClick={() => void move(intent, -1)}
                  disabled={i === 0}
                  className="icon-btn h-8 w-8 disabled:opacity-30"
                  aria-label={`Move ${intent.label} up`}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => void move(intent, 1)}
                  disabled={i === intents.length - 1}
                  className="icon-btn h-8 w-8 disabled:opacity-30"
                  aria-label={`Move ${intent.label} down`}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => {
                    setEditingId(intent.id)
                    setDraft({
                      label: intent.label,
                      labelTa: intent.label_ta ?? '',
                      outcome: intent.outcome,
                      color: intent.color,
                      sortOrder: intent.sort_order,
                    })
                  }}
                  className="icon-btn h-8 w-8"
                  aria-label={`Edit ${intent.label}`}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  onClick={() => setConfirmId(intent.id)}
                  className="icon-btn h-8 w-8 text-error"
                  aria-label={`Delete ${intent.label}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SlaEditor />

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Remove this category?"
        message="If any call has been logged against it, it will be retired instead of deleted so the history stays readable."
        confirmLabel="Remove"
        onConfirm={() => confirmId && void remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </section>
  )
}

// ─── Telecaller roster ───────────────────────────────────────────────────────

function AgentsSection() {
  const [agents, setAgents] = useState<CrmAgentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.crm
      .agents()
      .then(setAgents)
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Could not load the roster.')
      )
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner className="mx-auto my-10" />

  return (
    <section className="space-y-4">
      <p className="font-body text-sm leading-relaxed text-ink2">
        Appoint a telecaller in the <span className="font-semibold text-ink">Users</span> tab: find
        the account and set its role to <span className="font-semibold text-ink">Telecaller</span>.
        They then sign in with the same email and land straight on the lead desk at{' '}
        <code className="rounded bg-tint px-1.5 py-0.5 text-2xs">/crm</code> — no student screens,
        no tests, and no access to the question bank or this console.
      </p>

      {agents.length === 0 ? (
        <p className="card p-6 text-center font-body text-sm text-ink2">
          No telecaller accounts yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-tint-violet text-primary">
                <Headphones size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold text-ink">
                  {a.full_name ?? a.email}
                </p>
                <p className="truncate font-body text-2xs text-ink2">{a.email}</p>
              </div>
              <dl className="flex gap-4 font-body text-2xs text-ink2">
                <Stat label="Calls today" value={a.calls_today} />
                <Stat label="Logged" value={a.outcomes_today} />
                <Stat label="Converted" value={a.conversions_today} />
                <Stat label="Open leads" value={a.open_leads} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <dd className="font-display text-base font-bold tabular-nums text-ink">{value}</dd>
      <dt className="whitespace-nowrap">{label}</dt>
    </div>
  )
}

// ─── Cold-lead import + backfill ─────────────────────────────────────────────

function ImportSection() {
  const [text, setText] = useState('')
  const [batch, setBatch] = useState('')
  const [busy, setBusy] = useState(false)
  const [backfillDays, setBackfillDays] = useState(30)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? parseLeadCsv(text) : null), [text])

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.onerror = () => toast.error('Could not read that file.')
    reader.readAsText(file)
  }

  const upload = async () => {
    if (!parsed || parsed.rows.length === 0) {
      toast.error('Nothing to import — no row had a valid 10-digit mobile number.')
      return
    }
    setBusy(true)
    try {
      const result = await api.crm.importLeads(parsed.rows as ImportRow[], batch.trim())
      toast.success(
        `${result.inserted} new lead${result.inserted === 1 ? '' : 's'} added` +
          (result.updated ? `, ${result.updated} already on file` : '')
      )
      setText('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const runBackfill = async () => {
    setBusy(true)
    try {
      const { created } = await api.crm.backfill(backfillDays)
      toast.success(
        created === 0
          ? 'Every account in that window already has a lead.'
          : `${created} existing account${created === 1 ? '' : 's'} filed as leads.`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      {/* ─── CSV import ─────────────────────────────────────────────────── */}
      <div className="card space-y-3 p-4">
        <h3 className="font-heading text-sm font-semibold text-ink">Cold list (CSV)</h3>
        <p className="font-body text-xs leading-relaxed text-ink2">
          Upload or paste a CSV with a <code className="rounded bg-tint px-1">phone</code> column;{' '}
          <code className="rounded bg-tint px-1">name</code>,{' '}
          <code className="rounded bg-tint px-1">email</code>,{' '}
          <code className="rounded bg-tint px-1">whatsapp</code>,{' '}
          <code className="rounded bg-tint px-1">city</code> and{' '}
          <code className="rounded bg-tint px-1">group</code> are optional. Common header names
          (mobile, contact, district…) are recognised too. Numbers already on file are left alone
          rather than duplicated — including ones that belong to an app account.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
            }}
            className="hidden"
            id="crm-csv"
          />
          <label htmlFor="crm-csv" className="btn btn-sm btn-ghost cursor-pointer">
            <Download size={14} /> Choose a CSV file
          </label>
          <input
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="Batch name (e.g. Aug ad leads)"
            maxLength={80}
            className="input-soft w-auto flex-1 py-2 text-sm"
          />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'name,phone,email\nKavitha R,9876543210,kavitha@example.com'}
          className="input-soft resize-y font-mono text-xs"
        />

        {parsed && (
          <p className="font-body text-xs text-ink2">
            <span className="font-semibold text-ink">{parsed.rows.length}</span> row
            {parsed.rows.length === 1 ? '' : 's'} ready
            {parsed.skipped > 0 && ` · ${parsed.skipped} skipped (no valid mobile number)`}
          </p>
        )}

        <button
          onClick={() => void upload()}
          disabled={busy || !parsed?.rows.length}
          className="btn btn-sm btn-brand"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Import {parsed?.rows.length ? `${parsed.rows.length} leads` : 'leads'}
        </button>
      </div>

      {/* ─── Backfill ───────────────────────────────────────────────────── */}
      <div className="card space-y-3 p-4">
        <h3 className="font-heading text-sm font-semibold text-ink">Existing signups</h3>
        <p className="font-body text-xs leading-relaxed text-ink2">
          Every new registration files a lead automatically from now on. Accounts that signed up
          before the CRM existed can be pulled in here. Keep the window tight — dropping years of
          accounts into the shared queue buries the fresh leads the response timer exists to
          protect.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              Signed up in the last
            </span>
            <select
              value={backfillDays}
              onChange={(e) => setBackfillDays(Number(e.target.value))}
              className="input-soft mt-1 w-auto py-2 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
          <button onClick={() => void runBackfill()} disabled={busy} className="btn btn-sm btn-ghost">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            File them as leads
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Response targets ────────────────────────────────────────────────────────

/**
 * How long a fresh inbound lead may wait before the desk's timer turns amber,
 * orange and red. Hardcoded until now, which sat oddly beside a taxonomy the
 * superadmin owns entirely — a two-agent shift and a ten-agent shift do not
 * share an idea of "late".
 *
 * Applies to inbound signups only; imported and backfilled leads carry no
 * deadline by design.
 */
function SlaEditor() {
  const [sla, setSla] = useState({ target_mins: 5, warn_mins: 15, breach_mins: 60 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.superadmin
      .settings()
      .then((all) => {
        const v = all.crm_sla as Partial<typeof sla> | undefined
        if (v) setSla((s) => ({ ...s, ...v }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      await api.superadmin.setSetting('crm_sla', sla)
      toast.success('Response targets saved. Agents pick them up on their next refresh.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const fields = [
    { key: 'target_mins' as const, label: 'Green until', hint: 'answered on time' },
    { key: 'warn_mins' as const, label: 'Amber until', hint: 'getting late' },
    { key: 'breach_mins' as const, label: 'Red after', hint: 'missed' },
  ]

  const ordered = sla.target_mins < sla.warn_mins && sla.warn_mins < sla.breach_mins

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h3 className="font-heading text-sm font-semibold text-ink">Response targets</h3>
        <p className="mt-0.5 font-body text-xs text-ink2">
          Minutes a new signup may wait before the desk timer escalates. Imported and backfilled
          leads carry no deadline.
        </p>
      </div>

      {loading ? (
        <Spinner className="mx-auto my-4" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
                  {f.label}
                </span>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={sla[f.key]}
                  onChange={(e) => setSla((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
                  className="input-soft mt-1 py-2 text-sm"
                />
                <span className="font-body text-2xs text-ink2">{f.hint}</span>
              </label>
            ))}
          </div>

          {!ordered && (
            <p className="font-body text-xs text-error">
              Each threshold has to be larger than the one before it, or the timer skips a band.
              The server will correct this on save.
            </p>
          )}

          <button onClick={() => void save()} disabled={busy} className="btn btn-sm btn-brand">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save targets
          </button>
        </>
      )}
    </div>
  )
}
