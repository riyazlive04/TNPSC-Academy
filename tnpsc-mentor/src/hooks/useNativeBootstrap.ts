// ─── Native app boot sequence ───────────────────────────────────────────────
// Everything the installed app has to do on launch that the web build does not.
// Kept in one hook so App.tsx doesn't grow a pile of platform branches, and so
// each concern can say why it exists:
//
//  • status bar   — targetSdk 36 forces edge-to-edge on Android with no opt-out,
//                   so the bar must be made transparent and the web layer given
//                   real safe-area insets, or the header sits under the clock.
//  • splash       — hidden once React has actually painted, not on a timer.
//  • purchases    — re-submit anything the store charged for but our server never
//                   recorded (app killed mid-purchase, offline at the wrong
//                   moment). Without this a user can be charged with no access.
//  • push token   — refresh a rotated APNs/FCM token for users who already opted
//                   in. Never prompts.
//  • deep links   — an https://app.tnpscmentors.in/... link opened from outside
//                   arrives here and must become an in-app navigation rather
//                   than a full page load.

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { finishPendingPurchases } from '../lib/iap'
import { refreshNativePushToken } from '../lib/nativePush'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { useCreditsStore } from '../store/creditsStore'
import { useAuthStore } from '../store/authStore'

const APP_HOST = 'app.tnpscmentors.in'

export function useNativeBootstrap(): void {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  // ── Chrome: transparent status bar + dismiss the splash ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        // Draw behind the status bar; index.css already pads for it via
        // env(safe-area-inset-top) on the app header.
        await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
        // Follow the app theme so the clock stays legible on both.
        const dark = document.documentElement.classList.contains('dark')
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
      } catch {
        /* status-bar control is unavailable on this platform */
      }
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch {
        /* already hidden */
      }
    })()
  }, [])

  // ── Recover interrupted purchases, once we know who is signed in ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return
    let cancelled = false
    void (async () => {
      const { recorded } = await finishPendingPurchases()
      // Only `recorded` — re-seeing a receipt the server already knows about is
      // the normal case on every launch and must not churn the stores.
      if (cancelled || recorded === 0) return
      useEntitlementsStore.getState().refresh()
      useCreditsStore.getState().reload()
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // ── Keep the push token current for users who already opted in ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return
    void refreshNativePushToken()
  }, [userId])

  // ── Deep links (App Links / Universal Links) ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let remove: (() => void) | undefined
    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url)
          // Only our own host, and only the path — never navigate to whatever
          // an arbitrary link says.
          if (parsed.hostname !== APP_HOST) return
          navigate(`${parsed.pathname}${parsed.search}`)
        } catch {
          /* not a URL we can parse */
        }
      })
      remove = () => void handle.remove()
    })()
    return () => remove?.()
  }, [navigate])
}
