// ─── App-wide copy / paste prevention (native app only) ─────────────────────
// Installs document-level guards that stop the user copying, cutting, pasting,
// long-press selecting, or opening the context menu anywhere in the installed
// app, to protect the question/explanation content. Typing in real form fields
// (login, search, answer inputs) is left untouched so the app stays usable.
//
// Web is deliberately exempt - the marketing site and desktop UX rely on normal
// selection; the in-test proctoring engine already clamps copy/paste there.

import { isNativeApp } from './nativeAuth'

/** Is the event target an editable field where paste/selection must still work? */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

let installed = false

/** Wire the global guards once. Safe to call on every app mount. */
export function installCopyGuard(): void {
  if (installed || !isNativeApp() || typeof document === 'undefined') return
  installed = true

  // Selection/copy/cut are never allowed - there's nothing in the app the user
  // needs to copy out.
  const block = (e: Event) => e.preventDefault()
  document.addEventListener('copy', block)
  document.addEventListener('cut', block)
  document.addEventListener('selectstart', (e) => {
    if (!isEditable(e.target)) e.preventDefault()
  })
  // Long-press context menu (Android WebView "copy/share" bubble).
  document.addEventListener('contextmenu', block)
  // Paste is allowed only into genuine input fields.
  document.addEventListener('paste', (e) => {
    if (!isEditable(e.target)) e.preventDefault()
  })

  // Kill text selection visually + at the engine level everywhere except inputs.
  document.documentElement.classList.add('no-copy')
}
