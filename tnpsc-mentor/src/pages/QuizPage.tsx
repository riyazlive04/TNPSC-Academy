import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Loader2, X } from 'lucide-react'
import Timer from '../components/UI/Timer'
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
import type { AnswerLetter, QuizConfig } from '../types'

/** Loose structural match so resuming a refreshed test reuses the same pool. */
function sameConfig(a: QuizConfig, b: QuizConfig): boolean {
  return describeConfig(a) === describeConfig(b) && Boolean(a.mock) === Boolean(b.mock)
}

export default function QuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // On a hard refresh, router `location.state` is lost — fall back to the
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

  // 80% attendance gate modal before submit
  const [showGateModal, setShowGateModal] = useState(false)

  // Exit confirmation modal (practice tests only)
  const [showExitModal, setShowExitModal] = useState(false)

  const submittedRef = useRef(false)

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
          setLoadError(
            'Could not load questions. Check your connection / Supabase config and try again.'
          )
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
        handleSubmit()
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
    // Long questions can leave the next one scrolled past its top — reset to the
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

  const handleSubmit = useCallback(async () => {
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
        'Could not submit your test — grading happens on the server. Check your connection and retry.'
      )
      return
    }

    s.setSubmitting(false)
    s.reset() // clear the persisted in-progress session
    navigate('/result', { state: payload, replace: true })
  }, [navigate])

  // ── Render states ──
  if (!config) return null

  if (loading) {
    return (
      <CenteredMessage>
        <Loader2 size={36} className="animate-spin text-brand" />
        <p className="font-heading font-semibold uppercase tracking-widest text-ink2">
          Preparing your test…
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
          Back to Test Arena
        </button>
      </CenteredMessage>
    )
  }

  if (empty) {
    return (
      <CenteredMessage>
        <AlertTriangle size={36} className="text-brand" />
        <p className="max-w-sm text-center font-body text-ink2">
          No questions are available for this selection yet. Please run the content
          upload, or choose another topic.
        </p>
        <button onClick={() => navigate('/test-arena')} className="btn-brand px-6 py-2.5">
          Back to Test Arena
        </button>
      </CenteredMessage>
    )
  }

  if (!currentQuestion) return null

  const isFlagged = flags[currentQuestion.id] ?? false
  const isLast = currentIndex + 1 >= total
  const flaggedCount = Object.values(flags).filter(Boolean).length

  // Announce time milestones to screen readers instead of ticking every second.
  const timeAnnouncement =
    totalTimeLeft === 60
      ? '1 minute remaining'
      : totalTimeLeft === 30
        ? '30 seconds remaining'
        : totalTimeLeft === 10
          ? '10 seconds remaining'
          : ''

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <div className="sr-only" role="status" aria-live="assertive">
        {timeAnnouncement}
      </div>
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-line bg-canvas px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="font-heading text-lg font-extrabold text-ink">
            Q {currentIndex + 1} <span className="text-ink2/50">/ {total}</span>
          </span>
          <span className="hidden max-w-[40%] truncate font-body text-xs text-ink2 sm:block">
            {describeConfig(config)}
          </span>
          <div className="flex items-center gap-2">
            <Timer secondsLeft={totalTimeLeft} />
            {!config.mock && (
              <button
                onClick={() => setShowExitModal(true)}
                aria-label="Exit test"
                className="rounded-full p-1.5 text-ink2 transition hover:bg-coralsoft hover:text-coral"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-2xl">
          <ProgressBar percent={total > 0 ? ((currentIndex + 1) / total) * 100 : 0} />
          <div className="mt-1 flex justify-between font-body text-[11px] font-medium text-ink2">
            <span>Attempted: {attempted}/{total}</span>
            <span>Flagged: {flaggedCount}</span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="mx-auto mt-5 max-w-2xl px-4">
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={total}
          selected={selectedLetter}
          onSelect={handleSelect}
        />

        {minWarning && !canAdvance && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-coralsoft px-4 py-3 font-body text-sm font-medium text-coral">
            <AlertTriangle size={18} className="flex-shrink-0" />
            Please spend at least {MIN_SECONDS_PER_QUESTION} seconds on this question.
            ({Math.max(0, MIN_SECONDS_PER_QUESTION - secondsOnQuestion)}s left)
          </div>
        )}
      </div>

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1 rounded-2xl border border-line bg-card px-4 py-2.5 font-heading text-sm font-semibold text-ink shadow-pill transition hover:border-brand-ring disabled:opacity-40"
          >
            <ChevronLeft size={18} /> Prev
          </button>

          <button
            onClick={toggleFlag}
            aria-pressed={isFlagged}
            aria-label={isFlagged ? 'Unflag this question' : 'Flag this question for review'}
            className={[
              'press inline-flex items-center gap-1 rounded-2xl px-4 py-2.5 font-heading text-sm font-semibold transition',
              isFlagged
                ? 'bg-coral text-white shadow-pill'
                : 'border border-line bg-card text-ink2 shadow-pill hover:text-coral',
            ].join(' ')}
          >
            <Flag size={16} className={isFlagged ? 'animate-popStar' : ''} /> {isFlagged ? 'Flagged' : 'Flag'}
          </button>

          {isLast ? (
            <button onClick={requestSubmit} className="btn-brand px-6 py-2.5 text-sm">
              Submit Test
            </button>
          ) : (
            <button onClick={goNext} className="btn-brand px-6 py-2.5 text-sm">
              Next <ChevronRight size={18} />
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

      {/* 80% gate modal */}
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
    </div>
  )
}
