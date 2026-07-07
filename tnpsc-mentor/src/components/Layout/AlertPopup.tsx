import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { api, type ActiveAlert } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { useAuthStore } from '../../store/authStore'
import { useLanguageStore } from '../../store/languageStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useFocusTrap } from '../UI/useFocusTrap'

// Fetched once per SPA session; the remaining queue lives at module scope so it
// survives AppLayout remounts on navigation without refetching.
let loadedOnce = false
let queue: ActiveAlert[] = []

/**
 * Superadmin popup alerts: announcements published from the superadmin console
 * that interrupt with a modal on app open (unlike the passive bell feed). Shows
 * one alert at a time, oldest first; "Got it" records a per-ACCOUNT dismissal on
 * the server so an alert never repeats, on any device. Bilingual: the composer's
 * optional Tamil copy is shown per the learner's language setting. Mounted in
 * AppLayout (chrome screens only) — never over the immersive quiz (bare pages)
 * or the first-run tour.
 */
export default function AlertPopup() {
  const { t } = useT()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const lang = useLanguageStore((s) => s.lang) ?? 'en'
  // The first-run tour owns the screen for new accounts — hold alerts until done.
  const tourActive = useOnboardingStore((s) => s.open || s.pending)
  const [current, setCurrent] = useState<ActiveAlert | null>(() => queue[0] ?? null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const open = !!current && !tourActive
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!user || loadedOnce) return
    loadedOnce = true
    api.alerts
      .active()
      .then((alerts) => {
        queue = alerts
        setCurrent(queue[0] ?? null)
      })
      .catch(() => {}) // silent — alerts are best-effort, never block the app
  }, [user])

  const dismiss = () => {
    if (!current) return
    // Fire-and-forget: worst case a lost request re-shows the alert next session.
    api.alerts.dismiss(current.id).catch(() => {})
    queue = queue.filter((a) => a.id !== current.id)
    setCurrent(queue[0] ?? null)
  }

  const openLink = () => {
    const url = current?.url
    dismiss()
    if (!url) return
    if (url.startsWith('/')) navigate(url)
    else window.open(url, '_blank', 'noopener')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id])

  if (!open || !current) return null

  // Language-aware copy: Tamil-only readers get the Tamil variant when the
  // composer provided one; 'both' shows English with the Tamil text below.
  const title = lang === 'ta' && current.title_ta ? current.title_ta : current.title
  const body = lang === 'ta' && current.body_ta ? current.body_ta : current.body
  const secondaryTa = lang === 'both' ? current.body_ta : null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-alert-title"
        aria-describedby="app-alert-msg"
        tabIndex={-1}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
            <Megaphone size={22} />
          </span>
          <p className="tamil mb-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2">
            {t('alertAnnouncement')}
          </p>
          <h2 id="app-alert-title" className="tamil font-heading text-lg font-semibold text-ink">
            {title}
          </h2>
          <p
            id="app-alert-msg"
            className="tamil mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-ink2"
          >
            {body}
          </p>
          {secondaryTa && (
            <p className="tamil mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-ink2">
              {secondaryTa}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {current.url && (
            <button onClick={openLink} className="btn-ghost press tamil flex-1 px-4 py-2.5 text-sm">
              {t('alertViewLink')}
            </button>
          )}
          <button
            autoFocus
            onClick={dismiss}
            className="btn press tamil flex-1 bg-brand px-4 py-2.5 text-sm text-white hover:bg-brand-dark"
          >
            {t('gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
