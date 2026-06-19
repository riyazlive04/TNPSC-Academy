import type { ReactNode } from 'react'

// ─── IconTile ───────────────────────────────────────────────────────────────
// The small pastel tile that sits at the *start of a row* — never a large
// category card (design-system.md: tints are ≈38px icon tiles inside rows). Each
// tint pairs a soft background with its matching strong icon colour.

const TINTS = {
  violet: 'bg-tint-violet text-primary',
  coral: 'bg-tint-coral text-accent',
  blue: 'bg-tint-blue text-sky',
  green: 'bg-tint-green text-mint',
} as const

export type Tint = keyof typeof TINTS

export default function IconTile({
  tint = 'violet',
  size = 38,
  className = '',
  children,
}: {
  tint?: Tint
  /** Square edge in px. Spec default is the in-row 38px tile. */
  size?: number
  className?: string
  children: ReactNode
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`grid flex-shrink-0 place-items-center rounded-tile ${TINTS[tint]} ${className}`}
    >
      {children}
    </span>
  )
}
