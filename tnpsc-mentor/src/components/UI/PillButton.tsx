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
 * The core selection chip - a flat pill on the surface that fills with the brand
 * gradient when `active`. No shadow; a hairline border that firms up on hover.
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
        'inline-flex max-w-full items-center justify-center gap-2 rounded-pill font-heading font-semibold',
        'transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'bg-brand-gradient text-white'
          : 'border border-line bg-card text-ink hover:border-primary/40 hover:text-primary',
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
