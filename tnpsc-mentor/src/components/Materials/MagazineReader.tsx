import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, Loader2, Newspaper, X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import { Skeleton, SkeletonText } from '../UI/Skeleton'
import type { CaMagazineItem, CaMagazineType } from '../../lib/api'
import MagazineSections from './MagazineContent'
import {
  KNOW_LEVELS,
  KNOW_LEVEL_TONE,
  issueDateLabel,
  knowLevelShort,
  magazineName,
  type KnowLevel,
} from '../../lib/caMagazine'
import { pdfWatermark } from '../../lib/pdfWatermark'
import { useAuth } from '../../hooks/useAuth'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'

/**
 * Full-screen reader for one CA-magazine issue (a day's paper or a month's
 * consolidation). Items arrive grouped into the canonical sections; content is
 * markdown bullets rendered natively.
 *
 * The header shows the magazine's name and, under it, the issue date — both
 * derived from the issue itself, so every issue reads the same and no source
 * publication is ever credited.
 *
 * Language: the reader opens in the app's language but carries its own toggle
 * (English / தமிழ் / both) once the issue has Tamil twins. That one choice
 * drives BOTH what is on screen and the language of the exported PDF.
 */
export default function MagazineReader({
  caType,
  date,
  load,
  loadNewsImage,
  onClose,
  downloadable = false,
}: {
  caType: CaMagazineType
  /** Issue date, 'YYYY-MM-DD' (the day, or any day of the month for monthlies). */
  date: string
  load: () => Promise<CaMagazineItem[]>
  /**
   * Optional: resolves the issue's news image to a signed URL, or null when
   * there is none for that date (a holiday, or before the morning push).
   * Daily issues only — monthly issues have no news image.
   */
  loadNewsImage?: () => Promise<string | null>
  onClose: () => void
  /** When true, offer a "Download PDF" of the issue (superadmin-gated). */
  downloadable?: boolean
}) {
  const { t, lang } = useT()
  const { profile } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef)

  const [items, setItems] = useState<CaMagazineItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // The issue's news image. Absent is normal and never an error.
  const [newsImage, setNewsImage] = useState<string | null>(null)
  // The reading language — seeded from the app toggle, then owned by the reader.
  const [readLang, setReadLang] = useState<'en' | 'ta' | 'both'>(lang)
  // Revision filter: narrow the issue to one know level. null = show everything.
  const [levelFilter, setLevelFilter] = useState<KnowLevel | null>(null)

  // The Tamil edition is only offered when the issue carries Tamil twins.
  const hasTamil = !!items?.some((i) => i.content_ta && i.content_ta.trim())
  // Only offer the levels this issue actually uses — a chip that filters to an
  // empty screen is worse than no chip, and older issues predate the feature
  // entirely. Kept in KNOW_LEVELS order (most essential first), not in the
  // order the items happen to appear.
  const levelsPresent = KNOW_LEVELS.filter((level) => items?.some((i) => i.know_level === level))
  const shownItems =
    levelFilter && items ? items.filter((i) => i.know_level === levelFilter) : items
  const viewLang = hasTamil ? readLang : 'en'

  const title = magazineName(viewLang)
  const dateLine = issueDateLabel(caType, date, viewLang)

  const downloadPdf = async () => {
    if (downloading || !shownItems?.length) return
    setDownloading(true)
    try {
      // Lazy-load the generator so jspdf/html2canvas stay out of the reader chunk.
      const { generateMagazinePdf } = await import('../../lib/magazinePdf')
      // Exports exactly what is on screen — the level filter behaves like the
      // language toggle above it, which already drives both. Filtering to
      // "Must Know" and hitting download is the revision sheet, so the subtitle
      // and the filename have to say which cut this is.
      await generateMagazinePdf({
        items: shownItems,
        title,
        subtitle: levelFilter ? `${dateLine} · ${knowLevelShort(levelFilter, viewLang)}` : dateLine,
        lang: viewLang,
        fileLabel: levelFilter
          ? `${issueDateLabel(caType, date, 'en')} ${knowLevelShort(levelFilter, 'en')}`
          : issueDateLabel(caType, date, 'en'),
        watermark: pdfWatermark(profile),
      })
    } catch {
      toast.error(t('materialDownloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

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

  // The news image loads independently of the items — a missing or failed image
  // must never hold up (or break) the issue itself.
  useEffect(() => {
    if (!loadNewsImage) return
    let cancelled = false
    loadNewsImage()
      .then((url) => !cancelled && setNewsImage(url))
      .catch(() => !cancelled && setNewsImage(null))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-card outline-none animate-sheetIn sm:h-[88vh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Newspaper size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="tamil truncate font-heading text-base font-semibold text-ink">{title}</h2>
            <p className="tamil mt-0.5 truncate font-body text-xs text-ink2">{dateLine}</p>
          </div>
          {downloadable && shownItems && shownItems.length > 0 && (
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="btn-soft press tamil hidden flex-shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60 sm:inline-flex"
              title={t('downloadMagazinePdf')}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {t('downloadMagazinePdf')}
            </button>
          )}
          {downloadable && shownItems && shownItems.length > 0 && (
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="focus-ring grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-brand hover:bg-brand-soft disabled:opacity-60 sm:hidden"
              aria-label={t('downloadMagazinePdf')}
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="focus-ring -mr-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted hover:bg-tint-violet hover:text-primary"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Language toggle — switches the issue on screen AND the PDF it exports. */}
        {hasTamil && (
          <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-line bg-card/60 px-4 py-2 sm:px-6">
            {(
              [
                ['en', 'English'],
                ['ta', 'தமிழ்'],
                ['both', 'English + தமிழ்'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setReadLang(value)}
                aria-pressed={readLang === value}
                className={`tamil press rounded-full border px-3 py-1 font-heading text-2xs font-semibold transition ${
                  readLang === value
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Know-level filter — only for issues a superadmin has actually triaged,
            so nothing new appears on an untouched issue. "All" is always first
            and is the default, so the filter can never silently hide items a
            student never asked to hide. */}
        {levelsPresent.length > 0 && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-card/60 px-4 py-2 sm:px-6">
            <button
              onClick={() => setLevelFilter(null)}
              aria-pressed={levelFilter === null}
              className={`tamil press rounded-full border px-3 py-1 font-heading text-2xs font-semibold transition ${
                levelFilter === null
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
              }`}
            >
              {t('caLevelAll')}
            </button>
            {levelsPresent.map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                aria-pressed={levelFilter === level}
                className={`tamil press rounded-full border px-3 py-1 font-heading text-2xs font-semibold transition ${
                  levelFilter === level
                    ? `border-transparent ${KNOW_LEVEL_TONE[level]}`
                    : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
                }`}
              >
                {knowLevelShort(level, viewLang)}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
          {items === null && !failed && (
            // The lead news image over the first article blocks.
            <div className="space-y-4 px-4 py-4 sm:px-6">
              <Skeleton className="h-40 w-full rounded-xl" />
              <SkeletonText lines={3} />
              <SkeletonText lines={4} />
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

          {/* News image — leads the issue when the pipeline produced one for
              this date. onError drops it if the signed URL has expired. */}
          {items !== null && newsImage && (
            <figure className="border-b border-line px-4 pb-4 pt-4 sm:px-6">
              <img
                src={newsImage}
                alt={`${title} — ${dateLine}`}
                loading="lazy"
                onError={() => setNewsImage(null)}
                className="w-full rounded-xl border border-line bg-card object-cover"
              />
            </figure>
          )}

          {shownItems !== null && <MagazineSections items={shownItems} lang={viewLang} />}
        </div>
      </div>
    </div>
  )
}
