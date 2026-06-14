import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, Check } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import ProgressBar from '../components/UI/ProgressBar'
import QuestionCard from '../components/Quiz/QuestionCard'
import { fetchDueItems, gradeReview, type ReviewItem } from '../lib/srs'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
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
      })
    } else {
      // Grading unavailable (offline) — reveal without the answer highlight.
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
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('revisionTitle')}</YellowBadge>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="tamil py-12 text-center font-body text-ink2">{t('revisionEmpty')}</p>
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
    </AppLayout>
  )
}
