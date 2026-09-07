import { useEffect, useRef, useState } from 'react'
import { Circle, MessageSquareText, Pause, Play, Radio } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { api, type CrmActivityItem } from '../../lib/api'
import { startPolling } from '../../lib/poll'
import {
  INTENT_CLASS,
  STATUS_CLASS,
  STATUS_LABEL,
  formatPhone,
  relativeTime,
  type CrmPipelineMetrics,
  type IntentBreakdown,
  type LeadStatus,
} from '../../lib/crm'

/** How often the console asks what's changed. Matches the desk's own arrival
 *  poll — a supervisor watching a shift and the agent working it should not be
 *  looking at boards that disagree by more than a few seconds. */
const LIVE_POLL_MS = 10_000

/** Cap on the feed held in memory: a busy afternoon would otherwise grow an
 *  unbounded list in a tab nobody reloads. */
const MAX_FEED = 120

interface CrmLiveAnswersProps {
  /** Latest pipeline snapshot, refreshed by the parent on the same tick. */
  metrics: CrmPipelineMetrics
  /** Lets the parent's own counters refresh alongside the feed. */
  onTick: () => void
}

/**
 * What the leads are saying, live.
 *
 * Two views of the same thing: the breakdown is the standing distribution of
 * answers across every lead, and the feed is each answer arriving as a
 * telecaller records it. A supervisor watching a shift wants both — the shape
 * of the day, and the thing that just happened.
 *
 * Polled rather than pushed, like everything else in this app: `startPolling`
 * stops dead on a hidden tab, and the endpoint is incremental (it asks only for
 * rows newer than the newest one already held), so a console left open all
 * afternoon costs almost nothing.
 */
export default function CrmLiveAnswers({ metrics, onTick }: CrmLiveAnswersProps) {
  const [feed, setFeed] = useState<CrmActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)
  const [flash, setFlash] = useState<Set<string>>(new Set())
  // The newest timestamp already held — the cursor the poll asks from. In a ref
  // because the polling closure is created once and must not capture a stale one.
  const cursor = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!live) return

    let cancelled = false
    const tick = async () => {
      try {
        const { activity } = await api.crm.activity({ since: cursor.current, limit: 40 })
        if (cancelled || activity.length === 0) return

        cursor.current = activity[0].created_at
        setFeed((prev) => {
          // The cursor makes duplicates unlikely, but a row committed on the
          // boundary of two polls can still repeat — dedupe by id rather than
          // trusting the timestamp.
          const seen = new Set(prev.map((i) => i.id))
          const fresh = activity.filter((i) => !seen.has(i.id))
          if (fresh.length === 0) return prev
          return [...fresh, ...prev].slice(0, MAX_FEED)
        })
        // Highlight what just landed, so a supervisor glancing over sees which
        // rows are new rather than having to re-read the whole list.
        setFlash(new Set(activity.map((i) => i.id)))
        window.setTimeout(() => !cancelled && setFlash(new Set()), 2200)
      } catch {
        /* a blip: keep the cursor, the next tick catches up */
      } finally {
        if (!cancelled) setLoading(false)
      }
      onTick()
    }

    const stop = startPolling(() => void tick(), LIVE_POLL_MS)
    return () => {
      cancelled = true
      stop()
    }
  }, [live, onTick])

  const intents = (metrics.by_intent ?? []).filter((i) => i.leads > 0 || i.logged_today > 0)
  const totalAnswered = intents.reduce((n, i) => n + i.leads, 0)

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-sm font-semibold text-ink">What leads are saying</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-heading text-2xs font-semibold ${
            live ? 'bg-mintsoft text-correct' : 'bg-tint text-ink2'
          }`}
        >
          <Circle size={8} className={live ? 'animate-pulse fill-current' : 'fill-current'} />
          {live ? 'Live' : 'Paused'}
        </span>
        <button
          onClick={() => setLive((v) => !v)}
          className="btn btn-sm btn-ghost ml-auto px-3 py-1.5 text-xs"
        >
          {live ? <Pause size={13} /> : <Play size={13} />}
          {live ? 'Pause' : 'Resume'}
        </button>
      </header>

      {/* ─── Standing distribution ──────────────────────────────────────── */}
      {intents.length === 0 ? (
        <p className="card p-6 text-center font-body text-sm text-ink2">
          No answers recorded yet. Categories appear here as telecallers log calls.
        </p>
      ) : (
        <div className="card divide-y divide-line p-0">
          {intents.map((i) => (
            <AnswerRow key={i.id} intent={i} total={totalAnswered} />
          ))}
        </div>
      )}

      {/* ─── The feed ───────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Radio size={14} className="text-ink2" />
          <h4 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
            As it happens
          </h4>
          {metrics.logged_today != null && (
            <span className="font-body text-2xs text-ink2">
              {metrics.logged_today} logged today
            </span>
          )}
        </div>

        {loading ? (
          <Spinner className="mx-auto my-8" />
        ) : feed.length === 0 ? (
          <p className="card p-6 text-center font-body text-sm text-ink2">
            Nothing logged yet. New answers appear here within a few seconds of an agent
            recording them.
          </p>
        ) : (
          <ol className="space-y-2">
            {feed.map((item) => (
              <li
                key={item.id}
                className={`card flex flex-wrap items-start gap-2.5 p-3 transition-colors duration-700 ${
                  flash.has(item.id) ? 'bg-tint-violet' : ''
                }`}
              >
                <MessageSquareText size={15} className="mt-0.5 shrink-0 text-ink2" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-heading text-xs font-semibold text-ink">
                      {item.lead_name?.trim() || formatPhone(item.lead_phone) || 'Unnamed lead'}
                    </span>
                    {item.intent_label && (
                      <span
                        className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${
                          INTENT_CLASS[item.intent_color ?? 'slate']
                        }`}
                      >
                        {item.intent_label}
                      </span>
                    )}
                    {item.status_after && STATUS_LABEL[item.status_after as LeadStatus] && (
                      <span
                        className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${
                          STATUS_CLASS[item.status_after as LeadStatus]
                        }`}
                      >
                        {STATUS_LABEL[item.status_after as LeadStatus]}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="mt-1 line-clamp-2 font-body text-xs text-ink">{item.notes}</p>
                  )}
                  <p className="mt-0.5 font-body text-2xs text-ink2">
                    {item.agent_name ?? 'An agent'} · {relativeTime(item.created_at, Date.now())}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** One answer category as a proportion bar — the share of answered leads that
 *  gave this reply, with today's count called out beside it. */
function AnswerRow({ intent, total }: { intent: IntentBreakdown; total: number }) {
  const pct = total > 0 ? Math.round((intent.leads / total) * 100) : 0
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-pill px-2.5 py-0.5 font-heading text-2xs font-semibold ${
            INTENT_CLASS[intent.color]
          }`}
        >
          {intent.label}
        </span>
        {!intent.active && (
          <span className="font-body text-2xs text-ink2">retired</span>
        )}
        <span className="ml-auto font-display text-sm font-bold tabular-nums text-ink">
          {intent.leads}
        </span>
        <span className="w-10 text-right font-body text-2xs tabular-nums text-ink2">{pct}%</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {intent.logged_today > 0 && (
          <span className="shrink-0 font-body text-2xs text-ink2">
            +{intent.logged_today} today
          </span>
        )}
      </div>
    </div>
  )
}
