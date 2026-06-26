import { createContext, useContext, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Download,
  ShieldCheck,
  FileText,
  Calculator,
  Timer,
  Newspaper,
  CalendarDays,
  Check,
  ChevronDown,
  Sun,
  Moon,
  MessageCircle,
  Mail,
  Phone,
  ArrowRight,
  TrendingUp,
  ListChecks,
  Lock,
  Award,
  Target,
  TriangleAlert,
  Sparkles,
  Globe,
  Bookmark,
  ChevronRight,
  Zap,
  BarChart3,
  Smartphone,
  Laptop,
  Tablet,
  Languages,
  Instagram,
  Youtube,
  Facebook,
  X,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { api } from '../lib/api'

// ─── Open items (founder to supply before launch) ────────────────────────────
// Replace these placeholders with the real hosted values. Everything else on
// the page is launch-ready.
// The landing page is served on the main domain, so it reaches the API (on the
// app subdomain) via its absolute URL. The newest uploaded APK is resolved at
// runtime from /api/app/latest; this stable endpoint is the fallback link.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const APK_DOWNLOAD_FALLBACK = `${API_BASE}/api/app/download`

// Current APK download URL (direct CDN link), or null when no build is published
// yet → the download buttons render disabled. Provided by LandingPage after it
// fetches the latest release.
const ApkUrlContext = createContext<string | null>(null)
// Opens the pre-install notice modal (the Google Play Protect warning users will
// hit when sideloading) before the APK actually downloads. Every download CTA on
// the page routes its click through this so nobody is surprised by the warning.
const DownloadIntentContext = createContext<() => void>(() => {})
// Sign-in from the landing page goes to the hosted web app, not the in-page
// router (the app lives on its own subdomain).
const APP_URL = 'https://app.tnpscmentors.in'
const APP_LOGIN_URL = `${APP_URL}/login`
const APP_REGISTER_URL = `${APP_URL}/register`
const SUPPORT_EMAIL = 'support@tnpscmentors.in'
const SUPPORT_PHONE = '+91 96777 79808' // TODO: real WhatsApp/support number
const SUPPORT_PHONE_TEL = '+91 96777 79808' // TODO: tel:/wa.me digits
const PRIVACY_URL = '/privacy'
const GUIDELINES_URL = '/guidelines'
const PAYMENT_URL = '/payment-policy'
const REFUND_URL = '/refund-policy'
// Social channels (shown in the footer). Mapped by the actual domain, not the
// label the link was sent with.
const INSTAGRAM_URL = 'https://www.instagram.com/mentorstnpsc/?hl=en'
const YOUTUBE_URL = 'https://www.youtube.com/@TNPSCMentors4you'
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61591260240425&sk=about'

// ─── Analytics hook ──────────────────────────────────────────────────────────
// The page's only KPI is install-rate, so every download fires this. Wired to
// gtag / dataLayer if present; a no-op otherwise.
function trackEvent(name: string) {
  try {
    const w = window as unknown as {
      dataLayer?: unknown[]
      gtag?: (...args: unknown[]) => void
    }
    w.dataLayer?.push({ event: name })
    w.gtag?.('event', name)
  } catch {
    /* analytics not configured yet - ignore */
  }
}

type Lang = 'ta' | 'en'

// Hero on-load entrance: children rise + fade in sequence (premium, restrained).
const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}

// ─── Bilingual copy ──────────────────────────────────────────────────────────
// English is the locked offer copy (spec §3). Tamil is natural/spoken, keeping
// the English terms aspirants actually use (Group 1, mock test, PYQ, Aptitude,
// ₹1,699, APK, Play Store). Have a native speaker review before launch.
const T = {
  // Header / global
  signIn: { ta: 'உள்நுழைய', en: 'Sign in' },
  signUp: { ta: 'பதிவு செய்', en: 'Sign up' },
  download: { ta: 'App download பண்ணுங்க', en: 'Download the app' },
  // Primary CTA while we promote the hosted web app (APK download paused). The
  // Platforms section still offers the APK; everywhere else routes here.
  webCta: { ta: 'Web app-ல try பண்ணுங்க', en: 'Try the web app' },

  // Hero
  heroTitle: {
    ta: 'TNPSC Group Exams தேர்வுக்கு தயாராகுங்க - தாமதம் வேண்டாம், இன்னைக்கே ஆரம்பிங்க.',
    en: 'Get ready for TNPSC Group exams - Don\'t delay start today.',
  },
  heroSub: {
    ta: 'கடந்த 5 ஆண்டு TNPSC PYQs, திறனறிவு, மாதிரி தேர்வு எல்லாத்தையும் practice பண்ணுங்க. Download பண்ணி நீங்களே try பண்ணுங்க - முழுசா தமிழ் & English-ல.',
    en: 'Practice with Last 5 year PYQs, Aptitude, and Mock test. Download and try it yourself - fully in Tamil and English.',
  },
  heroTrust: {
    ta: 'Download-க்கு பணம் இல்ல · இன்னைக்கே ஆரம்பிங்க · எந்த Android phone-லயும் வேலை செய்யும்',
    en: 'No payment to download · Start today · Works on any Android phone',
  },
  heroEyebrow: {
    ta: 'TNPSC Group Exams · Prelims தயாரிப்பு',
    en: 'TNPSC Group Exams · Prelims preparation',
  },
  trustBilingual: { ta: 'தமிழ் & English', en: 'Tamil & English' },
  trustGraded: { ta: 'Server-graded', en: 'Server-graded' },
  trustFree: { ta: 'செலவில்லா அனுபவம்', en: 'No-cost experience' },
  // Floating product chips on the phone mockup
  chipGraded: { ta: 'நேர்மையான score', en: 'Honest scoring' },
  chipBilingual: { ta: 'முழுமையா இருமொழி', en: 'Fully bilingual' },

  // Section 2 - dream / cost of inaction
  s2Title: {
    ta: 'ஒரு அரசு வேலை உங்க குடும்பத்தோட வாழ்க்கையையே மாத்தும். 2 மார்க்-ல தவறவிட்டா, இன்னொரு முழு வருட மே போயிடும்.',
    en: "A Government Job changes your family's life. Missing it by 2 marks costs you another whole year.",
  },
  s2Body: {
    ta: 'Deputy Collector, DSP & SRO. உங்க ஊரே பெருமைப்படும் ஒரு பதவி.\n“தேர்வுக்கு முன்னாடி இருக்க நேரம், நீங்க சரியா பயன்படுத்தினாலும் இல்லாட்டியும் கடந்து போயிடும்.” கேள்வி ஒண்ணு தான் - சரியான கேள்விகளை practice பண்றீங்களா, இல்ல சிதறிய notes-ல தொலைஞ்சு போறீங்களா?',
    en: 'Deputy Collector, DSP, SRO. The kind of post that your whole town is proud of.\n“The time before the exam passes whether you use it well or not.” The only question is whether you spend it practising the right questions, or lost in scattered notes.',
  },
  s2ChipDream: { ta: 'கனவு: Deputy Collector / DSP', en: 'The dream: Deputy Collector / DSP' },
  s2ChipCost: { ta: 'விலை: 2 மார்க் = 1 வருட ம்', en: 'The cost: 2 marks = 1 year' },

  // Section 3 - starter vs inside
  s3Title: {
    ta: 'இன்றே தொடங்குங்கள்! கட்டணம் செலுத்தும் முன், செயலியின் அனைத்து சிறப்பு அம்சங்களையும் ஆராய்ந்து பாருங்கள்.',
    en: 'Download the app now - explore what you get when you pay, before the actual payment!',
  },
  freeTitle: { ta: 'Starter ( கட்டணம் இல்லை )', en: 'Starter ( Cost free )' },
  premiumTitle: {
    ta: 'App-க்குள்ள - TNPSC Premium Prelims Kit (₹1,699, எப்பவும் unlock பண்ணலாம்)',
    en: "Inside the application - TNPSC Premium Prelims Kit (₹1,699, unlock anytime)",
  },
  premiumCaption: {
    ta: 'Serious-ஆ TNPSC Group exams எழுதுறீங்கனா, இந்த Prelims Kit-ஐ unlock பண்ணி full fledge-ஆ தயாராகுங்க.',
    en: 'Serious about TNPSC Group exams? Unlock the Prelims Kit and prepare with everything you need.',
  },

  // Section 4 - PAM
  s4Title: {
    ta: 'PAM Method: Previous year question paper → Aptitude → Mocks.',
    en: 'The PAM Method: Previous year question paper → Aptitude → Mocks.',
  },

  // Section 5 - why cheaper than coaching
  s5Title: {
    ta: 'இன்னைக்கே ஆரம்பிங்க. அப்புறம் ₹1,699-க்கு upgrade பண்ணுங்க - coaching centre மாதிரி ₹15,000 இல்ல.',
    en: 'Start today. Upgrade later for ₹1,699 - not ₹15,000 like coaching centres.',
  },
  s5Body: {
    ta: "Building வாடகை இல்ல. Fixed batch timing இல்ல. ஊருக்கு போயிட்டு வர பயணம் இல்ல. ஒரே தடவ உருவாக்கி, தமிழ்நாட்டுல இருக்கற எல்லா aspirant-க்கும் கொடுக்குறோம் - அந்த சேமிப்பை நேரா உங்களுக்கே தர்றோம். இதான் அந்த 'catch'.",
    en: 'No fixed batch timings. No travel across town. We built it once and serve it to every aspirant in Tamil Nadu - and pass the savings straight to you. That is the whole catch.',
  },

  // Section 6 - install
  s6Title: {
    ta: '30 second-ல install பண்ணலாம் - எப்படின்னா  இப்படி!',
    en: "Install in 30 seconds - here's exactly how.",
  },
  s6Reassure: {
    ta: 'Play Store-ல இன்னும் வராத app-க்கு இந்த warning சகஜம். விரைவில் நாங்க Play Store-ல வந்துடுவோம். உங்க download பாதுகாப்பானது.',
    en: "This warning is normal for apps not yet on the Play Store. We'll be on the Play Store soon. Your download is safe.",
  },

  // Pre-install notice modal - shown the moment a download CTA is tapped, so the
  // Google Play Protect warning never comes as a surprise.
  dlModalTitle: {
    ta: 'Install பண்றதுக்கு முன்ன - ஒரு சின்ன heads-up',
    en: 'Before you install - a quick heads-up',
  },
  dlModalIntro: {
    ta: 'App இன்னும் Play Store-ல வரல, அதனால Google Play Protect இந்த மாதிரி ஒரு warning காட்டலாம்:',
    en: "The app isn't on the Play Store yet, so Google Play Protect may show a warning like this:",
  },
  dlModalQuote: {
    ta: '"Unsafe app blocked" அல்லது "App not allowed"',
    en: '"Unsafe app blocked" or "App not allowed"',
  },
  dlModalFix: {
    ta: 'பயப்படாதீங்க - "More details" (மேலும் விவரங்கள்) tap பண்ணி, "Install anyway" (எப்படியும் install பண்ணு) தேர்ந்தெடுங்க.',
    en: 'Don\'t worry - just tap "More details", then choose "Install anyway".',
  },
  dlModalReassure: {
    ta: 'உங்க download 100% பாதுகாப்பானது. விரைவில் நாங்க Play Store-ல வந்துடுவோம்.',
    en: "Your download is 100% safe. We'll be on the Play Store soon.",
  },
  dlModalProceed: {
    ta: 'புரிஞ்சது - Download பண்ணு',
    en: 'Got it - download now',
  },
  dlModalCancel: { ta: 'பின்னாடி', en: 'Not now' },

  // Platforms - study on any device
  platTitle: { ta: 'எந்த device-லயும் படிக்கலாம் ', en: 'Study on any device' },
  platSubtitle: {
    ta: 'Phone, tablet, laptop - எல்லாத்துலயும் ஒரே account, ஒரே progress.',
    en: 'Phone, tablet or laptop - one account, your progress everywhere.',
  },
  openWeb: { ta: 'Web app-ஐ திறங்க', en: 'Open web app' },
  openWebShort: { ta: 'Web app', en: 'Web app' },

  // Section 7 - FAQ
  faqEyebrow: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'Frequently asked questions' },
  faqSubtitle: {
    ta: 'Download, payment, மற்றும் access பத்தி தெரிஞ்சுக்கணுமா? இப்படி  பதில்கள்.',
    en: 'Everything about downloading, payment and access - answered.',
  },
  faqStillTitle: { ta: 'இன்னும் சந்தேகமா?', en: 'Still have questions?' },
  faqStillSub: {
    ta: 'நேரடியா எங்களை தொடர்பு கொள்ளுங்க - விரைவா பதில் தர்றோம்.',
    en: 'Reach us directly - we reply fast.',
  },

  // Section 8 - final CTA
  s8Title: {
    ta: 'இன்னைக்கே ஆரம்பிங்க.',
    en: 'Start today.',
  },
  s8Sub: {
    ta: 'TNPSC Group prelims-க்கான practice, mock test, PYQ - எல்லாம் ஒரே இடத்துல.',
    en: 'Practice, mocks and PYQ for TNPSC Group prelims - all in one place.',
  },

  // Footer
  footerTagline: {
    ta: 'TNPSC Exam prelims-க்கான தயாரிப்பு - தமிழ் & English-ல.',
    en: 'TNPSC Exam prelims preparation - in Tamil and English.',
  },
  footerSupport: { ta: 'உதவி', en: 'Support' },
  footerPrivacy: { ta: 'தனியுரிமை கொள்கை', en: 'Privacy policy' },
  footerGuidelines: { ta: 'வழிகாட்டுதல்கள்', en: 'Guidelines' },
  footerPayment: { ta: 'கட்டண கொள்கை', en: 'Payment policy' },
  footerRefund: { ta: 'பணம் திரும்ப & ரத்து கொள்கை', en: 'Return & cancellation' },
  footerDisclaimer: {
    ta: 'Tamil Nadu Public Service Commission-உடன் தொடர்பில்லை.',
    en: 'Not affiliated with the Tamil Nadu Public Service Commission.',
  },
  stickyHint: { ta: 'TNPSC · Group 1', en: 'TNPSC · Group 1' },
} as const

const FREE_ITEMS: { ta: string; en: string }[] = [
  { ta: '3 தேர்வுகள் வரையில் -  உங்களுடைய விருப்ப பாடம் அல்லது தலைப்புகளில் ', en: 'Upto 3 tests in subject or topics of your choice' },
  { ta: 'ஒரு முழு மாதிரி தேர்வு (200 வினாக்கள்)', en: '1 mock test(200 questions)' },
  { ta: 'திரையிலேயே வினாக்களுக்கு விளக்கங்களை  பார்த்துக்கொள்ளலாம் PDF Download செய்துகொள்ளலாம்', en: 'On-screen explanations for questions' },
]

const PREMIUM_ITEMS: { ta: string; en: string }[] = [
  { ta: 'கடந்த 5 வருட TNPSC PYQ, முழு விளக்கத்தோடு ', en: "Last 5 years TNPSC PYQ, fully solved" },
  { ta: 'Unlimited tests attempts, எந்த subject/topic வேணாலும்', en: 'Unlimited test attempts on any subject/topic' },
  { ta: ' 5 மாதிரி தேர்வு(2 Attempt)', en: ' 5 Mock Tests(2 Attempt)' },
  { ta: 'ஆகஸ்ட் 2025 முதல் ஜூலை 2026 வரையிலான நடப்பு நிகழ்வுகள்', en: 'August 2025 to July 2026 current affairs' },
  { ta: '45 நாள் revision plan', en: '45-day revision plan' },
  { ta: 'Formula & Infographic pdf\'s', en: 'Formula and Infographic pdf\s' },
  { ta: 'PYQ trend report', en: 'PYQ trend report' },
  { ta: 'Prelims வரைக்கும் valid · ஒரே payment · subscription இல்ல', en: 'Valid till the prelims · one payment · no subscription' },
]

// ─── Colour system ───────────────────────────────────────────────────────────
// design-system.md gives four pastel tile tints; we use them semantically so the
// page reads as a system, not a rainbow: violet = core/app, coral = aspiration &
// key numbers, blue = practice/learning, green = free/safe. Each pairs a soft
// tile bg with the matching strong icon colour (red-green safe - always an icon).
const TINTS = [
  { bg: 'bg-tint-violet', fg: 'text-brand' },
  { bg: 'bg-tint-coral', fg: 'text-accent' },
  { bg: 'bg-tint-blue', fg: 'text-sky' },
  { bg: 'bg-tint-green', fg: 'text-correct' },
] as const

const PAM_CARDS: {
  icon: typeof FileText
  tint: (typeof TINTS)[number]
  ta: { t: string; d: string }
  en: { t: string; d: string }
}[] = [
  {
    icon: FileText,
    tint: TINTS[2], // blue - learning
    ta: { t: 'Previous year question paper', d: 'Pattern புரியற வரைக்கும் கடந்த 5 வருட த்தை drill பண்ணுங்க.' },
    en: { t: 'Previous year question paper', d: 'Drill the last 5 years until the patterns are obvious.' },
  },
  {
    icon: Calculator,
    tint: TINTS[1], // coral - the scoreable marks
    ta: { t: 'Aptitude', d: 'சுலபமா score பண்ணக்கூடிய அந்த 25 மார்க்கை master பண்ணுங்க.' },
    en: { t: 'Aptitude', d: 'Master the easiest, most scoreable 25 marks.' },
  },
  {
    icon: Timer,
    tint: TINTS[0], // violet - exam-hall mocks
    ta: { t: 'Mocks', d: 'மாதிரி தேர்வுகளை இங்கே  பயிற்சி செய்யுங்கள். தேர்வு நேர பதட்டத்தை/பயத்தை வெல்லுங்கள்!' },
    en: { t: 'Mocks', d: 'Practice realtime mock test here. Defeat your exam fear.' },
  },
]

const PREMIUM_ICONS = [FileText, ListChecks, Timer, Newspaper, CalendarDays, Calculator, TrendingUp, ShieldCheck]

const INSTALL_STEPS: { ta: string; en: string }[] = [
  { ta: 'App download-ஐ tap பண்ணுங்க.', en: 'Tap Download the app.' },
  {
    ta: "Android 'unknown source'னு காட்டலாம் - Settings → உங்க browser-க்கு allow பண்ணுங்க.",
    en: 'Android may say "unknown source" - tap Settings → allow for your browser.',
  },
  { ta: 'App-ஐ திறந்து practice ஆரம்பிங்க.', en: 'Open the app and start practising.' },
]

// How to access on each device. `action`: 'download' shows the APK button,
// 'web' shows an "Open web app" link to the hosted app subdomain.
const PLATFORMS: {
  icon: typeof Smartphone
  tint: (typeof TINTS)[number]
  action: 'download' | 'web'
  ta: { t: string; d: string }
  en: { t: string; d: string }
}[] = [
  {
    icon: Smartphone,
    tint: TINTS[3], // green
    action: 'download',
    ta: { t: 'Android phone', d: 'இந்த page-ல APK download பண்ணி install பண்ணுங்க - 30 second-ல தயார்.' },
    en: { t: 'Android phone', d: 'Download the APK on this page and install - ready in 30 seconds, works offline too.' },
  },
  {
    icon: Smartphone,
    tint: TINTS[1], // coral
    action: 'web',
    ta: { t: 'iPhone', d: 'iOS app விரைவில். இப்போதைக்கு Safari Browser-ல app.tnpscmentors.in திறந்து "Add to Home Screen" பண்ணுங்க - app மாதிரியே வேலை செய்யும்.' },
    en: { t: 'iPhone', d: 'iOS app is coming soon. For now open app.tnpscmentors.in in Safari and "Add to Home Screen" - it behaves just like the app.' },
  },
  {
    icon: Laptop,
    tint: TINTS[2], // blue
    action: 'web',
    ta: { t: 'Laptop & Desktop', d: 'Chrome, Edge அல்லது எந்த browser-லயும் app.tnpscmentors.in திறங்க - பெரிய திரையில முழு அனுபவம்.' },
    en: { t: 'Laptop & Desktop', d: 'Open app.tnpscmentors.in in Chrome, Edge or any browser - the full experience on a big screen.' },
  },
  {
    icon: Tablet,
    tint: TINTS[0], // violet
    action: 'download',
    ta: { t: 'Tablet', d: 'Android tablet-ல APK install பண்ணுங்க; iPad-ல browser-ல திறங்க. அதிக இடத்துல படிக்க வசதி.' },
    en: { t: 'Tablet', d: 'Android tablet: install the APK. iPad: open it in your browser. More room to read and practise.' },
  },
]

const FAQS: { ta: { q: string; a: string }; en: { q: string; a: string } }[] = [
  {
    ta: { q: 'Download பண்ண என்ன செலவு?', a: 'Download-க்கு செலவு இல்ல - app-க்குள்ள upgrade பண்ணா மட்டும் தான் பணம். Starter tier-ஐ பணம் இல்லாம use பண்ணலாம்.' },
    en: { q: 'What does it cost to download?', a: 'Nothing to download - you only pay if you choose to upgrade inside the app. The starter tier needs no payment.' },
  },
  {
    ta: { q: 'Install பண்ண பணம் கட்டணுமா?', a: 'இல்ல. நீங்க upgrade பண்ண விரும்பினா மட்டும், app-க்குள்ள தான் payment.' },
    en: { q: 'Do I pay anything to install?', a: 'No. Payment only happens inside the app if you choose to upgrade.' },
  },
  {
    ta: {
      q: 'Starter vs Paid - என்னென்ன?',
      a: 'Starter: subject/topic practice, 3 tests, 1 mock, திரையில விளக்கம். Paid : 5 வருட  PYQ விளக்கத்தோட, unlimited tests, 5 மாதிரி தேர்வு, current affairs, 45 நாள் plan, formula sheet, மேலும் PYQ trend report.',
    },
    en: {
      q: "What's in the starter vs paid?",
      a: 'Starter: subject/topic practice, 3 tests, 1 mock and on-screen explanations. Paid : 5 years of PYQ solved, unlimited tests, 5 proctored mocks, current affairs, a 45-day plan, formula sheet and a PYQ trend report.',
    },
  },
  {
    ta: {
      q: 'APK பாதுகாப்பானதா?',
      a: 'ஆமா. App இன்னும் Play Store-ல வரல (எங்க verification நடந்துட்டிருக்கு), அதனால Android ஒரு சாதாரண sideload warning காட்டும். Download பாதுகாப்பானது.',
    },
    en: {
      q: 'Is the APK safe?',
      a: "Yes. The app simply isn't on the Play Store yet (our verification is in progress), so Android shows a standard sideload warning. The download itself is safe.",
    },
  },
  {
    ta: { q: 'தமிழ்-ல இருக்கா?', a: 'முழுசா இருமொழி - தமிழ் & English, எப்பவும் மாத்திக்கலாம்.' },
    en: { q: 'Is it in Tamil?', a: 'Fully bilingual - Tamil and English, switch anytime.' },
  },
  {
    ta: { q: 'Upgrade பண்ணா எப்படி pay பண்றது?', a: 'App-க்குள்ள UPI அல்லது card மூலமா (Razorpay).' },
    en: { q: 'How do I pay if I upgrade?', a: 'Inside the app via UPI or card (Razorpay).' },
  },
  {
    ta: { q: 'எந்த phone-ல வேலை செய்யும்?', a: 'எந்த Android phone-லயும். (iOS: விரைவில்.)' },
    en: { q: 'Which phones work?', a: 'Any Android phone. (iOS: coming soon.)' },
  },
  // 
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const isAuthed = useAuthStore((s) => Boolean(s.user))
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)

  // Default to Tamil for TN traffic (spec §6).
  const [lang, setLang] = useState<Lang>('ta')
  const reduce = useReducedMotion()

  // Resolve the current APK. Start optimistic on the stable endpoint (so a
  // transient API hiccup never hides the button), then prefer the direct CDN URL
  // once known — or disable the button (null) if no build has been published.
  const [apkUrl, setApkUrl] = useState<string | null>(APK_DOWNLOAD_FALLBACK)
  useEffect(() => {
    api.appReleases
      .latest()
      .then((r) => setApkUrl(r ? r.url : null))
      .catch(() => {
        /* keep the optimistic fallback link */
      })
  }, [])

  // Pre-install notice: opened by any download CTA, dismissed once the user
  // proceeds (the actual <a download> lives inside the modal).
  const [showInstallNotice, setShowInstallNotice] = useState(false)

  // Hide the header while scrolling down, reveal it the moment the user scrolls
  // up (or returns near the top) - more screen for content, CTA always one flick
  // away. Works with Lenis since it drives native window scroll.
  const [navHidden, setNavHidden] = useState(false)
  useEffect(() => {
    // Headroom / auto-hiding header. Smooth scroll (Lenis) advances only a few px
    // per event, so we must NOT reset the reference every tick - that kept the
    // per-event delta tiny and the reveal never fired. Instead pin `ref` and let
    // movement accumulate; once it passes the threshold in either direction we
    // act and re-pin. Near the top the header is always shown.
    const THRESHOLD = 6
    let ref = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y <= 80) {
        setNavHidden(false)
        ref = y
        return
      }
      const diff = y - ref
      if (diff > THRESHOLD) {
        setNavHidden(true) // scrolled down enough -> hide
        ref = y
      } else if (diff < -THRESHOLD) {
        setNavHidden(false) // scrolled up enough -> reveal
        ref = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.title =
      lang === 'ta'
        ? 'TNPSC Group Exams - இன்னைக்கே ஆரம்பிங்க'
        : 'TNPSC Group Exams - Start today'
  }, [lang])

  const t = (key: keyof typeof T) => T[key][lang]

  return (
    <ApkUrlContext.Provider value={apkUrl}>
    <DownloadIntentContext.Provider value={() => setShowInstallNotice(true)}>
    <div id="top" className="min-h-screen overflow-x-clip bg-canvas pb-24 sm:pb-0">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur transition-transform duration-300 ease-out ${
          navHidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="#top" className="group flex shrink-0 items-center gap-2.5">
            <img
              src="/logo-mark.png"
              alt="TNPSC Mentors"
              className="h-9 w-9 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
            />
            <span className="hidden whitespace-nowrap font-heading text-base font-semibold tracking-tight text-ink sm:inline">
              TNPSC <span className="text-brand">Mentors</span>
            </span>
          </a>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Language toggle (spec §6). Phones get a compact single-tap toggle so
                the auth CTAs always fit; sm+ gets the full segmented control. */}
            <button
              onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-tint px-2.5 py-2 font-heading text-sm font-medium text-ink2 sm:hidden"
              aria-label={lang === 'ta' ? 'Switch to English' : 'தமிழுக்கு மாற்று'}
            >
              <Languages size={15} /> {lang === 'ta' ? 'EN' : 'த'}
            </button>
            <div className="seg-wrap hidden sm:inline-flex" role="group" aria-label="Language">
              <button
                onClick={() => setLang('ta')}
                className={`seg ${lang === 'ta' ? 'seg-active' : ''}`}
                aria-pressed={lang === 'ta'}
              >
                தமிழ்
              </button>
              <button
                onClick={() => setLang('en')}
                className={`seg ${lang === 'en' ? 'seg-active' : ''}`}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
            </div>

            {/* Theme toggle hides on the tightest phones so the auth buttons stay
                visible; available from sm up. */}
            <button
              onClick={toggleTheme}
              className="icon-btn hidden h-9 w-9 transition-transform duration-300 hover:rotate-45 sm:grid"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthed ? (
              <a href={APP_URL} className="btn-soft shrink-0 px-2.5 py-1.5 text-sm sm:px-3.5 sm:py-2">
                Dashboard
              </a>
            ) : (
              <>
                <a
                  href={APP_LOGIN_URL}
                  className="btn-soft shrink-0 px-2.5 py-1.5 text-sm sm:px-3.5 sm:py-2"
                >
                  {t('signIn')}
                </a>
                <a
                  href={APP_REGISTER_URL}
                  className="btn-brand shrink-0 px-2.5 py-1.5 text-sm sm:px-3.5 sm:py-2"
                >
                  {t('signUp')}
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Soft gradient-mesh backdrop - restrained, premium (Linear/Stripe-style). */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-[120px]" />
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky/15 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
            <motion.div
              className="min-w-0 text-center lg:text-left"
              initial={reduce ? false : 'hidden'}
              animate={reduce ? false : 'show'}
              variants={heroStagger}
            >
              <motion.h1
                variants={heroItem}
                className="font-heading text-[1.7rem] font-bold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[2.25rem] sm:leading-[1.22] lg:text-[2.7rem] lg:leading-[1.2]"
              >
                {t('heroTitle')}
              </motion.h1>
              <motion.p
                variants={heroItem}
                className="mx-auto mt-4 max-w-xl font-body text-[15px] leading-relaxed text-ink2 sm:text-base lg:mx-0"
              >
                {t('heroSub')}
              </motion.p>
              <motion.div variants={heroItem} className="mt-8 flex justify-center lg:justify-start">
                <WebAppButton label={t('webCta')} size="lg" />
              </motion.div>
              {/* Trust row - concrete, no hype */}
              <motion.div
                variants={heroItem}
                className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start"
              >
                {[
                  { Icon: Globe, fg: 'text-sky', label: t('trustBilingual') },
                  { Icon: ShieldCheck, fg: 'text-correct', label: t('trustGraded') },
                  { Icon: Download, fg: 'text-accent', label: t('trustFree') },
                ].map(({ Icon, fg, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 font-body text-sm text-ink2">
                    <Icon size={15} className={fg} /> {label}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            {/* Product shot - the app inside a crafted iPhone frame. */}
            <div className="relative min-w-0">
              <PhoneMockup />

              {/* floating glass chips (desktop) - looping bob via framer-motion so
                  it keeps animating regardless of the reduced-motion setting. */}
              <motion.div
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -left-6 top-4 hidden rounded-2xl border border-line bg-card/80 p-3 shadow-card backdrop-blur lg:flex lg:items-center lg:gap-2.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-green text-correct">
                  <ShieldCheck size={18} />
                </span>
                <div className="pr-1">
                  <p className="font-heading text-sm font-semibold text-ink">{t('chipGraded')}</p>
                  <p className="font-body text-xs text-ink2">Server-graded</p>
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                className="absolute -right-6 bottom-24 hidden rounded-2xl border border-line bg-card/80 p-3 shadow-card backdrop-blur lg:flex lg:items-center lg:gap-2.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-violet text-brand">
                  <Globe size={18} />
                </span>
                <div className="pr-1">
                  <p className="font-heading text-sm font-semibold text-ink">{t('chipBilingual')}</p>
                  <p className="font-body text-xs text-ink2">தமிழ் / EN</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 2 - dream vs cost of inaction ────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="card relative overflow-hidden p-8 text-center sm:p-12">
            {/* coral accent rail - emotional, "cost" tone */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-accent to-brand" />
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-tile bg-tint-coral text-accent">
              <Target size={26} />
            </span>
            <h2 className="mt-6 font-heading text-2xl font-bold leading-snug tracking-tight text-ink sm:text-4xl">
              {t('s2Title')}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-line font-body text-base leading-relaxed text-ink2 sm:text-lg">
              {(() => {
                const s = t('s2Body')
                const open = s.indexOf('“')
                const close = s.indexOf('”')
                if (open === -1 || close === -1) return s
                return (
                  <>
                    {s.slice(0, open)}
                    <strong className="font-semibold text-ink">{s.slice(open, close + 1)}</strong>
                    {s.slice(close + 1)}
                  </>
                )
              })()}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-pill bg-tint-violet px-4 py-2 font-heading text-sm font-semibold text-brand">
                <Award size={15} /> {t('s2ChipDream')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-tint-coral px-4 py-2 font-heading text-sm font-semibold text-accent">
                <TriangleAlert size={15} /> {t('s2ChipCost')}
              </span>
            </div>
            <div className="mt-8 flex justify-center">
              <WebAppButton label={t('webCta')} size="lg" />
            </div>
          </div>
        </section>
      </Reveal>

      {/* ─── Section 3 - starter vs inside ────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center font-heading text-2xl font-bold leading-[1.35] tracking-tight text-ink sm:text-4xl sm:leading-[1.3]">
              {t('s3Title')}
            </h2>
          </Reveal>
          <div className="mt-12 grid items-start gap-5 lg:grid-cols-2">
            {/* Free - the hook. Green = free & safe, the immediate reward. */}
            <Reveal>
              <div className="card interactive relative h-full overflow-hidden p-7 ring-1 ring-correct/20">
                <div className="absolute inset-x-0 top-0 h-1 bg-correct" />
                <span className="inline-flex items-center gap-2 rounded-full bg-tint-green px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-correct">
                  <Check size={13} /> {t('freeTitle')}
                </span>
                <ul className="mt-6 space-y-3.5">
                  {FREE_ITEMS.map((it) => (
                    <li key={it.en} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-tint-green text-correct">
                        <Check size={13} />
                      </span>
                      <span className="font-body text-[15px] text-ink">{it[lang]}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <WebAppButton label={t('webCta')} />
                </div>
              </div>
            </Reveal>

            {/* Inside the app - framed as "when you're ready", never a checkout.
                Gold = achievement / the premium kit (design-system accent of value). */}
            <Reveal>
              <div className="card interactive relative h-full overflow-hidden border-brand/30 p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-gold" />
                <span className="inline-flex items-center gap-2 rounded-full bg-goldsoft px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-gold">
                  <Lock size={13} /> ₹1,699 · Premium Prelims Kit
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold text-ink">{t('premiumTitle')}</h3>
                <ul className="mt-5 space-y-3">
                  {PREMIUM_ITEMS.map((it, i) => {
                    const Icon = PREMIUM_ICONS[i] ?? Check
                    const tint = TINTS[i % TINTS.length]
                    return (
                      <li key={it.en} className="flex items-start gap-3">
                        <span className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                          <Icon size={13} />
                        </span>
                        <span className="font-body text-[15px] text-ink2">{it[lang]}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-6 font-body text-sm italic text-ink2">{t('premiumCaption')}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Section 4 - PAM method ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            {t('s4Title')}
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PAM_CARDS.map(({ icon: Icon, tint, ...card }, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div className="card interactive group h-full p-7">
                <div className="flex items-center gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-tile ${tint.bg} ${tint.fg} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
                    <Icon size={24} />
                  </span>
                  <span className="font-heading text-3xl font-bold text-line transition-colors group-hover:text-brand/30">P{i + 1}</span>
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-ink">{card[lang].t}</h3>
                <p className="mt-2 font-body text-[15px] leading-relaxed text-ink2">{card[lang].d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Section 6 - install (friction killer) ────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('s6Title')}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {INSTALL_STEPS.map((step, i) => {
              const tint = TINTS[i % TINTS.length]
              return (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="card interactive group h-full p-6">
                    <span className={`grid h-11 w-11 place-items-center rounded-tile ${tint.bg} ${tint.fg} font-heading text-lg font-bold transition-transform duration-300 group-hover:scale-110`}>
                      {i + 1}
                    </span>
                    <p className="mt-4 font-body text-[15px] leading-relaxed text-ink">{step[lang]}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
          <Reveal>
            <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-card border border-correct/25 bg-tint-green px-5 py-4">
              <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-card text-correct">
                <ShieldCheck size={16} />
              </span>
              <p className="font-body text-sm leading-relaxed text-ink">{t('s6Reassure')}</p>
            </div>
            <div className="mt-8 flex justify-center">
              <DownloadButton label={t('download')} size="lg" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Platforms - study on any device ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('platTitle')}
            </h2>
            <p className="mx-auto mt-4 font-body text-base leading-relaxed text-ink2">
              {t('platSubtitle')}
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map(({ icon: Icon, tint, action, ...p }, i) => (
            <Reveal key={p.en.t} delay={i * 0.06}>
              <div className="card interactive group flex h-full flex-col p-6">
                <span className={`grid h-12 w-12 place-items-center rounded-tile ${tint.bg} ${tint.fg} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 font-heading text-lg font-semibold text-ink">{p[lang].t}</h3>
                <p className="mt-2 flex-1 font-body text-[14px] leading-relaxed text-ink2">{p[lang].d}</p>
                <div className="mt-5">
                  {action === 'download' ? (
                    apkUrl ? (
                      <button
                        type="button"
                        onClick={() => setShowInstallNotice(true)}
                        className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-brand transition hover:gap-2.5 hover:text-brand-dark"
                      >
                        <Download size={15} /> {t('download')}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-ink2/50">
                        <Download size={15} /> {t('download')}
                      </span>
                    )
                  ) : (
                    <a
                      href={isAuthed ? APP_URL : APP_LOGIN_URL}
                      className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-brand transition hover:gap-2.5 hover:text-brand-dark"
                    >
                      <Globe size={15} /> {t('openWeb')} <ArrowRight size={15} />
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Section 7 - FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr,1.15fr] lg:gap-14">
          {/* Left - sticky intro + support card */}
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <span className="inline-flex items-center gap-2 rounded-full bg-tint-violet px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
                <Sparkles size={13} /> {t('faqEyebrow')}
              </span>
              <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                {t('faqTitle')}
              </h2>
              <p className="mt-4 max-w-sm font-body text-base leading-relaxed text-ink2">
                {t('faqSubtitle')}
              </p>

              <div className="mt-7 rounded-card border border-line bg-card p-5 shadow-soft">
                <p className="font-heading text-base font-semibold text-ink">{t('faqStillTitle')}</p>
                <p className="mt-1 font-body text-sm text-ink2">{t('faqStillSub')}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <a
                    href={`https://wa.me/${SUPPORT_PHONE_TEL.replace(/[^0-9]/g, '')}`}
                    className="btn-soft px-4 py-2.5 text-sm"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-ghost px-4 py-2.5 text-sm">
                    <Mail size={16} /> Email
                  </a>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right - single-open accordion */}
          <Reveal delay={0.08}>
            <FaqList items={FAQS.map((f) => f[lang])} />
          </Reveal>
        </div>
      </section>

      {/* ─── Section 8 - final CTA ────────────────────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <div className="hero-panel p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute inset-0 bg-hero-grid [background-size:18px_18px]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-heading text-2xl font-bold tracking-tight text-white sm:text-4xl">
                {t('s8Title')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl font-body text-base text-white/75">{t('s8Sub')}</p>
              <div className="mt-8 flex justify-center">
                <WebAppButton label={t('webCta')} size="lg" tone="onDark" />
              </div>
              <p className="mt-4 font-body text-sm text-white/70">{t('heroTrust')}</p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ─── Section 9 - footer ───────────────────────────────────────────── */}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-sm">
              <div className="flex items-center gap-2.5">
                <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
                <span className="font-heading text-sm font-semibold text-ink">
                  TNPSC <span className="text-brand">Mentors</span>
                </span>
              </div>
              <p className="mt-3 font-body text-sm leading-relaxed text-ink2">{t('footerTagline')}</p>
              {/* Social channels */}
              <div className="mt-4 flex items-center gap-2.5">
                {[
                  { href: INSTAGRAM_URL, Icon: Instagram, label: 'Instagram' },
                  { href: YOUTUBE_URL, Icon: Youtube, label: 'YouTube' },
                  { href: FACEBOOK_URL, Icon: Facebook, label: 'Facebook' },
                ].map(({ href, Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
                  >
                    <Icon size={17} />
                  </a>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 font-body text-sm">
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-ink2">
                {t('footerSupport')}
              </span>
              <a
                href={`https://wa.me/${SUPPORT_PHONE_TEL.replace(/[^0-9]/g, '')}`}
                className="inline-flex items-center gap-2 text-ink transition hover:text-brand-dark"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a href={`tel:${SUPPORT_PHONE_TEL}`} className="inline-flex items-center gap-2 text-ink transition hover:text-brand-dark">
                <Phone size={15} /> {SUPPORT_PHONE}
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-ink transition hover:text-brand-dark">
                <Mail size={15} /> {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="flex flex-col gap-3 font-body text-sm">
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-ink2">
                Legal
              </span>
              <a href={PRIVACY_URL} className="text-ink transition hover:text-brand-dark">
                {t('footerPrivacy')}
              </a>
              <a href={GUIDELINES_URL} className="text-ink transition hover:text-brand-dark">
                {t('footerGuidelines')}
              </a>
              <a href={PAYMENT_URL} className="text-ink transition hover:text-brand-dark">
                {t('footerPayment')}
              </a>
              <a href={REFUND_URL} className="text-ink transition hover:text-brand-dark">
                {t('footerRefund')}
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 font-body text-xs text-ink2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {2026} TNPSC Mentors · {t('footerDisclaimer')}</p>
            <p>
              Collaborated with{' '}
              <a
                href="https://sirahdigital.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-heading font-semibold text-brand transition hover:text-brand-dark"
              >
                Sirah Digital
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* ─── Sticky mobile CTA bar (always-visible) ───────────────────────────
          One action while we promote the web app: open the hosted web app
          (register for new visitors, the app once signed in). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:hidden">
        <a
          href={isAuthed ? APP_URL : APP_REGISTER_URL}
          onClick={() => trackEvent('webapp_click')}
          className="btn-brand group w-full justify-center whitespace-nowrap px-4 py-3 text-sm"
        >
          <Globe size={16} /> {t('webCta')}
        </a>
      </div>

      {/* Pre-install notice (Play Protect warning) - the gateway to the actual
          download. */}
      <InstallNoticeModal
        open={showInstallNotice}
        onClose={() => setShowInstallNotice(false)}
        apkUrl={apkUrl}
        t={t}
        reduce={Boolean(reduce)}
      />
    </div>
    </DownloadIntentContext.Provider>
    </ApkUrlContext.Provider>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** The one and only call to action. Opens the pre-install notice modal (so the
 * Play Protect warning is never a surprise); the actual <a download> that fires
 * the install-rate KPI lives inside that modal. */
function DownloadButton({
  label,
  size,
  compact,
  tone,
}: {
  label: string
  size?: 'lg'
  compact?: boolean
  tone?: 'onDark'
}) {
  const openNotice = useContext(DownloadIntentContext)
  // On the violet hero panels the gradient button disappears, so render a solid
  // high-contrast white pill there instead - keeps "download" the boldest thing.
  const base =
    tone === 'onDark'
      ? 'btn bg-white text-brand-dark hover:brightness-95'
      : 'btn-brand'
  const cls = compact
    ? `${base} group px-4 py-2.5 text-sm whitespace-nowrap`
    : size === 'lg'
      ? `${base} group w-full px-7 py-4 text-base sm:w-auto`
      : `${base} group w-full px-6 py-3.5 text-base sm:w-auto`
  return (
    <button type="button" onClick={openNotice} className={cls}>
      {/* download icon dips down on hover, like a file landing */}
      <Download
        size={compact ? 16 : 18}
        className="transition-transform duration-200 group-hover:translate-y-0.5"
      />
      {label}
      {!compact && (
        <ArrowRight
          size={18}
          className="hidden transition-transform duration-200 group-hover:translate-x-1 sm:inline"
        />
      )}
    </button>
  )
}

/** Web-app CTA — the primary call to action while we promote the hosted web app
 * (APK download paused for now; still offered in the Platforms section). Opens
 * the web app: register for new visitors, the app itself once signed in. Mirrors
 * DownloadButton's sizing/tone props so swapping it in leaves the layout intact. */
function WebAppButton({
  label,
  size,
  compact,
  tone,
}: {
  label: string
  size?: 'lg'
  compact?: boolean
  tone?: 'onDark'
}) {
  const isAuthed = useAuthStore((s) => Boolean(s.user))
  const href = isAuthed ? APP_URL : APP_REGISTER_URL
  // On violet hero panels the gradient button vanishes, so use a solid white pill.
  const base =
    tone === 'onDark'
      ? 'btn bg-white text-brand-dark hover:brightness-95'
      : 'btn-brand'
  const cls = compact
    ? `${base} group px-4 py-2.5 text-sm whitespace-nowrap`
    : size === 'lg'
      ? `${base} group w-full px-7 py-4 text-base sm:w-auto`
      : `${base} group w-full px-6 py-3.5 text-base sm:w-auto`
  return (
    <a href={href} onClick={() => trackEvent('webapp_click')} className={cls}>
      <Globe size={compact ? 16 : 18} />
      {label}
      {!compact && (
        <ArrowRight
          size={18}
          className="hidden transition-transform duration-200 group-hover:translate-x-1 sm:inline"
        />
      )}
    </a>
  )
}

/** Pre-install notice. Surfaces the exact Google Play Protect warning a user
 * will hit when sideloading, plus the one-tap way past it, then proceeds to the
 * actual APK download. Routed through by every download CTA on the page. */
function InstallNoticeModal({
  open,
  onClose,
  apkUrl,
  t,
  reduce,
}: {
  open: boolean
  onClose: () => void
  apkUrl: string | null
  t: (key: keyof typeof T) => string
  reduce: boolean
}) {
  // Lock body scroll while the modal is up, and allow Esc to dismiss.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const href = apkUrl ?? APK_DOWNLOAD_FALLBACK
  const ease = [0, 0, 0.2, 1] as const

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t('dlModalTitle')}
        >
          <motion.div
            className="relative w-full max-w-md rounded-card border border-line bg-card p-6 shadow-xl"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('dlModalCancel')}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-tint hover:text-ink"
            >
              <X size={18} />
            </button>

            <span className="grid h-12 w-12 place-items-center rounded-tile bg-tint-violet text-brand">
              <Smartphone size={24} />
            </span>
            <h3 className="mt-4 pr-8 font-heading text-xl font-bold text-ink">
              {t('dlModalTitle')}
            </h3>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-ink2">
              {t('dlModalIntro')}
            </p>

            {/* The verbatim warning the user is about to see - shown plainly as
                a quoted snippet, not a danger alert, so it stays reassuring. */}
            <div className="mt-3 rounded-card border border-line bg-tint px-4 py-2.5">
              <p className="font-body text-sm leading-relaxed text-ink2">
                {t('dlModalQuote')}
              </p>
            </div>

            <p className="mt-3 font-body text-[15px] leading-relaxed text-ink">
              {t('dlModalFix')}
            </p>
            <div className="mt-3 flex items-start gap-2.5 rounded-card border border-correct/25 bg-tint-green px-4 py-3">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-correct" />
              <p className="font-body text-sm leading-relaxed text-ink2">
                {t('dlModalReassure')}
              </p>
            </div>

            <a
              href={href}
              download
              onClick={() => {
                trackEvent('download_click')
                onClose()
              }}
              className="btn-brand group mt-5 w-full justify-center px-6 py-3.5 text-base"
            >
              <Download
                size={18}
                className="transition-transform duration-200 group-hover:translate-y-0.5"
              />
              {t('dlModalProceed')}
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Lightweight scroll-reveal that honours prefers-reduced-motion (renders
 * statically). Matches the app's motion system (fade + small upward drift). */
function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
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

/** Single-open accordion with a numbered badge and smooth height animation.
 * Honours prefers-reduced-motion (instant open/close). */
function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()
  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const isOpen = open === i
        return (
          <div
            key={i}
            className={`card overflow-hidden transition-shadow duration-200 ${
              isOpen ? 'shadow-card ring-1 ring-brand/30' : ''
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left focus-ring"
            >
              <span
                className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg font-heading text-xs font-bold transition-colors ${
                  isOpen ? 'bg-brand-gradient text-white' : 'bg-brand-soft text-brand'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 font-heading text-[15px] font-semibold text-ink">
                {f.q}
              </span>
              <ChevronDown
                size={18}
                className={`flex-shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-brand' : 'text-ink2'
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 pl-[3.75rem] font-body text-[15px] leading-relaxed text-ink2">
                    {f.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** Crafted iPhone device frame (dynamic island, side buttons, soft glow) holding
 * a real-looking app screen. A product shot like top app landing pages use -
 * built from the design tokens so it matches the actual app and re-themes. */
/** Phase of the looping demo for one question. */
type DemoPhase = 'read' | 'pick' | 'reveal'

/** Scenes the hero auto-plays, like a product GIF — but coded, so it stays crisp,
 * lightweight, theme-aware and bilingual. Each scene carries both languages so the
 * loop alternates TA/EN (sells "fully bilingual") and reduced-motion can render the
 * page's own language. Answers are factually correct (it's an exam-prep app). */
const DEMO_SCENES: Array<{
  subject: string
  qNum: number
  progress: number
  demoLang: Lang
  correct: number
  q: Record<Lang, string>
  options: Record<Lang, string[]>
  expl: Record<Lang, string>
}> = [
  {
    subject: 'Polity',
    qNum: 3,
    progress: 28,
    demoLang: 'ta',
    correct: 0,
    q: { ta: 'மக்களவையை யார் கலைக்க முடியும்?', en: 'Who can dissolve the Lok Sabha?' },
    options: {
      ta: ['ஜனாதிபதி', 'பிரதமர்', 'சபாநாயகர்', 'தலைமை நீதிபதி'],
      en: ['The President', 'The Prime Minister', 'The Speaker', 'The Chief Justice'],
    },
    expl: {
      ta: 'சரி · server-graded · ஒவ்வொரு கேள்விக்கும் விளக்கம்.',
      en: 'Correct · server-graded · explained every question.',
    },
  },
  {
    subject: 'History',
    qNum: 4,
    progress: 36,
    demoLang: 'en',
    correct: 0,
    q: {
      ta: 'வெள்ளையனே வெளியேறு இயக்கம் எந்த ஆண்டில் தொடங்கப்பட்டது?',
      en: 'In which year was the Quit India Movement launched?',
    },
    options: {
      ta: ['1942', '1930', '1919', '1947'],
      en: ['1942', '1930', '1919', '1947'],
    },
    expl: {
      ta: 'சரி · server-graded · ஒவ்வொரு கேள்விக்கும் விளக்கம்.',
      en: 'Correct · server-graded · explained every question.',
    },
  },
  {
    subject: 'Geography',
    qNum: 5,
    progress: 44,
    demoLang: 'ta',
    correct: 0,
    q: { ta: 'பஞ்சாபின் தலைநகரம் எது?', en: 'What is the capital of Punjab?' },
    options: {
      ta: ['சண்டிகர்', 'அமிர்தசரஸ்', 'லூதியானா', 'பாட்டியாலா'],
      en: ['Chandigarh', 'Amritsar', 'Ludhiana', 'Patiala'],
    },
    expl: {
      ta: 'சரி · server-graded · ஒவ்வொரு கேள்விக்கும் விளக்கம்.',
      en: 'Correct · server-graded · explained every question.',
    },
  },
]

function PhoneMockup() {
  // Drive a looping product demo: each scene plays read → tap → reveal, then
  // advances the question; the loop also alternates TA/EN. This is the hero's
  // autoplaying "GIF", so it runs regardless of the reduced-motion setting.
  const [scene, setScene] = useState(0)
  const [phase, setPhase] = useState<DemoPhase>('read')

  useEffect(() => {
    setPhase('read')
    const toPick = window.setTimeout(() => setPhase('pick'), 1100)
    const toReveal = window.setTimeout(() => setPhase('reveal'), 1700)
    const toNext = window.setTimeout(() => setScene((s) => (s + 1) % DEMO_SCENES.length), 3500)
    return () => {
      window.clearTimeout(toPick)
      window.clearTimeout(toReveal)
      window.clearTimeout(toNext)
    }
  }, [scene])

  const active = DEMO_SCENES[scene]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={{ y: -6, rotate: -1, scale: 1.015 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative mx-auto w-[270px] sm:w-[300px]">
        {/* ambient glow behind the device */}
        <div className="absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-brand/30 blur-3xl" />
        {/* bezel */}
        <div className="relative rounded-[2.8rem] bg-[#0e0d14] p-2.5 shadow-[0_30px_60px_-15px_rgba(20,12,60,0.45)] ring-1 ring-black/20">
          {/* screen */}
          <div className="relative overflow-hidden rounded-[2.2rem] bg-canvas">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-2 z-20 h-5 w-[5.5rem] -translate-x-1/2 rounded-full bg-black" />
            <AppScreen scene={active} lang={active.demoLang} phase={phase} sceneKey={scene} />
            {/* glass sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10" />
          </div>
        </div>
        {/* side buttons */}
        <div className="absolute -left-[3px] top-28 h-14 w-[3px] rounded-l bg-[#0e0d14]" />
        <div className="absolute -right-[3px] top-36 h-16 w-[3px] rounded-r bg-[#0e0d14]" />
      </div>
    </motion.div>
  )
}

/** A text node that softly fades + lifts in whenever its content/language changes —
 * the smooth swap that makes the looping mockup feel alive. */
function MorphText({
  swap,
  delay = 0,
  className,
  children,
}: {
  swap: string | number
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.span
      key={swap}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.span>
  )
}

/** Faux in-app screen - the signature practice/mock view, driven by the demo phase:
 * options sit idle, the correct one gets a "tap" press, then reveals green with the
 * server-graded explanation; progress + question number advance per scene. */
function AppScreen({
  scene,
  lang,
  phase,
  sceneKey,
}: {
  scene: (typeof DEMO_SCENES)[number]
  lang: Lang
  phase: DemoPhase
  sceneKey: number
}) {
  const swap = `${sceneKey}-${lang}`
  const revealed = phase === 'reveal'
  const fill = revealed ? scene.progress : Math.max(0, scene.progress - 6)
  return (
    <div className="flex h-[564px] flex-col px-3.5 pt-9 pb-2">
      {/* app header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-violet px-2.5 py-1 font-heading text-[11px] font-bold text-brand">
          <FileText size={12} /> {scene.subject}
        </span>
        <span className="font-heading text-[11px] font-semibold text-ink2">Q {scene.qNum} / 50</span>
        <Bookmark size={15} className="text-ink2" />
      </div>
      {/* progress */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-soft">
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-700 ease-out"
          style={{ width: `${fill}%` }}
        />
      </div>

      {/* question */}
      <p className="mt-4 min-h-[2.5rem] font-heading text-[15px] font-bold leading-snug text-ink">
        <MorphText swap={`q-${swap}`} className="block">
          {scene.q[lang]}
        </MorphText>
      </p>

      {/* OMR options */}
      <div className="mt-3 space-y-2">
        {scene.options[lang].map((opt, i) => {
          const isCorrect = i === scene.correct
          // per-option visual state across the read → pick → reveal phases
          const state =
            isCorrect && revealed ? 'correct' : isCorrect && phase === 'pick' ? 'pressed' : 'idle'
          return (
            <motion.div
              key={i}
              animate={{ scale: state === 'pressed' ? 0.975 : 1 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                state === 'correct'
                  ? 'border-correct/40 bg-tint-green'
                  : state === 'pressed'
                    ? 'border-brand/40 bg-brand-soft ring-2 ring-brand/25'
                    : 'border-line bg-card'
              }`}
            >
              <span
                className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full font-heading text-[11px] font-bold ${
                  state === 'correct'
                    ? 'bg-correct text-white'
                    : state === 'pressed'
                      ? 'bg-brand text-white'
                      : 'bg-brand-soft text-brand'
                }`}
              >
                {state === 'correct' ? <Check size={13} /> : String.fromCharCode(65 + i)}
              </span>
              <span
                className={`font-body text-[12.5px] ${
                  state === 'idle' ? 'text-ink2' : 'font-semibold text-ink'
                }`}
              >
                <MorphText swap={`o${i}-${swap}`} delay={0.03 * (i + 1)}>
                  {opt}
                </MorphText>
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* explanation / graded chip — fades in only once the answer is revealed
          (space is reserved so the device height never jumps). */}
      <div className="mt-3 min-h-[2.75rem]">
        <motion.div
          animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 4 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start gap-2 rounded-xl bg-tint-green px-2.5 py-2"
        >
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-correct" />
          <p className="font-body text-[11.5px] leading-snug text-ink">
            <MorphText swap={`e-${swap}`} className="block">
              {scene.expl[lang]}
            </MorphText>
          </p>
        </motion.div>
      </div>

      <div className="mt-auto pt-3">
        <div
          className={`flex items-center justify-center gap-1.5 rounded-pill py-2.5 font-heading text-[13px] font-semibold transition-colors duration-300 ${
            revealed ? 'bg-brand-gradient text-white' : 'bg-brand-soft text-brand/60'
          }`}
        >
          <MorphText swap={`n-${swap}`}>{lang === 'ta' ? 'அடுத்தது' : 'Next'}</MorphText>
          <ChevronRight size={15} />
        </div>
        {/* bottom nav */}
        <div className="mt-3 flex items-center justify-around border-t border-line pt-2.5">
          {[
            { Icon: Zap, active: true },
            { Icon: Timer, active: false },
            { Icon: BarChart3, active: false },
            { Icon: Award, active: false },
          ].map(({ Icon, active }, i) => (
            <Icon key={i} size={18} className={active ? 'text-brand' : 'text-ink2/50'} />
          ))}
        </div>
      </div>
    </div>
  )
}
