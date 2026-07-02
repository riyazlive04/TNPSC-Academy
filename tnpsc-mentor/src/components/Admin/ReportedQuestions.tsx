import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { api, type ReportStatus, type ReportedQuestion } from '../../lib/api'
import { optionLetters, displayOption, displayQuestion, displayExplanation } from '../../types'
import MathText from '../UI/MathText'
import type { Question } from '../../types'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'
import QuestionEditor from './QuestionEditor'

const TABS: { id: ReportStatus; label: string; icon: typeof Flag }[] = [
  { id: 'open', label: 'Open', icon: Flag },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { id: 'dismissed', label: 'Dismissed', icon: XCircle },
]

/**
 * Triage surface for student-reported questions. Shared by the admin page
 * (/admin/reports) and the superadmin console "Reports" tab. Lists questions
 * students flagged for correction, lets an admin open the question in the editor
 * to fix it, then resolve or dismiss the report. Resolving/dismissing is
 * per-question; a fresh student report after a resolution reopens it.
 */
export default function ReportedQuestions() {
  const { lang } = useT()
  const [tab, setTab] = useState<ReportStatus>('open')
  const [items, setItems] = useState<ReportedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Question | null>(null)

  const load = (status: ReportStatus) => {
    setLoading(true)
    setError(false)
    api
      .adminQuestionReports(status)
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(tab), [tab])

  const setStatus = async (r: ReportedQuestion, status: ReportStatus) => {
    setBusyId(r.question_id)
    try {
      await api.adminSetReportStatus(r.question_id, status)
      // Moving an item to another bucket removes it from the current view.
      setItems((prev) => prev.filter((x) => x.question_id !== r.question_id))
      toast.success(
        status === 'resolved'
          ? 'Marked resolved.'
          : status === 'dismissed'
            ? 'Report dismissed.'
            : 'Report reopened.'
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the report.')
    } finally {
      setBusyId(null)
    }
  }

  // After editing a question, refresh its copy in the list so the fix is visible.
  const handleSaved = (q: Question) => {
    setItems((prev) =>
      prev.map((x) => (x.question_id === q.id ? { ...x, question: q } : x))
    )
    setEditing(null)
    toast.success('Question updated. Mark the report resolved when you are done.')
  }

  return (
    <div>
      {/* Status filter */}
      <div className="mb-5 flex w-full overflow-x-auto rounded-xl bg-tint p-1">
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
              <Icon size={16} /> {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex animate-fadeIn flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle size={30} className="text-coral" />
          <p className="font-body text-ink2">Could not load reports.</p>
          <button onClick={() => load(tab)} className="btn-soft press mt-1 px-4 py-2 text-sm">
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 size={30} className="text-mint" />
          <p className="font-body text-ink2">
            {tab === 'open' ? 'No open reports - all clear.' : `No ${tab} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => (
            <ReportCard
              key={r.question_id}
              report={r}
              index={i}
              lang={lang}
              busy={busyId === r.question_id}
              onEdit={() => r.question && setEditing(r.question)}
              onSetStatus={(s) => setStatus(r, s)}
            />
          ))}
        </div>
      )}

      {editing && (
        <QuestionEditor
          initial={editing}
          config={null}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function ReportCard({
  report: r,
  index,
  lang,
  busy,
  onEdit,
  onSetStatus,
}: {
  report: ReportedQuestion
  index: number
  lang: 'en' | 'ta' | 'both'
  busy: boolean
  onEdit: () => void
  onSetStatus: (s: ReportStatus) => void
}) {
  const q = r.question
  const when = new Date(r.last_reported).toLocaleDateString()

  return (
    <div
      style={{ '--i': index } as React.CSSProperties}
      className="card stagger-item p-4 sm:p-5"
    >
      {/* Header: report count + last-reported date */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coralsoft px-2.5 py-1 font-heading text-xs font-bold text-coral">
          <Flag size={13} />
          {r.report_count} report{r.report_count === 1 ? '' : 's'}
        </span>
        <span className="font-body text-[11px] text-ink2">Last flagged {when}</span>
      </div>

      {q ? (
        <>
          <p className="tamil mb-3 whitespace-pre-line font-heading text-base font-bold leading-snug text-ink">
            <MathText text={displayQuestion(q, lang)} />
          </p>
          <div className="mb-3 flex flex-col gap-1.5">
            {optionLetters(q).map((letter) => {
              const isCorrect = q.correct_answer === letter
              return (
                <div
                  key={letter}
                  className={[
                    'tamil flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                    isCorrect ? 'bg-mintsoft font-semibold text-mint' : 'text-ink2',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isCorrect ? 'bg-mint text-white' : 'bg-brand-soft text-brand',
                    ].join(' ')}
                  >
                    {letter}
                  </span>
                  <MathText text={displayOption(q, letter, lang)} />
                  {isCorrect && <span className="ml-auto text-xs font-bold">✓</span>}
                </div>
              )
            })}
          </div>
          {displayExplanation(q, lang) && (
            <div className="mb-3 rounded-lg border-l-4 border-brand bg-brand-soft/40 p-3">
              <p className="tamil whitespace-pre-line font-body text-xs leading-relaxed text-ink2">
                <span className="font-heading font-bold text-brand">Explanation: </span>
                <MathText text={displayExplanation(q, lang)} />
              </p>
            </div>
          )}
          {(q.category || q.subject || q.topic) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[q.category, q.subject, q.topic].filter(Boolean).map((tag, k) => (
                <span
                  key={k}
                  className="rounded-full bg-tint px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mb-3 rounded-lg bg-tint px-3 py-4 text-center font-body text-sm text-ink2">
          This question no longer exists (deleted). Question id:{' '}
          <span className="font-mono text-xs">{r.question_id}</span>
        </p>
      )}

      {/* Student-submitted reasons */}
      {r.reasons.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2">
            Student notes
          </p>
          {r.reasons.map((reason, k) => (
            <p
              key={k}
              className="tamil rounded-lg border border-line bg-canvas px-3 py-1.5 font-body text-xs text-ink"
            >
              “{reason}”
            </p>
          ))}
        </div>
      )}

      {/* Resolver attribution (resolved / dismissed views) */}
      {r.status !== 'open' && r.resolver_name && (
        <p className="mb-3 font-body text-[11px] text-ink2">
          {r.status === 'resolved' ? 'Resolved' : 'Dismissed'} by {r.resolver_name}
          {r.resolved_at ? ` · ${new Date(r.resolved_at).toLocaleDateString()}` : ''}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {q && (
          <button
            onClick={onEdit}
            disabled={busy}
            className="press focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-heading text-xs font-semibold text-ink transition hover:border-brand-ring disabled:opacity-50"
          >
            <Pencil size={14} /> Fix question
          </button>
        )}
        {r.status !== 'resolved' && (
          <button
            onClick={() => onSetStatus('resolved')}
            disabled={busy}
            className="press focus-ring inline-flex items-center gap-1.5 rounded-lg border border-mint/40 bg-mintsoft px-3 py-1.5 font-heading text-xs font-semibold text-mint transition hover:border-mint disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Resolve
          </button>
        )}
        {r.status !== 'dismissed' && (
          <button
            onClick={() => onSetStatus('dismissed')}
            disabled={busy}
            className="press focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-heading text-xs font-semibold text-ink2 transition hover:border-coral/40 hover:text-coral disabled:opacity-50"
          >
            <XCircle size={14} /> Dismiss
          </button>
        )}
        {r.status !== 'open' && (
          <button
            onClick={() => onSetStatus('open')}
            disabled={busy}
            className="press focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-heading text-xs font-semibold text-ink2 transition hover:border-brand-ring hover:text-brand disabled:opacity-50"
          >
            <RotateCcw size={14} /> Reopen
          </button>
        )}
      </div>
    </div>
  )
}
