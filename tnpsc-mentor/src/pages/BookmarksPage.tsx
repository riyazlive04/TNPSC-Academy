import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkX, Loader2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { fetchBookmarkedQuestions, removeBookmark } from '../lib/bookmarks'
import { LETTERS, displayQuestion, displayOption, displayExplanation } from '../types'
import type { Question } from '../types'
import { useT } from '../lib/i18n'

export default function BookmarksPage() {
  const navigate = useNavigate()
  const { lang } = useT()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchBookmarkedQuestions()
        if (!cancelled) setQuestions(data)
      } catch {
        if (!cancelled) setError('Could not load your saved questions. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    try {
      await removeBookmark(id)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    } catch {
      // keep it in the list; a transient failure shouldn't lose the bookmark
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <YellowBadge>Saved Questions</YellowBadge>
          <p className="font-body text-sm text-ink2">
            Questions you bookmarked for revision - answers and explanations included.
          </p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="font-heading font-semibold uppercase tracking-widest text-ink2">
              Loading saved questions…
            </p>
          </div>
        )}

        {!loading && error && (
          <p className="py-12 text-center font-body text-ink2">{error}</p>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-goldsoft">
              <Bookmark size={26} className="text-gold" />
            </div>
            <p className="max-w-xs font-body text-ink2">
              No saved questions yet. On any result page, tap the bookmark icon on a
              question to save it here.
            </p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <article key={q.id} className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="tamil whitespace-pre-line font-heading text-base font-bold leading-snug text-navytext">
                    <span className="mr-1 text-secondary">{i + 1}.</span>
                    {displayQuestion(q, lang)}
                  </p>
                  <button
                    onClick={() => handleRemove(q.id)}
                    disabled={removingId === q.id}
                    aria-label="Remove bookmark"
                    className="rounded-lg p-1.5 text-ink2 transition hover:bg-coralsoft hover:text-coral disabled:opacity-50"
                  >
                    {removingId === q.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <BookmarkX size={18} />
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {LETTERS.map((letter) => {
                    const isCorrect = q.correct_answer === letter
                    return (
                      <div
                        key={letter}
                        className={[
                          'tamil flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                          isCorrect ? 'bg-green-50 font-semibold text-green-700' : 'text-navytext/75',
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
                        {isCorrect && <span className="ml-auto text-xs font-bold">✓</span>}
                      </div>
                    )
                  })}
                </div>

                {displayExplanation(q, lang) && (
                  <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                    <p className="tamil whitespace-pre-line text-xs leading-relaxed text-navytext/80">
                      <span className="font-heading font-bold text-secondary">Explanation: </span>
                      {displayExplanation(q, lang)}
                    </p>
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
