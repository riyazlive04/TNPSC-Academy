import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, Layers, Loader2, Trophy } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { api } from '../lib/api'
import { MOCK_BLUEPRINTS } from '../lib/constants'
import { useT } from '../lib/i18n'
import type { Difficulty, MockBlueprint, QuizConfig } from '../types'

type Tab = 'group' | 'subject'

const ALL_TOPICS = '__all__'

const DIFFICULTIES: { key: Difficulty | null; labelKey: 'diffMixed' | 'diffEasy' | 'diffMedium' | 'diffHard' }[] = [
  { key: null, labelKey: 'diffMixed' },
  { key: 'easy', labelKey: 'diffEasy' },
  { key: 'medium', labelKey: 'diffMedium' },
  { key: 'hard', labelKey: 'diffHard' },
]

export default function MockTestPage() {
  const navigate = useNavigate()
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('group')

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-3 text-center">
          <YellowBadge>{t('mockTests')}</YellowBadge>
        </div>
        <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('fullLength')}</p>

        {/* Tab switch — segmented control */}
        <div className="mb-8 flex justify-center">
          <div className="seg-wrap">
            <button
              onClick={() => setTab('group')}
              className={['seg inline-flex items-center gap-1.5', tab === 'group' ? 'seg-active' : ''].join(' ')}
            >
              <Trophy size={15} /> {t('mockGroupExam')}
            </button>
            <button
              onClick={() => setTab('subject')}
              className={['seg inline-flex items-center gap-1.5', tab === 'subject' ? 'seg-active' : ''].join(' ')}
            >
              <Layers size={15} /> {t('mockSubjectExam')}
            </button>
          </div>
        </div>

        {tab === 'group' ? <GroupExamTab /> : <SubjectExamTab />}
      </div>
    </AppLayout>
  )
}

// ─── Group exam tab ───────────────────────────────────────────────────────────

function GroupExamTab() {
  const navigate = useNavigate()
  const { t } = useT()
  const [selected, setSelected] = useState<MockBlueprint>(MOCK_BLUEPRINTS[0])

  const launch = () => {
    const config: QuizConfig = {
      category: 'pyq',
      proctored: true,
      mock: true,
      mockKind: 'group',
      mockGroup: selected.id,
      mockQuestionCount: selected.totalQuestions,
      mockDurationSeconds: selected.durationMinutes * 60,
      negativeMark: selected.negativeMark,
      label: `${t('mockTest')} · ${selected.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  return (
    <div className="animate-fadeIn">
      <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('mockGroupSub')}</p>

      {/* Group selector */}
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        {MOCK_BLUEPRINTS.map((b) => (
          <PillButton key={b.id} size="sm" active={selected.id === b.id} onClick={() => setSelected(b)}>
            {b.title}
          </PillButton>
        ))}
      </div>

      {/* Blueprint card */}
      <div className="card p-5 sm:p-6">
        {/* Title + key stats */}
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
          <h3 className="font-heading text-lg font-semibold tracking-tight text-ink">{selected.title}</h3>
          <div className="flex flex-shrink-0 gap-2">
            <Tag>
              <FileText size={12} /> {selected.totalQuestions} Q
            </Tag>
            <Tag>
              <Clock size={12} /> {selected.durationMinutes} min
            </Tag>
          </div>
        </div>

        <h4 className="mb-3 font-heading text-xs font-semibold uppercase tracking-wider text-ink2">
          {t('questionDistribution')}
        </h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {selected.slots.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-xl bg-tint px-3.5 py-2.5 font-body text-sm text-ink"
            >
              <span className="truncate pr-2">{s.label}</span>
              <span className="grid h-6 min-w-6 flex-shrink-0 place-items-center rounded-md bg-card px-1.5 font-heading text-xs font-bold text-brand">
                {s.count}
              </span>
            </div>
          ))}
        </div>

        <button onClick={launch} className="btn-brand btn-lg mt-6 w-full">
          {t('startExam')}
        </button>
      </div>
    </div>
  )
}

// ─── Subject / topic tab ──────────────────────────────────────────────────────

function SubjectExamTab() {
  const navigate = useNavigate()
  const { t } = useT()

  const [subjects, setSubjects] = useState<{ subject: string; total: number }[]>([])
  const [subject, setSubject] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [topics, setTopics] = useState<string[]>([])

  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [error, setError] = useState('')

  // Subjects (once).
  useEffect(() => {
    let cancelled = false
    api
      .subjects()
      .then((s) => !cancelled && setSubjects(s))
      .catch(() => !cancelled && setError('Could not load subjects. Please try again.'))
      .finally(() => !cancelled && setLoadingSubjects(false))
    return () => {
      cancelled = true
    }
  }, [])

  // Topics for the chosen subject.
  useEffect(() => {
    if (!subject) return
    let cancelled = false
    setLoadingTopics(true)
    setError('')
    setTopics([])
    api
      .distinctTopics({ category: 'subject', subject })
      .then((tp) => !cancelled && setTopics(tp))
      .catch(() => !cancelled && setError('Could not load topics. Please try again.'))
      .finally(() => !cancelled && setLoadingTopics(false))
    return () => {
      cancelled = true
    }
  }, [subject])

  const launch = () => {
    if (!subject || !topic) return
    const isAll = topic === ALL_TOPICS
    const diffLabel = difficulty ? t(`diff${cap(difficulty)}` as 'diffEasy') : t('diffMixed')
    const config: QuizConfig = {
      category: 'subject',
      proctored: true,
      mock: true,
      mockKind: 'subject',
      subject,
      topic: isAll ? undefined : topic,
      difficulty: difficulty ?? undefined,
      mockQuestionCount: 50,
      mockDurationSeconds: 50 * 60,
      negativeMark: 0,
      label: `${subject} · ${isAll ? t('allTopics') : topic} · ${diffLabel}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  return (
    <div className="animate-fadeIn">
      <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('mockSubjectSub')}</p>

      {/* Step 1 — subject */}
      <PillSection title={t('step1Subject')} className="mb-8" wrap={false}>
        {loadingSubjects ? (
          <div className="flex justify-center py-8">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {subjects.map((s) => (
              <PillButton
                key={s.subject}
                size="sm"
                active={subject === s.subject}
                onClick={() => {
                  setSubject(s.subject)
                  setTopic(null)
                }}
              >
                {s.subject}
              </PillButton>
            ))}
          </div>
        )}
      </PillSection>

      {/* Step 2 — topic */}
      {subject && (
        <PillSection title={t('step3Topic')} className="mb-8 animate-fadeIn" wrap={false}>
          {loadingTopics && (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          )}
          {!loadingTopics && error && (
            <p className="text-center font-body text-sm text-coral">{error}</p>
          )}
          {!loadingTopics && !error && (
            <div className="flex flex-wrap justify-center gap-3">
              <PillButton size="sm" active={topic === ALL_TOPICS} onClick={() => setTopic(ALL_TOPICS)}>
                {t('allTopics')}
              </PillButton>
              {topics.map((tp) => (
                <PillButton key={tp} size="sm" active={topic === tp} onClick={() => setTopic(tp)}>
                  {tp}
                </PillButton>
              ))}
            </div>
          )}
        </PillSection>
      )}

      {/* Step 3 — difficulty */}
      {subject && topic && (
        <PillSection title={t('diffLevel')} className="mb-8 animate-fadeIn" wrap={false}>
          <div className="flex flex-wrap justify-center gap-3">
            {DIFFICULTIES.map(({ key, labelKey }) => (
              <PillButton key={labelKey} size="md" active={difficulty === key} onClick={() => setDifficulty(key)}>
                {t(labelKey)}
              </PillButton>
            ))}
          </div>
        </PillSection>
      )}

      {/* Launch */}
      {subject && topic && (
        <div className="animate-fadeIn text-center">
          <button onClick={launch} className="btn-brand btn-lg px-10">
            {t('startExam')}
          </button>
        </div>
      )}
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 font-heading text-[11px] font-medium uppercase tracking-wide text-ink2">
      {children}
    </span>
  )
}
