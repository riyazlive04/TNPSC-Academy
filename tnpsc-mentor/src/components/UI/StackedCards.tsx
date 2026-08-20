import { Children, useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

// Clears the sticky app header (~60-70px + safe-area inset) with room to spare.
const STICKY_TOP_PX = 80
// Each card sticks a little lower than the one before it, so the stack still
// shows a sliver of every earlier card underneath - a fanned-deck look rather
// than a single flat overlap.
const STAGGER_PX = 14

/**
 * One card in the stack. Sticks near the top of the viewport as the user
 * scrolls past it; the next card (higher z-index, later in the DOM) then
 * scrolls up and over it. While that happens, THIS card scales down and
 * fades slightly - the animated "comes out from under/behind the previous
 * card" effect - driven by how far its own scroll region has progressed.
 * The last card in the stack never shrinks (nothing ever covers it).
 */
function StackedCard({
  index,
  isLast,
  children,
}: {
  index: number
  isLast: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    // Progress runs from the moment this card's top pins under the header
    // to the moment its bottom reaches that same point (i.e. it's fully
    // covered by whatever scrolls up next).
    offset: ['start start', 'end start'],
  })
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.93])
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.55])

  return (
    <div
      ref={ref}
      className="sticky pb-4"
      style={{ top: STICKY_TOP_PX + index * STAGGER_PX, zIndex: index + 1 }}
    >
      <motion.div
        className="origin-top"
        style={isLast || reduceMotion ? undefined : { scale, opacity }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * Wraps a set of cards (e.g. the Profile plan cards) so they stack on scroll:
 * each sticks in turn, and the next slides up from underneath it. Cards that
 * self-hide (return null, e.g. a plan already owned) just leave an empty,
 * harmless slot in the stack. Purely presentational - pass plain children.
 */
export default function StackedCards({ children }: { children: ReactNode }) {
  const items = Children.toArray(children)
  return (
    <div className="relative">
      {items.map((child, i) => (
        <StackedCard key={i} index={i} isLast={i === items.length - 1}>
          {child}
        </StackedCard>
      ))}
    </div>
  )
}
