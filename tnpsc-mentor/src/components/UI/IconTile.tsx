import type { ReactNode } from 'react'

// ─── IconTile ───────────────────────────────────────────────────────────────
// The small tile that sits at the start of a row / category. By default it now
// renders as a DIMENSIONAL gradient chip (white glyph on a two-tone brand
// gradient) so every list-based screen matches the dashboard's card language.
// Pass `variant="soft"` for the older flat-pastel look where a gradient would be
// too heavy (e.g. a dense inline context).

const GRADIENTS = {
  violet: 'from-brand to-brand-deep',
  coral: 'from-accentwarm to-coral',
  blue: 'from-sky to-brand',
  green: 'from-mint to-sky',
} as const

const SOFT = {
  violet: 'bg-tint-violet text-primary',
  coral: 'bg-tint-coral text-accent',
  blue: 'bg-tint-blue text-sky',
  green: 'bg-tint-green text-mint',
} as const

// Background-only tints for a PNG illustration - the artwork carries its own
// colour, so it sits on a plain tint rather than SOFT's glyph-coloured text.
const SOFT_BG = {
  violet: 'bg-tint-violet',
  coral: 'bg-tint-coral',
  blue: 'bg-tint-blue',
  green: 'bg-tint-green',
} as const

export type Tint = keyof typeof GRADIENTS

export default function IconTile({
  tint = 'violet',
  size = 38,
  variant = 'gradient',
  iconSrc,
  className = '',
  children,
}: {
  tint?: Tint
  /** Square edge in px. Spec default is the in-row 38px tile. */
  size?: number
  /** 'gradient' (default) = white glyph on a brand gradient; 'soft' = flat pastel. */
  variant?: 'gradient' | 'soft'
  /** PNG illustration (public/subject-icons); when set it replaces `children`
   *  entirely and always renders on a soft tint - the artwork carries its own
   *  colour, so it never sits on the brand gradient. */
  iconSrc?: string
  className?: string
  children?: ReactNode
}) {
  if (iconSrc) {
    return (
      <span
        style={{ width: size, height: size }}
        className={`grid flex-shrink-0 place-items-center overflow-hidden rounded-tile p-1 ${SOFT_BG[tint]} ${className}`}
      >
        <img src={iconSrc} alt="" className="h-full w-full object-contain" loading="lazy" />
      </span>
    )
  }
  const skin =
    variant === 'gradient'
      ? `bg-gradient-to-br ${GRADIENTS[tint]} text-white shadow-sm`
      : SOFT[tint]
  return (
    <span
      style={{ width: size, height: size }}
      className={`grid flex-shrink-0 place-items-center rounded-tile ${skin} ${className}`}
    >
      {children}
    </span>
  )
}
