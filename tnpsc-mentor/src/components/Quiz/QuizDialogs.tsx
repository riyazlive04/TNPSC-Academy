import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/** Full-screen loading / error / empty states shown before the quiz renders. */
export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
      {children}
    </div>
  )
}

/** Shared modal shell (dimmed backdrop + popped card with a warning header). */
function ModalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-warn">
          <AlertTriangle size={24} />
          <h3 className="font-heading text-xl font-bold uppercase text-navytext">{title}</h3>
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
  const pct = total > 0 ? Math.round((attempted / total) * 100) : 0
  return (
    <ModalShell title="Attendance below 25%">
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">
        You have attempted <span className="font-bold">{attempted}/{total}</span> ({pct}
        %). You must attempt at least <span className="font-bold">25%</span> of the
        questions to unlock the explanations. You can still submit now to see your
        score only.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onSubmitAnyway}
          className="flex-1 rounded-full bg-navytext px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          Submit Anyway (Score Only)
        </button>
        <button onClick={onContinue} className="btn-brand flex-1 px-5 py-3 text-sm">
          Continue Test
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
  return (
    <ModalShell title="Exit Test?">
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">
        What would you like to do with your progress so far?
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onEvaluate}
          className="btn-brand w-full px-5 py-3 text-sm"
        >
          Submit &amp; See Results
        </button>
        <button
          onClick={onDiscard}
          className="w-full rounded-full bg-coral px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          Exit Without Saving
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-full border border-line px-5 py-3 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring"
        >
          Keep Going
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
  return (
    <ModalShell title="Submit failed">
      <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">{message}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onRetry} className="btn-brand flex-1 px-5 py-3 text-sm">
          Retry Submit
        </button>
        <button
          onClick={onSignIn}
          className="flex-1 rounded-full bg-navytext px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
        >
          Sign In Again
        </button>
      </div>
    </ModalShell>
  )
}
