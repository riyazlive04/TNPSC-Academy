interface ProgressBarProps {
  /** 0–100 */
  percent: number
  className?: string
  /** colour of the filled portion */
  color?: string
  height?: number
}

export default function ProgressBar({
  percent,
  className = '',
  color = '#FFC107',
  height = 8,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={['w-full overflow-hidden rounded-full bg-white/20', className].join(' ')}
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
