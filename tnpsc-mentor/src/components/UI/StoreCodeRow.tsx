// ─── "Have a code?" — the native replacement for the coupon input ───────────
// Rendered by the paywall cards in place of the promoter-coupon field, which is
// web-only (see lib/purchase.ts couponMode() for why). Two shapes:
//
//   iOS     → a button that opens Apple's own offer-code redemption sheet.
//             Redemption happens out-of-band, so on close we re-run the recovery
//             sweep, which is what actually finds and verifies the purchase.
//
//   Android → a hint, not a button. Play promo codes are redeemed from inside
//             the Google Play payment sheet during checkout and there is no API
//             to open that from here — so the honest thing is to point at it.
//             Buyers do not find "Redeem code" on their own.

import { useState } from 'react'
import { Loader2, Tag } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'
import { couponMode } from '../../lib/purchase'
import { redeemOfferCode } from '../../lib/iap'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { useCreditsStore } from '../../store/creditsStore'

export default function StoreCodeRow({ onRedeemed }: { onRedeemed?: () => void }) {
  const { t } = useT()
  const mode = couponMode()
  const [busy, setBusy] = useState(false)
  const refreshEntitlements = useEntitlementsStore((s) => s.refresh)
  const reloadCredits = useCreditsStore((s) => s.reload)

  if (mode === 'input') return null

  if (mode === 'play-sheet') {
    return (
      <p className="tamil flex items-start gap-1.5 rounded-field bg-tint/50 px-3 py-2 font-body text-2xs leading-relaxed text-ink2">
        <Tag size={12} className="mt-0.5 flex-shrink-0 text-brand" />
        {t('playRedeemHint')}
      </p>
    )
  }

  const redeem = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await redeemOfferCode()
      if (res === 'redeemed') {
        refreshEntitlements()
        reloadCredits()
        toast.success(t('offerCodeRedeemed'))
        onRedeemed?.()
      } else if (res === 'unsupported') {
        toast.info(t('offerCodeUnsupported'))
      }
      // 'nothing' / 'dismissed' → the user closed the sheet without redeeming.
      // Saying anything here would nag someone who simply changed their mind.
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={redeem}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-field border border-line bg-card px-3 py-2 font-heading text-xs font-semibold text-ink2 transition-all hover:border-brand/40 hover:text-ink disabled:opacity-60"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
      {t('haveACode')}
    </button>
  )
}
