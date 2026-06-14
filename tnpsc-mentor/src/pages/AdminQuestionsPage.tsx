import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import QuestionEditor from '../components/Admin/QuestionEditor'
import BulkImportPanel from '../components/Admin/BulkImportPanel'
import { LETTERS, displayOption, displayQuestion, displayExplanation } from '../types'
import type { Question, QuizConfig } from '../types'
import { describeConfig, deleteAdminQuestion, fetchAdminQuestions } from '../lib/fetchQuestions'
import { generateQuestionBankPdf } from '../lib/pdfGenerator'
import { OUTER_SUBJECTS } from '../lib/constants'
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

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState<string | undefined>(config?.subject)
  const [editor, setEditor] = useState<EditorState>(null)
  const [showImport, setShowImport] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null)
  const [actionError, setActionError] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Config actually sent to the API — the chosen subject overrides the base one.
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
      setActionError('Imported, but could not refresh the list — reload the page to see new questions.')
    }
  }

  // Merge a saved question into the local list (new rows go to the top).
  const handleSaved = (q: Question, isNew: boolean) => {
    setQuestions((prev) => (isNew ? [q, ...prev] : prev.map((x) => (x.id === q.id ? q : x))))
    setEditor(null)
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

  // Non-admins should never see this page — bounce them to the quiz instead.
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
        if (!cancelled) setError('Could not load questions. Check Supabase config and try again.')
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return questions
    return questions.filter(
      (q) =>
        q.question_text.toLowerCase().includes(term) ||
        q.option_a.toLowerCase().includes(term) ||
        q.option_b.toLowerCase().includes(term) ||
        q.option_c.toLowerCase().includes(term) ||
        q.option_d.toLowerCase().includes(term) ||
        (q.explanation ?? '').toLowerCase().includes(term)
    )
  }, [questions, search])

  const handleDownloadPdf = async () => {
    if (!filtered.length || !activeConfig) return
    setDownloading(true)
    setActionError('')
    try {
      const label = isOuter
        ? `Outer Questions${subject ? ` · ${subject}` : ''}`
        : describeConfig(activeConfig)
      await generateQuestionBankPdf({ questions: filtered, label, lang })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setDownloading(false)
    }
  }

  if (!config) return null

  return (
    <AppLayout>
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
            <ShieldCheck size={14} /> Admin View — answers revealed
          </div>
          <p className="tamil font-body text-sm text-ink2">{describeConfig(config)}</p>
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
                <SubjectChip label="All" active={!subject} onClick={() => setSubject(undefined)} />
                {OUTER_SUBJECTS.map((s) => (
                  <SubjectChip
                    key={s}
                    label={s}
                    active={subject === s}
                    onClick={() => setSubject(s)}
                  />
                ))}
              </div>
            )}

            <p className="mt-2 text-center font-body text-xs text-ink2">
              {filtered.length} of {questions.length} question
              {questions.length === 1 ? '' : 's'}
              {isOuter && questions.length >= 500 && ' (showing first 500)'}
            </p>
            {actionError && (
              <p className="mt-2 text-center font-body text-xs font-medium text-coral">
                {actionError}
              </p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="font-heading font-semibold uppercase tracking-widest text-ink2">
              Loading questions…
            </p>
          </div>
        )}

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

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((q, i) => (
              <article key={q.id} className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="tamil whitespace-pre-line font-heading text-base font-bold leading-snug text-navytext">
                    <span className="mr-1 text-secondary">{i + 1}.</span>
                    {displayQuestion(q, lang)}
                  </p>
                  <div className="flex flex-shrink-0 gap-1">
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
                </div>
                <div className="flex flex-col gap-1.5">
                  {LETTERS.map((letter) => {
                    const isCorrect = q.correct_answer === letter
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
                        {displayOption(q, letter, lang)}
                        {isCorrect && (
                          <span className="ml-auto text-xs font-bold">✓ {t('correctMark')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {displayExplanation(q, lang) && (
                  <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                    <p className="tamil whitespace-pre-line text-xs leading-relaxed text-navytext/80">
                      <span className="font-heading font-bold text-secondary">
                        Explanation:{' '}
                      </span>
                      {displayExplanation(q, lang)}
                    </p>
                  </div>
                )}
                {(q.difficulty || q.topic || q.year) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.difficulty && <Tag>{q.difficulty}</Tag>}
                    {q.topic && <Tag>{q.topic}</Tag>}
                    {q.year && <Tag>{q.year}</Tag>}
                  </div>
                )}
              </article>
            ))}
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
    </AppLayout>
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
