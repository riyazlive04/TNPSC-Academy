import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { frame, cancelFrame } from 'motion'

// Routes that run their own immersive scroll behaviour - the proctored quiz and
// mock engines go fullscreen and track scroll for the per-question view, so we
// leave native scrolling in place there rather than risk Lenis fighting it.
const IMMERSIVE_PATHS = ['/quiz', '/mock/quiz']

/**
 * App-wide inertial smooth scrolling (Lenis). Mounted once near the router root.
 *
 * - Disabled on the immersive quiz/mock routes (fullscreen + proctoring).
 * - Disabled for users who prefer reduced motion.
 * - Re-syncs to the top on navigation so it stays aligned with <ScrollToTop>.
 */
export default function SmoothScroll() {
  const { pathname } = useLocation()
  const immersive = IMMERSIVE_PATHS.includes(pathname)
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (immersive || reduceMotion) return

    const lenis = new Lenis({
      duration: 1.05, // weight of the inertia - higher = more glide
      smoothWheel: true,
      touchMultiplier: 1.6,
    })
    lenisRef.current = lenis

    // Drive Lenis from Motion's own frame scheduler instead of a separate raw
    // requestAnimationFrame loop. Two independent rAF loops (Lenis's + every
    // scroll-linked useScroll()/useTransform() in the app) can land on
    // different frames, so a stacked-card banner reads a scroll position
    // that's a tick behind Lenis's smoothed one - the "not moving fluidly"
    // stutter. Ticking Lenis inside Motion's "update" step keeps both in the
    // same frame, so scroll-linked transforms always see the current value.
    const update = ({ timestamp }: { timestamp: number }) => lenis.raf(timestamp)
    frame.update(update, true)

    return () => {
      cancelFrame(update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [immersive])

  // On navigation, jump to the top through Lenis (when active) so its internal
  // position matches the freshly-rendered page.
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true })
  }, [pathname])

  return null
}
