import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToastStore, type ToastKind } from '../../store/toastStore'
import { useT } from '../../lib/i18n'

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; tint: string; fg: string }> = {
  success: { icon: CheckCircle2, ring: 'ring-mint/20', tint: 'bg-mintsoft', fg: 'text-mint' },
  error: { icon: AlertTriangle, ring: 'ring-coral/20', tint: 'bg-coralsoft', fg: 'text-coral' },
  info: { icon: Info, ring: 'ring-brand/20', tint: 'bg-brand-soft', fg: 'text-brand-dark' },
}

/**
 * App-wide toast outlet. Mount once near the root. Toasts slide+pop in, are
 * keyboard-dismissible, and announce themselves to assistive tech via aria-live.
 */
export default function Toaster() {
  const { t } = useT()
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((item) => {
        const s = STYLES[item.kind]
        const Icon = s.icon
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm animate-toastIn items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card ring-1 ${s.ring}`}
          >
            <span className={`mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full ${s.tint} ${s.fg}`}>
              <Icon size={16} />
            </span>
            <p className="tamil min-w-0 flex-1 break-words font-body text-sm text-ink">{item.message}</p>
            <button
              onClick={() => dismiss(item.id)}
              aria-label={t('dismiss')}
              className="icon-btn -mr-1 -mt-0.5 h-11 w-11 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
