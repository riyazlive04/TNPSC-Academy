import type { AnswerLetter, Question, TestAnswer } from '../../types'
import { LETTERS, displayOption, displayExplanation, whyWrongFor } from '../../types'
import { Bookmark, Check, X, MinusCircle, Clock } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { topicName } from '../../lib/constants'
import { formatDuration } from '../UI/Timer'
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

  let statusIcon = <MinusCircle size={20} className="text-slate-400" />
  let statusLabel = t('statusSkipped')
  let ring = 'border-slate-200'
  if (attempted && correct) {
    statusIcon = <Check size={20} className="text-green-600" />
    statusLabel = t('statusCorrect')
    ring = 'border-green-300'
  } else if (attempted && !correct) {
    statusIcon = <X size={20} className="text-red-600" />
    statusLabel = t('statusWrong')
    ring = 'border-red-300'
  }

  return (
    <div className={`rounded-2xl border-2 bg-card p-4 ${ring}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
        <div className="flex flex-shrink-0 items-center gap-1.5">
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
            {LETTERS.map((letter) => {
              const isCorrect = question.correct_answer === letter
              const isChosenWrong =
                answer?.selected_answer === letter && !correct
              return (
                <div
                  key={letter}
                  className={[
                    'tamil rounded-lg px-3 py-1.5 text-sm',
                    isCorrect
                      ? 'bg-green-50 font-semibold text-green-700'
                      : isChosenWrong
                        ? 'bg-red-50 font-semibold text-red-700'
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
            <div className="mt-3 rounded-lg border-l-4 border-red-400 bg-red-50 p-3">
              <p className="tamil whitespace-pre-line text-xs leading-relaxed text-red-700">
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
            displayExplanation(question, lang) && (
              <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
                <p className="tamil whitespace-pre-line text-xs leading-relaxed text-navytext/80">
                  <span className="font-heading font-bold text-secondary">
                    {t('explanationColon')}{' '}
                  </span>
                  {displayExplanation(question, lang)}
                </p>
              </div>
            )
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
