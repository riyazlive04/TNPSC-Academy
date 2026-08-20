import { Coins, ChevronRight } from 'lucide-react'
import PremiumCard from './PremiumCard'
import VettriCard from './VettriCard'
import { useCreditsStore } from '../../store/creditsStore'
import { upsell } from '../../store/upsellStore'
import { useT } from '../../lib/i18n'

/**
 * The dashboard payment banner, shown ONLY when the learner's credits actually
 * run out (or are about to). The plan cards used to sit on the dashboard
 * permanently, where a learner who could still practise had no reason to read
 * them; here they arrive at the one moment the pitch answers a real problem -
 * "I want to take a test and I can't".
 *
 * Three states, in order of urgency:
 *   balance === 0            → the full banner: headline + both purchase cards.
 *   balance < LOW_CREDITS    → a single compact strip that opens the same cards
 *                              in the forced-upsell modal (one tap, no scroll).
 *   otherwise / unlimited    → nothing at all.
 *
 * Paid users and staff are `unlimited` (server-side), so this whole surface
 * disappears for them without any extra role check.
 */

/** Below this the balance can't cover even the smallest (20-question) test. */
const LOW_CREDITS = 20

export default function CreditWall({ className = '' }: { className?: string }) {
  const { t } = useT()
  const loaded = useCreditsStore((s) => s.loaded)
  const unlimited = useCreditsStore((s) => s.unlimited)
  const balance = useCreditsStore((s) => s.balance)

  if (!loaded || unlimited || balance >= LOW_CREDITS) return null

  // ── Running low: one quiet strip, not a wall of pricing. Tapping it opens the
  // forced-upsell modal, which carries the same two purchase cards.
  if (balance > 0) {
    return (
      <button
        type="button"
        onClick={() => upsell.credits()}
        className={`press focus-ring flex w-full items-center gap-3 rounded-card border border-accentwarm/30 bg-accentwarmsoft p-4 text-left ${className}`}
      >
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accentwarm/15 text-accentwarm">
          <Coins size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="tamil block font-heading text-sm font-semibold text-ink">
            {t('creditsLowTitle').replace('{b}', String(balance))}
          </span>
          <span className="tamil mt-0.5 block font-body text-xs leading-snug text-ink2">
            {t('creditsLowBody')}
          </span>
        </span>
        <ChevronRight size={18} className="flex-shrink-0 text-accentwarm" />
      </button>
    )
  }

  // ── Out of credits: the full payment banner.
  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="credit-wall-title">
      <div className="rounded-card border border-coral/30 bg-coralsoft/60 p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-coral">
          <Coins size={13} /> {t('upsellCreditsTitle')}
        </span>
        <h2
          id="credit-wall-title"
          className="tamil mt-3 font-display text-lg font-bold leading-tight tracking-tight text-ink"
        >
          {t('creditWallTitle')}
        </h2>
        <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">
          {t('creditWallBody')}
        </p>
        <p className="tamil mt-2.5 font-body text-xs leading-snug text-ink2">
          {t('upsellCreditsTomorrow')}
        </p>
      </div>

      {/* The real purchase machinery - Vettri (cheaper entry) leads. Each card
          hides itself once that plan is owned. */}
      <VettriCard />
      <PremiumCard />
    </section>
  )
}
