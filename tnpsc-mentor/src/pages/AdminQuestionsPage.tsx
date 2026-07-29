import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import YellowBadge from '../components/UI/YellowBadge'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import QuestionEditor from '../components/Admin/QuestionEditor'
import BulkImportPanel from '../components/Admin/BulkImportPanel'
import QuestionFigures from '../components/Quiz/QuestionFigures'
import { optionLetters, displayOption, displayQuestion, displayExplanation } from '../types'
import MathText from '../components/UI/MathText'
import { SkeletonCards } from '../components/UI/Skeleton'
import type { Question, QuizConfig } from '../types'
import { describeConfig, deleteAdminQuestion, fetchAdminQuestions, setAdminQuestionActive } from '../lib/fetchQuestions'
import { OUTER_SUBJECTS, PYQ_SUBJECTS, subjectName } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

/** Which editor is open: none, a blank new question, or an existing one. */
type EditorState = { mode: 'new' } | { mode: 'edit'; question: Question } | null

/**
 * Admin-only view. Reached via the *same* selection flow as a regular user,
 * but instead of attending a timed test the admin sees the complete list of
 * matching questions with the correct answer and explanation revealed.
 */
export default function AdminQuestionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, loading: authLoading } = useAuth()
  const { lang, t } = useT()
  const config = location.state as QuizConfig | null
  // The "Outer" bank is browsed subject-by-subject (each subject can hold
  // thousands of rows), so we expose per-subject chips and refetch on change.
  const isOuter = config?.category === 'outer'
  // The PYQ banks are browsed the same way (subject chips, server-side refetch),
  // plus client-side Year and Difficulty filters - PYQ rows carry a `year`
  // (2014-2025) which is the defining "previous year" dimension.
  const isPyq =
    config?.category === 'pyq' || config?.category === 'pyq2' || config?.category === 'pyq4'

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState<string | undefined>(config?.subject)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [showImport, setShowImport] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null)
  const [actionError, setActionError] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Config actually sent to the API - the chosen subject overrides the base one.
  const activeConfig = useMemo<QuizConfig | null>(
    () => (config ? { ...config, subject: subject || undefined } : null),
    [config, subject]
  )

  // Re-fetch the bank (used after a bulk import adds many rows at once).
  const reloadQuestions = async () => {
    if (!activeConfig) return
    try {
      const data = await fetchAdminQuestions(activeConfig)
      setQuestions(data)
    } catch {
      setActionError('Imported, but could not refresh the list - reload the page to see new questions.')
    }
  }

  // Merge a saved question into the local list (new rows go to the top).
  const handleSaved = (q: Question, isNew: boolean) => {
    setQuestions((prev) => (isNew ? [q, ...prev] : prev.map((x) => (x.id === q.id ? q : x))))
    setEditor(null)
  }

  // Enable/disable a question for students (toggles active). Inactive questions
  // stay in this admin list but are hidden from quizzes/revision.
  const handleToggleActive = async (q: Question) => {
    setTogglingId(q.id)
    setActionError('')
    try {
      const updated = await setAdminQuestionActive(q.id, !(q.active ?? true))
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, active: updated.active } : x)))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the question.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    const q = pendingDelete
    if (!q) return
    setDeletingId(q.id)
    setActionError('')
    try {
      await deleteAdminQuestion(q.id)
      setQuestions((prev) => prev.filter((x) => x.id !== q.id))
      setPendingDelete(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the question.')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!config) {
      navigate('/test-arena', { replace: true })
    }
  }, [config, navigate])

  // Non-admins should never see this page - bounce them to the quiz instead.
  useEffect(() => {
    if (!authLoading && !isAdmin && config) {
      navigate('/quiz', { replace: true, state: config })
    }
  }, [authLoading, isAdmin, config, navigate])

  useEffect(() => {
    if (!activeConfig) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAdminQuestions(activeConfig)
        if (!cancelled) setQuestions(data)
      } catch {
        if (!cancelled) setError(t('loadQuestionsError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  // Switch the browsed subject (triggers a server-side refetch) and clear the
  // client-side Year/Difficulty filters so the new subject isn't shown empty.
  const selectSubject = (s: string | undefined) => {
    setSubject(s)
    setYearFilter(null)
    setDifficultyFilter(null)
  }

  // Year/difficulty options derived from what's actually loaded, so the chips
  // only offer values present in this bank (newest year first).
  const yearOptions = useMemo(() => {
    const ys = questions.map((q) => q.year).filter((y): y is number => typeof y === 'number')
    return [...new Set(ys)].sort((a, b) => b - a)
  }, [questions])
  const difficultyOptions = useMemo(() => {
    const ds = questions.map((q) => q.difficulty).filter((d): d is NonNullable<typeof d> => !!d)
    return [...new Set(ds)]
  }, [questions])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return questions.filter((q) => {
      if (yearFilter != null && q.year !== yearFilter) return false
      if (difficultyFilter != null && q.difficulty !== difficultyFilter) return false
      if (!term) return true
      return (
        (q.question_text ?? '').toLowerCase().includes(term) ||
        (q.option_a ?? '').toLowerCase().includes(term) ||
        (q.option_b ?? '').toLowerCase().includes(term) ||
        (q.option_c ?? '').toLowerCase().includes(term) ||
        (q.option_d ?? '').toLowerCase().includes(term) ||
        (q.explanation ?? '').toLowerCase().includes(term)
      )
    })
  }, [questions, search, yearFilter, difficultyFilter])

  const handleDownloadPdf = async () => {
    if (!filtered.length || !activeConfig) return
    setDownloading(true)
    setActionError('')
    try {
      const label = isOuter
        ? `Outer Questions${subject ? ` · ${subject}` : ''}`
        : isPyq
          ? `PYQ${subject ? ` · ${subjectName(subject, lang)}` : ''}${yearFilter ? ` · ${yearFilter}` : ''}`
          : describeConfig(activeConfig, lang)
      // Lazy-load the heavy jspdf/html2canvas chunk only on demand.
      const { generateQuestionBankPdf } = await import('../lib/pdfGenerator')
      await generateQuestionBankPdf({ questions: filtered, label, lang })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloading(false)
    }
  }

  if (!config) return null

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="focus-ring mb-6 inline-flex items-center gap-2 rounded font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <YellowBadge>Question Bank</YellowBadge>
          <div className="flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1.5 font-heading text-xs font-bold uppercase text-gold">
            <ShieldCheck size={14} /> Admin View - answers revealed
          </div>
          <p className="tamil font-body text-sm text-ink2">{describeConfig(config, lang)}</p>
        </div>

        {!loading && !error && (
          <div className="mb-5">
            <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2">
              <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 shadow-pill">
                <Search size={18} className="text-ink2/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions, options, explanations…"
                  className="w-full bg-transparent font-body text-sm text-ink outline-none placeholder:text-ink2/50"
                />
              </div>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading || filtered.length === 0}
                className="press focus-ring inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2.5 font-heading text-sm font-semibold text-ink shadow-pill transition hover:border-brand-ring disabled:opacity-50"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                PDF
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="press focus-ring inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2.5 font-heading text-sm font-semibold text-ink shadow-pill transition hover:border-brand-ring"
              >
                <Upload size={16} /> Import
              </button>
              <button
                onClick={() => setEditor({ mode: 'new' })}
                className="btn-brand press inline-flex flex-shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm"
              >
                <Plus size={16} /> New
              </button>
            </div>

            {/* Outer bank: per-subject chips (each refetches that subject). */}
            {isOuter && (
              <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-1.5">
                <SubjectChip label="All" active={!subject} onClick={() => selectSubject(undefined)} />
                {OUTER_SUBJECTS.map((s) => (
                  <SubjectChip
                    key={s}
                    label={s}
                    active={subject === s}
                    onClick={() => selectSubject(s)}
                  />
                ))}
              </div>
            )}

            {/* PYQ bank: subject chips (refetch) + Year/Difficulty filters. */}
            {isPyq && (
              <div className="mx-auto mt-3 flex max-w-xl flex-col items-center gap-2">
                <div className="flex flex-wrap justify-center gap-1.5">
                  <SubjectChip label="All" active={!subject} onClick={() => selectSubject(undefined)} />
                  {PYQ_SUBJECTS.map((s) => (
                    <SubjectChip
                      key={s}
                      label={subjectName(s, lang)}
                      active={subject === s}
                      onClick={() => selectSubject(s)}
                    />
                  ))}
                </div>
                {(yearOptions.length > 0 || difficultyOptions.length > 1) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {yearOptions.length > 0 && (
                      <>
                        <SubjectChip
                          label="All years"
                          active={yearFilter == null}
                          onClick={() => setYearFilter(null)}
                        />
                        {yearOptions.map((y) => (
                          <SubjectChip
                            key={y}
                            label={String(y)}
                            active={yearFilter === y}
                            onClick={() => setYearFilter(y)}
                          />
                        ))}
                      </>
                    )}
                    {/* Difficulty chips only when the bank actually mixes levels. */}
                    {difficultyOptions.length > 1 && (
                      <>
                        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
                        {difficultyOptions.map((d) => (
                          <SubjectChip
                            key={d}
                            label={d.charAt(0).toUpperCase() + d.slice(1)}
                            active={difficultyFilter === d}
                            onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 text-center font-body text-xs text-ink2">
              {filtered.length} of {questions.length} question
              {questions.length === 1 ? '' : 's'}
              {(isOuter || isPyq) && questions.length >= 500 && ' (showing first 500)'}
            </p>
            {actionError && (
              <p className="mt-2 text-center font-body text-xs font-medium text-coral">
                {actionError}
              </p>
            )}
          </div>
        )}

        {loading && <SkeletonCards count={5} height="h-44" className="flex flex-col gap-4" />}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle size={32} className="text-coral" />
            <p className="max-w-sm font-body text-ink2">{error}</p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle size={32} className="text-brand" />
            <p className="max-w-sm font-body text-ink2">
              No questions found for this selection yet.
            </p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Search size={28} className="text-ink2/50" />
            <p className="max-w-sm font-body text-ink2">
              No questions match the current search or filters.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((q, i) => {
              const isActive = q.active ?? true
              return (
              <article
                key={q.id}
                className={[
                  'rounded-2xl border bg-card p-4 shadow-card sm:p-5',
                  isActive ? 'border-line' : 'border-coral/40 bg-coralsoft/30',
                ].join(' ')}
              >
                {/* Controls float top-right so the question text flows the FULL
                    width and only wraps beside the buttons on the first line(s),
                    reclaiming the space below them (was a flex row that boxed the
                    text into `width − buttons` on every line). Float must precede
                    the text in the DOM; the clearfix contains it. */}
                <div className="mb-3 after:clear-both after:block after:content-['']">
                  <div className="float-right ml-3 flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => handleToggleActive(q)}
                      disabled={togglingId === q.id}
                      className={[
                        'grid h-8 w-8 place-items-center rounded-lg transition active:scale-90 focus-ring disabled:opacity-50',
                        isActive
                          ? 'text-mint hover:bg-mintsoft'
                          : 'text-ink2/50 hover:bg-ink/5 hover:text-ink2',
                      ].join(' ')}
                      aria-label={isActive ? 'Disable (hide from students)' : 'Enable (show to students)'}
                      title={isActive ? 'Shown to students - click to hide' : 'Hidden from students - click to show'}
                    >
                      {togglingId === q.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isActive ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => setEditor({ mode: 'edit', question: q })}
                      className="icon-btn h-8 w-8"
                      aria-label="Edit question"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(q)}
                      disabled={deletingId === q.id}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink2 transition hover:bg-coralsoft hover:text-coral active:scale-90 focus-ring disabled:opacity-50"
                      aria-label="Delete question"
                    >
                      {deletingId === q.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                  <p className="tamil whitespace-pre-line font-heading text-base font-bold leading-snug text-navytext">
                    <span className="mr-1 text-secondary">{i + 1}.</span>
                    {!isActive && (
                      <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-coral/15 px-2 py-0.5 align-middle font-heading text-[10px] font-bold uppercase tracking-wide text-coral">
                        <EyeOff size={11} /> Hidden
                      </span>
                    )}
                    <MathText text={displayQuestion(q, lang)} />
                  </p>
                </div>
                <QuestionFigures images={q.images} className="mb-3" />
                <div className="flex flex-col gap-1.5">
                  {optionLetters(q).map((letter) => {
                    const isCorrect = q.correct_answer != null && q.correct_answer === letter
                    return (
                      <div
                        key={letter}
                        className={[
                          'tamil flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                          isCorrect
                            ? 'bg-green-50 font-semibold text-green-700'
                            : 'text-navytext/75',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            isCorrect ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary',
                          ].join(' ')}
                        >
                          {letter}
                        </span>
                        <MathText text={displayOption(q, letter, lang)} />
                        {isCorrect && (
                          <span className="ml-auto text-xs font-bold">✓ {t('correctMark')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {displayExplanation(q, lang) && (
                  <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                    <p className="tamil whitespace-pre-line text-xs leading-loose text-navytext/80">
                      <span className="font-heading font-bold text-secondary">
                        Explanation:{' '}
                      </span>
                      <MathText text={displayExplanation(q, lang)} />
                    </p>
                  </div>
                )}
                {(q.difficulty || q.topic || q.year || q.source_tag) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.difficulty && <Tag>{q.difficulty}</Tag>}
                    {q.topic && <Tag>{q.topic}</Tag>}
                    {q.year && <Tag>{q.year}</Tag>}
                    {/* Provenance marker - admin/superadmin only (never sent to students). */}
                    {q.source_tag && (
                      <span className="inline-flex items-center rounded-full bg-tint-violet px-2.5 py-1 font-heading text-[11px] font-semibold text-primary">
                        {q.source_tag}
                      </span>
                    )}
                  </div>
                )}
              </article>
              )
            })}
          </div>
        )}
      </div>

      {editor && (
        <QuestionEditor
          initial={editor.mode === 'edit' ? editor.question : null}
          config={config}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      {showImport && (
        <BulkImportPanel onClose={() => setShowImport(false)} onImported={reloadQuestions} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('deleteQuestionTitle')}
        message={t('deleteQuestionMsg')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        tone="danger"
        busy={!!deletingId}
        onConfirm={handleDelete}
        onCancel={() => !deletingId && setPendingDelete(null)}
      />
    </>
  )
}

function SubjectChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'tamil rounded-full border px-3 py-1 font-heading text-xs font-semibold transition',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  )
}
