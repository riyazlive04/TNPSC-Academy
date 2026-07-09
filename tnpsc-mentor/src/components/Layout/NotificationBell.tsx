import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, Megaphone, Check, Loader2 } from 'lucide-react'
import {
  useNotificationStore,
  startNotificationPolling,
} from '../../store/notificationStore'
import { useT } from '../../lib/i18n'

/** Compact "3h ago" / "2d ago" relative time. */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString()
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  const { items, unread, loading, refresh, markAllRead } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Start the shared feed polling once the bell mounts (user is authenticated).
  // Enabling/disabling Web Push lives in Profile → Notifications now.
  useEffect(() => {
    startNotificationPolling()
  }, [])

  // Open → refresh, then mark everything read so the badge clears.
  useEffect(() => {
    if (!open) return
    refresh().then(markAllRead)
  }, [open, refresh, markAllRead])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onItemClick = (url: string | null) => {
    setOpen(false)
    if (url) {
      if (/^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener')
      else navigate(url)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('notifications')}
        aria-label={
          unread > 0 ? `${t('notifications')} (${unread} ${t('unread')})` : t('notifications')
        }
        className="relative grid h-9 w-9 place-items-center rounded-lg text-ink2 transition hover:bg-brand-soft hover:text-brand-dark focus-ring active:scale-90"
      >
        {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-heading text-[10px] font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-lg animate-slideDown">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-heading text-sm font-semibold text-ink">{t('notifications')}</span>
            {loading && <Loader2 size={14} className="animate-spin text-ink2" />}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center font-body text-sm text-ink2">{t('noNotifications')}</p>
            ) : (
              items.map((n) => {
                // Language-aware copy (mirrors AlertPopup): Tamil readers get
                // the Tamil variant when the composer provided one; 'both'
                // shows English with the Tamil text stacked below.
                const title = lang === 'ta' && n.title_ta ? n.title_ta : n.title
                const body = lang === 'ta' && n.body_ta ? n.body_ta : n.body
                const secondaryTa = lang === 'both' ? n.body_ta : null
                return (
                  <button
                    key={n.id}
                    onClick={() => onItemClick(n.url)}
                    className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-tint/50 ${
                      n.read ? '' : 'bg-brand-soft/30'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
                        n.kind === 'system' ? 'bg-goldsoft text-gold' : 'bg-brand-soft text-brand'
                      }`}
                    >
                      {n.kind === 'system' ? <Megaphone size={15} /> : <Bell size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="tamil truncate font-heading text-sm font-semibold text-ink">
                          {title}
                        </span>
                        {!n.read && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-coral" />}
                      </span>
                      <span className="tamil mt-0.5 block whitespace-pre-line font-body text-xs text-ink2">
                        {body}
                      </span>
                      {secondaryTa && (
                        <span className="tamil mt-0.5 block whitespace-pre-line font-body text-xs text-ink2">
                          {secondaryTa}
                        </span>
                      )}
                      <span className="mt-1 block font-body text-[10px] uppercase tracking-wide text-ink2/70">
                        {ago(n.created_at)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {items.some((i) => !i.read) && (
            <button
              onClick={markAllRead}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 font-heading text-xs font-semibold text-brand transition hover:bg-tint/50"
            >
              <Check size={14} /> {t('markAllRead')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
