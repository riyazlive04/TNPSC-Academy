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
    <div className={`flex items-stretch ${className}`}>
      {items.map((s, i) => (
        <div
          key={i}
          className={[
            'flex-1',
            i > 0 ? 'border-l border-line pl-4' : '',
            i < items.length - 1 ? 'pr-4' : '',
          ].join(' ')}
        >
          <div
            className={`font-display text-2xl font-bold leading-none ${
              s.accent ? 'text-accent' : 'text-ink'
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
