import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Coins, Crown, Trophy, X } from 'lucide-react'
import PremiumCard from './PremiumCard'
import VettriCard from './VettriCard'
import { useFocusTrap } from './useFocusTrap'
import { useUpsellStore } from '../../store/upsellStore'
import { useCreditsStore } from '../../store/creditsStore'
import { useT, type StringKey } from '../../lib/i18n'

/**
 * The forced-upsell overlay: opened (via upsellStore) the moment a paywall
 * actually blocks the learner — out of credits at a test start, or a tap on a
 * Premium/Vettri-locked feature — and answers it with the REAL purchase cards
 * (PremiumCard / VettriCard carry the whole coupon → confirm → Razorpay →
 * entitlement-refresh machinery, so there is nothing to duplicate here).
 *
 * Mounted once in App (inside the Router). Sits at z-[50], deliberately BELOW
 * the purchase-confirm/suggest dialogs (z-[55]) the embedded cards raise, and
 * below the onboarding tour (z-[70]). Closes on Escape/backdrop/X, on any
 * navigation (the Vettri-suggest path navigates to /vettri), and automatically
 * once a purchase lands (the learner turns unlimited — nothing left to sell).
 */
export default function UpsellModal() {
  const { t } = useT()
  const open = useUpsellStore((s) => s.open)
  const variant = useUpsellStore((s) => s.variant)
  const cost = useUpsellStore((s) => s.cost)
  const close = useUpsellStore((s) => s.close)
  const balance = useCreditsStore((s) => s.balance)
  const unlimited = useCreditsStore((s) => s.loaded && s.unlimited)

  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  // Any route change means the user left this decision point (e.g. the
  // Vettri-suggest modal navigated to /vettri, which carries its own card).
  const { pathname } = useLocation()
  const openedAt = useRef(pathname)
  useEffect(() => {
    if (open) openedAt.current = pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (open && pathname !== openedAt.current) close()
  }, [open, pathname, close])

  // Purchase landed (or the account was already paid) → nothing to sell.
  useEffect(() => {
    if (open && unlimited) close()
  }, [open, unlimited, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const head: Record<
    typeof variant,
    { icon: React.ReactNode; tone: string; titleKey: StringKey; bodyKey: StringKey }
  > = {
    credits: {
      icon: <Coins size={22} />,
      tone: 'bg-accentwarmsoft text-accentwarm',
      titleKey: 'upsellCreditsTitle',
      bodyKey: 'upsellCreditsBody',
    },
    premium: {
      icon: <Crown size={22} />,
      tone: 'bg-mint/15 text-mint',
      titleKey: 'upsellPremiumTitle',
      bodyKey: 'upsellPremiumBody',
    },
    bundle: {
      icon: <Trophy size={22} />,
      tone: 'bg-gold/15 text-gold',
      titleKey: 'upsellBundleTitle',
      bodyKey: 'upsellBundleBody',
    },
  }
  const h = head[variant]

  return (
    <div
      className="fixed inset-0 z-[50] overflow-y-auto bg-ink/50 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upsell-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-6 w-full max-w-xl animate-sheetIn rounded-3xl border border-line bg-card p-5 shadow-card outline-none sm:p-6"
      >
        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${h.tone}`}>
            {h.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="upsell-title" className="tamil font-heading text-lg font-bold leading-tight text-ink">
              {t(h.titleKey)}
            </h2>
            <p className="tamil mt-1 font-body text-sm leading-relaxed text-ink2">
              {t(h.bodyKey)}
            </p>
            {variant === 'credits' && cost != null && (
              <p className="tamil mt-2 font-body text-sm text-ink2">
                {t('upsellCreditsNeed')
                  .replace('{n}', String(cost))
                  .replace('{b}', String(balance))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('cancel')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink2/70 transition hover:bg-tint hover:text-ink focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        {/* The real purchase cards. Vettri (cheaper) leads except on
            Premium-ONLY features, where pitching it would mislead. */}
        <div className="space-y-4">
          {variant !== 'premium' && <VettriCard />}
          <PremiumCard />
        </div>

        {/* Soft escape - the credits variant reminds them tomorrow is free. */}
        <div className="mt-5 text-center">
          {variant === 'credits' && (
            <p className="tamil mb-2 font-body text-xs text-ink2">{t('upsellCreditsTomorrow')}</p>
          )}
          <button onClick={close} className="btn-ghost px-5 py-2 text-sm">
            {t('upsellLater')}
          </button>
        </div>
      </div>
    </div>
  )
}
