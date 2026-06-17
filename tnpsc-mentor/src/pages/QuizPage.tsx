import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Flag, Languages, Loader2, Maximize2, X } from 'lucide-react'
import type { Lang } from '../store/languageStore'
import Timer from '../components/UI/Timer'
import ScreenGuard from '../components/Quiz/ScreenGuard'
import ProgressBar from '../components/UI/ProgressBar'
import QuestionCard from '../components/Quiz/QuestionCard'
import {
  AttendanceGateModal,
  CenteredMessage,
  ExitTestModal,
  SubmitErrorModal,
} from '../components/Quiz/QuizDialogs'
import {
  ATTENDANCE_GATE,
  MIN_SECONDS_PER_QUESTION,
  useQuizStore,
} from '../store/quizStore'
import { useQuiz } from '../hooks/useQuiz'
import { useAuthStore } from '../store/authStore'
import { describeConfig, fetchQuestionsForConfig } from '../lib/fetchQuestions'
import { submitTest } from '../lib/submitTest'
import { abandonTest } from '../lib/abandonTest'
import { useProctoring, MAX_VIOLATIONS, type Violation } from '../hooks/useProctoring'
import { exitFullscreen } from '../lib/proctor'
import { useT } from '../lib/i18n'
import type { AnswerLetter, QuizConfig } from '../types'

/** Loose structural match so resuming a refreshed test reuses the same pool. */
function sameConfig(a: QuizConfig, b: QuizConfig): boolean {
  return describeConfig(a) === describeConfig(b) && Boolean(a.mock) === Boolean(b.mock)
}

const QUIZ_LANG_LABEL: Record<Lang, string> = { en: 'EN', ta: 'தமிழ்', both: 'EN+த' }
const QUIZ_LANG_CYCLE: Lang[] = ['en', 'ta', 'both']

export default function QuizPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  // In-test language for the question CONTENT (independent of the app UI
  // language) so an aspirant can flip a question to bilingual on demand.
  const [quizLang, setQuizLang] = useState<Lang>(lang)
  const cycleQuizLang = () =>
    setQuizLang((l) => QUIZ_LANG_CYCLE[(QUIZ_LANG_CYCLE.indexOf(l) + 1) % QUIZ_LANG_CYCLE.length])
  const location = useLocation()
  // On a hard refresh, router `location.state` is lost - fall back to the
  // persisted in-progress session's config so the test can resume.
  const navConfig = location.state as QuizConfig | null
  const config = navConfig ?? useQuizStore.getState().config

  const [submitError, setSubmitError] = useState('')

  const store = useQuizStore()
  const {
    questions,
    currentIndex,
    currentQuestion,
    answers,
    flags,
    totalTimeLeft,
    attempted,
    total,
  } = useQuiz()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [empty, setEmpty] = useState(false)

  // 15-second minimum tracking for the current question
  const [secondsOnQuestion, setSecondsOnQuestion] = useState(0)
  const [minWarning, setMinWarning] = useState(false)

  // Attendance gate modal before submit (unlocks explanations at >=25% attempted)
  const [showGateModal, setShowGateModal] = useState(false)

  // Exit confirmation modal (practice tests only)
  const [showExitModal, setShowExitModal] = useState(false)

  const submittedRef = useRef(false)
  // Latest proctoring violations, read at submit time (kept in a ref so the
  // memoised submit handler doesn't need them as a dependency).
  const violationsRef = useRef<Violation[]>([])
  // Always points at the current handleSubmit so the countdown timer never
  // calls a stale closure (the timer effect must not re-subscribe per render).
  const submitRef = useRef<(auto?: boolean) => void>(() => {})

  // ── Guard: must have config ──
  useEffect(() => {
    if (!config) {
      navigate('/test-arena', { replace: true })
    }
  }, [config, navigate])

  // ── Load questions once (or resume an in-progress one after a refresh) ──
  useEffect(() => {
    if (!config) return
    let cancelled = false

    // Resume: the persisted store already holds a matching, unfinished test.
    const persisted = useQuizStore.getState()
    const canResume =
      persisted.questions.length > 0 &&
      persisted.config != null &&
      sameConfig(persisted.config, config)
    if (canResume) {
      persisted.resumeTimer() // recompute remaining time from startedAt
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setLoadError('')
      setEmpty(false)
      try {
        const fetched = await fetchQuestionsForConfig(config)
        if (cancelled) return
        if (!fetched.length) {
          setEmpty(true)
          setLoading(false)
          return
        }
        // Server already returns a randomised pool; no client shuffle needed.
        store.initSession(config, fetched)
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setLoadError(t('loadQuestionsError'))
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Global countdown timer (auto-submit at 0) ──
  useEffect(() => {
    if (loading || empty || loadError) return
    const id = setInterval(() => {
      const left = useQuizStore.getState().totalTimeLeft
      if (left <= 1) {
        clearInterval(id)
        useQuizStore.getState().tick()
        submitRef.current(true)
      } else {
        useQuizStore.getState().tick()
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, empty, loadError])

  // ── Per-question elapsed timer (resets on navigation) ──
  useEffect(() => {
    setSecondsOnQuestion(0)
    setMinWarning(false)
    // Long questions can leave the next one scrolled past its top - reset to the
    // top of the question on every navigation so it always starts in view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const id = setInterval(() => setSecondsOnQuestion((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [currentIndex])

  const selectedLetter: AnswerLetter | null = currentQuestion
    ? (answers[currentQuestion.id]?.selected_answer ?? null)
    : null

  const handleSelect = (letter: AnswerLetter) => {
    if (!currentQuestion) return
    store.selectAnswer(currentQuestion.id, letter)
  }

  const canAdvance = secondsOnQuestion >= MIN_SECONDS_PER_QUESTION

  const goNext = () => {
    if (!canAdvance) {
      setMinWarning(true)
      return
    }
    if (currentIndex + 1 < total) {
      store.next()
    } else {
      attemptSubmit()
    }
  }

  const goPrev = () => {
    store.prev()
  }

  const toggleFlag = () => {
    if (currentQuestion) store.toggleFlag(currentQuestion.id)
  }

  // ── Exit flow (practice tests only) ──
  const handleExitEvaluate = () => {
    setShowExitModal(false)
    handleSubmit()
  }

  const handleExitDiscard = async () => {
    const s = useQuizStore.getState()
    if (s.config && s.questions.length > 0) {
      try {
        await abandonTest({
          config: s.config,
          questions: s.questions,
          answers: s.answers,
          timeLimitSeconds: s.timeLimitSeconds ?? 0,
          startedAt: s.startedAt ?? Date.now(),
        })
      } catch {
        // best-effort; don't block navigation if recording fails
      }
    }
    s.reset()
    // The test is over - leave full-screen before returning to the arena.
    await exitFullscreen()
    navigate('/test-arena', { replace: true })
  }

  // ── Submit flow ──
  const attemptSubmit = () => {
    const attendance = total > 0 ? attempted / total : 0
    if (attendance < ATTENDANCE_GATE) {
      setShowGateModal(true)
      return
    }
    handleSubmit()
  }

  // The final "Submit" button must also honour the 15s-per-question minimum
  // (previously it bypassed the check that Next enforced).
  const requestSubmit = () => {
    if (!canAdvance) {
      setMinWarning(true)
      return
    }
    attemptSubmit()
  }

  const handleSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true

    const s = useQuizStore.getState()
    if (!s.config || s.questions.length === 0) {
      navigate('/test-arena', { replace: true })
      return
    }

    s.setSubmitting(true)
    setSubmitError('')

    const user = useAuthStore.getState().user
    if (!user) {
      s.setSubmitting(false)
      submittedRef.current = false
      setSubmitError('Your session expired. Please sign in again to submit.')
      return
    }

    let payload
    try {
      payload = await submitTest({
        config: s.config,
        questions: s.questions,
        answers: s.answers,
        flags: s.flags,
        timeLimitSeconds: s.timeLimitSeconds,
        startedAt: s.startedAt,
      })
    } catch {
      s.setSubmitting(false)
      submittedRef.current = false
      setSubmitError(
        'Could not submit your test - grading happens on the server. Check your connection and retry.'
      )
      return
    }

    s.setSubmitting(false)
    s.reset() // clear the persisted in-progress session
    // Leave full-screen before showing results (no-op for non-proctored quizzes).
    await exitFullscreen()
    navigate('/result', {
      state: { ...payload, violations: violationsRef.current, autoSubmitted: auto },
      replace: true,
    })
  }, [navigate])

  // Keep the timer's submit pointer fresh without re-subscribing the interval.
  submitRef.current = handleSubmit

  // ── Proctoring (fullscreen, tab-switch, copy/paste; auto-submit on abuse) ──
  const proctored = !!config?.proctored
  const proctorActive = proctored && !loading && !empty && !loadError && total > 0
  const { violations, violationToast, notFullscreen, fsSupported, reEnterFullscreen } =
    useProctoring({
      active: proctorActive,
      questionIndex: currentIndex,
      onAutoSubmit: () => {
        void handleSubmit(true)
      },
    })
  violationsRef.current = violations

  // ── Render states ──
  if (!config) return null

  if (loading) {
    return (
      <CenteredMessage>
        <Loader2 size={36} className="animate-spin text-brand" />
        <p className="font-heading font-semibold uppercase tracking-widest text-ink2">
          {t('preparingTest')}
        </p>
      </CenteredMessage>
    )
  }

  if (loadError) {
    return (
      <CenteredMessage>
        <AlertTriangle size={36} className="text-coral" />
        <p className="max-w-sm text-center font-body text-ink2">{loadError}</p>
        <button onClick={() => navigate('/test-arena')} className="btn-brand px-6 py-2.5">
          {t('backToTestArena')}
        </button>
      </CenteredMessage>
    )
  }

  if (empty) {
    return (
      <CenteredMessage>
        <AlertTriangle size={36} className="text-brand" />
        <p className="max-w-sm text-center font-body text-ink2">
          {t('noQuestionsLong')}
        </p>
        <button onClick={() => navigate('/test-arena')} className="btn-brand px-6 py-2.5">
          {t('backToTestArena')}
        </button>
      </CenteredMessage>
    )
  }

  if (!currentQuestion) return null

  const isFlagged = flags[currentQuestion.id] ?? false
  const isLast = currentIndex + 1 >= total
  const flaggedCount = Object.values(flags).filter(Boolean).length
  // A "long" question (in either language) gets a stronger "read it carefully"
  // nudge instead of the plain "slow down" one.
  const isLongQuestion =
    Math.max(
      currentQuestion.question_text?.length ?? 0,
      currentQuestion.question_text_ta?.length ?? 0
    ) > 160

  // Announce time milestones to screen readers instead of ticking every second.
  const timeAnnouncement =
    totalTimeLeft === 60
      ? '1 minute remaining'
      : totalTimeLeft === 30
        ? '30 seconds remaining'
        : totalTimeLeft === 10
          ? '10 seconds remaining'
          : ''

  // Visible low-time warning shown for the whole final minute, escalating as the
  // clock runs down so the aspirant clearly sees that time is about to end.
  const lowTime = totalTimeLeft > 0 && totalTimeLeft <= 60
  const lowTimeText =
    totalTimeLeft <= 10 ? t('timeWarn10') : totalTimeLeft <= 30 ? t('timeWarn30') : t('timeWarn60')

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <div className="sr-only" role="status" aria-live="assertive">
        {timeAnnouncement}
      </div>
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-line bg-canvas px-4 py-3">
        {/* On desktop the test name fills the left and everything else - question
            number, language, timer - is grouped on the right. On phones it stays
            split (Q-number left, controls right). */}
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 sm:justify-end">
          <span className="hidden min-w-0 flex-1 truncate font-body text-xs text-ink2 sm:order-1 sm:block">
            {describeConfig(config)}
          </span>
          <span className="font-heading text-lg font-extrabold text-ink sm:order-2">
            Q {currentIndex + 1} <span className="text-ink2/50">/ {total}</span>
          </span>
          <div className="flex items-center gap-2 sm:order-3">
            {proctored && violations.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-coral/10 px-2 py-1 font-heading text-xs font-semibold text-coral">
                <AlertTriangle size={13} /> {violations.length}/{MAX_VIOLATIONS}
              </span>
            )}
            <button
              onClick={cycleQuizLang}
              title={t('viewLanguage')}
              aria-label={`${t('viewLanguage')} (${QUIZ_LANG_LABEL[quizLang]})`}
              className="tamil press inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2.5 py-1.5 font-heading text-xs font-semibold text-brand-dark transition hover:bg-tint focus-ring"
            >
              <Languages size={14} /> {QUIZ_LANG_LABEL[quizLang]}
            </button>
            <Timer secondsLeft={totalTimeLeft} />
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-2xl">
          <ProgressBar percent={total > 0 ? ((currentIndex + 1) / total) * 100 : 0} />
          <div className="mt-1 flex justify-between font-body text-[11px] font-medium text-ink2">
            <span>{t('attemptedLabel')}: {attempted}/{total}</span>
            <span>{t('flagged')}: {flaggedCount}</span>
          </div>
        </div>

        {/* Visible low-time warning - shown through the final minute, escalating */}
        {lowTime && (
          <div className="mx-auto mt-2 max-w-2xl">
            <div
              className={[
                'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-center font-heading text-sm font-semibold text-warn',
                totalTimeLeft <= 10 ? 'bg-warn/15 animate-pulse' : 'bg-warn/10 animate-slideDown',
              ].join(' ')}
            >
              <Clock size={15} className="flex-shrink-0" /> {lowTimeText}
            </div>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="mx-auto mt-5 max-w-2xl px-4">
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={total}
          selected={selectedLetter}
          onSelect={handleSelect}
          displayLang={quizLang}
        />

        {minWarning && !canAdvance && (
          <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4">
            <div className="animate-slideDown flex w-full max-w-md items-center gap-3 rounded-2xl bg-warn px-5 py-4 text-white shadow-2xl ring-4 ring-warn/25">
              <AlertTriangle size={26} className="flex-shrink-0 animate-pulse" />
              <div className="min-w-0 flex-1">
                <p className="tamil font-heading text-sm font-bold leading-snug">
                  {isLongQuestion ? t('readCarefully') : t('min15')}
                </p>
                <p className="tamil mt-0.5 font-body text-xs font-medium text-white/85">
                  {t('waitSeconds')} {Math.max(0, MIN_SECONDS_PER_QUESTION - secondsOnQuestion)}s
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav bar - icons always show; text labels appear on wider screens
          so nothing overflows on phones (Tamil labels are long). */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-card px-3 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          {/* Previous */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label={t('prev')}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-card px-3 py-2.5 font-heading text-sm font-semibold text-ink shadow-pill transition hover:border-brand-ring disabled:opacity-40 sm:px-4"
          >
            <ChevronLeft size={18} className="flex-shrink-0" />
            <span className="hidden whitespace-nowrap sm:inline">{t('prev')}</span>
          </button>

          {/* Centre: close (exit) sits to the LEFT of flag */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {!config.mock && (
              <button
                onClick={() => setShowExitModal(true)}
                aria-label={t('exitTest')}
                title={t('exitTest')}
                className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-2xl border border-line bg-card text-ink2 shadow-pill transition hover:bg-coralsoft hover:text-coral"
              >
                <X size={18} />
              </button>
            )}
            <button
              onClick={toggleFlag}
              aria-pressed={isFlagged}
              aria-label={isFlagged ? t('unflagQuestion') : t('flagForReview')}
              className={[
                'press inline-flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2.5 font-heading text-sm font-semibold transition sm:px-4',
                isFlagged
                  ? 'bg-coral text-white shadow-pill'
                  : 'border border-line bg-card text-ink2 shadow-pill hover:text-coral',
              ].join(' ')}
            >
              <Flag size={16} className={`flex-shrink-0 ${isFlagged ? 'animate-popStar' : ''}`} />
              <span className="hidden whitespace-nowrap sm:inline">
                {isFlagged ? t('flagged') : t('flag')}
              </span>
            </button>
          </div>

          {/* Next / Submit */}
          {isLast ? (
            <button
              onClick={requestSubmit}
              className="btn-brand flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm sm:px-6"
            >
              {t('submitTest')}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="btn-brand inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap px-4 py-2.5 text-sm sm:px-6"
            >
              {t('next')} <ChevronRight size={18} className="flex-shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Exit confirmation (practice tests only) */}
      {showExitModal && (
        <ExitTestModal
          onEvaluate={handleExitEvaluate}
          onDiscard={handleExitDiscard}
          onCancel={() => setShowExitModal(false)}
        />
      )}

      {/* Attendance gate modal (25%) */}
      {showGateModal && (
        <AttendanceGateModal
          attempted={attempted}
          total={total}
          onSubmitAnyway={() => {
            setShowGateModal(false)
            handleSubmit()
          }}
          onContinue={() => setShowGateModal(false)}
        />
      )}

      {/* Submit error (grading is server-side; allow a retry) */}
      {submitError && (
        <SubmitErrorModal
          message={submitError}
          onRetry={() => {
            setSubmitError('')
            handleSubmit()
          }}
          onSignIn={() => navigate('/login')}
        />
      )}

      {/* ── Proctoring overlays ── */}
      {proctored && violationToast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-xl bg-coral px-4 py-2.5 text-center font-heading text-sm font-semibold text-white shadow-lg">
          {violationToast}
        </div>
      )}
      {proctored && fsSupported && notFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/80 px-6 text-center backdrop-blur-sm">
          <Maximize2 size={40} className="text-white" />
          <p className="max-w-md font-heading text-lg font-semibold text-white">
            {t('instrFullscreen')}
          </p>
          <button onClick={reEnterFullscreen} className="btn-brand">
            {t('enterFullscreen')}
          </button>
        </div>
      )}
      {proctored && <ScreenGuard message={t('screenProtected')} />}
    </div>
  )
}
