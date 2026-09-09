// ─── Server-driven UI: the action dispatcher ─────────────────────────────────
// A layout says WHAT should happen ("open the Vettri upsell"), never HOW. Each
// kind maps to a call the app already makes for itself, so a server-driven tap
// can only do things a hand-written screen could have done. Both risky targets
// were already narrowed at validation time — `navigate` to the app's own route
// table, `open_url` to an allowlist of hosts — and are re-checked here, because
// a cached layout from an older build's rules must not be trusted on the way
// out either.

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { upsell } from '../../store/upsellStore'
import { track } from '../tracking'
import { isAllowedRoute, isAllowedUrl } from './validate'
import type { SduiAction, SduiSheetId } from './types'

/**
 * Sheets a layout may ask for. The sheets themselves live in the pages that own
 * them (TestArenaPage mounts the Daily-CA picker, the CA hub, the Thirukkural
 * modal); a slot has no way to reach that state directly, so it posts a request
 * here and the host page opens it. Pages that don't handle a given id simply
 * ignore it — nothing happens, rather than a broken tap.
 */
interface SduiSheetState {
  requested: SduiSheetId | null
  request: (id: SduiSheetId) => void
  clear: () => void
}

export const useSduiSheetStore = create<SduiSheetState>((set) => ({
  requested: null,
  request: (id) => set({ requested: id }),
  clear: () => set({ requested: null }),
}))

/** Open an external link the way the rest of the app does: an in-app browser on
 *  native (so the user keeps the app behind it), a new tab on the web. */
async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Returns `run(action)` for the current screen. Every dispatch also emits one
 * analytics event tagged with the layout key and node key, so the console can
 * answer "did anyone tap the new banner?" without a separate instrumentation
 * pass per layout.
 */
export function useSduiAction(layoutKey: string) {
  const navigate = useNavigate()
  const requestSheet = useSduiSheetStore((s) => s.request)

  return useCallback(
    (action: SduiAction | undefined, nodeKey?: string) => {
      if (!action || action.kind === 'none') return

      track('sdui_tap', {
        sdui_layout: layoutKey,
        sdui_node: nodeKey ?? action.kind,
        sdui_action: action.kind,
      })

      switch (action.kind) {
        case 'navigate':
          // Re-checked here, not just at validation: a layout may have been
          // cached by a build whose route list differed from this one's.
          if (isAllowedRoute(action.to)) {
            navigate(action.to, action.state ? { state: action.state } : undefined)
          }
          return
        case 'open_url':
          if (isAllowedUrl(action.url)) void openExternal(action.url)
          return
        case 'upsell':
          // Same overlay the app's own paywalls open, so a server-driven pitch
          // gets the real pricing cards and the real purchase flow.
          if (action.plan === 'premium') upsell.premium()
          else if (action.plan === 'bundle') upsell.bundle()
          else upsell.credits()
          return
        case 'sheet':
          requestSheet(action.id)
          return
        case 'track':
          if (action.params) track(action.event, action.params)
          else track(action.event)
          return
      }
    },
    [layoutKey, navigate, requestSheet]
  )
}
