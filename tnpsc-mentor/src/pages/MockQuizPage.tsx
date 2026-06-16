import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Grid3x3, Loader2, Maximize2, X } from 'lucide-react'
import QuestionStem from '../components/Quiz/QuestionStem'
import QuestionFigures from '../components/Quiz/QuestionFigures'
import OmrBubbles from '../components/Quiz/OmrBubbles'
import OmrOptions from '../components/Quiz/OmrOptions'
import ScreenGuard from '../components/Quiz/ScreenGuard'
import { formatTime } from '../components/UI/Timer'
import { api } from '../lib/api'
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen } from '../lib/proctor'
import { submitTest } from '../lib/submitTest'
import { useT } from '../lib/i18n'
import { LETTERS, displayOption } from '../types'
import type { AnswerLetter, DisplayLang, Question, QuizConfig, TestAnswer } from '../types'

/** True when a question carries any answer-option text (option_a..d / _ta). */
function hasOptions(q: Question, lang: DisplayLang): boolean {
  return LETTERS.some((l) => {
    const txt = displayOption(q, l, lang)
    return Boolean(txt && txt.trim())
  })
}

/** Per-question status used to colour the OMR palette. */
type Status = 'notVisited' | 'visited' | 'answered' | 'markedReview' | 'answeredMarked'

interface Violation {
  type: 'fullscreen_exit' | 'tab_switch' | 'copy_paste' | 'screenshot' | 'screen_record'
  at: number // ms since test start
  questionIndex: number
}

/**
 * Classify a keystroke that triggers an OS/browser screen capture, so it can be
 * flagged and the captured clipboard wiped. Returns null for everything else.
 */
function screenCaptureType(e: KeyboardEvent): 'screenshot' | 'screen_record' | null {
  if (e.key === 'PrintScreen') return 'screenshot'
  const k = e.key.toLowerCase()
  // Screen-recording shortcuts: Win+Alt+R (Game Bar), Win+Shift+R.
  if (e.metaKey && (e.altKey || e.shiftKey) && k === 'r') return 'screen_record'
  // Screenshot shortcuts: Win+Shift+S (Snip), Ctrl+Shift+S, macOS Cmd+Shift+3/4/5.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['s', '3', '4', '5'].includes(k)) return 'screenshot'
  return null
}

const MAX_VIOLATIONS = 5 // auto-submit threshold
const PAGE_SIZE = 50 // questions per OMR answer-sheet page (100-Q exam → 2 pages of 50)

export default function MockQuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const config = location.state as QuizConfig | null

  // Fullscreen is enforced only where the platform supports it. Phones (iOS
  // Safari especially) can't reliably go full-screen, so on those we degrade to
  // tab-switch / focus-loss proctoring rather than locking the user out behind
  // an overlay they can never satisfy.
  const fsSupported = useRef(fullscreenSupported()).current

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [empty, setEmpty] = useState(false)

  const [index, setIndex] = useState(0)
  const [page, setPage] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerLetter>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true })

  const [timeLeft, setTimeLeft] = useState(config?.mockDurationSeconds ?? 0)
  const [violations, setViolations] = useState<Violation[]>([])
  const [violationToast, setViolationToast] = useState('')
  const [timeToast, setTimeToast] = useState('')
  const [notFullscreen, setNotFullscreen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
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
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageStart = page * PAGE_SIZE
  const pageQuestions = questions.slice(pageStart, pageStart + PAGE_SIZE)

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
        await exitFullscreen()
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
      const fs = isFullscreen()
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
      // Screen capture/record keys — flag as a violation and wipe the clipboard.
      const capture = screenCaptureType(e)
      if (capture) {
        e.preventDefault()
        navigator.clipboard?.writeText('').catch(() => {})
        recordViolation(capture)
        return
      }
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(k)) {
        e.preventDefault()
        recordViolation('copy_paste')
      }
    }
    // Windows' PrintScreen reports on keyup only — catch it there too.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {})
        recordViolation('screenshot')
      }
    }

    // Full-screen enforcement applies only on platforms that support it; on
    // phones the visibility/blur listeners below carry the proctoring.
    if (fsSupported) {
      document.addEventListener('fullscreenchange', onFsChange)
      document.addEventListener('webkitfullscreenchange', onFsChange)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', blockCopy)
    document.addEventListener('paste', blockCopy)
    document.addEventListener('cut', blockCopy)
    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('keydown', blockKeys)
    document.addEventListener('keyup', onKeyUp)

    // Establish initial fullscreen state (only relevant when supported).
    setNotFullscreen(fsSupported && !isFullscreen())

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('paste', blockCopy)
      document.removeEventListener('cut', blockCopy)
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('keydown', blockKeys)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [loading, empty, loadError, total, recordViolation, fsSupported])

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

  const jumpToQuestion = (i: number) => {
    if (i < 0 || i >= total) return
    setPage(Math.floor(i / PAGE_SIZE))
    setPaletteOpen(false)
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
    void enterFullscreen()
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
      t={t}
    />
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas select-none">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
        <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-ink">
          {config.label}
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
          {/* Palette toggle — phones/tablets only; desktop shows the sidebar. */}
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

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-3 py-4 sm:px-4 sm:py-5 lg:flex-row">
        {/* OMR answer sheet — one page of question rows */}
        <main className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-heading text-sm font-semibold text-ink2">
              {t('question')} {pageStart + 1}–{Math.min(total, pageStart + PAGE_SIZE)} {t('of')} {total}
            </span>
            <span className="font-body text-xs tabular-nums text-ink2">
              {page + 1} / {pageCount}
            </span>
          </div>

          <div className="space-y-3">
            {pageQuestions.map((q, k) => {
              const i = pageStart + k
              const sel = answers[q.id] ?? null
              const flagged = Boolean(marked[q.id])
              return (
                <div
                  key={q.id}
                  id={`omr-q-${i}`}
                  className="scroll-mt-20 rounded-2xl border border-line bg-card p-4 shadow-soft sm:p-5"
                >
                  {/* Top: question number + flag / clear */}
                  <div className="flex items-center gap-3 border-b border-line pb-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft font-heading text-sm font-bold text-brand">
                      {i + 1}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => toggleFlag(q)}
                        aria-label={t('markedReview')}
                        aria-pressed={flagged}
                        className={[
                          'icon-btn h-9 w-9 flex-shrink-0',
                          flagged ? 'text-violet-600' : 'text-ink2/45',
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

                  {/* Answer choices — full option text + OMR-style bubble. Falls
                      back to a bare A–D bubble row only if the question has no
                      option text stored. */}
                  {hasOptions(q, lang) ? (
                    <OmrOptions question={q} lang={lang} selected={sel} onSelect={(l) => setAnswer(q, l)} />
                  ) : (
                    <div className="mt-4">
                      <OmrBubbles selected={sel} onSelect={(l) => setAnswer(q, l)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <Paginator page={page} pageCount={pageCount} onJump={setPage} t={t} />

          {submitError && (
            <p className="mt-3 text-center font-body text-sm text-coral">{submitError}</p>
          )}

          <button
            onClick={() => doSubmit(false)}
            disabled={submitting}
            className="btn-brand btn-lg mt-4 w-full"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : t('submitTest')}
          </button>
        </main>

        {/* Palette — inline sidebar on desktop. */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="card sticky top-20 p-4">{palette}</div>
        </aside>
      </div>

      {/* Palette — slide-up drawer on phones/tablets. */}
      {paletteOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <button
            aria-label={t('done')}
            onClick={() => setPaletteOpen(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
                {t('questionPalette')}
              </h3>
              <button onClick={() => setPaletteOpen(false)} className="icon-btn h-8 w-8" aria-label={t('done')}>
                <X size={18} />
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      {/* Fullscreen re-entry overlay — only on platforms that can go full-screen. */}
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

      {/* Anti-capture shield — blanks the screen on focus loss / PrintScreen. */}
      <ScreenGuard message={t('screenProtected')} />
    </div>
  )
}

/** Shared palette body — rendered in the desktop sidebar and the mobile drawer.
 * The number grid is SCOPED to the current page: page 1 shows pills 1–50, page 2
 * shows 51–100, etc. A header switcher moves between pages; tapping a pill jumps
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
        <SummaryStat value={counts.answered} label={t('answered')} cls="text-emerald-600" />
        <SummaryStat value={counts.marked} label={t('markedReview')} cls="text-violet-600" />
        <SummaryStat value={counts.notVisited} label={t('notVisited')} cls="text-ink2" />
      </div>

      {/* Page switcher — only when the sheet spans more than one page */}
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
            {start + 1}–{end} <span className="text-ink2/50">/ {total}</span>
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

      {/* Grid — current page only */}
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

      <button onClick={onSubmit} disabled={submitting} className="btn-brand mt-4 w-full">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : t('submitTest')}
      </button>
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-4">
      {children}
    </div>
  )
}

function Toast({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={[
        'fixed left-1/2 top-16 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-center font-heading text-sm font-semibold shadow-card',
        tone === 'error' ? 'bg-coral text-white' : 'bg-amber-500 text-white',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
