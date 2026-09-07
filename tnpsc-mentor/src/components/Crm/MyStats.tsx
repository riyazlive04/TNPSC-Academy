import { useEffect, useState } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDuration, type CrmAgentDay } from '../../lib/crm'

/**
 * The agent's own recent days.
 *
 * The header already shows today's numbers, but "am I doing better or worse
 * than yesterday" was unanswerable from the desk — `/api/crm/stats` served it
 * and nothing consumed it. Collapsed by default: it is a check-in, not
 * something to stare at while working a queue.
 *
 * A telecaller only ever gets their own rows back; the RPC enforces that
 * server-side regardless of what this asks for.
 */
export default function MyStats() {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<CrmAgentDay[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    setLoading(true)
    api.crm
      .stats({ days: 7 })
      .then(setDays)
      .catch(() => {
        /* the desk works without it; no alarm mid-shift */
      })
      .finally(() => {
        setLoading(false)
        setLoaded(true)
      })
  }, [open, loaded])

  const peak = Math.max(1, ...days.map((d) => d.calls))

  return (
    <section className="mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn btn-sm btn-ghost px-3 py-2 text-xs"
      >
        <BarChart3 size={14} />
        My last 7 days
      </button>

      {open && (
        <div className="card mt-2 p-3 animate-fadeInFast">
          {loading ? (
            <div className="grid place-items-center py-6">
              <Loader2 size={18} className="animate-spin text-ink2" />
            </div>
          ) : days.length === 0 ? (
            <p className="py-4 text-center font-body text-xs text-ink2">
              Nothing logged in the last week yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {days.map((d) => (
                <li key={d.day_ist} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-body text-2xs text-ink2">
                    {new Date(d.day_ist).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{ width: `${Math.round((d.calls / peak) * 100)}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right font-body text-2xs tabular-nums text-ink2">
                    <span className="font-heading font-semibold text-ink">{d.calls}</span> calls ·{' '}
                    {d.conversions} won
                  </span>
                </li>
              ))}
            </ul>
          )}

          {days.length > 0 && (
            <p className="mt-3 border-t border-line pt-2 font-body text-2xs text-ink2">
              {days.reduce((n, d) => n + d.calls, 0)} calls ·{' '}
              {days.reduce((n, d) => n + d.outcomes, 0)} logged ·{' '}
              {days.reduce((n, d) => n + d.conversions, 0)} converted
              {days[0]?.avg_response_secs != null &&
                ` · ${formatDuration(days[0].avg_response_secs)} avg response`}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
