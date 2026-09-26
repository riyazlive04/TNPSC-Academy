import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'

/**
 * Public answer-key pages are simple, blog-style utility pages meant to
 * always read as plain white, independent of a visitor's OS/browser
 * dark-mode preference. The app-wide theme store defaults to 'system' and
 * toggles a `.dark` class on <html> (see store/themeStore.ts) — including a
 * live OS-level listener, plus App's own theme-init effect, which can both
 * re-add `.dark` after this page's own effect has stripped it once. A
 * MutationObserver keeps removing it for as long as the page is mounted;
 * unmounting restores whatever the visitor's real preference resolves to.
 */
export function useForceLightTheme(): void {
  useEffect(() => {
    const root = document.documentElement
    const strip = () => {
      if (root.classList.contains('dark')) root.classList.remove('dark')
      if (root.style.colorScheme !== 'light') root.style.colorScheme = 'light'
    }
    strip()
    const observer = new MutationObserver(strip)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => {
      observer.disconnect()
      useThemeStore.getState().init()
    }
  }, [])
}
