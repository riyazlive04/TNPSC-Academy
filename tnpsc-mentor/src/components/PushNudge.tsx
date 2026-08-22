import { useEffect, useState } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { enablePush, isPushSupported, pushPermission } from '../lib/push'
import { toast } from '../store/toastStore'
import { useT } from '../lib/i18n'

/**
 * One-time "enable device notifications" nudge — the proactive counterpart to
 * the small opt-in row buried in the bell dropdown. A modal popup (mirrors
 * MarathonFreeAlert's dialog treatment) rather than an inline dashboard card,
 * so it doesn't compete with the dashboard's own content for space. Shown
 * only when it can actually lead somewhere:
 *   • Web Push is supported (never in the Android WebView app — no PushManager)
 *   • permission is still 'default' (denied users are never nagged again)
 *   • it hasn't been answered/dismissed on this device before (localStorage)
 * If permission was already granted (e.g. the server lost the subscription),
 * it silently refreshes the subscription once per session instead of rendering.
 */

const STORAGE_KEY = 'tnpsc-mentor-push-nudge' // '1' = answered or dismissed
let resyncedThisSession = false

export default function PushNudge({ holdBack = false }: { holdBack?: boolean }) {
  const { t } = useT()
  const [visible, setVisible] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (holdBack || !isPushSupported()) return
    const permission = pushPermission()

    // Already granted: no UI — just make sure the server has this browser's
    // subscription (enablePush reuses the existing one; the server upserts).
    if (permission === 'granted') {
      if (!resyncedThisSession) {
        resyncedThisSession = true
        void enablePush()
      }
      return
    }

    if (permission !== 'default') return
    if (localStorage.getItem(STORAGE_KEY)) return
    setVisible(true)
  }, [holdBack])

  const settle = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const handleEnable = async () => {
    setEnabling(true)
    const result = await enablePush()
    setEnabling(false)
    if (result === 'subscribed') toast.success(t('pushEnabled'))
    else if (result === 'denied') toast.error(t('pushDenied'))
    else if (result === 'unconfigured') toast.info(t('pushUnavailable'))
    else if (result === 'error') {
      // Transient failure: leave the nudge (and storage) so it can retry later.
      toast.error(t('pushFailed'))
      return
    }
    settle()
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px] animate-fadeInFast"
      role="dialog"
      aria-modal="true"
      aria-label={t('pushNudgeTitle')}
    >
      <div className="w-full max-w-sm animate-sheetIn overflow-hidden rounded-3xl border border-line bg-card text-center shadow-card">
        <div className="bg-gradient-to-r from-brand to-brand-dark px-6 py-5 text-white">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
            <BellRing size={24} />
          </span>
          <h2 className="tamil mt-3 font-display text-lg font-bold leading-tight tracking-tight">
            {t('pushNudgeTitle')}
          </h2>
        </div>

        <div className="p-6">
          <p className="tamil font-body text-sm leading-relaxed text-muted">{t('pushNudgeBody')}</p>

          <div className="mt-5 space-y-2">
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="btn-brand inline-flex w-full items-center justify-center gap-1.5 py-2.5 text-sm disabled:opacity-60"
            >
              {enabling ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
              {t('enableDeviceNotifications')}
            </button>
            <button onClick={settle} className="btn-ghost w-full py-2 text-sm">
              {t('notNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
