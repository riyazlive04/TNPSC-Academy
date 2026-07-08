import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import PremiumCard from '../components/UI/PremiumCard'
import VettriCard from '../components/UI/VettriCard'
import TestSeriesAnalyticsView from '../components/TestSeries/TestSeriesAnalyticsView'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import { fetchTestSeriesAnalytics, type TestSeriesAnalytics } from '../lib/testSeriesAnalytics'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { upsell } from '../store/upsellStore'
import { useT } from '../lib/i18n'
import type { Lang } from '../store/languageStore'
import type { QuizConfig, TestSeriesItem } from '../types'

type Tab = 'papers' | 'analytics'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச']

/** Format 'YYYY-MM-DD' as "09 Jul" / "09 ஜூலை" (used for schedule badges). */
function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const months = lang === 'ta' ? MONTHS_TA : MONTHS_EN
  return `${String(d).padStart(2, '0')} ${months[m - 1]}`
}

export default function TestSeriesPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [tab, setTab] = useState<Tab>('papers')
  const [tests, setTests] = useState<TestSeriesItem[]>([])
  const [premium, setPremium] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Analytics loads in the background (non-blocking): it feeds the prep banner on
  // the Papers tab and the whole Analytics tab.
  const [analytics, setAnalytics] = useState<TestSeriesAnalytics | null>(null)

  // A purchase (Vettri/Premium) flips this to true. The per-paper locks are
  // computed server-side (premium vs date), so re-fetch on unlock rather than
  // reconstructing them here — papers clear without a manual reload.
  const entitledUnlimited = useEntitlementsStore((s) => s.unlimited)

  useEffect(() => {
    let cancelled = false
    api
      .testSeries()
      .then((r) => {
        if (cancelled) return
        setTests(r.tests)
        setPremium(r.premium)
      })
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    fetchTestSeriesAnalytics()
      .then((a) => !cancelled && setAnalytics(a))
      .catch(() => undefined) // non-critical; the tab just shows the empty state
    return () => {
      cancelled = true
    }
  }, [])

  // Re-fetch once entitlement unlocks (e.g. right after a successful purchase) so
  // the premium-locked papers become playable without a reload. Guarded on the
  // flag so it only fires on the false→true transition, never on mount.
  useEffect(() => {
    if (!entitledUnlimited) return
    let cancelled = false
    api
      .testSeries()
      .then((r) => {
        if (cancelled) return
        setTests(r.tests)
        setPremium(r.premium)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [entitledUnlimited])

  const launch = (tst: TestSeriesItem) => {
    const config: QuizConfig = {
      category: 'pyq', // grading is category-agnostic; the engine uses the fetched rows
      proctored: true,
      mock: true,
      mockKind: 'series',
      seriesTestId: tst.id,
      mockQuestionCount: tst.total_questions,
      mockDurationSeconds: tst.duration_seconds,
      negativeMark: tst.negative_mark,
      label: `${lang === 'ta' && tst.title_ta ? tst.title_ta : tst.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  // The whole series is premium-only: surface the upgrade card when locked out.
  const seriesLocked = !premium

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <header className="mb-6 mt-4">
          <h1 className="tamil font-display text-[22px] font-bold tracking-tight text-ink">
            {t('testSeriesTitle')}
          </h1>
          <p className="tamil mt-1 font-body text-[15px] text-muted">{t('testSeriesSub')}</p>
          {/* The full 13-test timetable as a shareable flyer (public/ static PDF).
              target=_blank so Android webviews without <a download> support still
              hand the PDF to the system viewer. */}
          <a
            href="/test-marathon-2026-schedule.pdf"
            download="TNPSC-Mentors-Test-Marathon-2026-Schedule.pdf"
            target="_blank"
            rel="noopener"
            className="tamil mt-3 inline-flex items-center gap-2 rounded-pill bg-brand-soft px-4 py-2 font-heading text-xs font-bold text-brand transition hover:bg-brand/10"
          >
            <Download size={14} /> {t('downloadSchedule')}
          </a>
        </header>

        {/* Tabs: browse the papers, or review your own performance. */}
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

        {loading && (
          <div className="flex justify-center py-10">
            <LogoLoader size={56} />
          </div>
        )}

        {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

        {/* ── ANALYTICS TAB ── */}
        {!loading && !error && tab === 'analytics' &&
          (analytics ? (
            <TestSeriesAnalyticsView analytics={analytics} />
          ) : (
            <div className="flex justify-center py-10">
              <LogoLoader size={48} />
            </div>
          ))}

        {/* ── PAPERS TAB ── */}
        {!loading && !error && tab === 'papers' && tests.length === 0 && (
          <p className="tamil text-center font-body text-sm text-ink2">{t('testSeriesEmpty')}</p>
        )}

        {/* Whole-series paywall — EITHER paid bundle unlocks the series: the
            cheaper Vettri option (which carries the Test Marathon banner as its
            header), then the full Premium kit. */}
        {!loading && !error && tab === 'papers' && tests.length > 0 && seriesLocked && (
          <div className="mb-6 space-y-4">
            <VettriCard />
            <PremiumCard />
          </div>
        )}

        {!loading && !error && tab === 'papers' && tests.length > 0 && (
          // Papers as a 2-up card grid at every width (incl. phones); each is an
          // elevated card with its CTA pinned to the bottom so the Start buttons
          // line up across a row regardless of how much content each card holds.
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {tests.map((tst) => {
              const title = lang === 'ta' && tst.title_ta ? tst.title_ta : tst.title
              const unit = lang === 'ta' && tst.unit_label_ta ? tst.unit_label_ta : tst.unit_label
              const subjects =
                lang === 'ta' && tst.subjects_label_ta ? tst.subjects_label_ta : tst.subjects_label
              const minutes = Math.round(tst.duration_seconds / 60)
              const exhausted = tst.attemptsUsed >= tst.attemptsMax
              const disabled = tst.locked || exhausted
              const dateLocked = tst.lockReason === 'date'
              const premiumLocked = tst.lockReason === 'premium'
              return (
                <div
                  key={tst.id}
                  className={[
                    'flex h-full flex-col rounded-card border border-line bg-card p-2.5 shadow-soft transition-shadow sm:p-4',
                    disabled ? 'opacity-80' : 'hover:shadow-card',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="tamil font-heading text-sm font-semibold text-ink [overflow-wrap:anywhere] sm:text-base">
                        {title}
                      </h3>
                      {unit && (
                        <span className="tamil inline-flex shrink-0 items-center rounded-md bg-brand-soft px-2 py-0.5 font-heading text-[11px] font-semibold text-brand-dark">
                          {unit}
                        </span>
                      )}
                      {premiumLocked && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accentwarmsoft px-2 py-0.5 font-heading text-[11px] font-semibold text-accentwarm">
                          <Lock size={11} /> {t('premiumOnly')}
                        </span>
                      )}
                    </div>

                    {subjects && (
                      <p className="tamil mt-1 font-body text-[12px] leading-snug text-ink2">
                        {subjects}
                      </p>
                    )}

                    {/* Meta kept to TWO lines on the narrow card: questions +
                        duration on row 1; date + attempts on row 2. */}
                    <div className="mt-1.5 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Tag>
                          <FileText size={12} /> {tst.total_questions} Q
                        </Tag>
                        <Tag>
                          <Clock size={12} /> {minutes} {t('minutesUnit')}
                        </Tag>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {tst.scheduled_date && (
                          <Tag>
                            <CalendarDays size={12} /> {formatDate(tst.scheduled_date, lang)}
                          </Tag>
                        )}
                        <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink2">
                          {exhausted ? (
                            <>
                              <CheckCircle2 size={12} className="text-correct" /> {t('examCompleted')}
                            </>
                          ) : (
                            `${t('attemptWord')} ${tst.attemptsUsed}/${tst.attemptsMax}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CTA + locked note, pinned to the card bottom. */}
                  <div className="mt-auto pt-2.5">
                    {dateLocked && (
                      <p className="tamil mb-2 flex items-center gap-1.5 font-body text-xs text-ink2">
                        <Lock size={12} /> {t('unlocksOn')} {formatDate(tst.scheduled_date, lang)}
                      </p>
                    )}
                    {premiumLocked && (
                      <p className="tamil mb-2 font-body text-xs text-ink2">
                        {t('testSeriesLockedPremium')}
                      </p>
                    )}
                    {/* Bundle-locked papers stay tappable: the tap opens the
                        forced upsell (any paid plan unlocks the series). Date
                        locks and the attempt cap remain true dead ends. */}
                    <button
                      onClick={() =>
                        premiumLocked ? upsell.bundle() : !disabled && launch(tst)
                      }
                      disabled={exhausted || dateLocked}
                      className="btn-brand w-full whitespace-normal px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      {exhausted ? t('examCompleted') : t('startExam')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2 py-1 font-heading text-[11px] font-medium uppercase text-ink2">
      {children}
    </span>
  )
}
