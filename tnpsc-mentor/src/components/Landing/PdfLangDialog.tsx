import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Download, Languages, X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import type { LandingLang } from './LandingLangPrompt'

/** One answer-key PDF in each explanation language. `ta` is null while only the English edition exists. */
export interface PdfFiles {
  en: string
  ta: string | null
}

const COPY = {
  title: { ta: 'விளக்கங்கள் எந்த மொழியில் வேண்டும்?', en: 'Which language do you want the explanations in?' },
  sub: { ta: 'இலவச PDF — தேர்ந்தெடுத்தவுடன் பதிவிறக்கம் தொடங்கும்.', en: 'Free PDF — the download starts as soon as you pick.' },
  ta: { ta: 'தமிழ் விளக்கங்கள்', en: 'Tamil explanations' },
  taHint: { ta: 'தமிழில் PDF', en: 'PDF in Tamil' },
  en: { ta: 'English விளக்கங்கள்', en: 'English explanations' },
  enHint: { ta: 'ஆங்கிலத்தில் PDF', en: 'PDF in English' },
  close: { ta: 'மூடு', en: 'Close' },
} as const

/**
 * Asks "Tamil or English explanations?" before an answer-key download. The
 * trigger stays a real `<a href={files.en} download>` (so it works with JS
 * off and for crawlers); `onTrigger` intercepts the click only when a Tamil
 * edition exists and opens the chooser, whose two buttons are the downloads.
 */
export function usePdfLangChooser(uiLang: LandingLang, onDownload: (pdfLang: 'ta' | 'en', href: string) => void) {
  const [files, setFiles] = useState<PdfFiles | null>(null)

  const onTrigger = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, f: PdfFiles) => {
      if (!f.ta) {
        onDownload('en', f.en)
        return
      }
      e.preventDefault()
      setFiles(f)
    },
    [onDownload]
  )

  const dialog = (
    <PdfLangDialog
      files={files}
      uiLang={uiLang}
      onClose={() => setFiles(null)}
      onPick={(pdfLang, href) => {
        onDownload(pdfLang, href)
        setFiles(null)
      }}
    />
  )
  return { onTrigger, dialog }
}

function PdfLangDialog({
  files,
  uiLang,
  onClose,
  onPick,
}: {
  files: PdfFiles | null
  uiLang: LandingLang
  onClose: () => void
  onPick: (pdfLang: 'ta' | 'en', href: string) => void
}) {
  const open = !!files?.ta
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !files?.ta) return null

  // The visitor's page language goes first.
  const options = [
    { pdfLang: 'ta' as const, href: files.ta, label: COPY.ta[uiLang], hint: COPY.taHint[uiLang], badge: 'த' },
    { pdfLang: 'en' as const, href: files.en, label: COPY.en[uiLang], hint: COPY.enHint[uiLang], badge: 'En' },
  ]
  if (uiLang === 'en') options.reverse()

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-lang-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={COPY.close[uiLang]}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
            <Languages size={22} />
          </span>
          <h2 id="pdf-lang-title" className="tamil font-heading text-lg font-bold text-ink [text-wrap:balance]">
            {COPY.title[uiLang]}
          </h2>
          <p className="tamil mt-1.5 font-body text-sm text-ink2">{COPY.sub[uiLang]}</p>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {options.map((o, i) => (
            <a
              key={o.pdfLang}
              href={o.href}
              download
              onClick={() => onPick(o.pdfLang, o.href)}
              className={`btn-wrap tamil flex min-h-[56px] items-center gap-3 px-4 py-3 text-left ${
                i === 0 ? 'btn-brand' : 'btn-ghost'
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-heading text-sm font-bold ${
                  i === 0 ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand'
                }`}
              >
                {o.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-sm font-bold">{o.label}</span>
                <span className={`block font-body text-xs ${i === 0 ? 'text-white/80' : 'text-ink2'}`}>{o.hint}</span>
              </span>
              <Download size={18} className="shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
