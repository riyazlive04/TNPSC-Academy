import { useEffect, useState, type MouseEvent } from 'react'
import { ArrowRight, BookOpen, Check, CircleAlert, Clock, Download, ExternalLink, FileText, KeyRound, Send, UserPlus, Youtube } from 'lucide-react'
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
  ANSWER_KEY_GROUP_ORDER,
  ANSWER_KEY_ORIGIN,
  examPhase,
  pastPagesForGroup,
  type AnswerKeyGroupDef,
  type AnswerKeyGroupKey,
  type ResourceKey,
} from '../lib/answerKeyGroups'

// ─── Bilingual copy shared by every group's page ─────────────────────────────
// The H1 and the resource SEO names stay English in both languages: they are
// the exact phrases aspirants search. Tamil: have a native speaker review.
const T = {
  navAnswerKey: { ta: 'விடைக்குறிப்பு', en: 'Answer Key' },
  navFeatures: { ta: 'வசதிகள்', en: 'Features' },
  navFaq: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  openApp: { ta: 'App-ஐ திற', en: 'Open App' },
  otherLang: { ta: 'English', en: 'தமிழ்' },
  otherLangAria: { ta: 'Read in English', en: 'தமிழில் படிக்க' },

  byline: { ta: (d: string) => `TNPSC Mentors · புதுப்பிக்கப்பட்டது: ${d}`, en: (d: string) => `TNPSC Mentors · Updated: ${d}` },
  chooseExamTitle: { ta: 'தேர்வைத் தேர்ந்தெடுங்க', en: 'Choose Your Exam' },
  chooseYear: { ta: 'மற்ற ஆண்டுகள்', en: 'Other Years' },
  currentYearChip: { ta: '2026 (தற்போதைய)', en: '2026 (current)' },
  viewPage: { ta: 'விவரம்', en: 'Details' },
  ctaKey: { ta: 'விடைக்குறிப்புக்குச் செல்', en: 'Go to the answer key' },
  ctaAppAuthed: { ta: 'என் Dashboard-க்கு செல்', en: 'Go to my dashboard' },
  ctaApp: { ta: 'இலவசக் கணக்கு', en: 'Free account' },

  beforeLead: { ta: 'தேர்வு விரைவில்', en: 'Exam coming soon' },
  duringBadge: { ta: 'தேர்வு நடைபெறுகிறது — வாழ்த்துகள்!', en: 'Exam in progress — all the best!' },
  afterBadge: { ta: 'தேர்வு முடிந்தது', en: 'The exam is over' },

  statusTitle: { ta: 'நிலவரம் (Latest Status)', en: 'Latest Status' },
  statusExamName: { ta: 'தேர்வின் பெயர்', en: 'Exam Name' },
  statusExamDate: { ta: 'தேர்வு தேதி', en: 'Exam Date' },
  statusQuestions: { ta: 'மொத்த வினாக்கள்', en: 'Total Questions' },
  statusMarks: { ta: 'மொத்த மதிப்பெண்கள்', en: 'Total Marks' },
  statusNegative: { ta: 'எதிர்மறை மதிப்பெண் (Negative Marking)', en: 'Negative Marking' },
  statusNegativeYes: { ta: 'உண்டு', en: 'Yes' },
  statusNegativeNo: { ta: 'இல்லை', en: 'No' },
  tba: { ta: 'இன்னும் அறிவிக்கப்படவில்லை', en: 'To be announced' },
  statusPaper: { ta: 'வினாத்தாள்', en: 'Question Paper' },
  statusKey: { ta: 'விடைக்குறிப்பு', en: 'Answer Key' },
  statusFormat: { ta: 'வடிவம்', en: 'Format' },
  statusFormatVal: { ta: 'PDF', en: 'PDF' },
  statusSource: { ta: 'அதிகாரப்பூர்வ தளம்', en: 'Official Source' },
  statusAvailable: { ta: 'கிடைக்கிறது', en: 'Available' },
  statusNotYet: { ta: 'இன்னும் இல்லை', en: 'Not yet released' },

  colSNo: { ta: 'எண்', en: 'S.No' },
  colItem: { ta: 'பொருள்', en: 'Item' },
  colStatus: { ta: 'நிலை', en: 'Status' },
  downloadPdf: { ta: 'பதிவிறக்கு', en: 'Download' },
  openLink: { ta: 'திறக்க', en: 'Open' },
  statusBefore: { ta: 'தேர்வுக்குப் பின் வெளியாகும்', en: 'Releases after the exam' },
  statusAfter: { ta: 'தயாராகிறது', en: 'Being prepared' },

  subjectsTitle: { ta: 'பாட வாரியான விடைக்குறிப்பு', en: 'Subject-Wise Answer Key' },
  colSubject: { ta: 'பாடம்', en: 'Subject' },
  subjectSoon: { ta: 'விரைவில்', en: 'Soon' },

  notifyTitle: { ta: 'வெளியானவுடனே தெரிந்துகொள்ளுங்க', en: "Get it the moment it's out" },
  notifySub: {
    ta: 'ஏதாவது ஒன்றைத் தேர்ந்தெடுங்க — விடைக்குறிப்பு வெளியானவுடனே அங்கே link பகிர்வோம்.',
    en: 'Pick any one — we post the answer key link there as soon as it is live.',
  },
  notifyTelegram: { ta: 'Telegram-ல் சேருங்க', en: 'Join our Telegram' },
  notifyYoutube: { ta: 'YouTube-ல் Subscribe பண்ணுங்க', en: 'Subscribe on YouTube' },
  notifyRegister: { ta: 'இலவச account — App alert பெறுங்க', en: 'Free account — get in-app alerts' },

  disclaimerTitle: { ta: 'கவனிக்க', en: 'Please note' },
  disclaimer: {
    ta: 'இது TNPSC Mentors குழு சுய மதிப்பீட்டிற்காகத் தயாரித்த அதிகாரப்பூர்வமற்ற விடைக்குறிப்பு. TNPSC தனது அதிகாரப்பூர்வ உத்தேச விடைக்குறிப்பை tnpsc.gov.in-ல் வெளியிடும் — வேறுபாடு இருந்தால் அதுவே இறுதியானது.',
    en: 'This is an unofficial answer key prepared by the TNPSC Mentors team for self-evaluation. TNPSC publishes its official tentative answer key on tnpsc.gov.in — where the two differ, the official key is final.',
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

// ─── Per-group copy ──────────────────────────────────────────────────────────

function introText(lang: LandingLang, def: AnswerKeyGroupDef, released: boolean): string {
  const name = def.examFullName[lang]
  if (released) {
    return lang === 'ta'
      ? `${name} விடைக்குறிப்பு 2026 வெளியாகிவிட்டது. சரியான விடைகள் குறிக்கப்பட்ட வினாத்தாளையும், ஒவ்வொரு வினாவுக்கும் விரிவான விளக்கங்களுடன் கூடிய விடைக்குறிப்பையும் (தமிழ் அல்லது English) கீழே இலவச PDF-ஆகப் பதிவிறக்கலாம்.`
      : `The ${name} Answer Key 2026 is out. Download the question paper with the correct answers marked, and the full answer key with a detailed explanation for every question (in Tamil or English), as free PDFs below.`
  }
  if (lang === 'ta') {
    return def.examStart
      ? `${name} விடைக்குறிப்பு 2026 இந்தப் பக்கத்தில் வெளியிடப்படும். வினாத்தாள், துணைக்குறிப்பு (Answer Key) மற்றும் பாட வாரியான விளக்கங்களை இங்கே PDF-ஆகப் பதிவிறக்கலாம். இது ஏற்கனவே அறிவிக்கப்பட்ட தேர்வுத் தேதியை அடிப்படையாகக் கொண்டது — அதிகாரப்பூர்வ ஹால் டிக்கெட்டுடன் ஒப்பிட்டுப் பாருங்க.`
      : `${name} விடைக்குறிப்பு 2026 இந்தப் பக்கத்தில் வெளியிடப்படும். வினாத்தாள், துணைக்குறிப்பு (Answer Key) மற்றும் பாட வாரியான விளக்கங்களை இங்கே PDF-ஆகப் பதிவிறக்கலாம். TNPSC இந்தத் தேர்வுக்கான தேதியை அறிவித்தவுடன் இப்பக்கம் புதுப்பிக்கப்படும்.`
  }
  return def.examStart
    ? `The ${name} Answer Key 2026 will be published on this page. Candidates can download the question paper, the answer key, and subject-wise explanations here as PDFs. Dates below are as notified — please cross-check against your hall ticket.`
    : `The ${name} Answer Key 2026 will be published on this page. Candidates can download the question paper, the answer key, and subject-wise explanations here as PDFs. This page will be updated as soon as TNPSC announces the exam.`
}

function buildFaqs(def: AnswerKeyGroupDef): { ta: { q: string; a: string }; en: { q: string; a: string } }[] {
  const label = def.examLabel
  return [
    {
      en: {
        q: `When will the TNPSC ${label} answer key 2026 be released?`,
        a: 'We publish our answer key on this page right after the exam ends. TNPSC releases its official tentative key later on tnpsc.gov.in.',
      },
      ta: {
        q: `TNPSC ${label} விடைக்குறிப்பு 2026 எப்போது வெளியாகும்?`,
        a: 'தேர்வு முடிந்தவுடனே இந்தப் பக்கத்தில் எங்கள் விடைக்குறிப்பை வெளியிடுவோம். TNPSC-ன் அதிகாரப்பூர்வ உத்தேச விடைக்குறிப்பு பின்னர் tnpsc.gov.in-ல் வெளியாகும்.',
      },
    },
    {
      en: {
        q: `Where can I download the TNPSC ${label} question paper 2026?`,
        a: 'Right here, in the table above — as a free PDF, once the exam is over.',
      },
      ta: {
        q: `TNPSC ${label} வினாத்தாள் 2026-ஐ எங்கே பதிவிறக்கலாம்?`,
        a: 'இங்கேயே, மேலே உள்ள அட்டவணையில் — தேர்வு முடிந்ததும் இலவச PDF-ஆக.',
      },
    },
    {
      en: {
        q: 'Is this the official TNPSC answer key?',
        a: 'No. It is prepared independently by TNPSC Mentors so you can estimate your score early. The official key from TNPSC is final.',
      },
      ta: {
        q: 'இது TNPSC-ன் அதிகாரப்பூர்வ விடைக்குறிப்பா?',
        a: 'இல்லை. உங்கள் மதிப்பெண்ணை முன்கூட்டியே கணிக்க TNPSC Mentors தனியாகத் தயாரித்தது. TNPSC-ன் அதிகாரப்பூர்வ விடைக்குறிப்பே இறுதியானது.',
      },
    },
    {
      en: { q: 'Are the explanations available in Tamil?', a: 'Yes. Every explanation is in both Tamil and English.' },
      ta: { q: 'விளக்கங்கள் தமிழில் கிடைக்குமா?', a: 'ஆம். ஒவ்வொரு விளக்கமும் தமிழிலும் English-லும் உள்ளது.' },
    },
    {
      en: {
        q: 'Do I need to pay?',
        a: 'No. The question paper and answer key are free to download, and practising in the app is free to start.',
      },
      ta: {
        q: 'பணம் கட்ட வேண்டுமா?',
        a: 'இல்லை. வினாத்தாளும் விடைக்குறிப்பும் இலவசமாகப் பதிவிறக்கலாம்; App-ல் பயிற்சியையும் இலவசமாகத் தொடங்கலாம்.',
      },
    },
  ]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Rechecks the clock every minute while `live`, so the before/during/after
 *  phase switches on its own with the page left open. */
function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(id)
  }, [live])
  return now
}

function examWhen(lang: LandingLang, def: AnswerKeyGroupDef, tba: string): string {
  if (!def.examStart) return tba
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN'
  const tz = { timeZone: 'Asia/Kolkata' } as const
  const date = new Intl.DateTimeFormat(locale, { ...tz, day: 'numeric', month: 'long', year: 'numeric' })
  const start = new Date(def.examStart)
  if (!def.examEnd) return date.format(start)
  const time = new Intl.DateTimeFormat(locale, { ...tz, hour: 'numeric', minute: '2-digit' })
  return `${date.format(start)} · ${time.format(start)} – ${time.format(new Date(def.examEnd))}`
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

export default function AnswerKeyPage({ group }: { group: AnswerKeyGroupKey }) {
  const def = ANSWER_KEY_GROUPS[group]
  const { isAuthenticated } = useAuth()
  useForceLightTheme()
  const [lang, setLang, langChosen] = useLandingLang()
  // T's entries are almost all plain `{ta, en}` strings; `byline` alone is a
  // `{ta, en}` pair of FUNCTIONS, called directly as `T.byline[lang](date)` at
  // its one call site. `PlainKey` excludes it so `t()` has one clean `string`
  // return type instead of a union TS can't narrow per call.
  const t = (key: PlainKey): string => T[key][lang] as string

  const [phase, setPhase] = useState(() => examPhase(def, Date.now()))
  const now = useNow(phase !== 'after')
  useEffect(() => setPhase(examPhase(def, now)), [now, def])

  const allReady = def.resources.every((r) => r.href)
  const released = phase === 'after' && def.resources.some((r) => r.href)
  const pdf = usePdfLangChooser(lang, (pdfLang, href) => track('answer_key_download', { group, lang: pdfLang, href }))
  // Once released, the phone sticky bar leads with the detailed key (or the first live PDF).
  const stickyPdf = released
    ? (def.resources.find((r) => r.key === 'key' && r.href) ?? def.resources.find((r) => r.kind === 'pdf' && r.href))
    : undefined
  const pastPages = pastPagesForGroup(group)
  const faqs = buildFaqs(def)
  const resourceCopy: Record<ResourceKey, { icon: typeof FileText; ta: string; en: string }> = {
    paper: { icon: FileText, ta: `TNPSC ${def.examLabel} வினாத்தாள் 2026`, en: `TNPSC ${def.examLabel} Question Paper 2026` },
    key: { icon: KeyRound, ta: 'விரிவான விடைக்குறிப்பு', en: 'Detailed Answer Key' },
    explanations: { icon: BookOpen, ta: 'பாட வாரியான விளக்கங்கள்', en: 'Subject-wise Explanations' },
  }
  const sidebarLinks: { href: string; label: string }[] = [
    ...(def.seriesLink ? [{ href: def.seriesLink.href, label: def.seriesLink.label[lang] }] : []),
    ...SIDEBAR_PYQ_LINKS.map((l) => ({ href: l.href, label: t(l.label) })),
    { href: '/materials', label: t('linkMaterials') },
  ]

  useEffect(() => {
    trackViewContent({ contentName: `AnswerKey2026:${group}`, contentCategory: 'landing' })
  }, [group])

  useEffect(() => {
    document.title = def.docTitle
    // The short links render this page too, and index.html's canonical tag
    // names whatever path the visitor arrived on — point it at the one URL.
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
  // Instagram / Facebook in-app browsers cannot run Google Sign-In, so a guest
  // there is handed to the real browser at the tap (same as /group-1).
  const onAppClick = (e: MouseEvent<HTMLAnchorElement>, source: string) => {
    track('answer_key_open_app', { source, group })
    if (!isAuthenticated && isAndroidWebView) {
      e.preventDefault()
      openInBrowser('/register')
    }
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
        {/* ─── Main column ──────────────────────────────────────────────────── */}
        <div id="answer-key" className="scroll-mt-20 min-w-0">
          {/* Title block — plain, blog-post style: this is a utility page people
              scan for a table and a download link, not a marketing hero. */}
          <h1 className="mt-3 font-heading text-[1.5rem] font-extrabold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[2rem]">
            {def.title}
          </h1>
          <p className="tamil mt-2 font-body text-xs font-medium text-ink2">{T.byline[lang](formatDate(lang, def.updated))}</p>
          <p className="tamil mt-4 font-body text-[15px] leading-relaxed text-ink2">{introText(lang, def, released)}</p>

          {/* Live status banner — compact, not a full-bleed hero: the banner
              image in every phase (a plain placeholder before the exam when
              there is none), with an "in progress" / "over" badge under it. */}
          <div className="mt-5 rounded-card border border-line bg-card p-4 sm:p-5">
            {def.bannerImage ? (
              <img src={def.bannerImage} alt={def.title} className="w-full rounded-field" />
            ) : (
              phase === 'before' && (
                <div className="flex aspect-[3/1] w-full items-center justify-center rounded-field border border-dashed border-line bg-gray-50 dark:bg-white/5">
                  <span className="tamil font-body text-xs font-medium text-ink2">{t('beforeLead')}</span>
                </div>
              )
            )}
            {phase === 'during' && (
              <span className={`tamil inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1.5 font-heading text-xs font-bold text-white ${def.bannerImage ? 'mt-4' : ''}`}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                {t('duringBadge')}
              </span>
            )}
            {phase === 'after' && (
              <span className={`tamil inline-flex items-center gap-2 rounded-full bg-correct px-3 py-1.5 font-heading text-xs font-bold text-white ${def.bannerImage ? 'mt-4' : ''}`}>
                <Check size={14} /> {t('afterBadge')}
              </span>
            )}
            <p className="tamil mt-2 font-body text-xs font-medium text-ink2">{examWhen(lang, def, t('tba'))}</p>
          </div>

          {/* ─── Latest Status table ─────────────────────────────────────────── */}
          <h2 className="tamil mt-8 font-heading text-lg font-bold text-ink sm:text-xl">{t('statusTitle')}</h2>
          <div className="mt-3 overflow-hidden rounded-card border border-line">
            <table className="w-full border-collapse text-left">
              <tbody>
                {[
                  [t('statusExamName'), def.examFullName[lang]],
                  [t('statusExamDate'), examWhen(lang, def, t('tba'))],
                  [t('statusQuestions'), def.totalQuestions === null ? t('tba') : String(def.totalQuestions)],
                  [t('statusMarks'), def.totalMarks === null ? t('tba') : String(def.totalMarks)],
                  [
                    t('statusNegative'),
                    def.negativeMarking === null ? t('tba') : def.negativeMarking ? t('statusNegativeYes') : t('statusNegativeNo'),
                  ],
                  [
                    t('statusPaper'),
                    phase === 'after' && def.resources.find((r) => r.key === 'paper')?.href
                      ? t('statusAvailable')
                      : t('statusNotYet'),
                  ],
                  [
                    t('statusKey'),
                    phase === 'after' && def.resources.some((r) => r.key !== 'paper' && r.href)
                      ? t('statusAvailable')
                      : t('statusNotYet'),
                  ],
                  [t('statusFormat'), t('statusFormatVal')],
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

          {/* ─── Downloads table ──────────────────────────────────────────────── */}
          <h2 className="tamil mt-8 font-heading text-lg font-bold text-ink sm:text-xl">
            TNPSC {def.examLabel} Answer Key 2026 PDF
          </h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-white/10">
                  <th className="tamil px-3 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colSNo')}
                  </th>
                  <th className="tamil px-3 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colItem')}
                  </th>
                  <th className="tamil px-3 py-2.5 text-right font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {def.resources.map((r, i) => {
                  const copy = resourceCopy[r.key]
                  const live = phase === 'after' && r.href
                  return (
                    <tr key={r.key} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/5' : 'bg-card'}>
                      <td className="border-t border-line px-3 py-3 font-body text-sm text-ink2 sm:px-4">{i + 1}</td>
                      <td className="border-t border-line px-3 py-3 sm:px-4">
                        <span className="tamil inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink">
                          <copy.icon size={15} className="shrink-0 text-brand" />
                          {r.label?.[lang] ?? copy[lang]}
                        </span>
                      </td>
                      <td className="border-t border-line px-3 py-3 text-right sm:px-4">
                        {live ? (
                          <a
                            href={r.href!}
                            {...(r.kind === 'pdf' ? { download: '' } : {})}
                            onClick={(e) => pdf.onTrigger(e, { en: r.href!, ta: r.hrefTa ?? null })}
                            aria-label={r.kind === 'pdf' ? t('downloadPdf') : t('openLink')}
                            className="btn-wrap btn-brand tamil inline-flex min-h-[40px] min-w-[40px] items-center justify-center px-2.5 text-sm sm:px-4"
                          >
                            {r.kind === 'pdf' ? <Download size={15} /> : <ExternalLink size={15} />}
                            {/* Icon-only on phones: the Tamil label would push the table sideways. */}
                            <span className="hidden sm:inline">{r.kind === 'pdf' ? t('downloadPdf') : t('openLink')}</span>
                          </a>
                        ) : (
                          <span className="tamil inline-flex items-center gap-1.5 font-body text-sm font-medium text-ink2">
                            <Clock size={14} /> {phase === 'after' ? t('statusAfter') : t('statusBefore')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Previous years ───────────────────────────────────────────────── */}
          {/* Until the 2026 key is out, the past papers are what a visitor can
              actually download — so they sit high on the page with the PDF as
              the loud button, not tucked into the sidebar. */}
          {pastPages.length > 0 && (
            <>
              <h2 className="tamil mt-8 font-heading text-lg font-bold text-ink sm:text-xl">
                TNPSC {def.examLabel} Previous Year Answer Keys (PDF)
              </h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line">
                {pastPages.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center gap-3 bg-card px-3 py-3 sm:px-4">
                    <a
                      href={p.path}
                      className="tamil min-w-0 flex-1 font-heading text-sm font-semibold text-ink hover:text-brand-dark"
                    >
                      TNPSC {def.examLabel} Answer Key {p.year}
                    </a>
                    {p.pdfHref && (
                      <a
                        href={p.pdfHref}
                        download
                        onClick={(e) => {
                          track('answer_key_download_pdf', { group, year: p.year, source: 'hub' })
                          pdf.onTrigger(e, { en: p.pdfHref!, ta: p.pdfHrefTa })
                        }}
                        className="btn-wrap btn-brand tamil inline-flex min-h-[40px] items-center px-4 text-sm"
                      >
                        <Download size={15} /> {t('downloadPdf')}
                      </a>
                    )}
                    <a
                      href={p.path}
                      className="tamil inline-flex items-center gap-1 font-heading text-sm font-bold text-brand hover:text-brand-dark"
                    >
                      {t('viewPage')} <ArrowRight size={14} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ─── Subject-wise table ───────────────────────────────────────────── */}
          <h2 className="tamil mt-8 font-heading text-lg font-bold text-ink sm:text-xl">{t('subjectsTitle')}</h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-white/10">
                  <th className="tamil px-3 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colSNo')}
                  </th>
                  <th className="tamil px-3 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colSubject')}
                  </th>
                  <th className="tamil px-3 py-2.5 text-right font-heading text-xs font-bold uppercase tracking-wide text-ink2 sm:px-4">
                    {t('colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {def.subjects.map((s, i) => {
                  const live = phase === 'after' && s.href
                  return (
                    <tr key={s.en} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/5' : 'bg-card'}>
                      <td className="border-t border-line px-3 py-3 font-body text-sm text-ink2 sm:px-4">{i + 1}</td>
                      <td className="tamil border-t border-line px-3 py-3 font-heading text-sm font-semibold text-ink sm:px-4">
                        {s[lang]}
                      </td>
                      <td className="border-t border-line px-3 py-3 text-right sm:px-4">
                        {live ? (
                          <a
                            href={s.href!}
                            onClick={() => track('answer_key_download', { resource: `subject:${s.en}`, group })}
                            className="tamil inline-flex items-center gap-1.5 font-heading text-sm font-bold text-brand hover:text-brand-dark"
                          >
                            <Download size={15} /> {t('downloadPdf')}
                          </a>
                        ) : (
                          <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-ink2 dark:bg-white/10">
                            {t('subjectSoon')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Notify ───────────────────────────────────────────────────────── */}
          {!(phase === 'after' && allReady) && (
            <div className="mt-8 rounded-card border border-line bg-card p-5">
              <h3 className="tamil font-heading text-base font-bold text-ink">{t('notifyTitle')}</h3>
              <p className="tamil mt-1 font-body text-sm leading-relaxed text-ink2">{t('notifySub')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('answer_key_notify', { channel: 'telegram', group })}
                  className="btn-wrap btn tamil min-h-[48px] bg-[#0B72B5] px-4 text-sm text-white hover:brightness-110"
                >
                  <Send size={16} /> {t('notifyTelegram')}
                </a>
                <a
                  href={YOUTUBE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('answer_key_notify', { channel: 'youtube', group })}
                  className="btn-wrap btn tamil min-h-[48px] bg-[#CC0000] px-4 text-sm text-white hover:brightness-110"
                >
                  <Youtube size={16} /> {t('notifyYoutube')}
                </a>
                {!isAuthenticated && (
                  <a
                    href="/register"
                    onClick={(e) => {
                      track('answer_key_notify', { channel: 'register', group })
                      if (isAndroidWebView) {
                        e.preventDefault()
                        openInBrowser('/register')
                      }
                    }}
                    className="btn-wrap btn-ghost tamil min-h-[48px] px-4 text-sm"
                  >
                    <UserPlus size={16} /> {t('notifyRegister')}
                  </a>
                )}
              </div>
            </div>
          )}

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
          {/* Exam switcher lives here, not as pills above the H1 — this page
              exists once per group, and a visitor on the wrong one is one tap
              away in the sidebar instead of competing with the title for space. */}
          <AnswerKeySidebarBox
            title={t('chooseExamTitle')}
            items={ANSWER_KEY_GROUP_ORDER.map((key) => ({
              href: ANSWER_KEY_GROUPS[key].path,
              label: ANSWER_KEY_GROUPS[key].examLabel,
              active: key === group,
            }))}
          />

          {pastPages.length > 0 && (
            <div className="mt-5">
              <AnswerKeySidebarBox
                title={t('chooseYear')}
                items={[
                  { href: def.path, label: t('currentYearChip'), active: true },
                  ...pastPages.map((p) => ({ href: p.path, label: String(p.year) })),
                ]}
              />
            </div>
          )}

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
        download={
          stickyPdf
            ? {
                href: stickyPdf.href!,
                label: t('downloadPdf'),
                onClick: (e) => pdf.onTrigger(e, { en: stickyPdf.href!, ta: stickyPdf.hrefTa ?? null }),
              }
            : undefined
        }
      />

      {pdf.dialog}
      <LandingLangPrompt open={!langChosen} onChoose={setLang} />
    </div>
  )
}
