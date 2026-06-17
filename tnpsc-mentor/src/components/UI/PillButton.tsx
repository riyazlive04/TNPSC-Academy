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
 * The core navigation element of TNPSC Mentor - a white pill button that turns
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
        'inline-flex max-w-full items-center justify-center gap-2 rounded-2xl font-heading font-semibold',
        'shadow-pill transition-all duration-200 hover:-translate-y-0.5',
        'active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        active
          ? 'bg-brand-gradient text-white'
          : 'border border-line bg-card text-ink hover:border-brand-ring',
        fullWidth ? 'w-full' : '',
        sizeCls,
        className,
      ].join(' ')}
    >
      {icon}
      <span className="min-w-0 break-words leading-tight">{children}</span>
    </button>
  )
}
