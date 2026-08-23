import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Rocket, Trophy, Download, ListChecks } from 'lucide-react'
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
import TestSeriesProductPanel from '../components/TestSeries/TestSeriesProductPanel'
import TestSeriesAnalyticsView from '../components/TestSeries/TestSeriesAnalyticsView'
import { SkeletonAnalytics } from '../components/UI/Skeleton'
import { fetchTestSeriesAnalyticsOverall, type TestSeriesAnalytics } from '../lib/testSeriesAnalytics'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { upsell } from '../store/upsellStore'
import { useTestSeriesEnabled } from '../hooks/useTestSeriesEnabled'
import { useRankBoosterEnabled } from '../hooks/useRankBoosterEnabled'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../hooks/useMockPackPurchase'
import PurchaseConfirmModal from '../components/UI/PurchaseConfirmModal'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

type HubTab = 'vettri' | 'rankbooster' | 'overall'

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

  // A caller (e.g. the Group 1 Test Series discovery banner on Test Arena) can
  // request a starting tab via router state — otherwise default to Group
  // II/IIA (Rank Booster), which leads the hub.
  const requestedTab = (location.state as { tab?: HubTab } | null)?.tab
  const [tab, setTab] = useState<HubTab>(requestedTab ?? 'rankbooster')
  // Both flags default false until the settings fetch resolves. If whichever
  // tab we're sitting on turns out to be off, land on the other one instead —
  // only fires on that one resolution, never overrides a manual tab click.
  useEffect(() => {
    if (!rankBoosterOn && marathonOn) setTab('vettri')
    else if (!marathonOn && rankBoosterOn) setTab('rankbooster')
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
  const mockPackOwned = useEntitlementsStore((s) => s.mockPack)
  const mockPurchase = useMockPackPurchase()
  const rbPurchase = useRankBoosterPurchase()

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
  const schedule: { href: string; filename: string; buttonClassName: string } | null =
    tab === 'vettri'
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
          {tab === 'vettri' ? t('testSeriesTitle') : t('testSeriesHubTitle')}
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
      {/* Pinned to its own tab only — a plain info strip, not a cross-tab
          switcher: the ₹899 price only ever appears while looking at the
          Group 1 Test Series tab. */}
      {marathonOn && tab === 'vettri' && (
        <div className="mb-6 flex w-full items-center gap-3 rounded-card bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-white">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <Trophy size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-bold tracking-tight">
              {t('marathonBannerTitle')}
            </span>
            <span className="tamil mt-0.5 block font-body text-xs text-white/85">
              {t('marathonBannerSub')}
            </span>
          </span>
          <span className="flex flex-shrink-0 flex-col items-end rounded-pill bg-white/15 px-3 py-1.5">
            <span className="font-heading text-sm font-bold">₹{VETTRI_PRICE_RUPEES}</span>
          </span>
        </div>
      )}

      {/* Pinned to its own tab too — the ₹1249 price only ever appears on the
          Group II/IIA tab. Stays a real button while locked (tap starts the
          purchase flow); once unlocked it's a plain info strip like the
          Group 1 banner above. */}
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

      {/* Group 1 Mock Test Pack (6 mock exams) - a lighter, cheaper entry point
          than the full Group 1 Test Series bundle, now a real ₹399/80-day SKU of its own
          (see useMockPackPurchase). No tab of its own on this hub: an owner
          taps straight through to the exams (/mock); anyone else taps straight
          into the same confirm→Razorpay flow as every other paid-plan card.
          Hides once the account already has Premium (which includes the pack
          for free) - `unlimited` covers Premium/Vettri, not mockPack itself. */}
      {!unlimited && (
        <button
          onClick={() => (mockPackOwned ? navigate('/mock') : mockPurchase.startEnroll())}
          disabled={mockPurchase.paying}
          className="mb-6 flex w-full items-center gap-3 rounded-card bg-sky px-4 py-3 text-left text-white transition hover:brightness-105 disabled:opacity-60"
        >
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <ListChecks size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-bold tracking-tight">
              {t('mockPackBannerTitle')}
            </span>
            <span className="tamil mt-0.5 block font-body text-xs text-white/85">
              {t('mockPackBannerSub')}
            </span>
          </span>
          {!mockPackOwned && (
            <span className="flex flex-shrink-0 flex-col items-end rounded-pill bg-white/15 px-3 py-1.5">
              <span className="font-heading text-sm font-bold">₹{MOCK_PACK_PRICE_RUPEES}</span>
            </span>
          )}
        </button>
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
              onClick={() => setTab(key)}
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
        <TestSeriesProductPanel
          series="g1_marathon"
          offerTitleKey="testSeriesTitle"
          entitlementUnlocked={unlimited}
          onLockedTap={() => upsell.bundle()}
          previewLocked={previewAsStudent}
          paywallCards={
            <>
              <VettriCard />
              <PremiumCard />
            </>
          }
        />
      )}

      {tab === 'rankbooster' && rankBoosterOn && (
        <TestSeriesProductPanel
          series="g2a_rankbooster"
          offerTitleKey="rankBoosterPageTitle"
          entitlementUnlocked={rankBoosterUnlocked}
          onLockedTap={() => upsell.rankBooster()}
          previewLocked={previewAsStudent}
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

      {/* Pre-payment recap for the Mock Pack banner above. */}
      <PurchaseConfirmModal
        open={mockPurchase.confirmOpen}
        planName={t('mockPackBannerTitle')}
        validity={t('mockPackValidity')}
        perks={[t('mockPackBannerSub'), t('mockPackPerk2'), t('mockPackPerk3')]}
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
