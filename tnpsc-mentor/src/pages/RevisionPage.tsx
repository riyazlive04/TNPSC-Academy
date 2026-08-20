import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Check } from 'lucide-react'
import ProgressBar from '../components/UI/ProgressBar'
import QuestionCard from '../components/Quiz/QuestionCard'
import { Skeleton, SkeletonCards } from '../components/UI/Skeleton'
import { fetchDueItems, gradeReview, type ReviewItem } from '../lib/srs'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import TopicRevisionSection from '../components/revision/TopicRevisionSection'
import type { AnswerLetter, Question } from '../types'

export default function RevisionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useT()

  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<AnswerLetter | null>(null)
  // The graded question (with correct_answer + explanation merged in) revealed
  // after the user answers. The deck itself never carries the answer key.
  const [revealed, setRevealed] = useState<Question | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchDueItems(user.id, 30)
      .then((d) => !cancelled && setItems(d.filter((i) => i.question)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user])

  const item = items[idx]
  const q = item?.question ?? null

  const handleSelect = async (letter: AnswerLetter) => {
    if (selected !== null || !item || !q) return
    setSelected(letter)
    const grade = await gradeReview(item.id, letter)
    if (grade) {
      if (grade.is_correct) setCorrectCount((c) => c + 1)
      setRevealed({
        ...q,
        correct_answer: grade.correct_answer ?? undefined,
        explanation: grade.explanation ?? undefined,
        explanation_ta: grade.explanation_ta ?? undefined,
        explanation_video_url: grade.explanation_video_url ?? undefined,
      })
    } else {
      // Grading unavailable (offline) - reveal without the answer highlight.
      setRevealed(q)
    }
  }

  const next = () => {
    setSelected(null)
    setRevealed(null)
    if (idx + 1 < items.length) {
      setIdx(idx + 1)
    } else {
      setDone(true)
    }
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <header className="mb-7 mt-4">
          <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
            {t('topicRevisionTitle')}
          </h1>
        </header>

        {/* New: topic-level revisions (study gate + similar-question re-tests). */}
        <TopicRevisionSection />

        <div className="my-8 border-t border-line" />

        {/* Existing: per-question spaced-repetition drill. */}
        <div className="mb-4">
          <h2 className="tamil font-heading text-lg font-bold tracking-tight text-ink">
            {t('revisionTitle')}
          </h2>
          <p className="tamil mt-0.5 font-body text-sm text-muted">{t('practiceMistakes')}</p>
        </div>

        {loading && (
          // The due-counter bar over the question card that follows it.
          <div className="space-y-4">
            <Skeleton className="h-1.5 w-full rounded-pill" />
            <SkeletonCards count={1} height="h-64" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="tamil py-12 text-center font-body text-muted">{t('revisionEmpty')}</p>
        )}

        {!loading && items.length > 0 && !done && q && (
          <>
            <div className="mb-4">
              <div className="mb-1 flex justify-between font-body text-xs font-medium text-ink2">
                <span>
                  {t('dueToday')}: {idx + 1}/{items.length}
                </span>
                <span className="text-mint">{correctCount} ✓</span>
              </div>
              <ProgressBar percent={((idx + 1) / items.length) * 100} />
            </div>

            <QuestionCard
              question={revealed ?? q}
              index={idx}
              total={items.length}
              selected={selected}
              onSelect={handleSelect}
              reveal={selected !== null}
              disabled={selected !== null}
            />

            {selected !== null && (
              <button onClick={next} className="btn-brand mt-4 w-full px-6 py-3.5 text-base">
                {idx + 1 < items.length ? t('next') : t('allCaughtUp')}
              </button>
            )}
          </>
        )}

        {!loading && done && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-tint text-ink">
              <Check size={28} />
            </span>
            <p className="font-heading text-2xl font-semibold tracking-tight text-ink">
              {t('allCaughtUp')}
            </p>
            <p className="font-body text-ink2">
              {correctCount}/{items.length} correct
            </p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => {
                  setIdx(0)
                  setSelected(null)
                  setRevealed(null)
                  setCorrectCount(0)
                  setDone(false)
                  setLoading(true)
                  if (user)
                    fetchDueItems(user.id, 30)
                      .then((d) => setItems(d.filter((i) => i.question)))
                      .finally(() => setLoading(false))
                }}
                className="btn-ghost px-5 py-2.5"
              >
                <RefreshCw size={16} /> {t('revision')}
              </button>
              <button onClick={() => navigate('/insights')} className="btn-brand px-5 py-2.5">
                {t('insights')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
