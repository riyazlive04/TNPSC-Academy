import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  BarChart2,
  BarChart3,
  Layers,
  ListChecks,
  Lightbulb,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useT } from '../../lib/i18n'
import {
  buildStudyPlan,
  practiceRouteForSubject,
  type Advice,
  type TestSeriesAnalytics,
} from '../../lib/testSeriesAnalytics'
import type { TestSeriesAttempt } from '../../types'
import { ScoreTrendChart, SubjectBarChart, QuestionTypeDonut } from './analyticsCharts'

// Derived question-type bucket → i18n label key (literal union so `t()` accepts it).
function qtypeLabelKey(k: string) {
  switch (k) {
    case 'match':
      return 'qtypeMatch' as const
    case 'assertion':
      return 'qtypeAssertion' as const
    case 'statement':
      return 'qtypeStatement' as const
    case 'aptitude':
      return 'qtypeAptitude' as const
    default:
      return 'qtypeFactual' as const
  }
}

// Stable question-type order so each type keeps the SAME donut colour for every
// user (colour follows the entity, never its rank/size).
const TYPE_ORDER = ['match', 'assertion', 'statement', 'aptitude', 'factual']

// The two analytics lenses.
type SubView = 'progress' | 'types'

function scoreText(pct: number): string {
  if (pct >= 80) return 'text-mint'
  if (pct >= 50) return 'text-gold'
  return 'text-coral'
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

/**
 * The Analytics tab body: an actionable study plan up top, then a detailed score
 * trend, a subject bar chart with deep links to revise, a question-type donut,
 * and the attempt log.
 */
export default function TestSeriesAnalyticsView({ analytics }: { analytics: TestSeriesAnalytics }) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [view, setView] = useState<SubView>('progress')
  const { attempts, overview, bySubject, byType, weakSubjects, weakTypes } = analytics

  if (attempts.length === 0) {
    return (
      <div className="rounded-card border border-line bg-card p-8 text-center">
        <BarChart3 size={30} className="mx-auto text-muted/60" />
        <p className="tamil mt-3 font-body text-sm text-ink2">{t('tsAnalyticsEmpty')}</p>
      </div>
    )
  }

  const plan = buildStudyPlan(analytics)

  // Trend runs oldest → newest so the line reads left-to-right as progress.
  const trendPoints = [...attempts].reverse().map((a) => ({
    score: a.score,
    date: fmtDate(a.submitted_at),
    title: lang === 'ta' && a.title_ta ? a.title_ta : a.title,
    detail: a.correct != null && a.total ? `${a.correct}/${a.total}` : `${a.score}%`,
  }))

  const weakKeys = new Set(weakSubjects.map((s) => s.key))
  const subjectRows = bySubject.map((s) => ({
    key: s.key,
    accuracy: s.accuracy,
    correct: s.correct,
    attempted: s.attempted,
    weak: weakKeys.has(s.key),
  }))
  // "Your average" = overall accuracy across every graded answer (the marker line).
  const sumCorrect = bySubject.reduce((n, s) => n + s.correct, 0)
  const sumAtt = bySubject.reduce((n, s) => n + s.attempted, 0)
  const overallAcc = sumAtt ? Math.round((sumCorrect / sumAtt) * 100) : 0

  const typeSlices = TYPE_ORDER.map((k) => byType.find((x) => x.key === k))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({ label: t(qtypeLabelKey(x.key)), value: x.attempted, accuracy: x.accuracy }))
  const totalQ = typeSlices.reduce((s, x) => s + x.value, 0)
  // Accuracy per type (weakest first) for the "By question type" lens.
  const typeRows = byType.map((x) => ({
    key: t(qtypeLabelKey(x.key)),
    accuracy: x.accuracy,
    correct: x.correct,
    attempted: x.attempted,
    weak: false,
  }))
  const weakType = weakTypes[0]

  return (
    <div className="space-y-6">
      {/* Two lenses on the same run. */}
      <SegTabs
        value={view}
        onChange={setView}
        tabs={[
          { key: 'progress', label: t('tsProgress'), Icon: TrendingUp },
          { key: 'types', label: t('tsByType'), Icon: PieChart },
        ]}
      />

      {view === 'progress' ? (
        <div className="space-y-7">
          {/* Overview */}
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label={t('tsAttempts')} value={String(overview.attemptsCount)} />
            <Stat label={t('tsAvgScore')} value={`${overview.avgScore}%`} tint={scoreText(overview.avgScore)} />
            <Stat label={t('tsBestScore')} value={`${overview.bestScore}%`} tint={scoreText(overview.bestScore)} />
          </div>

          {/* Study plan — the actionable summary, before the detail */}
          {plan.length > 0 && (
            <section className="rounded-card border border-primary/25 bg-brand-soft/40 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Lightbulb size={16} className="text-primary" />
                <h2 className="tamil font-heading text-sm font-bold text-ink">{t('tsAdviceTitle')}</h2>
              </div>
              <p className="tamil mb-3 font-body text-xs text-muted">{t('tsAdviceSub')}</p>
              <div className="space-y-2.5">
                {plan.map((item, i) => (
                  <AdviceRow
                    key={i}
                    item={item}
                    text={adviceText(t, item)}
                    practiceLabel={t('tsPractice')}
                    onPractice={(route) => navigate(route)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Score trend */}
          <section>
            <SectionHead icon={<TrendingUp size={15} />} title={t('tsProgress')} />
            <div className="rounded-card border border-line bg-card p-4">
              <ScoreTrendChart points={trendPoints} avgLabel={t('tsAverage')} />
            </div>
          </section>

          {/* Subject performance */}
          {subjectRows.length > 0 && (
            <section>
              <SectionHead icon={<BarChart2 size={15} />} title={t('tsSubjectPerf')} />
              {weakSubjects.length > 0 && <p className="tamil mb-2.5 font-body text-sm text-muted">{t('tsFocusHint')}</p>}
              <div className="rounded-card border border-line bg-card p-4">
                <SubjectBarChart
                  rows={subjectRows}
                  avg={overallAcc}
                  avgLabel={t('tsAverage')}
                  practiceLabel={t('tsPractice')}
                  onPractice={(key) => navigate(practiceRouteForSubject(key))}
                />
              </div>
            </section>
          )}

          {/* Detailed attempt log */}
          <section>
            <SectionHead icon={<ListChecks size={15} />} title={t('tsYourAttempts')} />
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
              {attempts.map((a) => (
                <AttemptRow key={a.id} a={a} ta={lang === 'ta'} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-7">
          {/* Weakest-type tip (the actionable takeaway for this lens) */}
          {weakType && (
            <section className="flex items-start gap-2.5 rounded-card border border-accentwarm/30 bg-accentwarmsoft p-4">
              <Layers size={16} className="mt-0.5 shrink-0 text-accentwarm" />
              <p className="tamil min-w-0 flex-1 font-body text-sm leading-snug text-ink">
                {t('tsAdviceType')
                  .replace('{type}', t(qtypeLabelKey(weakType.key)))
                  .replace('{acc}', String(weakType.accuracy))}
              </p>
            </section>
          )}

          {/* Composition donut */}
          {typeSlices.length > 0 && (
            <section>
              <SectionHead icon={<PieChart size={15} />} title={t('tsTypeMix')} />
              <div className="rounded-card border border-line bg-card p-4">
                <QuestionTypeDonut slices={typeSlices} centerTop={String(totalQ)} centerBottom={t('tsQuestions')} />
              </div>
            </section>
          )}

          {/* Accuracy per type */}
          {typeRows.length > 0 && (
            <section>
              <SectionHead icon={<BarChart2 size={15} />} title={t('tsTypeAccuracy')} />
              <div className="rounded-card border border-line bg-card p-4">
                <SubjectBarChart
                  rows={typeRows}
                  avg={0}
                  avgLabel={t('tsAverage')}
                  practiceLabel={t('tsPractice')}
                  onPractice={() => undefined}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** Segmented control switching between the two analytics lenses. */
function SegTabs({
  value,
  onChange,
  tabs,
}: {
  value: SubView
  onChange: (v: SubView) => void
  tabs: { key: SubView; label: string; Icon: typeof TrendingUp }[]
}) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-card p-1">
      {tabs.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 font-heading text-sm font-semibold transition-colors',
            value === key ? 'bg-brand-gradient text-white' : 'text-ink2 hover:text-ink',
          ].join(' ')}
        >
          <Icon size={14} /> <span className="tamil">{label}</span>
        </button>
      ))}
    </div>
  )
}

/** Compose one advice item into a bilingual sentence (templates live in i18n). */
function adviceText(t: ReturnType<typeof useT>['t'], item: Advice): string {
  switch (item.kind) {
    case 'trend':
      if (item.dir === 'up') return t('tsAdviceTrendUp').replace('{delta}', String(item.delta))
      if (item.dir === 'down') return t('tsAdviceTrendDown').replace('{delta}', String(item.delta))
      return t('tsAdviceTrendFlat').replace('{last}', String(item.last))
    case 'focus':
      return t('tsAdviceFocus').replace('{subject}', item.subject).replace('{acc}', String(item.accuracy))
    case 'type':
      return t('tsAdviceType').replace('{type}', t(qtypeLabelKey(item.typeKey))).replace('{acc}', String(item.accuracy))
    case 'strength':
      return t('tsAdviceStrength').replace('{subject}', item.subject).replace('{acc}', String(item.accuracy))
  }
}

function AdviceRow({
  item,
  text,
  practiceLabel,
  onPractice,
}: {
  item: Advice
  text: string
  practiceLabel: string
  onPractice: (route: string) => void
}) {
  const meta = {
    trend:
      item.kind === 'trend' && item.dir === 'down'
        ? { Icon: TrendingDown, color: 'text-coral' }
        : item.kind === 'trend' && item.dir === 'up'
          ? { Icon: TrendingUp, color: 'text-mint' }
          : { Icon: TrendingUp, color: 'text-gold' },
    focus: { Icon: Target, color: 'text-coral' },
    type: { Icon: Layers, color: 'text-gold' },
    strength: { Icon: Award, color: 'text-mint' },
  }[item.kind]
  const Icon = meta.Icon
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
      <p className="tamil min-w-0 flex-1 font-body text-sm leading-snug text-ink">
        {text}
        {item.kind === 'focus' && (
          <button
            onClick={() => onPractice(item.route)}
            className="ml-1.5 whitespace-nowrap font-heading text-xs font-bold text-primary transition-opacity hover:opacity-80"
          >
            {practiceLabel} →
          </button>
        )}
      </p>
    </div>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-card border border-line bg-card px-2 py-3 text-center">
      <div className={`font-display text-xl font-bold leading-none ${tint ?? 'text-ink'}`}>{value}</div>
      <div className="tamil mt-1.5 font-body text-2xs uppercase tracking-wide text-ink2">{label}</div>
    </div>
  )
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="tamil font-heading text-sm font-bold uppercase tracking-wide text-ink2">{title}</h2>
    </div>
  )
}

function AttemptRow({ a, ta }: { a: TestSeriesAttempt; ta: boolean }) {
  const title = ta && a.title_ta ? a.title_ta : a.title
  const unit = ta && a.unit_label_ta ? a.unit_label_ta : a.unit_label
  const sub = [a.correct != null && a.total ? `${a.correct}/${a.total}` : null, fmtDate(a.submitted_at)]
    .filter(Boolean)
    .join('  ·  ')
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="tamil truncate font-heading text-sm font-semibold text-ink">
          {title}
          {unit && <span className="ml-1.5 font-body text-2xs font-normal text-muted">{unit}</span>}
        </p>
        {sub && <p className="font-body text-2xs text-ink2">{sub}</p>}
      </div>
      <span className={`shrink-0 font-display text-lg font-bold ${scoreText(a.score)}`}>{a.score}%</span>
    </div>
  )
}
