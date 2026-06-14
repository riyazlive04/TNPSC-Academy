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
  // Premium minimal: a clean section title rather than a coloured pill.
  const sizeCls = size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'
  return (
    <span
      className={[
        'inline-block font-heading font-semibold tracking-tight text-ink',
        sizeCls,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
