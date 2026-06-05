import type { AnswerLetter, Question } from '../../types'
import { LETTERS, displayQuestion, displayOption, displayExplanation } from '../../types'
import OptionButton from './OptionButton'
import { useT } from '../../lib/i18n'

interface QuestionCardProps {
  question: Question
  index: number
  total: number
  selected: AnswerLetter | null
  onSelect: (letter: AnswerLetter) => void
  /** review/admin grading mode */
  reveal?: boolean
  disabled?: boolean
}

/**
 * The white question card shown during a quiz. Question text in dark navy,
 * four option pills below.
 */
export default function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
  reveal = false,
  disabled = false,
}: QuestionCardProps) {
  const { t, lang } = useT()
  return (
    <div className="animate-fadeIn rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <div className="mb-3 flex items-center justify-between">
        <span className="tamil font-heading text-sm font-bold uppercase tracking-wide text-secondary">
          {t('question')} {index + 1} {t('of')} {total}
        </span>
        {question.difficulty && (
          <span className="rounded-full bg-primary/10 px-3 py-1 font-heading text-xs font-semibold uppercase text-primary">
            {question.difficulty}
          </span>
        )}
      </div>

      <p className="tamil mb-5 whitespace-pre-line text-lg font-semibold leading-relaxed text-navytext sm:text-xl">
        {displayQuestion(question, lang)}
      </p>

      <div className="flex flex-col gap-3">
        {LETTERS.map((letter) => {
          const isCorrect = reveal && question.correct_answer === letter
          const isChosenWrong =
            reveal && selected === letter && question.correct_answer !== letter
          return (
            <OptionButton
              key={letter}
              letter={letter}
              text={displayOption(question, letter, lang)}
              selected={!reveal && selected === letter}
              onSelect={() => onSelect(letter)}
              disabled={disabled}
              reveal={reveal ? { isCorrect, isChosenWrong } : undefined}
            />
          )
        })}
      </div>

      {reveal && displayExplanation(question, lang) && (
        <div className="mt-5 rounded-2xl border-l-4 border-secondary bg-secondary/5 p-4">
          <p className="tamil mb-1 font-heading text-sm font-bold uppercase text-secondary">
            {t('explanation')}
          </p>
          <p className="tamil whitespace-pre-line text-sm leading-relaxed text-navytext/80">
            {displayExplanation(question, lang)}
          </p>
        </div>
      )}
    </div>
  )
}
