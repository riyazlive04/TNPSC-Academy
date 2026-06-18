import { useEffect, useState } from 'react'
import { Crown, Check, Loader2, Tag, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { startCheckout } from '../../lib/razorpay'
import { toast } from '../../store/toastStore'
import { usePremiumStore } from '../../store/premiumStore'
import { api, type CouponValidation } from '../../lib/api'

// ─── Premium plan pricing ───────────────────────────────────────────────────
// Single source of truth for the annual plan. `PRICE_PAISE` is what the order is
// created for (₹1 = 100 paise); the MRP is shown struck-through. When the
// monetisation model firms up, derive these from a server-side plan instead.
export const PREMIUM_MRP_RUPEES = 1899
export const PREMIUM_PRICE_RUPEES = 1299
export const PREMIUM_PRICE_PAISE = PREMIUM_PRICE_RUPEES * 100
const SAVINGS = PREMIUM_MRP_RUPEES - PREMIUM_PRICE_RUPEES

const PERKS = [
  'Unlimited mock tests & full question bank',
  'All PDF explanations unlocked',
  'Detailed performance insights',
  'Priority support',
]

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Premium upsell card. Shows the struck MRP and the flat annual price, lets a
 * customer apply a promoter coupon (validated server-side), and runs the Razorpay
 * checkout (tagged `plan: premium_annual` so the ledger records *what* was bought
 * — the final price is always recomputed on the server from the coupon).
 */
export default function PremiumCard({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const [paying, setPaying] = useState(false)
  const { premium, loaded, refresh, markPremium } = usePremiumStore()

  // Coupon state.
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Check entitlement once on mount (the store dedupes — only the first card to
  // mount triggers the request; subsequent reads are instant from the store).
  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const applyCoupon = async () => {
    const trimmed = code.trim()
    if (!trimmed || checking) return
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: 'premium_annual' })
      if (result.valid) {
        setApplied(result)
        setCouponError(null)
      } else {
        setApplied(null)
        setCouponError(result.reason)
      }
    } catch (e) {
      setApplied(null)
      setCouponError(e instanceof Error ? e.message : 'Could not check that coupon.')
    } finally {
      setChecking(false)
    }
  }

  const removeCoupon = () => {
    setApplied(null)
    setCode('')
    setCouponError(null)
  }

  const handleBuy = async () => {
    if (paying) return
    setPaying(true)
    try {
      const result = await startCheckout({
        amount: PREMIUM_PRICE_PAISE,
        profile,
        description: 'TNPSC Mentor Premium — 1 year',
        notes: { plan: 'premium_annual' },
        couponCode: applied?.code,
      })
      if (result.status === 'paid') {
        toast.success('Welcome to Premium — thank you!')
        markPremium() // hide the card immediately…
        refresh() // …then reconcile with the server (expiry etc.)
      } else if (result.status === 'failed') toast.error(result.error)
      // 'dismissed' → user closed the modal; stay silent.
    } finally {
      setPaying(false)
    }
  }

  // Already premium (or still checking) → render nothing. Hiding until the first
  // check resolves avoids a flash of the upsell for users who already paid.
  if (!loaded || premium) return null

  const finalPaise = applied ? applied.finalAmount : PREMIUM_PRICE_PAISE

  return (
    <div className={`hero-panel relative overflow-hidden p-6 ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
        style={{ backgroundSize: '18px 18px' }}
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: title + perks */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/20">
            <Crown size={13} /> Premium
          </span>
          <h2 className="mt-3 font-heading text-xl font-semibold tracking-tight text-white">
            Go Premium — crack TNPSC faster
          </h2>
          <ul className="mt-3 space-y-1.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-white/85">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-white" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: price + coupon + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-baseline gap-2">
            {applied ? (
              <>
                <span className="font-body text-base text-white/50 line-through">
                  ₹{PREMIUM_PRICE_RUPEES}
                </span>
                <span className="font-heading text-3xl font-bold tracking-tight text-white">
                  ₹{rupees(finalPaise)}
                </span>
              </>
            ) : (
              <>
                <span className="font-body text-base text-white/50 line-through">
                  ₹{PREMIUM_MRP_RUPEES}
                </span>
                <span className="font-heading text-3xl font-bold tracking-tight text-white">
                  ₹{PREMIUM_PRICE_RUPEES}
                </span>
              </>
            )}
            <span className="font-body text-sm text-white/70">/year</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-accentwarm px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white">
            {applied
              ? `You save ₹${rupees(PREMIUM_PRICE_PAISE - finalPaise)}`
              : `Flat save ₹${SAVINGS}`}
          </span>

          {/* Coupon row */}
          {applied ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 ring-1 ring-white/25">
              <Tag size={14} className="text-white" />
              <span className="font-heading text-xs font-semibold text-white">
                {applied.code} applied
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                aria-label="Remove coupon"
                className="text-white/70 transition-colors hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <div className="flex items-center gap-1.5">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder="Coupon code"
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-32 rounded-lg bg-white/90 px-3 py-2 font-body text-sm text-brand-dark placeholder:text-brand-dark/40 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center rounded-lg bg-white/20 px-3 py-2 font-heading text-xs font-semibold text-white ring-1 ring-white/25 transition-all hover:bg-white/30 disabled:opacity-50"
                >
                  {checking ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                </button>
              </div>
              {couponError && (
                <span className="font-body text-xs text-white/90">{couponError}</span>
              )}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={paying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 font-heading text-sm font-semibold text-brand-dark shadow-pill transition-all hover:gap-2.5 hover:brightness-105 active:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Crown size={16} /> Get Premium
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
