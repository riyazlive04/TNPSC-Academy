import type { AnswerLetter } from '../../types'
import { Check, X } from 'lucide-react'

interface OptionButtonProps {
  letter: AnswerLetter
  text: string
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
 * A single answer option rendered as a white pill labelled A–D. Highlights in
 * yellow when selected. In `reveal` mode it shows correct (green) / wrong (red).
 */
export default function OptionButton({
  letter,
  text,
  selected,
  onSelect,
  reveal,
  disabled = false,
}: OptionButtonProps) {
  let stateCls = 'bg-white text-navytext border-2 border-transparent'
  let badgeCls = 'bg-primary text-white'
  let icon: React.ReactNode = null

  if (reveal) {
    if (reveal.isCorrect) {
      stateCls = 'bg-green-50 text-navytext border-2 border-green-500'
      badgeCls = 'bg-green-500 text-white'
      icon = <Check size={18} className="text-green-600" />
    } else if (reveal.isChosenWrong) {
      stateCls = 'bg-red-50 text-navytext border-2 border-red-500'
      badgeCls = 'bg-red-500 text-white'
      icon = <X size={18} className="text-red-600" />
    } else {
      stateCls = 'bg-white text-navytext border-2 border-transparent'
    }
  } else if (selected) {
    stateCls = 'bg-accent text-navytext border-2 border-accent'
    badgeCls = 'bg-navytext text-accent'
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-body transition-all duration-150',
        'shadow-pill hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0',
        stateCls,
      ].join(' ')}
    >
      <span
        className={[
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-heading font-bold',
          badgeCls,
        ].join(' ')}
      >
        {letter}
      </span>
      <span className="tamil flex-1 text-[15px] leading-snug">{text}</span>
      {icon}
    </button>
  )
}
