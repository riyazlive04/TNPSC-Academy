import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import { api, type Material } from '../../lib/api'
import { materialTitle, youtubeEmbed, youtubeWatch } from '../../lib/materials'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'
import { trackDownloadMaterial } from '../../lib/tracking'

/**
 * Full-screen viewer for one material. Videos embed the YouTube player; images
 * and PDFs load a short-lived signed URL and render inline; other documents
 * offer an "Open" action. A "Download" button appears only when the superadmin
 * flagged the item downloadable (the server also re-checks that gate).
 */
export default function MaterialViewer({ material, onClose }: { material: Material; onClose: () => void }) {
  const { t, lang } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef)

  const isFile = material.kind !== 'video'
  // Signed "view" URL for image/pdf (fetched once on open). Videos/documents
  // don't auto-load: videos embed by id, documents only open on demand.
  const [viewUrl, setViewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(material.kind === 'image' || material.kind === 'pdf')
  const [failed, setFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)

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

  useEffect(() => {
    if (material.kind !== 'image' && material.kind !== 'pdf') return
    let cancelled = false
    api.materials
      .fileUrl(material.id, 'view')
      .then((url) => !cancelled && setViewUrl(url))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [material.id, material.kind])

  // Open a non-previewable document (or fallback) using a signed view URL.
  const openFile = async () => {
    try {
      const url = viewUrl ?? (await api.materials.fileUrl(material.id, 'view'))
      window.open(url, '_blank', 'noopener')
    } catch {
      toast.error(t('materialOpenFailed'))
    }
  }

  // Download via a forced-attachment signed URL (server enforces the gate).
  const download = async () => {
    setDownloading(true)
    try {
      const url = await api.materials.fileUrl(material.id, 'download')
      const a = document.createElement('a')
      a.href = url
      a.download = material.file_name ?? material.title
      document.body.appendChild(a)
      a.click()
      a.remove()
      trackDownloadMaterial({ id: material.id, title: material.title, kind: material.kind })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('materialDownloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const title = materialTitle(material, lang)

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
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-card outline-none animate-sheetIn sm:max-h-[88vh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="tamil truncate font-heading text-base font-semibold text-ink">{title}</h2>
            {material.description && (
              <p className="tamil mt-0.5 line-clamp-2 font-body text-xs text-ink2">{material.description}</p>
            )}
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
        <div className="min-h-0 flex-1 overflow-auto bg-canvas">
          {material.kind === 'video' && material.youtube_id && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={youtubeEmbed(material.youtube_id)}
                title={title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {material.kind === 'image' &&
            (loading ? (
              <ViewerSpinner />
            ) : failed || !viewUrl ? (
              <ViewerError text={t('materialOpenFailed')} />
            ) : (
              <img src={viewUrl} alt={title} className="mx-auto block max-h-[70vh] w-full object-contain" />
            ))}

          {material.kind === 'pdf' &&
            (loading ? (
              <ViewerSpinner />
            ) : failed || !viewUrl ? (
              <ViewerError text={t('materialOpenFailed')} />
            ) : (
              <iframe src={viewUrl} title={title} className="h-[70vh] w-full bg-white" />
            ))}

          {material.kind === 'document' && (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
                <FileText size={28} />
              </span>
              <div>
                <p className="tamil font-heading text-sm font-semibold text-ink">
                  {material.file_name ?? title}
                </p>
                <p className="font-body text-xs text-ink2">{t('materialDocHint')}</p>
              </div>
              <button onClick={openFile} className="btn-ghost">
                <ExternalLink size={16} /> {t('materialOpen')}
              </button>
            </div>
          )}
        </div>

        {/* Footer actions (files only — videos play inline and link out below). */}
        {isFile && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
            <button
              onClick={openFile}
              className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
            >
              <ExternalLink size={15} /> {t('materialOpen')}
            </button>
            {material.downloadable && (
              <button onClick={download} disabled={downloading} className="btn-brand press disabled:opacity-60">
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {t('materialDownload')}
              </button>
            )}
          </div>
        )}

        {/* Video: link out to YouTube. */}
        {material.kind === 'video' && material.youtube_id && (
          <div className="flex justify-end border-t border-line px-4 py-3 sm:px-6">
            <a
              href={youtubeWatch(material.youtube_id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
            >
              <ExternalLink size={15} /> {t('materialOpenYoutube')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function ViewerSpinner() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin text-brand" />
    </div>
  )
}
function ViewerError({ text }: { text: string }) {
  return <p className="px-6 py-16 text-center font-body text-sm text-ink2">{text}</p>
}
