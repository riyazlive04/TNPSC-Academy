import { useState } from 'react'
import { X } from 'lucide-react'
import Group1ArchivedNotice from './Group1ArchivedNotice'
import { useT } from '../../lib/i18n'

/** Per-device, so the announcement stops nagging once it has been read. */
const DISMISS_KEY = 'tnpsc-g1-retired-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // Private windows and blocked site data make this throw. An announcement
    // that cannot remember being dismissed is better than one that crashes the
    // dashboard, so treat it as not-yet-dismissed and carry on.
    return false
  }
}

/**
 * The in-app announcement that Group 1 2026 is finished.
 *
 * Needed because the dashboard goes QUIET about Group 1 the moment it is
 * archived: the ₹399 strip and the "test 1 is free" nudge are both gated on
 * their sale flags, so they simply vanish, and a student who had been working
 * through those papers gets no explanation of where the product went. The
 * paper grid on the hub explains itself, but only once you have navigated to
 * it — this says it on the screen everyone lands on.
 *
 * Dismissible, unlike the notice on the hub's paper grid: there, the notice is
 * the reason the cards look greyed and has to stay; here it is news, and news
 * read once should go away.
 */
export default function Group1RetiredAppBanner({ onBuy }: { onBuy?: () => void }) {
  const { t } = useT()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Dismissed for this view either way; it will just return next visit.
    }
  }

  return (
    <div className="relative">
      {/* pr-10 keeps the body text clear of the close button, which overlaps the
          card's own padding rather than taking a column of its own. */}
      <div className="[&>div]:pr-10">
        <Group1ArchivedNotice onNext={onBuy} />
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  )
}
