import type { ReactNode } from 'react'

// ─── StatStrip ──────────────────────────────────────────────────────────────
// An inline run of metrics separated by hairline dividers - replaces the row of
// little metric boxes (design-system.md Home: "an inline stat strip … separated
// by hairlines, no metric boxes"). Coral is reserved for the one number that
// matters (e.g. the streak), via `accent`.

export interface Stat {
  label: ReactNode
  value: ReactNode
  accent?: boolean
}

export default function StatStrip({
  items,
  className = '',
}: {
  items: Stat[]
  className?: string
}) {
  return (
    // web: the archive's `.stats` pills; native keeps hairline-separated metrics.
    <div className={`flex items-stretch web:flex-wrap web:gap-2.5 ${className}`}>
      {items.map((s, i) => (
        <div
          key={i}
          className={[
            'flex-1',
            i > 0 ? 'border-l border-line pl-4' : '',
            i < items.length - 1 ? 'pr-4' : '',
            'web:flex-none web:rounded-field web:border web:border-line web:bg-card web:px-4 web:py-2.5 web:shadow-pill',
          ].join(' ')}
        >
          <div
            className={`font-display text-2xl font-bold leading-none web:text-xl web:font-extrabold ${
              s.accent ? 'text-accent' : 'text-ink web:text-brand'
            }`}
          >
            {s.value}
          </div>
          <div className="tamil mt-2 font-body text-sm leading-snug text-muted">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
