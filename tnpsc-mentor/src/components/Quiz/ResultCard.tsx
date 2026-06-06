import type { AnswerLetter, Question, TestAnswer } from '../../types'
import { LETTERS, displayQuestion, displayOption, displayExplanation, whyWrongFor } from '../../types'
import { Check, X, MinusCircle } from 'lucide-react'
import { useT } from '../../lib/i18n'

interface ResultCardProps {
  question: Question
  index: number
  answer?: TestAnswer
  /** When true, show option text + explanation (only after PDF gate passes). */
  showExplanation: boolean
}

/**
 * Compact per-question breakdown card on the Result page.
 */
export default function ResultCard({
  question,
  index,
  answer,
  showExplanation,
}: ResultCardProps) {
  const { lang } = useT()
  const attempted = Boolean(answer?.selected_answer)
  const correct = answer?.is_correct ?? false
  const chosen = answer?.selected_answer as AnswerLetter | undefined
  // Targeted feedback: why the user's specific wrong choice is incorrect.
  const wrongReason =
    attempted && !correct && chosen ? whyWrongFor(question, chosen) : ''

  let statusIcon = <MinusCircle size={20} className="text-slate-400" />
  let statusLabel = 'Skipped'
  let ring = 'border-slate-200'
  if (attempted && correct) {
    statusIcon = <Check size={20} className="text-green-600" />
    statusLabel = 'Correct'
    ring = 'border-green-300'
  } else if (attempted && !correct) {
    statusIcon = <X size={20} className="text-red-600" />
    statusLabel = 'Wrong'
    ring = 'border-red-300'
  }

  return (
    <div className={`rounded-2xl border-2 bg-white p-4 ${ring}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="tamil whitespace-pre-line text-sm font-semibold leading-snug text-navytext">
          <span className="mr-1 text-secondary">Q{index + 1}.</span>
          {displayQuestion(question, lang)}
        </p>
        <div className="flex flex-shrink-0 items-center gap-1">
          {statusIcon}
          <span className="font-heading text-xs font-bold uppercase text-navytext/60">
            {statusLabel}
          </span>
        </div>
      </div>

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
                  {isChosenWrong && ' ✗ (your answer)'}
                </div>
              )
            })}
          </div>
          {wrongReason && (
            <div className="mt-3 rounded-lg border-l-4 border-red-400 bg-red-50 p-3">
              <p className="tamil whitespace-pre-line text-xs leading-relaxed text-red-700">
                <span className="font-heading font-bold">
                  Why your answer ({chosen}) is wrong:{' '}
                </span>
                {wrongReason}
              </p>
            </div>
          )}
          {displayExplanation(question, lang) && (
            <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary/5 p-3">
              <p className="tamil whitespace-pre-line text-xs leading-relaxed text-navytext/80">
                <span className="font-heading font-bold text-secondary">
                  Explanation:{' '}
                </span>
                {displayExplanation(question, lang)}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-navytext/50">
          {attempted ? (
            <>
              Your answer:{' '}
              <span className="font-semibold">
                {(answer!.selected_answer as AnswerLetter) ?? '—'}
              </span>
            </>
          ) : (
            'Not attempted'
          )}
        </div>
      )}
    </div>
  )
}
