import { useEffect } from 'react'
import { Smartphone, Monitor, ShieldAlert, LogOut } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { useT, type StringKey } from '../../lib/i18n'
import type { DeviceSession } from '../../lib/api'

interface DeviceLimitModalProps {
  open: boolean
  devices: DeviceSession[]
  /** session id currently being signed out (shows a spinner / disables the list). */
  busyId: string | null
  onSignOut: (sessionId: string) => void
  onClose: () => void
}

/** "x min ago"-style label for a last-seen timestamp, in the chosen language. */
function relativeTime(iso: string, t: (k: StringKey) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('activeNow')
  if (min < 60) return `${min} ${t('minutesAgo')}`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${t('hoursAgo')}`
  const day = Math.floor(hr / 24)
  return `${day} ${t('daysAgo')}`
}

function isMobileLabel(label: string | null): boolean {
  return !!label && /Android|iOS|iPhone|iPad/i.test(label)
}

/**
 * Shown when sign-in is blocked because the account is already on the maximum
 * number of devices. Lists those devices with their last-active time and lets
 * the user sign one out to continue here. Reuses the app's modal chrome
 * (backdrop + sheet, Escape/click-outside to close).
 */
export default function DeviceLimitModal({
  open,
  devices,
  busyId,
  onSignOut,
  onClose,
}: DeviceLimitModalProps) {
  const { t } = useT()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busyId, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast"
      onClick={() => !busyId && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-limit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-coralsoft text-coral">
            <ShieldAlert size={22} />
          </span>
          <h2 id="device-limit-title" className="font-display text-lg font-bold text-ink">
            {t('deviceLimitTitle')}
          </h2>
          <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">
            {t('deviceLimitMsg')}
          </p>
        </div>

        <ul className="space-y-3">
          {devices.map((d) => {
            const Icon = isMobileLabel(d.label) ? Smartphone : Monitor
            const busy = busyId === d.id
            return (
              <li key={d.id} className="rounded-card border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-tile bg-tint-violet text-primary">
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-semibold text-ink">
                      {d.label || t('unknownDevice')}
                    </p>
                    <p className="tamil mt-0.5 font-body text-xs text-muted">
                      {t('lastActive')}: {relativeTime(d.last_seen_at, t)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onSignOut(d.id)}
                  disabled={!!busyId}
                  className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-coral px-3 py-2.5 font-heading text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  {busy ? <Spinner size={14} /> : <LogOut size={14} />}
                  <span className="tamil">{t('signOutThisDevice')}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <button
          onClick={onClose}
          disabled={!!busyId}
          className="btn-ghost press mt-5 w-full px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
