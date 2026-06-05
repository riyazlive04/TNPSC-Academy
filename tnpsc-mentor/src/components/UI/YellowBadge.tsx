import type { ReactNode } from 'react'

interface YellowBadgeProps {
  children: ReactNode
  className?: string
  size?: 'md' | 'lg'
}

/**
 * Yellow category-header badge used at the top of every test section
 * (e.g. "TEST ARENA", "PREVIOUS YEAR QUESTION PAPER").
 */
export default function YellowBadge({
  children,
  className = '',
  size = 'lg',
}: YellowBadgeProps) {
  const sizeCls = size === 'lg' ? 'px-7 py-2.5 text-lg sm:text-xl' : 'px-5 py-2 text-base'
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full bg-accent font-heading font-bold uppercase tracking-wide text-navytext shadow-pill',
        sizeCls,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
