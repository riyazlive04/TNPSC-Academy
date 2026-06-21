import type { AnswerLetter } from '../../types'
import { LETTERS } from '../../types'

interface OmrBubblesProps {
  selected: AnswerLetter | null
  onSelect: (letter: AnswerLetter) => void
  disabled?: boolean
  /** Which letters to show; defaults to A–D. Pass optionLetters(q) for 5-option items. */
  letters?: AnswerLetter[]
}

/**
 * A row of darken-to-fill OMR bubbles (A-D, or A-E for 5-option items), like a
 * printed answer sheet. The chosen option fills solid; the rest stay hollow
 * outlines. Sizes down on phones so the row + actions fit a narrow screen.
 */
export default function OmrBubbles({ selected, onSelect, disabled = false, letters = LETTERS }: OmrBubblesProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {letters.map((letter) => {
        const on = selected === letter
        return (
          <button
            key={letter}
            type="button"
            onClick={() => onSelect(letter)}
            disabled={disabled}
            aria-pressed={on}
            aria-label={`Option ${letter}`}
            className={[
              'grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border-2 font-heading text-sm font-bold transition-all duration-150 sm:h-10 sm:w-10',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-default',
              on
                ? 'border-brand bg-brand text-white shadow-pill'
                : 'border-ink2/40 bg-card text-ink2 hover:border-brand active:scale-95',
            ].join(' ')}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
