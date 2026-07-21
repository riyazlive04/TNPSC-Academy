import type { ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import type { ReactElement } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { tapScaleSubtle } from '../../lib/motion'
import type { Tint } from './IconTile'

// ─── ChoiceGrid + ChoiceCard ────────────────────────────────────────────────
// The tactile card grid used by every practice/PYQ chooser (subjects, topics,
// question types, aptitude topics, PYQ groups…). It replaces the older list-row
// pickers so each choice reads as its own card, fronted by its PNG subject icon.
//
// `icon` is polymorphic:
//   • a string  → a PNG url (public/subject-icons); shown on a soft tinted tile.
//   • a node    → a Lucide glyph; shown on a brand-gradient tile (the fallback
//                 for choices that have no artwork, e.g. History periods).
// This keeps one visual language whether or not a choice has a bespoke icon.

const SOFT: Record<Tint, string> = {
  violet: 'bg-tint-violet',
  coral: 'bg-tint-coral',
  blue: 'bg-tint-blue',
  green: 'bg-tint-green',
}
const GRADIENT: Record<Tint, string> = {
  violet: 'from-brand to-brand-deep',
  coral: 'from-accentwarm to-coral',
  blue: 'from-sky to-brand',
  green: 'from-mint to-sky',
}

export function ChoiceGrid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`grid grid-cols-2 gap-3 ${className}`}>{children}</div>
}

export function ChoiceCard({
  icon,
  tint = 'violet',
  title,
  subtitle,
  count,
  countLabel,
  locked = false,
  lockedLabel,
  active = false,
  disabled = false,
  onClick,
  index = 0,
  className = '',
}: {
  /** PNG url (string) → soft tile, or a Lucide node → gradient tile. */
  icon: string | ReactNode
  tint?: Tint
  title: ReactNode
  subtitle?: ReactNode
  /** Convenience count line (bold number + word); ignored when `subtitle` is set. */
  count?: number
  countLabel?: string
  locked?: boolean
  lockedLabel?: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  /** Stagger position for the entrance cascade. */
  index?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const isImg = typeof icon === 'string'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : tapScaleSubtle}
      style={{ '--i': index } as React.CSSProperties}
      className={[
        'stagger-item group focus-ring relative flex h-full flex-col items-start gap-2.5 rounded-card border p-3.5 text-left shadow-soft transition-transform duration-200',
        disabled ? 'opacity-45' : 'hover:-translate-y-0.5',
        active ? 'border-primary ring-2 ring-primary/30' : 'border-line',
        'bg-card',
        className,
      ].join(' ')}
    >
      {/* Lock chip (free-tier spent) — sits over the top-right corner. */}
      {locked && (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-accentwarmsoft px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide text-accentwarm">
          <Lock size={10} /> {lockedLabel}
        </span>
      )}

      {/* Icon tile: soft-tinted behind a PNG, brand-gradient behind a glyph. */}
      {isImg ? (
        <span className={`grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-tile p-1 ${SOFT[tint]}`}>
          <img src={icon as string} alt="" className="h-full w-full object-contain" loading="lazy" />
        </span>
      ) : (
        <span
          className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-tile bg-gradient-to-br ${GRADIENT[tint]} text-white shadow-sm`}
        >
          {isValidElement(icon)
            ? cloneElement(icon as ReactElement<{ size?: number }>, { size: 24 })
            : icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="tamil block font-display text-sm font-bold leading-tight text-ink">
          {title}
        </span>
        {subtitle ? (
          <span className="tamil mt-1 line-clamp-2 block font-body text-[11.5px] leading-snug text-muted">
            {subtitle}
          </span>
        ) : count != null && count > 0 ? (
          <span className="mt-1 block font-body text-[11.5px] text-muted">
            <span className="font-heading font-bold tabular-nums text-primary">
              {count.toLocaleString()}
            </span>{' '}
            {countLabel}
          </span>
        ) : null}
      </span>
    </motion.button>
  )
}
