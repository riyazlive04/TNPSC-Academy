import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import ProgressBar from '../components/UI/ProgressBar'
import QuestionCard from '../components/Quiz/QuestionCard'
import { fetchDueItems, gradeItem, type ReviewItem } from '../lib/srs'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import type { AnswerLetter } from '../types'

export default function RevisionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useT()

  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<AnswerLetter | null>(null)
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
    const correct = letter === q.correct_answer
    if (correct) setCorrectCount((c) => c + 1)
    await gradeItem(item, correct)
  }

  const next = () => {
    if (idx + 1 < items.length) {
      setIdx(idx + 1)
      setSelected(null)
    } else {
      setDone(true)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('revisionTitle')}</YellowBadge>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="tamil py-12 text-center font-body text-white/60">{t('revisionEmpty')}</p>
        )}

        {!loading && items.length > 0 && !done && q && (
          <>
            <div className="mb-4">
              <div className="mb-1 flex justify-between font-body text-xs text-white/50">
                <span>
                  {t('dueToday')}: {idx + 1}/{items.length}
                </span>
                <span>{correctCount} ✓</span>
              </div>
              <ProgressBar percent={((idx + 1) / items.length) * 100} />
            </div>

            <QuestionCard
              question={q}
              index={idx}
              total={items.length}
              selected={selected}
              onSelect={handleSelect}
              reveal={selected !== null}
              disabled={selected !== null}
            />

            {selected !== null && (
              <button
                onClick={next}
                className="mt-4 w-full rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5"
              >
                {idx + 1 < items.length ? t('next') : t('allCaughtUp')}
              </button>
            )}
          </>
        )}

        {!loading && done && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 size={56} className="text-green-400" />
            <p className="font-heading text-2xl font-bold text-white">{t('allCaughtUp')}</p>
            <p className="font-body text-white/70">
              {correctCount}/{items.length} correct
            </p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => {
                  setIdx(0)
                  setSelected(null)
                  setCorrectCount(0)
                  setDone(false)
                  setLoading(true)
                  if (user)
                    fetchDueItems(user.id, 30)
                      .then((d) => setItems(d.filter((i) => i.question)))
                      .finally(() => setLoading(false))
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-heading font-bold uppercase text-navytext"
              >
                <RefreshCw size={16} /> {t('revision')}
              </button>
              <button
                onClick={() => navigate('/insights')}
                className="rounded-full bg-accent px-5 py-2.5 font-heading font-bold uppercase text-navytext"
              >
                {t('insights')}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
