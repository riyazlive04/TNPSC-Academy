import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useT } from '../../lib/i18n'

/** Full-screen loading / error / empty states shown before the quiz renders. */
export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
      {children}
    </div>
  )
}

/**
 * Shared modal shell (dimmed backdrop + popped card with a warning header).
 * Accessible: announced as a dialog, labelled by its title, closes on Escape,
 * and moves initial focus to the dialog container on open.
 */
function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  /** Optional dismiss handler invoked when the user presses Escape. */
  onClose?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Move focus into the dialog on open so keyboard / screen-reader users land here.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Close on Escape (when a dismiss handler is provided).
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-3 flex items-center gap-2 text-warn">
          <AlertTriangle size={24} />
          <h3 id={titleId} className="font-heading text-xl font-bold uppercase text-navytext">
            {title}
          </h3>
        </div>
        {children}
      </div>
    </div>
  )
}

interface AttendanceGateModalProps {
  attempted: number
  total: number
  onSubmitAnyway: () => void
  onContinue: () => void
}

/** Warns when attendance is below the 25% gate before letting the user submit. */
export function AttendanceGateModal({
  attempted,
  total,
  onSubmitAnyway,
  onContinue,
}: AttendanceGateModalProps) {
  const { t } = useT()
  const pct = total > 0 ? Math.round((attempted / total) * 100) : 0
  return (
    <ModalShell title={t('attendanceBelow25')} onClose={onContinue}>
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">
        {t('attendanceAttemptedLine')}{' '}
        <span className="font-bold">{attempted}/{total}</span> ({pct}%).{' '}
        {t('attendanceGateMsg')}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onSubmitAnyway}
          className="flex-1 rounded-full bg-navytext px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          {t('submitAnywayScore')}
        </button>
        <button onClick={onContinue} className="btn-brand flex-1 px-5 py-3 text-sm">
          {t('continueTest')}
        </button>
      </div>
    </ModalShell>
  )
}

interface ExitTestModalProps {
  onEvaluate: () => void
  onDiscard: () => void
  onCancel: () => void
}

/** Shown when a student tries to exit a practice test mid-way. */
export function ExitTestModal({ onEvaluate, onDiscard, onCancel }: ExitTestModalProps) {
  const { t } = useT()
  return (
    <ModalShell title={t('exitTestTitle')} onClose={onCancel}>
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">
        {t('exitTestMsg')}
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onEvaluate}
          className="btn-brand w-full px-5 py-3 text-sm"
        >
          {t('submitSeeResults')}
        </button>
        <button
          onClick={onDiscard}
          className="w-full rounded-full bg-coral px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          {t('exitWithoutSaving')}
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-full border border-line px-5 py-3 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring"
        >
          {t('keepGoingBtn')}
        </button>
      </div>
    </ModalShell>
  )
}

interface SubmitErrorModalProps {
  message: string
  onRetry: () => void
  onSignIn: () => void
}

/** Shown when server-side grading fails; offers a retry or re-auth. */
export function SubmitErrorModal({ message, onRetry, onSignIn }: SubmitErrorModalProps) {
  const { t } = useT()
  return (
    <ModalShell title={t('submitFailed')}>
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">{message}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onRetry} className="btn-brand flex-1 px-5 py-3 text-sm">
          {t('retrySubmit')}
        </button>
        <button
          onClick={onSignIn}
          className="flex-1 rounded-full bg-navytext px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          {t('signInAgain')}
        </button>
      </div>
    </ModalShell>
  )
}
