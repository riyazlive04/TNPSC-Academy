import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Renders a Thirukkural couplet as its two metrical lines — line 1 (4 சீர்)
 * above line 2 (3 சீர்) — and auto-shrinks the font so each line always fits on
 * ONE line, whatever the container width. Kural lines vary a lot in length, so a
 * fixed responsive size can't guarantee the 4/3 structure holds on a narrow
 * phone; instead we measure the widest line and scale font-size to fit (capped
 * at `max`, floored at `min`). Scaling is proportional to scrollWidth, so it
 * settles in a single measurement pass and re-fits on resize.
 */
export default function Couplet({
  line1,
  line2,
  className = '',
  max = 16,
  min = 10,
}: {
  line1: string
  line2: string
  /** Styling for the couplet (font family/weight/colour/leading) — NOT size. */
  className?: string
  /** Font size (px) on a comfortably wide container. */
  max?: number
  /** Smallest font size (px) we'll shrink to before allowing a wrap. */
  min?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(max)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const avail = el.clientWidth
      if (!avail) return
      let widest = 0
      for (const child of Array.from(el.children)) {
        widest = Math.max(widest, (child as HTMLElement).scrollWidth)
      }
      if (!widest) return
      // scrollWidth ∝ font-size, so this one step lands on the fitting size.
      // The 0.98 keeps a hair of margin so subpixel rounding never clips.
      setSize((cur) => {
        const ideal = Math.min(max, Math.max(min, (cur * avail * 0.98) / widest))
        return Math.abs(ideal - cur) > 0.5 ? ideal : cur
      })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [line1, line2, max, min])

  return (
    <div ref={ref} className={className} style={{ fontSize: `${size}px` }}>
      <span className="block whitespace-nowrap">{line1}</span>
      <span className="block whitespace-nowrap">{line2}</span>
    </div>
  )
}
