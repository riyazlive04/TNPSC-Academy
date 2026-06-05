import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
  /** Optional leading icon element */
  icon?: ReactNode
  /** size variant */
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

/**
 * The core navigation element of TNPSC Mentor — a white pill button that turns
 * yellow (#FFC107) with dark navy text when `active`.
 */
export default function PillButton({
  active = false,
  children,
  icon,
  size = 'md',
  fullWidth = false,
  className = '',
  ...rest
}: PillButtonProps) {
  const sizeCls =
    size === 'sm'
      ? 'px-4 py-2 text-sm'
      : size === 'lg'
        ? 'px-8 py-4 text-lg'
        : 'px-6 py-3 text-base'

  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-heading font-semibold',
        'shadow-pill transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card',
        'active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        active ? 'bg-accent text-navytext' : 'bg-white text-navytext',
        fullWidth ? 'w-full' : '',
        sizeCls,
        className,
      ].join(' ')}
    >
      {icon}
      <span className="leading-tight">{children}</span>
    </button>
  )
}
