import { ChevronRight, FileText, Loader2 } from 'lucide-react'
import { useT } from '../../lib/i18n'

/**
 * The "Full Paper" entry on the PYQ screens: sit a whole previous-year paper in
 * the order it was printed, instead of a sample of one subject or section.
 *
 * It needs a YEAR — a paper is a paper because it is one sitting, so with "All
 * Years" selected the panel renders as a prompt to pick a year rather than
 * disappearing. A disabled-looking card that says why is a signpost to the chip
 * row just above it; a card that vanishes just loses the feature.
 *
 * Shares the gradient hero treatment with the section screen's "All Questions"
 * panel, one visual rank above the subject/section cards below it, because it
 * is the one entry on these pages that is a whole exam rather than a slice.
 */
export default function FullPaperHero({
  year,
  count,
  onClick,
}: {
  /** The selected exam year, or null for "All Years". */
  year: number | null
  /** Questions in that year's paper — undefined while still counting. */
  count?: number
  onClick: () => void
}) {
  const { t } = useT()
  const ready = year != null && (count ?? 0) > 0

  return (
    <button
      onClick={ready ? onClick : undefined}
      disabled={!ready}
      className="hero-panel interactive group relative mb-4 flex w-full items-center gap-4 p-5 text-left disabled:opacity-45"
    >
      <span
        className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
        style={{ backgroundSize: '18px 18px' }}
      />
      <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-white/15 text-white ring-1 ring-white/20">
        <FileText size={20} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="tamil block font-display text-base font-semibold text-white">
          {year != null ? `${t('fullPaper')} · ${year}` : t('fullPaper')}
        </span>
        {year == null ? (
          <span className="tamil block font-body text-xs text-white/70">
            {t('fullPaperPickYear')}
          </span>
        ) : count == null ? (
          <span className="inline-flex items-center gap-1.5 font-body text-xs text-white/70">
            <Loader2 size={12} className="animate-spin" /> {t('countingQuestions')}
          </span>
        ) : (
          <span className="tamil block font-body text-xs text-white/70">
            <span className="font-heading font-bold tabular-nums">{count.toLocaleString()}</span>{' '}
            {t('questionsCount')} · {t('fullPaperSub')}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="relative flex-shrink-0 text-white/50" />
    </button>
  )
}
