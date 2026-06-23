import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Flag, Grid3x3, GripVertical, Loader2, Maximize2, X } from 'lucide-react'
import QuestionStem from '../components/Quiz/QuestionStem'
import QuestionFigures from '../components/Quiz/QuestionFigures'
import OmrBubbles from '../components/Quiz/OmrBubbles'
import OmrOptions from '../components/Quiz/OmrOptions'
import ScreenGuard from '../components/Quiz/ScreenGuard'
import ReportQuestionModal from '../components/Quiz/ReportQuestionModal'
import { formatTime } from '../components/UI/Timer'
import { api } from '../lib/api'
import { describeConfig } from '../lib/fetchQuestions'
import { exitFullscreen } from '../lib/proctor'
import { submitTest } from '../lib/submitTest'
import { useProctoring, MAX_VIOLATIONS, type Violation } from '../hooks/useProctoring'
import { useScreenSecure } from '../hooks/useScreenSecure'
import { useMockQuizStore } from '../store/mockQuizStore'
import { useT } from '../lib/i18n'
import { optionLetters, displayOption } from '../types'
import type { AnswerLetter, DisplayLang, Question, QuizConfig, TestAnswer } from '../types'

/** Loose structural match so resuming a refreshed mock reuses the same session. */
function sameMockConfig(a: QuizConfig, b: QuizConfig): boolean {
  return (
    a.mockKind === b.mockKind &&
    a.mockGroup === b.mockGroup &&
    a.subject === b.subject &&
    a.topic === b.topic &&
    a.difficulty === b.difficulty
  )
}

/** True when a question carries any answer-option text (option_a..d / _ta). */
function hasOptions(q: Question, lang: DisplayLang): boolean {
  return optionLetters(q).some((l) => {
    const txt = displayOption(q, l, lang)
    return Boolean(txt && txt.trim())
  })
}

/** Per-question status used to colour the OMR palette. */
type Status = 'notVisited' | 'visited' | 'answered' | 'markedReview' | 'answeredMarked'

const PAGE_SIZE = 50 // questions per OMR answer-sheet page (100-Q exam → 2 pages of 50)

export default function MockQuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  // On a hard refresh, router `location.state` is lost - fall back to the
  // persisted in-progress mock session's config so the test can resume.
  const navConfig = location.state as QuizConfig | null
  const config = navConfig ?? useMockQuizStore.getState().config

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [empty, setEmpty] = useState(false)
  // Bumped by the Retry button to re-run the load effect after a load failure.
  const [reloadKey, setReloadKey] = useState(0)

  const [index, setIndex] = useState(0)
  const [page, setPage] = useState(() => useMockQuizStore.getState().page)
  const [answers, setAnswers] = useState<Record<string, AnswerLetter>>(
    () => useMockQuizStore.getState().answers
  )
  const [marked, setMarked] = useState<Record<string, boolean>>(
    () => useMockQuizStore.getState().marked
  )
  const [visited, setVisited] = useState<Record<number, boolean>>(
    () => useMockQuizStore.getState().visited
  )

  const [timeLeft, setTimeLeft] = useState(config?.mockDurationSeconds ?? 0)
  const [timeToast, setTimeToast] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Questions the student has flagged for correction (reported to admins). Kept
  // in memory; the server is the source of truth.
  const [reported, setReported] = useState<Record<string, boolean>>({})
  const [reportToast, setReportToast] = useState('')
  const reportTimers = useRef<number[]>([]) // pending report-toast dismiss timers
  // Absolute index of the question whose feedback box is open (null = closed).
  // While open the countdown is paused so reporting never costs exam time.
  const [reportIdx, setReportIdx] = useState<number | null>(null)
  const pauseStartRef = useRef<number | null>(null)

  const startedAtRef = useRef<number>(Date.now())
  const submittedRef = useRef(false)
  // Latest proctoring violations, read at submit time (kept in a ref so the
  // memoised submit handler doesn't need them as a dependency).
  const violationsRef = useRef<Violation[]>([])
  // Time thresholds (sec) we've already warned about, so each fires once.
  const warnedRef = useRef<Set<number>>(new Set())
  const timeToastTimers = useRef<number[]>([]) // pending time-toast dismiss timers

  // ── Guard: must have a proctored config ──
  useEffect(() => {
    if (!config?.proctored) navigate('/mock', { replace: true })
  }, [config, navigate])

  // ── Load questions once (or resume an in-progress one after a refresh) ──
  useEffect(() => {
    if (!config?.proctored) return
    let cancelled = false

    // Resume: the persisted store already holds a matching, unfinished mock.
    const persisted = useMockQuizStore.getState()
    const canResume =
      persisted.questions.length > 0 &&
      persisted.config != null &&
      sameMockConfig(persisted.config, config)
    if (canResume) {
      setQuestions(persisted.questions)
      startedAtRef.current = persisted.startedAt
      // Recompute remaining time from startedAt (wall clock kept moving while
      // the tab was closed).
      const elapsed = Math.floor((Date.now() - persisted.startedAt) / 1000)
      setTimeLeft(Math.max(0, (config.mockDurationSeconds ?? 0) - elapsed))
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    setEmpty(false)
    ;(async () => {
      try {
        const qs =
          config.mockKind === 'group'
            ? await api.mockGroupQuestions(config.mockGroup as string)
            : await api.subjectMockQuestions({
                subject: config.subject,
                topic: config.topic,
                difficulty: config.difficulty,
                count: config.mockQuestionCount ?? 50,
              })
        if (cancelled) return
        if (!qs.length) {
          setEmpty(true)
        } else {
          setQuestions(qs)
          const now = Date.now()
          startedAtRef.current = now
          // Begin a fresh persisted session so a refresh can resume it.
          useMockQuizStore.getState().start(config, qs)
          setTimeLeft(config.mockDurationSeconds ?? 0)
          setAnswers({})
          setMarked({})
          setVisited({ 0: true })
          setPage(0)
        }
      } catch {
        if (!cancelled) setLoadError(t('loadQuestionsError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  const total = questions.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageStart = page * PAGE_SIZE

  // Absolute indices of flagged questions (across every page), and the indices
  // the OMR sheet actually renders: the whole current page, or - when the
  // "flagged only" filter is on - just the flagged ones.
  const flaggedIndices = useMemo(
    () =>
      questions.reduce<number[]>((acc, q, i) => {
        if (marked[q.id]) acc.push(i)
        return acc
      }, []),
    [questions, marked]
  )
  const visibleIndices = useMemo(
    () =>
      showFlaggedOnly
        ? flaggedIndices
        : Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - pageStart)) }, (_, k) => pageStart + k),
    [showFlaggedOnly, flaggedIndices, total, pageStart]
  )

  // ── Submit (memoised so timers/handlers share one instance) ──
  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      setSubmitError('')

      const answerMap: Record<string, TestAnswer> = {}
      for (const q of questions) {
        const sel = answers[q.id]
        if (sel) {
          answerMap[q.id] = {
            question_id: q.id,
            selected_answer: sel,
            time_spent_seconds: 0,
            flagged: marked[q.id] ?? false,
          }
        }
      }

      try {
        const payload = await submitTest({
          config: config as QuizConfig,
          questions,
          answers: answerMap,
          flags: marked,
          timeLimitSeconds: config?.mockDurationSeconds ?? 0,
          startedAt: startedAtRef.current,
        })
        // Clear the persisted in-progress mock session.
        useMockQuizStore.getState().reset()
        // Exit fullscreen on the way out.
        await exitFullscreen()
        navigate('/result', { state: { ...payload, violations: violationsRef.current, autoSubmitted: auto } })
      } catch {
        submittedRef.current = false
        // TODO i18n: no dedicated key in src/lib/i18n.ts (owned elsewhere);
        // reuse the closest existing key for the connection-failure message.
        setSubmitError(t('loadQuestionsError'))
        setSubmitting(false)
      }
    },
    [answers, marked, questions, config, navigate, t]
  )

  // ── Countdown timer (auto-submit at zero, warn at 30/10/5 min) ──
  useEffect(() => {
    // `reportIdx !== null` pauses the countdown while the feedback box is open.
    if (loading || empty || loadError || !total || reportIdx !== null) return
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1
        if (next <= 0) {
          window.clearInterval(id)
          void doSubmit(true)
          return 0
        }
        // One-shot warnings.
        for (const [sec, key] of [
          [1800, t('timeWarning30')],
          [600, t('timeWarning10')],
          [300, t('timeWarning5')],
        ] as [number, string][]) {
          if (next === sec && !warnedRef.current.has(sec)) {
            warnedRef.current.add(sec)
            setTimeToast(key)
            timeToastTimers.current.push(window.setTimeout(() => setTimeToast(''), 5000))
          }
        }
        return next
      })
    }, 1000)
    return () => {
      window.clearInterval(id)
      timeToastTimers.current.forEach((tid) => window.clearTimeout(tid))
      timeToastTimers.current = []
    }
  }, [loading, empty, loadError, total, doSubmit, t, reportIdx])

  // ── Proctoring (fullscreen, tab-switch, copy/paste; auto-submit on abuse) ──
  // Shared engine; mirrors QuizPage. Its synchronous done-latch prevents rapid
  // violations from double-submitting, and it clears its own toast timers.
  const proctorActive = !loading && !empty && !loadError && total > 0
  // Block OS screenshots/recording (native app) while the mock test is on screen.
  useScreenSecure(proctorActive)
  const { violations, violationToast, notFullscreen, fsSupported, reEnterFullscreen } =
    useProctoring({
      active: proctorActive,
      questionIndex: index,
      onAutoSubmit: () => {
        void doSubmit(true)
      },
    })
  violationsRef.current = violations

  // ── Warn before an accidental browser back / refresh ──
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  // ── Paged OMR-sheet navigation / answer helpers ──
  // Mark every question on the visible page as "visited", and keep `index`
  // (used to tag violations & highlight the palette) pointing at the page start.
  useEffect(() => {
    if (!total) return
    setIndex(pageStart)
    setVisited((v) => {
      const next = { ...v }
      for (let i = pageStart; i < Math.min(total, pageStart + PAGE_SIZE); i++) next[i] = true
      return next
    })
    window.scrollTo({ top: 0 })
  }, [page, pageStart, total])

  // ── Persist answers / marks / visited / page so a refresh can resume ──
  // Only mirrors into the store while a session is live (questions loaded);
  // guards against clobbering a freshly-reset store on unmount.
  useEffect(() => {
    if (!total) return
    useMockQuizStore.getState().setAnswers(answers)
  }, [answers, total])
  useEffect(() => {
    if (!total) return
    useMockQuizStore.getState().setMarked(marked)
  }, [marked, total])
  useEffect(() => {
    if (!total) return
    useMockQuizStore.getState().setVisited(visited)
  }, [visited, total])
  useEffect(() => {
    if (!total) return
    useMockQuizStore.getState().setPage(page)
  }, [page, total])

  const jumpToQuestion = (i: number) => {
    if (i < 0 || i >= total) return
    setPage(Math.floor(i / PAGE_SIZE))
    setPaletteOpen(false)
    // Jumping to a question the flagged-only filter would hide drops the filter
    // so the target is actually visible to scroll to.
    if (showFlaggedOnly && !marked[questions[i]?.id]) setShowFlaggedOnly(false)
    requestAnimationFrame(() =>
      document.getElementById(`omr-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    )
  }
  const setAnswer = (q: Question, letter: AnswerLetter) =>
    setAnswers((a) => ({ ...a, [q.id]: letter }))
  const clearAnswer = (q: Question) =>
    setAnswers((a) => {
      const next = { ...a }
      delete next[q.id]
      return next
    })
  const toggleFlag = (q: Question) => setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))

  const reportToastFor = (msg: string) => {
    setReportToast(msg)
    reportTimers.current.push(window.setTimeout(() => setReportToast(''), 3500))
  }

  // Tapping the report icon: an already-reported question is un-reported in
  // place; otherwise the feedback box opens (which pauses the countdown).
  const onReportClick = (q: Question, i: number) => {
    if (reported[q.id]) {
      setReported((r) => ({ ...r, [q.id]: false }))
      void api.feedback.reportQuestion(q.id, false).catch(() => {})
      reportToastFor(t('reportQuestionUndone'))
      return
    }
    pauseStartRef.current = Date.now()
    setReportIdx(i)
  }

  // Closing the box (submit or cancel) resumes the clock; the paused span is
  // credited back to startedAt so the recorded time-taken stays honest.
  const resumeAfterReport = () => {
    if (pauseStartRef.current != null) {
      startedAtRef.current += Date.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setReportIdx(null)
  }

  const submitReport = (reason: string) => {
    const q = reportIdx != null ? questions[reportIdx] : null
    if (q) {
      setReported((r) => ({ ...r, [q.id]: true }))
      void api.feedback.reportQuestion(q.id, true, reason || undefined).catch(() => {})
      reportToastFor(t('reportQuestionDone'))
    }
    resumeAfterReport()
  }

  // Clear pending report-toast timers on unmount.
  useEffect(
    () => () => {
      reportTimers.current.forEach((id) => window.clearTimeout(id))
      reportTimers.current = []
    },
    []
  )

  const statusOf = useCallback(
    (i: number): Status => {
      const q = questions[i]
      if (!q) return 'notVisited'
      const isAnswered = Boolean(answers[q.id])
      const isMarked = Boolean(marked[q.id])
      if (isAnswered && isMarked) return 'answeredMarked'
      if (isMarked) return 'markedReview'
      if (isAnswered) return 'answered'
      if (visited[i]) return 'visited'
      return 'notVisited'
    },
    [questions, answers, marked, visited]
  )

  const counts = useMemo(() => {
    const c = { answered: 0, notVisited: 0, marked: 0 }
    questions.forEach((_, i) => {
      const s = statusOf(i)
      if (s === 'answered' || s === 'answeredMarked') c.answered++
      if (s === 'markedReview' || s === 'answeredMarked') c.marked++
      if (s === 'notVisited') c.notVisited++
    })
    return c
  }, [questions, statusOf])

  // ── Render states ──
  if (!config?.proctored) return null

  if (loading) {
    return (
      <CenteredScreen>
        <Loader2 size={36} className="animate-spin text-brand" />
        <p className="mt-3 font-body text-sm text-ink2">{t('loading')}</p>
      </CenteredScreen>
    )
  }
  if (loadError || empty) {
    return (
      <CenteredScreen>
        <AlertTriangle size={36} className="text-coral" />
        <p className="mt-3 max-w-sm text-center font-body text-sm text-ink2">
          {empty ? t('noQuestionsLong') : loadError}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {/* Only a transient load failure is retryable; an empty pool isn't. */}
          {!empty && (
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn-brand">
              {t('retry')}
            </button>
          )}
          <button
            onClick={() => navigate('/mock')}
            className={empty ? 'btn-brand' : 'rounded-full border border-line px-5 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring'}
          >
            {t('mockTests')}
          </button>
        </div>
      </CenteredScreen>
    )
  }

  const timeLow = timeLeft <= 300

  const palette = (
    <Palette
      questions={questions}
      page={page}
      pageSize={PAGE_SIZE}
      pageCount={pageCount}
      onPageChange={setPage}
      counts={counts}
      statusOf={statusOf}
      goTo={jumpToQuestion}
      onSubmit={() => doSubmit(false)}
      submitting={submitting}
      flaggedCount={flaggedIndices.length}
      showFlaggedOnly={showFlaggedOnly}
      onToggleFlagged={() => setShowFlaggedOnly((v) => !v)}
      t={t}
    />
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas select-none">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
        <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-ink">
          {describeConfig(config, lang)}
        </span>
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          {violations.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-coral/10 px-2 py-1 font-heading text-xs font-semibold text-coral">
              <AlertTriangle size={13} /> {violations.length}/{MAX_VIOLATIONS}
            </span>
          )}
          <span
            className={[
              'rounded-lg px-2.5 py-1.5 font-heading text-sm font-bold tabular-nums sm:text-base',
              timeLow ? 'bg-coral/10 text-coral' : 'bg-tint text-ink',
            ].join(' ')}
          >
            {formatTime(timeLeft)}
          </span>
          {/* Palette toggle - phones/tablets only; desktop shows the sidebar. */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label={t('openPalette')}
            className="icon-btn h-9 w-9 lg:hidden"
          >
            <Grid3x3 size={18} />
          </button>
        </div>
      </header>

      {/* Toasts */}
      {timeToast && <Toast tone="warn">{timeToast}</Toast>}
      {violationToast && <Toast tone="error">{violationToast}</Toast>}
      {reportToast && <Toast tone="info">{reportToast}</Toast>}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-3 py-4 sm:px-4 sm:py-5 lg:flex-row">
        {/* OMR answer sheet - one page of question rows */}
        <main className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-heading text-sm font-semibold text-ink2">
              {showFlaggedOnly
                ? `${t('flagged')} (${flaggedIndices.length})`
                : `${t('question')} ${pageStart + 1}-${Math.min(total, pageStart + PAGE_SIZE)} ${t('of')} ${total}`}
            </span>
            {!showFlaggedOnly && (
              <span className="flex-shrink-0 font-body text-xs tabular-nums text-ink2">
                {page + 1} / {pageCount}
              </span>
            )}
          </div>

          {showFlaggedOnly && flaggedIndices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <Flag size={28} className="mx-auto text-ink2/40" />
              <p className="mx-auto mt-3 max-w-xs font-body text-sm text-ink2">{t('noFlagged')}</p>
              <button onClick={() => setShowFlaggedOnly(false)} className="btn-soft mt-4">
                {t('showAll')}
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {visibleIndices.map((i) => {
              const q = questions[i]
              const sel = answers[q.id] ?? null
              const flagged = Boolean(marked[q.id])
              return (
                <div
                  key={q.id}
                  id={`omr-q-${i}`}
                  className="scroll-mt-20 rounded-card border border-line bg-card p-4 sm:p-5"
                >
                  {/* Top: question number + flag / clear */}
                  <div className="flex items-center gap-3 border-b border-line pb-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft font-heading text-sm font-bold text-brand">
                      {i + 1}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => onReportClick(q, i)}
                        aria-label={t('reportQuestionAria')}
                        aria-pressed={Boolean(reported[q.id])}
                        title={reported[q.id] ? t('reportedLabel') : t('reportError')}
                        className={[
                          'icon-btn h-9 w-9 flex-shrink-0',
                          reported[q.id] ? 'text-coral' : 'text-ink2/45',
                        ].join(' ')}
                      >
                        <AlertCircle size={16} />
                      </button>
                      <button
                        onClick={() => toggleFlag(q)}
                        aria-label={t('markedReview')}
                        aria-pressed={flagged}
                        className={[
                          'icon-btn h-9 w-9 flex-shrink-0',
                          flagged ? 'text-primary' : 'text-ink2/45',
                        ].join(' ')}
                      >
                        <Flag size={16} className={flagged ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={() => clearAnswer(q)}
                        disabled={!sel}
                        aria-label={t('clearResponse')}
                        className="icon-btn h-9 w-9 flex-shrink-0 disabled:opacity-40"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Question text */}
                  <div className="mt-3">
                    <QuestionStem
                      question={q}
                      lang={lang}
                      textClassName="text-[15px] font-semibold leading-relaxed text-navytext sm:text-base"
                    />
                    <QuestionFigures images={q.images} className="mt-3" />
                  </div>

                  {/* Answer choices - full option text + OMR-style bubble. Falls
                      back to a bare A-D bubble row only if the question has no
                      option text stored. */}
                  {hasOptions(q, lang) ? (
                    <OmrOptions question={q} lang={lang} selected={sel} onSelect={(l) => setAnswer(q, l)} />
                  ) : (
                    <div className="mt-4">
                      <OmrBubbles selected={sel} onSelect={(l) => setAnswer(q, l)} letters={optionLetters(q)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}

          {/* Pagination - only in the full (unfiltered) view */}
          {!showFlaggedOnly && <Paginator page={page} pageCount={pageCount} onJump={setPage} t={t} />}

          <div className="mt-4 flex items-stretch gap-2">
            {/* Flagged-only filter: collapses the sheet to just the flagged questions. */}
            <button
              onClick={() => setShowFlaggedOnly((v) => !v)}
              aria-pressed={showFlaggedOnly}
              aria-label={t('flagged')}
              className={[
                'btn btn-lg flex-shrink-0 border',
                showFlaggedOnly
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-card text-ink2 hover:border-brand-ring',
              ].join(' ')}
            >
              <Flag size={16} className={showFlaggedOnly ? 'fill-current' : ''} />
              {t('flagged')}
              <span className="tabular-nums opacity-90">{flaggedIndices.length}</span>
            </button>
            <button
              onClick={() => doSubmit(false)}
              disabled={submitting}
              className="btn-brand btn-lg flex-1"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : t('submitTest')}
            </button>
          </div>
        </main>

        {/* Palette - inline sidebar on desktop. */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="card sticky top-20 p-4">{palette}</div>
        </aside>
      </div>

      {/* Right-edge palette handle - phones/tablets only (desktop has the inline
          sidebar). Tap to slide the panel in from the right. Hidden once open. */}
      {!paletteOpen && (
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label={t('openPalette')}
          className="fixed right-0 top-1/2 z-30 flex h-16 w-7 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-r-0 border-line bg-card/95 text-ink2 shadow-card backdrop-blur lg:hidden"
        >
          <ChevronLeft size={15} />
          <GripVertical size={14} className="opacity-60" />
        </button>
      )}

      {/* Palette - slide-in edge panel from the right on phones/tablets. Always
          mounted so it can transition both ways; pointer-events drop when closed
          so the OMR sheet underneath stays interactive. */}
      <div
        className={['fixed inset-0 z-40 lg:hidden', paletteOpen ? '' : 'pointer-events-none'].join(' ')}
        aria-hidden={!paletteOpen}
      >
        <button
          aria-label={t('done')}
          tabIndex={paletteOpen ? 0 : -1}
          onClick={() => setPaletteOpen(false)}
          className={[
            'absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300',
            paletteOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
        <div
          className={[
            'absolute right-0 top-0 flex h-full w-[82vw] max-w-sm flex-col border-l border-line bg-card shadow-card transition-transform duration-300 ease-out',
            paletteOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
              {t('questionPalette')}
            </h3>
            <button onClick={() => setPaletteOpen(false)} className="icon-btn h-8 w-8" aria-label={t('done')}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{palette}</div>
        </div>
      </div>

      {/* Fullscreen re-entry overlay - only on platforms that can go full-screen. */}
      {fsSupported && notFullscreen && (
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

      {/* Report-a-question feedback box. While open the countdown is paused. */}
      {reportIdx !== null && (
        <ReportQuestionModal
          questionNumber={reportIdx + 1}
          onSubmit={submitReport}
          onCancel={resumeAfterReport}
        />
      )}

      {/* Submit failure recovery - a prominent, always-visible banner so a failed
          (especially auto-) submit at 0:00 never leaves the student stuck with no
          way forward. Offers an immediate Retry Submit. */}
      {submitError && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 border-t border-coral/30 bg-coral/95 px-4 py-4 text-center text-white shadow-card sm:flex-row sm:justify-center"
        >
          <p className="font-heading text-sm font-semibold">{submitError}</p>
          <button
            onClick={() => doSubmit(true)}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-white px-5 py-2.5 font-heading text-sm font-bold text-coral transition hover:brightness-95 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : t('retrySubmit')}
          </button>
        </div>
      )}

      {/* Anti-capture shield - blanks the screen on focus loss / PrintScreen. */}
      <ScreenGuard message={t('screenProtected')} />
    </div>
  )
}

/** Shared palette body - rendered in the desktop sidebar and the mobile drawer.
 * The number grid is SCOPED to the current page: page 1 shows pills 1-50, page 2
 * shows 51-100, etc. A header switcher moves between pages; tapping a pill jumps
 * to that question (and, since pills are page-scoped, stays on the current page). */
function Palette({
  questions,
  page,
  pageSize,
  pageCount,
  onPageChange,
  counts,
  statusOf,
  goTo,
  onSubmit,
  submitting,
  flaggedCount,
  showFlaggedOnly,
  onToggleFlagged,
  t,
}: {
  questions: Question[]
  page: number
  pageSize: number
  pageCount: number
  onPageChange: (p: number) => void
  counts: { answered: number; marked: number; notVisited: number }
  statusOf: (i: number) => Status
  goTo: (i: number) => void
  onSubmit: () => void
  submitting: boolean
  flaggedCount: number
  showFlaggedOnly: boolean
  onToggleFlagged: () => void
  t: ReturnType<typeof useT>['t']
}) {
  const total = questions.length
  const start = page * pageSize
  const end = Math.min(total, start + pageSize)
  // Absolute indices for the pills shown on this page (e.g. 50..99 on page 2).
  const pageIndices = Array.from({ length: end - start }, (_, k) => start + k)

  return (
    <>
      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <SummaryStat value={counts.answered} label={t('answered')} cls="text-correct" />
        <SummaryStat value={counts.marked} label={t('markedReview')} cls="text-primary" />
        <SummaryStat value={counts.notVisited} label={t('notVisited')} cls="text-ink2" />
      </div>

      {/* Page switcher - only when the sheet spans more than one page */}
      {pageCount > 1 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label={t('prev')}
            className="icon-btn h-8 w-8 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-heading text-xs font-semibold tabular-nums text-ink2">
            {start + 1}-{end} <span className="text-ink2/50">/ {total}</span>
          </span>
          <button
            onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
            disabled={page === pageCount - 1}
            aria-label={t('next')}
            className="icon-btn h-8 w-8 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Grid - current page only */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
        {pageIndices.map((i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={[
              'grid aspect-square w-full place-items-center rounded-lg font-heading text-xs font-bold transition',
              PALETTE_CLS[statusOf(i)],
            ].join(' ')}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
        {(Object.keys(LEGEND) as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-2 font-body text-xs text-ink2">
            <span className={['h-4 w-4 shrink-0 rounded', PALETTE_CLS[s]].join(' ')} />
            {t(s)}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        {/* Flagged-only filter - mirrors the in-sheet toggle so it's reachable
            from the desktop sidebar and mobile panel without scrolling. */}
        <button
          onClick={onToggleFlagged}
          aria-pressed={showFlaggedOnly}
          aria-label={t('flagged')}
          className={[
            'btn flex-shrink-0 border',
            showFlaggedOnly
              ? 'border-violet-500 bg-violet-500 text-white'
              : 'border-line bg-card text-ink2 hover:border-brand-ring',
          ].join(' ')}
        >
          <Flag size={15} className={showFlaggedOnly ? 'fill-current' : ''} />
          <span className="tabular-nums">{flaggedCount}</span>
        </button>
        <button onClick={onSubmit} disabled={submitting} className="btn-brand flex-1">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : t('submitTest')}
        </button>
      </div>
    </>
  )
}

/** Windowed page-number bar for the OMR sheet (Prev · 1 … 4 5 6 … N · Next). */
function Paginator({
  page,
  pageCount,
  onJump,
  t,
}: {
  page: number
  pageCount: number
  onJump: (p: number) => void
  t: ReturnType<typeof useT>['t']
}) {
  if (pageCount <= 1) return null
  const items: (number | 'gap')[] = []
  for (let p = 0; p < pageCount; p++) {
    if (p === 0 || p === pageCount - 1 || Math.abs(p - page) <= 1) items.push(p)
    else if (items[items.length - 1] !== 'gap') items.push('gap')
  }
  return (
    <nav className="mt-5 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pages">
      <button
        onClick={() => onJump(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label={t('prev')}
        className="icon-btn h-9 w-9 disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      {items.map((it, idx) =>
        it === 'gap' ? (
          <span key={`gap-${idx}`} className="px-1 font-body text-sm text-ink2">
            …
          </span>
        ) : (
          <button
            key={it}
            onClick={() => onJump(it)}
            aria-current={it === page ? 'page' : undefined}
            className={[
              'grid h-9 min-w-9 place-items-center rounded-lg px-2 font-heading text-sm font-semibold tabular-nums transition',
              it === page
                ? 'bg-brand text-white'
                : 'border border-line bg-card text-ink2 hover:border-brand-ring',
            ].join(' ')}
          >
            {it + 1}
          </button>
        )
      )}
      <button
        onClick={() => onJump(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        aria-label={t('next')}
        className="icon-btn h-9 w-9 disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

// Tailwind classes per palette status (token-backed so it themes + flips in dark).
const PALETTE_CLS: Record<Status, string> = {
  notVisited: 'bg-tint text-ink2',
  visited: 'bg-ink2/20 text-ink',
  answered: 'bg-correct text-white',
  markedReview: 'bg-primary text-white',
  answeredMarked: 'bg-gold text-white',
}

const LEGEND: Record<Status, true> = {
  notVisited: true,
  visited: true,
  answered: true,
  markedReview: true,
  answeredMarked: true,
}

function SummaryStat({ value, label, cls }: { value: number; label: string; cls: string }) {
  return (
    <div className="rounded-xl bg-tint px-2 py-2">
      <div className={['font-heading text-lg font-bold leading-none', cls].join(' ')}>{value}</div>
      <div className="tamil mt-1 truncate font-body text-[10px] uppercase tracking-wide text-ink2">{label}</div>
    </div>
  )
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-4">
      {children}
    </div>
  )
}

function Toast({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: React.ReactNode }) {
  const toneCls =
    tone === 'error' ? 'bg-coral text-white' : tone === 'info' ? 'bg-brand text-white' : 'bg-gold text-white'
  return (
    <div
      className={[
        'fixed left-1/2 top-16 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-center font-heading text-sm font-semibold shadow-card',
        toneCls,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
