import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Lock,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import PremiumCard from '../components/UI/PremiumCard'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { QuizConfig, TestSeriesItem } from '../types'

/** Format 'YYYY-MM-DD' as "09 Jul" (locale-stable; used for schedule badges). */
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d).padStart(2, '0')} ${months[m - 1]}`
}

export default function TestSeriesPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [tests, setTests] = useState<TestSeriesItem[]>([])
  const [premium, setPremium] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    return () => {
      cancelled = true
    }
  }, [])

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
        </header>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        )}

        {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

        {!loading && !error && tests.length === 0 && (
          <p className="tamil text-center font-body text-sm text-ink2">{t('testSeriesEmpty')}</p>
        )}

        {/* Whole-series paywall — one upgrade card above the schedule. */}
        {!loading && !error && tests.length > 0 && seriesLocked && (
          <div className="mb-6">
            <PremiumCard />
          </div>
        )}

        {!loading && !error && tests.length > 0 && (
          <div className="space-y-3">
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
                    'rounded-card border border-line bg-card p-4 sm:p-5',
                    disabled ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="tamil truncate font-heading text-base font-semibold text-ink">
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
                        <p className="tamil mt-1.5 font-body text-[13px] leading-snug text-ink2">
                          {subjects}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Tag>
                          <FileText size={12} /> {tst.total_questions} Q
                        </Tag>
                        <Tag>
                          <Clock size={12} /> {minutes} {t('minutesUnit')}
                        </Tag>
                        {tst.scheduled_date && (
                          <Tag>
                            <CalendarDays size={12} /> {formatDate(tst.scheduled_date)}
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

                    <button
                      onClick={() => !disabled && launch(tst)}
                      disabled={disabled}
                      className="btn-brand shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {exhausted ? t('examCompleted') : t('startExam')}
                    </button>
                  </div>

                  {/* Locked footnote — premium upsell or the unlock date. */}
                  {dateLocked && (
                    <p className="tamil mt-3 flex items-center gap-1.5 border-t border-line pt-3 font-body text-xs text-ink2">
                      <Lock size={12} /> {t('unlocksOn')} {formatDate(tst.scheduled_date)}
                    </p>
                  )}
                  {premiumLocked && (
                    <p className="tamil mt-3 border-t border-line pt-3 font-body text-xs text-ink2">
                      {t('testSeriesLockedPremium')}
                    </p>
                  )}
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
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 font-heading text-[11px] font-medium uppercase tracking-wide text-ink2">
      {children}
    </span>
  )
}
