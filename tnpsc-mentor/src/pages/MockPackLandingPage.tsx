import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Trophy,
  FileText,
  Download,
  ArrowRight,
  Check,
  Gift,
  ShieldCheck,
  Sun,
  Moon,
  Languages,
  Lock,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useThemeStore } from '../store/themeStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../hooks/useMockPackPurchase'
import { MOCK_ITEMS } from '../components/Landing/PricingCards'
import { usePlanSales } from '../hooks/usePlanSales'
import { trackViewContent, trackInitiateCheckout } from '../lib/tracking'
import { isAndroidWebView, openInBrowser } from '../lib/webview'

type Lang = 'ta' | 'en'

const SUPPORT_EMAIL = 'support@tnpscmentors.in'

// ─── Bilingual copy ──────────────────────────────────────────────────────────
const T = {
  signIn: { ta: 'உள்நுழைய', en: 'Sign in' },
  dashboard: { ta: 'Dashboard', en: 'Dashboard' },

  eyebrow: { ta: 'குரூப் 1 மாதிரித் தேர்வுத் தொகுப்பு', en: 'Group 1 Mock Test Pack' },
  title: {
    ta: 'குரூப் 1-ஐ 6 முழு நீள மாதிரித் தேர்வுகளால் சோதித்துப் பாருங்க',
    en: 'Test yourself on Group 1 with 6 full-length mock papers',
  },
  sub: {
    ta: 'ஒரே ஒரு கட்டணம். மாதிரித் தேர்வுகள் + வரம்பற்ற குரூப் 1 PYQ — கிரெடிட்டே கழிக்கப்படாது.',
    en: 'One payment. The mock papers plus unlimited Group 1 PYQs, with no credits deducted.',
  },

  // The two perks this page exists to sell, said short enough to fit one
  // screen. The longer, canonical wording of both still ships verbatim in the
  // supporting list below (MOCK_ITEMS), so nothing here is the only place a
  // claim is made.
  perk1Title: { ta: '6 முழு நீள மாதிரித் தேர்வுகள்', en: '6 full-length mock tests' },
  perk1Body: {
    ta: 'தலா 200 வினாக்கள், real exam pattern-ல், server-graded.',
    en: '200 questions each, server-graded, in the real exam pattern.',
  },
  perk2Title: { ta: 'வரம்பற்ற குரூப் 1 PYQ', en: 'Unlimited Group 1 PYQs' },
  perk2Body: {
    ta: 'முந்தைய ஆண்டு வினாத்தாள்கள் அனைத்தும் — ஒரு கிரெடிட் கூட கழிக்கப்படாது.',
    en: 'Every previous-year paper, year- and topic-wise. No credits deducted, ever.',
  },

  priceBadge: {
    ta: '6 மாதிரித் தேர்வுகள் + குரூப் 1 PYQ',
    en: '6 Mock Tests + Group 1 PYQ',
  },

  alsoIncluded: { ta: 'இதனுடன் சேர்ந்து', en: 'Also included' },

  priceValidity: { ta: '80 நாள் அணுகல் · ஒரே முறை கட்டணம்', en: '80-day access · one-time payment' },
  payCta: { ta: `₹${MOCK_PACK_PRICE_RUPEES} செலுத்து`, en: `Pay ₹${MOCK_PACK_PRICE_RUPEES}` },
  paying: { ta: 'திறக்கிறது…', en: 'Opening…' },
  secure: {
    ta: 'Razorpay மூலம் பாதுகாப்பான கட்டணம் · UPI, card, netbanking',
    en: 'Secure payment via Razorpay · UPI, cards, netbanking',
  },
  ownedTitle: { ta: 'இது ஏற்கனவே உங்களுக்கு உண்டு', en: 'You already have this' },
  ownedCta: { ta: 'மாதிரித் தேர்வுகளைப் பார்க்க', en: 'Open the mock tests' },

  offSaleTitle: { ta: 'இந்தத் தொகுப்பு தற்போது விற்பனையில் இல்லை', en: 'This pack is not on sale right now' },
  offSaleCta: { ta: 'மற்ற திட்டங்களைப் பார்க்க', en: 'See the other plans' },

  privacy: { ta: 'தனியுரிமை', en: 'Privacy' },
  payment: { ta: 'கட்டணக் கொள்கை', en: 'Payment policy' },
  refund: { ta: 'பணம் திரும்ப', en: 'Refunds' },
} as const

// The three supporting lines, taken verbatim from the shared pack copy so this
// page can never promise something the pricing grid and the in-app card do
// not. Indices 0 and 1 are the two headline perks above, and index 4 ("use
// credits on any test") is the free tier's line - neither belongs here.
const SUPPORTING_INDEXES = [2, 3, 5] as const
const SUPPORTING_ICONS = [Download, Gift, ShieldCheck]

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * The ₹399 Group 1 Mock Test Pack, on a page that sells nothing else.
 *
 * Deliberately one screen: the offer, the price and the pay button are all
 * visible without scrolling at ordinary phone and desktop sizes, because this
 * is an ad/WhatsApp landing target where a buyer arrives already knowing what
 * they came for. It does NOT scale down to fit at any cost - if the content
 * genuinely cannot fit (a very short viewport, a large font scale, Tamil at
 * 320px), the page scrolls rather than clipping anything, since a cut-off
 * price is worse than a scrollbar.
 *
 * Sibling to the long-form landing pages (/group-1, /rank-booster) rather than
 * a replacement for them: those pitch a choice between products, this one
 * closes a single, already-chosen purchase.
 */
export default function MockPackLandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth()
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const { mockPack, loaded, refresh } = useEntitlementsStore()
  const purchase = useMockPackPurchase()
  const sales = usePlanSales()

  const [lang, setLang] = useState<Lang>('ta')
  const t = (key: keyof typeof T) => T[key][lang]

  useEffect(() => {
    trackViewContent({ contentName: 'MockPack399PayLink', contentCategory: 'landing' })
  }, [])

  useEffect(() => {
    document.title =
      lang === 'ta'
        ? `குரூப் 1 மாதிரித் தேர்வுகள் - ₹${MOCK_PACK_PRICE_RUPEES}`
        : `Group 1 Mock Test Pack - ₹${MOCK_PACK_PRICE_RUPEES}`
  }, [lang])

  useEffect(() => {
    if (isAuthenticated && !loaded) refresh()
  }, [isAuthenticated, loaded, refresh])

  const owned = isAdmin || isSuperAdmin || (loaded && mockPack)
  const offSale = sales.ready && !sales.mockPack

  /**
   * Straight to Razorpay - no pre-payment recap in between.
   *
   * Every other purchase surface opens PurchaseConfirmModal first, and for
   * good reason: on a long landing page or a dashboard card the buyer cannot
   * see the whole promise at the moment they tap. Here they can - the perks,
   * the validity and the price are all on the same screen as the button, which
   * is exactly what that recap exists to guarantee. Re-stating it in a popup
   * would only add a tap.
   *
   * To restore the app-wide behaviour, call purchase.startEnroll() instead and
   * render <PurchaseConfirmModal> wired to purchase.handleBuy, the way
   * Group1LandingPage does.
   */
  const pay = () => {
    if (purchase.paying) return
    trackInitiateCheckout({
      value: MOCK_PACK_PRICE_RUPEES,
      description: 'Group 1 Mock Test Pack - 80 days',
    })
    purchase.handleBuy()
  }

  const goAuth = () => {
    // A guest has to come back HERE after signing up, not be dropped into the
    // app having forgotten what they came to buy. Router state cannot survive
    // the WebView -> browser handoff, so the return path rides in a query
    // param too (sanitizeFromPath validates it at the far end).
    const back = location.pathname
    if (isAndroidWebView) return openInBrowser(`/register?from=${back}`)
    navigate('/register', { state: { from: { pathname: back } } })
  }

  const handleCta = () => {
    if (!isAuthenticated) return goAuth()
    if (owned) return navigate('/test-series?tab=vettri&g1=mock')
    if (offSale) return navigate('/test-arena')
    pay()
  }

  // A guest who signed up mid-purchase and got routed back lands here with
  // autoEnroll set - so finish what they started instead of making them find
  // the button again. Once per arrival, and never for someone who already owns
  // the pack or when it is off sale.
  const resumed = useRef(false)
  useEffect(() => {
    if (!isAuthenticated || !loaded || !sales.ready) return
    if (!(location.state as { autoEnroll?: boolean } | null)?.autoEnroll) return
    navigate(location.pathname, { replace: true, state: null })
    if (resumed.current || owned || !sales.mockPack) return
    resumed.current = true
    pay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loaded, sales.ready, sales.mockPack, owned])

  return (
    // min-h rather than h: the page fills one screen and centres in it, but a
    // viewport too short for the content gets a scrollbar instead of a crop.
    <div className="flex min-h-[100dvh] flex-col overflow-x-clip bg-canvas">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6 sm:py-2.5">
          <a href="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo-mark.png" alt="TNPSC Mentors" className="h-8 w-8 shrink-0 object-contain" />
            <span className="hidden whitespace-nowrap font-heading text-sm font-semibold tracking-tight text-ink sm:inline">
              TNPSC <span className="text-brand">Mentors</span>
            </span>
          </a>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
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
              className="icon-btn hidden h-8 w-8 sm:grid"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <a
              href={isAuthenticated ? '/test-arena' : '/login'}
              className="btn-soft shrink-0 px-2.5 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm"
            >
              {isAuthenticated ? t('dashboard') : t('signIn')}
            </a>
          </div>
        </div>
      </header>

      {/* ─── The offer, on one screen ─────────────────────────────────────── */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-3 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky/20 blur-[110px]" />
          <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-brand/20 blur-[110px]" />
        </div>

        <div className="grid w-full max-w-5xl items-center gap-4 sm:gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:gap-10">
          {/* Left - what it is */}
          <div>
            <span className="tamil inline-flex items-center gap-1.5 rounded-full bg-tint-blue px-3 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-sky">
              <Trophy size={12} /> {t('eyebrow')}
            </span>
            <h1 className="tamil mt-2.5 font-heading text-[1.2rem] font-bold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[1.7rem] lg:text-[1.9rem]">
              {t('title')}
            </h1>
            {/* Restates the two perk tiles directly below, so it is the first
                thing to go when vertical space is scarce - dropping it on
                phones is what keeps the pay button in the first screen. */}
            <p className="tamil mt-2 hidden font-body text-sm leading-relaxed text-ink2 sm:block">{t('sub')}</p>

            {/* The two headline perks, given real estate rather than a bullet.
                Two columns at EVERY width, not just sm+: stacked, these two
                tiles alone cost ~240px on a phone and pushed the price card
                below the fold. */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { icon: Trophy, tint: 'bg-tint-blue text-sky', title: t('perk1Title'), body: t('perk1Body') },
                { icon: FileText, tint: 'bg-tint-green text-correct', title: t('perk2Title'), body: t('perk2Body') },
              ].map(({ icon: Icon, tint, title, body }) => (
                <div key={title} className="card p-3 sm:p-4">
                  <span className={`grid h-9 w-9 place-items-center rounded-tile ${tint}`}>
                    <Icon size={17} />
                  </span>
                  <h2 className="tamil mt-2.5 font-heading text-sm font-semibold leading-snug text-ink">{title}</h2>
                  <p className="tamil mt-1 font-body text-xs leading-snug text-ink2">{body}</p>
                </div>
              ))}
            </div>

          </div>

          {/* Right - price and the one button */}
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
            <div className="card overflow-hidden p-4 shadow-card ring-1 ring-sky/25 sm:p-6">
              <div className="tamil -mx-4 -mt-4 mb-3 bg-gradient-to-r from-sky to-brand px-2 py-2 text-center font-heading text-2xs font-bold uppercase leading-tight text-white sm:-mx-6 sm:-mt-6 sm:mb-4">
                {t('priceBadge')}
              </div>

              <p className="text-center font-display text-4xl font-bold leading-none tracking-tight text-ink sm:text-5xl">
                ₹{MOCK_PACK_PRICE_RUPEES}
              </p>
              <p className="tamil mt-1.5 text-center font-body text-xs text-ink2 sm:mt-2">{t('priceValidity')}</p>

              {offSale ? (
                <>
                  <p className="tamil mt-4 flex items-center justify-center gap-1.5 rounded-field bg-tint px-3 py-2.5 text-center font-body text-xs font-semibold text-ink2">
                    <Lock size={13} className="shrink-0" /> {t('offSaleTitle')}
                  </p>
                  <a href="/group-1" className="btn-wrap btn-soft mt-3 w-full justify-center px-6 py-3 text-sm">
                    {t('offSaleCta')} <ArrowRight size={16} />
                  </a>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCta}
                    disabled={purchase.paying}
                    className="btn-wrap mt-4 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-sky px-6 py-3 font-heading text-base font-bold text-white sm:py-3.5 shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                  >
                    {purchase.paying ? (
                      <>
                        <Loader2 size={17} className="shrink-0 animate-spin" /> {t('paying')}
                      </>
                    ) : owned ? (
                      <>
                        {t('ownedCta')} <ArrowRight size={17} className="shrink-0" />
                      </>
                    ) : (
                      <>
                        {t('payCta')} <ArrowRight size={17} className="shrink-0" />
                      </>
                    )}
                  </button>
                  <p className="tamil mt-2.5 flex items-start justify-center gap-1.5 text-center font-body text-2xs leading-snug text-ink2">
                    <ShieldCheck size={12} className="mt-0.5 shrink-0 text-correct" />
                    {owned ? t('ownedTitle') : t('secure')}
                  </p>
                </>
              )}
            </div>

            {/* Supporting lines - verbatim shared copy, compact. Sits UNDER the
                price card rather than in the left column so that the single
                mobile column reads copy -> price + pay -> detail: the button
                stays in the first screen and this is what falls below it. */}
            <p className="tamil mt-4 font-heading text-2xs font-bold uppercase tracking-[0.14em] text-ink2">
              {t('alsoIncluded')}
            </p>
            <ul className="mt-2 space-y-1.5">
              {SUPPORTING_INDEXES.map((idx, i) => {
                const Icon = SUPPORTING_ICONS[i] ?? Check
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-tint text-ink2">
                      <Icon size={10} />
                    </span>
                    <span className="tamil font-body text-xs leading-snug text-ink2">{MOCK_ITEMS[idx][lang]}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </main>

      {/* ─── Footer - one line, so it costs almost no vertical space ──────── */}
      <footer className="shrink-0 border-t border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 font-body text-2xs text-ink2 sm:justify-between sm:px-6">
          <span className="tamil">© 2026 TNPSC Mentors</span>
          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a href="/privacy" className="tamil transition hover:text-brand-dark">{t('privacy')}</a>
            <a href="/payment-policy" className="tamil transition hover:text-brand-dark">{t('payment')}</a>
            <a href="/refund-policy" className="tamil transition hover:text-brand-dark">{t('refund')}</a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="transition hover:text-brand-dark">{SUPPORT_EMAIL}</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
