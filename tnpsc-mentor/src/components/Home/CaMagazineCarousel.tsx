import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Newspaper } from 'lucide-react'
import { api, type CaRecentIssue } from '../../lib/api'
import { issueDateLabel, magazineName } from '../../lib/caMagazine'
import MagazineReader from '../Materials/MagazineReader'
import SectionHeader from '../UI/SectionHeader'
import { useT } from '../../lib/i18n'

/**
 * Dashboard carousel of the most recent daily Current-Affairs issues — the last
 * 7 the superadmin has published. Each card leads with that day's news image
 * from the pipeline's private bucket (signed server-side and returned with the
 * list, so the whole strip costs ONE request).
 *
 * The strip is a continuously looping right-to-left ticker: the card set is
 * rendered twice and the track animates to -50%, so the second copy lands
 * exactly where the first began and the loop never visibly restarts. It pauses
 * on hover/touch so a moving card is still easy to tap, and falls back to a
 * plain swipeable row when the user prefers reduced motion.
 *
 * Renders nothing until at least one daily issue is live.
 */

// Module-level cache so navigating away and back doesn't refetch/flash.
let cache: CaRecentIssue[] | null = null

/** Seconds each card spends crossing the strip — sets the ticker's pace. */
const SECONDS_PER_CARD = 4
/** Cards one copy must contain to overflow the widest dashboard column. */
const MIN_CARDS_PER_COPY = 6

export default function CaMagazineCarousel() {
  const { t, lang } = useT()
  const reduce = useReducedMotion()
  const [issues, setIssues] = useState<CaRecentIssue[] | null>(cache)
  const [active, setActive] = useState<CaRecentIssue | null>(null)

  useEffect(() => {
    let cancelled = false
    api.caMagazine
      .recent(7)
      .then((list) => {
        cache = list
        if (!cancelled) setIssues(list)
      })
      .catch(() => {
        // Decorative dashboard strip — stay silent on failure (the Materials tab
        // is the reliable path) rather than erroring on the home page.
        if (!cancelled) setIssues([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!issues || issues.length === 0) return null

  const card = (m: CaRecentIssue, key: string, decorative = false) => (
    <button
      key={key}
      onClick={() => setActive(m)}
      aria-hidden={decorative}
      tabIndex={decorative ? -1 : undefined}
      // mr-3 (not a flex gap) so every card contributes an identical width —
      // the -50% seam depends on it.
      className="focus-ring group mr-3 w-40 flex-shrink-0 overflow-hidden rounded-card border border-line bg-card text-left transition-colors hover:border-brand/40"
    >
      {/* The day's news image — landscape 3:2, matching the ~1.2–1.6 ratios the
          pipeline emits so cropping stays minimal. Falls back to the mark when
          there's no image for that date. */}
      <span className="block aspect-[3/2] w-full overflow-hidden bg-tint-violet">
        {m.newsImage ? (
          <img
            src={m.newsImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-primary">
            <Newspaper size={26} />
          </span>
        )}
      </span>
      <span className="block p-3">
        <span className="tamil block truncate font-heading text-sm font-semibold leading-snug text-ink">
          {magazineName(lang)}
        </span>
        <span className="tamil mt-0.5 block truncate font-body text-xs text-ink2">
          {issueDateLabel('day_wise', m.date, lang)}
        </span>
      </span>
    </button>
  )

  // Repeat the set until one copy is wide enough to overflow the column, then
  // duplicate that copy — the ticker animates across exactly one copy's width.
  const reps = Math.max(1, Math.ceil(MIN_CARDS_PER_COPY / issues.length))
  const copy = Array.from({ length: reps }, () => issues).flat()
  const duration = copy.length * SECONDS_PER_CARD

  return (
    <section className="space-y-3">
      <SectionHeader title={t('caCarouselTitle')} className="px-1" />

      {reduce ? (
        // Reduced motion: no ticker — a plain swipeable row.
        <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {issues.map((m) => card(m, m.id))}
        </div>
      ) : (
        <div className="-mx-4 overflow-hidden px-4">
          <div
            className="flex w-max animate-marquee hover:[animation-play-state:paused] [&:has(:focus-visible)]:[animation-play-state:paused] active:[animation-play-state:paused]"
            style={{ animationDuration: `${duration}s` }}
          >
            {copy.map((m, i) => card(m, `a-${m.id}-${i}`))}
            {copy.map((m, i) => card(m, `b-${m.id}-${i}`, true))}
          </div>
        </div>
      )}

      {active && (
        <MagazineReader
          caType="day_wise"
          date={active.date}
          load={() => api.caMagazine.items(active.id)}
          loadNewsImage={() => api.caMagazine.newsImage(active.id)}
          onClose={() => setActive(null)}
          downloadable={active.downloadable}
        />
      )}
    </section>
  )
}
