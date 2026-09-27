import { useEffect, type MouseEvent } from 'react'
import { ArrowRight, CircleAlert, Download, Send, Youtube } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useForceLightTheme } from '../hooks/useForceLightTheme'
import LandingLangPrompt, { useLandingLang, type LandingLang } from '../components/Landing/LandingLangPrompt'
import {
  AnswerKeyFaqSection,
  AnswerKeyFeaturesSection,
  AnswerKeyFooter,
  AnswerKeyHeader,
  AnswerKeySidebarBox,
  AnswerKeyStickyBar,
  TELEGRAM_URL,
  TNPSC_OFFICIAL_URL,
  YOUTUBE_URL,
} from '../components/Landing/AnswerKeyChrome'
import { usePdfLangChooser } from '../components/Landing/PdfLangDialog'
import { track, trackViewContent } from '../lib/tracking'
import { isAndroidWebView, openInBrowser } from '../lib/webview'
import {
  ANSWER_KEY_GROUPS,
  ANSWER_KEY_ORIGIN,
  PAST_ANSWER_KEY_PAGES,
  pastPagesForGroup,
  type PastAnswerKeyPageDef,
} from '../lib/answerKeyGroups'

// ─── Bilingual copy ──────────────────────────────────────────────────────────
const T = {
  navAnswerKey: { ta: 'விடைக்குறிப்பு', en: 'Answer Key' },
  navFeatures: { ta: 'வசதிகள்', en: 'Features' },
  navFaq: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  openApp: { ta: 'App-ஐ திற', en: 'Open App' },
  otherLang: { ta: 'English', en: 'தமிழ்' },
  otherLangAria: { ta: 'Read in English', en: 'தமிழில் படிக்க' },

  byline: { ta: (d: string) => `TNPSC Mentors · புதுப்பிக்கப்பட்டது: ${d}`, en: (d: string) => `TNPSC Mentors · Updated: ${d}` },
  chooseExam: { ta: 'தேர்வைத் தேர்ந்தெடுங்க', en: 'Choose Your Exam' },
  chooseYear: { ta: 'மற்ற ஆண்டுகள்', en: 'Other Years' },
  currentYearChip: { ta: '2026 (தற்போதைய)', en: '2026 (current)' },
  ctaAppAuthed: { ta: 'என் Dashboard-க்கு செல்', en: 'Go to my dashboard' },
  ctaApp: { ta: 'இலவசக் கணக்கு', en: 'Free account' },

  practiceTitle: { ta: 'இந்த ஆண்டு வினாத்தாளைப் பயிற்சி செய்யுங்க', en: 'Practice this year’s paper now' },
  practiceButton: { ta: 'விடைக்குறிப்புடன் பயிற்சி செய்ய', en: 'Practice with answer key' },
  downloadButton: { ta: 'PDF விடைக்குறிப்பைப் பதிவிறக்கு', en: 'Download answer key PDF' },
  downloadTitle: {
    ta: (y: number) => `${y} விடைக்குறிப்பு PDF — இலவசப் பதிவிறக்கம்`,
    en: (y: number) => `${y} Answer Key PDF — free download`,
  },
  downloadSub: {
    ta: 'முழு விடைக்குறிப்பு ஒரே PDF-ல். பிறகு அதே வினாத்தாளை App-ல் விளக்கத்துடன் பயிற்சி செய்யுங்க.',
    en: 'The full answer key in one PDF. Then practise the same paper in the app, with explanations.',
  },
  downloadShort: { ta: 'PDF பதிவிறக்கு', en: 'Download PDF' },

  infoTitle: { ta: 'வினாத்தாள் விவரம்', en: 'Paper Details' },
  examName: { ta: 'தேர்வின் பெயர்', en: 'Exam Name' },
  examYear: { ta: 'தேர்வு ஆண்டு', en: 'Exam Year' },
  questionsAvailable: { ta: 'பயிற்சிக்குக் கிடைக்கும் வினாக்கள்', en: 'Questions Available to Practice' },
  format: { ta: 'வடிவம்', en: 'Format' },
  formatVal: { ta: 'App-ல் இலவசப் பயிற்சி + விளக்கம்', en: 'Free in-app practice + explanations' },
  formatValPdf: { ta: 'இலவச PDF + App-ல் பயிற்சி & விளக்கம்', en: 'Free PDF + in-app practice & explanations' },
  answerKeyType: { ta: 'விடைக்குறிப்பு வகை', en: 'Answer Key' },
  answerKeyTypeVal: { ta: 'TNPSC Mentors தொகுத்தது (அதிகாரப்பூர்வமற்றது)', en: 'Compiled by TNPSC Mentors (unofficial)' },
  statusSource: { ta: 'அதிகாரப்பூர்வ தளம்', en: 'Official Source' },

  notifyTitle: { ta: 'எங்களுடன் இணைந்திருங்க', en: 'Stay in the loop' },
  notifySub: {
    ta: 'அடுத்த தேர்வு விடைக்குறிப்பு உள்ளிட்ட புதுப்பிப்புகளுக்கு Telegram அல்லது YouTube-ல் இணையுங்க.',
    en: "Join our Telegram or YouTube for the next exam's answer key and other updates.",
  },
  notifyTelegram: { ta: 'Telegram-ல் சேருங்க', en: 'Join our Telegram' },
  notifyYoutube: { ta: 'YouTube-ல் Subscribe பண்ணுங்க', en: 'Subscribe on YouTube' },

  disclaimerTitle: { ta: 'கவனிக்க', en: 'Please note' },
  disclaimer: {
    ta: 'இது TNPSC Mentors குழு சுய மதிப்பீட்டிற்காகத் தொகுத்த அதிகாரப்பூர்வமற்ற விடைக்குறிப்பு. TNPSC-ன் அதிகாரப்பூர்வ விடைக்குறிப்பு (இன்னும் கிடைத்தால்) tnpsc.gov.in-ல் இருக்கும்.',
    en: 'This is an unofficial answer key compiled by the TNPSC Mentors team for self-evaluation. TNPSC’s own official answer key for this year, where still published, can be found on tnpsc.gov.in.',
  },
  officialSite: { ta: 'அதிகாரப்பூர்வ தளம்', en: 'Official website' },

  sidebarLinksTitle: { ta: 'தொடர்புடைய இணைப்புகள்', en: 'Related Links' },
  sidebarStartTitle: { ta: 'இலவசமாகத் தொடங்குங்க', en: 'Start free' },
  sidebarStartBody: {
    ta: 'மாதிரித் தேர்வுகள், PYQ, தினசரி நடப்பு நிகழ்வுகள் — TNPSC Mentors-ல்.',
    en: 'Mock tests, PYQ, daily current affairs — all on TNPSC Mentors.',
  },
  linkPyq1: { ta: 'குரூப் 1 PYQ', en: 'Group 1 Previous Year Questions' },
  linkPyq2: { ta: 'குரூப் 2 PYQ', en: 'Group 2 Previous Year Questions' },
  linkPyq4: { ta: 'குரூப் 4 PYQ', en: 'Group 4 Previous Year Questions' },
  linkMaterials: { ta: 'படிப்புப் பொருட்கள்', en: 'Study Materials' },

  featuresTitle: { ta: 'TNPSC தயாரிப்புக்குத் தேவையான எல்லாமே ஒரே App-ல்', en: 'Everything you need for TNPSC, in one app' },
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'Frequently asked questions' },

  footerTagline: {
    ta: 'TNPSC தேர்வுத் தயாரிப்பு — தமிழ் & English-ல்.',
    en: 'TNPSC exam preparation in Tamil and English.',
  },
  footerFollow: { ta: 'எங்களைப் பின்தொடருங்க', en: 'Follow us' },
  footerDisclaimer: {
    ta: 'Tamil Nadu Public Service Commission-உடன் தொடர்பில்லை.',
    en: 'Not affiliated with the Tamil Nadu Public Service Commission.',
  },
} as const

type PlainKey = {
  [K in keyof typeof T]: (typeof T)[K][LandingLang] extends string ? K : never
}[keyof typeof T]

const SIDEBAR_PYQ_LINKS: { href: string; label: PlainKey }[] = [
  { href: '/test-arena/pyq/group1', label: 'linkPyq1' },
  { href: '/test-arena/pyq/group2', label: 'linkPyq2' },
  { href: '/test-arena/pyq/group4', label: 'linkPyq4' },
]

function buildFaqs(def: PastAnswerKeyPageDef): { ta: { q: string; a: string }; en: { q: string; a: string } }[] {
  const hub = ANSWER_KEY_GROUPS[def.group]
  const label = hub.examLabel
  return [
    {
      en: {
        q: `Where can I get the TNPSC ${label} ${def.year} answer key?`,
        a: `Right here — tap "Practice with answer key" to open the full ${def.year} paper in the app. Every question shows the correct answer and a bilingual explanation.`,
      },
      ta: {
        q: `TNPSC ${label} ${def.year} விடைக்குறிப்பு எங்கே கிடைக்கும்?`,
        a: `இங்கேயே — "விடைக்குறிப்புடன் பயிற்சி செய்ய" என்பதை அழுத்தி ${def.year} முழு வினாத்தாளையும் App-ல் திறக்கலாம். ஒவ்வொரு வினாவிற்கும் சரியான விடையும் இருமொழி விளக்கமும் உள்ளது.`,
      },
    },
    def.pdfHref
      ? {
          en: {
            q: 'Is this a downloadable PDF?',
            a: `Yes — use "Download answer key PDF" above for the full ${def.year} answer key as a PDF. You can also practice the same paper interactively in the app with explanations for every question.`,
          },
          ta: {
            q: 'இது பதிவிறக்கக்கூடிய PDF-ஆ?',
            a: `ஆம் — ${def.year} முழு விடைக்குறிப்பையும் PDF-ஆக மேலே "PDF விடைக்குறிப்பைப் பதிவிறக்கு" மூலம் பெறலாம். அதே வினாத்தாளை App-லும் ஒவ்வொரு வினாவிற்கான விளக்கத்துடன் ஊடாடும் விதத்தில் பயிற்சி செய்யலாம்.`,
          },
        }
      : {
          en: {
            q: 'Is this a downloadable PDF?',
            a: `No PDF for this year yet — you can practice the ${def.year} paper interactively in the app, which we think is more useful for self-evaluation than a static PDF.`,
          },
          ta: {
            q: 'இது பதிவிறக்கக்கூடிய PDF-ஆ?',
            a: `இந்த ஆண்டுக்கு PDF இன்னும் இல்லை — ${def.year} வினாத்தாளை App-லேயே ஊடாடும் விதத்தில் பயிற்சி செய்யலாம், இது சுய மதிப்பீட்டிற்கு PDF-ஐ விட பயனுள்ளது.`,
          },
        },
    {
      en: {
        q: 'Is this the official TNPSC answer key?',
        a: 'No. It is prepared independently by TNPSC Mentors so you can estimate your score. TNPSC’s own official key, where still published, is final.',
      },
      ta: {
        q: 'இது TNPSC-ன் அதிகாரப்பூர்வ விடைக்குறிப்பா?',
        a: 'இல்லை. உங்கள் மதிப்பெண்ணை மதிப்பிட TNPSC Mentors தனியாகத் தயாரித்தது. TNPSC-ன் அதிகாரப்பூர்வ விடைக்குறிப்பே (இருந்தால்) இறுதியானது.',
      },
    },
    {
      en: { q: 'Are the explanations available in Tamil?', a: 'Yes. Every explanation is in both Tamil and English.' },
      ta: { q: 'விளக்கங்கள் தமிழில் கிடைக்குமா?', a: 'ஆம். ஒவ்வொரு விளக்கமும் தமிழிலும் English-லும் உள்ளது.' },
    },
    {
      en: { q: 'Do I need to pay?', a: 'No. Practising previous year papers in the app is free to start.' },
      ta: { q: 'பணம் கட்ட வேண்டுமா?', a: 'இல்லை. App-ல் முந்தைய ஆண்டு வினாத்தாள்களைப் பயிற்சி செய்வது இலவசமாகத் தொடங்கலாம்.' },
    },
  ]
}

function formatDate(lang: LandingLang, iso: string): string {
  return new Intl.DateTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PastAnswerKeyPage({ pastKey }: { pastKey: string }) {
  const def = PAST_ANSWER_KEY_PAGES.find((p) => p.key === pastKey)!
  const hub = ANSWER_KEY_GROUPS[def.group]
  const { isAuthenticated } = useAuth()
  useForceLightTheme()
  const [lang, setLang, langChosen] = useLandingLang()
  const t = (key: PlainKey): string => T[key][lang] as string

  const faqs = buildFaqs(def)
  const yearChips = pastPagesForGroup(def.group)
  const sidebarLinks: { href: string; label: string }[] = [
    ...(hub.seriesLink ? [{ href: hub.seriesLink.href, label: hub.seriesLink.label[lang] }] : []),
    ...SIDEBAR_PYQ_LINKS.map((l) => ({ href: l.href, label: t(l.label) })),
    { href: '/materials', label: t('linkMaterials') },
  ]

  useEffect(() => {
    trackViewContent({ contentName: `AnswerKeyPast:${def.key}`, contentCategory: 'landing' })
  }, [def.key])

  useEffect(() => {
    document.title = def.docTitle
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', ANSWER_KEY_ORIGIN + def.path)
  }, [def])

  useEffect(() => {
    const el = document.documentElement
    const prev = el.lang
    el.lang = lang === 'ta' ? 'ta' : 'en'
    return () => {
      el.lang = prev
    }
  }, [lang])

  const appHref = isAuthenticated ? '/test-arena' : '/register'
  const onAppClick = (e: MouseEvent<HTMLAnchorElement>, source: string) => {
    track('answer_key_open_app', { source, group: def.group, year: def.year })
    if (!isAuthenticated && isAndroidWebView) {
      e.preventDefault()
      openInBrowser('/register')
    }
  }
  const onPracticeClick = () => {
    track('answer_key_practice', { group: def.group, year: def.year })
    if (isAndroidWebView) openInBrowser(def.practiceHref)
  }
  const pdf = usePdfLangChooser(lang, (pdfLang) =>
    track('answer_key_download_pdf', { group: def.group, year: def.year, lang: pdfLang })
  )
  const onDownloadClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (def.pdfHref) pdf.onTrigger(e, { en: def.pdfHref, ta: def.pdfHrefTa })
  }

  const appLabel = isAuthenticated ? t('ctaAppAuthed') : t('ctaApp')

  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-card pb-24 sm:pb-0">
      <AnswerKeyHeader
        onToggleLang={() => setLang(lang === 'ta' ? 'en' : 'ta')}
        copy={{
          navAnswerKey: t('navAnswerKey'),
          navFeatures: t('navFeatures'),
          navFaq: t('navFaq'),
          openApp: t('openApp'),
          otherLang: t('otherLang'),
          otherLangAria: t('otherLangAria'),
        }}
        appHref={appHref}
        onAppClick={onAppClick}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:grid lg:grid-cols-[1fr,300px] lg:items-start lg:gap-10">
        <div id="answer-key" className="scroll-mt-20 min-w-0">
          <h1 className="font-heading text-[1.5rem] font-extrabold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[2rem]">
            {def.title}
          </h1>
          <p className="tamil mt-2 font-body text-xs font-medium text-ink2">{T.byline[lang](formatDate(lang, def.updated))}</p>

          <div className="mt-5 overflow-hidden rounded-card border border-line bg-card p-4 sm:p-5">
            <img src={def.bannerImage} alt={def.title} className="w-full rounded-field" />
          </div>

          {/* ─── Download + practice CTA ────────────────────────────────────── */}
          {/* The PDF is what most visitors searched for, so when there is one it
              leads in brand violet; practising in the app is the secondary step. */}
          <div
            className={`mt-6 rounded-card border p-5 text-center sm:p-6 ${
              def.pdfHref ? 'border-brand/40 bg-brand-soft' : 'border-line bg-card'
            }`}
          >
            <h2 className="tamil font-heading text-lg font-bold text-ink sm:text-xl">
              {def.pdfHref ? T.downloadTitle[lang](def.year) : t('practiceTitle')}
            </h2>
            <p className="tamil mt-1 font-body text-sm text-ink2">
              {def.pdfHref ? t('downloadSub') : `${def.questionCount.toLocaleString()} · ${t('questionsAvailable')}`}
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {def.pdfHref && (
                <a
                  href={def.pdfHref}
                  download
                  onClick={onDownloadClick}
                  className="btn-wrap btn-brand tamil inline-flex w-full max-w-sm justify-center px-6 py-3.5 text-base shadow-lg shadow-brand/25 sm:w-auto"
                >
                  <Download size={18} /> {t('downloadButton')}
                </a>
              )}
              <a
                href={def.practiceHref}
                onClick={onPracticeClick}
                className={`btn-wrap tamil inline-flex w-full max-w-sm justify-center px-6 py-3 text-sm sm:w-auto ${
                  def.pdfHref ? 'btn-ghost bg-card' : 'btn-brand'
                }`}
              >
                {t('practiceButton')} <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* ─── Paper details table ────────────────────────────────────────── */}
          <h2 className="tamil mt-8 font-heading text-lg font-bold text-ink sm:text-xl">{t('infoTitle')}</h2>
          <div className="mt-3 overflow-hidden rounded-card border border-line">
            <table className="w-full border-collapse text-left">
              <tbody>
                {[
                  [t('examName'), hub.examFullName[lang]],
                  [t('examYear'), String(def.year)],
                  [t('questionsAvailable'), def.questionCount.toLocaleString()],
                  [t('format'), def.pdfHref ? t('formatValPdf') : t('formatVal')],
                  [t('answerKeyType'), t('answerKeyTypeVal')],
                ].map(([label, value], i) => (
                  <tr key={label} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/5' : 'bg-card'}>
                    <th
                      scope="row"
                      className="tamil w-2/5 border-b border-line px-3 py-2.5 align-top font-heading text-sm font-semibold text-ink sm:px-4"
                    >
                      {label}
                    </th>
                    <td className="tamil border-b border-line px-3 py-2.5 font-body text-sm text-ink2 sm:px-4">{value}</td>
                  </tr>
                ))}
                <tr className="bg-card">
                  <th scope="row" className="tamil px-3 py-2.5 align-top font-heading text-sm font-semibold text-ink sm:px-4">
                    {t('statusSource')}
                  </th>
                  <td className="px-3 py-2.5 font-body text-sm sm:px-4">
                    <a
                      href={TNPSC_OFFICIAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
                    >
                      tnpsc.gov.in
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Notify ───────────────────────────────────────────────────────── */}
          <div className="mt-8 rounded-card border border-line bg-card p-5">
            <h3 className="tamil font-heading text-base font-bold text-ink">{t('notifyTitle')}</h3>
            <p className="tamil mt-1 font-body text-sm leading-relaxed text-ink2">{t('notifySub')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('answer_key_notify', { channel: 'telegram', group: def.group, year: def.year })}
                className="btn-wrap btn tamil min-h-[48px] bg-[#0B72B5] px-4 text-sm text-white hover:brightness-110"
              >
                <Send size={16} /> {t('notifyTelegram')}
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('answer_key_notify', { channel: 'youtube', group: def.group, year: def.year })}
                className="btn-wrap btn tamil min-h-[48px] bg-[#CC0000] px-4 text-sm text-white hover:brightness-110"
              >
                <Youtube size={16} /> {t('notifyYoutube')}
              </a>
            </div>
          </div>

          {/* ─── Disclaimer ───────────────────────────────────────────────────── */}
          <aside className="mt-8 flex items-start gap-3 rounded-card border border-line bg-gray-50 p-4 dark:bg-white/5">
            <CircleAlert size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="tamil font-body text-sm leading-relaxed text-ink2">
              <strong className="font-semibold text-ink">{t('disclaimerTitle')}: </strong>
              {t('disclaimer')}{' '}
              <a
                href={TNPSC_OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
              >
                {t('officialSite')}
              </a>
            </p>
          </aside>
        </div>

        {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="mt-10 min-w-0 lg:mt-0">
          {/* Group + year switchers live here rather than as pills above the
              H1 — a visitor on the wrong group or year is one tap away in the
              sidebar instead of competing with the title for space. */}
          <AnswerKeySidebarBox
            title={t('chooseExam')}
            items={(['group1', 'group2', 'group4'] as const).map((key) => ({
              href: ANSWER_KEY_GROUPS[key].path,
              label: ANSWER_KEY_GROUPS[key].examLabel,
              active: key === def.group,
            }))}
          />

          <div className="mt-5">
            <AnswerKeySidebarBox
              title={t('chooseYear')}
              items={[
                { href: hub.path, label: t('currentYearChip') },
                ...yearChips.map((y) => ({ href: y.path, label: String(y.year), active: y.key === def.key })),
              ]}
            />
          </div>

          <div className="mt-5">
            <AnswerKeySidebarBox title={t('sidebarLinksTitle')} items={sidebarLinks} />
          </div>

          <div className="mt-5 overflow-hidden rounded-card border border-line">
            <div className="bg-card p-5 text-center">
              <p className="tamil font-heading text-sm font-bold text-ink">{t('sidebarStartTitle')}</p>
              <p className="tamil mt-1 font-body text-xs leading-relaxed text-ink2">{t('sidebarStartBody')}</p>
              <a
                href={appHref}
                onClick={(e) => onAppClick(e, 'sidebar')}
                className="btn-wrap btn-brand tamil mt-4 inline-flex w-full justify-center px-5 py-2.5 text-sm"
              >
                {appLabel}
              </a>
            </div>
          </div>
        </aside>
      </main>

      <AnswerKeyFeaturesSection
        lang={lang}
        title={t('featuresTitle')}
        appLabel={appLabel}
        appHref={appHref}
        onAppClick={onAppClick}
      />

      <AnswerKeyFaqSection title={t('faqTitle')}>
        {faqs.map((f) => (
          <div key={f.en.q} className="rounded-card border border-line bg-card p-4">
            <h3 className="tamil font-heading text-sm font-bold text-ink">{f[lang].q}</h3>
            <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">{f[lang].a}</p>
          </div>
        ))}
      </AnswerKeyFaqSection>

      <AnswerKeyFooter tagline={t('footerTagline')} followLabel={t('footerFollow')} disclaimer={t('footerDisclaimer')} />

      <AnswerKeyStickyBar
        answerKeyLabel={t('navAnswerKey')}
        appLabel={t('openApp')}
        appHref={appHref}
        onAppClick={onAppClick}
        download={def.pdfHref ? { href: def.pdfHref, label: t('downloadShort'), onClick: onDownloadClick } : undefined}
      />

      {pdf.dialog}
      <LandingLangPrompt open={!langChosen} onChoose={setLang} />
    </div>
  )
}
