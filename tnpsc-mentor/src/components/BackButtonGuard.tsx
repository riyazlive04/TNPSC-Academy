import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { LogOut } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useQuizStore } from '../store/quizStore'
import { useMockQuizStore } from '../store/mockQuizStore'
import { abandonTest } from '../lib/abandonTest'
import { trackAbandonTest } from '../lib/tracking'
import { exitFullscreen } from '../lib/proctor'

// Screens that hold a live, unfinished test - a back press here must confirm
// before throwing the attempt away, instead of silently navigating off.
const LIVE_TEST_ROUTES = ['/quiz', '/mock/quiz']

type Prompt = 'leave-app' | 'abandon'

/**
 * Global back-navigation guard for both the installed app and the web build.
 *
 *  - During a live test (practice or mock), back asks "Leave this test?" and
 *    only abandons + navigates away on confirm - never loses progress silently.
 *  - On the native app's root screen, back asks "Leave the app?" and only exits
 *    on confirm (Capacitor would otherwise exit instantly on an accidental tap).
 *  - Everywhere else, back behaves normally (in-app history on native; the
 *    browser's own back on web - we only trap it on the live-test routes).
 */
export default function BackButtonGuard() {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  // Refs so the once-registered native listener always sees current values.
  const promptRef = useRef<Prompt | null>(null)
  promptRef.current = prompt
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  // Which kind of live test (if any) is on screen right now.
  const liveTestKind = (): 'practice' | 'mock' | null => {
    const path = pathRef.current
    if (path.startsWith('/mock/quiz') && useMockQuizStore.getState().questions.length > 0) {
      return 'mock'
    }
    if (path.startsWith('/quiz') && useQuizStore.getState().questions.length > 0) {
      return 'practice'
    }
    return null
  }

  // Shared decision for any back press (native button or trapped web back).
  const onBackPressed = (canGoBack: boolean) => {
    // An open prompt: back simply dismisses it (stays on the page).
    if (promptRef.current) {
      setPrompt(null)
      return
    }
    if (liveTestKind()) {
      setPrompt('abandon')
      return
    }
    if (canGoBack) {
      window.history.back()
      return
    }
    // Root of the native app → confirm exit. The web has nothing to "exit".
    if (Capacitor.isNativePlatform()) setPrompt('leave-app')
  }

  // ── Native hardware back button (Android / tablet) ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let active = true
    let handle: PluginListenerHandle | undefined
    void (async () => {
      const { App } = await import('@capacitor/app')
      const h = await App.addListener('backButton', ({ canGoBack }) => onBackPressed(canGoBack))
      if (active) handle = h
      else void h.remove()
    })()
    return () => {
      active = false
      void handle?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Web browser back: trap it ONLY on live-test screens, so ordinary in-app
  //    back navigation stays untouched. A sentinel history entry lets us catch
  //    the back press, show the prompt, and stay put until the user decides.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    if (!LIVE_TEST_ROUTES.some((r) => location.pathname.startsWith(r))) return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      // Re-arm the sentinel so we don't actually leave yet, then prompt.
      window.history.pushState(null, '', window.location.href)
      onBackPressed(true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const confirmAbandon = async () => {
    const kind = liveTestKind()
    setPrompt(null)
    if (kind === 'practice') {
      const s = useQuizStore.getState()
      if (s.config && s.questions.length > 0) {
        trackAbandonTest({
          reason: 'back_button',
          category: s.config.category,
          subject: s.config.subject,
          totalQuestions: s.questions.length,
          attempted: Object.values(s.answers).filter((a) => a.selected_answer).length,
          timeTakenSeconds: Math.max(0, Math.round((Date.now() - (s.startedAt ?? Date.now())) / 1000)),
        })
        try {
          await abandonTest({
            config: s.config,
            questions: s.questions,
            answers: s.answers,
            timeLimitSeconds: s.timeLimitSeconds ?? 0,
            startedAt: s.startedAt ?? Date.now(),
          })
        } catch {
          /* best-effort - don't block leaving if recording fails */
        }
      }
      s.reset()
      await exitFullscreen()
      navigate('/test-arena', { replace: true })
    } else if (kind === 'mock') {
      useMockQuizStore.getState().reset()
      await exitFullscreen()
      navigate('/mock', { replace: true })
    }
  }

  const confirmExitApp = async () => {
    setPrompt(null)
    try {
      const { App } = await import('@capacitor/app')
      await App.exitApp()
    } catch {
      /* not native / plugin missing - nothing to do */
    }
  }

  if (!prompt) return null

  const isAbandon = prompt === 'abandon'
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isAbandon ? t('abandonTestTitle') : t('leaveAppTitle')}
      onClick={() => setPrompt(null)}
    >
      <div
        className="w-full max-w-xs rounded-card border border-line bg-card p-6 text-center shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-tile bg-tint-coral text-accent">
          <LogOut size={22} />
        </span>
        <h2 className="mt-4 font-heading text-lg font-bold text-ink">
          {isAbandon ? t('abandonTestTitle') : t('leaveAppTitle')}
        </h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-ink2">
          {isAbandon ? t('abandonTestBody') : t('leaveAppBody')}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setPrompt(null)}
            className="btn-ghost flex-1 justify-center py-2.5 text-sm"
            autoFocus
          >
            {t('stay')}
          </button>
          <button
            onClick={isAbandon ? confirmAbandon : confirmExitApp}
            className="btn-brand flex-1 justify-center py-2.5 text-sm"
          >
            {isAbandon ? t('abandonTestConfirm') : t('leaveAppConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
