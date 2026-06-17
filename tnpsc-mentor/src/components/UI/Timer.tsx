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
 * Compact human duration for per-question timing - e.g. "12s" or "1m 05s".
 * Reads better than a zero-padded clock for the short spans on a result card.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

/**
 * Large countdown timer for the quiz. Turns red when under 60s, and in the final
 * 5 seconds switches to a slow "breathing" pulse (scale + halo) for urgency.
 */
export default function Timer({ secondsLeft, className = '' }: TimerProps) {
  const danger = secondsLeft <= 60
  const critical = secondsLeft <= 5
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 font-heading font-bold tabular-nums',
        danger ? 'bg-warn text-white' : 'border border-line bg-card text-ink',
        critical ? 'animate-breathe' : danger ? 'animate-pulse' : '',
        className,
      ].join(' ')}
      role="timer"
      // Don't announce every second (screen-reader spam); QuizPage announces
      // milestones (1 min / 30s / 10s) via a dedicated live region instead.
      aria-live="off"
    >
      <Clock size={18} />
      <span className="text-lg sm:text-xl">{formatTime(secondsLeft)}</span>
    </div>
  )
}
