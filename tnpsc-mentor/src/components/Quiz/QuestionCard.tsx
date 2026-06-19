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
  /** Quiz focus mode: render on the bare surface (no card / shadow), with larger
   *  type and lighter chrome. Off (default) keeps the boxed reveal/admin layout. */
  bare?: boolean
}

/**
 * The question + four options. In `bare` (quiz focus) mode it sits directly on
 * the surface for a zero-chrome, type-driven feel; otherwise it's the boxed card
 * used in review/admin grading.
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
  bare = false,
}: QuestionCardProps) {
  const { t, lang: uiLang } = useT()
  const lang = displayLang ?? uiLang
  const hasBadges =
    Boolean(question.year) ||
    Boolean(question.topic) ||
    (question.category === 'current_affairs' && Boolean(question.ca_month)) ||
    Boolean(question.difficulty)
  return (
    <div
      className={
        bare
          ? 'animate-fadeIn'
          : 'animate-fadeIn rounded-hero border border-line bg-card p-5 shadow-soft sm:p-7'
      }
    >
      {/* Header: in bare mode the top bar already shows "Q n / total", so we drop
          the duplicate counter and keep just a quiet badges row. */}
      {(!bare || hasBadges) && (
        <div className={`flex items-center gap-2 ${bare ? 'mb-4 flex-wrap' : 'mb-3 justify-between'}`}>
          {!bare && (
            <span className="tamil font-heading text-sm font-semibold text-ink2">
              {t('question')} {index + 1} {t('of')} {total}
            </span>
          )}
          <div className={`flex min-w-0 items-center gap-2 ${bare ? 'flex-wrap' : 'justify-end'}`}>
            {/* PYQ year badge - the exam year the question was asked in. */}
            {question.year && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">
                {question.year}
              </span>
            )}
            {/* Topic label - useful for PYQ (each question carries its topic). */}
            {question.topic && (
              <span className="tamil max-w-[55vw] truncate rounded-full bg-tint-violet px-2.5 py-1 font-heading text-[11px] font-semibold text-primary sm:max-w-[16rem]">
                {topicName(question.topic, lang)}
              </span>
            )}
            {question.category === 'current_affairs' && question.ca_month && (
              <span className="rounded-full bg-tint-blue px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-sky">
                {question.ca_month}
              </span>
            )}
            {question.difficulty && (
              <span className="rounded-full bg-tint-coral px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-accent">
                {question.difficulty}
              </span>
            )}
          </div>
        </div>
      )}

      <QuestionStem
        question={question}
        lang={lang}
        textClassName={
          bare
            ? 'mb-5 font-display text-lg font-bold leading-relaxed text-ink sm:text-xl'
            : 'mb-3 font-display text-lg font-bold leading-relaxed text-ink sm:text-xl'
        }
      />

      <QuestionFigures images={question.images} className="mb-5" />

      <div className={`flex flex-col ${bare ? 'gap-2.5' : 'gap-3'}`}>
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
