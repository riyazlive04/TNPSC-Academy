import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Newspaper, X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import LogoLoader from '../UI/LogoLoader'
import type { CaMagazineItem } from '../../lib/api'
import MagazineSections from './MagazineContent'
import { useT } from '../../lib/i18n'

/**
 * Full-screen reader for one CA-magazine issue (a day's paper or a month's
 * consolidation). Items arrive grouped into the canonical sections; content is
 * markdown bullets rendered natively. Language follows the app toggle — Tamil
 * shows the translated twin (EN fallback), 'both' stacks EN above Tamil.
 *
 * Used from the Materials tab (published issues, loaded by material id) and
 * from the superadmin console (pre-approval preview) — the caller passes the
 * matching `load` function.
 */
export default function MagazineReader({
  title,
  subtitle,
  load,
  onClose,
}: {
  title: string
  subtitle?: string
  load: () => Promise<CaMagazineItem[]>
  onClose: () => void
}) {
  const { t, lang } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef)

  const [items, setItems] = useState<CaMagazineItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const fetchItems = () => {
    setFailed(false)
    setItems(null)
    load()
      .then(setItems)
      .catch(() => setFailed(true))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchItems, [])

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm animate-fadeInFast sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-card outline-none animate-sheetIn sm:h-[88vh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Newspaper size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="tamil truncate font-heading text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="tamil mt-0.5 truncate font-body text-xs text-ink2">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="focus-ring -mr-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted hover:bg-tint-violet hover:text-primary"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
          {items === null && !failed && (
            <div className="flex justify-center py-20">
              <LogoLoader size={56} />
            </div>
          )}

          {failed && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertTriangle size={30} className="text-coral" />
              <p className="font-body text-ink2">{t('couldNotLoad')}</p>
              <button onClick={fetchItems} className="btn-ghost btn-sm">
                {t('retry')}
              </button>
            </div>
          )}

          {items !== null && <MagazineSections items={items} lang={lang} />}
        </div>
      </div>
    </div>
  )
}
