import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Resets scroll to the top on every route change. Without this, navigating from
 * a long page (e.g. a 50-question result) to another lands the new page scrolled
 * partway down — a common SPA papercut, especially on phones.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
