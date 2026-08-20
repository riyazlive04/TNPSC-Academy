import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, FileText, Layers, ListChecks, Lock, Minus, Plus, Trophy } from 'lucide-react'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import PremiumCard from '../components/UI/PremiumCard'
import { SkeletonCards, SkeletonPills } from '../components/UI/Skeleton'
import { api } from '../lib/api'
import { MOCK_BLUEPRINTS } from '../lib/constants'
import { upsell } from '../store/upsellStore'
import { useT, type StringKey } from '../lib/i18n'
import type { Difficulty, MockBlueprint, MockExam, QuizConfig } from '../types'

type Tab = 'group' | 'subject' | 'exam'

const ALL_TOPICS = '__all__'

// Bounds for the subject-exam configuration controls.
const Q_MIN = 10
const Q_MAX = 100
const Q_STEP = 5
const Q_DEFAULT = 50
const T_MIN = 10
const T_MAX = 120
const T_STEP = 5
const T_DEFAULT = 50

const DIFFICULTIES: { key: Difficulty | null; labelKey: 'diffMixed' | 'diffEasy' | 'diffMedium' | 'diffHard' }[] = [
  { key: null, labelKey: 'diffMixed' },
  { key: 'easy', labelKey: 'diffEasy' },
  { key: 'medium', labelKey: 'diffMedium' },
  { key: 'hard', labelKey: 'diffHard' },
]

const TAB_META: { id: Tab; labelKey: StringKey; icon: typeof Trophy }[] = [
  { id: 'group', labelKey: 'mockGroupExam', icon: Trophy },
  { id: 'subject', labelKey: 'mockSubjectExam', icon: Layers },
  { id: 'exam', labelKey: 'mockFullExams', icon: ListChecks },
]

export default function MockTestPage() {
  const navigate = useNavigate()
  const { t } = useT()

  // Which sections to show is superadmin-controlled (app settings). The Full Mock
  // Exams tab is always available; Group Exam and Subject/Topic are gated. While
  // settings load we assume the gated tabs are hidden to avoid a flash.
  const [groupOn, setGroupOn] = useState(false)
  const [subjectOn, setSubjectOn] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .appSettings()
      .then((s) => {
        if (cancelled) return
        setGroupOn(s.mock_group_enabled)
        setSubjectOn(s.mock_subject_enabled)
      })
      .catch(() => {})
      .finally(() => !cancelled && setSettingsLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  const visibleTabs = useMemo(
    () =>
      TAB_META.filter(
        (tb) =>
          tb.id === 'exam' || (tb.id === 'group' && groupOn) || (tb.id === 'subject' && subjectOn)
      ),
    [groupOn, subjectOn]
  )

  // Default to the first visible tab; re-home if the current tab gets hidden.
  const [tab, setTab] = useState<Tab>('exam')
  useEffect(() => {
    if (!visibleTabs.some((tb) => tb.id === tab)) setTab(visibleTabs[0]?.id ?? 'exam')
  }, [visibleTabs, tab])

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <header className="mb-6 mt-4">
          <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
            {t('mockTests')}
          </h1>
          <p className="tamil mt-1 font-body text-base text-muted">{t('fullLength')}</p>
        </header>

        {/* Tab switch - segmented control (only when more than one section shows) */}
        {settingsLoaded && visibleTabs.length > 1 && (
          <div className="mb-8 flex justify-center">
            <div className="seg-wrap">
              {visibleTabs.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={['seg inline-flex items-center gap-1.5', tab === id ? 'seg-active' : ''].join(' ')}
                >
                  <Icon size={15} /> {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Keep spacing consistent when only the Full Mock Exams tab is shown. */}
        {settingsLoaded && visibleTabs.length <= 1 && <div className="mb-8" />}

        {tab === 'group' && groupOn && <GroupExamTab />}
        {tab === 'subject' && subjectOn && <SubjectExamTab />}
        {tab === 'exam' && <FullMockExamTab />}
      </div>
    </>
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
      <div className="rounded-card border border-line bg-card p-5 sm:p-6">
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
  const [questionCount, setQuestionCount] = useState(Q_DEFAULT)
  const [minutes, setMinutes] = useState(T_DEFAULT)

  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [error, setError] = useState('')

  // Subjects (once).
  useEffect(() => {
    let cancelled = false
    api
      .subjects()
      .then((s) => !cancelled && setSubjects(s))
      .catch(() => !cancelled && setError(t('couldNotLoad')))
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
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoadingTopics(false))
    return () => {
      cancelled = true
    }
  }, [subject])

  const launch = () => {
    if (!subject || !topic) return
    const isAll = topic === ALL_TOPICS
    const diffKey: StringKey = difficulty ? (`diff${cap(difficulty)}` as 'diffEasy') : 'diffMixed'
    const config: QuizConfig = {
      category: 'subject',
      proctored: true,
      mock: true,
      mockKind: 'subject',
      subject,
      topic: isAll ? undefined : topic,
      difficulty: difficulty ?? undefined,
      mockQuestionCount: questionCount,
      mockDurationSeconds: minutes * 60,
      negativeMark: 0,
      labelParts: [{ subject }, isAll ? { t: 'allTopics' } : { topic }, { t: diffKey }],
    }
    navigate('/mock/instructions', { state: config })
  }

  return (
    <div className="animate-fadeIn">
      <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('mockSubjectSub')}</p>

      {/* Step 1 - subject */}
      <PillSection title={t('step1Subject')} className="mb-8" wrap={false}>
        {loadingSubjects ? (
          <SkeletonPills count={8} />
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

      {/* Step 2 - topic */}
      {subject && (
        <PillSection title={t('step3Topic')} className="mb-8 animate-fadeIn" wrap={false}>
          {loadingTopics && <SkeletonPills count={10} />}
          {!loadingTopics && error && (
            <p className="text-center font-body text-sm text-wrong">{error}</p>
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

      {/* Step 3 - difficulty */}
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

      {/* Step 4 - questions & time (side by side) */}
      {subject && topic && (
        <PillSection title={t('examSetup')} className="mb-8 animate-fadeIn" wrap={false}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Number of questions - stepper */}
            <div className="rounded-card border border-line bg-card p-4">
              <div className="mb-3 flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-wide text-ink2">
                <FileText size={14} /> {t('numQuestions')}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => setQuestionCount((c) => Math.max(Q_MIN, c - Q_STEP))}
                  disabled={questionCount <= Q_MIN}
                  className="icon-btn h-10 w-10 disabled:opacity-40"
                >
                  <Minus size={18} />
                </button>
                <span className="font-heading text-2xl font-bold tabular-nums text-ink">
                  {questionCount}
                </span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => setQuestionCount((c) => Math.min(Q_MAX, c + Q_STEP))}
                  disabled={questionCount >= Q_MAX}
                  className="icon-btn h-10 w-10 disabled:opacity-40"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Time limit - slider */}
            <div className="rounded-card border border-line bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-wide text-ink2">
                  <Clock size={14} /> {t('timeLimit')}
                </span>
                <span className="font-heading text-sm font-bold tabular-nums text-brand">
                  {minutes} {t('minutesUnit')}
                </span>
              </div>
              <input
                type="range"
                min={T_MIN}
                max={T_MAX}
                step={T_STEP}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-brand"
              />
              <div className="mt-1 flex justify-between font-body text-2xs text-ink2">
                <span>
                  {T_MIN} {t('minutesUnit')}
                </span>
                <span>
                  {T_MAX} {t('minutesUnit')}
                </span>
              </div>
            </div>
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

// ─── Full mock exams tab (fixed, named 200-Q papers) ──────────────────────────

function FullMockExamTab() {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [exams, setExams] = useState<MockExam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .mockExams()
      .then((r) => !cancelled && setExams(r.exams))
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const launch = (e: MockExam) => {
    const config: QuizConfig = {
      category: 'pyq', // grading is category-agnostic; the engine uses the fetched rows
      proctored: true,
      mock: true,
      mockKind: 'exam',
      mockExamId: e.id,
      mockQuestionCount: e.total_questions,
      mockDurationSeconds: e.duration_seconds,
      negativeMark: e.negative_mark,
      label: `${t('mockTest')} · ${lang === 'ta' && e.title_ta ? e.title_ta : e.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  const anyLocked = exams.some((e) => e.locked)

  return (
    <div className="animate-fadeIn">
      <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('mockFullSub')}</p>

      {loading && <SkeletonCards count={4} height="h-28" />}

      {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

      {!loading && !error && exams.length === 0 && (
        <p className="tamil text-center font-body text-sm text-ink2">{t('mockExamsEmpty')}</p>
      )}

      {!loading && !error && exams.length > 0 && (
        <div className="space-y-3">
          {exams.map((e) => {
            const title = lang === 'ta' && e.title_ta ? e.title_ta : e.title
            const minutes = Math.round(e.duration_seconds / 60)
            const exhausted = e.attemptsUsed >= e.attemptsMax
            const disabled = e.locked || exhausted
            return (
              <div
                key={e.id}
                className={[
                  'rounded-card border border-line bg-card p-4 sm:p-5',
                  disabled ? 'opacity-80' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="tamil truncate font-heading text-base font-semibold text-ink">
                        {title}
                      </h3>
                      {e.locked && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accentwarmsoft px-2 py-0.5 font-heading text-2xs font-semibold text-accentwarm">
                          <Lock size={11} /> {t('premiumOnly')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Tag>
                        <FileText size={12} /> {e.total_questions} Q
                      </Tag>
                      <Tag>
                        <Clock size={12} /> {minutes} {t('minutesUnit')}
                      </Tag>
                      <span className="inline-flex items-center gap-1 font-body text-2xs text-ink2">
                        {exhausted ? (
                          <>
                            <CheckCircle2 size={12} className="text-correct" /> {t('examCompleted')}
                          </>
                        ) : (
                          `${t('attemptWord')} ${e.attemptsUsed}/${e.attemptsMax}`
                        )}
                      </span>
                    </div>
                  </div>
                  {/* A locked (premium-only) exam stays tappable: the tap opens
                      the forced upsell instead of silently doing nothing. Only
                      the attempt-cap state is a true dead end. */}
                  <button
                    onClick={() => (e.locked ? upsell.premium() : !disabled && launch(e))}
                    disabled={exhausted}
                    className="btn-brand shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {exhausted ? t('examCompleted') : t('startExam')}
                  </button>
                </div>
                {e.locked && (
                  <p className="tamil mt-3 border-t border-line pt-3 font-body text-xs text-ink2">
                    {t('examLocked')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* When at least one exam is paywalled, surface the upgrade card. */}
      {!loading && anyLocked && (
        <div className="mt-6">
          <PremiumCard />
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
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 font-heading text-2xs font-medium uppercase tracking-wide text-ink2">
      {children}
    </span>
  )
}
