// ─── Cookie consent banner (website only) ───────────────────────────────────
// Shown until the visitor answers. Accept and Reject are given equal visual
// weight on purpose: a consent that is easier to give than to refuse is not
// "free" under the DPDP Act, and regulators treat a buried reject as no consent
// at all.
//
// Never renders in the apps — they ship with no tracker, so there is nothing to
// consent to and a banner there would be a lie.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useT } from '../lib/i18n'
import { getConsent, setConsent } from '../lib/cookieConsent'

export default function CookieBanner() {
  const { t } = useT()
  const isNative = Capacitor.isNativePlatform()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isNative) return
    // Read on mount rather than during render — localStorage access can throw
    // in a locked-down browser and must not break the first paint.
    if (getConsent() === null) setOpen(true)
  }, [isNative])

  if (isNative || !open) return null

  const choose = (choice: 'accepted' | 'rejected') => {
    setConsent(choice)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookieTitle')}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-card/98 p-4 shadow-2xl backdrop-blur"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Cookie size={18} />
        </span>
        <p className="tamil flex-1 font-body text-sm leading-relaxed text-ink2">
          {t('cookieBody')}{' '}
          <Link to="/privacy" className="text-brand hover:underline">
            {t('privacyPolicy')}
          </Link>
          .
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={() => choose('rejected')}
            className="flex-1 rounded-pill border border-line bg-card px-4 py-2 font-heading text-sm font-semibold text-ink2 transition-colors hover:text-ink sm:flex-none"
          >
            {t('cookieReject')}
          </button>
          <button
            onClick={() => choose('accepted')}
            className="flex-1 rounded-pill bg-brand-gradient px-4 py-2 font-heading text-sm font-semibold text-white transition-all hover:brightness-105 sm:flex-none"
          >
            {t('cookieAccept')}
          </button>
        </div>
      </div>
    </div>
  )
}
