import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { useTestSeriesEnabled } from '../../hooks/useTestSeriesEnabled'
import { useAuth } from '../../hooks/useAuth'
import { useT } from '../../lib/i18n'
import { VETTRI_PRICE_RUPEES } from './VettriCard'

/**
 * Test Marathon promo strip, shown ABOVE the Vettri/Premium upsell cards. Leads
 * with the cheapest way in (₹899 Vettri Nichayam). Self-gating: renders nothing
 * while entitlements are unresolved, for anyone who already has a paid bundle,
 * or when the superadmin has the Test Marathon feature switched off.
 */
export default function MarathonBanner({
  className = '',
  /** Route the CTA navigates to; omit to hide the button (e.g. when the buy
   *  cards sit directly beneath the banner). */
  ctaTo,
}: {
  className?: string
  ctaTo?: string
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  const seriesOn = useTestSeriesEnabled()
  const { unlimited, loaded, refresh } = useEntitlementsStore()

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  // Staff never buy — hide the marathon upsell for admins/superadmins.
  if (isAdmin || isSuperAdmin) return null
  if (!seriesOn || !loaded || unlimited) return null

  return (
    <div
      className={`relative overflow-hidden rounded-card bg-gradient-to-r from-brand to-brand-dark p-5 text-white shadow-brand ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <CalendarDays size={22} />
          </span>
          <div className="min-w-0">
            <h3 className="tamil font-display text-base font-bold tracking-tight sm:text-lg">
              {t('marathonBannerTitle')}
            </h3>
            <p className="tamil mt-0.5 font-body text-xs text-white/85 sm:text-sm">
              {t('marathonBannerSub')}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          <span className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            ₹{VETTRI_PRICE_RUPEES}
          </span>
          <span className="tamil font-body text-[11px] text-white/85">
            {t('marathonBannerVia')}
          </span>
          {ctaTo && (
            <button
              onClick={() => navigate(ctaTo)}
              className="tamil press mt-1.5 inline-flex items-center gap-1 rounded-pill bg-white px-3.5 py-1.5 font-heading text-xs font-semibold text-brand transition hover:brightness-95"
            >
              {t('marathonBannerCta')} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
