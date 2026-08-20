import { TrendingUp, Target, CheckCircle2, RotateCcw } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { RevisionAnalytics } from '../../types'

/** Pure-logic revision dashboard: progress ring + stat tiles + focus lists. */
export default function RevisionAnalyticsPanel({ data }: { data: RevisionAnalytics }) {
  const { t } = useT()
  const pct = data.total > 0 ? Math.round((data.cleared / data.total) * 100) : 0

  return (
    <section className="rounded-card border border-line bg-card p-5">
      <h2 className="tamil mb-4 font-heading text-sm font-bold uppercase tracking-wide text-ink2">
        {t('revAnalyticsTitle')}
      </h2>

      <div className="flex items-center gap-5">
        <ProgressRing percent={pct} />
        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={<CheckCircle2 size={15} />} label={t('revStatCleared')} value={data.cleared} tone="mint" />
          <Stat icon={<RotateCcw size={15} />} label={t('revStatPending')} value={data.pending} tone="gold" />
          <Stat icon={<Target size={15} />} label={t('revStatReady')} value={data.available_now} tone="sky" />
          <Stat
            icon={<TrendingUp size={15} />}
            label={t('revStatImprovement')}
            value={`${data.improvement >= 0 ? '+' : ''}${data.improvement}%`}
            tone={data.improvement >= 0 ? 'mint' : 'gold'}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-body text-xs text-muted">
        <span>
          {t('revStatAvgScore')}: <b className="text-ink">{data.avg_last_score}%</b>
        </span>
        <span>
          {t('revStatAttempts')}: <b className="text-ink">{data.total_attempts}</b>
        </span>
      </div>

      {data.by_subject.length > 0 && (
        <div className="mt-5">
          <h3 className="tamil mb-2 font-heading text-xs font-semibold text-ink2">{t('revFocusSubjects')}</h3>
          <div className="space-y-2">
            {data.by_subject.slice(0, 5).map((s) => (
              <div key={s.subject} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate font-body text-xs text-ink" title={s.subject}>
                  {s.subject}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${Math.max(6, Math.min(100, s.avg_score))}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-body text-xs tabular-nums text-ink2">
                  {s.avg_score}% · {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const off = c - (percent / 100) * c
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width="76" height="76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} className="fill-none stroke-line" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          className="fill-none stroke-mint transition-[stroke-dashoffset] duration-700"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <span className="absolute font-heading text-sm font-bold text-ink">{percent}%</span>
    </div>
  )
}

const TONES: Record<string, string> = {
  mint: 'text-mint',
  gold: 'text-gold',
  sky: 'text-sky',
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone: keyof typeof TONES | string
}) {
  return (
    <div className="rounded-xl border border-line bg-tint px-3 py-2.5">
      <span className={`flex items-center gap-1.5 ${TONES[tone] ?? 'text-ink2'}`}>{icon}</span>
      <p className="mt-1 font-heading text-lg font-bold leading-none text-ink tabular-nums">{value}</p>
      <p className="tamil mt-0.5 font-body text-2xs text-muted">{label}</p>
    </div>
  )
}
