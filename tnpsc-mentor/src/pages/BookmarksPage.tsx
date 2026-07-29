import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkX, Check, Loader2 } from 'lucide-react'
import YouTubeEmbed from '../components/Quiz/YouTubeEmbed'
import { SkeletonCards } from '../components/UI/Skeleton'
import { fetchBookmarkedQuestions, removeBookmark } from '../lib/bookmarks'
import { optionLetters, displayQuestion, displayOption, displayExplanation } from '../types'
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
    <>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <header className="mb-6 mt-4">
          <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">Saved Questions</h1>
          <p className="mt-1 font-body text-sm text-muted">
            Questions you bookmarked for revision - answers and explanations included.
          </p>
        </header>

        {loading && (
          <SkeletonCards
            count={4}
            height="h-52"
            className="grid gap-4 lg:grid-cols-2 lg:items-start"
          />
        )}

        {!loading && error && <p className="py-12 text-center font-body text-muted">{error}</p>}

        {!loading && !error && questions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-tile bg-tint-coral">
              <Bookmark size={26} className="text-accent" />
            </div>
            <p className="max-w-xs font-body text-muted">
              No saved questions yet. On any result page, tap the bookmark icon on a question to save
              it here.
            </p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {questions.map((q, i) => (
              <article key={q.id} className="rounded-card border border-line bg-card p-4 sm:p-5">
                {/* Remove button floats top-right so the question stem flows the
                    FULL card width (wraps beside the button only on the first
                    line, then reclaims the space below it) instead of being
                    boxed into `width − button` on every line. */}
                <div className="mb-3 after:clear-both after:block after:content-['']">
                  <button
                    onClick={() => handleRemove(q.id)}
                    disabled={removingId === q.id}
                    aria-label="Remove bookmark"
                    className="float-right ml-3 rounded-lg p-1.5 text-muted transition-colors hover:bg-coralsoft hover:text-coral disabled:opacity-50"
                  >
                    {removingId === q.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <BookmarkX size={18} />
                    )}
                  </button>
                  <p className="tamil whitespace-pre-line font-display text-base font-bold leading-snug text-ink">
                    <span className="mr-1 text-primary">{i + 1}.</span>
                    {displayQuestion(q, lang)}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {optionLetters(q).map((letter) => {
                    const isCorrect = q.correct_answer != null && q.correct_answer === letter
                    return (
                      <div
                        key={letter}
                        className={[
                          'tamil flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                          isCorrect ? 'bg-tint-green font-semibold text-ink' : 'text-ink/75',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-xs font-bold',
                            isCorrect ? 'bg-correct text-white' : 'bg-tint-violet text-primary',
                          ].join(' ')}
                        >
                          {letter}
                        </span>
                        {displayOption(q, letter, lang)}
                        {isCorrect && <Check size={14} className="ml-auto flex-shrink-0 text-correct" />}
                      </div>
                    )
                  })}
                </div>

                {displayExplanation(q, lang) && (
                  <div className="mt-3 rounded-lg border-l-2 border-primary bg-tint-violet/50 p-3">
                    <p className="tamil whitespace-pre-line text-xs leading-relaxed text-ink/80">
                      <span className="font-heading font-bold text-primary">Explanation: </span>
                      {displayExplanation(q, lang)}
                    </p>
                  </div>
                )}

                <YouTubeEmbed url={q.explanation_video_url} />
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
