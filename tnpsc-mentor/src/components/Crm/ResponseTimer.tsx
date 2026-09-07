import { useEffect, useState } from 'react'
import { Clock, CheckCircle2, Hourglass } from 'lucide-react'
import { nowMs, useCrmStore } from '../../store/crmStore'
import { SLA_CLASS, formatDuration, slaState, type Lead } from '../../lib/crm'

/**
 * One shared ticker for every timer on the page. A per-card setInterval would
 * mean forty timers firing out of step on a busy queue; this fires once a
 * second and every subscriber re-renders together.
 */
let tickers = 0
let handle: number | null = null
const listeners = new Set<(t: number) => void>()

function subscribe(fn: (t: number) => void): () => void {
  listeners.add(fn)
  if (++tickers === 1) {
    handle = window.setInterval(() => {
      const t = nowMs()
      listeners.forEach((l) => l(t))
    }, 1000)
  }
  return () => {
    listeners.delete(fn)
    if (--tickers === 0 && handle !== null) {
      window.clearInterval(handle)
      handle = null
    }
  }
}

/** Live seconds-since, driven off the SERVER clock (see crmStore.nowMs). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => nowMs())
  useEffect(() => {
    if (!active) return
    setNow(nowMs())
    return subscribe(setNow)
  }, [active])
  return now
}

interface ResponseTimerProps {
  lead: Lead
  /** `full` adds the wording; `chip` is the bare clock for a dense row. */
  variant?: 'chip' | 'full'
}

/**
 * How long this lead has been waiting for its first contact — the number the
 * whole desk is organised around. It counts up live while nobody has called,
 * escalating green → amber → orange → red, and freezes the moment the first
 * Call/WhatsApp/Email click lands (see crmStore.logClick).
 */
export default function ResponseTimer({ lead, variant = 'chip' }: ResponseTimerProps) {
  const thresholds = useCrmStore((s) => s.sla)
  const sla = slaState(lead, nowMs(), thresholds)
  // Only leads still on the clock need to re-render every second.
  const now = useNow(sla.running)
  const live = slaState(lead, now, thresholds)

  const backlog = live.level === 'backlog'
  const Icon = !live.running ? CheckCircle2 : backlog ? Hourglass : Clock

  // A backlog lead shows an AGE, an inbound lead shows a countdown against the
  // response promise, and a contacted lead shows what the response actually was.
  const label = !live.running
    ? `${formatDuration(live.seconds)} to first call`
    : backlog
      ? `in queue ${formatDuration(live.seconds)}`
      : formatDuration(live.seconds)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-heading text-2xs font-semibold tabular-nums ${SLA_CLASS[live.level]}`}
      title={
        !live.running
          ? 'Time from reaching the desk to the first contact attempt'
          : backlog
            ? 'How long this lead has been waiting on the desk. Imported and backfilled leads carry no response deadline.'
            : 'Waiting for the first call, WhatsApp or email'
      }
    >
      <Icon size={12} className={live.level === 'breached' ? 'animate-pulse' : undefined} />
      {variant === 'full' || backlog ? label : formatDuration(live.seconds)}
    </span>
  )
}
