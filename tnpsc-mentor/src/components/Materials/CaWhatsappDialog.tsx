import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Copy, Download, MessageCircle, Settings2, X } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { useFocusTrap } from '../UI/useFocusTrap'
import { api, type CaMagazineIssue, type CaWhatsappConfig, type CaWhatsappPost } from '../../lib/api'
import { issueDateLabel, magazineName } from '../../lib/caMagazine'
import { toast } from '../../store/toastStore'

/**
 * Get one current-affairs issue ready for the WhatsApp Channel (superadmin).
 *
 * WhatsApp Channels have no posting API — official or otherwise, confirmed
 * against Meta's own docs (a Channel is admin-post-only with no Graph API
 * endpoint). So unlike CaTelegramDialog, nothing here is sent by the server:
 * each language gets its own caption to copy and its own PDF to download
 * (rendered in the browser — see lib/magazinePdf, same as the Telegram flow,
 * since jsPDF can't shape Tamil on its own). Paste both into the WhatsApp
 * Business app by hand, then "Mark as posted" so the issue list remembers it.
 */

type Lang = 'en' | 'ta'

const LANG_NAME: Record<Lang, string> = { en: 'English', ta: 'Tamil' }

/** Where the caption sends readers. */
const APP_LINK = 'https://tnpscmentors.in'

const PLACEHOLDERS = '{date} · {items} · {name} · {link}'

/** Fill a saved template for one language of one issue. */
function resolveCaption(template: string, issue: CaMagazineIssue, lang: Lang): string {
  return template
    .replace(/\{date\}/g, issueDateLabel(issue.ca_type, issue.date, lang))
    .replace(/\{items\}/g, String(issue.items))
    .replace(/\{name\}/g, magazineName(lang))
    .replace(/\{link\}/g, APP_LINK)
}

/** '9 Jul 2026, 06:12' in the operator's own timezone. */
function sentLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CaWhatsappDialog({
  issue,
  onClose,
  onSent,
}: {
  issue: CaMagazineIssue
  onClose: () => void
  /** Fired after a language is marked posted (refresh chips). */
  onSent?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef)

  const [cfg, setCfg] = useState<CaWhatsappConfig | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [posts, setPosts] = useState<CaWhatsappPost[]>([])

  const [captions, setCaptions] = useState<Record<Lang, string>>({ en: '', ta: '' })

  // Template editor (collapsed by default — the raw {placeholder} copy).
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<Record<Lang, string>>({ en: '', ta: '' })
  const [savingTemplates, setSavingTemplates] = useState(false)

  const [downloadingLang, setDownloadingLang] = useState<Lang | null>(null)
  const [markingLang, setMarkingLang] = useState<Lang | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let alive = true
    setLoadFailed(false)
    Promise.all([api.caWhatsapp.config(), api.caWhatsapp.posts(issue.ca_type, issue.date)])
      .then(([config, sentPosts]) => {
        if (!alive) return
        setCfg(config)
        setTemplates({ en: config.captions.en, ta: config.captions.ta })
        setCaptions({
          en: resolveCaption(config.captions.en, issue, 'en'),
          ta: resolveCaption(config.captions.ta, issue, 'ta'),
        })
        setPosts(sentPosts)
      })
      .catch(() => alive && setLoadFailed(true))
    return () => {
      alive = false
    }
  }, [issue])

  const lastSent = (lang: Lang) => posts.find((p) => p.lang === lang)

  const saveTemplates = async () => {
    setSavingTemplates(true)
    try {
      const saved = await api.caWhatsapp.saveConfig({ caption_en: templates.en, caption_ta: templates.ta })
      setCfg(saved)
      setTemplates({ en: saved.captions.en, ta: saved.captions.ta })
      toast.success('Saved. New issues will use this caption.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the templates.')
    } finally {
      setSavingTemplates(false)
    }
  }

  /** Reset one language's caption from its saved template. */
  const resetCaption = (lang: Lang) =>
    setCaptions((prev) => ({ ...prev, [lang]: resolveCaption(templates[lang], issue, lang) }))

  const copyCaption = async (lang: Lang) => {
    try {
      await navigator.clipboard.writeText(captions[lang])
      toast.success(`${LANG_NAME[lang]} caption copied.`)
    } catch {
      toast.error('Could not copy — select and copy the text manually.')
    }
  }

  const downloadPdf = async (lang: Lang) => {
    setDownloadingLang(lang)
    try {
      const items = await api.caMagazine.adminItems(issue.ca_type, issue.date)
      if (!items.length) {
        toast.error('This issue has no items.')
        return
      }
      const { generateMagazinePdf } = await import('../../lib/magazinePdf')
      const { BRAND_WATERMARK } = await import('../../lib/pdfWatermark')
      await generateMagazinePdf({
        items,
        title: magazineName(lang),
        subtitle: issueDateLabel(issue.ca_type, issue.date, lang),
        lang,
        fileLabel: `WhatsApp_${issueDateLabel(issue.ca_type, issue.date, 'en')}_${lang.toUpperCase()}`,
        // A published copy carries the brand + site URL, not a student's name.
        watermark: BRAND_WATERMARK,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloadingLang(null)
    }
  }

  const markSent = async (lang: Lang) => {
    if (!captions[lang].trim()) return toast.error(`The ${LANG_NAME[lang]} caption is empty.`)
    setMarkingLang(lang)
    try {
      await api.caWhatsapp.markSent({
        ca_type: issue.ca_type,
        date: issue.date,
        lang,
        caption: captions[lang],
      })
      toast.success(`Marked ${LANG_NAME[lang]} as posted.`)
      setPosts(await api.caWhatsapp.posts(issue.ca_type, issue.date).catch(() => posts))
      onSent?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setMarkingLang(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={() => onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ca-wa-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-xl overflow-y-auto animate-sheetIn rounded-3xl border border-line bg-card p-5 shadow-card outline-none sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ca-wa-title" className="font-heading text-base font-semibold text-ink">
              Get ready for WhatsApp Channel
            </h2>
            <p className="font-body text-xs text-ink2">
              {issueDateLabel(issue.ca_type, issue.date)} · {issue.items} items · copy + download per
              language, then paste into WhatsApp by hand
            </p>
          </div>
          <button
            onClick={() => onClose()}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!cfg && !loadFailed && (
          <div className="space-y-2 py-8">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        )}

        {loadFailed && (
          <p className="py-8 text-center font-body text-sm text-ink2">
            Could not load the WhatsApp settings. Close and try again.
          </p>
        )}

        {cfg && (
          <>
            <p className="mt-4 flex items-start gap-2 rounded-field border border-line bg-tint px-3 py-2.5 font-body text-xs leading-snug text-ink2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ink2" />
              <span>
                WhatsApp Channels have no posting API, so this can't send anything automatically. Copy a
                caption, download its PDF, then post both to the TNPSC Mentors WhatsApp Channel from the
                WhatsApp Business app — Channel → New post → attach the PDF → paste the caption.
              </span>
            </p>

            {!issue.material && (
              <p className="mt-3 flex items-start gap-2 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accentwarm" />
                <span>
                  This issue is not published in the app yet. You can still post it to the channel, but
                  students won't find it in Materials until you approve it.
                </span>
              </p>
            )}

            {(['en', 'ta'] as Lang[]).map((lang) => {
              const prev = lastSent(lang)
              return (
                <div key={lang} className="mt-4 rounded-field border border-line p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                      {LANG_NAME[lang]} caption
                      {prev && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-1.5 py-0.5 text-[#128C7E] normal-case">
                          <Check size={10} /> posted {sentLabel(prev.sent_at)}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => resetCaption(lang)}
                        className="font-heading text-2xs font-semibold text-brand transition hover:underline"
                      >
                        Reset
                      </button>
                      <span className="font-body text-2xs text-ink2">{captions[lang].length} chars</span>
                    </span>
                  </div>
                  <textarea
                    value={captions[lang]}
                    onChange={(e) => setCaptions((p) => ({ ...p, [lang]: e.target.value }))}
                    rows={lang === 'ta' ? 5 : 4}
                    className="tamil mt-1 w-full resize-y rounded-field border border-line bg-card px-3 py-2 font-body text-sm leading-relaxed text-ink outline-none transition focus:border-brand-ring"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => copyCaption(lang)}
                      className="btn-soft press h-8 gap-1.5 px-3 text-xs"
                    >
                      <Copy size={13} /> Copy caption
                    </button>
                    <button
                      onClick={() => downloadPdf(lang)}
                      disabled={downloadingLang === lang}
                      className="btn-soft press h-8 gap-1.5 px-3 text-xs disabled:opacity-50"
                    >
                      {downloadingLang === lang ? <Spinner size={13} /> : <Download size={13} />} Download PDF
                    </button>
                    <button
                      onClick={() => markSent(lang)}
                      disabled={markingLang === lang}
                      className="btn-brand press ml-auto h-8 gap-1.5 px-3 text-xs disabled:opacity-60"
                    >
                      {markingLang === lang ? <Spinner size={13} /> : <Check size={13} />} Mark as posted
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Default templates */}
            <div className="mt-4 rounded-field border border-line">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <Settings2 size={14} className="text-ink2" />
                <span className="flex-1 font-heading text-xs font-semibold text-ink">
                  Default caption template
                </span>
                <ChevronDown
                  size={15}
                  className={`text-ink2 transition-transform ${showTemplates ? 'rotate-180' : ''}`}
                />
              </button>
              {showTemplates && (
                <div className="border-t border-line px-3 py-3">
                  <p className="font-body text-2xs text-ink2">
                    Used to pre-fill every future issue. Placeholders: {PLACEHOLDERS}. WhatsApp bolds text
                    wrapped in *asterisks* — there is no HTML support.
                  </p>
                  {(['en', 'ta'] as Lang[]).map((lang) => (
                    <label key={lang} className="mt-2.5 block">
                      <span className="font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                        {LANG_NAME[lang]}
                      </span>
                      <textarea
                        value={templates[lang]}
                        onChange={(e) => setTemplates((p) => ({ ...p, [lang]: e.target.value }))}
                        rows={4}
                        className="tamil mt-1 w-full resize-y rounded-field border border-line bg-card px-3 py-2 font-body text-sm leading-relaxed text-ink outline-none transition focus:border-brand-ring"
                      />
                    </label>
                  ))}
                  <button
                    onClick={saveTemplates}
                    disabled={savingTemplates}
                    className="btn-soft press mt-2 h-8 gap-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    {savingTemplates ? <Spinner size={13} /> : <Check size={14} />} Save as default
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button onClick={onClose} className="btn-ghost press ml-auto px-4 py-2.5 text-sm">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
