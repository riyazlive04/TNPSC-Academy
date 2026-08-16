import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useMessageStore, startMessagePolling } from '../../store/messageStore'
import { useT } from '../../lib/i18n'

/**
 * Header entry point for the student's thread with the admin team. Unlike the
 * notification bell this opens a full page (a conversation, not a short feed
 * item, wants room to read/reply), so it's just an icon + badge, no dropdown.
 */
export default function MessagesIcon() {
  const navigate = useNavigate()
  const { t } = useT()
  const unread = useMessageStore((s) => s.unread)

  useEffect(() => {
    startMessagePolling()
  }, [])

  return (
    <button
      onClick={() => navigate('/messages')}
      title={t('messagesNav')}
      aria-label={unread > 0 ? `${t('messagesNav')} (${unread} unread)` : t('messagesNav')}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-ink2 transition hover:bg-brand-soft hover:text-brand-dark focus-ring active:scale-90"
    >
      <MessageCircle size={18} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-heading text-[10px] font-bold text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
