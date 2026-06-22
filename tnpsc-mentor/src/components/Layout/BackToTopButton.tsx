import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useT } from '../../lib/i18n'

/**
 * Floating "back to top" button. The admin and superadmin consoles are long,
 * tab-driven pages (user lists, coupons, reported questions) with no quick way
 * back to the header once you've scrolled - this surfaces a thumb-reachable
 * jump-to-top once the page is scrolled past a screenful.
 *
 * The page scrolls on the window (see AppLayout's plain `<main>`), so we listen
 * on window scroll and call window.scrollTo. The global `scroll-behavior: smooth`
 * (index.css) animates the jump; prefers-reduced-motion users get an instant one.
 */
export default function BackToTopButton() {
  const { t } = useT()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll() // sync initial state (e.g. when mounted already scrolled)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, left: 0 })}
      aria-label={t('backToTop')}
      title={t('backToTop')}
      // Sits above the mobile bottom nav (z-30, ~4rem tall) and clear of the
      // home-indicator safe area; tucks into the corner on desktop where the
      // bottom bar is hidden.
      className="press focus-ring fixed right-4 z-40 grid h-12 w-12 place-items-center
        rounded-full bg-brand-gradient text-white shadow-brand animate-fadeIn
        bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-8 lg:right-8"
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  )
}
