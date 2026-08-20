import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useT } from '../../lib/i18n'
import { useAuthStore } from '../../store/authStore'
import {
  nativePushConfigured,
  nativePushGranted,
  enableNativePush,
  pushPrimerShown,
  markPushPrimerShown,
} from '../../lib/nativePush'

/**
 * One-time in-app explanation shown before the native OS push-permission
 * dialog. Android/iOS both permanently remember the OS dialog's answer, so a
 * cold "Allow notifications?" with zero context converts far worse than one
 * with a reason attached - this is that reason, and it only ever gets one
 * shot at being shown (see markPushPrimerShown).
 *
 * Deliberately NOT shown on the dashboard ('/test-arena'), so it never stacks
 * on top of <OnboardingTour> for brand-new accounts, and not on any bare
 * (chrome-less) route - it waits for the learner to be somewhere ordinary.
 */
const EXCLUDED_ROUTES = [
  '/test-arena',
  '/complete-profile',
  '/language',
  '/quiz',
  '/mock/quiz',
  '/payment-success',
]

/** Small settle delay so this never fights the splash screen / first paint. */
const SHOW_DELAY_MS = 2000

export default function PushPrimer() {
  const { t } = useT()
  const location = useLocation()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [open, setOpen] = useState(false)
  const [enabling, setEnabling] = useState(false)

  const eligible =
    Capacitor.isNativePlatform() &&
    nativePushConfigured() &&
    !!userId &&
    !pushPrimerShown() &&
    !EXCLUDED_ROUTES.includes(location.pathname)

  useEffect(() => {
    if (!eligible) return
    let cancelled = false
    const id = window.setTimeout(() => {
      void (async () => {
        // Skip the card entirely if the OS already has an answer on file
        // (e.g. granted earlier via the Profile toggle).
        const granted = await nativePushGranted()
        if (!cancelled && !granted) setOpen(true)
      })()
    }, SHOW_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
    // Only re-evaluate when the eligibility inputs actually change, not on
    // every route change once already shown/dismissed this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible])

  if (!open) return null

  const dismiss = () => {
    markPushPrimerShown()
    setOpen(false)
  }

  const handleEnable = async () => {
    setEnabling(true)
    await enableNativePush()
    setEnabling(false)
    dismiss()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fadeInFast"
      role="dialog"
      aria-modal="true"
      aria-label={t('pushPrimerTitle')}
    >
      <div aria-hidden className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]" onClick={dismiss} />
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-card animate-sheetIn">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-tile bg-tint-violet text-primary">
          <Bell size={20} />
        </div>
        <h2 className="tamil font-display text-lg font-bold leading-tight tracking-tight text-ink">
          {t('pushPrimerTitle')}
        </h2>
        <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-muted">
          {t('pushPrimerBody')}
        </p>
        <div className="mt-5 space-y-2">
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="btn-brand w-full py-2.5 text-sm disabled:opacity-70"
          >
            {t('pushPrimerEnable')}
          </button>
          <button onClick={dismiss} className="btn-ghost w-full py-2 text-sm">
            {t('pushPrimerDismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
