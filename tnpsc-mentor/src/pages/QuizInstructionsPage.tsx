import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowLeft, Clock, Copy, ListChecks, Loader2, Maximize2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { enterFullscreen } from '../lib/proctor'
import { api } from '../lib/api'
import { MAX_QUESTIONS } from '../lib/fetchQuestions'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

// Practice-quiz setup bounds. The question count is additionally capped by how
// many questions actually exist for the chosen topic (fetched on mount).
const MIN_QUESTIONS = 5
const MIN_MINUTES = 5
const MAX_MINUTES = 120
const MINUTE_STEP = 5

// Suggested pace: roughly one minute per question (a comfortable practice speed,
// close to the TNPSC prelims rate). Rounded to the slider's 5-min step and kept
// within the allowed range.
const RECOMMENDED_SEC_PER_Q = 60
function recommendedMinutes(count: number): number {
  const stepped = Math.round((count * RECOMMENDED_SEC_PER_Q) / 60 / MINUTE_STEP) * MINUTE_STEP
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, stepped))
}

/**
 * Proctored pre-test screen for practice quizzes (Subject Practice, PYQ, Current
 * Affairs, Aptitude, Revision). Lets the aspirant choose how many questions and
 * how long, shows the exam rules with a mandatory confirmation, then requests
 * full-screen and hands off to the quiz engine (/quiz) with `proctored: true`.
 * Reached via router state from useStartTest - a direct/refresh hit with no
 * config bounces back to the Test Arena.
 */
export default function QuizInstructionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const config = location.state as QuizConfig | null

  const [agreed, setAgreed] = useState(false)
  const [count, setCount] = useState(20)
  const [minutes, setMinutes] = useState(20)
  // Until the user drags the time slider, the time limit tracks the recommended
  // pace (≈1 min/question) so it always matches the chosen question count.
  const [timeTouched, setTimeTouched] = useState(false)
  // How many questions exist for this config - bounds the question slider.
  const [available, setAvailable] = useState<number | null>(null)

  const recommended = recommendedMinutes(count)
  useEffect(() => {
    if (!timeTouched) setMinutes(recommended)
  }, [recommended, timeTouched])

  useEffect(() => {
    if (!config) navigate('/test-arena', { replace: true })
  }, [config, navigate])

  // Fetch the available-question count so the slider can't exceed the real pool.
  useEffect(() => {
    if (!config) return
    let cancelled = false
    api
      .countQuestions(config)
      .then((n) => {
        if (cancelled) return
        const capped = Math.min(n, MAX_QUESTIONS)
        setAvailable(capped)
        // Clamp the default selection into the valid range for this topic.
        setCount((c) => Math.max(Math.min(c, capped), Math.min(MIN_QUESTIONS, capped)))
      })
      .catch(() => {
        // On failure, fall back to the global cap so the user isn't blocked.
        if (!cancelled) setAvailable(MAX_QUESTIONS)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!config) return null

  const loadingCount = available === null
  const maxCount = available ?? MAX_QUESTIONS
  const minCount = Math.min(MIN_QUESTIONS, maxCount)
  const noQuestions = available === 0

  const begin = async () => {
    if (!agreed || noQuestions) return
    // Regular practice tests are NOT proctored — no fullscreen, no violation
    // tracking. Proctoring is reserved for the Mock Test flow only.
    navigate('/quiz', {
      state: {
        ...config,
        proctored: false,
        questionCount: count,
        durationSeconds: minutes * 60,
      } as QuizConfig,
    })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="mb-3 text-center">
          <YellowBadge>{t('examInstructions')}</YellowBadge>
        </div>
        {config.label && (
          <p className="mb-6 text-center font-heading text-lg font-semibold text-ink">
            {config.label}
          </p>
        )}

        {/* Setup: number of questions (slider, capped at the available pool) */}
        <div className="card mb-4 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="tamil font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
              {t('numQuestions')}
            </h3>
            {loadingCount ? (
              <span className="inline-flex items-center gap-1.5 font-body text-xs text-ink2">
                <Loader2 size={13} className="animate-spin" /> {t('countingQuestions')}
              </span>
            ) : (
              <span className="font-body text-xs text-ink2">
                <span className="font-heading text-base font-bold text-brand">{count}</span>
                {' / '}
                {maxCount} {t('questionsAvailable')}
              </span>
            )}
          </div>
          {noQuestions ? (
            <p className="tamil font-body text-sm text-ink2">{t('noQuestionsLong')}</p>
          ) : (
            <>
              <input
                type="range"
                min={minCount}
                max={maxCount}
                step={1}
                value={count}
                disabled={loadingCount || maxCount <= minCount}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label={t('numQuestions')}
                className="w-full accent-brand disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between font-body text-[11px] text-ink2">
                <span>{minCount}</span>
                <span>{maxCount}</span>
              </div>
            </>
          )}
        </div>

        {/* Setup: time limit (slider) */}
        <div className="card mb-6 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="tamil font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
              {t('timeLimitMin')}
            </h3>
            <span className="font-body text-xs text-ink2">
              <span className="font-heading text-base font-bold text-brand">{minutes}</span>{' '}
              {t('minutesShort')}
            </span>
          </div>

          {/* Suggested time, derived from the chosen question count */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex flex-wrap items-center gap-1.5 font-body text-xs text-ink2">
              <Clock size={13} className="text-brand" />
              {t('recommendedTime')}:{' '}
              <span className="font-heading font-semibold text-ink">
                {recommended} {t('minutesShort')}
              </span>
              <span className="text-ink2/70">· {t('recommendedTimeHint')}</span>
            </span>
            {minutes !== recommended && (
              <button
                type="button"
                onClick={() => {
                  setTimeTouched(true)
                  setMinutes(recommended)
                }}
                className="shrink-0 rounded-full bg-brand-soft px-3 py-1 font-heading text-xs font-semibold text-brand transition hover:bg-brand/10"
              >
                {t('applyRecommended')}
              </button>
            )}
          </div>

          <input
            type="range"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            step={MINUTE_STEP}
            value={minutes}
            onChange={(e) => {
              setTimeTouched(true)
              setMinutes(Number(e.target.value))
            }}
            aria-label={t('timeLimitMin')}
            className="w-full accent-brand"
          />
          <div className="mt-1 flex justify-between font-body text-[11px] text-ink2">
            <span>
              {MIN_MINUTES} {t('minutesShort')}
            </span>
            <span>
              {MAX_MINUTES} {t('minutesShort')}
            </span>
          </div>
        </div>

        {/* Rules */}
        <div className="card mb-6 space-y-4 p-5">
          <Rule icon={<Maximize2 size={18} />} text={t('instrFullscreen')} />
          <Rule icon={<Clock size={18} />} text={t('instrTimer')} />
          <Rule icon={<ListChecks size={18} />} text={t('instrQuizNav')} />
          <Rule icon={<Copy size={18} />} text={t('instrNoCopy')} />
          <Rule icon={<AlertTriangle size={18} />} text={t('instrViolations')} />
          {/* Report-a-problem — highlighted so aspirants notice it's available. */}
          <div className="flex items-start gap-3 rounded-xl border border-accentwarm/30 bg-accentwarmsoft p-3.5">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-accentwarm" />
            <p className="tamil font-body text-sm text-ink">{t('instrReport')}</p>
          </div>
        </div>

        {/* Confirmation */}
        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
          <span className="tamil font-body text-sm text-ink">{t('instrConfirm')}</span>
        </label>

        <button
          onClick={begin}
          disabled={!agreed || noQuestions || loadingCount}
          className="btn-brand btn-lg w-full"
        >
          <Maximize2 size={18} /> {t('enterFullscreen')}
        </button>
      </div>
    </AppLayout>
  )
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      <p className="tamil font-body text-sm text-ink">{text}</p>
    </div>
  )
}
