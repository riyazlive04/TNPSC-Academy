import { useEffect, useState } from 'react'
import { ListChecks, CalendarDays, Download, Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import LogoLoader from '../components/UI/LogoLoader'
import SectionHeader from '../components/UI/SectionHeader'
import { api, type Material } from '../lib/api'
import { issueDateLabel } from '../lib/caMagazine'
import { pdfWatermark } from '../lib/pdfWatermark'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import { toast } from '../store/toastStore'

/**
 * Student CA-Questions section (own dashboard row → this page). Lists the CA
 * question sets a superadmin has published — daily drops and monthly banks —
 * each a one-tap PDF download (answers + explanations), personalised with the
 * downloader's watermark. Publication-driven via the shared materials list, so
 * these no longer live in the mixed Materials tab.
 */

// Module-level cache so back-navigation doesn't refetch/flash.
let cache: Material[] | null = null

export default function CaQuestionsPage() {
  const { t, lang } = useT()
  const { profile } = useAuth()
  const [sets, setSets] = useState<Material[] | null>(cache)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setError(false)
    api.materials
      .list('materials')
      .then((all) => {
        // Only downloadable sets — the questions endpoint 404s otherwise, so a
        // non-downloadable set would be a dead row.
        const qs = all.filter(
          (m) => m.kind === 'questions' && m.questions_source && m.questions_key && m.downloadable
        )
        cache = qs
        setSets(qs)
      })
      .catch(() => setError(true))
  }
  useEffect(load, [])

  /** Localised date/month line for a set (daily → '9 July 2026', monthly → key). */
  const setLabel = (m: Material): string =>
    m.questions_source === 'daily' && m.questions_key
      ? issueDateLabel('day_wise', m.questions_key, lang)
      : (m.questions_key ?? '')

  const download = async (m: Material) => {
    if (busyId) return
    setBusyId(m.id)
    try {
      const items = await api.caQuestions.items(m.id)
      if (!items.length) throw new Error('empty')
      const { generateCaQuestionsPdf } = await import('../lib/caQuestionsPdf')
      await generateCaQuestionsPdf({
        items,
        title: m.questions_source === 'daily' ? 'Daily Current Affairs' : 'Monthly Current Affairs',
        label: setLabel(m),
        lang,
        watermark: pdfWatermark(profile),
      })
    } catch {
      toast.error(t('materialDownloadFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const daily = (sets ?? []).filter((m) => m.questions_source === 'daily')
  const monthly = (sets ?? []).filter((m) => m.questions_source === 'monthly')

  const renderRow = (m: Material) => (
    <ListRow
      key={m.id}
      leading={
        <IconTile tint="green" size={40}>
          {m.questions_source === 'daily' ? <ListChecks size={19} /> : <CalendarDays size={19} />}
        </IconTile>
      }
      title={setLabel(m)}
      subtitle={m.description ?? undefined}
      onClick={() => void download(m)}
      disabled={busyId === m.id}
      trailing={
        busyId === m.id ? (
          <Loader2 size={18} className="flex-shrink-0 animate-spin text-brand" />
        ) : (
          <Download size={18} className="flex-shrink-0 text-brand" />
        )
      }
    />
  )

  return (
    <PickerPage badge={t('caQuestionsTitle')}>
      <p className="tamil mb-6 text-center font-body text-sm text-muted">{t('caQuestionsPageSub')}</p>

      {sets === null && !error && (
        <div className="flex justify-center py-20">
          <LogoLoader size={56} />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="font-body text-ink2">{t('couldNotLoad')}</p>
          <button onClick={load} className="btn-ghost btn-sm">
            {t('retry')}
          </button>
        </div>
      )}

      {sets !== null && !error && sets.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ListChecks size={30} className="text-ink2/50" />
          <p className="tamil max-w-sm font-body text-ink2">{t('caQuestionsEmpty')}</p>
        </div>
      )}

      <div className="space-y-8">
        {daily.length > 0 && (
          <section className="space-y-1">
            <SectionHeader title={t('caQuestionsDaily')} className="px-1" />
            <List>{daily.map(renderRow)}</List>
          </section>
        )}
        {monthly.length > 0 && (
          <section className="space-y-1">
            <SectionHeader title={t('caQuestionsMonthly')} className="px-1" />
            <List>{monthly.map(renderRow)}</List>
          </section>
        )}
      </div>
    </PickerPage>
  )
}
