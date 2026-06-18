import { useState } from 'react'
import { Crown, Check, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { startCheckout } from '../../lib/razorpay'
import { toast } from '../../store/toastStore'

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

/**
 * Premium upsell card. Shows the struck MRP and the flat annual price, lists the
 * perks, and runs the Razorpay checkout (tagged `plan: premium_annual` so the
 * payment ledger records *what* was bought — gating reads from there later).
 */
export default function PremiumCard({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const [paying, setPaying] = useState(false)

  const handleBuy = async () => {
    if (paying) return
    setPaying(true)
    try {
      const result = await startCheckout({
        amount: PREMIUM_PRICE_PAISE,
        profile,
        description: 'TNPSC Mentor Premium — 1 year',
        notes: { plan: 'premium_annual' },
      })
      if (result.status === 'paid') toast.success('Welcome to Premium — thank you!')
      else if (result.status === 'failed') toast.error(result.error)
      // 'dismissed' → user closed the modal; stay silent.
    } finally {
      setPaying(false)
    }
  }

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

        {/* Right: price + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-baseline gap-2">
            <span className="font-body text-base text-white/50 line-through">
              ₹{PREMIUM_MRP_RUPEES}
            </span>
            <span className="font-heading text-3xl font-bold tracking-tight text-white">
              ₹{PREMIUM_PRICE_RUPEES}
            </span>
            <span className="font-body text-sm text-white/70">/year</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-accentwarm px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white">
            Flat save ₹{SAVINGS}
          </span>
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
