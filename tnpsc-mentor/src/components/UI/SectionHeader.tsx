import type { ReactNode } from 'react'

// ─── SectionHeader ──────────────────────────────────────────────────────────
// Groups content with a type label + whitespace instead of a card box
// (design-system.md: "Grouping via space + section labels + hairline"). The
// optional action is the only place coral appears here — a "See all"-style link.

export default function SectionHeader({
  title,
  action,
  className = '',
}: {
  title: ReactNode
  action?: { label: ReactNode; onClick: () => void }
  className?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <h2 className="tamil font-display text-[15px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="tamil focus-ring rounded-md font-body text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
