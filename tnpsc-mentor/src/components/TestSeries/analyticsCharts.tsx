import { useState } from 'react'

// Hand-rolled SVG charts for the Test Marathon analytics tab. No charting
// dependency — thin marks, theme-aware via CSS-var fills (so light/dark just
// work), each with axes / direct value labels / a legend so identity and
// magnitude are never colour-alone.

/** Accuracy tone — traffic-light status encoding (labels always shown alongside). */
function toneVar(pct: number): string {
  if (pct >= 80) return 'var(--c-mint)'
  if (pct >= 50) return 'var(--c-gold)'
  return 'var(--c-coral)'
}
function toneText(pct: number): string {
  if (pct >= 80) return 'text-mint'
  if (pct >= 50) return 'text-gold'
  return 'text-coral'
}

// Fixed categorical order (validated: violet→sky→gold→mint→coral). Assigned by
// index, never cycled — with ≤5 question-type buckets we never run out.
const CAT = ['--c-brand', '--c-sky', '--c-gold', '--c-mint', '--c-coral']
const catFill = (i: number) => `rgb(var(${CAT[i % CAT.length]}))`

export interface TrendPoint {
  score: number
  date: string
  title: string
  detail: string
}

// ─── Score trend (line + area, y-axis, avg line, value labels, hover) ────────
export function ScoreTrendChart({ points, avgLabel }: { points: TrendPoint[]; avgLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 340
  const H = 184
  const padL = 22
  const padR = 12
  const padT = 16
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const single = points.length <= 1
  const x = (i: number) => (single ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW)
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH
  const pts = points.map((p, i) => ({ px: x(i), py: y(p.score), ...p }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].px.toFixed(1)},${padT + plotH} L${pts[0].px.toFixed(1)},${padT + plotH} Z`
  const avg = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length)
  // Show x-labels/value-labels for all points up to a density limit, else thin out.
  const step = Math.ceil(points.length / 7)
  const showLabel = (i: number) => i === pts.length - 1 || i % step === 0

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score per attempt">
        {/* y grid + labels */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="rgb(var(--c-line))" strokeWidth={1} />
            <text x={padL - 5} y={y(g) + 3} fontSize={8} textAnchor="end" fill="rgb(var(--c-ink2))">{g}</text>
          </g>
        ))}
        {/* average reference line */}
        {!single && (
          <>
            <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke="rgb(var(--c-ink2))" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
            <text x={W - padR} y={y(avg) - 3} fontSize={8} textAnchor="end" fill="rgb(var(--c-ink2))">{avgLabel} {avg}%</text>
          </>
        )}
        {!single && <path d={area} fill="rgb(var(--c-brand) / 0.13)" />}
        {!single && <path d={line} fill="none" stroke="rgb(var(--c-brand))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.px} cy={p.py} r={hover === i ? 5 : i === pts.length - 1 ? 4 : 3} fill="rgb(var(--c-brand))" stroke="rgb(var(--c-card))" strokeWidth={1.5} />
            {showLabel(i) && hover === null && (
              <text x={p.px} y={p.py - 8} fontSize={8.5} fontWeight={700} textAnchor="middle" fill="rgb(var(--c-brand))">{p.score}%</text>
            )}
            {showLabel(i) && (
              <text x={p.px} y={H - 16} fontSize={7.5} textAnchor="middle" fill="rgb(var(--c-ink2))">{p.date}</text>
            )}
            {/* wide invisible hit target for hover/tap */}
            <circle cx={p.px} cy={p.py} r={13} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} style={{ cursor: 'pointer' }} />
          </g>
        ))}
        {/* hover tooltip */}
        {hover !== null && (() => {
          const p = pts[hover]
          const w = 92
          const tx = Math.max(padL, Math.min(W - padR - w, p.px - w / 2))
          const ty = Math.max(2, p.py - 44)
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={w} height={34} rx={6} fill="rgb(var(--c-ink))" opacity={0.95} />
              <text x={tx + 8} y={ty + 13} fontSize={8.5} fontWeight={700} fill="#fff">{p.title} · {p.score}%</text>
              <text x={tx + 8} y={ty + 25} fontSize={7.5} fill="#fff" opacity={0.8}>{p.detail} · {p.date}</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ─── Subject accuracy (horizontal bars, weakest first, with an avg marker) ───
export interface SubjectRow {
  key: string
  accuracy: number
  correct: number
  attempted: number
  weak: boolean
}
export function SubjectBarChart({
  rows,
  avg,
  avgLabel,
  practiceLabel,
  onPractice,
}: {
  rows: SubjectRow[]
  avg: number
  avgLabel: string
  practiceLabel: string
  onPractice: (key: string) => void
}) {
  return (
    <div className="space-y-3">
      {avg > 0 && (
        <p className="text-right font-body text-[10px] text-ink2">
          <span className="mr-1 inline-block h-0 w-3 border-t border-dashed border-ink2/70 align-middle" />
          {avgLabel} {avg}%
        </p>
      )}
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="tamil min-w-0 truncate font-heading text-[13px] font-semibold text-ink">{r.key}</span>
            <span className={`shrink-0 font-display text-[13px] font-bold ${toneText(r.accuracy)}`}>{r.accuracy}%</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-tint">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, r.accuracy)}%`, backgroundColor: toneVar(r.accuracy) }} />
              {/* your-average marker */}
              {avg > 0 && (
                <span className="absolute top-0 h-full border-l border-dashed border-ink2/70" style={{ left: `${avg}%` }} />
              )}
            </div>
            <span className="shrink-0 font-body text-[10px] tabular-nums text-ink2">{r.correct}/{r.attempted}</span>
          </div>
          {r.weak && (
            <button onClick={() => onPractice(r.key)} className="mt-1 font-heading text-[11px] font-semibold text-primary transition-opacity hover:opacity-80">
              {practiceLabel} →
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Question-type composition (donut + count/share/accuracy legend) ─────────
export function QuestionTypeDonut({
  slices,
  centerTop,
  centerBottom,
}: {
  slices: { label: string; value: number; accuracy: number }[]
  centerTop: string
  centerBottom: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const R = 46
  const C = 2 * Math.PI * R
  const GAP = 3
  let acc = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label="Questions by type">
        <circle cx={60} cy={60} r={R} fill="none" stroke="rgb(var(--c-tint))" strokeWidth={14} />
        {slices.map((s, i) => {
          const frac = s.value / total
          const len = Math.max(0, frac * C - GAP)
          const offset = -acc * C
          acc += frac
          return (
            <circle key={s.label} cx={60} cy={60} r={R} fill="none" stroke={catFill(i)} strokeWidth={14} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={offset} strokeLinecap="butt">
              <title>{`${s.label}: ${s.value} (${Math.round(frac * 100)}%) · ${s.accuracy}% correct`}</title>
            </circle>
          )
        })}
        <g transform="rotate(90 60 60)">
          <text x={60} y={58} textAnchor="middle" fontSize={20} fontWeight={800} fill="rgb(var(--c-ink))">{centerTop}</text>
          <text x={60} y={72} textAnchor="middle" fontSize={8} fill="rgb(var(--c-ink2))" letterSpacing="0.5">{centerBottom}</text>
        </g>
      </svg>

      {/* Legend = the table view: swatch · name · count · share · accuracy. */}
      <div className="w-full min-w-0 space-y-1.5">
        {slices.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: catFill(i) }} />
            <span className="tamil min-w-0 flex-1 truncate font-heading text-[12px] font-semibold text-ink">{s.label}</span>
            <span className="w-8 shrink-0 text-right font-body text-[11px] tabular-nums text-ink2">{s.value}</span>
            <span className="w-9 shrink-0 text-right font-body text-[11px] tabular-nums text-ink2">{Math.round((s.value / total) * 100)}%</span>
            <span className={`w-9 shrink-0 text-right font-display text-[11px] font-bold tabular-nums ${toneText(s.accuracy)}`}>{s.accuracy}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
