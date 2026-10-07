import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useT } from '../../lib/i18n'

/**
 * The strip that explains why the Group 1 papers are greyed out: the 2026 prelims
 * has been sat, so this is a finished exam rather than a dead or broken product.
 *
 * Deliberately a calm, muted info strip and not a warning: nothing has gone
 * wrong, nobody has lost anything, and the papers behind it are still playable
 * by everyone who bought them. A red/amber treatment here would read as "your
 * purchase is broken" to exactly the people who paid.
 *
 * `onNext` turns it from a notice into a signpost — Group 1 is behind them, but
 * Group 2/2A is not — so a learner who arrives on retired content has somewhere
 * to go instead of a dead end. Omitted where there is nothing live to point at.
 */
export default function Group1ArchivedNotice({
  onNext,
  className = '',
}: {
  onNext?: () => void
  className?: string
}) {
  const { t } = useT()

  return (
    <div
      className={`rounded-card border border-line bg-tint p-4 ${className}`}
      // Not role="alert": this is standing context about the page, not a thing
      // that just happened, and an alert would interrupt a screen reader mid-flow
      // on every single visit.
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-card text-muted">
          <CheckCircle2 size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="tamil font-heading text-sm font-bold text-ink">{t('g1ArchivedTitle')}</h3>
            <span className="tamil inline-flex shrink-0 items-center rounded-md bg-card px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-muted">
              {t('g1ArchivedChip')}
            </span>
          </div>
          <p className="tamil mt-1 font-body text-xs leading-snug text-ink2">{t('g1ArchivedBody')}</p>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="tamil btn-wrap mt-2.5 inline-flex items-center gap-1.5 font-heading text-xs font-bold text-brand transition-colors hover:text-brand-dark"
            >
              {t('g1ArchivedNextCta')} <ArrowRight size={14} className="flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
