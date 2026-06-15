import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Loader2, Maximize2, X } from 'lucide-react'
import QuestionCard from '../components/Quiz/QuestionCard'
import { formatTime } from '../components/UI/Timer'
import { api } from '../lib/api'
import { submitTest } from '../lib/submitTest'
import { useT } from '../lib/i18n'
import type { AnswerLetter, Question, QuizConfig, TestAnswer } from '../types'

/** Per-question status used to colour the OMR palette. */
type Status = 'notVisited' | 'visited' | 'answered' | 'markedReview' | 'answeredMarked'

interface Violation {
  type: 'fullscreen_exit' | 'tab_switch' | 'copy_paste'
  at: number // ms since test start
  questionIndex: number
}

const MAX_VIOLATIONS = 5 // auto-submit threshold

export default function MockQuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const config = location.state as QuizConfig | null

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [empty, setEmpty] = useState(false)

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerLetter>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true })

  const [timeLeft, setTimeLeft] = useState(config?.mockDurationSeconds ?? 0)
  const [violations, setViolations] = useState<Violation[]>([])
  const [violationToast, setViolationToast] = useState('')
  const [timeToast, setTimeToast] = useState('')
  const [notFullscreen, setNotFullscreen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const startedAtRef = useRef<number>(Date.now())
  const submittedRef = useRef(false)
  // Time thresholds (sec) we've already warned about, so each fires once.
  const warnedRef = useRef<Set<number>>(new Set())

  // ── Guard: must have a proctored config ──
  useEffect(() => {
    if (!config?.proctored) navigate('/mock', { replace: true })
  }, [config, navigate])

  // ── Load questions once ──
  useEffect(() => {
    if (!config?.proctored) return
    let cancelled = false
    setLoading(true)
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
          startedAtRef.current = Date.now()
        }
      } catch {
        if (!cancelled) setLoadError('Could not load the test. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = questions.length
  const current = questions[index]

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
        // Exit fullscreen on the way out.
        if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {})
        navigate('/result', { state: { ...payload, violations, autoSubmitted: auto } })
      } catch {
        submittedRef.current = false
        setSubmitError('Could not submit your test. Check your connection and try again.')
        setSubmitting(false)
      }
    },
    [answers, marked, questions, config, violations, navigate]
  )

  // ── Countdown timer (auto-submit at zero, warn at 30/10/5 min) ──
  useEffect(() => {
    if (loading || empty || loadError || !total) return
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
            window.setTimeout(() => setTimeToast(''), 5000)
          }
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [loading, empty, loadError, total, doSubmit, t])

  // ── Record a violation; auto-submit once the threshold is crossed ──
  const recordViolation = useCallback(
    (type: Violation['type']) => {
      if (submittedRef.current) return
      setViolations((prev) => {
        const next = [...prev, { type, at: Date.now() - startedAtRef.current, questionIndex: index }]
        setViolationToast(t('violationWarning'))
        window.setTimeout(() => setViolationToast(''), 4000)
        if (next.length >= MAX_VIOLATIONS) void doSubmit(true)
        return next
      })
    },
    [index, doSubmit, t]
  )

  // ── Fullscreen + tab-switch + copy/paste enforcement ──
  useEffect(() => {
    if (loading || empty || loadError || !total) return

    const onFsChange = () => {
      const fs = Boolean(document.fullscreenElement)
      setNotFullscreen(!fs)
      if (!fs) recordViolation('fullscreen_exit')
    }
    const onVisibility = () => {
      if (document.hidden) recordViolation('tab_switch')
    }
    const onBlur = () => recordViolation('tab_switch')
    const blockCopy = (e: Event) => {
      e.preventDefault()
      recordViolation('copy_paste')
    }
    const blockContext = (e: Event) => e.preventDefault()
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(k)) {
        e.preventDefault()
        recordViolation('copy_paste')
      }
    }

    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', blockCopy)
    document.addEventListener('paste', blockCopy)
    document.addEventListener('cut', blockCopy)
    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('keydown', blockKeys)

    // Establish initial fullscreen state.
    setNotFullscreen(!document.fullscreenElement)

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('paste', blockCopy)
      document.removeEventListener('cut', blockCopy)
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('keydown', blockKeys)
    }
  }, [loading, empty, loadError, total, recordViolation])

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

  // ── Navigation / answer helpers ──
  const goTo = (i: number) => {
    if (i < 0 || i >= total) return
    setIndex(i)
    setVisited((v) => ({ ...v, [i]: true }))
  }
  const select = (letter: AnswerLetter) => {
    if (!current) return
    setAnswers((a) => ({ ...a, [current.id]: letter }))
  }
  const clearResponse = () => {
    if (!current) return
    setAnswers((a) => {
      const next = { ...a }
      delete next[current.id]
      return next
    })
  }
  const saveNext = () => goTo(index + 1)
  const markReviewNext = () => {
    if (current) setMarked((m) => ({ ...m, [current.id]: true }))
    goTo(index + 1)
  }
  const toggleMark = () => {
    if (current) setMarked((m) => ({ ...m, [current.id]: !m[current.id] }))
  }

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

  const reEnterFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

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
          {empty ? 'No questions are available for this selection yet.' : loadError}
        </p>
        <button onClick={() => navigate('/mock')} className="btn-brand mt-5">
          {t('mockTests')}
        </button>
      </CenteredScreen>
    )
  }

  const timeLow = timeLeft <= 300

  return (
    <div className="flex min-h-screen flex-col bg-canvas select-none">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
        <span className="font-heading text-sm font-semibold text-ink">{config.label}</span>
        <div className="flex items-center gap-3">
          {violations.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-coral/10 px-2.5 py-1 font-heading text-xs font-semibold text-coral">
              <AlertTriangle size={13} /> {violations.length}/{MAX_VIOLATIONS}
            </span>
          )}
          <span
            className={[
              'rounded-lg px-3 py-1.5 font-heading text-base font-bold tabular-nums',
              timeLow ? 'bg-coral/10 text-coral' : 'bg-tint text-ink',
            ].join(' ')}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
      </header>

      {/* Toasts */}
      {timeToast && <Toast tone="warn">{timeToast}</Toast>}
      {violationToast && <Toast tone="error">{violationToast}</Toast>}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 lg:flex-row">
        {/* Question column */}
        <main className="flex-1">
          {current && (
            <QuestionCard
              question={current}
              index={index}
              total={total}
              selected={answers[current.id] ?? null}
              onSelect={select}
            />
          )}

          {/* Action bar */}
          <div className="mt-4 rounded-2xl border border-line bg-card p-3 shadow-soft">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: per-question actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={clearResponse} className="btn-ghost btn-sm">
                  <X size={14} /> {t('clearResponse')}
                </button>
                <button
                  onClick={toggleMark}
                  className={current && marked[current.id] ? 'btn-soft btn-sm' : 'btn-ghost btn-sm'}
                >
                  <Flag size={14} className={current && marked[current.id] ? 'fill-current' : ''} />
                  {t('markedReview')}
                </button>
              </div>

              {/* Right: navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  className="btn-ghost btn-sm"
                  aria-label={t('prev')}
                >
                  <ChevronLeft size={16} />
                </button>
                <button onClick={markReviewNext} className="btn-ghost btn-sm">
                  {t('markReviewNext')}
                </button>
                {index < total - 1 ? (
                  <button onClick={saveNext} className="btn-brand btn-sm">
                    {t('saveNext')} <ChevronRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => doSubmit(false)} className="btn-brand btn-sm" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : t('submitTest')}
                  </button>
                )}
              </div>
            </div>

            {submitError && (
              <p className="mt-2.5 text-center font-body text-sm text-coral">{submitError}</p>
            )}
          </div>
        </main>

        {/* Palette sidebar */}
        <aside className="w-full lg:w-72 lg:shrink-0">
          <div className="card p-4">
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
              {t('questionPalette')}
            </h3>

            {/* Summary */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <SummaryStat value={counts.answered} label={t('answered')} cls="text-emerald-600" />
              <SummaryStat value={counts.marked} label={t('markedReview')} cls="text-violet-600" />
              <SummaryStat value={counts.notVisited} label={t('notVisited')} cls="text-ink2" />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={[
                    'grid h-9 w-9 place-items-center rounded-lg font-heading text-xs font-bold transition',
                    i === index ? 'ring-2 ring-brand ring-offset-1' : '',
                    PALETTE_CLS[statusOf(i)],
                  ].join(' ')}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-1.5">
              {(Object.keys(LEGEND) as Status[]).map((s) => (
                <div key={s} className="flex items-center gap-2 font-body text-xs text-ink2">
                  <span className={['h-4 w-4 rounded', PALETTE_CLS[s]].join(' ')} />
                  {t(s)}
                </div>
              ))}
            </div>

            <button
              onClick={() => doSubmit(false)}
              disabled={submitting}
              className="btn-brand mt-4 w-full"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : t('submitTest')}
            </button>
          </div>
        </aside>
      </div>

      {/* Fullscreen re-entry overlay */}
      {notFullscreen && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-ink/80 px-6 text-center backdrop-blur-sm">
          <Maximize2 size={40} className="text-white" />
          <p className="max-w-md font-heading text-lg font-semibold text-white">
            {t('instrFullscreen')}
          </p>
          <button onClick={reEnterFullscreen} className="btn-brand">
            {t('enterFullscreen')}
          </button>
        </div>
      )}
    </div>
  )
}

// Tailwind classes per palette status.
const PALETTE_CLS: Record<Status, string> = {
  notVisited: 'bg-tint text-ink2',
  visited: 'bg-ink2/20 text-ink',
  answered: 'bg-emerald-500 text-white',
  markedReview: 'bg-violet-500 text-white',
  answeredMarked: 'bg-amber-500 text-white',
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      {children}
    </div>
  )
}

function Toast({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={[
        'fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-xl px-4 py-2.5 font-heading text-sm font-semibold shadow-card',
        tone === 'error' ? 'bg-coral text-white' : 'bg-amber-500 text-white',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
