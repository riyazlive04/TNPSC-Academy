import { useEffect, useRef, type ReactNode } from 'react'
import { Send, X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import { useT } from '../../lib/i18n'

interface TelegramHelpModalProps {
  open: boolean
  onClose: () => void
}

/** Telegram's brand blue — fixed in both themes, like the real app screens the
 * mocks imitate. */
const TG_BLUE = '#229ED9'

/** Chrome shared by the three mock "screenshots": a miniature Telegram chat
 * with the bot's header. Drawn in CSS so it needs no image assets, stays
 * crisp at any size and follows the card/dark theme automatically. */
function MockChat({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: TG_BLUE }}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/25 text-white">
          <Send size={12} />
        </span>
        <span className="font-heading text-xs font-semibold text-white">TNPSCMentorsBot</span>
      </div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </div>
  )
}

/** A bot chat bubble inside a mock screen. */
function MockBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[90%] self-start rounded-card rounded-bl-sm border border-line bg-card px-3 py-2 font-body text-[11px] leading-snug text-ink">
      {children}
    </div>
  )
}

/** A Telegram-style action button inside a mock screen. */
function MockButton({ label }: { label: string }) {
  return (
    <div
      className="self-stretch rounded-pill py-2 text-center font-heading text-xs font-bold text-white"
      style={{ backgroundColor: TG_BLUE }}
    >
      {label}
    </div>
  )
}

/**
 * "How does Telegram verification work?" — a three-step illustrated guide
 * opened from the ⓘ button next to the "Verify via Telegram" offer. The
 * screenshots are CSS mock-ups of the real bot conversation, so they match
 * what the user is about to see without shipping image assets.
 */
export default function TelegramHelpModal({ open, onClose }: TelegramHelpModalProps) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const steps: { caption: string; screen: ReactNode }[] = [
    {
      caption: t('tgHelpStep1'),
      screen: (
        <MockChat>
          <MockBubble>{t('tgHelpMockIntro')}</MockBubble>
          <MockButton label="START" />
        </MockChat>
      ),
    },
    {
      caption: t('tgHelpStep2'),
      screen: (
        <MockChat>
          <MockBubble>{t('tgHelpMockAsk')}</MockBubble>
          <MockButton label="📱 Share my phone number" />
        </MockChat>
      ),
    },
    {
      caption: t('tgHelpStep3'),
      screen: (
        <MockChat>
          <MockBubble>✅ {t('tgHelpMockDone')}</MockBubble>
        </MockChat>
      ),
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tg-help-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md animate-sheetIn overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-white"
              style={{ backgroundColor: TG_BLUE }}
            >
              <Send size={18} />
            </span>
            <h2 id="tg-help-title" className="tamil font-display text-base font-bold leading-snug text-ink">
              {t('tgHelpTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="focus-ring -mr-1 -mt-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-ink2 transition hover:bg-surface hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-tint-violet font-heading text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <p className="tamil font-body text-sm leading-relaxed text-ink2">{s.caption}</p>
              </div>
              <div className="pl-[34px]">{s.screen}</div>
            </li>
          ))}
        </ol>

        <p className="tamil mt-4 rounded-card bg-surface px-3 py-2.5 font-body text-xs leading-relaxed text-muted">
          {t('tgHelpNote')}
        </p>

        <button onClick={onClose} className="btn-brand press mt-5 w-full px-4 py-3 text-sm">
          <span className="tamil">{t('gotIt')}</span>
        </button>
      </div>
    </div>
  )
}
