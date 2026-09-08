import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ListChecks, Loader2 } from 'lucide-react'
import PurchaseConfirmModal from '../components/UI/PurchaseConfirmModal'
import { useAuth } from '../hooks/useAuth'
import { usePlanSales } from '../hooks/usePlanSales'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../hooks/useMockPackPurchase'
import { isAndroidWebView, openInBrowser } from '../lib/webview'
import { useT } from '../lib/i18n'

/** The path this page is served at. Kept as a constant because it is also the
 *  `?from=` value handed to login/register and the AUTO_ENROLL_PATHS entry that
 *  resumes checkout afterwards — three places that must agree exactly. */
export const MOCK_PACK_BUY_PATH = '/mock-test-pack'

const PERK_KEYS = [
  'mockPackBannerSub',
  'mockPackPerkPyq',
  'mockPackPerk2',
  'mockPackPerk3',
] as const

/**
 * A direct pay link for the ₹399 Group 1 Mock Test Pack.
 *
 * Built to be handed to a buyer as a URL (ad, WhatsApp, a telecaller on a
 * call): it opens the confirm sheet on arrival, so the tap that follows is the
 * payment itself rather than a hunt through the pricing grid for the right
 * card.
 *
 * Checkout needs an account — /api/payments/order is behind requireAuth — so a
 * signed-out visitor is sent to register and returned here with checkout
 * resuming automatically, the same mechanism /rank-booster uses (see
 * postAuthState + AUTO_ENROLL_PATHS in lib/authRouting). The redirect rides in
 * `?from=` rather than the full URL because sanitizeFromPath deliberately
 * refuses anything but a bare same-site path, and widening that guard to carry
 * a query string would open it up as a redirect vector.
 */
export default function MockPackBuyPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth()
  const sales = usePlanSales()
  const purchase = useMockPackPurchase()

  const owned = purchase.mockPackUnlocked
  const staff = isAdmin || isSuperAdmin

  // Open the sheet on arrival — the whole point of the link. Waits for the
  // entitlement to load so an existing owner is never shown a payment prompt
  // for something they already have, and skips it when the plan is off sale
  // (the server would refuse that order anyway).
  useEffect(() => {
    if (!isAuthenticated || !purchase.loaded) return
    if (owned || staff || !sales.mockPack) return
    purchase.startEnroll()
    // Once per arrival: startEnroll is re-created each render, so depending on
    // it would reopen the sheet every time the user closed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, purchase.loaded, owned, staff, sales.mockPack])

  // Returning from signup/login on this page means "resume what you came for".
  // The state is cleared first so a later refresh doesn't replay it.
  useEffect(() => {
    if (!(location.state as { autoEnroll?: boolean } | null)?.autoEnroll) return
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Send a signed-out visitor to auth, carrying the way back. */
  const goAuth = (path: '/login' | '/register') => {
    // An in-app browser (Instagram/Facebook) hands off to a fresh browser
    // instance, where React Router state cannot survive — so the return path
    // rides in a query param that LoginPage/RegisterPage fall back to.
    if (isAndroidWebView) return openInBrowser(`${path}?from=${MOCK_PACK_BUY_PATH}`)
    navigate(path, { state: { from: { pathname: MOCK_PACK_BUY_PATH } } })
  }

  const cta = () => {
    if (!isAuthenticated) return goAuth('/register')
    if (owned || staff) return navigate('/mock')
    // Withdrawn from sale: the order would be refused, so send them into the
    // app rather than into a checkout that cannot complete.
    if (!sales.mockPack) return navigate('/test-arena')
    purchase.startEnroll()
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-skysoft text-sky">
            <ListChecks size={24} />
          </span>

          <h1 className="tamil mt-4 font-display text-2xl font-bold tracking-tight text-ink">
            {t('mockPackBannerTitle')}
          </h1>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-ink">
              ₹{MOCK_PACK_PRICE_RUPEES}
            </span>
            <span className="tamil font-body text-sm text-ink2">
              {t('mockPackValidity')} · {t('oneTimePaymentShort')}
            </span>
          </div>

          <ul className="mt-5 space-y-2.5">
            {PERK_KEYS.map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <Check size={16} className="mt-0.5 flex-shrink-0 text-sky" />
                <span className="tamil font-body text-sm leading-snug text-ink">{t(k)}</span>
              </li>
            ))}
          </ul>

          {owned || staff ? (
            <p className="tamil mt-6 rounded-field bg-mintsoft px-4 py-3 font-body text-sm text-ink">
              {t('mockPackAlreadyOwned')}
            </p>
          ) : null}

          <button
            onClick={cta}
            disabled={purchase.paying}
            className="btn-wrap btn-brand mt-6 flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60"
          >
            {purchase.paying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {owned || staff
                  ? t('mockPackOpenTests')
                  : `${t('mockPackGet')} · ₹${MOCK_PACK_PRICE_RUPEES}`}
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {!isAuthenticated && (
            <button
              onClick={() => goAuth('/login')}
              className="tamil mt-3 w-full font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
            >
              {t('signIn')}
            </button>
          )}
        </div>
      </div>

      <PurchaseConfirmModal
        open={purchase.confirmOpen}
        planName={t('mockPackBannerTitle')}
        validity={t('mockPackValidity')}
        perks={PERK_KEYS.map((k) => t(k))}
        priceLabel={purchase.isFree ? t('premiumFree') : purchase.displayPrice}
        isFree={purchase.isFree}
        accent="sky"
        busy={purchase.paying}
        onConfirm={purchase.handleBuy}
        onCancel={() => purchase.setConfirmOpen(false)}
      />
    </div>
  )
}
