import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Rocket, Trophy, Download, ListChecks } from 'lucide-react'
import PremiumCard from '../components/UI/PremiumCard'
import VettriCard, { VETTRI_PRICE_RUPEES } from '../components/UI/VettriCard'
import RankBoosterCard, {
  RANK_BOOSTER_MRP_RUPEES,
  RANK_BOOSTER_PRICE_RUPEES,
} from '../components/UI/RankBoosterCard'
import {
  useRankBoosterPurchase,
  rupees,
  RANK_BOOSTER_PERK_KEYS,
  RANK_BOOSTER_BONUS_KEYS,
} from '../hooks/useRankBoosterPurchase'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../hooks/useMockPackPurchase'
import { seriesTap, mockTap, mockEntryVisible, showsPrice } from '../lib/g1Access'
import TestSeriesProductPanel from '../components/TestSeries/TestSeriesProductPanel'
import FullMockExamList from '../components/TestSeries/FullMockExamList'
import TestSeriesAnalyticsView from '../components/TestSeries/TestSeriesAnalyticsView'
import { SkeletonAnalytics } from '../components/UI/Skeleton'
import { fetchTestSeriesAnalyticsOverall, type TestSeriesAnalytics } from '../lib/testSeriesAnalytics'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { upsell } from '../store/upsellStore'
import { useTestSeriesEnabled } from '../hooks/useTestSeriesEnabled'
import { useRankBoosterEnabled } from '../hooks/useRankBoosterEnabled'
import { usePlanSales } from '../hooks/usePlanSales'
import PurchaseConfirmModal from '../components/UI/PurchaseConfirmModal'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

type HubTab = 'vettri' | 'rankbooster' | 'overall'
/** Within the Group 1 tab: the scheduled series, or the full mock papers. */
type G1View = 'series' | 'mock'

/**
 * The "Test Marathon" hub: one Test Arena tile fanning out into every
 * scheduled test-series product. Each product (Vettri Nichayam = the Group 1
 * Marathon papers, Rank Booster = Group II/IIA) is its own tab, rendered by
 * the shared `TestSeriesProductPanel` (Papers/Analytics sub-tabs, its own
 * paywall). The third tab is combined analytics across every product.
 */
export default function TestSeriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  // Staff always get `premium: true` back from the server (they can preview
  // any exam's content without buying) — so without this, "preview as student"
  // could never actually show an admin the paywall/buy-popup a real free
  // learner would see on this page. See TestSeriesProductPanel's `previewLocked`.
  const { previewAsStudent } = useAuth()
  const marathonOn = useTestSeriesEnabled()
  const rankBoosterOn = useRankBoosterEnabled()
  // Which plans are on sale - decides whether each product's paywall popup
  // has anything in it. The cards themselves hide on the same flags.
  const sales = usePlanSales()

  // A caller (e.g. the Group 1 Test Series discovery banner on Test Arena) can
  // request a starting tab via router state — otherwise default to Group
  // II/IIA (Rank Booster), which leads the hub.
  const requestedTab = (location.state as { tab?: HubTab } | null)?.tab

  // Where you were lives in the URL, so a reload (or a shared link, or the
  // browser restoring the tab) comes back to the same place instead of
  // silently resetting to the hub's default. Router state still wins when a
  // caller asked for a specific tab, since that is a deliberate hand-off from
  // another page.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlG1View: G1View = searchParams.get('g1') === 'mock' ? 'mock' : 'series'
  const urlTab = searchParams.get('tab')
  const initialTab: HubTab =
    requestedTab ??
    (urlTab === 'vettri' || urlTab === 'rankbooster' || urlTab === 'overall'
      ? urlTab
      : // A ?g1=mock link implies the Group 1 tab even without ?tab, so the
        // mock papers are not restored behind a tab that is not showing them.
        urlG1View === 'mock'
        ? 'vettri'
        : 'rankbooster')

  const [tab, setTabState] = useState<HubTab>(initialTab)
  const [g1View, setG1ViewState] = useState<G1View>(urlG1View)

  /** Write the current position into the URL (replace: no history spam from a
   *  view switch), mirroring how the PYQ pages carry their own filters. */
  const syncUrl = (nextTab: HubTab, nextView: G1View) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    if (nextTab === 'vettri' && nextView === 'mock') next.set('g1', 'mock')
    else next.delete('g1')
    setSearchParams(next, { replace: true })
  }

  /**
   * Move to a tab AND a Group 1 view in one step.
   *
   * Everything goes through here rather than calling the two setters in
   * sequence: React batches the state updates, so a second setter would still
   * read the PRE-update `tab`/`g1View` from this render's closure and write a
   * stale pair into the URL — leaving the address bar pointing at the place you
   * just left, which is precisely what a reload would then restore.
   */
  const goTo = (nextTab: HubTab, nextView: G1View) => {
    setTabState(nextTab)
    setG1ViewState(nextView)
    syncUrl(nextTab, nextView)
  }
  const setG1View = (next: G1View) => goTo(next === 'mock' ? 'vettri' : tab, next)
  // Both flags default false until the settings fetch resolves. If whichever
  // tab we're sitting on turns out to be off, land on the other one instead —
  // only fires on that one resolution, never overrides a manual tab click.
  useEffect(() => {
    // setTabState, not setTab: this is a correction for a product being off,
    // not a place the user chose, so it must not rewrite their URL.
    if (!rankBoosterOn && marathonOn) setTabState('vettri')
    else if (!marathonOn && rankBoosterOn) setTabState('rankbooster')
  }, [marathonOn, rankBoosterOn])

  // Click-and-drag-to-scroll for the promo banner stack below: a mouse user can
  // grab anywhere on a banner and drag to scroll the page, not just the edge
  // scrollbar. Touch/pen are left alone (they already scroll natively). A tiny
  // movement is still treated as a tap so the banners' own buttons keep working.
  const bannerDrag = useRef({ down: false, startY: 0, startScroll: 0, dragged: false })
  const onBannerPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    bannerDrag.current = { down: true, startY: e.clientY, startScroll: window.scrollY, dragged: false }
  }
  const onBannerPointerMove = (e: ReactPointerEvent) => {
    const s = bannerDrag.current
    if (!s.down) return
    const delta = e.clientY - s.startY
    if (Math.abs(delta) > 4) s.dragged = true
    if (s.dragged) window.scrollTo({ top: s.startScroll - delta })
  }
  const endBannerDrag = () => {
    bannerDrag.current.down = false
  }
  // Capture-phase: swallow the click that would otherwise fire on a banner
  // button right after a drag, so dragging never doubles as "buy this".
  const onBannerClickCapture = (e: React.MouseEvent) => {
    if (bannerDrag.current.dragged) {
      e.preventDefault()
      e.stopPropagation()
      bannerDrag.current.dragged = false
    }
  }

  const unlimited = useEntitlementsStore((s) => s.unlimited)
  const rankBoosterUnlocked = useEntitlementsStore((s) => s.rankBoosterUnlocked)
  const mockPack = useEntitlementsStore((s) => s.mockPack)
  const rbPurchase = useRankBoosterPurchase()
  const mockPurchase = useMockPackPurchase()

  // ─── The two Group 1 entry points ──────────────────────────────────────────
  // Which product each button opens and which it sells lives in lib/g1Access,
  // pinned by tests: the failure modes here are silent (a paying customer sent
  // to buy what they own, or a free learner walked into paid content).
  const entitlement = { unlimited, mockPack }
  const seriesAction = seriesTap(entitlement, sales)
  const mockAction = mockTap(entitlement, sales)
  const showMockEntry = mockEntryVisible(entitlement, sales)

  const [overall, setOverall] = useState<TestSeriesAnalytics | null>(null)
  useEffect(() => {
    if (tab !== 'overall' || overall) return
    fetchTestSeriesAnalyticsOverall()
      .then(setOverall)
      .catch(() => undefined)
  }, [tab, overall])

  const tabs: { key: HubTab; label: string }[] = [
    ...(rankBoosterOn ? [{ key: 'rankbooster' as const, label: t('testSeriesTabG2') }] : []),
    ...(marathonOn ? [{ key: 'vettri' as const, label: t('testSeriesTabG1') }] : []),
    { key: 'overall' as const, label: t('tsOverallTab') },
  ]

  // The schedule download sits IN THE SAME ROW as the tab capsule (not
  // stacked inside whichever panel is open), so it stays put across tab
  // switches instead of jumping around — swaps target per the active tab.
  // Hidden on the Group 1 MOCK view: this is the scheduled series' calendar,
  // and the mock papers have no schedule — offering that download beside them
  // would be handing over a timetable for a different product.
  const schedule: { href: string; filename: string; buttonClassName: string } | null =
    tab === 'vettri' && g1View === 'series'
      ? {
          href: '/test-marathon-2026-schedule.pdf',
          filename: 'TNPSC-Mentors-Test-Marathon-2026-Schedule.pdf',
          buttonClassName: 'bg-brand text-white shadow-brand hover:brightness-105',
        }
      : tab === 'rankbooster'
        ? {
            href: '/rank-booster-2026-schedule.pdf',
            filename: 'TNPSC-Mentors-Rank-Booster-2026-Schedule.pdf',
            buttonClassName: 'bg-accentwarm text-white shadow-warm hover:brightness-105',
          }
        : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate('/test-arena')}
        className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} /> {t('testArena')}
      </button>

      <header className="mb-6 mt-4">
        <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
          {tab === 'vettri'
            ? g1View === 'mock'
              ? t('mockTest')
              : t('testSeriesTitle')
            : t('testSeriesHubTitle')}
        </h1>
        <p className="tamil mt-1 font-body text-base text-muted">{t('testSeriesHubSub')}</p>
      </header>

      <div
        onPointerDown={onBannerPointerDown}
        onPointerMove={onBannerPointerMove}
        onPointerUp={endBannerDrag}
        onPointerLeave={endBannerDrag}
        onClickCapture={onBannerClickCapture}
        className="cursor-grab active:cursor-grabbing"
      >
      {/* Pinned to its own tab — the ₹1249 price only ever appears on the
          Group II/IIA tab. Stays a real button while locked (tap starts the
          purchase flow); once unlocked it's a plain info strip like the
          Group 1 banner below. */}
      {rankBoosterOn && tab === 'rankbooster' && !rbPurchase.rankBoosterUnlocked && (
        <button
          type="button"
          onClick={rbPurchase.startEnroll}
          disabled={rbPurchase.paying}
          className="mb-6 flex w-full items-center gap-3 rounded-card bg-gradient-to-r from-accentwarm to-gold px-4 py-3 text-left text-white transition hover:brightness-105 disabled:opacity-60"
        >
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <Rocket size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-bold tracking-tight">
              {t('rankBoosterBannerTitle')}
            </span>
            <span className="tamil mt-0.5 block font-body text-xs text-white/85">
              {t('rankBoosterBannerSub')}
            </span>
          </span>
          <span className="flex flex-shrink-0 flex-col items-end rounded-pill bg-white/15 px-3 py-1.5">
            <span className="font-body text-2xs text-white/70 line-through">₹{RANK_BOOSTER_MRP_RUPEES}</span>
            <span className="font-heading text-sm font-bold">₹{RANK_BOOSTER_PRICE_RUPEES}</span>
          </span>
        </button>
      )}
      {rankBoosterOn && tab === 'rankbooster' && rbPurchase.rankBoosterUnlocked && (
        <div className="mb-6 flex w-full items-center gap-3 rounded-card bg-gradient-to-r from-accentwarm to-gold px-4 py-3 text-white">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <Rocket size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-bold tracking-tight">
              {t('rankBoosterBannerTitle')}
            </span>
            <span className="tamil mt-0.5 block font-body text-xs text-white/85">
              {t('rankBoosterBannerSub')}
            </span>
          </span>
        </div>
      )}

      {/* The two Group 1 products, side by side, because they are two different
          purchases that lead to two different places: the ₹1,899 scheduled
          series (13 dated papers, on this page) and the ₹399 mock pack (6
          full-length papers, on /mock). One combined banner could only ever
          point at one of them, which left the pack with no entry point here at
          all.

          Each button is an owner's shortcut OR a pitch, never both: it shows a
          price only while the account can still buy that plan, and otherwise
          just opens the thing. Stacks on mobile. */}
      {(marathonOn || showMockEntry) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {marathonOn && (
            <G1Entry
              icon={<Trophy size={20} />}
              title={t('testSeriesTabG1')}
              sub={t('marathonBannerSub')}
              price={showsPrice(seriesAction) ? `₹${VETTRI_PRICE_RUPEES}` : null}
              className="bg-gradient-to-r from-brand to-brand-dark"
              // A ₹1,899 (or Premium) owner lands on the papers; anyone who can
              // still buy gets the same upsell the locked panel opens.
              onClick={() => {
                if (seriesAction === 'buy') return upsell.bundle()
                goTo('vettri', 'series')
              }}
            />
          )}
          {showMockEntry && (
            <G1Entry
              icon={<ListChecks size={20} />}
              title={t('g1MockTestTitle')}
              sub={t('mockPackBannerSub')}
              price={showsPrice(mockAction) ? `₹${MOCK_PACK_PRICE_RUPEES}` : null}
              className="bg-gradient-to-r from-sky to-brand"
              // A ₹399 owner goes straight to the mock papers. So does anyone
              // whose plan already includes them (server-side mockUnlocked is
              // premium || mockPack || vettri) — and so does a learner while
              // the pack is off sale, since /mock carries its own paywall.
              onClick={() => {
                if (mockAction === 'buy') return mockPurchase.startEnroll()
                // Stays on this page: the mock papers now live under the Group
                // 1 tab, so sending the tap to /mock would walk the learner out
                // of the hub they just chose a product in.
                goTo('vettri', 'mock')
              }}
              busy={mockPurchase.paying}
            />
          )}
        </div>
      )}

      </div>

      {/* Tab capsule + schedule download sit in one row ("parallel") on wide
          screens; on mobile they wrap onto their own full-width rows instead
          of overlapping or squeezing the tab labels. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex w-full rounded-field bg-tint p-0.5 sm:w-auto sm:flex-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => goTo(key, 'series')}
              aria-pressed={tab === key}
              className={`flex-1 rounded-[10px] px-3 py-1.5 text-center font-heading text-xs font-semibold leading-tight transition-colors sm:flex-none ${
                tab === key ? 'bg-card text-brand shadow-sm' : 'text-ink2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {schedule && (
          <a
            href={schedule.href}
            download={schedule.filename}
            target="_blank"
            rel="noopener"
            className={`tamil inline-flex w-full items-center justify-center gap-2 rounded-pill px-4 py-2 font-heading text-xs font-bold transition sm:w-auto ${schedule.buttonClassName}`}
          >
            <Download size={14} /> {t('downloadSchedule')}
          </a>
        )}
      </div>

      {tab === 'vettri' && marathonOn && (
        <>
          {/* The two Group 1 products as a centred pair, mock papers first.
              Both are always on screen, so whichever you are not looking at is
              always one tap away — the earlier single flipping button made the
              destination visible but hid the fact that a choice existed at all.

              Joined into one control on a shared track, so they read as two
              halves of a single choice rather than two unrelated actions. The
              view you are on is the solid half, in that product's own colour
              (sky = mock pack, brand = scheduled series).

              Opening the mock papers also raises the ₹399 confirm sheet for
              anyone who has not bought them, leaving the papers visible behind
              the ask. Skipped for an owner — mockAction is already 'open' once
              the pack, Vettri or Premium is active, and asking someone to pay
              for what they bought reads as a double charge. */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-stretch rounded-pill bg-tint p-1">
              <button
                type="button"
                onClick={() => {
                  setG1View('mock')
                  if (mockAction === 'buy') mockPurchase.startEnroll()
                }}
                disabled={mockPurchase.paying}
                aria-pressed={g1View === 'mock'}
                className={`tamil btn-wrap inline-flex items-center gap-2 rounded-pill px-4 py-2 text-center font-heading text-sm font-bold transition disabled:opacity-60 ${
                  g1View === 'mock' ? 'bg-sky text-white shadow-sm' : 'text-ink2 hover:text-ink'
                }`}
              >
                <ListChecks size={16} className="flex-shrink-0" />
                {t('g1MockTestTitle')}
              </button>

              <button
                type="button"
                onClick={() => setG1View('series')}
                aria-pressed={g1View === 'series'}
                className={`tamil btn-wrap inline-flex items-center gap-2 rounded-pill px-4 py-2 text-center font-heading text-sm font-bold transition ${
                  g1View === 'series' ? 'bg-brand text-white shadow-sm' : 'text-ink2 hover:text-ink'
                }`}
              >
                <Trophy size={16} className="flex-shrink-0" />
                {t('testSeriesTabG1')}
              </button>
            </div>
          </div>

          {g1View === 'mock' ? (
            <FullMockExamList />
          ) : (
            <TestSeriesProductPanel
              series="g1_marathon"
              offerTitleKey="testSeriesTitle"
              entitlementUnlocked={unlimited}
              onLockedTap={() => upsell.bundle()}
              previewLocked={previewAsStudent}
              offerEnabled={sales.vettri || sales.premium}
              paywallCards={
                <>
                  <VettriCard />
                  <PremiumCard />
                </>
              }
            />
          )}
        </>
      )}

      {tab === 'rankbooster' && rankBoosterOn && (
        <TestSeriesProductPanel
          series="g2a_rankbooster"
          offerTitleKey="rankBoosterPageTitle"
          entitlementUnlocked={rankBoosterUnlocked}
          onLockedTap={() => upsell.rankBooster()}
          previewLocked={previewAsStudent}
          offerEnabled={sales.rankBooster || sales.premium}
          paywallCards={
            <>
              <RankBoosterCard />
              <PremiumCard showForVettri />
            </>
          }
        />
      )}

      {tab === 'overall' &&
        (overall ? <TestSeriesAnalyticsView analytics={overall} /> : <SkeletonAnalytics />)}

      {/* Pre-payment recap for the Group 1 Mock Test button above. Required for
          that button to do anything at all: startEnroll() only opens this
          modal, so without it the tap would silently no-op. */}
      <PurchaseConfirmModal
        open={mockPurchase.confirmOpen}
        planName={t('mockPackBannerTitle')}
        validity={t('mockPackValidity')}
        perks={[
          t('mockPackBannerSub'),
          t('mockPackPerkPyq'),
          t('mockPackPerk2'),
          t('mockPackPerk3'),
        ]}
        priceLabel={mockPurchase.isFree ? t('premiumFree') : mockPurchase.displayPrice}
        isFree={mockPurchase.isFree}
        accent="sky"
        busy={mockPurchase.paying}
        onConfirm={mockPurchase.handleBuy}
        onCancel={() => mockPurchase.setConfirmOpen(false)}
      />

      {/* Pre-payment recap for the Rank Booster discovery banner above — same
          confirm→Razorpay flow as RankBoosterCard's own CTA, so tapping the
          banner buys the series directly instead of just switching tabs. */}
      <PurchaseConfirmModal
        open={rbPurchase.confirmOpen}
        planName={t('rankBoosterTitle')}
        validity={t('rankBoosterValidity')}
        perks={[...RANK_BOOSTER_PERK_KEYS, ...RANK_BOOSTER_BONUS_KEYS].map((k) => t(k))}
        priceLabel={rbPurchase.isFree ? t('premiumFree') : `₹${rupees(rbPurchase.finalPaise)}`}
        strikePrice={rbPurchase.isFree ? undefined : `₹${RANK_BOOSTER_MRP_RUPEES}`}
        note={t('rankBoosterOfferNote')}
        isFree={rbPurchase.isFree}
        accent="gold"
        busy={rbPurchase.paying}
        onConfirm={rbPurchase.handleBuy}
        onCancel={() => rbPurchase.setConfirmOpen(false)}
      />
    </div>
  )
}

/**
 * One of the two Group 1 entry buttons.
 *
 * Extracted rather than written twice: the strip is ~25 lines of markup, and
 * the pair only reads as a pair if they stay identical apart from icon, copy
 * and colour. A price is shown only when `price` is given — the caller passes
 * null once the account owns the plan, and the chevron takes its place so the
 * button still reads as somewhere to go.
 */
function G1Entry({
  icon,
  title,
  sub,
  price,
  className,
  onClick,
  busy = false,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  price: string | null
  className: string
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center gap-3 rounded-card px-4 py-3 text-left text-white transition hover:brightness-105 disabled:opacity-60 ${className}`}
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="tamil block font-display text-sm font-bold tracking-tight">{title}</span>
        <span className="tamil mt-0.5 block font-body text-xs text-white/85">{sub}</span>
      </span>
      {price ? (
        <span className="flex flex-shrink-0 items-center rounded-pill bg-white/15 px-3 py-1.5">
          <span className="font-heading text-sm font-bold">{price}</span>
        </span>
      ) : (
        <ChevronRight size={18} className="flex-shrink-0 text-white/70" />
      )}
    </button>
  )
}
