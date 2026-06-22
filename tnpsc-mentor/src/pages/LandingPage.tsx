import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  Download,
  ShieldCheck,
  FileText,
  Calculator,
  Timer,
  Newspaper,
  CalendarDays,
  Package,
  Check,
  ChevronDown,
  Sun,
  Moon,
  MessageCircle,
  Mail,
  Phone,
  ArrowRight,
  Wallet,
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
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

// ─── Open items (founder to supply before launch) ────────────────────────────
// Replace these placeholders with the real hosted values. Everything else on
// the page is launch-ready.
const APK_DOWNLOAD_URL = '/downloads/tnpsc-mentor.apk' // TODO: point at the hosted .apk
// Sign-in from the landing page goes to the hosted web app, not the in-page
// router (the app lives on its own subdomain).
const APP_URL = 'https://app.tnpscmentors.in'
const APP_LOGIN_URL = `${APP_URL}/login`
const SUPPORT_EMAIL = 'support@tnpscmentors.in'
const SUPPORT_PHONE = '+91 00000 00000' // TODO: real WhatsApp/support number
const SUPPORT_PHONE_TEL = '+910000000000' // TODO: tel:/wa.me digits
const PRIVACY_URL = '#' // TODO: privacy policy URL
const REFUND_URL = '#' // TODO: refund policy URL (in-app Razorpay payments)

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
    /* analytics not configured yet — ignore */
  }
}

type Lang = 'ta' | 'en'

// ─── Bilingual copy ──────────────────────────────────────────────────────────
// English is the locked offer copy (spec §3). Tamil is natural/spoken, keeping
// the English terms aspirants actually use (Group 1, mock test, PYQ, Aptitude,
// ₹1,399, APK, Play Store). Have a native speaker review before launch.
const T = {
  // Header / global
  signIn: { ta: 'உள்நுழைய', en: 'Sign in' },
  download: { ta: 'Free app download பண்ணுங்க', en: 'Download free app' },

  // Hero
  heroTitle: {
    ta: 'Group 1 தேர்வுக்கு தயாராகுங்க — தாமதம் வேண்டாம், இன்னைக்கே ஆரம்பிங்க.',
    en: 'Get ready for Group 1 exam - Don\'t delay start today.',
  },
  heroSub: {
    ta: 'உண்மையான past papers, Aptitude, exam-hall mock test எல்லாத்தையும் practice பண்ணுங்க. Free-ஆ download பண்ணி நீங்களே பாருங்க — முழுசா தமிழ் & English-ல.',
    en: 'Practice with real past papers, Aptitude, and exam-hall mocks. Download free and try it yourself — fully in Tamil and English.',
  },
  heroTrust: {
    ta: 'Free-ஆ ஆரம்பிங்க · Download-க்கு பணம் இல்ல · எந்த Android phone-லயும் வேலை செய்யும்',
    en: 'Free to start · No payment to download · Works on any Android phone',
  },
  heroEyebrow: {
    ta: 'TNPSC Group 1 · Prelims தயாரிப்பு',
    en: 'TNPSC Group 1 · Prelims preparation',
  },
  trustBilingual: { ta: 'தமிழ் & English', en: 'Tamil & English' },
  trustGraded: { ta: 'Server-graded', en: 'Server-graded' },
  trustFree: { ta: 'Free-ஆ ஆரம்பிங்க', en: 'Free to start' },
  // Floating product chips on the phone mockup
  chipGraded: { ta: 'நேர்மையான score', en: 'Honest scoring' },
  chipBilingual: { ta: 'முழுமையா இருமொழி', en: 'Fully bilingual' },

  // Section 2 — dream / cost of inaction
  s2Title: {
    ta: 'ஒரு Group 1 பதவி உங்க குடும்பத்தோட வாழ்க்கையையே மாத்தும். 2 மார்க்-ல தவறவிட்டா, இன்னொரு முழு வருஷமே போயிடும்.',
    en: "A Group 1 post changes your family's life. Missing it by 2 marks costs you another whole year.",
  },
  s2Body: {
    ta: 'Deputy Collector. DSP. உங்க குடும்பம் பெருமையா சொல்ற அந்த பதவி. அந்த கனவு இன்னும் 11 வாரம் தான். அந்த 11 வாரம் நீங்க பயன்படுத்தினாலும், இல்லாட்டியும் கடந்து போயிடும். கேள்வி ஒண்ணு தான் — சரியான கேள்விகளை practice பண்றீங்களா, இல்ல சிதறிய notes-ல தொலைஞ்சு போறீங்களா?',
    en: 'Deputy Collector. DSP. The post your family says your name with pride. That dream is 11 weeks away — and those 11 weeks pass whether you use them or not. The only question is whether you spend them practising the right questions, or lost in scattered notes.',
  },
  s2ChipDream: { ta: 'கனவு: Deputy Collector / DSP', en: 'The dream: Deputy Collector / DSP' },
  s2ChipCost: { ta: 'விலை: 2 மார்க் = 1 வருஷம்', en: 'The cost: 2 marks = 1 year' },

  // Section 3 — free vs inside
  s3Title: {
    ta: 'இன்னைக்கே free-ஆ ஆரம்பிங்க — பணம் கட்டுறதுக்கு முன்னாடியே உள்ள இருக்கறதெல்லாம் பாருங்க.',
    en: 'Start free today — see everything inside before you ever pay.',
  },
  freeTitle: { ta: 'Free (இப்பவே download)', en: 'Free (download now)' },
  premiumTitle: {
    ta: 'App-க்குள்ள — Group 1 Prelims Kit (₹1,399, எப்பவும் unlock பண்ணலாம்)',
    en: "Inside the app — Group 1 Prelims Kit (₹1,399, unlock anytime)",
  },
  premiumCaption: {
    ta: 'எல்லாத்தையும் உள்ள பாருங்க — பிடிச்சா மட்டும் upgrade பண்ணுங்க.',
    en: 'See it all inside — upgrade only if you love it.',
  },

  // Section 4 — PAM
  s4Title: {
    ta: 'PAM Method: Past papers → Aptitude → Mocks.',
    en: 'The PAM Method: Past papers → Aptitude → Mocks.',
  },

  // Section 5 — why free / why cheaper
  s5Title: {
    ta: 'Free-ஆ ஆரம்பிங்க. அப்புறம் ₹1,399-க்கு upgrade பண்ணுங்க — coaching centre மாதிரி ₹15,000 இல்ல.',
    en: 'Start free. Upgrade later for ₹1,399 — not ₹15,000 like coaching centres.',
  },
  s5Body: {
    ta: "Building வாடகை இல்ல. Fixed batch timing இல்ல. ஊருக்கு போயிட்டு வர பயணம் இல்ல. ஒரே தடவ உருவாக்கி, தமிழ்நாட்டுல இருக்கற எல்லா aspirant-க்கும் கொடுக்குறோம் — அந்த சேமிப்பை நேரா உங்களுக்கே தர்றோம். இதான் அந்த 'catch'.",
    en: 'No building rent. No fixed batch timings. No travel across town. We built it once and serve it to every aspirant in Tamil Nadu — and pass the savings straight to you. That is the whole catch.',
  },

  // Section 6 — install
  s6Title: {
    ta: '30 second-ல install பண்ணலாம் — எப்படினு இதோ.',
    en: "Install in 30 seconds — here's exactly how.",
  },
  s6Reassure: {
    ta: 'Play Store-ல இன்னும் வராத app-க்கு இந்த warning சகஜம். விரைவில் நாங்க Play Store-ல வந்துடுவோம். உங்க download பாதுகாப்பானது.',
    en: "This warning is normal for apps not yet on the Play Store. We'll be on the Play Store soon. Your download is safe.",
  },

  // Section 7 — FAQ
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'Frequently asked questions' },

  // Section 8 — final CTA
  s8Title: {
    ta: 'இன்னைக்கே free-ஆ ஆரம்பிங்க.',
    en: 'Start free today.',
  },
  s8Sub: {
    ta: 'Group 1 prelims-க்கான practice, mock test, PYQ — எல்லாம் ஒரே இடத்துல.',
    en: 'Practice, mocks and PYQ for Group 1 prelims — all in one place.',
  },

  // Footer
  footerTagline: {
    ta: 'TNPSC Group 1 prelims-க்கான தயாரிப்பு — தமிழ் & English-ல.',
    en: 'TNPSC Group 1 prelims preparation — in Tamil and English.',
  },
  footerSupport: { ta: 'உதவி', en: 'Support' },
  footerPrivacy: { ta: 'தனியுரிமை கொள்கை', en: 'Privacy policy' },
  footerRefund: { ta: 'பணம் திரும்ப கொள்கை', en: 'Refund policy' },
  footerDisclaimer: {
    ta: 'Tamil Nadu Public Service Commission-உடன் தொடர்பில்லை.',
    en: 'Not affiliated with the Tamil Nadu Public Service Commission.',
  },
  stickyHint: { ta: 'Free · Group 1', en: 'Free · Group 1' },
} as const

const FREE_ITEMS: { ta: string; en: string }[] = [
  { ta: 'Subject / topic வாரியா practice', en: 'Subject / topic-wise practice' },
  { ta: '3 tests', en: '3 tests' },
  { ta: '1 mock test', en: '1 mock test' },
  { ta: 'திரையிலேயே விளக்கங்கள் (PDF இல்ல)', en: 'On-screen explanations (no PDF)' },
]

const PREMIUM_ITEMS: { ta: string; en: string }[] = [
  { ta: 'கடந்த 5 வருஷ Group 1 PYQ, முழு விளக்கத்தோட', en: "Last 5 years' Group 1 PYQ, fully solved" },
  { ta: 'Unlimited tests, எந்த subject/topic வேணாலும்', en: 'Unlimited tests, any subject/topic' },
  { ta: '5 proctored mock tests (உண்மையான exam-hall feel)', en: '5 proctored mock tests (real exam-hall feel)' },
  { ta: 'ஜூலை–ஆகஸ்ட் current affairs', en: 'July–August current affairs' },
  { ta: '45 நாள் revision plan', en: '45-day revision plan' },
  { ta: 'Aptitude formula sheet', en: 'Aptitude formula sheet' },
  { ta: 'PYQ trend report', en: 'PYQ trend report' },
  { ta: '1 physical exam kit, உங்க வீட்டுக்கே post பண்றோம்', en: '1 physical exam kit, posted to your home' },
  { ta: 'Prelims வரைக்கும் valid · ஒரே payment · subscription இல்ல', en: 'Valid till the prelims · one payment · no subscription' },
]

// ─── Colour system ───────────────────────────────────────────────────────────
// design-system.md gives four pastel tile tints; we use them semantically so the
// page reads as a system, not a rainbow: violet = core/app, coral = aspiration &
// key numbers, blue = practice/learning, green = free/safe. Each pairs a soft
// tile bg with the matching strong icon colour (red-green safe — always an icon).
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
    tint: TINTS[2], // blue — learning
    ta: { t: 'Past papers', d: 'Pattern புரியற வரைக்கும் கடந்த 5 வருஷத்தை drill பண்ணுங்க.' },
    en: { t: 'Past papers', d: 'Drill the last 5 years until the patterns are obvious.' },
  },
  {
    icon: Calculator,
    tint: TINTS[1], // coral — the scoreable marks
    ta: { t: 'Aptitude', d: 'சுலபமா score பண்ணக்கூடிய அந்த 10 மார்க்கை master பண்ணுங்க.' },
    en: { t: 'Aptitude', d: 'Master the easiest, most scoreable 10 marks.' },
  },
  {
    icon: Timer,
    tint: TINTS[0], // violet — exam-hall mocks
    ta: { t: 'Mocks', d: 'Exam pressure சகஜமா ஆகற வரைக்கும் real, timed, proctored mock எழுதுங்க.' },
    en: { t: 'Mocks', d: 'Sit real, timed, proctored mocks until exam pressure feels normal.' },
  },
]

const PREMIUM_ICONS = [FileText, ListChecks, Timer, Newspaper, CalendarDays, Calculator, TrendingUp, Package, ShieldCheck]

const INSTALL_STEPS: { ta: string; en: string }[] = [
  { ta: 'Download free app-ஐ tap பண்ணுங்க.', en: 'Tap Download free app.' },
  {
    ta: "Android 'unknown source'னு காட்டலாம் — Settings → உங்க browser-க்கு allow பண்ணுங்க.",
    en: 'Android may say "unknown source" — tap Settings → allow for your browser.',
  },
  { ta: 'App-ஐ திறந்து free-ஆ practice ஆரம்பிங்க.', en: 'Open the app and start practising free.' },
]

const FAQS: { ta: { q: string; a: string }; en: { q: string; a: string } }[] = [
  {
    ta: { q: 'உண்மையாவே free-ஆ download பண்ணலாமா?', a: 'ஆமா. பணம் எதுவும் இல்லாம download பண்ணி free tier-ஐ use பண்ணலாம்.' },
    en: { q: 'Is it really free to download?', a: 'Yes. Download and use the free tier with no payment.' },
  },
  {
    ta: { q: 'Install பண்ண பணம் கட்டணுமா?', a: 'இல்ல. நீங்க upgrade பண்ண விரும்பினா மட்டும், app-க்குள்ள தான் payment.' },
    en: { q: 'Do I pay anything to install?', a: 'No. Payment only happens inside the app if you choose to upgrade.' },
  },
  {
    ta: {
      q: 'Free vs Paid — என்னென்ன?',
      a: 'Free: subject/topic practice, 3 tests, 1 mock, திரையில விளக்கம். Paid (₹1,399 kit): 5 வருஷ PYQ விளக்கத்தோட, unlimited tests, 5 proctored mock, current affairs, 45 நாள் plan, formula sheet, trend report, மேலும் வீட்டுக்கு physical kit.',
    },
    en: {
      q: "What's free vs paid?",
      a: 'Free: subject/topic practice, 3 tests, 1 mock and on-screen explanations. Paid (₹1,399 kit): 5 years of PYQ solved, unlimited tests, 5 proctored mocks, current affairs, a 45-day plan, formula sheet, trend report and a physical kit posted home.',
    },
  },
  {
    ta: {
      q: 'APK பாதுகாப்பானதா?',
      a: 'ஆமா. App இன்னும் Play Store-ல வரல (எங்க DUNS verification நடந்துட்டிருக்கு), அதனால Android ஒரு சாதாரண sideload warning காட்டும். Download பாதுகாப்பானது.',
    },
    en: {
      q: 'Is the APK safe?',
      a: "Yes. The app simply isn't on the Play Store yet (our DUNS verification is in progress), so Android shows a standard sideload warning. The download itself is safe.",
    },
  },
  {
    ta: { q: 'Physical exam kit-ல என்ன இருக்கும்?', a: '[Founder உறுதி செய்ய வேண்டியது — kit உள்ளடக்கம் விரைவில்.]' },
    en: { q: "What's in the physical exam kit?", a: '[Founder to confirm — kit contents coming soon.]' },
  },
  {
    ta: { q: 'தமிழ்-ல இருக்கா?', a: 'முழுசா இருமொழி — தமிழ் & English, எப்பவும் மாத்திக்கலாம்.' },
    en: { q: 'Is it in Tamil?', a: 'Fully bilingual — Tamil and English, switch anytime.' },
  },
  {
    ta: { q: 'Upgrade பண்ணா எப்படி pay பண்றது?', a: 'App-க்குள்ள UPI அல்லது card மூலமா (Razorpay).' },
    en: { q: 'How do I pay if I upgrade?', a: 'Inside the app via UPI or card (Razorpay).' },
  },
  {
    ta: { q: 'எந்த phone-ல வேலை செய்யும்?', a: 'எந்த Android phone-லயும். (iOS: விரைவில் — [status placeholder].)' },
    en: { q: 'Which phones work?', a: 'Any Android phone. (iOS: coming soon — [status placeholder].)' },
  },
  {
    ta: { q: 'எவ்வளவு நாள் access இருக்கும்?', a: 'Prelims தேர்வு வரைக்கும்.' },
    en: { q: 'How long is access valid?', a: 'Till the prelims exam.' },
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const isAuthed = useAuthStore((s) => Boolean(s.user))
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)

  // Default to Tamil for TN traffic (spec §6).
  const [lang, setLang] = useState<Lang>('ta')

  useEffect(() => {
    document.title =
      lang === 'ta'
        ? 'TNPSC Group 1 — Free-ஆ ஆரம்பிங்க'
        : 'TNPSC Group 1 — Start free'
  }, [lang])

  const t = (key: keyof typeof T) => T[key][lang]

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas pb-24 sm:pb-0">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient font-heading text-sm font-bold text-white">
              த
            </span>
            <span className="font-heading text-base font-semibold tracking-tight text-ink">
              TNPSC <span className="text-brand">Mentor</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Language toggle (spec §6) */}
            <div className="seg-wrap" role="group" aria-label="Language">
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

            <button
              onClick={toggleTheme}
              className="icon-btn h-9 w-9"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <a
              href={isAuthed ? APP_URL : APP_LOGIN_URL}
              className="hidden rounded-xl px-3 py-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand-dark sm:inline-flex"
            >
              {isAuthed ? 'Dashboard' : t('signIn')}
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Soft gradient-mesh backdrop — restrained, premium (Linear/Stripe-style). */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-[120px]" />
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky/15 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="min-w-0 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3.5 py-1.5 font-heading text-xs font-semibold text-brand-dark shadow-pill backdrop-blur">
                <Sparkles size={14} className="text-accent" />
                {t('heroEyebrow')}
              </span>
              <h1 className="mt-6 font-heading text-[2rem] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
                {t('heroTitle')}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl font-body text-base leading-relaxed text-ink2 sm:text-lg lg:mx-0">
                {t('heroSub')}
              </p>
              <div className="mt-8 flex justify-center lg:justify-start">
                <DownloadButton label={t('download')} size="lg" />
              </div>
              {/* Trust row — concrete, no hype */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {[
                  { Icon: Globe, fg: 'text-sky', label: t('trustBilingual') },
                  { Icon: ShieldCheck, fg: 'text-correct', label: t('trustGraded') },
                  { Icon: Download, fg: 'text-accent', label: t('trustFree') },
                ].map(({ Icon, fg, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 font-body text-sm text-ink2">
                    <Icon size={15} className={fg} /> {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Product shot — the app inside a crafted iPhone frame. */}
            <div className="relative min-w-0">
              <PhoneMockup lang={lang} />

              {/* floating glass chips (desktop) */}
              <div className="absolute -left-6 top-4 hidden animate-floaty rounded-2xl border border-line bg-card/80 p-3 shadow-card backdrop-blur lg:flex lg:items-center lg:gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-green text-correct">
                  <ShieldCheck size={18} />
                </span>
                <div className="pr-1">
                  <p className="font-heading text-sm font-semibold text-ink">{t('chipGraded')}</p>
                  <p className="font-body text-xs text-ink2">Server-graded</p>
                </div>
              </div>
              <div
                className="absolute -right-6 bottom-24 hidden animate-floaty rounded-2xl border border-line bg-card/80 p-3 shadow-card backdrop-blur lg:flex lg:items-center lg:gap-2.5"
                style={{ animationDelay: '1.2s' }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-violet text-brand">
                  <Globe size={18} />
                </span>
                <div className="pr-1">
                  <p className="font-heading text-sm font-semibold text-ink">{t('chipBilingual')}</p>
                  <p className="font-body text-xs text-ink2">தமிழ் / EN</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 2 — dream vs cost of inaction ────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="card relative overflow-hidden p-8 text-center sm:p-12">
            {/* coral accent rail — emotional, "cost" tone */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-accent to-brand" />
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-tile bg-tint-coral text-accent">
              <Target size={26} />
            </span>
            <h2 className="mt-6 font-heading text-2xl font-bold leading-snug tracking-tight text-ink sm:text-4xl">
              {t('s2Title')}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl font-body text-base leading-relaxed text-ink2 sm:text-lg">
              {t('s2Body')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-pill bg-tint-violet px-4 py-2 font-heading text-sm font-semibold text-brand">
                <Award size={15} /> {t('s2ChipDream')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-tint-coral px-4 py-2 font-heading text-sm font-semibold text-accent">
                <TriangleAlert size={15} /> {t('s2ChipCost')}
              </span>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ─── Section 3 — free vs inside ───────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('s3Title')}
            </h2>
          </Reveal>
          <div className="mt-12 grid items-start gap-5 lg:grid-cols-2">
            {/* Free — the hook. Green = free & safe, the immediate reward. */}
            <Reveal>
              <div className="card relative h-full overflow-hidden p-7 ring-1 ring-correct/20">
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
                  <DownloadButton label={t('download')} />
                </div>
              </div>
            </Reveal>

            {/* Inside the app — framed as "when you're ready", never a checkout.
                Gold = achievement / the premium kit (design-system accent of value). */}
            <Reveal>
              <div className="card relative h-full overflow-hidden border-brand/30 p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-gold" />
                <span className="inline-flex items-center gap-2 rounded-full bg-goldsoft px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-gold">
                  <Lock size={13} /> ₹1,399 · Prelims Kit
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

      {/* ─── Section 4 — PAM method ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            {t('s4Title')}
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PAM_CARDS.map(({ icon: Icon, tint, ...card }, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div className="card interactive h-full p-7">
                <div className="flex items-center gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-tile ${tint.bg} ${tint.fg}`}>
                    <Icon size={24} />
                  </span>
                  <span className="font-heading text-3xl font-bold text-line">P{i + 1}</span>
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-ink">{card[lang].t}</h3>
                <p className="mt-2 font-body text-[15px] leading-relaxed text-ink2">{card[lang].d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Section 5 — why free / why cheaper ───────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="hero-panel grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div className="pointer-events-none absolute inset-0 bg-hero-grid [background-size:18px_18px]" />
            <div className="relative min-w-0">
              <span className="inline-flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                <Wallet size={14} /> {lang === 'ta' ? 'விலை ஒப்பீடு' : 'Price comparison'}
              </span>
              <h2 className="mt-3 font-heading text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                {t('s5Title')}
              </h2>
              {/* Price contrast — the value at a glance */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-2xl bg-white/15 px-4 py-2.5 font-heading text-3xl font-bold text-white">
                  ₹1,399
                </span>
                <span className="font-heading text-xl font-semibold text-white/50 line-through decoration-accent decoration-2">
                  ₹15,000
                </span>
                <span className="rounded-full bg-accent px-3 py-1.5 font-heading text-xs font-bold text-white shadow-warm">
                  {lang === 'ta' ? '~90% குறைவு' : '~90% less'}
                </span>
              </div>
            </div>
            <p className="relative min-w-0 font-body text-base leading-relaxed text-white/80">
              {t('s5Body')}
            </p>
          </div>
        </section>
      </Reveal>

      {/* ─── Section 6 — install (friction killer) ────────────────────────── */}
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
                  <div className="card interactive h-full p-6">
                    <span className={`grid h-11 w-11 place-items-center rounded-tile ${tint.bg} ${tint.fg} font-heading text-lg font-bold`}>
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

      {/* ─── Section 7 — FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            {t('faqTitle')}
          </h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={Math.min(i * 0.03, 0.15)}>
              <details className="group card overflow-hidden p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-[15px] font-semibold text-ink focus-ring">
                  {faq[lang].q}
                  <ChevronDown
                    size={18}
                    className="flex-shrink-0 text-ink2 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="px-5 pb-4 font-body text-[15px] leading-relaxed text-ink2">{faq[lang].a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Section 8 — final CTA ────────────────────────────────────────── */}
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
                <DownloadButton label={t('download')} size="lg" tone="onDark" />
              </div>
              <p className="mt-4 font-body text-sm text-white/70">{t('heroTrust')}</p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ─── Section 9 — footer ───────────────────────────────────────────── */}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient font-heading text-xs font-bold text-white">
                  த
                </span>
                <span className="font-heading text-sm font-semibold text-ink">
                  TNPSC <span className="text-brand">Mentor</span>
                </span>
              </div>
              <p className="mt-3 font-body text-sm leading-relaxed text-ink2">{t('footerTagline')}</p>
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
              <a href={REFUND_URL} className="text-ink transition hover:text-brand-dark">
                {t('footerRefund')}
              </a>
            </div>
          </div>

          <p className="mt-8 border-t border-line pt-6 font-body text-xs text-ink2">
            © {2026} TNPSC Mentor · {t('footerDisclaimer')}
          </p>
        </div>
      </footer>

      {/* ─── Sticky mobile download bar (always-visible CTA) ──────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-ink">
              TNPSC <span className="text-brand">Group 1</span>
            </p>
            <p className="truncate font-body text-xs text-ink2">{t('stickyHint')}</p>
          </div>
          <DownloadButton label={t('download')} compact />
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** The one and only call to action. Renders an <a download> so the browser
 * downloads the hosted APK, and fires the install-rate KPI on every tap. */
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
  // On the violet hero panels the gradient button disappears, so render a solid
  // high-contrast white pill there instead — keeps "download" the boldest thing.
  const base =
    tone === 'onDark'
      ? 'btn bg-white text-brand-dark hover:brightness-95'
      : 'btn-brand'
  const cls = compact
    ? `${base} px-4 py-2.5 text-sm whitespace-nowrap`
    : size === 'lg'
      ? `${base} w-full px-7 py-4 text-base sm:w-auto`
      : `${base} w-full px-6 py-3.5 text-base sm:w-auto`
  return (
    <a
      href={APK_DOWNLOAD_URL}
      download
      onClick={() => trackEvent('download_click')}
      className={cls}
    >
      <Download size={compact ? 16 : 18} />
      {label}
      {!compact && <ArrowRight size={18} className="hidden sm:inline" />}
    </a>
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

/** Crafted iPhone device frame (dynamic island, side buttons, soft glow) holding
 * a real-looking app screen. A product shot like top app landing pages use —
 * built from the design tokens so it matches the actual app and re-themes. */
function PhoneMockup({ lang }: { lang: Lang }) {
  const reduce = useReducedMotion()
  const inner = (
    <div className="relative mx-auto w-[270px] sm:w-[300px]">
      {/* ambient glow behind the device */}
      <div className="absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-brand/30 blur-3xl" />
      {/* bezel */}
      <div className="relative rounded-[2.8rem] bg-[#0e0d14] p-2.5 shadow-[0_30px_60px_-15px_rgba(20,12,60,0.45)] ring-1 ring-black/20">
        {/* screen */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-canvas">
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2 z-20 h-5 w-[5.5rem] -translate-x-1/2 rounded-full bg-black" />
          <AppScreen lang={lang} />
          {/* glass sheen */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10" />
        </div>
      </div>
      {/* side buttons */}
      <div className="absolute -left-[3px] top-28 h-14 w-[3px] rounded-l bg-[#0e0d14]" />
      <div className="absolute -right-[3px] top-36 h-16 w-[3px] rounded-r bg-[#0e0d14]" />
    </div>
  )
  if (reduce) return inner
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {inner}
    </motion.div>
  )
}

/** Faux in-app screen — the signature practice/mock view with OMR options and a
 * server-graded result, rendered with the same tokens as the real app. */
function AppScreen({ lang }: { lang: Lang }) {
  const tt = (ta: string, en: string) => (lang === 'ta' ? ta : en)
  const options =
    lang === 'ta'
      ? ['ஜனாதிபதி', 'பிரதமர்', 'சபாநாயகர்', 'தலைமை நீதிபதி']
      : ['The President', 'The Prime Minister', 'The Speaker', 'The Chief Justice']
  return (
    <div className="flex h-[564px] flex-col px-3.5 pt-9 pb-2">
      {/* app header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-violet px-2.5 py-1 font-heading text-[11px] font-bold text-brand">
          <FileText size={12} /> Polity
        </span>
        <span className="font-heading text-[11px] font-semibold text-ink2">Q 3 / 50</span>
        <Bookmark size={15} className="text-ink2" />
      </div>
      {/* progress */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-soft">
        <div className="h-full w-[28%] rounded-full bg-brand-gradient" />
      </div>

      {/* question */}
      <p className="mt-4 font-heading text-[15px] font-bold leading-snug text-ink">
        {tt('மக்களவையை யார் கலைக்க முடியும்?', 'Who can dissolve the Lok Sabha?')}
      </p>

      {/* OMR options */}
      <div className="mt-3 space-y-2">
        {options.map((opt, i) => {
          const correct = i === 0
          return (
            <div
              key={opt}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                correct
                  ? 'border-correct/40 bg-tint-green'
                  : 'border-line bg-card'
              }`}
            >
              <span
                className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full font-heading text-[11px] font-bold ${
                  correct ? 'bg-correct text-white' : 'bg-brand-soft text-brand'
                }`}
              >
                {correct ? <Check size={13} /> : String.fromCharCode(65 + i)}
              </span>
              <span className={`font-body text-[12.5px] ${correct ? 'font-semibold text-ink' : 'text-ink2'}`}>
                {opt}
              </span>
            </div>
          )
        })}
      </div>

      {/* explanation / graded chip */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-tint-green px-2.5 py-2">
        <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-correct" />
        <p className="font-body text-[11.5px] leading-snug text-ink">
          {tt('சரி · server-graded · ஒவ்வொரு கேள்விக்கும் விளக்கம்.', 'Correct · server-graded · explained every question.')}
        </p>
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-center gap-1.5 rounded-pill bg-brand-gradient py-2.5 font-heading text-[13px] font-semibold text-white">
          {tt('அடுத்தது', 'Next')} <ChevronRight size={15} />
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
