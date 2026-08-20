import { Lock, Play, CheckCircle2, X, Loader2, BookOpen } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { formatDuration, msUntil } from '../../lib/revisionTime'
import type { RevisionTopic } from '../../types'

interface Props {
  item: RevisionTopic
  onStart: (item: RevisionTopic) => void
  onDismiss: (item: RevisionTopic) => void
  busy?: boolean
}

/** One topic-revision card. Renders differently per derived status. */
export default function RevisionCard({ item, onStart, onDismiss, busy }: Props) {
  const { t } = useT()
  const title = item.label || t('revision')
  const countdown = item.status === 'locked' ? formatDuration(msUntil(item.available_at)) : ''

  return (
    <div className="rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tamil truncate font-heading text-base font-semibold text-ink" title={title}>
            {title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-xs text-muted">
            <span>
              {t('revLast')}: <b className="text-ink2">{item.last_score}%</b>
            </span>
            <span>
              {t('revBest')}: <b className="text-ink2">{item.best_score}%</b>
            </span>
            <span>
              {item.attempts} {t('revAttempts')}
            </span>
          </p>
        </div>
        <StatusBadge status={item.status} countdown={countdown} />
      </div>

      {item.status === 'locked' && (
        <p className="tamil mt-3 flex items-start gap-1.5 font-body text-xs text-gold">
          <BookOpen size={14} className="mt-0.5 shrink-0" />
          {t('revStudyHint')}
        </p>
      )}

      {item.status !== 'cleared' && (
        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={() => onStart(item)}
            disabled={item.status === 'locked' || busy}
            className="btn-brand flex-1 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : item.status === 'locked' ? (
              <Lock size={16} />
            ) : (
              <Play size={16} />
            )}
            {t('revTakeTest')}
          </button>
          <button
            onClick={() => onDismiss(item)}
            disabled={busy}
            aria-label={t('revDismiss')}
            title={t('revDismiss')}
            className="btn-ghost grid h-10 w-10 place-items-center px-0"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, countdown }: { status: RevisionTopic['status']; countdown: string }) {
  const { t } = useT()
  if (status === 'cleared') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 font-heading text-2xs font-semibold text-mint">
        <CheckCircle2 size={13} /> {t('revClearedTitle')}
      </span>
    )
  }
  if (status === 'available') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 font-heading text-2xs font-semibold text-mint">
        <Play size={12} /> {t('revStatReady')}
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 font-heading text-2xs font-semibold text-gold">
      <Lock size={12} /> {t('revUnlocksIn')} {countdown}
    </span>
  )
}
