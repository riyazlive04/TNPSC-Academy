import { useT } from '../../lib/i18n'

// ─── Skeleton loaders ───────────────────────────────────────────────────────
// Content-shaped placeholders that hold the layout while data is in flight, so
// a screen never collapses to a centred spinner and then jumps. Each preset
// mirrors a real component of the design system 1:1 - same tile sizes, same
// gaps, same grid - so the swap to real content is a fade, not a re-flow.
//
// Where they DON'T belong: the app boot / route-chunk fallback and the quiz
// start (App PageLoader, ProtectedRoute, QuizPage, MockQuizPage). Those are
// brand moments with no known content shape - LogoLoader stays there.
//
// The `.skeleton` class (index.css) carries the tone + shimmer and is
// theme-aware; everything here is layout only.

/** The atom: one shimmering block. Size it with Tailwind classes. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block skeleton ${className}`} />
}

/**
 * Screen-reader wrapper every preset uses: one polite "loading" announcement
 * for the whole block instead of dozens of meaningless nodes.
 */
function Busy({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { t } = useT()
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t('loading')}</span>
      {children}
    </div>
  )
}

/** A paragraph of shimmering lines; the last one is short, like real text. */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <Busy className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </Busy>
  )
}

/**
 * The 2-up card grid used by every chooser (PYQ groups/sections, subjects,
 * topics, question types). Mirrors ChoiceGrid + ChoiceCard: a 56px icon tile,
 * a title line and a count line inside a bordered card.
 */
export function SkeletonChoiceGrid({
  count = 6,
  className = '',
}: {
  count?: number
  className?: string
}) {
  return (
    <Busy className={`grid grid-cols-2 gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex h-full flex-col items-start gap-2.5 rounded-card border border-line bg-card p-3.5 shadow-soft"
        >
          <Skeleton className="h-14 w-14 rounded-tile" />
          <span className="w-full">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="mt-2 h-2.5 w-1/2" />
          </span>
        </div>
      ))}
    </Busy>
  )
}

/**
 * The hairline row list (materials, revision decks, mock papers, bookmarks).
 * Mirrors List + ListRow: optional leading tile, title + subtitle, trailing
 * chevron slot. Rows are separated by the same divide-y hairline.
 */
export function SkeletonList({
  rows = 5,
  leading = true,
  subtitle = true,
  className = '',
}: {
  rows?: number
  /** Draw the leading IconTile placeholder (set false for plain rows). */
  leading?: boolean
  subtitle?: boolean
  className?: string
}) {
  return (
    <Busy className={`divide-y divide-line ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-3 py-3">
          {leading && <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />}
          <span className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-3/5" />
            {subtitle && <Skeleton className="mt-2 h-2.5 w-2/5" />}
          </span>
          <Skeleton className="h-4 w-4 flex-shrink-0 rounded-full" />
        </div>
      ))}
    </Busy>
  )
}

/**
 * Card blocks (papers, materials, saved questions, magazine issues). Stacks by
 * default; pass the page's own grid classes as `className` to match a grid.
 */
export function SkeletonCards({
  count = 3,
  height = 'h-24',
  className = 'space-y-3',
}: {
  count?: number
  /** Tailwind height of each card block. */
  height?: string
  /** Container layout. Defaults to a vertical stack. */
  className?: string
}) {
  return (
    <Busy className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`w-full rounded-card ${height}`} />
      ))}
    </Busy>
  )
}

/**
 * The centred wrapping pill row (subject / topic / year selectors). Widths
 * alternate so the row reads as words rather than a barcode.
 */
export function SkeletonPills({
  count = 8,
  className = '',
}: {
  count?: number
  className?: string
}) {
  const widths = ['w-20', 'w-28', 'w-24', 'w-16', 'w-32', 'w-24']
  return (
    <Busy className={`flex flex-wrap justify-center gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`h-9 rounded-pill ${widths[i % widths.length]}`} />
      ))}
    </Busy>
  )
}

/** The stat-card grid (profile overview, insights headline numbers). */
export function SkeletonStatGrid({
  count = 6,
  className = 'grid-cols-2 sm:grid-cols-3',
}: {
  count?: number
  /** Column classes; defaults to the profile/insights 2-up → 3-up grid. */
  className?: string
}) {
  return (
    <Busy className={`grid gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-line bg-card p-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="mt-3 h-5 w-1/2" />
          <Skeleton className="mt-2 h-2.5 w-3/4" />
        </div>
      ))}
    </Busy>
  )
}

/**
 * The analytics screen: the accuracy-ring hero panel above its stat grid.
 * Used by Insights and the Test Marathon analytics tab.
 */
export function SkeletonAnalytics({ className = '' }: { className?: string }) {
  return (
    <Busy className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 items-center gap-6 rounded-card border border-line bg-card p-6 sm:grid-cols-[auto,1fr] sm:p-7">
        <Skeleton className="mx-auto h-32 w-32 rounded-full sm:mx-0" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-tile border border-line p-3">
              <Skeleton className="h-2.5 w-2/3" />
              <Skeleton className="mt-2 h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-card border border-line bg-card p-5">
        <Skeleton className="h-3.5 w-1/3" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-28 flex-shrink-0" />
              <Skeleton className="h-3 flex-1 rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  )
}
