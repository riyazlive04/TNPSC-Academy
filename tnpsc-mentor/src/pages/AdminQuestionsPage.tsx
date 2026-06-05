import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Search, ShieldCheck } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { LETTERS, optionText } from '../types'
import type { Question, QuizConfig } from '../types'
import { describeConfig, fetchQuestionsForConfig } from '../lib/fetchQuestions'
import { useAuth } from '../hooks/useAuth'

/**
 * Admin-only view. Reached via the *same* selection flow as a regular user,
 * but instead of attending a timed test the admin sees the complete list of
 * matching questions with the correct answer and explanation revealed.
 */
export default function AdminQuestionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, loading: authLoading } = useAuth()
  const config = location.state as QuizConfig | null

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

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
    if (!config) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchQuestionsForConfig(config)
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
  }, [])

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

  if (!config) return null

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <YellowBadge>Question Bank</YellowBadge>
          <div className="flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 font-heading text-xs font-bold uppercase text-accent">
            <ShieldCheck size={14} /> Admin View — answers revealed
          </div>
          <p className="font-body text-sm text-white/60">{describeConfig(config)}</p>
        </div>

        {!loading && !error && (
          <div className="mb-5">
            <div className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-pill">
              <Search size={18} className="text-navytext/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, options, explanations…"
                className="w-full bg-transparent font-body text-sm text-navytext outline-none placeholder:text-navytext/40"
              />
            </div>
            <p className="mt-2 text-center font-body text-xs text-white/50">
              {filtered.length} of {questions.length} question
              {questions.length === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-heading uppercase tracking-widest text-white/60">
              Loading questions…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle size={32} className="text-warn" />
            <p className="max-w-sm font-body text-white/80">{error}</p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle size={32} className="text-accent" />
            <p className="max-w-sm font-body text-white/80">
              No questions found for this selection yet.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((q, i) => (
              <article key={q.id} className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                <p className="tamil mb-3 font-heading text-base font-bold leading-snug text-navytext">
                  <span className="mr-1 text-secondary">{i + 1}.</span>
                  {q.question_text}
                </p>
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
                        {optionText(q, letter)}
                        {isCorrect && <span className="ml-auto text-xs font-bold">✓ Correct</span>}
                      </div>
                    )
                  })}
                </div>
                {q.explanation && (
                  <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                    <p className="tamil text-xs leading-relaxed text-navytext/80">
                      <span className="font-heading font-bold text-secondary">
                        Explanation:{' '}
                      </span>
                      {q.explanation}
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
    </AppLayout>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  )
}
