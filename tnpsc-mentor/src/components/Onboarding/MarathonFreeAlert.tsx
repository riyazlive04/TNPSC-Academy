import { ArrowRight, CalendarDays, Trophy } from 'lucide-react'
import { useT } from '../../lib/i18n'

/**
 * One-time promo alert for freshly signed-up accounts: the Test Marathon's
 * first paper is free for everyone ("try before you enroll", per the flyer).
 * Shown on the dashboard AFTER the first-run sequence (starter-test prompt +
 * guided tour) has fully resolved, so it never stacks on another overlay.
 * Both buttons consume the alert - it never reappears.
 */
export default function MarathonFreeAlert({
  onTake,
  onDismiss,
}: {
  /** Go to the Test Marathon (the caller consumes the alert first). */
  onTake: () => void
  /** Dismiss for good. */
  onDismiss: () => void
}) {
  const { t } = useT()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px] animate-fadeInFast"
      role="dialog"
      aria-modal="true"
      aria-label={t('marathonFreeTitle')}
    >
      <div className="w-full max-w-sm animate-sheetIn overflow-hidden rounded-3xl border border-line bg-card text-center shadow-card">
        {/* Brand header strip - mirrors the VettriCard marathon banner. */}
        <div className="bg-gradient-to-r from-brand to-brand-dark px-6 py-5 text-white">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
            <Trophy size={24} />
          </span>
          <h2 className="tamil mt-3 font-display text-lg font-bold leading-tight tracking-tight">
            {t('marathonFreeTitle')}
          </h2>
        </div>

        <div className="p-6">
          <p className="tamil font-body text-sm leading-relaxed text-muted">
            {t('marathonFreeBody')}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-mintsoft px-3 py-1 font-heading text-2xs font-bold uppercase text-mint">
              {t('marathonFreeBadge')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1 font-heading text-2xs font-semibold text-ink2">
              <CalendarDays size={12} /> 100 Q · 90 min
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <button onClick={onTake} className="btn-brand w-full py-2.5 text-sm">
              {t('marathonFreeCta')} <ArrowRight size={16} />
            </button>
            <button onClick={onDismiss} className="btn-ghost w-full py-2 text-sm">
              {t('marathonFreeLater')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
