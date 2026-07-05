import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, Infinity as InfinityIcon, Loader2, Lock } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import VettriCard from '../components/UI/VettriCard'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { QuizConfig, VettriExam } from '../types'

/**
 * Vettri Nichayam bank — the 13-exam paid set. The whole bank is bundle-gated
 * (premium OR vettri) with unlimited attempts; a non-unlocked user sees the
 * VettriCard upsell above the list and locked rows.
 */
export default function VettriPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [exams, setExams] = useState<VettriExam[]>([])
  const [unlocked, setUnlocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .vettriExams()
      .then((r) => {
        if (cancelled) return
        setExams(r.exams)
        setUnlocked(r.unlocked)
      })
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const launch = (e: VettriExam) => {
    const config: QuizConfig = {
      category: 'pyq', // grading is category-agnostic; the engine uses the fetched rows
      proctored: true,
      mock: true,
      mockKind: 'vettri',
      vettriExamId: e.id,
      mockQuestionCount: e.total_questions,
      mockDurationSeconds: e.duration_seconds,
      negativeMark: e.negative_mark,
      label: `${lang === 'ta' && e.title_ta ? e.title_ta : e.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

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
            {t('vettriTitle')}
          </h1>
          <p className="tamil mt-1 font-body text-[15px] text-muted">{t('vettriSub')}</p>
        </header>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        )}

        {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

        {!loading && !error && exams.length === 0 && (
          <p className="tamil text-center font-body text-sm text-ink2">{t('vettriEmpty')}</p>
        )}

        {/* Whole-bank paywall — one upgrade card above the list. */}
        {!loading && !error && exams.length > 0 && !unlocked && (
          <div className="mb-6">
            <VettriCard />
          </div>
        )}

        {!loading && !error && exams.length > 0 && (
          <div className="space-y-3">
            {exams.map((e) => {
              const title = lang === 'ta' && e.title_ta ? e.title_ta : e.title
              const minutes = Math.round(e.duration_seconds / 60)
              return (
                <div
                  key={e.id}
                  className={[
                    'rounded-card border border-line bg-card p-4 sm:p-5',
                    e.locked ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="tamil truncate font-heading text-base font-semibold text-ink">
                          {title}
                        </h3>
                        {e.locked && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 font-heading text-[11px] font-semibold text-brand-dark">
                            <Lock size={11} /> {t('vettriOnly')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Tag>
                          <FileText size={12} /> {e.total_questions} Q
                        </Tag>
                        <Tag>
                          <Clock size={12} /> {minutes} {t('minutesUnit')}
                        </Tag>
                        <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink2">
                          <InfinityIcon size={12} className="text-brand" /> {t('vettriUnlimited')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => !e.locked && launch(e)}
                      disabled={e.locked}
                      className="btn-brand shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('startExam')}
                    </button>
                  </div>
                  {e.locked && (
                    <p className="tamil mt-3 border-t border-line pt-3 font-body text-xs text-ink2">
                      {t('vettriLocked')}
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
