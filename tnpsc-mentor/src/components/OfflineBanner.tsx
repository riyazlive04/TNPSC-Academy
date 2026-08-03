// ─── Offline banner ─────────────────────────────────────────────────────────
// A persistent, non-dismissable strip while the device has no usable network.
//
// This exists because of how the app fails without it. Questions, grading and
// entitlement all live server-side, so with no connection a tap just does
// nothing — no error, no spinner, no explanation. Reviewers on both stores test
// exactly this (Apple calls out "adequate handling of network unavailability"
// under 4.2, and it is a routine Play pre-launch report finding), and a user who
// loses signal mid-test deserves to know why the next question won't load.
//
// Uses @capacitor/network on native (which sees the OS's own connectivity state,
// including captive portals) and the browser's online/offline events on the web.

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useT } from '../lib/i18n'

export default function OfflineBanner() {
  const { t } = useT()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let remove: (() => void) | undefined
      void (async () => {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setOffline(!status.connected)
        const handle = await Network.addListener('networkStatusChange', (s) =>
          setOffline(!s.connected)
        )
        remove = () => void handle.remove()
      })()
      return () => remove?.()
    }

    // navigator.onLine only reports whether an interface exists, not whether it
    // reaches anything — good enough to catch the common case (airplane mode,
    // signal lost) without polling the network on a timer.
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-coral px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center font-heading text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff size={14} className="flex-shrink-0" />
      <span className="tamil">{t('offlineBanner')}</span>
    </div>
  )
}
