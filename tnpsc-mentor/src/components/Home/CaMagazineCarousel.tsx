import { useEffect, useRef, useState } from 'react'
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
 * The strip scrolls itself right-to-left forever: the card set is rendered
 * twice and scrollLeft wraps at exactly one copy's width, so the loop never
 * visibly restarts.
 *
 * The motion is driven by rAF on scrollLeft rather than a CSS animation on
 * purpose — index.css force-disables every CSS animation under
 * prefers-reduced-motion (`animation-duration: .001ms !important`), which
 * silently killed the marquee for anyone with OS animation effects switched
 * off. Scrolling the container sidesteps that, keeps the strip swipeable by
 * hand, and lets us pause cleanly on hover/touch so a moving card stays easy
 * to tap.
 *
 * Renders nothing until at least one daily issue is live.
 */

// Module-level cache so navigating away and back doesn't refetch/flash.
let cache: CaRecentIssue[] | null = null

/** Ticker speed, px/second — slow enough to read and tap. */
const SCROLL_PX_PER_SEC = 34
/** Cards one copy must contain to overflow the widest dashboard column. */
const MIN_CARDS_PER_COPY = 6

export default function CaMagazineCarousel() {
  const { t, lang } = useT()
  const [issues, setIssues] = useState<CaRecentIssue[] | null>(cache)
  const [active, setActive] = useState<CaRecentIssue | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

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

  // The ticker.
  //
  // Position is accumulated as a float rather than read back off scrollLeft each
  // frame: browsers round scrollLeft to whole pixels, so feeding the rounded
  // value back in makes every sub-pixel step round up to a full pixel — the
  // strip then moves 1px/frame (i.e. at the display's refresh rate, twice as
  // fast on a 120Hz screen) instead of the speed asked for. Writing an
  // accumulated float keeps it time-based and refresh-rate independent.
  const hasIssues = !!issues?.length
  useEffect(() => {
    if (!hasIssues || active) return // pause entirely while the reader is open
    let raf = 0
    let last = performance.now()
    let pos = trackRef.current?.scrollLeft ?? 0
    let written = pos
    const tick = (now: number) => {
      // Clamp dt so returning to a backgrounded tab doesn't jump the strip.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const el = trackRef.current
      if (el && !pausedRef.current) {
        // Someone else moved the scroller (a manual swipe) — adopt their position.
        if (Math.abs(el.scrollLeft - written) > 1) pos = el.scrollLeft
        const half = el.scrollWidth / 2
        if (half > 0) {
          pos += SCROLL_PX_PER_SEC * dt
          if (pos >= half) pos -= half // wrap onto the identical second copy
          el.scrollLeft = pos
          written = el.scrollLeft // what the browser actually stored (rounded)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasIssues, active])

  if (!issues || issues.length === 0) return null

  const card = (m: CaRecentIssue, key: string, decorative = false) => (
    <button
      key={key}
      onClick={() => setActive(m)}
      aria-hidden={decorative}
      tabIndex={decorative ? -1 : undefined}
      // mr-3 (not a flex gap) so every card contributes an identical width —
      // the wrap point depends on both copies measuring exactly the same.
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
            draggable={false}
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
  // duplicate that copy — the ticker wraps across exactly one copy's width.
  const reps = Math.max(1, Math.ceil(MIN_CARDS_PER_COPY / issues.length))
  const copy = Array.from({ length: reps }, () => issues).flat()

  const pause = () => {
    pausedRef.current = true
  }
  const resume = () => {
    pausedRef.current = false
  }

  return (
    <section className="space-y-3">
      <SectionHeader title={t('caCarouselTitle')} className="px-1" />

      <div
        ref={trackRef}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
        className="-mx-4 flex overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {copy.map((m, i) => card(m, `a-${m.id}-${i}`))}
        {copy.map((m, i) => card(m, `b-${m.id}-${i}`, true))}
      </div>

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
