// ─── Live (OTA) web-bundle updates — native only ────────────────────────────
// The installed app runs the `dist` build baked into the store binary, so every
// UI change used to need a Play release and its multi-day review.
// @capgo/capacitor-updater fetches a newer `dist` zip from OUR server
// (/api/app/web-bundle/check — see server/src/lib/webBundles.ts) and swaps it
// the next time the app goes to background.
//
// Almost all of that happens natively, driven by the config in
// capacitor.config.ts. This module owns the one thing the web layer MUST do:
//
//   notifyAppReady() — "this bundle boots". Until it is called, the plugin
//   treats the running bundle as unproven and, after appReadyTimeout, restores
//   the previous one. That is the safety net that makes shipping without a
//   review sane: a bundle that white-screens rolls itself back.
//
// No-ops entirely on the web build, where the browser already has the newest
// assets.

import { Capacitor } from '@capacitor/core'
import { reportClientError } from './reportClientError'

const isNative = Capacitor.isNativePlatform()

/** Lazily loaded so the plugin never enters the web bundle's critical path. */
async function updater() {
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
  return CapacitorUpdater
}

/**
 * Mark the running bundle as good, and wire up failure reporting. Call once,
 * as early as the app has actually rendered — before the timeout, or a
 * perfectly healthy bundle gets rolled back.
 */
export async function initLiveUpdates(): Promise<void> {
  if (!isNative) return
  try {
    const CapacitorUpdater = await updater()

    // A bundle that fails its own integrity/boot checks is reverted natively;
    // we only need to hear about it, since the user sees nothing go wrong.
    void CapacitorUpdater.addListener('updateFailed', ({ bundle }) => {
      reportClientError({
        kind: 'generic',
        path: '/live-update',
        message: `Live bundle ${bundle?.version ?? 'unknown'} failed and was rolled back`,
      })
    })
    void CapacitorUpdater.addListener('downloadFailed', ({ version }) => {
      reportClientError({
        kind: 'generic',
        path: '/live-update',
        message: `Live bundle ${version ?? 'unknown'} failed to download`,
      })
    })

    await CapacitorUpdater.notifyAppReady()
  } catch {
    // Plugin missing (an older store build that predates it) or a native
    // hiccup: the app keeps running exactly as before. Never surface this.
  }
}

export interface RunningBundle {
  /** Bundle name — 'builtin' when running the assets shipped in the store build. */
  version: string
  status: string
}

/** What the app is currently running, for the superadmin diagnostics line. */
export async function runningBundle(): Promise<RunningBundle | null> {
  if (!isNative) return null
  try {
    const CapacitorUpdater = await updater()
    const b = await CapacitorUpdater.current()
    return { version: b.bundle.version, status: b.bundle.status }
  } catch {
    return null
  }
}
