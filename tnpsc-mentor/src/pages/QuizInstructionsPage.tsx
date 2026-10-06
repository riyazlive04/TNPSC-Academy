import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowLeft, Clock, Copy, ListChecks, Loader2, Maximize2 } from 'lucide-react'
import YellowBadge from '../components/UI/YellowBadge'
import CreditConfirmPopup from '../components/UI/CreditConfirmPopup'
import { useCreditsStore, useChargesCredits } from '../store/creditsStore'
import { upsell } from '../store/upsellStore'
import { enterFullscreen } from '../lib/proctor'
import { api } from '../lib/api'
import { DEFAULT_QUESTIONS, describeConfig } from '../lib/fetchQuestions'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

// Practice-quiz setup bounds. The question count is additionally capped by how
// many questions actually exist for the chosen topic (fetched on mount).
const MIN_QUESTIONS = 5
const MIN_MINUTES = 5
// 180, the real TNPSC prelims duration — the ceiling has to reach it now that
// the time limit is what sizes the paper (and that a full previous-year paper,
// 200 questions, can be sat here).
const MAX_MINUTES = 180
const MINUTE_STEP = 5
// Default sitting: 20 minutes, which at the pace below is the 20-question
// practice test this screen has always started by offering.
const DEFAULT_MINUTES = 20

// The pace that ties the two together: roughly one minute per question (a
// comfortable practice speed, close to the TNPSC prelims rate).
const RECOMMENDED_SEC_PER_Q = 60

/** How long a paper of `count` questions should take, on the slider's step. */
function recommendedMinutes(count: number): number {
  const stepped = Math.round((count * RECOMMENDED_SEC_PER_Q) / 60 / MINUTE_STEP) * MINUTE_STEP
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, stepped))
}

/** How many questions fit in `minutes` at that pace — the inverse. */
function questionsForMinutes(minutes: number): number {
  return Math.max(1, Math.round((minutes * 60) / RECOMMENDED_SEC_PER_Q))
}

/**
 * Proctored pre-test screen for practice quizzes (Subject Practice, PYQ, Current
 * Affairs, Aptitude, Revision). Lets the aspirant choose how long they want to
 * sit — the paper's LENGTH follows from that at ~1 minute a question, rather
 * than being a second slider to keep in step with it — shows the exam rules
 * with a mandatory confirmation, then requests full-screen and hands off to the
 * quiz engine (/quiz).
 * Reached via router state from useStartTest - a direct/refresh hit with no
 * config bounces back to the Test Arena.
 */
export default function QuizInstructionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const config = location.state as QuizConfig | null

  const [agreed, setAgreed] = useState(false)
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  // Set once the user drags the time slider: a fixed-length paper stops
  // re-deriving its suggested duration from that point on.
  const [timeTouched, setTimeTouched] = useState(false)
  // How many questions exist for this config - the upper bound on the paper.
  // Seeded from the picker page's known count (config.availableCount) so the
  // number shows immediately; otherwise null until the fetch below resolves.
  const [available, setAvailable] = useState<number | null>(config?.availableCount ?? null)

  useEffect(() => {
    if (!config) navigate('/test-arena', { replace: true })
  }, [config, navigate])

  // Resolve the available-question count: the ceiling on the paper (no
  // artificial cap - the aspirant can practise every question in the topic, and
  // a full previous-year paper is exactly the whole pool). When the picker page
  // already passed the count (config.availableCount), use it directly and skip
  // the network round-trip; otherwise fetch it.
  useEffect(() => {
    if (!config) return
    if (config.availableCount != null) return

    let cancelled = false
    api
      .countQuestions(config)
      .then((n) => {
        if (cancelled) return
        setAvailable(n)
      })
      .catch(() => {
        // On failure, fall back to a sane default so the user isn't blocked.
        if (!cancelled) setAvailable(DEFAULT_QUESTIONS)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A FIXED-LENGTH paper (a PYQ full paper, the Starter Challenge) suggests its
  // own duration — ~1 minute a question — until the aspirant moves the slider.
  // Lives above the `!config` early return because it feeds a hook.
  const fixedCount = config?.fullPaper ? available : (config?.questionCount ?? null)
  useEffect(() => {
    if (fixedCount == null || timeTouched) return
    setMinutes(recommendedMinutes(fixedCount))
  }, [fixedCount, timeTouched])

  // Free (credit-gated) learners confirm the per-question credit fee in a popup.
  // Category-aware: a plan that includes this bank outright (the ₹399 Mock Pack
  // covers Group 1 PYQ) is not charged by the server, so it must not be shown a
  // fee here either.
  //
  // These sit ABOVE the `!config` early return: they are hooks, and running them
  // only on the renders where a config exists changes the hook order between
  // renders. That was already true of the credit reads before this screen became
  // category-aware; it just had fewer hooks to get wrong.
  const creditGated = useChargesCredits(config?.category)
  const balance = useCreditsStore((s) => s.balance)
  const [creditPopup, setCreditPopup] = useState(false)

  if (!config) return null

  const loadingCount = available === null
  const maxCount = available ?? DEFAULT_QUESTIONS
  const minCount = Math.min(MIN_QUESTIONS, maxCount)
  const noQuestions = available === 0

  // How long the paper is.
  //
  // There is no question-count control any more: the aspirant sets how long they
  // want to sit, and the paper is however many questions fit at ~1 minute each.
  // One decision instead of two that had to be kept consistent with each other,
  // and the number of credits a free learner spends is still on screen (and in
  // the confirm popup) before they commit.
  //
  // A FIXED-LENGTH paper overrides that (see `fixedCount` above): a PYQ full
  // paper is the whole printed paper, and the Starter Challenge is its own
  // 18-question set. Those set the count, and the time limit is what the
  // aspirant chooses around it.
  const count = Math.max(
    Math.min(fixedCount ?? questionsForMinutes(minutes), maxCount),
    minCount
  )
  const recommended = recommendedMinutes(count)

  const startQuiz = () => {
    // Regular practice tests are NOT proctored - no fullscreen, no violation
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

  const begin = () => {
    if (!agreed || noQuestions) return
    if (creditGated) {
      // Can't afford this paper → straight to the upsell instead of letting the
      // start bounce off the server's 402 later.
      if (balance < count) {
        upsell.credits(count)
        return
      }
      setCreditPopup(true)
      return
    }
    startQuiz()
  }

  return (
    <>
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
        {(config.labelParts?.length || config.label) && (
          <p className="mb-6 text-center font-heading text-lg font-semibold text-ink">
            {describeConfig(config, lang)}
          </p>
        )}

        {/* Setup: how long to sit. The paper's LENGTH follows from it (~1 minute
            a question), so there is one control here, not two. A fixed-length
            paper shows its length instead and keeps the slider for the clock. */}
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

          {/* What that buys: the number of questions this test will actually
              serve — which is also what a free learner is about to spend in
              credits, so it has to be on screen before they agree. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            {loadingCount ? (
              <span className="inline-flex items-center gap-1.5 font-body text-xs text-ink2">
                <Loader2 size={13} className="animate-spin" /> {t('countingQuestions')}
              </span>
            ) : noQuestions ? (
              <span className="tamil font-body text-sm text-ink2">{t('noQuestionsLong')}</span>
            ) : (
              <span className="tamil inline-flex flex-wrap items-center gap-1.5 font-body text-xs text-ink2">
                <ListChecks size={13} className="text-brand" />
                <span className="font-heading text-base font-bold text-brand tabular-nums">
                  {count}
                </span>
                {t('questionsCount')}
                <span className="text-ink2/70">
                  {fixedCount != null
                    ? `· ${t('fullPaperFixedHint')}`
                    : `· ${t('ofAvailableHint').replace('{n}', String(maxCount))} · ${t('paceHint')}`}
                </span>
              </span>
            )}
            {fixedCount != null && minutes !== recommended && (
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
          <div className="mt-1 flex justify-between font-body text-2xs text-ink2">
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
          {/* Report-a-problem - highlighted so aspirants notice it's available. */}
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
          className="btn-wrap btn-brand btn-lg w-full"
        >
          <Maximize2 size={18} /> {t('enterFullscreen')}
        </button>
      </div>

      {/* Credit fee popup - free (credit-gated) learners only */}
      <CreditConfirmPopup
        open={creditPopup}
        cost={count}
        onConfirm={() => {
          setCreditPopup(false)
          startQuiz()
        }}
        onCancel={() => setCreditPopup(false)}
      />
    </>
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
