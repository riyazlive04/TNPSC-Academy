import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import ProgressBar from '../components/UI/ProgressBar'
import StatStrip from '../components/UI/StatStrip'
import { SkeletonAnalytics } from '../components/UI/Skeleton'
import ErrorState from '../components/UI/ErrorState'
import { fetchUserAnalytics, weakAreas, type UserAnalytics } from '../lib/analytics'
import { fetchHabit, fetchPercentile, type HabitState } from '../lib/habit'
import { SHOW_STREAK } from '../lib/features'
import { assetsFor } from '../lib/assets'
import { GROUP_SUBJECTS, subjectName } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

// Accuracy → semantic colour (token-backed: correct / gold / wrong).
const accColor = (a: number) =>
  a >= 75 ? 'rgb(var(--c-mint))' : a >= 50 ? 'rgb(var(--c-gold))' : 'rgb(var(--c-coral))'
// Accuracy → soft chip classes. Untested (0 attempted) reads neutral, not red.
const accChip = (a: number, attempted: number) =>
  attempted === 0
    ? 'bg-tint text-ink2'
    : a >= 75
      ? 'bg-mintsoft text-mint'
      : a >= 50
        ? 'bg-goldsoft text-gold'
        : 'bg-coralsoft text-coral'

export default function InsightsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t, lang } = useT()
  const [data, setData] = useState<UserAnalytics | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [habit, setHabit] = useState<HabitState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [subjectSort, setSubjectSort] = useState<'accuracy' | 'volume'>('accuracy')
  const [subjectPage, setSubjectPage] = useState(0)
  // Bumped by ErrorState's retry button to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchUserAnalytics(user.id),
      fetchPercentile(user.id),
      fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null),
    ])
      .then(([d, p, h]) => {
        if (cancelled) return
        setData(d)
        setPercentile(p)
        setHabit(h)
      })
      .catch((e) => {
        if (cancelled) return
        setData(null)
        setError(e)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user, profile?.daily_goal, profile?.exam_date, reloadKey])

  // Syllabus coverage: subjects practised vs the target group's subject list.
  const group = (profile?.target_group as GroupType) || 'Group1'
  const syllabusSubjects = GROUP_SUBJECTS[group] ?? []
  const practised = new Set((data?.bySubject ?? []).map((s) => s.key))
  const coveredCount = syllabusSubjects.filter((s) => practised.has(s)).length
  const coveragePct = syllabusSubjects.length
    ? Math.round((coveredCount / syllabusSubjects.length) * 100)
    : 0

  const weak = data ? weakAreas(data.byTopic, 60).slice(0, 6) : []
  const strong = data ? [...data.byTopic].filter((s) => s.accuracy >= 75).slice(0, 6) : []
  const hasData = data && data.overview.testsTaken > 0

  // By-subject list, sorted strongest-first by default (the weakest already live
  // under Focus Areas), or by attempt volume when the user toggles.
  const bySubjectSorted = useMemo(() => {
    const arr = [...(data?.bySubject ?? [])]
    if (subjectSort === 'volume') arr.sort((a, b) => b.attempted - a.attempted)
    else arr.sort((a, b) => b.accuracy - a.accuracy || b.attempted - a.attempted)
    return arr
  }, [data, subjectSort])

  // Paginate the subject grid so a long syllabus doesn't dominate the page.
  const SUBJECTS_PER_PAGE = 8
  const subjectPageCount = Math.max(1, Math.ceil(bySubjectSorted.length / SUBJECTS_PER_PAGE))
  const subjectPageSafe = Math.min(subjectPage, subjectPageCount - 1)
  const subjectStart = subjectPageSafe * SUBJECTS_PER_PAGE
  const subjectSlice = bySubjectSorted.slice(subjectStart, subjectStart + SUBJECTS_PER_PAGE)

  // Reset to the first page whenever the sort order changes.
  useEffect(() => {
    setSubjectPage(0)
  }, [subjectSort])

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <header className="mb-7 mt-4">
          <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
            {t('insightsTitle')}
          </h1>
        </header>

        {loading && <SkeletonAnalytics />}

        {!loading && error != null && (
          <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
        )}

        {!loading && error == null && !hasData && (
          <div className="flex flex-col items-center gap-5 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Sparkles size={28} />
            </span>
            <p className="tamil max-w-xs font-body text-ink2">{t('noData')}</p>
            <button onClick={() => navigate('/mock')} className="btn-brand btn-lg">
              {t('takeATest')}
            </button>
          </div>
        )}

        {!loading && hasData && data && (
          <div className="space-y-6">
            {/* ── Hero: overall accuracy ring + headline stats ── */}
            <section className="hero-panel grid grid-cols-1 items-center gap-6 p-6 sm:grid-cols-[auto,1fr] sm:p-7">
              <div className="mx-auto sm:mx-0">
                <Ring percent={data.overview.avgAccuracy} sublabel={t('overallAccuracy')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HeroStat
                  icon={<Award size={16} />}
                  label={t('bestScore')}
                  value={`${data.overview.bestScore}%`}
                />
                <HeroStat
                  icon={<Target size={16} />}
                  label={t('avgScoreLabel')}
                  value={`${data.overview.avgScore}%`}
                />
                <HeroStat
                  icon={<BookOpen size={16} />}
                  label={t('testsTaken')}
                  value={String(data.overview.testsTaken)}
                />
                <HeroStat
                  icon={<Users size={16} />}
                  label={t('stateLevelAnalytics')}
                  value={percentile != null ? `Top ${100 - percentile}%` : '-'}
                />
              </div>
            </section>

            {/* ── Quick stats ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Target size={18} />} label={t('avgAccuracy')} value={`${data.overview.avgAccuracy}%`} />
              <StatCard icon={<HelpCircle size={18} />} label={t('questionsAnswered')} value={String(data.overview.totalQuestions)} />
              <StatCard icon={<TrendingUp size={18} />} label={t('bestScore')} value={`${data.overview.bestScore}%`} />
              <StatCard icon={<Clock size={18} />} label={t('studyTime')} value={`${data.overview.totalTimeMinutes}m`} />
            </div>

            {/* ── Consistency: the habit numbers behind the streak ── */}
            {SHOW_STREAK && habit && (
              <section className="rounded-card border border-line bg-card p-5">
                <h3 className="tamil mb-4 font-heading text-base font-semibold tracking-tight text-ink">
                  {t('consistency')}
                </h3>
                <StatStrip
                  items={[
                    {
                      label: t('dayStreak'),
                      value: habit.currentStreak,
                      accent: habit.currentStreak > 0,
                    },
                    { label: t('bestStreak'), value: habit.longestStreak },
                    { label: t('daysStudied30'), value: habit.last30.length },
                  ]}
                />
              </section>
            )}

            {/* ── Performance trend ── */}
            {data.trend.length >= 2 && (
              <section className="rounded-card border border-line bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-heading text-base font-semibold tracking-tight text-ink">
                    {t('performanceTrend')}
                  </h3>
                  <span className="font-body text-xs text-ink2">
                    {t('recentTests')} · {data.trend.length}
                  </span>
                </div>
                <TrendChart points={data.trend} />
              </section>
            )}

            {/* ── Syllabus coverage ── */}
            {syllabusSubjects.length > 0 && (
              <section className="rounded-card border border-line bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="tamil font-heading text-base font-semibold tracking-tight text-ink">
                    {t('syllabusCoverage')}
                  </h3>
                  <span className="font-heading text-sm font-bold text-brand">
                    {coveredCount}/{syllabusSubjects.length} · {coveragePct}%
                  </span>
                </div>
                <ProgressBar percent={coveragePct} height={8} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {syllabusSubjects.map((s) => {
                    const done = practised.has(s)
                    return (
                      <span
                        key={s}
                        className={[
                          'tamil inline-flex items-center gap-1 rounded-full px-3 py-1 font-heading text-2xs font-semibold',
                          done ? 'bg-mintsoft text-mint' : 'bg-tint text-ink2',
                        ].join(' ')}
                      >
                        {done && '✓'} {s}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Strengths ── */}
            {strong.length > 0 && (
              <section className="rounded-card border border-line bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-ink">
                  <TrendingUp size={18} className="text-mint" /> {t('strengths')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {strong.map((s) => (
                    <span
                      key={s.key}
                      className="tamil inline-flex items-center gap-1.5 rounded-full bg-mintsoft px-3 py-1.5 font-heading text-sm font-semibold text-mint"
                    >
                      {subjectName(s.key, lang)}
                      <span className="rounded-full bg-mint/15 px-1.5 text-xs">{s.accuracy}%</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Focus areas (weak) with study tips + links ── */}
            {weak.length > 0 && (
              <section>
                <div className="mb-3 px-1">
                  <h3 className="tamil font-heading text-base font-semibold tracking-tight text-ink">
                    {t('focusAreas')}
                  </h3>
                  <p className="tamil mt-0.5 font-body text-sm text-ink2">{t('focusHint')}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {weak.map((w) => {
                    const asset = assetsFor(w.key)
                    return (
                      <div key={w.key} className="rounded-card border border-line bg-card flex flex-col p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="tamil min-w-0 break-words font-heading text-sm font-bold text-ink">
                            {subjectName(w.key, lang)}
                          </span>
                          <span className="flex-shrink-0 rounded-md bg-coralsoft px-2 py-0.5 font-heading text-xs font-bold text-coral">
                            {w.accuracy}%
                          </span>
                        </div>
                        <ProgressBar percent={w.accuracy} color="rgb(var(--c-coral))" height={6} />
                        <p className="tamil mt-3 font-body text-xs leading-relaxed text-ink2">
                          <span className="font-bold text-brand">{t('studyTip')}: </span>
                          {lang === 'ta' ? asset.tipTa : asset.tip}
                        </p>
                        {asset.links.length > 0 && (
                          <div className="mt-auto flex flex-wrap gap-2 pt-3">
                            {asset.links.slice(0, 3).map((l) => (
                              <a
                                key={l.url}
                                href={l.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full bg-brand-soft px-3 py-1 font-heading text-2xs font-semibold text-brand transition hover:bg-brand-ring/40"
                              >
                                {l.label} ↗
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── By subject ── */}
            {data.bySubject.length > 0 && (
              <section className="rounded-card border border-line bg-card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="tamil font-heading text-base font-semibold tracking-tight text-ink">
                    {t('bySubject')}
                  </h3>
                  <div className="seg-wrap">
                    <button
                      onClick={() => setSubjectSort('accuracy')}
                      className={['seg', subjectSort === 'accuracy' ? 'seg-active' : ''].join(' ')}
                    >
                      {t('sortAccuracy')}
                    </button>
                    <button
                      onClick={() => setSubjectSort('volume')}
                      className={['seg', subjectSort === 'volume' ? 'seg-active' : ''].join(' ')}
                    >
                      {t('sortVolume')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {subjectSlice.map((s) => (
                    <div
                      key={s.key}
                      className="rounded-xl border border-line bg-card p-3.5 transition-colors hover:border-brand-ring"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="tamil min-w-0 break-words font-heading text-sm font-semibold leading-snug text-ink">
                          {subjectName(s.key, lang)}
                        </span>
                        <span
                          className={[
                            'flex-shrink-0 rounded-md px-2 py-0.5 font-heading text-xs font-bold',
                            accChip(s.accuracy, s.attempted),
                          ].join(' ')}
                        >
                          {s.accuracy}%
                        </span>
                      </div>
                      <ProgressBar percent={s.accuracy} color={accColor(s.accuracy)} height={6} />
                      <div className="mt-2 font-body text-2xs text-ink2">
                        {s.attempted === 0 ? (
                          t('notAttemptedYet')
                        ) : (
                          <>
                            <span className="font-heading font-semibold text-ink">{s.correct}</span>
                            {' / '}
                            {s.attempted} {t('correctLabel')}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {subjectPageCount > 1 && (
                  <Paginator
                    page={subjectPageSafe}
                    pageCount={subjectPageCount}
                    onJump={setSubjectPage}
                    prevLabel={t('prev')}
                    nextLabel={t('next')}
                  />
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Circular accuracy gauge (rendered on the gradient hero) ─────────────────
function Ring({ percent, sublabel, size = 132, stroke = 11 }: { percent: number; sublabel: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circ - (clamped / 100) * circ
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="stroke-white transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-heading text-3xl font-bold leading-none text-white">{percent}%</div>
        <div className="mt-1 max-w-[88px] font-body text-2xs uppercase leading-tight tracking-wide text-white/60">
          {sublabel}
        </div>
      </div>
    </div>
  )
}

// ─── Inline line chart for the last-N test scores ────────────────────────────
function TrendChart({ points }: { points: { accuracy: number; label: string }[] }) {
  const W = 640
  const H = 180
  const padX = 28
  const padY = 22
  const n = points.length
  const x = (i: number) => padX + (n === 1 ? 0 : (i * (W - 2 * padX)) / (n - 1))
  const y = (v: number) => padY + (1 - v / 100) * (H - 2 * padY)

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.accuracy)}`).join(' ')
  const area = `${line} L ${x(n - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Performance trend">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--c-brand))' }} stopOpacity="0.22" />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--c-brand))' }} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines at 0 / 50 / 100 */}
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padX} y1={y(g)} x2={W - padX} y2={y(g)} className="stroke-line" strokeWidth={1} />
          <text x={4} y={y(g) + 3} className="fill-ink2 font-body" fontSize={10}>
            {g}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" className="stroke-brand" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.accuracy)} r={4} className="fill-card stroke-brand" strokeWidth={2.5} />
      ))}
    </svg>
  )
}

// ─── Small stat tiles ────────────────────────────────────────────────────────
function HeroStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 font-body text-2xs uppercase tracking-wide text-white/55">
        <span className="text-white/70">{icon}</span>
        <span className="tamil truncate">{label}</span>
      </div>
      <div className="mt-1 font-heading text-xl font-bold text-white">{value}</div>
    </div>
  )
}

// ─── Windowed page-number bar (Prev · 1 … 3 4 5 … N · Next) ──────────────────
function Paginator({
  page,
  pageCount,
  onJump,
  prevLabel,
  nextLabel,
}: {
  page: number
  pageCount: number
  onJump: (p: number) => void
  prevLabel: string
  nextLabel: string
}) {
  const items: (number | 'gap')[] = []
  for (let p = 0; p < pageCount; p++) {
    if (p === 0 || p === pageCount - 1 || Math.abs(p - page) <= 1) items.push(p)
    else if (items[items.length - 1] !== 'gap') items.push('gap')
  }
  return (
    <nav className="mt-5 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pages">
      <button
        onClick={() => onJump(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label={prevLabel}
        className="icon-btn h-9 w-9 disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      {items.map((it, idx) =>
        it === 'gap' ? (
          <span key={`gap-${idx}`} className="px-1 font-body text-sm text-ink2">
            …
          </span>
        ) : (
          <button
            key={it}
            onClick={() => onJump(it)}
            aria-current={it === page ? 'page' : undefined}
            className={[
              'grid h-9 min-w-9 place-items-center rounded-lg px-2 font-heading text-sm font-semibold tabular-nums transition',
              it === page
                ? 'bg-brand text-white'
                : 'border border-line bg-card text-ink2 hover:border-brand-ring',
            ].join(' ')}
          >
            {it + 1}
          </button>
        )
      )}
      <button
        onClick={() => onJump(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        aria-label={nextLabel}
        className="icon-btn h-9 w-9 disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-card p-4 text-center">
      <div className="mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
        {icon}
      </div>
      <div className="font-heading text-xl font-bold text-ink">{value}</div>
      <div className="tamil font-body text-2xs uppercase tracking-wide text-ink2">{label}</div>
    </div>
  )
}
