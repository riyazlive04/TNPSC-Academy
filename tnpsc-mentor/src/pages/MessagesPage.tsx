import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { api, type MessageItem } from '../lib/api'
import { useT } from '../lib/i18n'
import { useMessageStore } from '../store/messageStore'

/** Compact "3h ago" / "2d ago" relative time, matching NotificationBell's. */
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

/** The student's own thread with the admin team. One thread per account,
 *  shared by every superadmin on the other side (see UserDetailModal's
 *  MessageThreadSection in SuperAdminPage.tsx) — a support inbox, not a
 *  per-admin DM. */
export default function MessagesPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  const clearUnread = useMessageStore((s) => s.clear)
  const [messages, setMessages] = useState<MessageItem[] | null>(null)
  const [error, setError] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    api.messages
      .thread()
      .then((d) => {
        if (cancelled) return
        setMessages(d.messages)
        clearUnread()
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [clearUnread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const { message } = await api.messages.send(body)
      setMessages((prev) => [...(prev ?? []), message])
      setDraft('')
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-4 lg:py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <header className="mb-3 flex-shrink-0">
        <h1 className="font-display text-[20px] font-bold tracking-tight text-ink">
          {t('messagesTitle')}
        </h1>
        <p className="mt-1 font-body text-sm text-muted">{t('messagesSubtitle')}</p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-card p-4">
        {messages === null ? (
          <div className="grid h-full place-items-center">
            <Loader2 size={20} className="animate-spin text-ink2" />
          </div>
        ) : messages.length === 0 ? (
          <p className="grid h-full place-items-center text-center font-body text-sm text-ink2">
            {t('messagesEmpty')}
          </p>
        ) : (
          messages.map((m) => {
            const body = lang === 'ta' && m.body_ta ? m.body_ta : m.body
            const secondaryTa = lang === 'both' ? m.body_ta : null
            return (
              <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 font-body text-sm ${
                    m.sender === 'admin'
                      ? 'rounded-tl-sm bg-tint text-ink'
                      : 'rounded-tr-sm bg-brand text-white'
                  }`}
                >
                  <p className="tamil whitespace-pre-line">{body}</p>
                  {secondaryTa && (
                    <p className="tamil mt-1 whitespace-pre-line opacity-80">{secondaryTa}</p>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${m.sender === 'admin' ? 'text-ink2' : 'text-white/70'}`}
                  >
                    {ago(m.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 flex-shrink-0 font-body text-xs text-coral">{t('messagesSendError')}</p>
      )}

      <div className="mt-3 flex flex-shrink-0 items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          placeholder={t('messagesPlaceholder')}
          className="focus-ring flex-1 rounded-xl border border-line bg-card px-4 py-3 font-body text-sm text-ink outline-none transition hover:border-brand/40"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          aria-label={t('messagesSend')}
          className="focus-ring grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
