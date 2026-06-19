import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

// ─── CircularProgress ───────────────────────────────────────────────────────
// A dependency-free SVG ring (the spec lists react-circular-progressbar, but the
// repo doesn't ship it). Stroke uses `currentColor` so colours come from text-*
// tokens and stay theme-aware. The ring draws from 0 → value on mount, honouring
// prefers-reduced-motion.

export default function CircularProgress({
  value,
  size = 132,
  stroke = 10,
  trackClassName = 'text-line',
  progressClassName = 'text-primary',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  trackClassName?: string
  progressClassName?: string
  children?: ReactNode
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value, reduce])

  const clamped = Math.min(100, Math.max(0, shown))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={progressClassName}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={reduce ? undefined : { transition: 'stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
