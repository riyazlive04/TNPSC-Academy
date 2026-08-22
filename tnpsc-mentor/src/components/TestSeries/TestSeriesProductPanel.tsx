import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import OfferSheet from '../UI/OfferSheet'
import TestSeriesGrid from './TestSeriesGrid'
import TestSeriesAnalyticsView from './TestSeriesAnalyticsView'
import { SkeletonAnalytics, SkeletonCards } from '../UI/Skeleton'
import { api } from '../../lib/api'
import { fetchTestSeriesAnalytics, type TestSeriesAnalytics } from '../../lib/testSeriesAnalytics'
import { useT, type StringKey } from '../../lib/i18n'
import type { QuizConfig, TestSeriesItem } from '../../types'

type Tab = 'papers' | 'analytics'

/**
 * One product's tab content inside the Test Marathon hub (`TestSeriesPage`):
 * its own Papers/Analytics sub-tabs, its own paywall sheet, its own attempt
 * launcher. Parameterized by `series` so the exact same component renders both
 * the Vettri Nichayam (Group 1) tab and the Rank Booster (Group II/IIA) tab —
 * the hub just swaps `series` + the paywall cards + a couple of copy keys.
 */
export default function TestSeriesProductPanel({
  series,
  offerTitleKey,
  paywallCards,
  entitlementUnlocked,
  onLockedTap,
  previewLocked = false,
}: {
  series: 'g1_marathon' | 'g2a_rankbooster'
  offerTitleKey: StringKey
  paywallCards: ReactNode
  /** Whichever entitlement flag unlocks THIS series (unlimited vs rankBoosterUnlocked). */
  entitlementUnlocked: boolean
  onLockedTap: () => void
  /** Force the locked/paywall view even though the server reports this series
   *  unlocked — staff always get `premium: true` from the API (they can preview
   *  any exam's content), which otherwise makes "preview as student" unable to
   *  ever show an admin what the paywall itself looks like. Client-side only,
   *  matching how the rest of student-preview works (src/store/adminViewStore.ts). */
  previewLocked?: boolean
}) {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [tab, setTab] = useState<Tab>('papers')
  const [tests, setTests] = useState<TestSeriesItem[]>([])
  const [premium, setPremium] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState<TestSeriesAnalytics | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)

  const offerDismissedKey = `tnpsc-mentor-series-offer-dismissed-${series}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setTab('papers')
    api
      .testSeries(series)
      .then((r) => {
        if (cancelled) return
        setTests(r.tests)
        setPremium(r.premium)
      })
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    fetchTestSeriesAnalytics(series)
      .then((a) => !cancelled && setAnalytics(a))
      .catch(() => undefined) // non-critical; the tab just shows the empty state
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series])

  // Re-fetch once entitlement unlocks (e.g. right after a successful purchase)
  // so the locked papers become playable without a reload.
  useEffect(() => {
    if (!entitlementUnlocked) return
    let cancelled = false
    api
      .testSeries(series)
      .then((r) => {
        if (cancelled) return
        setTests(r.tests)
        setPremium(r.premium)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementUnlocked])

  const seriesLocked = previewLocked || !premium

  useEffect(() => {
    if (loading || error || !seriesLocked || tests.length === 0) return
    if (sessionStorage.getItem(offerDismissedKey)) return
    setOfferOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, seriesLocked, tests.length])

  useEffect(() => {
    if (!seriesLocked) setOfferOpen(false)
  }, [seriesLocked])

  const closeOffer = () => {
    setOfferOpen(false)
    try {
      sessionStorage.setItem(offerDismissedKey, '1')
    } catch {
      // Private-mode storage failure just means the offer shows again later.
    }
  }

  const launch = (tst: TestSeriesItem) => {
    const config: QuizConfig = {
      category: 'pyq', // grading is category-agnostic; the engine uses the fetched rows
      proctored: true,
      mock: true,
      mockKind: 'series',
      seriesTestId: tst.id,
      seriesKey: series,
      mockQuestionCount: tst.total_questions,
      mockDurationSeconds: tst.duration_seconds,
      negativeMark: tst.negative_mark,
      label: `${lang === 'ta' && tst.title_ta ? tst.title_ta : tst.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  return (
    <>
      {!loading && !error && (
        <div className="mb-6 flex gap-5 border-b border-line">
          {([
            ['papers', t('tsTabPapers')],
            ['analytics', t('tsTabAnalytics')],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                '-mb-px border-b-2 pb-2.5 font-heading text-sm font-semibold transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && <SkeletonCards count={4} height="h-28" />}

      {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

      {!loading && !error && tab === 'analytics' &&
        (analytics ? <TestSeriesAnalyticsView analytics={analytics} /> : <SkeletonAnalytics />)}

      {!loading && !error && tab === 'papers' && tests.length === 0 && (
        <p className="tamil text-center font-body text-sm text-ink2">{t('testSeriesEmpty')}</p>
      )}

      {!loading && !error && tab === 'papers' && tests.length > 0 && (
        <TestSeriesGrid tests={tests} onLaunch={launch} onLockedTap={onLockedTap} />
      )}

      <OfferSheet open={offerOpen} onClose={closeOffer} title={t(offerTitleKey)}>
        {paywallCards}
      </OfferSheet>
    </>
  )
}
