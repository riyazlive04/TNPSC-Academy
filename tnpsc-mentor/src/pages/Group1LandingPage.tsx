import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  Sparkles,
  TrendingUp,
  Sun,
  Moon,
  Languages,
  MessageCircle,
  Mail,
  Gift,
  BookOpen,
  Globe,
  Layers,
  Timer,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useThemeStore } from '../store/themeStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { useVettriPurchase } from '../hooks/useVettriPurchase'
import {
  useMockPackPurchase,
  MOCK_PACK_PRICE_RUPEES,
} from '../hooks/useMockPackPurchase'
import {
  VETTRI_PRICE_RUPEES,
  VETTRI_MONTH_RUPEES,
  VETTRI_PERK_KEYS,
  VETTRI_BONUS_KEYS,
} from '../components/UI/VettriCard'
import PurchaseConfirmModal from '../components/UI/PurchaseConfirmModal'
import PricingCards, { MOCK_ITEMS, MOCK_PACK_LABELS } from '../components/Landing/PricingCards'
import Reveal from '../components/Landing/Reveal'
import PercentileDemoCard from '../components/Landing/PercentileDemoCard'
import { usePlanSales } from '../hooks/usePlanSales'
import { translate, type StringKey } from '../lib/i18n'
import { trackViewContent } from '../lib/tracking'
import { GROUP1_SERIES_BUY_PATHS, GROUP1_MOCK_BUY_PATHS } from '../lib/authRouting'
import { isAndroidWebView, openInBrowser } from '../lib/webview'

type Lang = 'ta' | 'en'

const SCHEDULE_PDF_URL = '/test-marathon-2026-schedule.pdf'
const SCHEDULE_PDF_NAME = 'TNPSC-Mentors-Test-Marathon-2026-Schedule.pdf'
const SUPPORT_EMAIL = 'support@tnpscmentors.in'
const SUPPORT_PHONE = '+91 96777 79808'

// Total across the 13 papers (10 x 100 + 3 x 200), matching the official flyer.
const TOTAL_QUESTIONS = 1600
const SERIES_TEST_COUNT = 13
const MOCK_PACK_TEST_COUNT = 6

// Same semantic tint system as the other landing pages (design-system.md):
// violet = core, coral = key numbers, blue = practice, green = included/free.
const TINTS = [
  { bg: 'bg-tint-violet', fg: 'text-brand' },
  { bg: 'bg-tint-coral', fg: 'text-accent' },
  { bg: 'bg-tint-blue', fg: 'text-sky' },
  { bg: 'bg-tint-green', fg: 'text-correct' },
] as const

// ─── Bilingual copy ──────────────────────────────────────────────────────────
const T = {
  signIn: { ta: 'உள்நுழைய', en: 'Sign in' },
  signUp: { ta: 'பதிவு செய்', en: 'Sign up' },
  dashboard: { ta: 'Dashboard', en: 'Dashboard' },

  // Hero
  heroBadgeTests: {
    ta: `${SERIES_TEST_COUNT} தேர்வுகள் · ${TOTAL_QUESTIONS} வினாக்கள்`,
    en: `${SERIES_TEST_COUNT} tests · ${TOTAL_QUESTIONS} questions`,
  },
  heroBadgeFree: { ta: 'தேர்வு 1 இலவசம்', en: 'Test 1 free' },
  heroTitle: {
    ta: 'TNPSC குரூப் 1 தேர்வுத் தொடர் & மாதிரித் தேர்வுகள் 2026',
    en: 'TNPSC Group 1 Test Series & Mock Tests 2026',
  },
  heroSub: {
    ta: 'குரூப் 1-க்கு இரண்டு வழிகள்: அலகு வாரியாக திட்டமிடப்பட்ட 13-தேர்வு Test Marathon, அல்லது 6 முழு நீள மாதிரித் தேர்வுகள் மட்டும். இரண்டுமே real exam pattern-ல், இருமொழி விளக்கங்களுடன்.',
    en: 'Two ways to prepare for Group 1: the 13-test Test Marathon on a unit-by-unit schedule, or the 6 full-length mock papers on their own. Both in the real exam pattern, with bilingual explanations.',
  },
  ctaEnroll: { ta: 'இப்போதே Enroll ஆகுங்க', en: 'Enroll now' },
  ctaSchedulePdf: { ta: 'முழு அட்டவணை (PDF)', en: 'Full schedule (PDF)' },
  ctaSeeMock: { ta: 'மாதிரித் தேர்வுத் தொகுப்பு', en: 'See the Mock Pack' },

  statTests: {
    ta: `${SERIES_TEST_COUNT} தேர்வுகள் (10 அலகு + 3 முழு மாதிரி)`,
    en: `${SERIES_TEST_COUNT} tests (10 unit-wise + 3 full mock)`,
  },
  statQuestions: { ta: `${TOTAL_QUESTIONS} வினாக்கள்`, en: `${TOTAL_QUESTIONS} questions` },
  statBilingual: { ta: 'ஒவ்வொரு வினாவுக்கும் இருமொழி விளக்கம்', en: 'Bilingual explanation for every question' },

  // Hero buy-box (Test Series)
  boxBadge: { ta: 'குரூப் 1 தேர்வுத் தொடர்', en: 'Group 1 Test Series' },
  boxOneTime: { ta: 'ஒரே முறை கட்டணம் · 2 மாத அணுகல்', en: 'One-time payment · 2-month access' },
  boxOr: { ta: 'அல்லது தவணை முறையில்', en: 'or pay in installments' },
  boxInstallment: {
    ta: `₹${VETTRI_MONTH_RUPEES} × 2 மாதம் — முதல் மாதத்திற்கு ₹${VETTRI_MONTH_RUPEES} செலுத்தி இப்போதே தொடங்குங்க`,
    en: `₹${VETTRI_MONTH_RUPEES} × 2 months — start now by paying ₹${VETTRI_MONTH_RUPEES} for the first month`,
  },
  boxInstallmentCta: { ta: `₹${VETTRI_MONTH_RUPEES}-ல் தொடங்கு`, en: `Start at ₹${VETTRI_MONTH_RUPEES}` },
  boxOwned: { ta: 'நீங்கள் ஏற்கனவே சேர்ந்துவிட்டீர்கள்', en: "You're already enrolled" },
  boxOwnedCta: { ta: 'தேர்வுகளைப் பார்க்க', en: 'Open the test series' },

  // Plans section
  plansTitle: { ta: 'உங்களுக்கு எது சரி?', en: 'Which one is right for you?' },
  plansSub: {
    ta: 'இரண்டு குரூப் 1 தொகுப்புகள் — திட்டமிட்ட முழு தேர்வுத் தொடர், அல்லது மாதிரித் தேர்வுகள் மட்டும். இரண்டையும் ஒப்பிட்டுப் பாருங்க.',
    en: 'Two Group 1 packs — the full scheduled test series, or the mock papers on their own. Compare them side by side.',
  },
  planSeriesTitle: { ta: 'குரூப் 1 தேர்வுத் தொடர்', en: 'Group 1 Test Series' },
  planSeriesTag: { ta: 'Test Marathon 2026 · முழுத் தயாரிப்பு', en: 'Test Marathon 2026 · complete prep' },
  planSeriesFor: {
    ta: 'யாருக்கு: அலகு வாரியாக முழு syllabus-ஐயும் திட்டமிட்டு முடிக்க விரும்புபவர்களுக்கு.',
    en: 'For: aspirants who want to cover the whole syllabus unit by unit, on a plan.',
  },
  planMockTag: { ta: 'மாதிரித் தேர்வுகள் மட்டும்', en: 'Mock papers only' },
  planMockFor: {
    ta: 'யாருக்கு: syllabus-ஐ ஏற்கனவே படித்து முடித்து, முழு நீளத் தேர்வுகளால் மட்டும் தன்னை சோதிக்க விரும்புபவர்களுக்கு.',
    en: 'For: aspirants who have already covered the syllabus and just want full-length papers to test themselves.',
  },
  recommended: { ta: 'பரிந்துரைக்கப்படுகிறது', en: 'Recommended' },
  popularNote: {
    ta: 'இதில் மாதிரித் தேர்வுகளும் அடங்கும்',
    en: 'Includes full mock papers too',
  },

  // Schedule
  scheduleTitle: { ta: 'முழு தேர்வு அட்டவணை', en: 'Full test schedule' },
  scheduleSub: {
    ta: 'அலகு வாரியாக 10 தேர்வுகள், அதன் பிறகு 3 முழு நீள மாதிரித் தேர்வுகள் — படித்ததை உடனுக்குடன் சோதிக்கும் வரிசையில்.',
    en: '10 unit-wise tests, then 3 full-length mocks - ordered so each test lands right after the unit you just revised.',
  },
  scheduleAllOpen: {
    ta: 'அனைத்து தேர்வுகளின் வெளியீட்டு தேதியும் முடிந்துவிட்டது — Enroll ஆனவுடன் 13 தேர்வுகளும் உடனே திறக்கப்படும்.',
    en: `Every release date below has passed, so all ${SERIES_TEST_COUNT} papers open the moment you enroll.`,
  },
  scheduleNote: {
    ta: 'பாடங்களின் பெயர்கள் official TNPSC syllabus terms-ஐ பின்பற்றி English-லேயே காட்டப்பட்டுள்ளன.',
    en: 'Subject names are shown in English to match the official TNPSC syllabus terms.',
  },
  downloadPdf: { ta: 'PDF பதிவிறக்க', en: 'Download the PDF' },
  colTest: { ta: 'எண்', en: 'Test' },
  colUnit: { ta: 'அலகு', en: 'Unit' },
  colSubject: { ta: 'Subject', en: 'Subject' },
  colQuestions: { ta: 'வினாக்கள்', en: 'Questions' },
  colDate: { ta: 'வெளியீடு', en: 'Released' },
  freeTag: { ta: 'இலவசம்', en: 'Free' },

  // Features
  featuresTitle: { ta: 'இந்த தொடரில் என்ன கிடைக்கும்', en: 'What you get in this series' },

  // Vault / extra value
  vaultEyebrow: { ta: 'கூடுதல் மதிப்பு', en: 'Extra value' },
  vaultTitle: {
    ta: 'Enroll ஆனவர்களுக்கு தேர்வுத் தொடருடன் சேர்ந்து',
    en: 'Included with the test series, at no extra cost',
  },
  vaultSub: {
    ta: 'தேர்வுத் தொடர் மட்டுமல்ல — உங்க 2 மாத அணுகலில் PYQ மற்றும் நடப்பு நிகழ்வு vault-களும் வரம்பின்றித் திறக்கப்படும்.',
    en: 'Not just the papers - your 2-month access also opens the PYQ and Current Affairs vaults, with no credit deductions.',
  },

  // Track your rank
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
    ta: 'குரூப் 1 மட்டுமல்லாமல், TNPSC Mentors-ல் கிடைக்கும் மற்ற தேர்வுத் தொகுப்புகளையும் பாருங்கள்.',
    en: 'Beyond Group 1, see the other test series and plans TNPSC Mentors offers.',
  },

  faqEyebrow: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'Frequently asked questions' },

  footerTagline: {
    ta: 'TNPSC குரூப் 1 Prelims-க்கான தேர்வுத் தொடர் மற்றும் மாதிரித் தேர்வுகள்.',
    en: 'The Test Series and Mock Tests for TNPSC Group 1 Prelims.',
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

  // Pay-link price banners. Shown at the top of the two dedicated Group 1 pay
  // links, so a buyer arriving from an ad or a WhatsApp forward sees what it
  // is, what it costs and how to buy it before scrolling at all.
  bannerSeriesEyebrow: { ta: 'குரூப் 1 தேர்வுத் தொடர் 2026', en: 'Group 1 Test Series 2026' },
  bannerSeriesTitle: {
    ta: `${SERIES_TEST_COUNT} தேர்வுகளும் ${TOTAL_QUESTIONS} வினாக்களும்`,
    en: `All ${SERIES_TEST_COUNT} tests, ${TOTAL_QUESTIONS} questions`,
  },
  bannerMockEyebrow: { ta: 'குரூப் 1 மாதிரித் தேர்வுத் தொகுப்பு', en: 'Group 1 Mock Test Pack' },
  bannerMockTitle: {
    ta: `${MOCK_PACK_TEST_COUNT} முழு நீள மாதிரித் தேர்வுகள் (தலா 200 வினாக்கள்)`,
    en: `${MOCK_PACK_TEST_COUNT} full-length mock papers, 200 questions each`,
  },
  bannerMockValidity: { ta: '80 நாள் அணுகல் · ஒரே முறை கட்டணம்', en: '80-day access · one-time payment' },
  bannerOwned: { ta: 'இது ஏற்கனவே உங்களுக்கு உண்டு', en: 'You already have this' },
  bannerOwnedCta: { ta: 'தேர்வுகளைப் பார்க்க', en: 'Open the tests' },
} as const

// ─── Feature cards ───────────────────────────────────────────────────────────
const FEATURES: {
  icon: typeof FileText
  ta: { t: string; d: string }
  en: { t: string; d: string }
}[] = [
  {
    icon: CalendarDays,
    ta: {
      t: 'திட்டமிட்ட 13 தேர்வுகள்',
      d: 'அலகு வாரியாக 10 தேர்வுகள் + 3 முழு நீள மாதிரித் தேர்வுகள் — syllabus-ஐ ஒரு வரிசையில் முடிக்கும்படி.',
    },
    en: {
      t: '13 scheduled tests',
      d: '10 unit-wise tests plus 3 full-length mocks, sequenced to take you through the syllabus in order.',
    },
  },
  {
    icon: Download,
    ta: {
      t: 'விளக்கத்துடன் PDF',
      d: 'ஒவ்வொரு தேர்வுக்கும் விளக்கங்கள் PDF ஆக — பதிவிறக்கி, offline-ல் திருப்பிப் படிக்கலாம்.',
    },
    en: {
      t: 'Explanation PDF',
      d: 'A downloadable explanation PDF for every test, so you can review and revise offline.',
    },
  },
  {
    icon: Globe,
    ta: {
      t: 'இருமொழி விளக்கங்கள்',
      d: 'ஒவ்வொரு வினாவின் விளக்கமும் தமிழிலும் ஆங்கிலத்திலும் — உங்களுக்கு வசதியான மொழியில் படிக்கலாம்.',
    },
    en: {
      t: 'Bilingual explanations',
      d: 'Every explanation in both Tamil and English, so you can read it in whichever language you think in.',
    },
  },
  {
    icon: Timer,
    ta: {
      t: 'உண்மையான தேர்வு சூழல்',
      d: 'நேரக் கட்டுப்பாடு, OMR பாணி இடைமுகம், முடிந்தவுடன் செயல்திறன் பகுப்பாய்வு.',
    },
    en: {
      t: 'Real test-style environment',
      d: 'Timed papers, an exam-like OMR interface, and performance analytics the moment you submit.',
    },
  },
]

// The vaults a Test Series enrollment opens for the two-month access period.
// Years follow the official 2026 flyer for this series.
const VAULTS: {
  icon: typeof FileText
  ta: { t: string; d: string }
  en: { t: string; d: string }
}[] = [
  {
    icon: FileText,
    ta: { t: 'குரூப் 1 PYQ vault', d: '2019, 2021, 2022, 2024, 2025 — முந்தைய ஆண்டு வினாத்தாள்கள், விளக்கங்களுடன்.' },
    en: { t: 'Group 1 PYQ vault', d: '2019, 2021, 2022, 2024, 2025 previous-year papers, with explanations.' },
  },
  {
    icon: BookOpen,
    ta: { t: 'குரூப் 2 PYQ vault', d: '2014, 2016, 2017, 2018, 2022, 2024, 2025 — கூடுதல் பயிற்சிக்கு.' },
    en: { t: 'Group 2 PYQ vault', d: '2014, 2016, 2017, 2018, 2022, 2024, 2025 papers, for extra practice.' },
  },
  {
    icon: Newspaper,
    ta: { t: 'நடப்பு நிகழ்வு vault', d: 'கடந்த 10 மாதங்கள் · 1200 வினாக்கள் — மாதம் மற்றும் தலைப்பு வாரியாக.' },
    en: { t: 'Current Affairs vault', d: 'The last 10 months · 1,200 questions, month-wise and topic-wise.' },
  },
  {
    icon: Layers,
    ta: { t: 'பாட வாரியான வங்கி', d: '3000+ பாட வாரியான வினாக்கள் — வரம்பின்றி, கிரெடிட் கழிக்கப்படாது.' },
    en: { t: 'Subject-wise bank', d: '3,000+ subject-wise questions, unlimited and with no credits deducted.' },
  },
]

const FAQS: { ta: { q: string; a: string }; en: { q: string; a: string } }[] = [
  {
    ta: {
      q: 'தேர்வுத் தொடருக்கும் மாதிரித் தேர்வுத் தொகுப்புக்கும் என்ன வித்தியாசம்?',
      a: `தேர்வுத் தொடர் = ${SERIES_TEST_COUNT} தேர்வுகள் (10 அலகு வாரியான + 3 முழு மாதிரி), PYQ & நடப்பு நிகழ்வு vault-களுடன், 2 மாத அணுகல். மாதிரித் தொகுப்பு = ${MOCK_PACK_TEST_COUNT} முழு நீள மாதிரித் தேர்வுகள் மட்டும், 80 நாள் அணுகல், ₹${MOCK_PACK_PRICE_RUPEES}.`,
    },
    en: {
      q: "What's the difference between the Test Series and the Mock Test Pack?",
      a: `The Test Series is ${SERIES_TEST_COUNT} papers (10 unit-wise + 3 full mocks) plus the PYQ and Current Affairs vaults, for 2 months. The Mock Test Pack is just the ${MOCK_PACK_TEST_COUNT} full-length mock papers, for 80 days, at ₹${MOCK_PACK_PRICE_RUPEES}.`,
    },
  },
  {
    ta: {
      q: 'சேருவதற்கு முன் முயற்சித்துப் பார்க்கலாமா?',
      a: 'ஆம். தேர்வுத் தொடரின் தேர்வு 1 (100 வினாக்கள், அலகு I & II) அனைவருக்கும் முற்றிலும் இலவசம்.',
    },
    en: {
      q: 'Can I try before I enroll?',
      a: 'Yes. Test 1 of the series (100 questions, Units I & II) is completely free for every aspirant.',
    },
  },
  {
    ta: {
      q: 'தவணை முறையில் கட்டலாமா?',
      a: `ஆம். முழுத் தொகை ₹${VETTRI_PRICE_RUPEES} ஒரே முறை, அல்லது மாதம் ₹${VETTRI_MONTH_RUPEES} வீதம் — ₹${VETTRI_MONTH_RUPEES} முதல் மாதத்தை மட்டும் உள்ளடக்கும், இரண்டாவது மாதத்திற்கு மீண்டும் ₹${VETTRI_MONTH_RUPEES} செலுத்த வேண்டும்.`,
    },
    en: {
      q: 'Can I pay in installments?',
      a: `Yes. Either ₹${VETTRI_PRICE_RUPEES} once, or ₹${VETTRI_MONTH_RUPEES} per month - ₹${VETTRI_MONTH_RUPEES} covers only the first month of this two-month program, so pay ₹${VETTRI_MONTH_RUPEES} again for the second.`,
    },
  },
  {
    ta: { q: 'பணம் கட்ட எப்படி?', a: 'App-க்குள்ள UPI அல்லது card மூலமா, Razorpay-ல் பாதுகாப்பா.' },
    en: { q: 'How do I pay?', a: 'Inside the app via UPI or card, securely through Razorpay.' },
  },
  {
    ta: {
      q: 'எவ்வளவு காலம் அணுகலாம்?',
      a: `தேர்வுத் தொடர்: 2 மாதங்கள். மாதிரித் தேர்வுத் தொகுப்பு: 80 நாட்கள். இரண்டுமே purchase பண்ணின நாளிலிருந்து.`,
    },
    en: {
      q: 'How long do I get access?',
      a: 'Test Series: 2 months. Mock Test Pack: 80 days. Both counted from the date of purchase.',
    },
  },
  {
    ta: { q: 'Refund கிடைக்குமா?', a: 'எங்க return & cancellation கொள்கையை கீழே பாருங்க.' },
    en: { q: 'Is this refundable?', a: 'See our return & cancellation policy in the footer below.' },
  },
]

/**
 * The 13-paper Group 1 Test Marathon 2026, transcribed from the official
 * flyer (public/test-marathon-2026-schedule.pdf). Subject/syllabus names are
 * kept in English exactly as the flyer has them, since that is how TNPSC
 * aspirants recognise and search for them in either UI language.
 *
 * `date` is the paper's RELEASE date in ISO form rather than a display string,
 * so the page can tell the reader whether a paper is already open instead of
 * printing a timetable and leaving them to work it out.
 */
const SCHEDULE: {
  no: number
  unit: { ta: string; en: string }
  kind: 'unit' | 'mock'
  subject: string
  questions: number
  date: string
  free?: true
}[] = [
  {
    no: 1,
    unit: { ta: 'அலகு I & II', en: 'Unit I & II' },
    kind: 'unit',
    subject: 'General Science + Science and Technology (45) · Geography (30) · Aptitude - Simplification (25)',
    questions: 100,
    date: '2026-07-09',
    free: true,
  },
  {
    no: 2,
    unit: { ta: 'அலகு III', en: 'Unit III' },
    kind: 'unit',
    subject: 'History, Culture of India, and Indian National Movement (75) · Aptitude - Percentage, LCM, HCF (25)',
    questions: 100,
    date: '2026-07-14',
  },
  {
    no: 3,
    unit: { ta: 'அலகு IV', en: 'Unit IV' },
    kind: 'unit',
    subject: 'Indian Polity (75) · Aptitude - Ratio and Proportion, Time and Work (25)',
    questions: 100,
    date: '2026-07-19',
  },
  {
    no: 4,
    unit: { ta: 'அலகு V', en: 'Unit V' },
    kind: 'unit',
    subject: 'Indian Economy and Development Administration in Tamil Nadu',
    questions: 100,
    date: '2026-07-24',
  },
  {
    no: 5,
    unit: { ta: 'அலகு VI', en: 'Unit VI' },
    kind: 'unit',
    subject: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    questions: 100,
    date: '2026-07-29',
  },
  {
    no: 6,
    unit: { ta: 'அலகு I & II', en: 'Unit I & II' },
    kind: 'unit',
    subject: 'General Science + Science and Technology (45) · Geography (30) · Aptitude - Simple Interest, Compound Interest (25)',
    questions: 100,
    date: '2026-08-02',
  },
  {
    no: 7,
    unit: { ta: 'அலகு III', en: 'Unit III' },
    kind: 'unit',
    subject: 'History, Culture of India, and Indian National Movement (75) · Aptitude - Area and Volume (25)',
    questions: 100,
    date: '2026-08-06',
  },
  {
    no: 8,
    unit: { ta: 'அலகு IV', en: 'Unit IV' },
    kind: 'unit',
    subject: 'Indian Polity (75) · Aptitude - Reasoning (25)',
    questions: 100,
    date: '2026-08-10',
  },
  {
    no: 9,
    unit: { ta: 'அலகு V', en: 'Unit V' },
    kind: 'unit',
    subject: 'Indian Economy and Development Administration in Tamil Nadu',
    questions: 100,
    date: '2026-08-14',
  },
  {
    no: 10,
    unit: { ta: 'அலகு VI', en: 'Unit VI' },
    kind: 'unit',
    subject: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    questions: 100,
    date: '2026-08-18',
  },
  {
    no: 11,
    unit: { ta: 'முழு மாதிரி', en: 'Full Mock' },
    kind: 'mock',
    subject: 'Full Syllabus',
    questions: 200,
    date: '2026-08-23',
  },
  {
    no: 12,
    unit: { ta: 'முழு மாதிரி', en: 'Full Mock' },
    kind: 'mock',
    subject: 'Full Syllabus',
    questions: 200,
    date: '2026-08-27',
  },
  {
    no: 13,
    unit: { ta: 'முழு மாதிரி', en: 'Full Mock' },
    kind: 'mock',
    subject: 'Full Syllabus',
    questions: 200,
    date: '2026-08-31',
  },
]

const KIND_BADGE: Record<'unit' | 'mock', string> = {
  unit: 'bg-tint-violet text-brand',
  mock: 'bg-accentwarmsoft text-accentwarm',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "2026-07-09" → "09 Jul 2026", the same shape the Group II/IIA schedule uses. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Group1LandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth()
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const { unlimited, mockPack, loaded, refresh } = useEntitlementsStore()
  const series = useVettriPurchase()
  const mock = useMockPackPurchase()
  // Whether each plan is still being sold (superadmin Payments tab). Off, the
  // CTAs must not open a checkout the server would refuse with a 403 — see the
  // two click handlers below.
  const sales = usePlanSales()

  const [lang, setLang] = useState<Lang>('ta')
  const t = (key: keyof typeof T) => T[key][lang]
  // Global i18n (src/lib/i18n.ts) driven by THIS page's own toggle rather than
  // the app's language store — used to pull the shared Vettri perk/bonus copy
  // and feed PurchaseConfirmModal, so the promise here can never drift from
  // the in-app VettriCard.
  const tGlobal = (key: StringKey) => translate(key, lang)

  // This page doubles as two shareable pay links: the ₹1,899 Test Series and
  // the ₹399 Mock Pack. On either, that offer's price banner leads the page
  // and its confirm sheet opens on arrival; on /group-1 itself neither does,
  // and the hero's own buy-box carries the pitch.
  const isSeriesPayLink = (GROUP1_SERIES_BUY_PATHS as readonly string[]).includes(location.pathname)
  const isMockPayLink = (GROUP1_MOCK_BUY_PATHS as readonly string[]).includes(location.pathname)
  const isPayLink = isSeriesPayLink || isMockPayLink

  useEffect(() => {
    trackViewContent({
      contentName: isSeriesPayLink
        ? 'Group1TestSeriesPayLink'
        : isMockPayLink
          ? 'Group1MockPackPayLink'
          : 'Group1Landing',
      contentCategory: 'landing',
    })
  }, [isSeriesPayLink, isMockPayLink])

  useEffect(() => {
    document.title = isMockPayLink
      ? lang === 'ta'
        ? `TNPSC குரூப் 1 மாதிரித் தேர்வுகள் - ₹${MOCK_PACK_PRICE_RUPEES}`
        : `TNPSC Group 1 Mock Test Pack - ₹${MOCK_PACK_PRICE_RUPEES}`
      : isSeriesPayLink
        ? lang === 'ta'
          ? `TNPSC குரூப் 1 தேர்வுத் தொடர் 2026 - ₹${VETTRI_PRICE_RUPEES}`
          : `TNPSC Group 1 Test Series 2026 - ₹${VETTRI_PRICE_RUPEES}`
        : lang === 'ta'
          ? 'TNPSC குரூப் 1 தேர்வுத் தொடர் & மாதிரித் தேர்வுகள்'
          : 'TNPSC Group 1 Test Series & Mock Tests'
  }, [lang, isSeriesPayLink, isMockPayLink])

  useEffect(() => {
    if (isAuthenticated && !loaded) refresh()
  }, [isAuthenticated, loaded, refresh])

  /** Staff and existing owners, for whom every CTA is a way INTO the product
   *  rather than a purchase. One definition each, so a button and what it does
   *  can never disagree. */
  const ownsSeries = isAdmin || isSuperAdmin || (loaded && unlimited)
  const ownsMockPack = isAdmin || isSuperAdmin || (loaded && mockPack)

  // Resume checkout automatically for someone who tapped a buy CTA as a guest,
  // signed up, and got routed straight back here (postAuthState() in
  // lib/authRouting.ts). Without this they'd land cold and have to tap again
  // right when their intent was highest. Waits for entitlements so an owner
  // never gets a sheet for what they already have. Clears the flag immediately
  // (replace, no state) so back/refresh never re-fires it.
  useEffect(() => {
    if (!isAuthenticated || !loaded) return
    if (!(location.state as { autoEnroll?: boolean } | null)?.autoEnroll) return
    navigate(location.pathname, { replace: true, state: null })
    // The mock pay route's resume belongs to the Mock Pack — firing the series
    // checkout there would put the wrong product in front of someone who
    // signed up specifically to buy the other one.
    if (isMockPayLink) {
      if (sales.mockPack && !ownsMockPack) mock.startEnroll()
      return
    }
    if (sales.vettri && !ownsSeries) series.startEnroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loaded, ownsSeries, ownsMockPack, sales.vettri, sales.mockPack, isMockPayLink])

  // Arriving cold on either pay link opens that offer's confirm sheet straight
  // away: someone handed a payment link has already decided what they came
  // for, and making them hunt for a button on a long page loses that. Fires
  // once per arrival (the ref latch), and only when the purchase is actually
  // available — an owner, a staff account or a withdrawn plan gets the page
  // with its banner and no sheet. Guests get the page too: the banner CTA
  // sends them to signup, which routes them back here with autoEnroll set.
  const sheetOpened = useRef(false)
  useEffect(() => {
    if (!isPayLink || !isAuthenticated || !loaded) return
    if (sheetOpened.current) return
    if (isMockPayLink) {
      if (ownsMockPack || !sales.mockPack) return
      sheetOpened.current = true
      mock.startEnroll()
      return
    }
    if (ownsSeries || !sales.vettri) return
    sheetOpened.current = true
    series.startEnroll()
    // startEnroll is rebuilt every render, so it is deliberately not a dep —
    // depending on it would reopen the sheet each time the buyer closed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPayLink, isMockPayLink, isAuthenticated, loaded, ownsSeries, ownsMockPack, sales.vettri, sales.mockPack])

  // Most guests here arrive from a Meta ad, i.e. inside an in-app browser
  // (Instagram/Facebook), where Google Sign-In cannot work at all — Google
  // blocks its own SDK in any WebView. Rather than let them hit that wall on
  // /login or /register and lose the moment, hand off to the default browser
  // proactively at the highest-intent tap. GoogleSignInButton keeps its own
  // reactive fallback for every OTHER page.
  const goAuth = (path: '/login' | '/register') => {
    // A fresh browser instance can't carry React Router state, so the "resume
    // checkout after signing in" behaviour rides in a query param instead;
    // LoginPage/RegisterPage read it when there is no state. Pay links return
    // to themselves — a buyer sent a payment link has to come back to it.
    const back = isPayLink ? location.pathname : '/group-1'
    if (isAndroidWebView) return openInBrowser(`${path}?from=${back}`)
    navigate(path, { state: { from: { pathname: back } } })
  }

  /** The one handler behind every Test Series CTA (hero, plan card, banner,
   *  sticky bar). An eligible signed-in visitor gets the pre-payment confirm
   *  modal, which opens Razorpay on confirm. Guests sign up first (returning
   *  here); staff and existing owners go straight into the series. */
  const handleSeriesClick = (plan?: 'full' | 'month') => {
    if (!isAuthenticated) return goAuth('/register')
    if (ownsSeries) return navigate('/test-series?tab=vettri')
    // Taken off sale: the server would refuse the order anyway, so send them
    // into the app rather than into a checkout that cannot complete.
    if (!sales.vettri) return navigate('/test-arena')
    series.startEnroll(plan)
  }

  /** Same contract for the ₹399 Mock Test Pack. */
  const handleMockClick = () => {
    if (!isAuthenticated) return goAuth('/register')
    if (ownsMockPack) return navigate('/test-series?tab=vettri&g1=mock')
    if (!sales.mockPack) return navigate('/test-arena')
    mock.startEnroll()
  }

  // Every paper's release date has passed → the "all 13 open on enrolment"
  // line is true. Derived rather than hardcoded, so it stops claiming that on
  // its own if a future edition of this schedule is dated forward.
  const allPapersReleased = SCHEDULE.every((row) => new Date(row.date).getTime() <= Date.now())

  const seriesPerkKeys = [...VETTRI_PERK_KEYS, ...VETTRI_BONUS_KEYS]
  const mockPerks = MOCK_ITEMS.map((it) => it[lang])

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

      {/* ─── Pay-link price banner ────────────────────────────────────────────
          The whole offer in one band directly under the header, so a buyer who
          arrived from an ad sees the price before anything else and can pay
          from it without scrolling. On /group-1 the hero's own buy-box already
          does this job, so the band would only be a second copy of it. */}
      {isSeriesPayLink && (
        <section className="border-b border-brand/25 bg-gradient-to-r from-brand to-brand-dark">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
            <div className="min-w-0">
              <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white">
                <Trophy size={12} /> {t('bannerSeriesEyebrow')}
              </span>
              <h2 className="tamil mt-2 font-heading text-lg font-bold leading-tight text-white sm:text-xl">
                {t('bannerSeriesTitle')}
              </h2>
              <p className="tamil mt-0.5 font-body text-sm leading-snug text-white/85">
                {t('boxOneTime')}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  ₹{VETTRI_PRICE_RUPEES}
                </span>
                <span className="tamil rounded-full bg-white/20 px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide text-white">
                  <Gift size={11} className="mr-1 inline-block align-[-1px]" />
                  {t('heroBadgeFree')}
                </span>
              </div>
              <button
                onClick={() => handleSeriesClick('full')}
                className="btn-wrap press w-full min-w-0 rounded-pill bg-white px-6 py-2.5 font-heading text-sm font-bold text-brand shadow-sm transition hover:brightness-95 sm:w-auto"
              >
                {!ownsSeries && <Rocket size={15} className="mr-1.5 inline-block align-[-2px]" />}
                {ownsSeries ? t('bannerOwnedCta') : t('ctaEnroll')}
              </button>
              <p className="tamil font-body text-2xs font-semibold text-white/80">
                {ownsSeries ? t('bannerOwned') : t('boxInstallment')}
              </p>
            </div>
          </div>
        </section>
      )}

      {isMockPayLink && (
        <section className="border-b border-sky/25 bg-gradient-to-r from-sky to-brand">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
            <div className="min-w-0">
              <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white">
                <ListChecks size={12} /> {t('bannerMockEyebrow')}
              </span>
              <h2 className="tamil mt-2 font-heading text-lg font-bold leading-tight text-white sm:text-xl">
                {t('bannerMockTitle')}
              </h2>
              <p className="tamil mt-0.5 font-body text-sm leading-snug text-white/85">
                {t('bannerMockValidity')}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <span className="font-display text-4xl font-bold tracking-tight text-white">
                ₹{MOCK_PACK_PRICE_RUPEES}
              </span>
              <button
                onClick={handleMockClick}
                disabled={mock.paying}
                className="btn-wrap press w-full min-w-0 rounded-pill bg-white px-6 py-2.5 font-heading text-sm font-bold text-sky shadow-sm transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
              >
                {!ownsMockPack && <ListChecks size={15} className="mr-1.5 inline-block align-[-2px]" />}
                {ownsMockPack ? t('bannerOwnedCta') : MOCK_PACK_LABELS.cta[lang]}
              </button>
              {ownsMockPack && (
                <p className="tamil font-body text-2xs font-semibold text-white/80">{t('bannerOwned')}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-[120px]" />
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-sky/20 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr,1fr] lg:gap-10">
            {/* Left - copy */}
            <div className="text-center lg:text-left">
              <Reveal>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-tint-violet px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
                    <ListChecks size={13} /> {t('heroBadgeTests')}
                  </span>
                  <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-tint-green px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-correct">
                    <Gift size={13} /> {t('heroBadgeFree')}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.05}>
                <h1 className="tamil mx-auto mt-4 max-w-xl font-heading text-[1.5rem] font-bold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[1.9rem] sm:leading-[1.22] lg:mx-0 lg:text-[2.1rem] lg:leading-[1.2]">
                  {t('heroTitle')}
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="tamil mx-auto mt-3 max-w-xl font-body text-sm leading-relaxed text-ink2 sm:text-base lg:mx-0">
                  {t('heroSub')}
                </p>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <button
                    onClick={() => handleSeriesClick('full')}
                    className="btn-wrap btn-brand group px-6 py-3 text-sm sm:px-7 sm:py-3.5 sm:text-base"
                  >
                    <Rocket size={17} /> {t('ctaEnroll')}
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                  <a
                    href={SCHEDULE_PDF_URL}
                    download={SCHEDULE_PDF_NAME}
                    target="_blank"
                    rel="noopener"
                    className="btn-wrap btn-ghost px-5 py-3 text-sm sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Download size={17} /> {t('ctaSchedulePdf')}
                  </a>
                </div>
              </Reveal>

              {/* Stat strip - inside the hero so it is visible without
                  scrolling, same as the Group II/IIA page. */}
              <Reveal delay={0.2}>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 lg:justify-start">
                  {[
                    { icon: ListChecks, label: t('statTests') },
                    { icon: BookOpen, label: t('statQuestions') },
                    { icon: Globe, label: t('statBilingual') },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="tamil inline-flex items-center gap-1.5 font-body text-xs font-semibold text-ink2">
                      <Icon size={14} className="shrink-0 text-brand" /> {label}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right - the buy-box for the flagship product. This is THE
                conversion element, so it owns the right column outright; the
                cheaper Mock Pack gets its own card in the section below rather
                than competing for attention here. */}
            <Reveal delay={0.1}>
              <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
                <div className="card relative z-10 overflow-hidden p-6 shadow-card ring-1 ring-brand/25">
                  <div className="tamil -mx-6 -mt-6 mb-4 flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand to-brand-dark py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-white">
                    <Trophy size={13} /> {t('boxBadge')}
                  </div>

                  <div className="flex items-baseline justify-center gap-2.5">
                    <span className="font-display text-3xl font-bold tracking-tight text-ink">₹{VETTRI_PRICE_RUPEES}</span>
                  </div>
                  <p className="tamil mt-1 text-center font-body text-xs text-ink2">{t('boxOneTime')}</p>

                  <div className="mt-4 rounded-field border border-brand/20 bg-brand-soft/60 p-3">
                    <p className="tamil flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
                      <Gift size={13} /> {tGlobal('vettriBonusTitle')}
                    </p>
                    <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1">
                      {seriesPerkKeys.map((k) => (
                        <li key={k} className="flex items-start gap-1.5 font-body text-2xs leading-snug text-ink">
                          <Check size={11} className="mt-0.5 shrink-0 text-brand" />
                          <span className="tamil">{tGlobal(k)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleSeriesClick('full')}
                    className="btn-wrap btn-brand group mt-4 w-full justify-center px-6 py-3 text-sm"
                  >
                    <Rocket size={16} /> {t('ctaEnroll')}
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>

                  {/* The installment tier is a real second checkout (plan
                      `vettri_month`), not a footnote — so it gets its own
                      button rather than a line of small print a buyer who
                      cannot pay ₹1,899 today would have to ask about. */}
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="tamil text-center font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
                      {t('boxOr')}
                    </p>
                    <p className="tamil mt-1.5 text-center font-body text-2xs leading-snug text-ink2">
                      {t('boxInstallment')}
                    </p>
                    <button
                      onClick={() => handleSeriesClick('month')}
                      className="btn-wrap btn-soft mt-2.5 w-full justify-center px-5 py-2.5 text-sm"
                    >
                      {t('boxInstallmentCta')}
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Both products, side by side ──────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="tamil font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                {t('plansTitle')}
              </h2>
              <p className="tamil mx-auto mt-3 font-body text-base leading-relaxed text-ink2">
                {t('plansSub')}
              </p>
            </div>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-4xl items-stretch gap-6 md:grid-cols-2">
            {/* Group 1 Test Series - the elevated tier: ringed, badged, and
                first in reading order on every width. */}
            <Reveal>
              <div className="relative h-full pt-3">
                <span className="tamil absolute top-0 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-brand px-3 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white shadow-lg">
                  <Sparkles size={12} /> {t('recommended')}
                </span>
                <div className="card flex h-full flex-col overflow-hidden p-6 pt-7 shadow-2xl ring-2 ring-brand">
                  <span className="tamil inline-flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-brand">
                    <Trophy size={13} /> {t('planSeriesTag')}
                  </span>
                  <h3 className="tamil mt-2 font-heading text-lg font-semibold text-ink">{t('planSeriesTitle')}</h3>
                  <p className="tamil mt-1.5 font-body text-xs leading-relaxed text-ink2">{t('planSeriesFor')}</p>

                  <div className="mt-3 border-t border-line pt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-bold leading-none text-ink">₹{VETTRI_PRICE_RUPEES}</span>
                      <span className="tamil font-body text-xs text-ink2">{tGlobal('vettriFullSuffix')}</span>
                    </div>
                    <p className="tamil mt-1 font-body text-xs text-ink2">{t('boxOneTime')}</p>
                    <p className="tamil mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint-green px-2.5 py-0.5 font-heading text-2xs font-bold text-correct">
                      <Gift size={11} /> {t('popularNote')}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {seriesPerkKeys.map((k, i) => {
                      const tint = TINTS[i % TINTS.length]
                      const Icon = [ListChecks, FileText, Newspaper, Layers][i] ?? Check
                      return (
                        <li key={k} className="flex items-start gap-2">
                          <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                            <Icon size={12} />
                          </span>
                          <span className="tamil font-body text-xs leading-tight text-ink2">
                            {tGlobal(k)}
                            {i === 0 && (
                              <>
                                {', '}
                                <a
                                  href={SCHEDULE_PDF_URL}
                                  download={SCHEDULE_PDF_NAME}
                                  target="_blank"
                                  rel="noopener"
                                  className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 transition hover:decoration-brand"
                                >
                                  {tGlobal('vettriPerk1Link')}
                                  <Download size={13} className="ml-1 inline-block align-[-1.5px]" />
                                </a>
                              </>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-auto space-y-2 pt-5">
                    <button
                      onClick={() => handleSeriesClick('full')}
                      className="btn-wrap btn-brand w-full justify-center px-6 py-2.5 text-sm"
                    >
                      {ownsSeries ? t('boxOwnedCta') : t('ctaEnroll')} <ArrowRight size={16} />
                    </button>
                    {!ownsSeries && (
                      <button
                        onClick={() => handleSeriesClick('month')}
                        className="btn-wrap btn-ghost w-full justify-center px-6 py-2.5 text-xs"
                      >
                        {t('boxInstallmentCta')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Group 1 Mock Test Pack - the lighter, cheaper standalone pack.
                Perks come from PricingCards' exported MOCK_ITEMS so this card
                and the pricing grid further down can never disagree. */}
            <Reveal delay={0.05}>
              <div className="h-full pt-3">
                <div className="card interactive flex h-full flex-col overflow-hidden p-6 ring-1 ring-sky/25">
                  <span className="tamil inline-flex w-fit items-center gap-2 rounded-full bg-tint-blue px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-sky">
                    <ListChecks size={13} /> {t('planMockTag')}
                  </span>
                  <h3 className="tamil mt-2 font-heading text-lg font-semibold text-ink">
                    {MOCK_PACK_LABELS.title[lang]}
                  </h3>
                  <p className="tamil mt-1.5 font-body text-xs leading-relaxed text-ink2">{t('planMockFor')}</p>

                  <div className="mt-3 border-t border-line pt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-bold leading-none text-ink">₹{MOCK_PACK_PRICE_RUPEES}</span>
                    </div>
                    <p className="tamil mt-1 font-body text-xs text-ink2">
                      {MOCK_PACK_LABELS.duration[lang]} · {MOCK_PACK_LABELS.oneTimePayment[lang]}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {MOCK_ITEMS.map((it, i) => {
                      const tint = TINTS[i % TINTS.length]
                      const Icon = [ListChecks, CalendarDays, Download, Gift, FileText, Check][i] ?? Check
                      return (
                        <li key={it.en} className="flex items-start gap-2">
                          <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                            <Icon size={12} />
                          </span>
                          <span className="tamil font-body text-xs leading-tight text-ink2">{it[lang]}</span>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-auto pt-5">
                    <button
                      onClick={handleMockClick}
                      disabled={mock.paying}
                      className="btn-wrap inline-flex w-full items-center justify-center gap-2 rounded-pill bg-sky px-5 py-2.5 font-heading text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                    >
                      {ownsMockPack ? t('boxOwnedCta') : MOCK_PACK_LABELS.cta[lang]} <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Full schedule ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="tamil font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('scheduleTitle')}
            </h2>
            <p className="tamil mx-auto mt-3 font-body text-base leading-relaxed text-ink2">
              {t('scheduleSub')}
            </p>
            {allPapersReleased && (
              <p className="tamil mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-tint-green px-3.5 py-1.5 font-heading text-xs font-bold text-correct">
                <Check size={14} className="shrink-0" /> {t('scheduleAllOpen')}
              </p>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-tint">
                  <th className="tamil px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colTest')}</th>
                  <th className="tamil px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colUnit')}</th>
                  <th className="tamil px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colSubject')}</th>
                  <th className="tamil px-4 py-3 text-right font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colQuestions')}</th>
                  <th className="tamil px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-ink2">{t('colDate')}</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map((row) => (
                  <tr key={row.no} className={`border-t border-line ${row.free ? 'bg-tint-green/40' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-heading text-sm font-bold text-ink">{row.no}</span>
                      {row.free && (
                        <span className="tamil ml-2 inline-flex rounded-full bg-correct px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide text-white">
                          {t('freeTag')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`tamil inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-heading text-xs font-semibold ${KIND_BADGE[row.kind]}`}>
                        {row.unit[lang]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-sm leading-relaxed text-ink2">{row.subject}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-heading text-sm font-semibold text-ink">
                      {row.questions}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-ink2">{formatDate(row.date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-tint">
                  <td colSpan={3} className="tamil px-4 py-3 font-heading text-sm font-bold text-ink">
                    {t('statTests')}
                  </td>
                  <td className="px-4 py-3 text-right font-heading text-sm font-bold text-ink">{TOTAL_QUESTIONS}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <p className="tamil font-body text-xs text-ink2/80">{t('scheduleNote')}</p>
            <a
              href={SCHEDULE_PDF_URL}
              download={SCHEDULE_PDF_NAME}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-brand underline decoration-brand/40 underline-offset-2 transition hover:decoration-brand"
            >
              <Download size={14} /> {t('downloadPdf')}
            </a>
          </div>
        </Reveal>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
        </div>
      </section>

      {/* ─── Vaults included with the series ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-tint-coral px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-accent">
              <Gift size={13} /> {t('vaultEyebrow')}
            </span>
            <h2 className="tamil mt-4 font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('vaultTitle')}
            </h2>
            <p className="tamil mx-auto mt-3 font-body text-base leading-relaxed text-ink2">{t('vaultSub')}</p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VAULTS.map(({ icon: Icon, ...card }, i) => {
            const tint = TINTS[i % TINTS.length]
            return (
              <Reveal key={card.en.t} delay={i * 0.05}>
                <div className="card h-full p-6">
                  <span className={`grid h-11 w-11 place-items-center rounded-tile ${tint.bg} ${tint.fg}`}>
                    <Icon size={20} />
                  </span>
                  <h3 className="tamil mt-4 font-heading text-base font-semibold text-ink">{card[lang].t}</h3>
                  <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">{card[lang].d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ─── Track your rank ──────────────────────────────────────────────
          Real feature, not a promise: GET /api/profile/percentile (backed by
          the user_percentile() SQL function) already powers the "Top X%" stat
          shown on ResultPage after every test and on InsightsPage - an
          average-score percentile across all completed tests, not a named
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
                <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-tint-coral px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-accent">
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
            {/* autoOpenMockPack stays off: this page drives the Mock Pack
                sheet from its own hook above, and two sheets racing to open
                on the same arrival would leave one stuck behind the other. */}
            <PricingCards
              lang={lang}
              onLangChange={setLang}
              webAppHref={isAuthenticated ? '/test-arena' : '/register'}
            />
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="text-center">
              <span className="tamil inline-flex items-center gap-2 rounded-full bg-tint-violet px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
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
              <span className="tamil font-heading text-xs font-semibold uppercase tracking-[0.16em] text-ink2">
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
              <a href="/privacy" className="tamil text-ink transition hover:text-brand-dark">{t('footerPrivacy')}</a>
              <a href="/payment-policy" className="tamil text-ink transition hover:text-brand-dark">{t('footerPayment')}</a>
              <a href="/refund-policy" className="tamil text-ink transition hover:text-brand-dark">{t('footerRefund')}</a>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 font-body text-xs text-ink2 sm:flex-row sm:items-center sm:justify-between">
            <p className="tamil">© 2026 TNPSC Mentors · {t('footerDisclaimer')}</p>
          </div>
        </div>
      </footer>

      {/* ─── Sticky mobile CTA bar ────────────────────────────────────────────
          Follows whichever product this URL is selling, so a buyer on the mock
          pay link never gets a persistent bar quoting the other price.

          The price column is shrink-0 with its two lines stacked and each kept
          on one line: Tamil CTA labels are roughly twice the width of their
          English twins, and letting the flex row take the difference out of the
          price instead broke "₹1899" across two lines at 320px. The button is
          the elastic half (btn-wrap lets it use two lines), which is the right
          way round - a wrapped button still reads, a wrapped price does not. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:hidden">
        {isMockPayLink ? (
          <>
            <div className="shrink-0">
              <span className="block whitespace-nowrap font-display text-lg font-bold leading-none text-ink">
                ₹{MOCK_PACK_PRICE_RUPEES}
              </span>
              <span className="tamil mt-0.5 block whitespace-nowrap font-body text-2xs leading-tight text-ink2">
                {MOCK_PACK_LABELS.duration[lang]}
              </span>
            </div>
            <button
              onClick={handleMockClick}
              disabled={mock.paying}
              className="btn-wrap btn-brand min-w-0 flex-1 justify-center px-4 py-2.5 text-sm"
            >
              <ListChecks size={15} className="shrink-0" /> {MOCK_PACK_LABELS.cta[lang]}
            </button>
          </>
        ) : (
          <>
            <div className="shrink-0">
              <span className="block whitespace-nowrap font-display text-lg font-bold leading-none text-ink">
                ₹{VETTRI_PRICE_RUPEES}
              </span>
              <span className="tamil mt-0.5 block whitespace-nowrap font-body text-2xs leading-tight text-ink2">
                {tGlobal('vettriFullSuffix')}
              </span>
            </div>
            <button
              onClick={() => handleSeriesClick('full')}
              className="btn-wrap btn-brand min-w-0 flex-1 justify-center px-4 py-2.5 text-sm"
            >
              <Rocket size={15} className="shrink-0" /> {t('ctaEnroll')}
            </button>
          </>
        )}
      </div>

      {/* Pre-payment recaps - opened directly by the CTAs above for an eligible
          signed-in visitor; confirming opens Razorpay, no extra scroll or
          nested click needed. One per product, since each carries its own
          plan name, perks and price. */}
      <PurchaseConfirmModal
        open={series.confirmOpen}
        planName={`${tGlobal('vettriTitle')} · ${tGlobal(series.sel.labelKey)}`}
        validity={tGlobal(series.sel.validityKey)}
        perks={seriesPerkKeys.map((k) => tGlobal(k))}
        priceLabel={series.isFree ? tGlobal('premiumFree') : series.displayPrice}
        note={series.plan === 'month' ? tGlobal('vettriMonthNote') : tGlobal('vettriFullNote')}
        isFree={series.isFree}
        accent="brand"
        busy={series.paying}
        lang={lang}
        onLangChange={setLang}
        onConfirm={series.handleBuy}
        onCancel={() => series.setConfirmOpen(false)}
      />

      <PurchaseConfirmModal
        open={mock.confirmOpen}
        planName={MOCK_PACK_LABELS.title[lang]}
        validity={`${MOCK_PACK_LABELS.duration[lang]} · ${MOCK_PACK_LABELS.oneTimePayment[lang]}`}
        perks={mockPerks}
        priceLabel={mock.isFree ? tGlobal('premiumFree') : mock.displayPrice}
        isFree={mock.isFree}
        accent="sky"
        busy={mock.paying}
        lang={lang}
        onLangChange={setLang}
        onConfirm={mock.handleBuy}
        onCancel={() => mock.setConfirmOpen(false)}
      />
    </div>
  )
}
