import { useState } from 'react'
import type { AnswerLetter, Question, TestAnswer } from '../../types'
import { optionLetters, displayOption, displayExplanation, whyWrongFor } from '../../types'
import { Bookmark, Check, X, MinusCircle, Clock, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { topicName } from '../../lib/constants'
import { formatDuration } from '../UI/Timer'
import { api } from '../../lib/api'
import { toast } from '../../store/toastStore'
import WorkedSolution from './WorkedSolution'
import QuestionFigures from './QuestionFigures'
import QuestionStem from './QuestionStem'

interface ResultCardProps {
  question: Question
  index: number
  answer?: TestAnswer
  /** When true, show option text + explanation (only after PDF gate passes). */
  showExplanation: boolean
  /** Whether this question is bookmarked (omit to hide the bookmark button). */
  bookmarked?: boolean
  onToggleBookmark?: () => void
}

/**
 * Compact per-question breakdown card on the Result page.
 */
export default function ResultCard({
  question,
  index,
  answer,
  showExplanation,
  bookmarked,
  onToggleBookmark,
}: ResultCardProps) {
  const { t, lang } = useT()
  // Aptitude questions get the stepwise "worked solution" treatment; the bank
  // tags them with aptitude_type (and subject 'Aptitude' under PYQ).
  const isAptitude =
    !!question.aptitude_type || question.subject === 'Aptitude' || question.category === 'aptitude'
  const attempted = Boolean(answer?.selected_answer)
  const correct = answer?.is_correct ?? false
  const chosen = answer?.selected_answer as AnswerLetter | undefined
  // Time the user spent on this question (recorded on the first selection).
  const timeSpent = attempted ? Math.round(answer?.time_spent_seconds ?? 0) : 0
  // Targeted feedback: why the user's specific wrong choice is incorrect.
  const wrongReason =
    attempted && !correct && chosen ? whyWrongFor(question, chosen) : ''

  let statusIcon = <MinusCircle size={20} className="text-ink2/50" />
  let statusLabel = t('statusSkipped')
  let ring = 'border-line'
  if (attempted && correct) {
    statusIcon = <Check size={20} className="text-mint" />
    statusLabel = t('statusCorrect')
    ring = 'border-mint/45'
  } else if (attempted && !correct) {
    statusIcon = <X size={20} className="text-coral" />
    statusLabel = t('statusWrong')
    ring = 'border-coral/45'
  }

  return (
    <div className={`rounded-2xl border-2 bg-card p-4 ${ring}`}>
      {/* Status row sits on its own line so the question stem (and any match-list
          grid) can use the FULL card width below, instead of being squeezed into
          a narrow flex cell beside the badges. */}
      <div className="mb-2 flex items-center justify-end gap-1.5">
        {attempted && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-tint px-2 py-0.5 font-heading text-[11px] font-semibold text-navytext/55"
            title={`${t('timeTaken')}: ${formatDuration(timeSpent)}`}
          >
            <Clock size={12} /> {formatDuration(timeSpent)}
          </span>
        )}
        {onToggleBookmark && (
          <button
            onClick={onToggleBookmark}
            aria-label={bookmarked ? t('removeBookmark') : t('saveQuestion')}
            title={bookmarked ? t('savedTapRemove') : t('saveForLater')}
            className={[
              'rounded-lg p-1 transition',
              bookmarked ? 'text-gold' : 'text-navytext/30 hover:text-gold',
            ].join(' ')}
          >
            <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
        )}
        {statusIcon}
        <span className="font-heading text-xs font-bold uppercase text-navytext/60">
          {statusLabel}
        </span>
      </div>
      <div className="min-w-0">
        <QuestionStem
          question={question}
          lang={lang}
          textClassName="break-words text-sm font-semibold leading-snug text-navytext"
          prefix={<span className="mr-1 text-secondary">Q{index + 1}.</span>}
        />
        {question.topic && (
          <span className="tamil mt-1.5 inline-block max-w-full truncate rounded-md bg-brand-soft px-2 py-0.5 align-middle font-heading text-[11px] font-semibold text-brand">
            {topicName(question.topic, lang)}
          </span>
        )}
      </div>

      {isAptitude && (question.aptitude_type || question.topic) && (
        <p className="mb-2 font-heading text-[11px] font-semibold uppercase tracking-wide text-secondary/80">
          {[question.topic, question.aptitude_type && `Aptitude - ${question.aptitude_type}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <QuestionFigures images={question.images} className="mb-3" />

      {showExplanation ? (
        <>
          <div className="flex flex-col gap-1">
            {optionLetters(question).map((letter) => {
              const isCorrect = question.correct_answer === letter
              const isChosenWrong =
                answer?.selected_answer === letter && !correct
              return (
                <div
                  key={letter}
                  className={[
                    'tamil rounded-lg px-3 py-1.5 text-sm',
                    isCorrect
                      ? 'bg-mintsoft font-semibold text-mint'
                      : isChosenWrong
                        ? 'bg-coralsoft font-semibold text-coral'
                        : 'text-navytext/70',
                  ].join(' ')}
                >
                  <span className="font-heading font-bold">{letter}.</span>{' '}
                  {displayOption(question, letter, lang)}
                  {isCorrect && ' ✓'}
                  {isChosenWrong && ` ✗ ${t('yourAnswerSuffix')}`}
                </div>
              )
            })}
          </div>
          {wrongReason && (
            <div className="mt-3 rounded-lg border-l-4 border-coral bg-coralsoft p-3">
              <p className="tamil whitespace-pre-line text-xs leading-relaxed text-coral">
                <span className="font-heading font-bold">
                  {t('whyAnswerWrong')} ({chosen}) {t('isWrong')}{' '}
                </span>
                {wrongReason}
              </p>
            </div>
          )}
          {isAptitude ? (
            <WorkedSolution question={question} lang={lang} />
          ) : (
            (displayExplanation(question, lang) ||
              (question.category === 'pyq' && question.year)) && (
              <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                {question.category === 'pyq' && question.year && (
                  <p className="mb-1 font-heading text-[11px] font-bold uppercase tracking-wide text-secondary">
                    {t('askedInYear')}: {question.year}
                  </p>
                )}
                {displayExplanation(question, lang) && (
                  <p className="tamil whitespace-pre-line text-xs leading-relaxed text-navytext/80">
                    <span className="font-heading font-bold text-secondary">
                      {t('explanationColon')}{' '}
                    </span>
                    {displayExplanation(question, lang)}
                  </p>
                )}
              </div>
            )
          )}
          {(isAptitude || displayExplanation(question, lang)) && (
            <ExplanationVote questionId={question.id} />
          )}
        </>
      ) : (
        <div className="text-xs text-navytext/50">
          {attempted ? (
            <>
              {t('yourAnswerLabel')}:{' '}
              <span className="font-semibold">
                {(answer!.selected_answer as AnswerLetter) ?? '-'}
              </span>
            </>
          ) : (
            t('notAttempted')
          )}
        </div>
      )}
    </div>
  )
}

/** Thumbs up/down on a single explanation. 'down' flags it as needing work. */
function ExplanationVote({ questionId }: { questionId: string }) {
  const { t } = useT()
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [busy, setBusy] = useState(false)

  const cast = async (v: 'up' | 'down') => {
    if (busy || vote === v) return
    setBusy(true)
    const prev = vote
    setVote(v)
    try {
      await api.feedback.explanation(questionId, v)
      toast.success(v === 'down' ? t('explFlagged') : t('explThanks'))
    } catch {
      setVote(prev) // roll back on failure
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3 border-t border-line/60 pt-2">
      <span className="font-body text-[11px] text-ink2">{t('explHelpful')}</span>
      <button
        type="button"
        onClick={() => cast('up')}
        disabled={busy}
        aria-pressed={vote === 'up'}
        aria-label={t('explHelpful')}
        className={`press transition-colors ${vote === 'up' ? 'text-mint' : 'text-ink2/60 hover:text-mint'}`}
      >
        <ThumbsUp size={15} className={vote === 'up' ? 'fill-mint/20' : ''} />
      </button>
      <button
        type="button"
        onClick={() => cast('down')}
        disabled={busy}
        aria-pressed={vote === 'down'}
        aria-label={t('explFlagged')}
        className={`press transition-colors ${vote === 'down' ? 'text-coral' : 'text-ink2/60 hover:text-coral'}`}
      >
        <ThumbsDown size={15} className={vote === 'down' ? 'fill-coral/20' : ''} />
      </button>
    </div>
  )
}
