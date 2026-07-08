interface LogoLoaderProps {
  /** Outer diameter in px (ring included); the logo scales inside it. */
  size?: number
  className?: string
  /** Accessible label; defaults to a generic loading announcement. */
  label?: string
}

/**
 * Screen-level loading indicator: the brand logo breathing inside a spinning
 * brand-coloured arc. Replaces the generic spinner wherever a whole screen (or
 * route chunk) is loading; small inline button waits keep the plain Spinner.
 */
export default function LogoLoader({ size = 64, className = '', label = 'Loading' }: LogoLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-soft border-t-brand"
        style={{ animationDuration: '0.9s' }}
      />
      <img
        src="/logo-mark.png"
        alt=""
        className="animate-logoPulse object-contain"
        style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6) }}
      />
    </span>
  )
}
