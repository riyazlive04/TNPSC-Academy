interface ProgressBarProps {
  /** 0-100 */
  percent: number
  className?: string
  /** colour of the filled portion */
  color?: string
  height?: number
}

export default function ProgressBar({
  percent,
  className = '',
  // Theme-aware default (violet). Callers may pass a CSS colour or a
  // `rgb(var(--c-…))` string, which resolves live on theme switch.
  color = 'rgb(var(--c-brand))',
  height = 8,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={['w-full overflow-hidden rounded-full bg-line', className].join(' ')}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}
