import type { AnswerLetter, Question, DisplayLang } from '../../types'
import { LETTERS, displayOption } from '../../types'

interface OmrOptionsProps {
  question: Question
  lang: DisplayLang
  selected: AnswerLetter | null
  onSelect: (letter: AnswerLetter) => void
  disabled?: boolean
}

/**
 * The four answer choices for a mock question, each as a full-width selectable
 * row: an OMR-style letter bubble plus the option's TEXT (from option_a..d /
 * their Tamil variants). The bare bubble row alone can't convey assertion-reason
 * choices ("Both A and R are true…") or match codes ("(a)-2,(b)-1,…"), so the
 * text is essential - this renders it for every question type.
 *
 * If a question has no option text at all (blank columns), nothing renders and
 * the caller's bubble fallback can take over.
 */
export default function OmrOptions({
  question,
  lang,
  selected,
  onSelect,
  disabled = false,
}: OmrOptionsProps) {
  const texts = LETTERS.map((l) => displayOption(question, l, lang))
  const hasText = texts.some((t) => t && t.trim().length > 0)
  if (!hasText) return null

  return (
    <div className="mt-4 flex flex-col gap-2">
      {LETTERS.map((letter, i) => {
        const on = selected === letter
        return (
          <button
            key={letter}
            type="button"
            onClick={() => onSelect(letter)}
            disabled={disabled}
            aria-pressed={on}
            className={[
              'flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35',
              on
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-card hover:border-brand-ring active:scale-[0.995]',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border-2 font-heading text-xs font-bold transition-colors',
                on ? 'border-brand bg-brand text-white' : 'border-ink2/40 bg-card text-ink2',
              ].join(' ')}
            >
              {letter}
            </span>
            <span
              className={[
                'tamil min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-relaxed sm:text-[15px]',
                on ? 'font-medium text-brand' : 'text-navytext',
              ].join(' ')}
            >
              {texts[i]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
