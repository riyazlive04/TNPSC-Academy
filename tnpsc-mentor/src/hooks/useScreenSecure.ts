import { useEffect } from 'react'
import { enableScreenSecure, disableScreenSecure } from '../lib/screenSecure'

/**
 * Block OS screenshots / screen recording for as long as `active` is true, then
 * release on change or unmount. Used by the test screens so capture is disabled
 * only while a test is in progress (native app only; no-op on the web).
 */
export function useScreenSecure(active: boolean): void {
  useEffect(() => {
    if (!active) return
    void enableScreenSecure()
    return () => {
      void disableScreenSecure()
    }
  }, [active])
}
