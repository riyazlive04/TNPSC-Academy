import { Clock } from 'lucide-react'

interface TimerProps {
  /** seconds remaining */
  secondsLeft: number
  className?: string
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Large countdown timer for the quiz. Turns red (#FF5722) when under 60s.
 */
export default function Timer({ secondsLeft, className = '' }: TimerProps) {
  const danger = secondsLeft <= 60
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 font-heading font-bold tabular-nums',
        danger ? 'bg-warn text-white animate-pulse' : 'bg-white text-navytext',
        className,
      ].join(' ')}
      role="timer"
      aria-live="polite"
    >
      <Clock size={18} />
      <span className="text-lg sm:text-xl">{formatTime(secondsLeft)}</span>
    </div>
  )
}
