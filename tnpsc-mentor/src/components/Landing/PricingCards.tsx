import {
  Check,
  Trophy,
  Lock,
  ArrowRight,
  Download,
  Rocket,
  Sparkles,
  ShieldCheck,
  Timer,
  FileText,
  Newspaper,
  ListChecks,
  Globe,
  Gift,
  Calculator,
  CalendarDays,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { translate, type StringKey } from '../../lib/i18n'
import {
  RANK_BOOSTER_MRP_RUPEES,
  RANK_BOOSTER_PRICE_RUPEES,
  RANK_BOOSTER_PERK_KEYS,
  RANK_BOOSTER_BONUS_KEYS,
} from '../../hooks/useRankBoosterPurchase'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../../hooks/useMockPackPurchase'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAuth } from '../../hooks/useAuth'
import StackedCards from '../UI/StackedCards'
import PurchaseConfirmModal from '../UI/PurchaseConfirmModal'

type Lang = 'ta' | 'en'

// design-system.md's four pastel tile tints, used semantically: violet =
// core/app, coral = aspiration/key numbers, blue = practice/learning,
// green = free/safe. Shared by every card's perk-list icons below.
const TINTS = [
  { bg: 'bg-tint-violet', fg: 'text-brand' },
  { bg: 'bg-tint-coral', fg: 'text-accent' },
  { bg: 'bg-tint-blue', fg: 'text-sky' },
  { bg: 'bg-tint-green', fg: 'text-correct' },
] as const

// Real pricing only. Premium's MRP equals its price in PremiumCard.tsx
// (no standing discount exists) and Vettri has no MRP at all (VettriCard.tsx)
// - so only Rank Booster gets a strikethrough. Faking one for the others
// would be showing a discount that doesn't exist.
const VETTRI_PRICE_RUPEES = 899
const PREMIUM_PRICE_RUPEES = 1699

const T = {
  freeRibbon: { ta: 'புதிய கணக்கு சலுகை ', en: 'Signup bonus' },
  freeTitle: { ta: 'Starter', en: 'Starter' },
  freePrice: { ta: 'இலவசம்', en: 'Free' },
  freeDuration: { ta: 'எப்போதும் இலவசம் · கார்டு தேவையில்லை', en: 'Always free · no card needed' },
  ctaFree: { ta: 'இலவசமாகத் தொடங்கு', en: 'Start Free' },

  // Standalone Group 1 mock-test pack - lighter/cheaper than the full Vettri
  // bundle. Content is still being finalised (more tests to be added), so
  // the perk list stays to only what's confirmed.
  mockRibbon: { ta: 'குரூப் 1 மாதிரி தேர்வுகள்', en: 'Group 1 Mock Tests' },
  mockBadge: { ta: '6 மாதிரி தேர்வுகள்', en: '6 Mock Tests' },
  mockTitle: { ta: 'குரூப் 1 மாதிரித் தேர்வு தொகுப்பு', en: 'Group 1 Mock Test Pack' },
  ctaMock: { ta: 'மாதிரி தேர்வுகள் பெறு', en: 'Get Mock Tests' },

  vettriRibbon: { ta: 'குரூப் 1 தேர்வுத் தொடர்', en: 'Group 1 Test Series' },
  vettriBadge: { ta: 'குரூப் 1 தேர்வுத் தொடர்', en: 'Group 1 Test Series' },
  vettriBannerTitle: { ta: 'குரூப் 1 தேர்வுத் தொடர் தொகுப்பு', en: 'Group 1 Test Series bundle' },
  scheduleInline: { ta: 'அட்டவணையை பதிவிறக்க (PDF)', en: 'download the schedule (PDF)' },
  ctaVettri: { ta: 'குரூப் 1 தேர்வுத் தொடர் பெறு', en: 'Get Group 1 Test Series' },

  rankBoosterRibbon: { ta: 'பரிந்துரைக்கப்படுகிறது', en: 'Recommended' },
  rankBoosterSeriesLabel: { ta: 'குரூப் 2 தேர்வுத் தொடர்', en: 'Group 2 Test Series' },
  ctaRankBooster: { ta: 'குரூப் II/IIA தேர்வுத் தொடரைப் பெறு', en: 'Get Group II/IIA Test Series' },

  premiumRibbon: { ta: 'பிரீமியம்', en: 'Premium' },
  premiumTitle: { ta: 'Premium Prelims Kit', en: 'Premium Prelims Kit' },
  ctaPremium: { ta: 'பிரீமியம் பெறு', en: 'Get Premium' },

  // Shared, consistent duration/payment terms across every paid tier.
  duration80: { ta: '80 நாள் அணுகல்', en: '80-day access' },
  duration60: { ta: '60 நாள் அணுகல்', en: '60-day access' },
  duration90: { ta: '90 நாள் அணுகல்', en: '90-day access' },
  duration180: { ta: '6 மாத அணுகல்', en: '6-month access' },
  oneTimePayment: { ta: 'ஒரே முறை கட்டணம்', en: 'one-time payment' },
} as const

// Mirrors what free accounts actually get (credit system: 50 on signup,
// 10/day on login expiring at IST end-of-day, 1 credit per question).
const FREE_ITEMS: { ta: string; en: string }[] = [
  {
    ta: 'பதிவு செய்தவுடன் 50 இலவச கிரெடிட்கள் + தினமும் 10 (ஒரு கேள்விக்கு 1 கிரெடிட்)',
    en: '50 free credits on signup + 10 daily (1 credit per question)',
  },
  {
    ta: 'கிரெடிட்களில் எந்தத் தேர்வும்: பாடங்கள், PYQ, நடப்பு நிகழ்வுகள், அப்டிட்யூட்',
    en: 'Use credits on any test: subjects, PYQ, Current Affairs, aptitude',
  },
  {
    ta: 'ஒரு முழு மாதிரி தேர்வு (200 வினாக்கள், Server-graded)',
    en: '1 full mock exam (200 questions, server-graded)',
  },
  {
    ta: 'ஒவ்வொரு வினாவிற்கும் திரையிலேயே விளக்கங்கள்',
    en: 'On-screen explanations for every question',
  },
]

// Group 1 mock-test pack - everything in Starter, plus the 6 mock tests.
// Only listing what's confirmed today; more tests are being added to this
// pack, so expand the first item once that content lands. NOTE: does NOT
// spread FREE_ITEMS wholesale - FREE_ITEMS[0] ("10 daily") would misstate
// this plan's real, bigger daily grant (DAILY_CREDIT_GRANT_BOOSTED = 50 in
// server/src/lib/credits.ts, applied server-side whenever bundleAccess()
// reports mockPack active), so that one line is replaced rather than reused.
const MOCK_ITEMS: { ta: string; en: string }[] = [
  { ta: '6 முழு நீள குரூப் 1 மாதிரித் தேர்வுகள் (Server-graded)', en: '6 full-length Group 1 mock tests (server-graded)' },
  {
    ta: '6 மாதிரித் தேர்வுகளுக்கான விளக்கங்கள் PDF ஆக பதிவிறக்கம் செய்யலாம் (திரையில் காட்டப்படாது)',
    en: 'Explanation PDF to download for the 6 mock tests (not shown on-screen)',
  },
  {
    ta: 'பதிவு செய்தவுடன் 50 இலவச கிரெடிட்கள் + இந்த திட்டம் செயலில் இருக்கும் வரை தினமும் 50 (வழக்கமான 10 க்கு பதிலாக)',
    en: '50 free credits on signup + 50 daily while this plan is active (instead of the usual 10)',
  },
  FREE_ITEMS[1],
  FREE_ITEMS[2],
  FREE_ITEMS[3],
]
const MOCK_ICONS = [ListChecks, Download, Gift, FileText, Trophy, ShieldCheck]

// What the Vettri Nichayam bundle unlocks — mirrors the in-app VettriCard.
// The first item gets an inline "download the schedule" link at render time.
const VETTRI_ITEMS: { ta: string; en: string }[] = [
  {
    ta: '13 மாதிரித் தேர்வுகள் (10 பிரிவு வாரியான / 3 முழு மாதிரி)',
    en: '13 mock tests (10 sectional / 3 full mock)',
  },
  {
    ta: 'வரம்பற்ற முந்தைய ஆண்டு (PYQ) தேர்வுகள்',
    en: 'Unlimited PYQ tests',
  },
  {
    ta: 'வரம்பற்ற நடப்பு நிகழ்வுத் தேர்வுகள்',
    en: 'Unlimited Current Affairs tests',
  },
  {
    ta: 'பாட வாரியான தேர்வு வினாக்கள் (3000+), வரம்பற்றது',
    en: 'Subject-wise test questions (3000+), unlimited',
  },
]

// Mirrors the in-app PremiumCard's tangible perks. Trimmed vs. PremiumCard's
// own full list: dropped "all future updates included" and "face the exam
// with confidence" (marketing lines, not a concrete deliverable), and
// "45-day revision plan" folds into "structured revision plan" — keeps this
// comparison card in line with the others instead of towering over them.
// Group 1 + Group 2 series are combined into one line (both ARE included:
// server/src/lib/premium.ts rankBoosterUnlocked = premiumActive ||
// rankBoosterActive, matches PremiumCard's own premiumPerk5/7) plus a call-out
// that future series are included too, for your plan duration.
const PREMIUM_ITEMS: { ta: string; en: string }[] = [
  {
    ta: 'குரூப் 1 & குரூப் 2 தேர்வுத் தொடர்கள் (13 + 23 தாள்கள்), மேலும் எதிர்கால அனைத்து தேர்வுத் தொடர்களும்',
    en: 'Group 1 & Group 2 Test Series (13 + 23 papers), plus every future test series',
  },
  { ta: 'வரம்பற்ற பயிற்சித் தேர்வுகள் & 6 மாதிரித் தேர்வுகள்', en: 'Unlimited practice tests & 6 mock exams' },
  { ta: 'முந்தைய ஆண்டு வினாத்தாள்கள் - கடந்த 5 ஆண்டுகள்', en: 'Previous-year papers - last 5 years' },
  { ta: 'நடப்பு நிகழ்வுகள் (ஆகஸ்ட் 2025 - ஜூன் 2026)', en: 'Current Affairs (Aug 2025 - Jun 2026)' },
  { ta: 'அப்டிட்யூட் & பிற பாடச் சுருக்கக் குறிப்புகள்', en: 'Aptitude & other-subject short notes' },
  { ta: '45-நாள் திட்டமிட்ட திருப்புதல் திட்டம்', en: '45-day structured revision plan' },
]

const VETTRI_ICONS = [Timer, FileText, Newspaper, ListChecks]
const PREMIUM_ICONS = [Trophy, ListChecks, FileText, Newspaper, Calculator, CalendarDays]
// One icon per Rank Booster perk/bonus row (RANK_BOOSTER_PERK_KEYS + _BONUS_KEYS):
// 23 papers · unlimited PYQ · unlimited CA · subject bank · bilingual explanations · Test 1 free.
const RANK_BOOSTER_ICONS = [ListChecks, FileText, Newspaper, ListChecks, Globe, Gift]

/** Big price + strikethrough MRP (only when a real one exists) + a
 *  consistent duration/payment sub-line — the same shape on every card,
 *  placed right under the title instead of buried in a badge or footer. */
function PriceBlock({
  price,
  mrp,
  duration,
}: {
  price: string
  mrp?: string
  duration: string
}) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-baseline gap-2">
        {mrp && <span className="font-body text-base text-ink2 line-through">{mrp}</span>}
        <span className="font-display text-3xl font-bold leading-none text-ink">{price}</span>
      </div>
      <p className="mt-1 font-body text-xs text-ink2">{duration}</p>
    </div>
  )
}

/**
 * The four pricing/plan cards (Free, Vettri Nichayam, Rank Booster, Premium),
 * in that order — shared by the main landing page and the /rank-booster
 * landing page so the promise (price, perks, copy) can never drift between
 * the two places it's shown. Self-contained: owns its own bilingual copy and
 * only needs `lang` plus where the generic "go to the app" CTAs should point
 * (Rank Booster always links to /rank-booster instead).
 *
 * Rank Booster is the visually elevated "recommended" tier (scaled up, ringed,
 * a floating badge) - a deliberate choice, not neutral comparison. Every
 * price sits in the same PriceBlock position on every card; only Rank
 * Booster has a real MRP to strike through (see the const comment above).
 */
export default function PricingCards({
  lang,
  webAppHref,
  onTrack,
}: {
  lang: Lang
  /** Where Free/Vettri/Premium CTAs go - typically isAuthed ? APP_URL : APP_REGISTER_URL. */
  webAppHref: string
  /** Optional click-tracking hook (source label per card). */
  onTrack?: (source: string) => void
}) {
  const t = (key: keyof typeof T) => T[key][lang]
  const gt = (key: StringKey) => translate(key, lang)
  const track = (source: string) => onTrack?.(source)
  // Below sm (640px, the grid's own first breakpoint) cards already render as
  // a single column - swap that flat stack for the same scroll-stacking
  // effect Profile's plan cards use (StackedCards), instead of a plain list.
  // Cards stay in a real CSS grid at sm+ since StackedCards' sticky-per-child
  // logic only makes sense for a single vertical column.
  const isMobile = !useMediaQuery('(min-width: 640px)')

  // Mock Pack is the one tier this shared component actually sells directly
  // (Free/Vettri/Premium CTAs just hand off to webAppHref; Rank Booster hands
  // off to its own /rank-booster page) - it has no other dedicated purchase
  // surface on the landing pages, so the CTA opens the real confirm→Razorpay
  // flow right here, same mechanics as RankBoosterCard/useRankBoosterPurchase.
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const mockPurchase = useMockPackPurchase()
  const handleMockCta = () => {
    if (!isAuthenticated) {
      window.location.href = webAppHref
      return
    }
    if (mockPurchase.mockPackUnlocked) {
      navigate('/test-arena')
      return
    }
    track('mock-card')
    mockPurchase.startEnroll()
  }

  const cards = [
    /* Free - the hook. Green = free & safe, the immediate reward. */
    <div key="free" className="card interactive relative flex h-full flex-col overflow-hidden p-5 ring-1 ring-correct/20">
        <div className="-mx-5 -mt-5 mb-4 bg-correct py-1 text-center font-heading text-2xs font-bold uppercase tracking-[0.14em] text-white">
          {t('freeRibbon')}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-tint-green px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-correct">
          <Check size={13} /> {t('freeTitle')}
        </span>
        <PriceBlock price={t('freePrice')} duration={t('freeDuration')} />
        <ul className="mt-3 space-y-2">
          {FREE_ITEMS.map((it) => (
            <li key={it.en} className="flex items-start gap-2">
              <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-tint-green text-correct">
                <Check size={13} />
              </span>
              <span className="font-body text-xs leading-tight text-ink">{it[lang]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <a
            href={webAppHref}
            onClick={() => track('free-card')}
            className="btn-ghost w-full justify-center px-6 py-2.5 text-sm font-bold"
          >
            {t('ctaFree')} <ArrowRight size={16} />
          </a>
        </div>
      </div>,

    /* Group 1 Mock Tests - a lighter, cheaper standalone pack (sky/blue,
       the app's "practice" tint). Content is still being finalised, so
       this list only claims what's confirmed today. */
    <div key="mock" className="card interactive relative flex h-full flex-col overflow-hidden p-5 ring-1 ring-sky/20">
        <div className="-mx-5 -mt-5 mb-4 bg-sky py-1 text-center font-heading text-2xs font-bold uppercase tracking-[0.14em] text-white">
          {t('mockRibbon')}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-tint-blue px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-sky">
          <ListChecks size={13} /> {t('mockBadge')}
        </span>
        <h3 className="mt-2 font-heading text-base font-semibold text-ink">{t('mockTitle')}</h3>
        <PriceBlock price={`₹${MOCK_PACK_PRICE_RUPEES}`} duration={`${t('duration80')} · ${t('oneTimePayment')}`} />
        <ul className="mt-3 space-y-2">
          {MOCK_ITEMS.map((it, i) => {
            const Icon = MOCK_ICONS[i] ?? Check
            const tint = TINTS[i % TINTS.length]
            return (
              <li key={it.en} className="flex items-start gap-2">
                <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                  <Icon size={12} />
                </span>
                <span className="font-body text-xs leading-tight text-ink2">{it[lang]}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto pt-4">
          <button
            onClick={handleMockCta}
            disabled={mockPurchase.paying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-sky px-5 py-2.5 font-heading text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
          >
            {t('ctaMock')} <ArrowRight size={16} />
          </button>
        </div>
      </div>,

    /* Vettri Nichayam - violet accent. */
    <div key="vettri" className="card interactive relative flex h-full flex-col overflow-hidden p-5 ring-1 ring-brand/20">
        <div className="-mx-5 -mt-5 mb-4 bg-brand py-1 text-center font-heading text-2xs font-bold uppercase tracking-[0.14em] text-white">
          {t('vettriRibbon')}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-brand">
          <Trophy size={13} /> {t('vettriBadge')}
        </span>
        <h3 className="mt-2 font-heading text-base font-semibold text-ink">{t('vettriBannerTitle')}</h3>
        <PriceBlock price={`₹${VETTRI_PRICE_RUPEES}`} duration={`${t('duration60')} · ${t('oneTimePayment')}`} />
        <ul className="mt-3 space-y-2">
          {VETTRI_ITEMS.map((it, i) => {
            const Icon = VETTRI_ICONS[i] ?? Check
            const tint = TINTS[i % TINTS.length]
            return (
              <li key={it.en} className="flex items-start gap-2">
                <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                  <Icon size={12} />
                </span>
                <span className="font-body text-xs leading-tight text-ink2">
                  {it[lang]}
                  {i === 0 && (
                    <>
                      {', '}
                      <a
                        href="/test-marathon-2026-schedule.pdf"
                        download="TNPSC-Mentors-Test-Marathon-2026-Schedule.pdf"
                        target="_blank"
                        rel="noopener"
                        onClick={() => track('schedule-download')}
                        className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 transition hover:decoration-brand"
                      >
                        {t('scheduleInline')}
                        <Download size={13} className="ml-1 inline-block align-[-1.5px]" />
                      </a>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto pt-4">
          <a
            href={webAppHref}
            onClick={() => track('vettri-card')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-5 py-2.5 font-heading text-sm font-bold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99]"
          >
            {t('ctaVettri')} <ArrowRight size={16} />
          </a>
        </div>
      </div>,

    /* Rank Booster - the recommended hero tier. Deliberately elevated:
       scaled up, a floating "Recommended" badge, a stronger ring/shadow -
       not a neutral 4th option. Perks pulled from the shared global i18n
       keys (gt) so this promise can never drift from RankBoosterCard. */
    <div key="rankbooster" className="relative lg:z-10 lg:scale-[1.02]">
        <span className="absolute -top-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accentwarm px-3 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white shadow-lg">
          <Sparkles size={12} /> {t('rankBoosterRibbon')}
        </span>
        <div className="card relative flex h-full flex-col overflow-hidden p-5 pt-6 shadow-2xl ring-2 ring-accentwarm">
          <span className="inline-flex items-center gap-2 rounded-full bg-accentwarmsoft px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-accentwarm">
            <Rocket size={13} /> {gt('rankBoosterBadge')}
          </span>
          <h3 className="mt-2 font-heading text-base font-semibold text-ink">{gt('rankBoosterTitle')}</h3>
          <p className="mt-1 font-heading text-xs font-semibold text-accentwarm">{t('rankBoosterSeriesLabel')}</p>
          <PriceBlock
            price={`₹${RANK_BOOSTER_PRICE_RUPEES}`}
            mrp={`₹${RANK_BOOSTER_MRP_RUPEES}`}
            duration={`${t('duration90')} · ${t('oneTimePayment')}`}
          />
          <ul className="mt-3 space-y-2">
            {[...RANK_BOOSTER_PERK_KEYS, ...RANK_BOOSTER_BONUS_KEYS].map((k, i) => {
              const Icon = RANK_BOOSTER_ICONS[i] ?? Check
              const tint = TINTS[i % TINTS.length]
              return (
                <li key={k} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                    <Icon size={12} />
                  </span>
                  <span className="font-body text-xs leading-tight text-ink2">
                    {gt(k)}
                    {i === 0 && (
                      <>
                        {', '}
                        <a
                          href="/rank-booster-2026-schedule.pdf"
                          download="TNPSC-Mentors-Rank-Booster-2026-Schedule.pdf"
                          target="_blank"
                          rel="noopener"
                          onClick={() => track('rankbooster-schedule-download')}
                          className="font-semibold text-accentwarm underline decoration-accentwarm/40 underline-offset-2 transition hover:decoration-accentwarm"
                        >
                          {t('scheduleInline')}
                          <Download size={13} className="ml-1 inline-block align-[-1.5px]" />
                        </a>
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-auto pt-4">
            <a
              href="/rank-booster"
              onClick={() => track('rankbooster-card')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-accentwarm px-5 py-2.5 font-heading text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
            >
              {t('ctaRankBooster')} <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>,

    /* Inside the app - the full Prelims Kit. Gold = achievement/value. */
    <div key="premium" className="card interactive relative flex h-full flex-col overflow-hidden p-5 ring-1 ring-gold/20">
        <div className="-mx-5 -mt-5 mb-4 bg-gold py-1 text-center font-heading text-2xs font-bold uppercase tracking-[0.14em] text-white">
          {t('premiumRibbon')}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-goldsoft px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-gold">
          <Lock size={13} /> {t('premiumTitle')}
        </span>
        <PriceBlock price={`₹${PREMIUM_PRICE_RUPEES}`} duration={`${t('duration180')} · ${t('oneTimePayment')}`} />
        <ul className="mt-3 space-y-2">
          {PREMIUM_ITEMS.map((it, i) => {
            const Icon = PREMIUM_ICONS[i] ?? Check
            const tint = TINTS[i % TINTS.length]
            return (
              <li key={it.en} className="flex items-start gap-2">
                <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-lg ${tint.bg} ${tint.fg}`}>
                  <Icon size={12} />
                </span>
                <span className="font-body text-xs leading-tight text-ink2">{it[lang]}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto pt-4">
          <a
            href={webAppHref}
            onClick={() => track('premium-card')}
            className="flex w-full items-center justify-center gap-2 rounded-pill bg-gold px-5 py-2.5 font-heading text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
          >
            {t('ctaPremium')} <ArrowRight size={16} />
          </a>
        </div>
      </div>,
  ]

  return (
    <>
      {isMobile ? (
        <StackedCards>{cards}</StackedCards>
      ) : (
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cards}</div>
      )}

      {/* Pre-payment recap for the Mock Pack CTA above - opens Razorpay only
          once the buyer confirms, same pattern as every other paid-plan card. */}
      <PurchaseConfirmModal
        open={mockPurchase.confirmOpen}
        planName={t('mockTitle')}
        validity={`${t('duration80')} · ${t('oneTimePayment')}`}
        perks={MOCK_ITEMS.map((it) => it[lang])}
        priceLabel={mockPurchase.isFree ? gt('premiumFree') : mockPurchase.displayPrice}
        isFree={mockPurchase.isFree}
        accent="sky"
        busy={mockPurchase.paying}
        onConfirm={mockPurchase.handleBuy}
        onCancel={() => mockPurchase.setConfirmOpen(false)}
      />
    </>
  )
}
