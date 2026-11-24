import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion, type MotionProps } from 'motion/react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { tapScale } from '../../lib/motion'

/** A router Link that takes motion props (press feedback in the app). */
export const MotionLink = motion.create(Link)

/**
 * The tappable surface of a row/card: a real link when it has a destination
 * (`to`) and isn't disabled, otherwise a button. Links give the web app proper
 * web behaviour (open in new tab, copy link, middle-click).
 */
export function Tap({
  to,
  state,
  disabled,
  ...rest
}: {
  to?: string
  state?: unknown
  disabled?: boolean
  onClick?: () => void
  whileTap?: MotionProps['whileTap']
  style?: CSSProperties
  className?: string
  children: ReactNode
}) {
  if (to && !disabled) return <MotionLink to={to} state={state} {...rest} />
  return <motion.button type="button" disabled={disabled} {...rest} />
}

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
  // web: the archive's boxed `.rows` list; native stays hairline rows on the surface.
  return (
    <div
      className={`divide-y divide-line web:overflow-hidden web:rounded-card web:border web:border-line web:bg-card web:shadow-soft ${className}`}
    >
      {children}
    </div>
  )
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  to,
  state,
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
  /** A destination: renders a real link (open in new tab, copy link). Disabled rows stay buttons. */
  to?: string
  state?: unknown
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const reduce = useReducedMotion()
  const cls = `focus-ring group flex w-full items-center gap-3 py-3 text-left disabled:opacity-45 web:px-4 web:py-3.5 web:transition-colors web:hover:bg-brand-soft/40 ${className}`
  const body = (
    <>
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
    </>
  )
  return (
    <Tap
      to={to}
      state={state}
      onClick={onClick}
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : tapScale}
      style={style}
      className={cls}
    >
      {body}
    </Tap>
  )
}
