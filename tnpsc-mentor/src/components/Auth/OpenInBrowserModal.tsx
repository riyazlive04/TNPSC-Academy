import { useRef } from 'react'
import { Globe } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import { useT } from '../../lib/i18n'

interface OpenInBrowserModalProps {
  open: boolean
  onOpenBrowser: () => void
  onClose: () => void
}

/**
 * Shown in place of the (unrenderable) Google button when GSI failed to load
 * inside a detected Android WebView — Google's own SDK refuses to run there
 * (confirmed: accounts.google.com/gsi/client returns 403 for a WebView User-
 * Agent, 200 for a real browser). A popup is more likely to actually get
 * noticed and acted on than a small inline button competing with the form.
 */
export default function OpenInBrowserModal({ open, onOpenBrowser, onClose }: OpenInBrowserModalProps) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  if (!open) return null

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
        aria-labelledby="open-in-browser-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-mintsoft text-mint">
            <Globe size={22} />
          </span>
          <h2 id="open-in-browser-title" className="font-display text-lg font-bold text-ink">
            {t('openInBrowserTitle')}
          </h2>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-ink2">
            {t('errGoogleWebView')}
          </p>
        </div>

        <button type="button" onClick={onOpenBrowser} className="btn-brand press w-full px-6 py-3.5 text-base">
          {t('openInBrowser')}
        </button>

        <button onClick={onClose} className="btn-ghost press mt-3 w-full px-4 py-2.5 text-sm">
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
