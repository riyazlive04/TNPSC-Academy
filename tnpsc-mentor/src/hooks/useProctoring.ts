import { useCallback, useEffect, useRef, useState } from 'react'
import { enterFullscreen, fullscreenSupported, isFullscreen } from '../lib/proctor'
import { useT } from '../lib/i18n'

/** A logged exam-integrity event during a proctored quiz. */
export interface Violation {
  type: 'fullscreen_exit' | 'tab_switch' | 'copy_paste' | 'screenshot' | 'screen_record'
  at: number // ms since the test started
  questionIndex: number
}

/**
 * Classify a keystroke that triggers an OS/browser screen capture, so it can be
 * flagged and the captured clipboard wiped. Returns null for everything else.
 */
function screenCaptureType(e: KeyboardEvent): 'screenshot' | 'screen_record' | null {
  if (e.key === 'PrintScreen') return 'screenshot'
  const k = e.key.toLowerCase()
  // Screen-recording shortcuts: Win+Alt+R (Game Bar), Win+Shift+R.
  if (e.metaKey && (e.altKey || e.shiftKey) && k === 'r') return 'screen_record'
  // Screenshot shortcuts: Win+Shift+S (Snip), Ctrl+Shift+S, macOS Cmd+Shift+3/4/5.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['s', '3', '4', '5'].includes(k)) return 'screenshot'
  return null
}

/** Repeated violations auto-submit the test once this many are recorded. */
export const MAX_VIOLATIONS = 5

/**
 * Shared proctoring engine for any quiz screen. Enforces full-screen (where the
 * platform supports it), and treats exiting full-screen, switching tabs/windows,
 * and copy/paste/right-click as violations. Recording is paused until `active`
 * is true (so it doesn't fire during loading), and stops permanently once the
 * auto-submit threshold triggers `onAutoSubmit`.
 *
 * On phones without the Fullscreen API it degrades to visibility/blur
 * proctoring — see lib/proctor.ts. Extracted from the mock OMR engine so the
 * regular timed quiz can reuse the exact same enforcement.
 */
export function useProctoring(opts: {
  /** Attach listeners only when the quiz is actually running. */
  active: boolean
  /** Current question index, tagged onto each violation. */
  questionIndex: number
  /** Called once when the violation threshold is crossed. */
  onAutoSubmit: () => void
  maxViolations?: number
}) {
  const { active, questionIndex, onAutoSubmit, maxViolations = MAX_VIOLATIONS } = opts
  const { t } = useT()

  const fsSupported = useRef(fullscreenSupported()).current
  const [violations, setViolations] = useState<Violation[]>([])
  const [violationToast, setViolationToast] = useState('')
  const [notFullscreen, setNotFullscreen] = useState(false)

  const startedAtRef = useRef(Date.now())
  const doneRef = useRef(false) // stop recording after auto-submit
  const idxRef = useRef(questionIndex)
  idxRef.current = questionIndex
  const autoRef = useRef(onAutoSubmit)
  autoRef.current = onAutoSubmit

  const recordViolation = useCallback(
    (type: Violation['type']) => {
      if (doneRef.current) return
      setViolations((prev) => {
        const next = [
          ...prev,
          { type, at: Date.now() - startedAtRef.current, questionIndex: idxRef.current },
        ]
        setViolationToast(t('violationWarning'))
        window.setTimeout(() => setViolationToast(''), 4000)
        if (next.length >= maxViolations && !doneRef.current) {
          doneRef.current = true
          autoRef.current()
        }
        return next
      })
    },
    [t, maxViolations]
  )

  const reEnterFullscreen = useCallback(() => {
    void enterFullscreen()
  }, [])

  useEffect(() => {
    if (!active) return

    const onFsChange = () => {
      const fs = isFullscreen()
      setNotFullscreen(!fs)
      if (!fs) recordViolation('fullscreen_exit')
    }
    const onVisibility = () => {
      if (document.hidden) recordViolation('tab_switch')
    }
    const onBlur = () => recordViolation('tab_switch')
    const blockCopy = (e: Event) => {
      e.preventDefault()
      recordViolation('copy_paste')
    }
    const blockContext = (e: Event) => e.preventDefault()
    const blockKeys = (e: KeyboardEvent) => {
      const capture = screenCaptureType(e)
      if (capture) {
        e.preventDefault()
        navigator.clipboard?.writeText('').catch(() => {})
        recordViolation(capture)
        return
      }
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(k)) {
        e.preventDefault()
        recordViolation('copy_paste')
      }
    }
    // Windows' PrintScreen reports on keyup only — catch it there too.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {})
        recordViolation('screenshot')
      }
    }

    if (fsSupported) {
      document.addEventListener('fullscreenchange', onFsChange)
      document.addEventListener('webkitfullscreenchange', onFsChange as EventListener)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', blockCopy)
    document.addEventListener('paste', blockCopy)
    document.addEventListener('cut', blockCopy)
    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('keydown', blockKeys)
    document.addEventListener('keyup', onKeyUp)

    setNotFullscreen(fsSupported && !isFullscreen())

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('paste', blockCopy)
      document.removeEventListener('cut', blockCopy)
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('keydown', blockKeys)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [active, recordViolation, fsSupported])

  return { violations, violationToast, notFullscreen, fsSupported, reEnterFullscreen }
}
