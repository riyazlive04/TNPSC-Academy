/**
 * Fullscreen + anti-capture helpers for proctored mock tests.
 *
 * Mobile browsers are the problem this module solves. iOS Safari has no
 * Fullscreen API on arbitrary elements, and Android's is quirky - so the old
 * desktop-style "you must stay full-screen" gate locked every phone user out of
 * the test: `requestFullscreen()` rejected silently, the re-entry overlay stayed
 * up forever, and tapping it did nothing. Here we detect support up front and
 * let the quiz engine degrade to visibility/blur-based proctoring on devices
 * that can't go full-screen, while still blanking the screen on focus loss so
 * app-switcher thumbnails and tab previews capture only black.
 */

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

/** True when the browser can put an arbitrary element into full-screen. */
export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement as FsEl
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen)
}

/** Vendor-agnostic current full-screen element (null when windowed). */
export function fullscreenElement(): Element | null {
  const d = document as FsDoc
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

/** True when the page is currently full-screen. */
export function isFullscreen(): boolean {
  return Boolean(fullscreenElement())
}

/** Request full-screen on the whole document. Resolves even if rejected. */
export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FsEl
  try {
    if (el.requestFullscreen) await el.requestFullscreen()
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
  } catch {
    /* user/device rejected - caller falls back to soft proctoring */
  }
}

/** Leave full-screen if we're in it. Never throws. */
export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc
  try {
    if (!fullscreenElement()) return
    if (d.exitFullscreen) await d.exitFullscreen()
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen()
  } catch {
    /* ignore */
  }
}

/** Coarse-pointer / touch heuristic - used only for copy tweaks & messaging. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
}
