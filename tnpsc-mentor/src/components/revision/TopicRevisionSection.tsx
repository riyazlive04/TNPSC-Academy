import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, GraduationCap } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { toast } from '../../store/toastStore'
import { useT } from '../../lib/i18n'
import { useQuizStore } from '../../store/quizStore'
import { useCreditsStore } from '../../store/creditsStore'
import { upsell } from '../../store/upsellStore'
import type { QuizConfig, RevisionAnalytics, RevisionTopic } from '../../types'
import ConfirmDialog from '../UI/ConfirmDialog'
import RevisionCard from './RevisionCard'
import RevisionAnalyticsPanel from './RevisionAnalyticsPanel'

/**
 * The topic-revision dashboard shown above the per-question SRS deck on the
 * Revisions tab: progress analytics + "Ready to attempt" / "Still studying" /
 * "Cleared" sections. Starting a ready card opens the study gate (similar, not
 * identical, questions) and launches the quiz; locked cards stay disabled.
 */
export default function TopicRevisionSection() {
  const navigate = useNavigate()
  const { t } = useT()
  const [items, setItems] = useState<RevisionTopic[]>([])
  const [analytics, setAnalytics] = useState<RevisionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // The card awaiting a remove confirmation (the X opens this dialog first).
  const [pendingDismiss, setPendingDismiss] = useState<RevisionTopic | null>(null)
  const [dismissing, setDismissing] = useState(false)

  const load = () => {
    Promise.all([api.revisions(), api.revisionAnalytics()])
      .then(([rows, a]) => {
        setItems(rows)
        setAnalytics(a)
      })
      .catch(() => {
        /* non-fatal: tab still shows the per-question deck below */
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async (item: RevisionTopic) => {
    if (item.status !== 'available' || busyId) return
    setBusyId(item.id)
    try {
      const { config, questions } = await api.startRevision(item.id)
      if (!questions.length) {
        toast.error(t('loadQuestionsError'))
        return
      }
      // Seed the quiz with the exact similar questions, then hand off to the
      // quiz page (which resumes this session instead of re-fetching).
      useQuizStore.getState().initSession(config as QuizConfig, questions)
      // The 10-credit fee is charged at start (server) — refresh the meter.
      void useCreditsStore.getState().reload()
      navigate('/quiz', { state: config })
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        toast.info(t('revStudyFirstToast'))
        load() // refresh - its unlock time just hasn't arrived
      } else if (e instanceof ApiError && e.status === 402) {
        // Out of credits for the re-test → force the buy decision.
        const gate = (e.data ?? {}) as { cost?: number }
        upsell.credits(gate.cost)
      } else {
        toast.error(t('loadQuestionsError'))
      }
    } finally {
      setBusyId(null)
    }
  }

  // The X only asks; the actual removal happens after the user confirms.
  const requestDismiss = (item: RevisionTopic) => setPendingDismiss(item)

  const confirmDismiss = async () => {
    const item = pendingDismiss
    if (!item) return
    setDismissing(true)
    setItems((prev) => prev.filter((r) => r.id !== item.id))
    try {
      await api.dismissRevision(item.id)
      api.revisionAnalytics().then(setAnalytics).catch(() => {})
    } catch {
      load() // restore on failure
    } finally {
      setDismissing(false)
      setPendingDismiss(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={26} className="animate-spin text-primary" />
      </div>
    )
  }

  const available = items.filter((i) => i.status === 'available')
  const locked = items.filter((i) => i.status === 'locked')
  const cleared = items.filter((i) => i.status === 'cleared')

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-card p-6 text-center">
        <GraduationCap size={26} className="mx-auto mb-2 text-muted" />
        <p className="tamil font-body text-sm text-muted">{t('revTopicEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {analytics && analytics.total > 0 && <RevisionAnalyticsPanel data={analytics} />}

      {available.length > 0 && (
        <Group title={`${t('revReadyTitle')} (${available.length})`}>
          {available.map((i) => (
            <RevisionCard key={i.id} item={i} onStart={handleStart} onDismiss={requestDismiss} busy={busyId === i.id} />
          ))}
        </Group>
      )}

      {locked.length > 0 && (
        <Group title={`${t('revStudyingTitle')} (${locked.length})`}>
          {locked.map((i) => (
            <RevisionCard key={i.id} item={i} onStart={handleStart} onDismiss={requestDismiss} busy={busyId === i.id} />
          ))}
        </Group>
      )}

      {cleared.length > 0 && (
        <Group title={`${t('revClearedTitle')} (${cleared.length})`}>
          {cleared.map((i) => (
            <RevisionCard key={i.id} item={i} onStart={handleStart} onDismiss={requestDismiss} />
          ))}
        </Group>
      )}

      <ConfirmDialog
        open={!!pendingDismiss}
        title={t('revDismissTitle')}
        message={t('revDismissMsg')}
        confirmLabel={t('revDismiss')}
        cancelLabel={t('cancel')}
        tone="danger"
        busy={dismissing}
        onConfirm={confirmDismiss}
        onCancel={() => !dismissing && setPendingDismiss(null)}
      />
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="tamil mb-2.5 font-heading text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
