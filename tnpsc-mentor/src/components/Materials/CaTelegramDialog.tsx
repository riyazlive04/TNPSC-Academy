import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Send, Settings2, X } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { useFocusTrap } from '../UI/useFocusTrap'
import { api, type CaMagazineIssue, type CaTelegramConfig, type CaTelegramPost } from '../../lib/api'
import { issueDateLabel, magazineName } from '../../lib/caMagazine'
import { toast } from '../../store/toastStore'

/**
 * Send one current-affairs issue to the public Telegram channel (superadmin).
 *
 * Two documents go out — the English PDF and the Tamil PDF — each with its own
 * caption. Both PDFs are rendered HERE, in the browser: jsPDF cannot shape
 * Tamil, so every PDF in this app is HTML → html2canvas → jsPDF (see
 * lib/magazinePdf). The server only archives the bytes and posts them.
 *
 * Two levels of caption editing, deliberately separate:
 *   • the box per language is THIS send's caption, already resolved;
 *   • "Default caption template" edits the saved copy, where the {placeholders}
 *     still live — editing one never silently rewrites the other.
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

export default function CaTelegramDialog({
  issue,
  onClose,
  onSent,
}: {
  issue: CaMagazineIssue
  onClose: () => void
  /** Fired after at least one language reached the channel (refresh chips). */
  onSent?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef)

  const [cfg, setCfg] = useState<CaTelegramConfig | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [posts, setPosts] = useState<CaTelegramPost[]>([])

  const [channel, setChannel] = useState('')
  const [langs, setLangs] = useState<Lang[]>(['en', 'ta'])
  const [captions, setCaptions] = useState<Record<Lang, string>>({ en: '', ta: '' })

  // Template editor (collapsed by default — the raw {placeholder} copy).
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<Record<Lang, string>>({ en: '', ta: '' })
  const [savingTemplates, setSavingTemplates] = useState(false)

  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => {
    let alive = true
    setLoadFailed(false)
    Promise.all([api.caTelegram.config(), api.caTelegram.posts(issue.ca_type, issue.date)])
      .then(([config, sentPosts]) => {
        if (!alive) return
        setCfg(config)
        setChannel(config.channel)
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

  const captionMax = cfg?.captionMax ?? 1024
  const lastSent = (lang: Lang) => posts.find((p) => p.lang === lang)

  const toggleLang = (lang: Lang) =>
    setLangs((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))

  const saveTemplates = async () => {
    setSavingTemplates(true)
    try {
      const saved = await api.caTelegram.saveConfig({
        channel,
        caption_en: templates.en,
        caption_ta: templates.ta,
      })
      setCfg(saved)
      setChannel(saved.channel)
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

  const send = async () => {
    if (!langs.length) return toast.error('Choose at least one language.')
    for (const lang of langs) {
      if (!captions[lang].trim()) return toast.error(`The ${LANG_NAME[lang]} caption is empty.`)
      if (captions[lang].length > captionMax) {
        return toast.error(`The ${LANG_NAME[lang]} caption is over Telegram's ${captionMax}-character limit.`)
      }
    }

    setBusy(true)
    try {
      // Save the channel first, so a corrected handle is in place before the
      // send reads it server-side (and stays fixed for next time).
      if (channel.trim() && channel.trim() !== cfg?.channel) {
        const saved = await api.caTelegram.saveConfig({ channel })
        setCfg(saved)
        setChannel(saved.channel)
      }

      setStep('Loading the issue…')
      const items = await api.caMagazine.adminItems(issue.ca_type, issue.date)
      if (!items.length) {
        toast.error('This issue has no items to send.')
        return
      }

      const { buildMagazinePdfDoc } = await import('../../lib/magazinePdf')
      const { BRAND_WATERMARK } = await import('../../lib/pdfWatermark')

      for (const lang of langs) {
        setStep(`Building the ${LANG_NAME[lang]} PDF…`)
        const doc = await buildMagazinePdfDoc({
          items,
          title: magazineName(lang),
          subtitle: issueDateLabel(issue.ca_type, issue.date, lang),
          lang,
          // A published copy carries the brand + site URL, not a student's name.
          watermark: BRAND_WATERMARK,
        })
        setStep(`Uploading the ${LANG_NAME[lang]} PDF…`)
        await api.caTelegram.upload(issue.ca_type, issue.date, lang, doc.output('blob'))
      }

      setStep('Posting to Telegram…')
      const res = await api.caTelegram.send({
        ca_type: issue.ca_type,
        date: issue.date,
        langs,
        captions: Object.fromEntries(langs.map((l) => [l, captions[l]])),
      })

      const ok = res.results.filter((r) => r.ok).map((r) => LANG_NAME[r.lang])
      const failed = res.results.filter((r) => !r.ok)
      if (ok.length) toast.success(`Sent to ${res.chatId}: ${ok.join(' + ')}.`)
      for (const f of failed) toast.error(`${LANG_NAME[f.lang]}: ${f.error ?? 'could not be sent.'}`)

      setPosts(await api.caTelegram.posts(issue.ca_type, issue.date).catch(() => posts))
      if (ok.length) {
        onSent?.()
        if (!failed.length) onClose()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send to Telegram.')
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ca-tg-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-xl overflow-y-auto animate-sheetIn rounded-3xl border border-line bg-card p-5 shadow-card outline-none sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Send size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ca-tg-title" className="font-heading text-base font-semibold text-ink">
              Send to Telegram
            </h2>
            <p className="font-body text-xs text-ink2">
              {issueDateLabel(issue.ca_type, issue.date)} · {issue.items} items · one message per language,
              each with its own PDF
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
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
            Could not load the Telegram settings. Close and try again.
          </p>
        )}

        {cfg && (
          <>
            {!cfg.enabled && (
              <p className="mt-4 flex items-start gap-2 rounded-field border border-coral/30 bg-coralsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-coral" />
                <span>
                  No Telegram bot token is configured on the server (TELEGRAM_BOT_TOKEN). Sending is
                  disabled until it is set.
                </span>
              </p>
            )}

            {!issue.material && (
              <p className="mt-4 flex items-start gap-2 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accentwarm" />
                <span>
                  This issue is not published in the app yet. You can still post it to the channel, but
                  students won't find it in Materials until you approve it.
                </span>
              </p>
            )}

            {/* Channel */}
            <label className="mt-4 block">
              <span className="font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                Channel
              </span>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={busy}
                placeholder="@tnpscmentors"
                className="mt-1 w-full rounded-field border border-line bg-card px-3 py-2 font-body text-sm text-ink outline-none transition focus:border-brand-ring disabled:opacity-60"
              />
              <span className="mt-1 block font-body text-2xs text-ink2">
                The bot must be an administrator of this channel with "Post Messages".
              </span>
            </label>

            {/* Languages */}
            <div className="mt-4">
              <span className="font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                Send
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['en', 'ta'] as Lang[]).map((lang) => {
                  const on = langs.includes(lang)
                  const prev = lastSent(lang)
                  return (
                    <button
                      key={lang}
                      onClick={() => !busy && toggleLang(lang)}
                      className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-heading text-xs font-semibold transition ${
                        on ? 'bg-brand text-white' : 'border border-line text-ink2 hover:border-brand-ring'
                      }`}
                    >
                      {on && <Check size={13} />} {LANG_NAME[lang]} PDF
                      {prev && (
                        <span className={`font-body text-2xs ${on ? 'text-white/80' : 'text-ink2'}`}>
                          · sent {sentLabel(prev.sent_at)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {langs.some((l) => lastSent(l)) && (
                <p className="mt-1.5 font-body text-2xs text-ink2">
                  A language marked "sent" will be posted again as a NEW message — Telegram does not
                  replace the old one.
                </p>
              )}
            </div>

            {/* Captions for this send */}
            {langs.map((lang) => (
              <div key={lang} className="mt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
                    {LANG_NAME[lang]} caption
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => resetCaption(lang)}
                      disabled={busy}
                      className="font-heading text-2xs font-semibold text-brand transition hover:underline disabled:opacity-50"
                    >
                      Reset
                    </button>
                    <span
                      className={`font-body text-2xs ${
                        captions[lang].length > captionMax ? 'text-coral' : 'text-ink2'
                      }`}
                    >
                      {captions[lang].length}/{captionMax}
                    </span>
                  </span>
                </div>
                <textarea
                  value={captions[lang]}
                  onChange={(e) => setCaptions((p) => ({ ...p, [lang]: e.target.value }))}
                  disabled={busy}
                  rows={lang === 'ta' ? 5 : 4}
                  className={`tamil mt-1 w-full resize-y rounded-field border bg-card px-3 py-2 font-body text-sm leading-relaxed text-ink outline-none transition focus:border-brand-ring disabled:opacity-60 ${
                    captions[lang].length > captionMax ? 'border-coral' : 'border-line'
                  }`}
                />
              </div>
            ))}

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
                    Used to pre-fill every future send. Placeholders: {PLACEHOLDERS}. Basic Telegram HTML
                    (&lt;b&gt;bold&lt;/b&gt;) works; if the tags are malformed the caption is posted as
                    plain text instead.
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
              {busy && step && <span className="font-body text-xs text-ink2">{step}</span>}
              <button
                onClick={onClose}
                disabled={busy}
                className="btn-ghost press ml-auto px-4 py-2.5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={busy || !cfg.enabled || !langs.length}
                className="btn-brand press px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {busy ? <Spinner size={15} /> : <Send size={15} />}
                Send {langs.length === 2 ? 'both' : langs.length === 1 ? LANG_NAME[langs[0]] : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
