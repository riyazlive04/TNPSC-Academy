import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Loader2 } from 'lucide-react'
import Timer from '../components/UI/Timer'
import ProgressBar from '../components/UI/ProgressBar'
import QuestionCard from '../components/Quiz/QuestionCard'
import {
  ATTENDANCE_GATE,
  MIN_SECONDS_PER_QUESTION,
  useQuizStore,
} from '../store/quizStore'
import { useQuiz } from '../hooks/useQuiz'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { describeConfig, fetchQuestionsForConfig, shuffle } from '../lib/fetchQuestions'
import { enqueueReviewItems } from '../lib/srs'
import type { AnswerLetter, QuizConfig, ResultPayload } from '../types'

export default function QuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const config = location.state as QuizConfig | null

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

  const submittedRef = useRef(false)

  // ── Guard: must have config ──
  useEffect(() => {
    if (!config) {
      navigate('/test-arena', { replace: true })
    }
  }, [config, navigate])

  // ── Load questions once ──
  useEffect(() => {
    if (!config) return
    let cancelled = false
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
        store.initSession(config, shuffle(fetched))
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
        handleSubmit(true)
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

  // ── Submit flow ──
  const attemptSubmit = () => {
    const attendance = total > 0 ? attempted / total : 0
    if (attendance < ATTENDANCE_GATE) {
      setShowGateModal(true)
      return
    }
    handleSubmit(false)
  }

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true

      const s = useQuizStore.getState()
      const qs = s.questions
      const ans = s.answers
      const cfg = s.config
      if (!cfg || qs.length === 0) {
        navigate('/test-arena', { replace: true })
        return
      }

      const attemptedCount = Object.keys(ans).length
      const correctCount = Object.values(ans).filter((a) => a.is_correct).length
      const totalQ = qs.length
      const scorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
      const passed80 = attemptedCount / totalQ >= ATTENDANCE_GATE
      const timeTaken = s.timeLimitSeconds - s.totalTimeLeft

      s.setSubmitting(true)

      // Persist session + answers (best-effort — UI still proceeds on error).
      let sessionId: string | undefined
      try {
        const user = useAuthStore.getState().user
        if (user) {
          const { data: sessionRow, error: sErr } = await supabase
            .from('test_sessions')
            .insert({
              user_id: user.id,
              category: cfg.category,
              group_type: cfg.group_type ?? null,
              subject: cfg.subject ?? null,
              standard: cfg.standard ?? null,
              ca_month: cfg.ca_month ?? null,
              ca_type: cfg.ca_type ?? null,
              aptitude_type: cfg.aptitude_type ?? null,
              aptitude_topic: cfg.aptitude_topic ?? null,
              total_questions: totalQ,
              attempted: attemptedCount,
              correct: correctCount,
              score_percentage: scorePct,
              pdf_unlocked: passed80,
              passed_80_percent: passed80,
              time_limit_seconds: s.timeLimitSeconds,
              time_taken_seconds: timeTaken,
              completed_at: new Date().toISOString(),
              status: 'completed',
            })
            .select('id')
            .single()

          if (!sErr && sessionRow) {
            sessionId = (sessionRow as { id: string }).id
            const rows = Object.values(ans).map((a) => ({
              session_id: sessionId,
              question_id: a.question_id,
              selected_answer: a.selected_answer,
              is_correct: a.is_correct,
              time_spent_seconds: a.time_spent_seconds,
              flagged: s.flags[a.question_id] ?? false,
            }))
            if (rows.length) {
              await supabase.from('test_answers').insert(rows)
            }
          }
        }
      } catch {
        /* non-fatal — proceed to result either way */
      }

      const payload: ResultPayload = {
        config: cfg,
        questions: qs,
        answers: ans,
        totalQuestions: totalQ,
        attempted: attemptedCount,
        correct: correctCount,
        scorePercentage: scorePct,
        pdfUnlocked: passed80,
        passed80,
        timeLimitSeconds: s.timeLimitSeconds,
        timeTakenSeconds: timeTaken,
        sessionId,
      }
      // Smart revision: enqueue wrong + flagged questions for spaced review.
      try {
        const user = useAuthStore.getState().user
        if (user) {
          const toReview = qs
            .filter((q) => {
              const a = ans[q.id]
              const wrong = a ? !a.is_correct : true // unattempted counts as needing review
              return wrong || s.flags[q.id]
            })
            .map((q) => q.id)
          if (toReview.length) await enqueueReviewItems(user.id, toReview)
        }
      } catch {
        /* non-fatal */
      }

      s.setSubmitting(false)
      void auto
      navigate('/result', { state: payload, replace: true })
    },
    [navigate]
  )

  // ── Render states ──
  if (!config) return null

  if (loading) {
    return (
      <CenteredMessage>
        <Loader2 size={36} className="animate-spin text-accent" />
        <p className="font-heading uppercase tracking-widest text-white/70">
          Preparing your test…
        </p>
      </CenteredMessage>
    )
  }

  if (loadError) {
    return (
      <CenteredMessage>
        <AlertTriangle size={36} className="text-warn" />
        <p className="max-w-sm text-center font-body text-white/80">{loadError}</p>
        <button
          onClick={() => navigate('/test-arena')}
          className="rounded-full bg-accent px-6 py-2.5 font-heading font-bold uppercase text-navytext"
        >
          Back to Test Arena
        </button>
      </CenteredMessage>
    )
  }

  if (empty) {
    return (
      <CenteredMessage>
        <AlertTriangle size={36} className="text-accent" />
        <p className="max-w-sm text-center font-body text-white/80">
          No questions are available for this selection yet. Please run the content
          upload, or choose another topic.
        </p>
        <button
          onClick={() => navigate('/test-arena')}
          className="rounded-full bg-accent px-6 py-2.5 font-heading font-bold uppercase text-navytext"
        >
          Back to Test Arena
        </button>
      </CenteredMessage>
    )
  }

  if (!currentQuestion) return null

  const isFlagged = flags[currentQuestion.id] ?? false
  const isLast = currentIndex + 1 >= total
  const flaggedCount = Object.values(flags).filter(Boolean).length

  return (
    <div className="min-h-screen bg-primary pb-28">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-primary/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="font-heading text-lg font-bold text-white">
            Q {currentIndex + 1} / {total}
          </span>
          <span className="hidden max-w-[40%] truncate font-body text-xs text-white/60 sm:block">
            {describeConfig(config)}
          </span>
          <Timer secondsLeft={totalTimeLeft} />
        </div>
        <div className="mx-auto mt-2 max-w-2xl">
          <ProgressBar percent={total > 0 ? ((currentIndex + 1) / total) * 100 : 0} />
          <div className="mt-1 flex justify-between font-body text-[11px] text-white/50">
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
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-warn/20 px-4 py-3 font-body text-sm text-white">
            <AlertTriangle size={18} className="flex-shrink-0 text-warn" />
            Please spend at least {MIN_SECONDS_PER_QUESTION} seconds on this question.
            ({Math.max(0, MIN_SECONDS_PER_QUESTION - secondsOnQuestion)}s left)
          </div>
        )}
      </div>

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-primary/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2.5 font-heading text-sm font-semibold uppercase text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            <ChevronLeft size={18} /> Prev
          </button>

          <button
            onClick={toggleFlag}
            className={[
              'inline-flex items-center gap-1 rounded-full px-4 py-2.5 font-heading text-sm font-semibold uppercase transition',
              isFlagged ? 'bg-warn text-white' : 'bg-white/10 text-white hover:bg-white/20',
            ].join(' ')}
          >
            <Flag size={16} /> {isFlagged ? 'Flagged' : 'Flag'}
          </button>

          {isLast ? (
            <button
              onClick={attemptSubmit}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-5 py-2.5 font-heading text-sm font-bold uppercase text-navytext transition hover:-translate-y-0.5"
            >
              Submit Test
            </button>
          ) : (
            <button
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-5 py-2.5 font-heading text-sm font-bold uppercase text-navytext transition hover:-translate-y-0.5"
            >
              Next <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 80% gate modal */}
      {showGateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-warn">
              <AlertTriangle size={24} />
              <h3 className="font-heading text-xl font-bold uppercase text-navytext">
                Attendance below 80%
              </h3>
            </div>
            <p className="mb-5 font-body text-sm leading-relaxed text-navytext/80">
              You have attempted{' '}
              <span className="font-bold">
                {attempted}/{total}
              </span>{' '}
              ({Math.round((attempted / total) * 100)}%). You must attempt at least{' '}
              <span className="font-bold">80%</span> of the questions to unlock the
              explanation PDF. You can still submit now to see your score only.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => {
                  setShowGateModal(false)
                  handleSubmit(false)
                }}
                className="flex-1 rounded-full bg-navytext px-5 py-3 font-heading text-sm font-bold uppercase text-white transition hover:opacity-90"
              >
                Submit Anyway (Score Only)
              </button>
              <button
                onClick={() => setShowGateModal(false)}
                className="flex-1 rounded-full bg-accent px-5 py-3 font-heading text-sm font-bold uppercase text-navytext transition hover:-translate-y-0.5"
              >
                Continue Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary px-4">
      {children}
    </div>
  )
}
