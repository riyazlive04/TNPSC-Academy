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
  let stateCls = 'bg-card text-ink border-2 border-line'
  let badgeCls = 'bg-brand-soft text-brand'
  let icon: React.ReactNode = null

  if (reveal) {
    if (reveal.isCorrect) {
      stateCls = 'bg-mintsoft text-ink border-2 border-mint'
      badgeCls = 'bg-mint text-white'
      icon = <Check size={18} className="animate-checkPop text-mint" />
    } else if (reveal.isChosenWrong) {
      stateCls = 'bg-coralsoft text-ink border-2 border-coral'
      badgeCls = 'bg-coral text-white'
      icon = <X size={18} className="animate-checkPop text-coral" />
    } else {
      stateCls = 'bg-card text-ink border-2 border-line'
    }
  } else if (selected) {
    stateCls = 'bg-brand-soft text-brand border-2 border-brand'
    badgeCls = 'bg-brand text-white'
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-body transition-all duration-150',
        'shadow-pill hover:-translate-y-0.5 active:scale-[0.99] disabled:cursor-default disabled:hover:translate-y-0 disabled:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35',
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
      <span className="tamil min-w-0 flex-1 break-words text-[15px] leading-snug">{text}</span>
      {icon}
    </button>
  )
}
