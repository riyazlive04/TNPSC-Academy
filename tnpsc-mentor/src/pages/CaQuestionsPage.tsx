import { useEffect, useState } from 'react'
import { ListChecks, CalendarDays, Download, Loader2, Play } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { SkeletonList } from '../components/UI/Skeleton'
import SectionHeader from '../components/UI/SectionHeader'
import { api, type CaDailySet, type Material } from '../lib/api'
import { issueDateLabel, setKeyOrder } from '../lib/caMagazine'
import { dailyCaConfig } from '../lib/caDaily'
import { pdfWatermark } from '../lib/pdfWatermark'
import { useAuth } from '../hooks/useAuth'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'
import { toast } from '../store/toastStore'

/**
 * Student CA-Questions section (own dashboard row → this page), in two tabs:
 *
 *  • QUIZ — the superadmin-published sets played as real, graded tests. Daily
 *    drops run through the dedicated /api/ca-questions/daily/* pipeline (their
 *    rows live outside the main bank); monthly banks are ordinary
 *    `ca_type='month_wise'` question-bank tests, the same ones the Current
 *    Affairs hub serves per month.
 *  • PDF — the original one-tap download of a set with answers + explanations,
 *    personalised with the downloader's watermark.
 *
 * Quiz leads, because a set is worth practising before it's worth filing.
 */

type Tab = 'quiz' | 'pdf'

// Module-level caches so back-navigation doesn't refetch/flash.
let cache: Material[] | null = null
let dailyCache: CaDailySet[] | null = null

/** How many published days the quiz tab offers. */
const DAILY_LIMIT = 30

export default function CaQuestionsPage() {
  const { t, lang } = useT()
  const { profile } = useAuth()
  const startTest = useStartTest()
  const [tab, setTab] = useState<Tab>('quiz')
  const [sets, setSets] = useState<Material[] | null>(cache)
  const [daily, setDaily] = useState<CaDailySet[] | null>(dailyCache)
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
    // The playable daily sets. Published-but-not-downloadable days still appear
    // here: `downloadable` gates the answer PDF, not the test.
    api.caQuestions
      .dailyPublished(DAILY_LIMIT)
      .then((list) => {
        dailyCache = list
        setDaily(list)
      })
      .catch(() => setDaily([]))
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

  /** A monthly bank is an ordinary question-bank test scoped to that month. */
  const startMonthly = (m: Material) => {
    const month = m.questions_key ?? ''
    if (!month) return
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: month,
      labelParts: [{ t: 'currentAffairsBadge' }, month],
    })
  }

  // Newest first. The materials list comes back in publication order, which is
  // NOT the sets' own order — a day published late lands out of sequence.
  const byKeyDesc = (a: Material, b: Material) =>
    setKeyOrder(b.questions_source, b.questions_key) -
    setKeyOrder(a.questions_source, a.questions_key)
  const pdfDaily = (sets ?? []).filter((m) => m.questions_source === 'daily').sort(byKeyDesc)
  const monthly = (sets ?? []).filter((m) => m.questions_source === 'monthly').sort(byKeyDesc)
  const loading = tab === 'pdf' ? sets === null : daily === null || sets === null
  const empty =
    tab === 'pdf'
      ? sets !== null && sets.length === 0
      : daily !== null && sets !== null && daily.length === 0 && monthly.length === 0

  /** One PDF row: tapping it renders and saves the set. */
  const pdfRow = (m: Material) => (
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

  /** One quiz row: tapping it opens the pre-test screen for that set. */
  const quizRow = (
    key: string,
    title: string,
    subtitle: string | undefined,
    monthlySet: boolean,
    onClick: () => void
  ) => (
    <ListRow
      key={key}
      leading={
        <IconTile tint={monthlySet ? 'violet' : 'green'} size={40}>
          {monthlySet ? <CalendarDays size={19} /> : <ListChecks size={19} />}
        </IconTile>
      }
      title={title}
      subtitle={subtitle}
      onClick={onClick}
      trailing={<Play size={17} className="flex-shrink-0 text-brand" />}
    />
  )

  return (
    <PickerPage badge={t('caQuestionsTitle')}>
      <p className="tamil mb-5 text-center font-body text-sm text-muted">
        {tab === 'quiz' ? t('caQuestionsQuizSub') : t('caQuestionsPageSub')}
      </p>

      {/* Quiz / PDF toggle - the same segmented control the CA hub uses. */}
      <div className="mb-7 flex justify-center">
        <div className="seg-wrap">
          <button
            className={['seg', tab === 'quiz' ? 'seg-active' : ''].join(' ')}
            onClick={() => setTab('quiz')}
          >
            {t('caTabQuiz')}
          </button>
          <button
            className={['seg', tab === 'pdf' ? 'seg-active' : ''].join(' ')}
            onClick={() => setTab('pdf')}
          >
            {t('caTabPdf')}
          </button>
        </div>
      </div>

      {loading && !error && <SkeletonList rows={6} />}

      {error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="font-body text-ink2">{t('couldNotLoad')}</p>
          <button onClick={load} className="btn-ghost btn-sm">
            {t('retry')}
          </button>
        </div>
      )}

      {empty && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ListChecks size={30} className="text-ink2/50" />
          <p className="tamil max-w-sm font-body text-ink2">{t('caQuestionsEmpty')}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {tab === 'quiz' ? (
            <>
              {(daily ?? []).length > 0 && (
                <section className="space-y-1">
                  <SectionHeader title={t('caQuestionsDaily')} className="px-1" />
                  <List>
                    {(daily ?? []).map((s) =>
                      quizRow(
                        s.id,
                        issueDateLabel('day_wise', s.date, lang),
                        `${s.total} ${t('questionsCount')}`,
                        false,
                        () => startTest(dailyCaConfig(s, lang))
                      )
                    )}
                  </List>
                </section>
              )}
              {monthly.length > 0 && (
                <section className="space-y-1">
                  <SectionHeader title={t('caQuestionsMonthly')} className="px-1" />
                  <List>
                    {monthly.map((m) =>
                      quizRow(m.id, setLabel(m), m.description ?? undefined, true, () =>
                        startMonthly(m)
                      )
                    )}
                  </List>
                </section>
              )}
            </>
          ) : (
            <>
              {pdfDaily.length > 0 && (
                <section className="space-y-1">
                  <SectionHeader title={t('caQuestionsDaily')} className="px-1" />
                  <List>{pdfDaily.map(pdfRow)}</List>
                </section>
              )}
              {monthly.length > 0 && (
                <section className="space-y-1">
                  <SectionHeader title={t('caQuestionsMonthly')} className="px-1" />
                  <List>{monthly.map(pdfRow)}</List>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </PickerPage>
  )
}
