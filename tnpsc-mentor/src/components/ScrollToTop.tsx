import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Resets scroll to the top on every route change. Without this, navigating from
 * a long page (e.g. a 50-question result) to another lands the new page scrolled
 * partway down - a common SPA papercut, especially on phones.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Explicit 'auto' so the global `scroll-behavior: smooth` (index.css) doesn't
    // turn each route change into a slow animated scroll-to-top - navigation
    // should be instant; only in-page jumps animate.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}
