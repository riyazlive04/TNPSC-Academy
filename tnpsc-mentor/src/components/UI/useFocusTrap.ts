import { useEffect, type RefObject } from 'react'

/** Selector for the elements that can receive keyboard focus inside a dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal focus management. While `active`, Tab/Shift+Tab are kept
 * inside `containerRef`, initial focus moves into the dialog, and the previously
 * focused element is restored when the trap deactivates (modal closes). Used by
 * every dialog component to avoid duplicating this a11y plumbing.
 */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    // Remember who had focus so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )

    // Move focus into the dialog (first focusable, else the container itself).
    const first = focusables()[0]
    if (first) first.focus()
    else container.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        container.focus()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === firstEl || !container.contains(activeEl)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else if (activeEl === lastEl || !container.contains(activeEl)) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Restore focus to where it was before the modal opened.
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef])
}
