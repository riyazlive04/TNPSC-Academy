import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Clock, Flag, Languages, Loader2, Maximize2, X } from 'lucide-react'
import type { Lang } from '../store/languageStore'
import Timer from '../components/UI/Timer'
import ScreenGuard from '../components/Quiz/ScreenGuard'
import ReportQuestionModal from '../components/Quiz/ReportQuestionModal'
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
import { api } from '../lib/api'
import { submitTest } from '../lib/submitTest'
import { abandonTest } from '../lib/abandonTest'
import { trackAbandonTest } from '../lib/tracking'
import { useProctoring, MAX_VIOLATIONS, type Violation } from '../hooks/useProctoring'
import { useScreenSecure } from '../hooks/useScreenSecure'
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

  // Questions reported for correction (in memory; server is source of truth).
  const [reported, setReported] = useState<Record<string, boolean>>({})
  const [reportToast, setReportToast] = useState('')
  const reportTimers = useRef<number[]>([])
  // Feedback box open → the countdown is paused while it's up.
  const [reportOpen, setReportOpen] = useState(false)

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
  // Bumped by the Retry button to re-run the load effect after a load failure.
  const [reloadKey, setReloadKey] = useState(0)

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
    // Guard against a corrupt/truncated persisted set: it must be non-empty and
    // never larger than the config's requested count (which is an upper cap on
    // the fetched pool). A mismatch means we'd grade the wrong set - discard it
    // and re-fetch a fresh test instead.
    const persisted = useQuizStore.getState()
    const expectedCap = config.mock
      ? (config.mockQuestionCount ?? 50)
      : (config.questionCount ?? undefined)
    const persistedCount = persisted.questions.length
    const countLooksValid =
      persistedCount > 0 && (expectedCap == null || persistedCount <= expectedCap)
    const canResume =
      countLooksValid &&
      persisted.config != null &&
      sameConfig(persisted.config, config)
    if (canResume) {
      persisted.resumeTimer() // recompute remaining time from startedAt
      setLoading(false)
      return
    }
    // A stale/partial persisted session that can't be trusted - clear it so the
    // loader below starts a clean test rather than resuming a broken one.
    if (persisted.questions.length > 0 && !canResume) persisted.reset()

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
  }, [reloadKey])

  // ── Global countdown timer (auto-submit at 0) ──
  useEffect(() => {
    // `reportOpen` pauses the countdown while the feedback box is open.
    if (loading || empty || loadError || reportOpen) return
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
  }, [loading, empty, loadError, reportOpen])

  // ── Warn before an accidental browser back / refresh of an in-progress test ──
  // Mirrors MockQuizPage: once the test is loaded and not yet submitted, leaving
  // would lose progress, so prompt the native "leave site?" confirmation.
  const inProgress = !loading && !empty && !loadError && total > 0
  useEffect(() => {
    if (!inProgress) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [inProgress])

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

  const reportToastFor = (msg: string) => {
    setReportToast(msg)
    reportTimers.current.push(window.setTimeout(() => setReportToast(''), 3500))
  }

  // Tapping report: un-report in place if already reported, else open the
  // feedback box (which pauses the countdown).
  const onReportClick = () => {
    if (!currentQuestion) return
    if (reported[currentQuestion.id]) {
      const id = currentQuestion.id
      setReported((r) => ({ ...r, [id]: false }))
      void api.feedback.reportQuestion(id, false).catch(() => {})
      reportToastFor(t('reportQuestionUndone'))
      return
    }
    setReportOpen(true)
  }

  const submitReport = (reason: string) => {
    if (currentQuestion) {
      const id = currentQuestion.id
      setReported((r) => ({ ...r, [id]: true }))
      void api.feedback.reportQuestion(id, true, reason || undefined).catch(() => {})
      reportToastFor(t('reportQuestionDone'))
    }
    setReportOpen(false)
  }

  // Clear pending report-toast timers on unmount.
  useEffect(
    () => () => {
      reportTimers.current.forEach((id) => window.clearTimeout(id))
      reportTimers.current = []
    },
    []
  )

  // ── Exit flow (practice tests only) ──
  const handleExitEvaluate = () => {
    setShowExitModal(false)
    handleSubmit()
  }

  const handleExitDiscard = async () => {
    const s = useQuizStore.getState()
    if (s.config && s.questions.length > 0) {
      trackAbandonTest({
        reason: 'exit_button',
        category: s.config.category,
        subject: s.config.subject,
        totalQuestions: s.questions.length,
        attempted: Object.values(s.answers).filter((a) => a.selected_answer).length,
        timeTakenSeconds: Math.max(0, Math.round((Date.now() - (s.startedAt ?? Date.now())) / 1000)),
      })
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
  const testActive = !loading && !empty && !loadError && total > 0
  const proctorActive = proctored && testActive
  // Block OS screenshots/recording (native app) for the whole time a test is on
  // screen, proctored or not.
  useScreenSecure(testActive)
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-brand px-6 py-2.5">
            {t('retry')}
          </button>
          <button
            onClick={() => navigate('/test-arena')}
            className="rounded-full border border-line px-6 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring"
          >
            {t('backToTestArena')}
          </button>
        </div>
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-brand px-6 py-2.5">
            {t('retry')}
          </button>
          <button
            onClick={() => navigate('/test-arena')}
            className="rounded-full border border-line px-6 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring"
          >
            {t('backToTestArena')}
          </button>
        </div>
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
            {describeConfig(config, lang)}
          </span>
          {/* These controls move into the sticky side panel on desktop (lg). */}
          <span className="font-heading text-lg font-extrabold text-ink sm:order-2 lg:hidden">
            Q {currentIndex + 1} <span className="text-ink2/50">/ {total}</span>
          </span>
          <div className="flex items-center gap-2 sm:order-3 lg:hidden">
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
      <div className="relative mx-auto mt-5 max-w-2xl px-4">
        {/* Desktop only: question number, timer and language move into a sticky
            panel parallel to the question that follows the scroll. */}
        <div className="absolute left-full top-0 hidden h-full pl-4 lg:block">
          <aside className="sticky top-24 flex w-36 flex-col gap-3">
            {proctored && violations.length > 0 && (
              <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-coral/10 px-2 py-1.5 font-heading text-xs font-semibold text-coral">
                <AlertTriangle size={13} /> {violations.length}/{MAX_VIOLATIONS}
              </span>
            )}
            <div className="rounded-2xl border border-line bg-card px-3 py-2.5 text-center">
              <span className="block font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2">
                {t('question')}
              </span>
              <span className="font-heading text-lg font-extrabold text-ink">
                {currentIndex + 1} <span className="text-ink2/50">/ {total}</span>
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card px-3 py-3">
              <span className="font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2">
                {t('timeLeft')}
              </span>
              <Timer secondsLeft={totalTimeLeft} />
            </div>
            <button
              onClick={cycleQuizLang}
              title={t('viewLanguage')}
              aria-label={`${t('viewLanguage')} (${QUIZ_LANG_LABEL[quizLang]})`}
              className="tamil press inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-line bg-card px-3 py-2.5 font-heading text-sm font-semibold text-brand-dark transition hover:bg-tint focus-ring"
            >
              <Languages size={15} /> {QUIZ_LANG_LABEL[quizLang]}
            </button>
          </aside>
        </div>

        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={total}
          selected={selectedLetter}
          onSelect={handleSelect}
          displayLang={quizLang}
          bare
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

        {/* Report this question for correction (does not affect the score) */}
        <div className="mt-5 flex justify-center">
          <button
            onClick={onReportClick}
            aria-pressed={Boolean(reported[currentQuestion.id])}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-heading text-xs font-semibold transition',
              reported[currentQuestion.id]
                ? 'bg-coral/10 text-coral'
                : 'text-ink2/70 hover:bg-tint hover:text-coral',
            ].join(' ')}
          >
            <AlertCircle size={14} />
            {reported[currentQuestion.id] ? t('reportedLabel') : t('reportError')}
          </button>
        </div>
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
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-pill border border-line bg-card px-3 py-2.5 font-heading text-sm font-semibold text-ink2 transition-colors hover:border-primary/40 hover:text-ink disabled:opacity-40 sm:px-4"
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
                className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-pill border border-line bg-card text-ink2 transition-colors hover:bg-coralsoft hover:text-coral"
              >
                <X size={18} />
              </button>
            )}
            <button
              onClick={toggleFlag}
              aria-pressed={isFlagged}
              aria-label={isFlagged ? t('unflagQuestion') : t('flagForReview')}
              className={[
                'press inline-flex flex-shrink-0 items-center gap-1.5 rounded-pill px-3 py-2.5 font-heading text-sm font-semibold transition-colors sm:px-4',
                isFlagged
                  ? 'bg-accent text-white'
                  : 'border border-line bg-card text-ink2 hover:border-accent/40 hover:text-accent',
              ].join(' ')}
            >
              <Flag size={16} className={`flex-shrink-0 ${isFlagged ? 'animate-popStar' : ''}`} />
              <span className="hidden whitespace-nowrap sm:inline">
                {isFlagged ? t('flagged') : t('flag')}
              </span>
            </button>
          </div>

          {/* Next / Submit - warm rose CTA (per the quiz mockup), distinct from
              the violet progress/selection so the primary action always pops. */}
          {/* The single filled primary pill - the only filled button on the
              screen (design-system.md). Token gradient, not a hardcoded colour. */}
          {isLast ? (
            <button
              onClick={requestSubmit}
              className="inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-brand-gradient px-5 py-2.5 font-display text-sm font-semibold text-white transition-all hover:brightness-105 active:scale-[0.98] sm:px-6"
            >
              {t('submitTest')}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-brand-gradient px-5 py-2.5 font-display text-sm font-semibold text-white transition-all hover:brightness-105 active:scale-[0.98] sm:px-6"
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

      {/* Report-a-question feedback box. While open the countdown is paused. */}
      {reportOpen && (
        <ReportQuestionModal
          questionNumber={currentIndex + 1}
          onSubmit={submitReport}
          onCancel={() => setReportOpen(false)}
        />
      )}

      {/* Report confirmation toast */}
      {reportToast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-xl bg-brand px-4 py-2.5 text-center font-heading text-sm font-semibold text-white shadow-lg">
          {reportToast}
        </div>
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
