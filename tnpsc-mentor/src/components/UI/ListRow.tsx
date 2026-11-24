import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { tapScale } from '../../lib/motion'

// ─── List + ListRow ─────────────────────────────────────────────────────────
// The backbone of the calm, list-led skeleton (≈80% of the app). Rows sit
// directly on the surface and are separated by a single hairline - no card, no
// shadow. Wrap rows in <List> to get the dividers; each <ListRow> is a tappable
// destination with an optional leading IconTile and a trailing chevron/value.

export function List({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`divide-y divide-line ${className}`}>{children}</div>
}

export function ListRow({
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
      whileTap={reduce || disabled ? undefined : tapScale}
      style={style}
      className={`focus-ring group flex w-full items-center gap-3 py-3 text-left disabled:opacity-45 ${className}`}
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
          className="flex-shrink-0 text-muted/40 transition-colors group-hover:text-muted"
        />
      )}
    </motion.button>
  )
}
