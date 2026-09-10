import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { shareOrCopy } from '../../lib/shareLinks'
import { toast } from '../../store/toastStore'
import { useT } from '../../lib/i18n'

/** How long the tick replaces the share icon after a successful copy. */
const CONFIRM_MS = 1800

/**
 * Copy-or-share control for one deep link (lib/shareLinks.ts builds the URL).
 *
 * On a phone this opens the OS share sheet, which is the whole point — a link
 * to today's paper is worth one tap into a class WhatsApp group. Where there
 * is no share sheet it copies instead, and only THEN says so: the label can't
 * promise "Copy" up front, because which of the two happens is the OS's
 * decision, not ours.
 *
 * Renders as a bare icon (`variant="icon"`, for tight rows and card corners)
 * or an icon+label pill (`variant="button"`).
 */
export default function ShareLinkButton({
  url,
  title,
  text,
  label,
  variant = 'icon',
  className = '',
  stopPropagation = false,
}: {
  url: string
  /** Share-sheet title. */
  title?: string
  /** Line that precedes the URL in the shared message. */
  text?: string
  /** Accessible name, and the visible label in `variant="button"`. */
  label?: string
  variant?: 'icon' | 'button'
  className?: string
  /** Set when the button sits on top of another tappable surface (a card that
   *  itself opens something) so sharing doesn't also trigger that. */
  stopPropagation?: boolean
}) {
  const { t } = useT()
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // The tick is state on a component that a parent can unmount the moment the
  // share sheet closes — clear the timer rather than setting state on nothing.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const name = label ?? t('shareLink')

  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault()
      e.stopPropagation()
    }
    const outcome = await shareOrCopy({ url, title, text })
    if (outcome === 'copied') {
      toast.success(t('shareLinkCopied'))
      setDone(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setDone(false), CONFIRM_MS)
    } else if (outcome === 'failed') {
      // Includes the user dismissing the share sheet, which is not an error and
      // must not be announced as one — see shareOrCopy. Only a genuine
      // clipboard refusal reaches here with nothing having happened, and the
      // toast is the only way to tell them the tap did nothing.
      if (!navigator.share) toast.error(t('shareLinkFailed'))
    }
    // 'shared' needs no toast: the OS sheet already showed the user what it did.
  }

  const Icon = done ? Check : Share2

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`btn-soft press tamil inline-flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs ${className}`}
        aria-label={name}
        title={name}
      >
        <Icon size={14} className={done ? 'text-correct' : undefined} />
        {name}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-brand-soft ${className}`}
      aria-label={name}
      title={name}
    >
      <Icon size={16} className={done ? 'text-correct' : undefined} />
    </button>
  )
}
