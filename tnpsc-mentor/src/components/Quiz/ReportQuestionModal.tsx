import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Pause, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useFocusTrap } from '../UI/useFocusTrap'

/**
 * "Mark this question for correction" feedback box, shown when a student reports
 * a question mid-test. While it is open the caller pauses the exam timer (see
 * `reportPaused` in MockQuizPage / QuizPage) so writing a report never eats into
 * exam time. The reason is optional - submitting blank still files the report.
 */
export default function ReportQuestionModal({
  questionNumber,
  onSubmit,
  onCancel,
}: {
  /** 1-based number of the question being reported, for the header. */
  questionNumber?: number
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [reason, setReason] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // The component is mounted only while open, so the trap is always active here.
  useFocusTrap(true, dialogRef)

  useEffect(() => {
    // Land focus in the textarea (the trap's default would be the close button).
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 px-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md p-5 outline-none"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-coral">
            <AlertCircle size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="report-modal-title" className="tamil font-heading text-base font-bold text-ink">
              {t('reportModalTitle')}
              {questionNumber != null && (
                <span className="text-ink2"> · {t('question')} {questionNumber}</span>
              )}
            </h3>
          </div>
          <button onClick={onCancel} aria-label={t('cancel')} className="icon-btn h-8 w-8 shrink-0">
            <X size={18} />
          </button>
        </div>

        <p className="tamil mb-3 font-body text-sm text-ink2">{t('reportModalHint')}</p>

        {/* Timer-paused badge so it's obvious the clock has stopped. */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 font-heading text-xs font-semibold text-brand">
          <Pause size={13} className="fill-current" /> {t('timerPaused')}
        </div>

        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t('reportReasonPlaceholder')}
          className="tamil w-full resize-none rounded-xl border border-line bg-card px-3 py-2.5 font-body text-sm text-ink outline-none focus:border-brand-ring focus:ring-2 focus:ring-brand/25"
        />

        <div className="mt-4 flex items-stretch gap-2">
          <button onClick={onCancel} className="btn-soft flex-1">
            {t('cancel')}
          </button>
          <button onClick={() => onSubmit(reason.trim())} className="btn-brand flex-1">
            {t('submitReport')}
          </button>
        </div>
      </div>
    </div>
  )
}
