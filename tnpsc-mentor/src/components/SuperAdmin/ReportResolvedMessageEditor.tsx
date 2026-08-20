import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, Loader2, MessageSquare, RotateCcw, Save } from 'lucide-react'
import { api, REPORT_RESOLVED_MESSAGE_DEFAULT, type ReportResolvedMessage } from '../../lib/api'
import { toast } from '../../store/toastStore'

/**
 * Superadmin editor for the message students receive when a question they
 * reported is marked RESOLVED. Lives above the triage list in the console's
 * Reports tab; the admin page (/admin/reports) does NOT render it, since only
 * superadmins may write app_settings.
 *
 * Persisted as one jsonb object under the `report_resolved_message` key, so the
 * wording changes without a redeploy. Collapsed by default — triage is the
 * primary job on this tab, editing the copy is occasional.
 */
export default function ReportResolvedMessageEditor() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ReportResolvedMessage | null>(null)
  const [saved, setSaved] = useState<ReportResolvedMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.superadmin
      .settings()
      .then((s) => {
        if (cancelled) return
        // Missing/malformed row => the server's defaults are what would send.
        const raw = s.report_resolved_message
        const row = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReportResolvedMessage>
        const merged: ReportResolvedMessage = {
          ...REPORT_RESOLVED_MESSAGE_DEFAULT,
          ...row,
          enabled: row.enabled !== false,
        }
        setDraft(merged)
        setSaved(merged)
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved))

  const set = <K extends keyof ReportResolvedMessage>(k: K, v: ReportResolvedMessage[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = async () => {
    if (!draft) return
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error('English title and message are required.')
      return
    }
    setSaving(true)
    try {
      await api.superadmin.setSetting('report_resolved_message', draft)
      setSaved(draft)
      toast.success('Message saved. It applies to the next resolved report.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the message.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card mb-5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 p-4 text-left sm:p-5"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <MessageSquare size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-sm font-bold text-ink">
            Message sent when a report is resolved
          </span>
          <span className="block font-body text-xs text-ink2">
            {loading
              ? 'Loading…'
              : error
                ? 'Could not load the current message.'
                : draft?.enabled
                  ? 'On — every student who flagged the question is notified.'
                  : 'Off — resolving a report notifies nobody.'}
          </span>
        </span>
        {dirty && (
          <span className="flex-shrink-0 rounded-full bg-coralsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase text-coral">
            Unsaved
          </span>
        )}
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-ink2 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-line p-4 sm:p-5">
          {loading ? (
            <div className="skeleton h-40 w-full" />
          ) : error || !draft ? (
            <div className="flex items-center gap-2 font-body text-sm text-ink2">
              <AlertTriangle size={16} className="text-coral" /> Could not load the current message.
            </div>
          ) : (
            <>
              <label className="mb-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                <span className="font-body text-sm text-ink">
                  Notify students when their reported question is resolved
                </span>
              </label>

              <Field
                label="Title (English)"
                value={draft.title}
                onChange={(v) => set('title', v)}
                placeholder={REPORT_RESOLVED_MESSAGE_DEFAULT.title}
              />
              <Field
                label="Message (English)"
                value={draft.body}
                onChange={(v) => set('body', v)}
                placeholder={REPORT_RESOLVED_MESSAGE_DEFAULT.body}
                rows={3}
              />
              <Field
                label="Title (Tamil)"
                value={draft.title_ta}
                onChange={(v) => set('title_ta', v)}
                placeholder={REPORT_RESOLVED_MESSAGE_DEFAULT.title_ta}
                tamil
                hint="Leave blank to send English to Tamil users too."
              />
              <Field
                label="Message (Tamil)"
                value={draft.body_ta}
                onChange={(v) => set('body_ta', v)}
                placeholder={REPORT_RESOLVED_MESSAGE_DEFAULT.body_ta}
                rows={3}
                tamil
              />

              <p className="mb-4 rounded-lg bg-tint px-3 py-2 font-body text-2xs leading-relaxed text-ink2">
                Placeholders:{' '}
                <code className="font-mono font-semibold text-brand">{'{subject}'}</code> — the
                question&rsquo;s subject.{' '}
                <code className="font-mono font-semibold text-brand">{'{note}'}</code> — the note
                you type when resolving. Both become blank when unavailable. Students are messaged
                once per report; resolving the same question again does not re-send.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="btn-brand btn-sm press disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save message
                </button>
                <button
                  onClick={() => setDraft({ ...REPORT_RESOLVED_MESSAGE_DEFAULT })}
                  disabled={saving}
                  className="press focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-heading text-xs font-semibold text-ink2 transition hover:border-brand-ring hover:text-brand disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Reset to default
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
  tamil,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  tamil?: boolean
  hint?: string
}) {
  const cls = `w-full rounded-lg border border-line bg-canvas px-3 py-2 font-body text-sm text-ink focus-ring ${
    tamil ? 'tamil' : ''
  }`
  return (
    <div className="mb-3">
      <label className="mb-1 block font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
        {label}
      </label>
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {hint && <p className="mt-1 font-body text-2xs text-ink2">{hint}</p>}
    </div>
  )
}
