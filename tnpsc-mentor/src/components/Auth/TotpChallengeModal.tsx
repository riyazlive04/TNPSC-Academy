import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { useFocusTrap } from '../UI/useFocusTrap'
import { useT } from '../../lib/i18n'

interface TotpChallengeModalProps {
  open: boolean
  busy: boolean
  error?: string
  onVerify: (code: string) => void
  onClose: () => void
}

/**
 * Shown after Google sign-in succeeds for an admin/superadmin with TOTP
 * enabled — same step LoginPage renders inline for the password path, but as
 * a modal here since GoogleSignInButton has no page of its own to swap steps
 * within. Reuses the app's modal chrome (backdrop + sheet, Escape/click-
 * outside to close), matching DeviceLimitModal.
 */
export default function TotpChallengeModal({
  open,
  busy,
  error,
  onVerify,
  onClose,
}: TotpChallengeModalProps) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)

  useEffect(() => {
    if (!open) {
      setCode('')
      setUseBackup(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) onVerify(code.trim())
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="totp-challenge-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-mintsoft text-mint">
            <ShieldCheck size={22} />
          </span>
          <h2 id="totp-challenge-title" className="font-display text-lg font-bold text-ink">
            {t('totpChallengeTitle')}
          </h2>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-ink2">
            {t('totpChallengeHint')}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            maxLength={useBackup ? 10 : 6}
            className="input-soft text-center text-lg tracking-[0.4em]"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(useBackup ? e.target.value.trim() : e.target.value.replace(/\D/g, ''))}
          />

          {error && (
            <div
              role="alert"
              className="animate-slideDown rounded-card bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="btn-brand press w-full px-6 py-3.5 text-base disabled:opacity-50"
          >
            {busy && <Spinner size={18} />}
            {busy ? t('verifyingOtp') : t('verifyAndSignIn')}
          </button>

          <button
            type="button"
            onClick={() => {
              setUseBackup((v) => !v)
              setCode('')
            }}
            disabled={busy}
            className="focus-ring mx-auto font-heading text-xs font-semibold text-accent transition hover:opacity-80 disabled:opacity-50"
          >
            {useBackup ? t('totpUseAppCodeInstead') : t('totpUseBackupCode')}
          </button>
        </form>

        <button
          onClick={onClose}
          disabled={busy}
          className="btn-ghost press mt-5 w-full px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
