import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { api, ApiError } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  /** Called after a rating is successfully submitted (used to hide the entry point). */
  onSubmitted?: () => void
}

/**
 * Lightweight, user-initiated app rating + message. 1-5 stars (with hover
 * preview + pop animation), optional comment, auto-captured page. Submits via
 * api.feedback.submit, then toasts a thank-you. Escape / click-outside closes.
 */
export default function FeedbackModal({ open, onClose, onSubmitted }: FeedbackModalProps) {
  const { t } = useT()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset each time it opens, and wire Escape-to-close.
  useEffect(() => {
    if (open) {
      setRating(0)
      setHover(0)
      setMessage('')
    }
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open) return null

  const submit = async () => {
    if (rating < 1) {
      toast.error(t('feedbackRatingRequired'))
      return
    }
    setSaving(true)
    try {
      await api.feedback.submit(rating, message.trim(), window.location.pathname)
      toast.success(t('feedbackThanks'))
      onSubmitted?.()
      onClose()
    } catch (e) {
      // Already submitted within the last 3 months - treat as a soft success so
      // we still retire the entry point, but tell them why nothing was saved.
      if (e instanceof ApiError && e.status === 429) {
        toast.success(t('feedbackRateLimited'))
        onSubmitted?.()
        onClose()
      } else {
        toast.error(t('feedbackError'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm sm:items-center"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="feedback-title" className="font-heading text-lg font-semibold text-ink">
              {t('feedbackTitle')}
            </h2>
            <p className="mt-1 font-body text-sm text-ink2">{t('feedbackHint')}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn h-9 w-9">
            <X size={18} />
          </button>
        </div>

        {/* Star picker */}
        <div className="mb-4 flex justify-center gap-1.5" role="radiogroup" aria-label={t('avgRating')}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="focus-ring rounded-full p-1 transition-transform duration-150 hover:scale-110 active:scale-90"
              >
                <Star
                  size={34}
                  className={`transition-colors ${active ? 'fill-gold text-gold' : 'text-line'} ${
                    rating === n ? 'animate-popStar' : ''
                  }`}
                />
              </button>
            )
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder={t('feedbackPlaceholder')}
          className="input-soft mb-4 resize-none"
        />

        <button onClick={submit} disabled={saving} className="btn-brand press w-full px-6 py-3 text-base">
          {saving && <Spinner size={18} />}
          {saving ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  )
}
