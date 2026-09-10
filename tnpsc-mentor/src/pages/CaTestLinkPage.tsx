import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { api, type CaDailySet } from '../lib/api'
import { dailyCaConfig } from '../lib/caDaily'
import { isIsoDate } from '../lib/shareLinks'
import { useStartTest } from '../hooks/useStartTest'
import ErrorState from '../components/UI/ErrorState'
import LogoLoader from '../components/UI/LogoLoader'
import { useT } from '../lib/i18n'

/**
 * Resolver behind the shareable test link, /ca/test/:date (bare /ca/test opens
 * the newest published paper).
 *
 * Resolves the date to a published set and hands it to useStartTest, i.e. the
 * SAME launch the dashboard day-picker performs — so a shared link still lands
 * on the pre-test rules screen and is still charged and proctored normally. A
 * link that skipped that would be a way to start a test without the gate.
 *
 * Bounded by /daily/published the way the magazine link is bounded by /recent;
 * the API caps that at 30 days.
 */
const LOOKUP_DAYS = 30

export default function CaTestLinkPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const startTest = useStartTest()
  const { date } = useParams<{ date?: string }>()
  const [error, setError] = useState<unknown>(null)
  const [missing, setMissing] = useState(false)
  // startTest navigates; without this latch a re-render mid-navigation could
  // fire it a second time and push a duplicate history entry.
  const launched = useRef(false)

  const wanted = isIsoDate(date) ? date : undefined
  const malformed = !!date && !wanted

  useEffect(() => {
    if (malformed) {
      setMissing(true)
      return
    }
    if (launched.current) return
    let cancelled = false
    setError(null)
    setMissing(false)
    api.caQuestions
      .dailyPublished(LOOKUP_DAYS)
      .then((sets: CaDailySet[]) => {
        if (cancelled || launched.current) return
        const found = wanted ? sets.find((s) => s.date === wanted) : sets[0]
        if (!found) {
          setMissing(true)
          return
        }
        launched.current = true
        startTest(dailyCaConfig(found, lang))
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
    return () => {
      cancelled = true
    }
    // startTest is rebuilt every render; depending on it would re-run the
    // lookup on each one. The launch latch above is what keeps this to once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, malformed, lang])

  if (error != null) {
    return <ErrorState error={error} onRetry={() => setError(null)} fullScreen />
  }

  if (missing) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <ListChecks size={30} className="text-ink2/50" />
        <p className="tamil max-w-sm font-body text-sm leading-relaxed text-ink2">
          {t('caLinkTestMissing')}
        </p>
        <button onClick={() => navigate('/test-arena')} className="btn-wrap btn-brand px-5 py-2.5 text-sm">
          {t('caLinkBackToDashboard')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <LogoLoader size={56} label={t('caLinkOpening')} />
      <p className="tamil font-heading text-sm uppercase tracking-widest text-ink2">
        {t('caLinkOpening')}
      </p>
    </div>
  )
}
