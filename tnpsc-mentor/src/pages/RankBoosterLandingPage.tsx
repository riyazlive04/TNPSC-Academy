import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import {
  Rocket,
  Trophy,
  FileText,
  Newspaper,
  ListChecks,
  Download,
  ArrowRight,
  Check,
  CalendarDays,
  Users,
  Sparkles,
  TrendingUp,
  Sun,
  Moon,
  Languages,
  MessageCircle,
  Mail,
  AlertCircle,
  Gift,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useThemeStore } from '../store/themeStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import {
  useRankBoosterPurchase,
  rupees,
  RANK_BOOSTER_MRP_RUPEES,
  RANK_BOOSTER_PRICE_RUPEES,
  RANK_BOOSTER_PERK_KEYS,
  RANK_BOOSTER_BONUS_KEYS,
} from '../hooks/useRankBoosterPurchase'
import PurchaseConfirmModal from '../components/UI/PurchaseConfirmModal'
import PricingCards from '../components/Landing/PricingCards'
import { translate, type StringKey } from '../lib/i18n'
import { trackViewContent } from '../lib/tracking'
import { isAndroidWebView, openInChrome } from '../lib/webview'

type Lang = 'ta' | 'en'

const SCHEDULE_PDF_URL = '/rank-booster-2026-schedule.pdf'
const SUPPORT_EMAIL = 'support@tnpscmentors.in'
const SUPPORT_PHONE = '+91 96777 79808'

// Same semantic tint system as the main landing page (design-system.md):
// violet = core, coral = key numbers, blue = practice, green = included/free.
const TINTS = [
  { bg: 'bg-tint-violet', fg: 'text-brand' },
  { bg: 'bg-tint-coral', fg: 'text-accent' },
  { bg: 'bg-tint-blue', fg: 'text-sky' },
  { bg: 'bg-tint-green', fg: 'text-correct' },
] as const

// ─── Bilingual copy ──────────────────────────────────────────────────────────
const T = {
  backHome: { ta: 'முகப்புக்குத் திரும்ப', en: 'Back to home' },
  signIn: { ta: 'உள்நுழைய', en: 'Sign in' },
  signUp: { ta: 'பதிவு செய்', en: 'Sign up' },
  dashboard: { ta: 'Dashboard', en: 'Dashboard' },

  offerBadge: { ta: 'சுதந்திர தின மாத சலுகை', en: 'Independence Day Month Offer' },
  vacancies: { ta: '821 காலியிடங்கள்', en: '821 Vacancies' },
  examDate: {
    ta: 'தேர்வு தேதி: 01 நவம்பர் 2026 (ஞாயிறு)',
    en: 'Exam Date: 01 November 2026 (Sunday)',
  },
  heroTitle: {
    ta: 'TNPSC Group II / IIA Prelims தேர்வுத் தொடர் 2026',
    en: 'TNPSC Group II / IIA Prelims Test Series 2026',
  },
  heroSub: {
    ta: '23 முழுமையான தேர்வுகள், real exam pattern-ல். GS + Aptitude, Language, மற்றும் 3 Grand Mock தேர்வுகள் அடங்கிய systematic schedule.',
    en: '23 complete tests in the real exam pattern - GS + Aptitude, Language, and 3 Grand Mock tests on a systematic schedule.',
  },
  validTill: { ta: 'ஆகஸ்ட் 31, 2026 வரை மட்டும் இந்த சலுகை', en: 'Offer valid till 31 August 2026 only' },

  ctaEnroll: { ta: 'இப்போதே Enroll ஆகுங்க', en: 'Enroll now' },
  ctaSchedulePdf: { ta: 'முழு அட்டவணை (PDF)', en: 'Full schedule (PDF)' },

  statTests: { ta: '23 தேர்வுகள்', en: '23 Tests' },
  statBreakdown: { ta: '20 Regular + 3 Grand Mock', en: '20 Regular + 3 Grand Mock' },
  statRevision: {
    ta: 'ஒவ்வொரு தேர்வுக்கும் இடையே 2 revision நாட்கள்',
    en: '2 revision days between every test',
  },

  scheduleTitle: { ta: 'முழு தேர்வு அட்டவணை', en: 'Full test schedule' },
  scheduleSub: {
    ta: 'ஒவ்வொரு மூன்றாம் நாளும் ஒரு தேர்வு - இடையே திருப்பிப் படிக்க போதுமான நேரம்.',
    en: 'A test every third day - with enough time between them to revise.',
  },
  scheduleNote: {
    ta: 'பாடங்களின் பெயர்கள் official TNPSC syllabus terms-ஐ பின்பற்றி English-லேயே காட்டப்பட்டுள்ளன.',
    en: 'Subject names are shown in English to match the official TNPSC syllabus terms.',
  },
  downloadPdf: { ta: 'PDF பதிவிறக்க', en: 'Download the PDF' },
  colTest: { ta: 'எண்', en: 'Test' },
  colDate: { ta: 'தேதி', en: 'Date' },
  colType: { ta: 'வகை', en: 'Type' },
  colDetails: { ta: 'Focus', en: 'Focus' },

  featuresTitle: { ta: 'இந்த தொடரில் என்ன கிடைக்கும்', en: 'What you get in this series' },

  rankTrackTitle: {
    ta: 'ஒவ்வொரு தேர்வுக்குப் பிறகும் உங்க நிலையைப் பாருங்க',
    en: 'See where you stand after every test',
  },
  rankTrackBody: {
    ta: 'ஒரு தேர்வை சமர்ப்பித்தவுடனேயே, TNPSC Mentors-ல் இருக்கும் மற்ற அனைத்து aspirants-உடனும் ஒப்பிட்டு உங்க சராசரி மதிப்பெண் அடிப்படையில் ஒரு percentile ("Top X%") காட்டப்படும். இது உங்க Result திரையிலும், Insights பக்கத்திலும் எப்போதும் இருக்கும் - இந்தத் தொடரின் தேர்வுகளை அதிகம் எடுக்க எடுக்க, இந்த எண் உங்க உண்மையான நிலையை இன்னும் துல்லியமா காட்டும்.',
    en: "The moment you submit a test, we show your percentile - a \"Top X%\" figure based on your average score compared with every other aspirant on TNPSC Mentors. It's on your result screen and your Insights page always, and gets sharper the more tests in this series you take.",
  },
  rankTrackPoint1: { ta: 'ஒவ்வொரு தேர்வு முடிவிலும் உடனடியாக தெரியும்', en: 'Shown instantly on every test result' },
  rankTrackPoint2: { ta: 'Insights பக்கத்தில் எப்போது வேண்டுமானாலும் பாருங்க', en: 'Always visible on your Insights page' },
  rankTrackSample: {
    ta: 'உதாரணம் - உங்க dashboard-ல் இப்படி தெரியும்',
    en: "Example of what you'll see on your dashboard",
  },
  rankTrackChartCaption: { ta: 'எடுத்த தேர்வுகளின் எண்ணிக்கை →', en: 'Tests taken →' },

  allPlansTitle: { ta: 'அனைத்து திட்டங்களும்', en: 'All plans' },
  allPlansSub: {
    ta: 'இந்தத் தொடர் மட்டுமல்லாமல், TNPSC Mentors-ல் கிடைக்கும் மற்ற தேர்வுத் தொகுப்புகளையும் பாருங்கள்.',
    en: 'Beyond this test series, see the other test series and plans TNPSC Mentors offers.',
  },

  faqEyebrow: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'Frequently asked questions' },

  footerTagline: {
    ta: 'TNPSC Group II / IIA Prelims-க்கான தேர்வுத் தொடர்.',
    en: 'The Test Series for TNPSC Group II / IIA Prelims.',
  },
  footerSupport: { ta: 'உதவி', en: 'Support' },
  footerLegal: { ta: 'Legal', en: 'Legal' },
  footerPrivacy: { ta: 'தனியுரிமை கொள்கை', en: 'Privacy policy' },
  footerPayment: { ta: 'கட்டண கொள்கை', en: 'Payment policy' },
  footerRefund: { ta: 'பணம் திரும்ப & ரத்து கொள்கை', en: 'Return & cancellation' },
  footerDisclaimer: {
    ta: 'Tamil Nadu Public Service Commission-உடன் தொடர்பில்லை.',
    en: 'Not affiliated with the Tamil Nadu Public Service Commission.',
  },
} as const

const FEATURES: {
  icon: typeof FileText
  ta: { t: string; d: string }
  en: { t: string; d: string }
}[] = [
  {
    icon: Trophy,
    ta: { t: 'மாதிரி தேர்வுகள்', d: 'Real exam pattern-ல் full-length தேர்வுகள் - உங்க readiness-ஐ சரிபார்க்க.' },
    en: { t: 'Mock Tests', d: 'Full-length tests in the real exam pattern to evaluate your readiness.' },
  },
  {
    icon: FileText,
    ta: { t: 'PYQ அணுகல்', d: 'Topic-wise & year-wise முந்தைய ஆண்டு கேள்விகள் - strong practice-க்கு.' },
    en: { t: 'PYQs Access', d: 'Topic-wise and year-wise previous year questions for strong practice.' },
  },
  {
    icon: Newspaper,
    ta: { t: 'நடப்பு நிகழ்வுகள் அணுகல்', d: 'தினசரி, வாராந்திர, மாதாந்திர & தமிழ்நாடு நடப்பு நிகழ்வுகள் - முழுமையான coverage.' },
    en: { t: 'Current Affairs Access', d: 'Daily, weekly, monthly and Tamil Nadu current affairs for complete coverage.' },
  },
  {
    icon: ListChecks,
    ta: { t: 'விளக்கத்துடன் PDF', d: 'ஒவ்வொரு concept-ஐயும் தெளிவா புரிஞ்சுக்க detailed step-by-step விளக்கங்கள்.' },
    en: { t: 'Explanation PDF', d: 'Detailed step-by-step explanations to understand every concept clearly.' },
  },
]

const FAQS: { ta: { q: string; a: string }; en: { q: string; a: string } }[] = [
  {
    ta: { q: 'பணம் கட்ட எப்படி?', a: 'App-க்குள்ள UPI அல்லது card மூலமா, Razorpay-ல் பாதுகாப்பா.' },
    en: { q: 'How do I pay?', a: 'Inside the app via UPI or card, securely through Razorpay.' },
  },
  {
    ta: { q: 'இந்தத் தொகுப்பு எவ்வளவு காலம் அணுகலா இருக்கும்?', a: 'Purchase பண்ணின நாளிலிருந்து 90 நாட்கள்.' },
    en: { q: 'How long do I get access?', a: '90 days from the date of purchase.' },
  },
  {
    ta: { q: 'இந்த offer எப்போ முடியும்?', a: 'ஆகஸ்ட் 31, 2026 வரை மட்டும் ₹1,249 விலை இருக்கும் - அதன் பிறகு ₹1,800 MRP-க்கே கிடைக்கும்.' },
    en: { q: 'When does this offer end?', a: 'The ₹1,249 price is valid only until 31 August 2026 - after that it reverts to the ₹1,800 MRP.' },
  },
  {
    ta: { q: 'Refund கிடைக்குமா?', a: 'எங்க return & cancellation கொள்கையை கீழே பாருங்க.' },
    en: { q: 'Is this refundable?', a: "See our return & cancellation policy in the footer below." },
  },
]

/** 23-test schedule, transcribed from the official flyer. Subject/syllabus names
 * are kept in English (matching the flyer itself) since that's how TNPSC
 * aspirants search for and recognise them, in Tamil or English UI alike. */
const SCHEDULE: {
  no: number
  date: string
  kind: 'gs' | 'lang' | 'mock'
  type: string
  details: string
}[] = [
  { no: 1, date: '21 Aug 2026', kind: 'gs', type: 'GS + Aptitude Test 1', details: 'General Science (30) + Geography of India (45) + Aptitude - Simplification (25)' },
  { no: 2, date: '24 Aug 2026', kind: 'lang', type: 'Language Test 1', details: 'Language Practice Test' },
  { no: 3, date: '27 Aug 2026', kind: 'gs', type: 'GS + Aptitude Test 2', details: 'History & Culture of India (50) + Indian National Movement (25) + Aptitude - HCF & LCM (25)' },
  { no: 4, date: '30 Aug 2026', kind: 'lang', type: 'Language Test 2', details: 'Language Practice Test' },
  { no: 5, date: '02 Sep 2026', kind: 'gs', type: 'GS + Aptitude Test 3', details: 'Indian Polity (75) + Aptitude - Percentage & Ratio and Proportion (25)' },
  { no: 6, date: '05 Sep 2026', kind: 'lang', type: 'Language Test 3', details: 'Language Practice Test' },
  { no: 7, date: '08 Sep 2026', kind: 'gs', type: 'GS + Aptitude Test 4', details: 'Development Administration (50) + Indian Economy (25) + Aptitude - Simple Interest & Compound Interest (25)' },
  { no: 8, date: '11 Sep 2026', kind: 'lang', type: 'Language Test 4', details: 'Language Practice Test' },
  { no: 9, date: '14 Sep 2026', kind: 'gs', type: 'GS + Aptitude Test 5', details: 'History, Culture, Heritage & Socio-Political Movements in Tamil Nadu (75) + Aptitude - Area & Volume: 2D (13), 3D (10), Pathway (2)' },
  { no: 10, date: '17 Sep 2026', kind: 'lang', type: 'Language Test 5', details: 'Language Practice Test' },
  { no: 11, date: '20 Sep 2026', kind: 'gs', type: 'GS + Aptitude Test 6', details: 'GS Full Syllabus as per Weightage in Syllabus (75) + Aptitude - Time and Work (25)' },
  { no: 12, date: '23 Sep 2026', kind: 'lang', type: 'Language Test 6', details: 'Language Practice Test' },
  { no: 13, date: '26 Sep 2026', kind: 'gs', type: 'GS + Aptitude Test 7', details: 'GS Full Syllabus as per Weightage in Syllabus (75) + Aptitude - Reasoning Aptitude (25)' },
  { no: 14, date: '29 Sep 2026', kind: 'lang', type: 'Language Test 7', details: 'Language Practice Test' },
  { no: 15, date: '02 Oct 2026', kind: 'gs', type: 'GS + Aptitude Test 8', details: 'GS Full Syllabus as per Weightage in Syllabus (75) + Aptitude Full Syllabus (25)' },
  { no: 16, date: '05 Oct 2026', kind: 'lang', type: 'Language Test 8', details: 'Language Practice Test' },
  { no: 17, date: '08 Oct 2026', kind: 'gs', type: 'GS + Aptitude Test 9', details: 'GS Full Syllabus as per Weightage in Syllabus (75) + Aptitude Full Syllabus (25)' },
  { no: 18, date: '11 Oct 2026', kind: 'lang', type: 'Language Test 9', details: 'Language Practice Test' },
  { no: 19, date: '14 Oct 2026', kind: 'gs', type: 'GS + Aptitude Test 10', details: 'GS Full Syllabus as per Weightage in Syllabus (75) + Aptitude Full Syllabus (25)' },
  { no: 20, date: '17 Oct 2026', kind: 'lang', type: 'Language Test 10', details: 'Language Practice Test' },
  { no: 21, date: '20 Oct 2026', kind: 'mock', type: 'Grand Mock Test 1', details: 'Full Exam Pattern - 200 Questions' },
  { no: 22, date: '23 Oct 2026', kind: 'mock', type: 'Grand Mock Test 2', details: 'Full Exam Pattern - 200 Questions' },
  { no: 23, date: '26 Oct 2026', kind: 'mock', type: 'Grand Mock Test 3 (Final Mock)', details: 'Full Exam Pattern - 200 Questions' },
]

const KIND_BADGE: Record<'gs' | 'lang' | 'mock', string> = {
  gs: 'bg-tint-violet text-brand',
  lang: 'bg-tint-blue text-sky',
  mock: 'bg-accentwarmsoft text-accentwarm',
}

/** Lightweight scroll-reveal, honours prefers-reduced-motion. Mirrors the same
 * helper on the main landing page (src/pages/LandingPage.tsx). */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

/** Sample progression the State Level Analytics demo card cycles through -
 * illustrative numbers (not a live query), captioned as an example in the
 * copy above it. */
const PERCENTILE_STAGES = [
  { percentile: 25, tests: '1' },
  { percentile: 20, tests: '5' },
  { percentile: 15, tests: '15+' },
] as const

const RANK_DEMO_HOLD_MS = 2100
const RANK_DEMO_TRANSITION_S = 0.7
const RANK_DEMO_RESET_FADE_MS = 350

// Bar-chart scale: the three milestones (Top 25/20/15%) only span a 20-point
// range, so a literal 0-100 scale would make every bar look nearly the same
// height. Zooming the axis to 70-90 (with a small non-zero baseline for
// "not reached yet" bars) keeps the chart honestly ordered while making the
// improvement visually legible - a normal charting convention for tightly
// clustered values, not a distortion of what the numbers mean.
const BAR_SCALE_MIN = 70
const BAR_SCALE_MAX = 90
const BAR_BASELINE_PCT = 12
const scaleBarHeight = (value: number) => {
  const clamped = Math.min(Math.max(value, BAR_SCALE_MIN), BAR_SCALE_MAX)
  const t = (clamped - BAR_SCALE_MIN) / (BAR_SCALE_MAX - BAR_SCALE_MIN)
  return BAR_BASELINE_PCT + t * (100 - BAR_BASELINE_PCT)
}

/** Looping ~6.5s demo of the State Level Analytics card: the percentile
 * counts down smoothly (via a Framer Motion value, so it's driven by rAF -
 * genuinely 60fps, not a CSS keyframe approximation) as "Tests taken"
 * advances, pulses on each new stage, then fades out/in to reset. Deliberately
 * ignores prefers-reduced-motion (unlike Reveal above) - it's a small,
 * self-contained illustrative loop rather than page-scroll motion, and the
 * whole point of this card is to show the feature in action. */
function PercentileDemoCard({ label, chartCaption }: { label: string; chartCaption: string }) {
  const [stage, setStage] = useState(0)
  const [resetting, setResetting] = useState(false)
  const count = useMotionValue<number>(PERCENTILE_STAGES[0].percentile)
  const [display, setDisplay] = useState<number>(PERCENTILE_STAGES[0].percentile)

  useEffect(() => {
    const unsub = count.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [count])

  useEffect(() => {
    let cancelled = false
    let index = 0
    let timer: ReturnType<typeof setTimeout>

    const holdThenAdvance = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        if (index + 1 < PERCENTILE_STAGES.length) {
          index += 1
          setStage(index)
          animate(count, PERCENTILE_STAGES[index].percentile, {
            duration: RANK_DEMO_TRANSITION_S,
            ease: 'easeInOut',
          })
          holdThenAdvance()
        } else {
          // Seamless loop reset - fade out, snap back to stage 0, fade in,
          // rather than visibly counting back up (which would read as the
          // rank getting worse).
          setResetting(true)
          timer = setTimeout(() => {
            if (cancelled) return
            index = 0
            count.set(PERCENTILE_STAGES[0].percentile)
            setStage(0)
            setResetting(false)
            holdThenAdvance()
          }, RANK_DEMO_RESET_FADE_MS)
        }
      }, RANK_DEMO_HOLD_MS)
    }

    holdThenAdvance()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [count])

  const current = PERCENTILE_STAGES[stage]

  return (
    <motion.div
      className="rounded-field bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-lg shadow-brand/30"
      animate={{ opacity: resetting ? 0 : 1 }}
      transition={{ duration: RANK_DEMO_RESET_FADE_MS / 1000, ease: 'easeInOut' }}
    >
      <p className="tamil font-heading text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
      <motion.p
        key={stage}
        className="mt-2 font-display text-4xl font-bold tracking-tight"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        Top {display}%
      </motion.p>
      <AnimatePresence mode="wait">
        <motion.p
          key={current.tests}
          className="mt-1.5 font-body text-2xs text-white/60"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          Tests taken: {current.tests}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar chart - this ONE learner's own percentile at each
          milestone (1 / 5 / 15+ tests taken), never a comparison against
          named other students (the app itself only ever shows an anonymous
          aggregate percentile). Bars for milestones already reached stay
          filled; the active milestone's bar grows live with the same count
          driving the big number above; future milestones sit at a low
          baseline until their turn. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        {PERCENTILE_STAGES.map((s, i) => {
          const reached = i <= stage
          const liveValue = i === stage ? 100 - display : 100 - s.percentile
          const heightPct = reached ? scaleBarHeight(liveValue) : BAR_BASELINE_PCT
          return (
            <div key={s.tests} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`font-body text-[10px] font-semibold transition-colors duration-300 ${
                  reached ? 'text-white' : 'text-white/30'
                }`}
              >
                Top {s.percentile}%
              </span>
              <div className="relative h-14 w-full overflow-hidden rounded-md bg-white/10">
                <motion.div
                  className={`absolute bottom-0 left-0 w-full rounded-t-md ${
                    reached ? 'bg-accentwarm' : 'bg-white/20'
                  }`}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: RANK_DEMO_TRANSITION_S, ease: 'easeInOut' }}
                />
              </div>
              <span className="font-body text-[10px] text-white/50">{s.tests}</span>
            </div>
          )
        })}
      </div>
      <p className="tamil mt-1.5 text-center font-body text-[10px] text-white/40">{chartCaption}</p>
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RankBoosterLandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth()
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const { rankBoosterUnlocked, loaded, refresh } = useEntitlementsStore()
  const purchase = useRankBoosterPurchase()

  const [lang, setLang] = useState<Lang>('ta')
  const t = (key: keyof typeof T) => T[key][lang]
  // Global i18n (src/lib/i18n.ts), driven by THIS page's own lang toggle
  // rather than the app's separate language store — used only to pull the
  // shared Rank Booster perk/bonus copy and feed PurchaseConfirmModal, so the
  // promise can never drift from the in-app RankBoosterCard, and the banner
  // never shows a different language than the rest of this page.
  const tGlobal = (key: StringKey) => translate(key, lang)

  useEffect(() => {
    trackViewContent({ contentName: 'RankBoosterLanding', contentCategory: 'landing' })
  }, [])

  useEffect(() => {
    document.title =
      lang === 'ta'
        ? 'TNPSC Group II/IIA Test Series - இப்போதே Enroll ஆகுங்க'
        : 'TNPSC Group II/IIA Test Series - Enroll now'
  }, [lang])

  useEffect(() => {
    if (isAuthenticated && !loaded) refresh()
  }, [isAuthenticated, loaded, refresh])

  // Resume checkout automatically for someone who clicked Enroll as a guest,
  // signed up/in, and got routed straight back here (see postAuthState() in
  // lib/authRouting.ts). Without this they'd land on the page cold and have to
  // tap Enroll a second time right when their intent was highest. Waits for
  // entitlements to load so an already-unlocked visitor doesn't get the modal
  // — matches handleEnrollClick's own eligibility check below. Clears the flag
  // immediately (replace, no state) so back/refresh never re-fires it.
  useEffect(() => {
    if (!isAuthenticated || !loaded) return
    if (!(location.state as { autoEnroll?: boolean } | null)?.autoEnroll) return
    navigate(location.pathname, { replace: true, state: null })
    if (!((isAdmin || isSuperAdmin) || rankBoosterUnlocked)) purchase.startEnroll()
  }, [isAuthenticated, loaded, isAdmin, isSuperAdmin, rankBoosterUnlocked])

  // This page is the Meta ad landing target — most guests here arrive via an
  // in-app browser (Instagram/Facebook), where Google Sign-In can't work at
  // all (Google blocks its own SDK inside any WebView). Rather than let them
  // hit that wall on /login or /register and lose the moment, hand off to
  // Chrome proactively right here, at the highest-intent tap on the page —
  // GoogleSignInButton still has its own reactive fallback for every OTHER
  // page, where most visitors never intend to use Google at all and
  // shouldn't be interrupted by this before even seeing the form.
  const goAuth = (path: '/login' | '/register') => {
    // Chrome is a fresh browser instance — React Router state can't survive
    // the handoff, so the "resume checkout back on /rank-booster after
    // signing in" behaviour (see the autoEnroll effect above and
    // isAutoEnrollPath in authRouting.ts) rides in a query param instead;
    // LoginPage/RegisterPage fall back to reading it when there's no state.
    if (isAndroidWebView) return openInChrome(`${path}?from=/rank-booster`)
    navigate(path, { state: { from: { pathname: '/rank-booster' } } })
  }

  /** The one "Enroll now" handler behind every CTA on this page (hero, price
   *  card, sticky bar). For an eligible signed-in visitor this opens the
   *  pre-payment confirm modal immediately, which opens Razorpay on confirm.
   *  Guests go to signup first (returning here after); staff and
   *  already-enrolled visitors are sent straight into the Test Series
   *  section instead of a purchase flow. */
  const handleEnrollClick = () => {
    if (!isAuthenticated) return goAuth('/register')
    if ((isAdmin || isSuperAdmin) || (loaded && rankBoosterUnlocked)) {
      return navigate('/test-series', { state: { tab: 'rankbooster' } })
    }
    purchase.startEnroll()
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas pb-24 sm:pb-0">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <a href="/" className="group flex shrink-0 items-center gap-2.5">
            <img
              src="/logo-mark.png"
              alt="TNPSC Mentors"
              className="h-9 w-9 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="hidden whitespace-nowrap font-heading text-base font-semibold tracking-tight text-ink sm:inline">
              TNPSC <span className="text-brand">Mentors</span>
            </span>
          </a>

          {/* flex-wrap is a safety net - at very narrow widths this drops to a
              second row instead of clipping, on top of the tighter mobile
              gap/padding below that keeps it on one row for real phones. */}
          <div className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1.5 sm:flex-nowrap sm:gap-x-3">
            <button
              onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-tint px-2 py-1.5 font-heading text-xs font-medium text-ink2 sm:hidden"
              aria-label={lang === 'ta' ? 'Switch to English' : 'தமிழுக்கு மாற்று'}
            >
              <Languages size={13} /> {lang === 'ta' ? 'EN' : 'த'}
            </button>
            <div className="seg-wrap hidden sm:inline-flex" role="group" aria-label="Language">
              <button onClick={() => setLang('ta')} className={`seg ${lang === 'ta' ? 'seg-active' : ''}`} aria-pressed={lang === 'ta'}>
                தமிழ்
              </button>
              <button onClick={() => setLang('en')} className={`seg ${lang === 'en' ? 'seg-active' : ''}`} aria-pressed={lang === 'en'}>
                EN
              </button>
            </div>

            <button
              onClick={toggleTheme}
              className="icon-btn hidden h-9 w-9 transition-transform duration-300 hover:rotate-45 sm:grid"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated ? (
              <a href="/test-arena" className="btn-soft shrink-0 px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm">
                {t('dashboard')}
              </a>
            ) : (
              <>
                <button onClick={() => goAuth('/login')} className="btn-soft shrink-0 px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm">
                  {t('signIn')}
                </button>
                <button onClick={() => goAuth('/register')} className="btn-brand shrink-0 px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm">
                  {t('signUp')}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero (banner on the right, kept above the fold) ──────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-[120px]" />
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-accentwarm/20 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr,1fr] lg:gap-10">
            {/* Left - copy */}
            <div className="text-center lg:text-left">
              <Reveal>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-violet px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
                    <Users size={13} /> {t('vacancies')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-blue px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-sky">
                    <CalendarDays size={13} /> {t('examDate')}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.05}>
                <h1 className="mx-auto mt-4 max-w-xl font-heading text-[1.5rem] font-bold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[1.9rem] sm:leading-[1.22] lg:mx-0 lg:text-[2.1rem] lg:leading-[1.2]">
                  {t('heroTitle')}
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mx-auto mt-3 max-w-xl font-body text-sm leading-relaxed text-ink2 sm:text-base lg:mx-0">
                  {t('heroSub')}
                </p>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <button onClick={handleEnrollClick} className="btn-brand group px-6 py-3 text-sm sm:px-7 sm:py-3.5 sm:text-base">
                    <Rocket size={17} /> {t('ctaEnroll')}
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                  <a
                    href={SCHEDULE_PDF_URL}
                    download="TNPSC-Mentors-Rank-Booster-2026-Schedule.pdf"
                    target="_blank"
                    rel="noopener"
                    className="btn-ghost px-5 py-3 text-sm sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Download size={17} /> {t('ctaSchedulePdf')}
                  </a>
                </div>
              </Reveal>

              {/* Stat strip - moved up into the hero itself (was a separate
                  section below) so it's visible without scrolling. */}
              <Reveal delay={0.2}>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 lg:justify-start">
                  {[
                    { icon: ListChecks, label: t('statTests') },
                    { icon: Trophy, label: t('statBreakdown') },
                    { icon: CalendarDays, label: t('statRevision') },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="tamil inline-flex items-center gap-1.5 font-body text-xs font-semibold text-ink2">
                      <Icon size={14} className="shrink-0 text-brand" /> {label}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right - the banner: price/bonus buy-box. This is THE
                conversion element, so it owns the right column outright. */}
            <Reveal delay={0.1}>
              <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
                <div className="card relative z-10 overflow-hidden p-6 shadow-card ring-1 ring-gold/25">
                  <div className="tamil -mx-6 -mt-6 mb-4 flex items-center justify-center gap-1.5 bg-gradient-to-r from-accentwarm to-gold py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-white">
                    <Rocket size={13} /> {tGlobal('rankBoosterOfferBadge')}
                  </div>

                  <div className="flex items-baseline justify-center gap-2.5">
                    <span className="font-body text-base text-ink2 line-through">₹{RANK_BOOSTER_MRP_RUPEES}</span>
                    <span className="font-display text-3xl font-bold tracking-tight text-ink">₹{RANK_BOOSTER_PRICE_RUPEES}</span>
                  </div>

                  <div className="mt-4 rounded-field border border-gold/25 bg-goldsoft/60 p-3">
                    <p className="tamil flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-gold">
                      <Gift size={13} /> {tGlobal('vettriBonusTitle')}
                    </p>
                    <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                      {[...RANK_BOOSTER_PERK_KEYS, ...RANK_BOOSTER_BONUS_KEYS].map((k) => (
                        <li key={k} className="flex items-start gap-1.5 font-body text-2xs leading-snug text-ink">
                          <Check size={11} className="mt-0.5 shrink-0 text-gold" />
                          <span className="tamil">{tGlobal(k)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="tamil mt-3 flex items-center justify-center gap-1.5 text-center font-body text-2xs font-semibold text-accentwarm">
                    <AlertCircle size={12} className="shrink-0" /> {t('validTill')}
                  </p>

                  <button onClick={handleEnrollClick} className="btn-brand group mt-4 w-full justify-center px-6 py-3 text-sm">
                    <Rocket size={16} /> {t('ctaEnroll')}
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Full schedule ────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="tamil font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                {t('scheduleTitle')}
              </h2>
              <p className="tamil mx-auto mt-3 font-body text-base leading-relaxed text-ink2">
                {t('scheduleSub')}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-8 overflow-x-auto rounded-card border border-line">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="bg-tint">
                    <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colTest')}</th>
                    <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colDate')}</th>
                    <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colType')}</th>
                    <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colDetails')}</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.map((row) => (
                    <tr key={row.no} className="border-t border-line">
                      <td className="px-4 py-3 font-heading text-sm font-bold text-ink">{row.no}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-ink2">{row.date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-heading text-xs font-semibold ${KIND_BADGE[row.kind]}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm leading-relaxed text-ink2">{row.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-5 flex flex-col items-center gap-3 text-center">
              <p className="tamil font-body text-xs text-ink2/80">{t('scheduleNote')}</p>
              <a
                href={SCHEDULE_PDF_URL}
                download="TNPSC-Mentors-Rank-Booster-2026-Schedule.pdf"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-brand underline decoration-brand/40 underline-offset-2 transition hover:decoration-brand"
              >
                <Download size={14} /> {t('downloadPdf')}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 className="tamil mx-auto max-w-2xl text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            {t('featuresTitle')}
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, ...card }, i) => {
            const tint = TINTS[i % TINTS.length]
            return (
              <Reveal key={card.en.t} delay={i * 0.05}>
                <div className="card interactive group h-full p-6">
                  <span className={`grid h-12 w-12 place-items-center rounded-tile ${tint.bg} ${tint.fg} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
                    <Icon size={22} />
                  </span>
                  <h3 className="tamil mt-5 font-heading text-lg font-semibold text-ink">{card[lang].t}</h3>
                  <p className="tamil mt-2 font-body text-sm leading-relaxed text-ink2">{card[lang].d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ─── Track your rank ──────────────────────────────────────────────
          Real feature, not a promise: GET /api/profile/percentile (backed by
          the user_percentile() SQL function) already powers the "Top X%"
          stat shown on ResultPage after every test and on InsightsPage - it's
          an average-score percentile across all completed tests, not a named
          leaderboard. Reuses the app's own `yourRank` i18n label so the
          wording matches exactly what a buyer will see post-purchase. */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:gap-14">
            <Reveal delay={0.1}>
              <div className="order-1 card mx-auto w-full max-w-sm overflow-hidden p-6 text-center shadow-card lg:order-2">
                <PercentileDemoCard label={tGlobal('yourRank')} chartCaption={t('rankTrackChartCaption')} />
                <p className="tamil mt-4 font-body text-xs text-ink2">{t('rankTrackSample')}</p>
              </div>
            </Reveal>

            <Reveal>
              <div className="order-2 lg:order-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-coral px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-accent">
                  <TrendingUp size={13} /> {tGlobal('stateLevelAnalytics')}
                </span>
                <h2 className="tamil mt-4 font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                  {t('rankTrackTitle')}
                </h2>
                <p className="tamil mt-3 font-body text-base leading-relaxed text-ink2">
                  {t('rankTrackBody')}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[t('rankTrackPoint1'), t('rankTrackPoint2')].map((point) => (
                    <li key={point} className="tamil flex items-start gap-2.5 font-body text-sm text-ink">
                      <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-tint-coral text-accent">
                        <Check size={12} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── All plans ────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-card">
        <div className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="tamil font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                {t('allPlansTitle')}
              </h2>
              <p className="tamil mt-3 font-body text-base leading-relaxed text-ink2">{t('allPlansSub')}</p>
            </div>
          </Reveal>
          <div className="mt-10">
            <PricingCards lang={lang} webAppHref={isAuthenticated ? '/test-arena' : '/register'} />
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-tint-violet px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
                <Sparkles size={13} /> {t('faqEyebrow')}
              </span>
              <h2 className="tamil mt-4 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {t('faqTitle')}
              </h2>
            </div>
          </Reveal>
          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => (
              <Reveal key={f.en.q} delay={i * 0.05}>
                <div className="card p-5">
                  <p className="tamil font-heading text-base font-semibold text-ink">{f[lang].q}</p>
                  <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">{f[lang].a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-sm">
              <a href="/" className="flex items-center gap-2.5">
                <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
                <span className="font-heading text-sm font-semibold text-ink">
                  TNPSC <span className="text-brand">Mentors</span>
                </span>
              </a>
              <p className="tamil mt-3 font-body text-sm leading-relaxed text-ink2">{t('footerTagline')}</p>
            </div>

            <div className="flex flex-col gap-3 font-body text-sm">
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-ink2">
                {t('footerSupport')}
              </span>
              <a href={`https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`} className="inline-flex items-center gap-2 text-ink transition hover:text-brand-dark">
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-ink transition hover:text-brand-dark">
                <Mail size={15} /> {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="flex flex-col gap-3 font-body text-sm">
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-ink2">
                {t('footerLegal')}
              </span>
              <a href="/privacy" className="text-ink transition hover:text-brand-dark">{t('footerPrivacy')}</a>
              <a href="/payment-policy" className="text-ink transition hover:text-brand-dark">{t('footerPayment')}</a>
              <a href="/refund-policy" className="text-ink transition hover:text-brand-dark">{t('footerRefund')}</a>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 font-body text-xs text-ink2 sm:flex-row sm:items-center sm:justify-between">
            <p className="tamil">© 2026 TNPSC Mentors · {t('footerDisclaimer')}</p>
          </div>
        </div>
      </footer>

      {/* ─── Sticky mobile CTA bar ────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:hidden">
        <div>
          <span className="font-body text-xs text-ink2 line-through">₹{RANK_BOOSTER_MRP_RUPEES}</span>
          <span className="ml-1.5 font-display text-lg font-bold text-ink">₹{RANK_BOOSTER_PRICE_RUPEES}</span>
        </div>
        <button onClick={handleEnrollClick} className="btn-brand px-5 py-2.5 text-sm">
          <Rocket size={15} /> {t('ctaEnroll')}
        </button>
      </div>

      {/* Pre-payment recap - opened directly by every "Enroll now" CTA above
          for an eligible signed-in visitor; confirming here opens Razorpay
          (via purchase.handleBuy), no extra scroll or nested click needed. */}
      <PurchaseConfirmModal
        open={purchase.confirmOpen}
        planName={tGlobal('rankBoosterTitle')}
        validity={tGlobal('rankBoosterValidity')}
        perks={[...RANK_BOOSTER_PERK_KEYS, ...RANK_BOOSTER_BONUS_KEYS].map((k) => tGlobal(k))}
        priceLabel={purchase.isFree ? tGlobal('premiumFree') : `₹${rupees(purchase.finalPaise)}`}
        strikePrice={purchase.isFree ? undefined : `₹${RANK_BOOSTER_MRP_RUPEES}`}
        note={tGlobal('rankBoosterOfferNote')}
        isFree={purchase.isFree}
        accent="gold"
        busy={purchase.paying}
        onConfirm={purchase.handleBuy}
        onCancel={() => purchase.setConfirmOpen(false)}
      />
    </div>
  )
}
