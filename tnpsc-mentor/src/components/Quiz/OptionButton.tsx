import type { AnswerLetter } from '../../types'
import { Check, X } from 'lucide-react'
import MathText from '../UI/MathText'

interface OptionButtonProps {
  letter: AnswerLetter
  text: string
  /** When set, the option is a figure (non-verbal question): render the image
   *  instead of the text. The letter badge still identifies the choice. */
  image?: string | null
  selected: boolean
  onSelect: () => void
  /** When set, the option renders in graded mode (admin / review). */
  reveal?: {
    isCorrect: boolean
    isChosenWrong: boolean
  }
  disabled?: boolean
}

/**
 * A single answer option as a clean, flat selectable row labelled A-D - the
 * quiz focus mode's core control (design-system.md "Minimal typographic = the
 * quiz flow"). No shadow; a hairline border that firms up on selection. States
 * follow the spec - tinted fill + coloured border + coloured marker, and ALWAYS
 * a check/cross icon (never colour alone), which also reads correctly in dark.
 */
export default function OptionButton({
  letter,
  text,
  image,
  selected,
  onSelect,
  reveal,
  disabled = false,
}: OptionButtonProps) {
  let stateCls = 'border-line bg-card text-ink hover:border-primary/40'
  let badgeCls = 'bg-tint-violet text-primary'
  let icon: React.ReactNode = null

  if (reveal) {
    if (reveal.isCorrect) {
      stateCls = 'border-correct bg-tint-green text-ink'
      badgeCls = 'bg-correct text-white'
      icon = <Check size={18} className="animate-checkPop flex-shrink-0 text-correct" />
    } else if (reveal.isChosenWrong) {
      stateCls = 'border-wrong bg-coralsoft text-ink'
      badgeCls = 'bg-wrong text-white'
      icon = <X size={18} className="animate-checkPop flex-shrink-0 text-wrong" />
    } else {
      stateCls = 'border-line bg-card text-ink'
    }
  } else if (selected) {
    stateCls = 'border-primary bg-selected text-ink'
    badgeCls = 'bg-primary text-white'
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex w-full items-center gap-3 rounded-field border-2 px-4 py-3 text-left font-body',
        'transition-colors duration-150 active:scale-[0.99]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
        'disabled:cursor-default disabled:active:scale-100',
        stateCls,
      ].join(' ')}
    >
      <span
        className={[
          'grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl font-display text-sm font-bold transition-colors',
          badgeCls,
        ].join(' ')}
      >
        {letter}
      </span>
      {image ? (
        <span className="min-w-0 flex-1">
          <img
            src={image}
            alt={`Option ${letter}`}
            loading="lazy"
            className="max-h-40 w-auto max-w-full rounded-lg border border-navytext/10 bg-white object-contain p-1"
          />
        </span>
      ) : (
        <span className="tamil min-w-0 flex-1 text-[15px] leading-relaxed [overflow-wrap:anywhere]">
          <MathText text={text} />
        </span>
      )}
      {icon}
    </button>
  )
}
