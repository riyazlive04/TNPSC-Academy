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

export type Tint = keyof typeof GRADIENTS

export default function IconTile({
  tint = 'violet',
  size = 38,
  variant = 'gradient',
  className = '',
  children,
}: {
  tint?: Tint
  /** Square edge in px. Spec default is the in-row 38px tile. */
  size?: number
  /** 'gradient' (default) = white glyph on a brand gradient; 'soft' = flat pastel. */
  variant?: 'gradient' | 'soft'
  className?: string
  children: ReactNode
}) {
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
