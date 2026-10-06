import { useState } from 'react'
import { ArrowRight, CheckCircle2, Download, FileText, Loader2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { track } from '../../lib/tracking'

/**
 * The signed-out lead magnet: ten real previous-year questions with their full
 * bilingual explanations, as a PDF, with no account and no email.
 *
 * The order matters and is the point. The visitor gets the sheet FIRST and is
 * asked to register SECOND, once they have something of ours in their
 * downloads folder — an explanation sheet is the product, so ten of them argue
 * for the account far better than a form in front of the download does. There
 * is deliberately no email gate: a gate here would cost more downloads than the
 * addresses are worth, and the questions are TNPSC's own published material
 * (they are already on the open web at /questions/). What we are giving away is
 * ten of OUR explanations, which is exactly the sample we want in circulation.
 *
 * The register prompt opens on success only. A failed download gets an inline
 * retry instead, because asking somebody to sign up for a file they never
 * received is the worst version of this.
 */

const COPY = {
  badge: { ta: 'இலவசம் · கணக்கு தேவையில்லை', en: 'Free · no account needed' },
  title: {
    ta: 'விளக்கத்துடன் 10 முன்னாள் வினாக்கள் — இலவச PDF',
    en: '10 previous-year questions, fully solved — free PDF',
  },
  body: {
    ta: 'உண்மையான TNPSC தேர்வு வினாக்கள், ஒவ்வொன்றுக்கும் முழு விளக்கம் — தமிழ் & English இரண்டிலும். பதிவு செய்யாமலே download பண்ணுங்க.',
    en: 'Real questions from past TNPSC papers, each with the full explanation — in Tamil and English. Download it without signing up.',
  },
  cta: { ta: 'இலவச PDF-ஐ download பண்ணு', en: 'Download the free PDF' },
  working: { ta: 'உங்கள் PDF தயாராகிறது…', en: 'Building your PDF…' },
  failed: {
    ta: 'PDF உருவாக்க முடியவில்லை. மீண்டும் முயலுங்கள்.',
    en: "Couldn't build the PDF. Please try again.",
  },
  // Post-download prompt.
  doneTitle: { ta: 'உங்கள் PDF download ஆகிவிட்டது', en: 'Your PDF is downloading' },
  doneBody: {
    ta: 'இது மாதிரி விளக்கங்கள் 15,000+ வினாக்களுக்கு app-ல் உள்ளன. இலவசமாக பதிவு செய்து, முன்னாள் வினாத்தாள்கள், தினசரி current affairs test மற்றும் mock தேர்வுகளைப் பயன்படுத்துங்க.',
    en: 'Explanations like these come with 15,000+ questions inside the app. Create a free account to sit full previous-year papers, the daily current-affairs test and the mock exams.',
  },
  doneCta: { ta: 'இலவசமாக பதிவு செய்', en: 'Create a free account' },
  doneLater: { ta: 'பிறகு பார்க்கிறேன்', en: 'Maybe later' },
  pdfTitle: { ta: 'TNPSC முன்னாள் வினாக்கள்', en: 'TNPSC Previous-Year Questions' },
  pdfLabel: {
    ta: '10 வினாக்கள் · முழு விளக்கத்துடன்',
    en: '10 questions · with full explanations',
  },
}

type Lang = 'ta' | 'en'

export default function FreeSampleSheet({
  lang,
  registerHref,
}: {
  lang: Lang
  /** Where the post-download prompt sends them (the signup form). */
  registerHref: string
}) {
  const t = (k: keyof typeof COPY) => COPY[k][lang]
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [prompt, setPrompt] = useState(false)

  const download = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    track('free_sample_pdf_click', { source: 'landing' })
    try {
      const questions = await api.freeSampleQuestions()
      if (!questions.length) throw new Error('empty')
      // Lazy: jspdf + html2canvas + katex are a large chunk and must not be in
      // the landing page's critical path — this is a marketing page whose load
      // time is the conversion.
      const { generateExplanationPdf } = await import('../../lib/explanationPdf')
      await generateExplanationPdf({
        questions,
        title: t('pdfTitle'),
        label: t('pdfLabel'),
        // Both languages: the sheet has to show an aspirant that the Tamil side
        // is real, which is the thing they are deciding about.
        lang: 'both',
      })
      track('free_sample_pdf_download', { source: 'landing' })
      setPrompt(true)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card relative overflow-hidden p-7 sm:p-9">
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
          <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-tile bg-brand-soft text-brand">
            <FileText size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-mintsoft px-3 py-1 font-heading text-xs font-semibold text-mint">
              <CheckCircle2 size={13} /> {t('badge')}
            </span>
            <h3 className="mt-3 font-heading text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">
              {t('title')}
            </h3>
            <p className="mt-2 font-body text-base leading-relaxed text-ink2">{t('body')}</p>
            {failed && (
              <p className="mt-3 font-body text-sm font-semibold text-coral">{t('failed')}</p>
            )}
          </div>
          <button
            onClick={download}
            disabled={busy}
            className="btn-wrap btn-brand w-full flex-shrink-0 px-6 py-3.5 text-base disabled:opacity-70 sm:w-auto"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {busy ? t('working') : t('cta')}
          </button>
        </div>
      </div>

      {/* The ask — after the file, never before it. */}
      {prompt && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/55 p-4 backdrop-blur-sm animate-fadeInFast"
          role="presentation"
          onClick={() => setPrompt(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('doneTitle')}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border border-line bg-card p-7 shadow-card animate-sheetIn"
          >
            <button
              onClick={() => setPrompt(false)}
              aria-label={t('doneLater')}
              className="focus-ring absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-tint-violet hover:text-primary"
            >
              <X size={18} />
            </button>
            <span className="grid h-12 w-12 place-items-center rounded-tile bg-mintsoft text-mint">
              <CheckCircle2 size={24} />
            </span>
            <h4 className="mt-4 font-heading text-xl font-bold tracking-tight text-ink">
              {t('doneTitle')}
            </h4>
            <p className="mt-2 font-body text-base leading-relaxed text-ink2">{t('doneBody')}</p>
            <a
              href={registerHref}
              onClick={() => track('free_sample_pdf_register', { source: 'landing' })}
              className="btn-wrap btn-brand mt-6 w-full px-6 py-3.5 text-base"
            >
              {t('doneCta')} <ArrowRight size={18} />
            </a>
            <button
              onClick={() => setPrompt(false)}
              className="mt-3 w-full font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
            >
              {t('doneLater')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
