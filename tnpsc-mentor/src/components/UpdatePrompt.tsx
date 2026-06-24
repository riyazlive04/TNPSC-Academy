import { useEffect, useState } from 'react'
import { Download, Sparkles } from 'lucide-react'
import { checkForUpdate, openDownload, type UpdateInfo } from '../lib/appUpdate'

// Remember the version a user dismissed so we don't nag them every launch - only
// re-prompt once a still-newer build is published.
const DISMISS_KEY = 'tnpsc_update_dismissed_version'

/**
 * In-app "Update available" prompt for the direct-download Android build. Mounts
 * globally; checks once on launch and renders nothing on the web or when the app
 * is already current. "Update now" opens the APK download in the system browser.
 */
export default function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void checkForUpdate().then((u) => {
      if (cancelled || !u) return
      let dismissed = ''
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) ?? ''
      } catch {
        /* storage blocked - just show the prompt */
      }
      if (dismissed === u.release.version_name) return
      setInfo(u)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!info) return null
  const { release } = info

  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, release.version_name)
    } catch {
      /* ignore */
    }
    setInfo(null)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm animate-fadeInFast sm:items-center"
      role="presentation"
      onClick={later}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-4 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-tint-violet text-primary">
            <Sparkles size={22} />
          </span>
          <h2 id="update-title" className="font-display text-lg font-bold text-ink">
            Update available
          </h2>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-ink2">
            A new version ({release.version_name}) of TNPSC Mentors is ready to install.
          </p>
          {release.notes && (
            <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-line rounded-card bg-surface px-3 py-2 text-left font-body text-xs leading-relaxed text-muted">
              {release.notes}
            </p>
          )}
        </div>
        <button
          onClick={() => void openDownload(release.url)}
          className="btn-brand press flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
        >
          <Download size={16} /> Update now
        </button>
        <button onClick={later} className="btn-ghost press mt-2 w-full px-4 py-2.5 text-sm">
          Later
        </button>
      </div>
    </div>
  )
}
