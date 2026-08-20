import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { tapScaleSubtle } from '../../lib/motion'
import IconTile, { type Tint } from './IconTile'

// ─── CardList + CardRow ─────────────────────────────────────────────────────
// A card-styled sibling to ListRow: each row is its own bordered, shadowed
// tile with a gap between them, instead of ListRow's hairline-divided flat
// list. Used where a section should read as a set of distinct destinations
// (the dashboard's Practice / Keep Going sections) rather than a dense index.

export function CardList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2.5 ${className}`}>{children}</div>
}

export function CardRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  disabled = false,
  className = '',
  style,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Defaults to a chevron. Pass a value/badge for stat-style rows. */
  trailing?: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : tapScaleSubtle}
      style={style}
      className={`stagger-item focus-ring group flex w-full items-center gap-3.5 rounded-card border border-line bg-card p-3.5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card disabled:opacity-45 disabled:hover:translate-y-0 ${className}`}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="tamil block truncate font-display text-base font-semibold leading-snug text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="tamil mt-0.5 block truncate font-body text-sm text-muted">
            {subtitle}
          </span>
        )}
      </span>
      {trailing ?? (
        <ChevronRight
          size={18}
          className="flex-shrink-0 text-muted/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted"
        />
      )}
    </motion.button>
  )
}

// ─── CardGrid + GridCard ─────────────────────────────────────────────────────
// A two-column sibling to CardRow: icon on top, title + subtitle stacked below
// - a compact tile rather than a wide row. Used for the dashboard's Practice /
// Keep Going sections, matching the original app-icon-style grid. `h-full` on
// each card plus CSS grid's row-sizing keeps every card in a row the same
// height regardless of how long its title/subtitle run, so a two-line title
// never overlaps the row underneath.

export function CardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-3 ${className}`}>{children}</div>
}

export function GridCard({
  icon,
  tint,
  title,
  subtitle,
  badge,
  onClick,
  disabled = false,
  className = '',
  style,
}: {
  icon: ReactNode
  tint: Tint
  title: ReactNode
  subtitle?: ReactNode
  /** Small corner badge - e.g. a "3/12 subjects" progress count. */
  badge?: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      whileTap={reduce || disabled ? undefined : tapScaleSubtle}
      className={`stagger-item focus-ring group relative flex h-full flex-col items-start gap-2.5 rounded-card border border-line bg-card p-3.5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card disabled:opacity-45 disabled:hover:translate-y-0 ${className}`}
    >
      {badge && <span className="absolute right-3 top-3">{badge}</span>}
      <IconTile tint={tint} size={44}>
        {icon}
      </IconTile>
      <span className="min-w-0">
        <span className="tamil block font-heading text-sm font-semibold leading-tight text-ink">{title}</span>
        {subtitle && (
          <span className="tamil mt-0.5 line-clamp-2 block font-body text-xs leading-snug text-muted">
            {subtitle}
          </span>
        )}
      </span>
    </motion.button>
  )
}
