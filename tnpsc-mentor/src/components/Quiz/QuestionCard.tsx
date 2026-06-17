import type { AnswerLetter, DisplayLang, Question } from '../../types'
import { LETTERS, displayOption, displayExplanation } from '../../types'
import OptionButton from './OptionButton'
import QuestionFigures from './QuestionFigures'
import QuestionStem from './QuestionStem'
import { useT } from '../../lib/i18n'
import { topicName } from '../../lib/constants'

interface QuestionCardProps {
  question: Question
  index: number
  total: number
  selected: AnswerLetter | null
  onSelect: (letter: AnswerLetter) => void
  /** review/admin grading mode */
  reveal?: boolean
  disabled?: boolean
  /** Overrides the UI language for the question CONTENT only (in-test bilingual
   *  toggle). Falls back to the user's interface language when omitted. */
  displayLang?: DisplayLang
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
  displayLang,
}: QuestionCardProps) {
  const { t, lang: uiLang } = useT()
  const lang = displayLang ?? uiLang
  return (
    <div className="animate-fadeIn rounded-3xl border border-line bg-card p-5 shadow-card sm:p-7">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="tamil font-heading text-sm font-bold uppercase tracking-wide text-secondary">
          {t('question')} {index + 1} {t('of')} {total}
        </span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {/* Topic label - useful for PYQ, where every question carries its own
              topic (e.g. "Ozone Depletion Cause"). */}
          {question.topic && (
            <span className="tamil max-w-[55vw] truncate rounded-full bg-brand-soft px-3 py-1 font-heading text-xs font-semibold text-brand sm:max-w-[16rem]">
              {topicName(question.topic, lang)}
            </span>
          )}
          {question.category === 'current_affairs' && question.ca_month && (
            <span className="rounded-full bg-secondary/10 px-3 py-1 font-heading text-xs font-semibold uppercase text-secondary">
              {question.ca_month}
            </span>
          )}
          {question.difficulty && (
            <span className="rounded-full bg-primary/10 px-3 py-1 font-heading text-xs font-semibold uppercase text-primary">
              {question.difficulty}
            </span>
          )}
        </div>
      </div>

      <QuestionStem
        question={question}
        lang={lang}
        textClassName="mb-3 text-lg font-semibold leading-relaxed text-navytext sm:text-xl"
      />

      <QuestionFigures images={question.images} className="mb-5" />

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
