import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  Check,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react'
import ContactActions from './ContactActions'
import ResponseTimer from './ResponseTimer'
import Spinner from '../UI/Spinner'
import { useFocusTrap } from '../UI/useFocusTrap'
import { nowMs, useCrmStore } from '../../store/crmStore'
import { api } from '../../lib/api'
import { toast } from '../../store/toastStore'
import {
  CHANNEL_ICON,
  INTENT_CLASS,
  SOURCE_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDuration,
  formatPhone,
  relativeTime,
  toLocalInputValue,
  type Lead,
  type LeadInteraction,
  type LeadStatus,
} from '../../lib/crm'

interface LeadSheetProps {
  leadId: string
  onClose: () => void
}

/** Quick-pick follow-up offsets, in minutes. Typing an exact time is still
 *  possible, but the overwhelming majority of callbacks are one of these. */
const SNOOZE = [
  { label: '2 h', mins: 120 },
  { label: 'Tomorrow', mins: 24 * 60 },
  { label: '3 days', mins: 3 * 24 * 60 },
  { label: '1 week', mins: 7 * 24 * 60 },
]

const STATUSES: LeadStatus[] = [
  'in_progress',
  'follow_up',
  'converted',
  'not_interested',
  'unreachable',
  'invalid',
]

/**
 * The full lead: contact details, the whole interaction history, and the form
 * that logs what happened on the call. Rendered as a bottom sheet on a phone and
 * a centred panel from `sm` up, because the desk is used one-handed on a mobile
 * far more often than at a laptop.
 */
export default function LeadSheet({ leadId, onClose }: LeadSheetProps) {
  const { intents, agentId, supervisor, logOutcome, claim, release } = useCrmStore()
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, panelRef)

  const [lead, setLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<LeadInteraction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  // The log form.
  const [intentId, setIntentId] = useState<string | null>(null)
  const [status, setStatus] = useState<LeadStatus | ''>('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.crm
      .lead(leadId)
      .then(({ lead: l, history: h }) => {
        if (cancelled) return
        setLead(l)
        setHistory(h)
        setNotes(l.notes ?? '')
        setFollowUp(l.next_follow_up_at ? toLocalInputValue(new Date(l.next_follow_up_at)) : '')
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Could not open this lead.')
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [leadId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Picking an intent pre-selects the status its outcome implies, so the common
  // path is one tap. The agent can still override it below.
  const pickIntent = (id: string) => {
    const next = intentId === id ? null : id
    setIntentId(next)
    const intent = intents.find((i) => i.id === next)
    if (!intent) return
    const implied: Record<string, LeadStatus> = {
      interested: 'in_progress',
      callback: 'follow_up',
      converted: 'converted',
      not_interested: 'not_interested',
      unreachable: 'unreachable',
      neutral: 'in_progress',
    }
    setStatus(implied[intent.outcome] ?? 'in_progress')
    if (intent.outcome === 'callback' && !followUp) {
      setFollowUp(toLocalInputValue(new Date(nowMs() + 24 * 3600_000)))
    }
  }

  const save = async () => {
    if (!lead) return
    if (!intentId && !status && !notes.trim()) {
      toast.error('Pick an intent, or write a note about the call.')
      return
    }
    setSaving(true)
    const updated = await logOutcome(lead.id, {
      intentId,
      status: status || undefined,
      notes: notes.trim() || undefined,
      nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
    })
    setSaving(false)
    if (!updated) return
    toast.success('Call logged.')
    onClose()
  }

  const mine = lead?.assigned_to === agentId
  const canRelease = lead?.assigned_to && (mine || supervisor)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4 animate-fadeInFast"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-hero bg-canvas shadow-hero sm:max-w-lg sm:rounded-hero"
      >
        {loading || !lead ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {/* ─── Header ─────────────────────────────────────────────── */}
            <header className="shrink-0 border-b border-line bg-card px-5 pb-4 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-lg font-bold text-ink">
                      {lead.full_name?.trim() || formatPhone(lead.phone) || 'Unnamed lead'}
                    </h2>
                    <ResponseTimer lead={lead} variant="full" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${STATUS_CLASS[lead.status]}`}
                    >
                      {STATUS_LABEL[lead.status]}
                    </span>
                    <span className="rounded-pill bg-tint px-2 py-0.5 font-heading text-2xs font-medium text-ink2">
                      {SOURCE_LABEL[lead.source]}
                      {lead.source_detail ? ` · ${lead.source_detail}` : ''}
                    </span>
                    <span className="font-body text-2xs text-ink2">
                      Arrived {relativeTime(lead.created_at, nowMs())}
                    </span>
                  </div>
                </div>
                <button onClick={onClose} className="icon-btn h-9 w-9 shrink-0" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* ─── Contact block ─────────────────────────────────────── */}
              <section className="card p-4">
                {editing ? (
                  <ContactEditor
                    lead={lead}
                    onDone={(updated) => {
                      if (updated) setLead(updated)
                      setEditing(false)
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <dl className="min-w-0 space-y-1.5">
                        <ContactLine icon={Phone} value={formatPhone(lead.phone) || '—'} />
                        {lead.whatsapp && lead.whatsapp !== lead.phone && (
                          <ContactLine
                            icon={CHANNEL_ICON.whatsapp}
                            value={`${formatPhone(lead.whatsapp)} (WhatsApp)`}
                          />
                        )}
                        <ContactLine icon={Mail} value={lead.email || '—'} />
                        {(lead.city || lead.target_group) && (
                          <ContactLine
                            icon={MapPin}
                            value={[lead.city, lead.target_group].filter(Boolean).join(' · ')}
                          />
                        )}
                      </dl>
                      <button
                        onClick={() => setEditing(true)}
                        className="icon-btn h-8 w-8 shrink-0"
                        aria-label="Edit contact details"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <div className="mt-3.5">
                      <ContactActions lead={lead} variant="stacked" />
                    </div>
                  </>
                )}
              </section>

              {/* ─── Ownership ─────────────────────────────────────────── */}
              <div className="mt-3 flex items-center gap-2">
                {!lead.assigned_to ? (
                  <button
                    onClick={() => void claim(lead.id).then((l) => l && setLead(l))}
                    className="btn btn-sm btn-soft"
                  >
                    <UserPlus size={14} /> Claim this lead
                  </button>
                ) : (
                  <p className="font-body text-2xs text-ink2">
                    Working: <span className="font-semibold text-ink">{mine ? 'you' : lead.assigned_name ?? 'another agent'}</span>
                  </p>
                )}
                {canRelease && (
                  <button
                    onClick={() => {
                      void release(lead.id)
                      onClose()
                    }}
                    className="btn btn-sm btn-ghost ml-auto"
                    title="Put this lead back in the shared queue"
                  >
                    <Undo2 size={14} /> Release
                  </button>
                )}
              </div>

              {/* ─── Log the call ──────────────────────────────────────── */}
              <section className="mt-5">
                <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
                  What did they say?
                </h3>

                {intents.length === 0 ? (
                  <p className="mt-2 rounded-field bg-tint px-3 py-2.5 font-body text-xs text-ink2">
                    No intent categories yet — a superadmin can add them in the console under
                    CRM → Intent categories.
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {intents.map((intent) => {
                      const on = intentId === intent.id
                      return (
                        <button
                          key={intent.id}
                          type="button"
                          onClick={() => pickIntent(intent.id)}
                          aria-pressed={on}
                          className={`press rounded-pill px-3 py-1.5 font-heading text-xs font-semibold transition-all ${
                            on
                              ? 'bg-brand-gradient text-white shadow-brand'
                              : INTENT_CLASS[intent.color]
                          }`}
                        >
                          {on && <Check size={12} className="mr-1 inline" />}
                          {intent.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                <label className="mt-4 block">
                  <span className="font-heading text-xs font-semibold text-ink2">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Anything the next call should know — budget, exam target, when they're free…"
                    className="input-soft mt-1.5 resize-y text-sm"
                  />
                </label>

                <div className="mt-4">
                  <span className="font-heading text-xs font-semibold text-ink2">
                    <CalendarClock size={12} className="mr-1 inline" />
                    Call back
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {SNOOZE.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() =>
                          setFollowUp(toLocalInputValue(new Date(nowMs() + s.mins * 60_000)))
                        }
                        className="chip px-3 py-1.5 text-xs"
                      >
                        {s.label}
                      </button>
                    ))}
                    {followUp && (
                      <button
                        type="button"
                        onClick={() => setFollowUp('')}
                        className="chip px-3 py-1.5 text-xs text-error"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="input-soft mt-2 text-sm"
                  />
                </div>

                <label className="mt-4 block">
                  <span className="font-heading text-xs font-semibold text-ink2">Lead status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
                    className="input-soft mt-1.5 text-sm"
                  >
                    <option value="">Leave as {STATUS_LABEL[lead.status]}</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              {/* ─── History ───────────────────────────────────────────── */}
              <section className="mt-6">
                <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
                  History
                </h3>
                {history.length === 0 ? (
                  <p className="mt-2 font-body text-xs text-ink2">Nothing logged yet.</p>
                ) : (
                  <ol className="mt-3 space-y-3 border-l border-line pl-4">
                    {history.map((h) => (
                      <HistoryRow key={h.id} item={h} />
                    ))}
                  </ol>
                )}
              </section>
            </div>

            {/* ─── Save bar ───────────────────────────────────────────── */}
            <footer className="shrink-0 border-t border-line bg-card px-5 pb-safe pt-3">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="btn-brand btn-wrap w-full py-3"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save call log
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function ContactLine({
  icon: Icon,
  value,
}: {
  icon: typeof Phone
  value: string
}) {
  return (
    <div className="flex items-center gap-2 font-body text-sm text-ink">
      <Icon size={14} className="shrink-0 text-ink2" />
      <span className="truncate tabular-nums">{value}</span>
    </div>
  )
}

function HistoryRow({ item }: { item: LeadInteraction }) {
  const Icon = CHANNEL_ICON[item.channel] ?? CHANNEL_ICON.note
  const headline =
    item.kind === 'click'
      ? `${item.channel === 'call' ? 'Called' : item.channel === 'whatsapp' ? 'Messaged on WhatsApp' : 'Emailed'}`
      : item.kind === 'system'
        ? (item.notes ?? 'Updated')
        : (item.intent_label ?? 'Logged a call')

  return (
    <li className="relative">
      <span className="absolute -left-[1.4rem] top-1 grid h-4 w-4 place-items-center rounded-full bg-canvas">
        <Icon size={11} className="text-ink2" />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="font-heading text-xs font-semibold text-ink">{headline}</p>
        {item.kind === 'outcome' && item.intent_label && (
          <span
            className={`rounded-pill px-1.5 py-0.5 font-heading text-2xs font-semibold ${INTENT_CLASS[item.intent_color ?? 'slate']}`}
          >
            {item.status_after ? STATUS_LABEL[item.status_after] : 'logged'}
          </span>
        )}
      </div>
      <p className="font-body text-2xs text-ink2">
        {item.agent_name ?? 'Someone'} · {relativeTime(item.created_at, nowMs())}
        {item.duration_secs ? ` · ${formatDuration(item.duration_secs)}` : ''}
      </p>
      {item.kind === 'outcome' && item.notes && (
        <p className="mt-1 whitespace-pre-wrap font-body text-xs text-ink">{item.notes}</p>
      )}
    </li>
  )
}

/** Inline correction of the details a lead reads out on the call. */
function ContactEditor({ lead, onDone }: { lead: Lead; onDone: (lead: Lead | null) => void }) {
  const [form, setForm] = useState({
    fullName: lead.full_name ?? '',
    phone: lead.phone ?? '',
    whatsapp: lead.whatsapp ?? '',
    email: lead.email ?? '',
    city: lead.city ?? '',
  })
  const [busy, setBusy] = useState(false)

  const fields = useMemo(
    () =>
      [
        { key: 'fullName' as const, label: 'Name', mode: 'text' as const },
        { key: 'phone' as const, label: 'Phone', mode: 'tel' as const },
        { key: 'whatsapp' as const, label: 'WhatsApp', mode: 'tel' as const },
        { key: 'email' as const, label: 'Email', mode: 'email' as const },
        { key: 'city' as const, label: 'City', mode: 'text' as const },
      ],
    []
  )

  const save = async () => {
    setBusy(true)
    try {
      const { lead: updated } = await api.crm.updateLead(lead.id, form)
      toast.success('Details updated.')
      onDone(updated)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save those details.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2.5">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
            {f.label}
          </span>
          <input
            type={f.mode}
            inputMode={f.mode === 'tel' ? 'numeric' : undefined}
            value={form[f.key]}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            className="input-soft mt-1 py-2 text-sm"
          />
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={() => void save()} disabled={busy} className="btn btn-sm btn-brand flex-1">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
        <button onClick={() => onDone(null)} className="btn btn-sm btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  )
}
