import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Returns a back handler that steps to the immediately previous screen in the
 * navigation stack — the same in-app history the hardware/browser back button
 * uses (see BackButtonGuard) — instead of jumping to a hardcoded destination.
 * This keeps every drill-down flow (PYQ → group → section, Subject → topic →
 * type, …) reversible one step at a time.
 *
 * `fallback` is used *only* when there is no prior in-app entry to return to —
 * e.g. the page was opened directly via a deep link or a fresh tab — so back
 * never dead-ends or escapes the app. It defaults to the Test Arena hub.
 */
export function useSmartBack(fallback = '/test-arena') {
  const navigate = useNavigate()
  return useCallback(() => {
    // react-router-dom v6 stores an incrementing `idx` on history.state; idx > 0
    // means a previous in-app entry exists that navigate(-1) can return to.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
