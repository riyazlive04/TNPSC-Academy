// ─── In-app update check (native app only) ──────────────────────────────────
// Apps installed by direct APK download have no Play Store auto-update, so we
// roll our own: on launch the app compares its own installed version against the
// latest release the server advertises (/api/app/latest, set when a superadmin
// uploads a new APK) and, if it's behind, shows an in-app "Update available"
// prompt that opens the APK download. No-op on the web build.

import { Capacitor } from '@capacitor/core'
import { api, type LatestRelease } from './api'

const isNative = Capacitor.isNativePlatform()

/** Installed versionName (e.g. "1.1") on native; null on web or if unavailable. */
export async function installedVersion(): Promise<string | null> {
  if (!isNative) return null
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    return info.version ?? null
  } catch {
    return null
  }
}

/**
 * Compare dotted version strings numerically. Returns 1 if a>b, -1 if a<b, 0 if
 * equal. Missing/garbage segments count as 0, so "1.2" vs "1.2.0" are equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

export interface UpdateInfo {
  release: LatestRelease
  installed: string
}

/**
 * Native only: resolve to the latest release when it's strictly newer than the
 * installed build, otherwise null. Network/parse failures resolve to null (an
 * update check must never block or crash app start).
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isNative) return null
  const installed = await installedVersion()
  if (!installed) return null
  let release: LatestRelease | null = null
  try {
    release = await api.appReleases.latest()
  } catch {
    return null
  }
  if (!release?.version_name) return null
  return compareVersions(release.version_name, installed) > 0 ? { release, installed } : null
}

/**
 * Open the APK download outside the WebView (system browser / Custom Tab) so the
 * OS handles the download + install prompt; the WebView itself can't install.
 */
export async function openDownload(url: string): Promise<void> {
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } catch {
    window.open(url, '_blank')
  }
}
