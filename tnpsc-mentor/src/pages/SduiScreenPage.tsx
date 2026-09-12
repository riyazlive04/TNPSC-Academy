// ─── Server-driven UI: a whole screen ────────────────────────────────────────
// /s/:key renders a screen that exists ONLY as a published layout — no route,
// no page component, no release. This is what makes the system more than a
// banner slot: a campaign page, a seasonal offer, an exam-day checklist or a
// "what's new" screen can be built, linked to from a slot or a notification,
// and taken down again, entirely from the console.
//
// A key with nothing published is a genuine 404 rather than a blank screen —
// the link in a notification outliving the campaign it pointed at is the normal
// case here, not an error.

import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import SduiRenderer from '../components/Sdui/SduiRenderer'
import { useSduiLayout, useSduiStore } from '../lib/sdui/client'
import { useSduiContext } from '../lib/sdui/context'
import { useT } from '../lib/i18n'
import LogoLoader from '../components/UI/LogoLoader'

export default function SduiScreenPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useT()
  const ctx = useSduiContext()

  // Screens are namespaced so a link can never address a slot that was meant to
  // sit inside another page (and so one list in the console reads clearly).
  const layoutKey = `screen.${key}`
  const { layout, ready } = useSduiLayout(layoutKey)
  const load = useSduiStore((s) => s.load)

  // A screen opened from a deep link may be the first thing the app renders, so
  // make sure a fetch has at least been attempted before deciding it's missing.
  useEffect(() => {
    void load()
  }, [load])

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LogoLoader size={56} />
      </div>
    )
  }

  if (!layout) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-violet">
          <Compass size={30} className="text-primary" />
        </span>
        <p className="tamil font-body text-sm leading-relaxed text-muted">{t('couldNotLoad')}</p>
        <button onClick={() => navigate('/test-arena')} className="btn-brand px-6 py-3 text-sm">
          {t('testArena')}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>
      <div className="space-y-4">
        <SduiRenderer layout={layout} ctx={ctx} />
      </div>
    </div>
  )
}
