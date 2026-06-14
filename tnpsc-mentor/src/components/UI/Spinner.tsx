import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: number
  className?: string
  /** Accessible label; defaults to a generic loading announcement. */
  label?: string
}

/** Consistent loading spinner used everywhere a brief async wait happens. */
export default function Spinner({ size = 18, className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      role="status"
      aria-label={label}
      className={`animate-spin ${className}`}
    />
  )
}
