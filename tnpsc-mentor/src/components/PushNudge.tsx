import { useEffect, useState } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { enablePush, isPushSupported, pushPermission } from '../lib/push'
import { toast } from '../store/toastStore'
import { useT } from '../lib/i18n'

/**
 * One-time "enable device notifications" nudge on the dashboard — the proactive
 * counterpart to the small opt-in row buried in the bell dropdown. Shown only
 * when it can actually lead somewhere:
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
    <section className="flex items-start gap-3 rounded-card border border-line bg-card p-4 animate-fadeIn">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-tint-violet text-primary">
        <BellRing size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tamil font-heading text-sm font-semibold text-ink">{t('pushNudgeTitle')}</p>
        <p className="tamil mt-0.5 font-body text-xs leading-relaxed text-muted">
          {t('pushNudgeBody')}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-60"
          >
            {enabling ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
            {t('enableDeviceNotifications')}
          </button>
          <button
            onClick={settle}
            className="focus-ring tamil rounded-lg px-2 py-2 font-heading text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {t('notNow')}
          </button>
        </div>
      </div>
    </section>
  )
}
