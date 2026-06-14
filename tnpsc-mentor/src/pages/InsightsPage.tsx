import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  Loader2,
  Target,
  TrendingUp,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import ProgressBar from '../components/UI/ProgressBar'
import { fetchUserAnalytics, weakAreas, type UserAnalytics } from '../lib/analytics'
import { fetchPercentile } from '../lib/habit'
import { assetsFor } from '../lib/assets'
import { GROUP_SUBJECTS } from '../lib/constants'
import type { GroupType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'

export default function InsightsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t, lang } = useT()
  const [data, setData] = useState<UserAnalytics | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([fetchUserAnalytics(user.id), fetchPercentile(user.id)])
      .then(([d, p]) => {
        if (cancelled) return
        setData(d)
        setPercentile(p)
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user])

  // Syllabus coverage: subjects practised vs the target group's subject list.
  const group = (profile?.target_group as GroupType) || 'Group1'
  const syllabusSubjects = GROUP_SUBJECTS[group] ?? []
  const practised = new Set((data?.bySubject ?? []).map((s) => s.key))
  const coveredCount = syllabusSubjects.filter((s) => practised.has(s)).length
  const coveragePct = syllabusSubjects.length
    ? Math.round((coveredCount / syllabusSubjects.length) * 100)
    : 0

  const weak = data ? weakAreas(data.byTopic, 60).slice(0, 6) : []
  const strong = data ? [...data.byTopic].filter((s) => s.accuracy >= 75).slice(0, 5) : []
  const hasData = data && data.overview.testsTaken > 0

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('insightsTitle')}</YellowBadge>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        )}

        {!loading && !hasData && (
          <p className="tamil py-12 text-center font-body text-ink2">{t('noData')}</p>
        )}

        {!loading && hasData && data && (
          <>
            {/* Overview stat cards */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<BookOpen size={18} />} label={t('testsTaken')} value={String(data.overview.testsTaken)} />
              <StatCard icon={<Target size={18} />} label={t('avgAccuracy')} value={`${data.overview.avgAccuracy}%`} />
              <StatCard icon={<Award size={18} />} label={t('bestScore')} value={`${data.overview.bestScore}%`} />
              <StatCard icon={<Clock size={18} />} label={t('studyTime')} value={`${data.overview.totalTimeMinutes}m`} />
            </div>

            {/* Percentile / peer rank */}
            {percentile != null && (
              <div className="mb-6 overflow-hidden rounded-3xl bg-brand-gradient p-5 text-center">
                <div className="tamil font-heading text-xs font-semibold uppercase tracking-widest text-white/50">
                  {t('yourRank')}
                </div>
                <div className="tamil mt-1 font-body text-white/80">
                  {t('aheadOf')}{' '}
                  <span className="font-heading text-2xl font-semibold text-white">{percentile}%</span>{' '}
                  {t('ofAspirants')}
                </div>
              </div>
            )}

            {/* Syllabus coverage */}
            {syllabusSubjects.length > 0 && (
              <section className="mb-8">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="tamil font-heading text-lg font-extrabold tracking-tight text-ink">
                    {t('syllabusCoverage')}
                  </h3>
                  <span className="font-heading text-sm font-bold text-brand">
                    {coveredCount}/{syllabusSubjects.length} · {coveragePct}%
                  </span>
                </div>
                <ProgressBar percent={coveragePct} height={8} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {syllabusSubjects.map((s) => {
                    const done = practised.has(s)
                    return (
                      <span
                        key={s}
                        className={[
                          'tamil rounded-full px-3 py-1 font-heading text-[11px] font-semibold',
                          done ? 'bg-mintsoft text-mint' : 'bg-canvas text-ink2',
                        ].join(' ')}
                      >
                        {done ? '✓ ' : ''}
                        {s}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Focus areas (weak) with learn links */}
            {weak.length > 0 && (
              <section className="mb-8">
                <h3 className="tamil mb-1 font-heading text-lg font-extrabold tracking-tight text-ink">
                  {t('focusAreas')}
                </h3>
                <p className="tamil mb-4 font-body text-sm text-ink2">{t('focusHint')}</p>
                <div className="flex flex-col gap-3">
                  {weak.map((w) => {
                    const asset = assetsFor(w.key)
                    return (
                      <div key={w.key} className="card p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="tamil min-w-0 break-words font-heading font-bold text-ink">{w.key}</span>
                          <span className="flex-shrink-0 font-heading text-sm font-bold text-coral">{w.accuracy}%</span>
                        </div>
                        <ProgressBar percent={w.accuracy} color="#E5484D" height={6} />
                        <p className="tamil mt-3 font-body text-xs leading-relaxed text-ink2">
                          <span className="font-bold text-brand">{t('studyTip')}: </span>
                          {lang === 'ta' ? asset.tipTa : asset.tip}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {asset.links.slice(0, 3).map((l) => (
                            <a
                              key={l.url}
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-brand-soft px-3 py-1 font-heading text-[11px] font-semibold text-brand transition hover:bg-brand-ring/40"
                            >
                              {l.label} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* By subject */}
            {data.bySubject.length > 0 && (
              <section className="mb-8">
                <h3 className="tamil mb-4 font-heading text-lg font-extrabold tracking-tight text-ink">
                  {t('bySubject')}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {data.bySubject.map((s) => (
                    <div key={s.key} className="card p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="tamil min-w-0 break-words font-body text-sm font-medium text-ink">{s.key}</span>
                        <span className="flex-shrink-0 font-heading text-sm font-bold text-ink">
                          {s.accuracy}%{' '}
                          <span className="text-ink2/50">({s.correct}/{s.attempted})</span>
                        </span>
                      </div>
                      <ProgressBar
                        percent={s.accuracy}
                        color={s.accuracy >= 75 ? '#16A34A' : s.accuracy >= 50 ? '#B7791F' : '#E5484D'}
                        height={6}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Strengths */}
            {strong.length > 0 && (
              <section className="mb-8">
                <h3 className="tamil mb-3 flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight text-ink">
                  <TrendingUp size={18} className="text-mint" /> {t('strengths')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {strong.map((s) => (
                    <span
                      key={s.key}
                      className="tamil rounded-full bg-mintsoft px-3 py-1.5 font-heading text-sm font-semibold text-mint"
                    >
                      {s.key} · {s.accuracy}%
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="card p-4 text-center">
      <div className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-lg bg-tint text-ink2">
        {icon}
      </div>
      <div className="font-heading text-xl font-semibold text-ink">{value}</div>
      <div className="tamil font-body text-[11px] uppercase tracking-wide text-ink2">{label}</div>
    </div>
  )
}
