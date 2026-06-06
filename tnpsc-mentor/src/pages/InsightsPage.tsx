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
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('insightsTitle')}</YellowBadge>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        )}

        {!loading && !hasData && (
          <p className="tamil py-12 text-center font-body text-white/60">{t('noData')}</p>
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
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-secondary/40 to-primary/40 p-4 text-center">
                <div className="tamil font-heading text-xs font-bold uppercase tracking-widest text-white/60">
                  {t('yourRank')}
                </div>
                <div className="tamil mt-1 font-body text-white">
                  {t('aheadOf')}{' '}
                  <span className="font-heading text-2xl font-bold text-accent">{percentile}%</span>{' '}
                  {t('ofAspirants')}
                </div>
              </div>
            )}

            {/* Syllabus coverage */}
            {syllabusSubjects.length > 0 && (
              <section className="mb-8">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="tamil font-heading text-lg font-bold uppercase tracking-wide text-white">
                    {t('syllabusCoverage')}
                  </h3>
                  <span className="font-heading text-sm font-bold text-accent">
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
                          done ? 'bg-green-500/20 text-green-300' : 'bg-white/8 text-white/45',
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
                <h3 className="tamil mb-1 font-heading text-lg font-bold uppercase tracking-wide text-white">
                  {t('focusAreas')}
                </h3>
                <p className="tamil mb-4 font-body text-sm text-white/55">{t('focusHint')}</p>
                <div className="flex flex-col gap-3">
                  {weak.map((w) => {
                    const asset = assetsFor(w.key)
                    return (
                      <div key={w.key} className="rounded-2xl bg-white p-4 shadow-card">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="tamil font-heading font-bold text-navytext">{w.key}</span>
                          <span className="font-heading text-sm font-bold text-warn">{w.accuracy}%</span>
                        </div>
                        <ProgressBar percent={w.accuracy} color="#FF5722" height={6} />
                        <p className="tamil mt-3 font-body text-xs leading-relaxed text-navytext/70">
                          <span className="font-bold text-secondary">{t('studyTip')}: </span>
                          {lang === 'ta' ? asset.tipTa : asset.tip}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {asset.links.slice(0, 3).map((l) => (
                            <a
                              key={l.url}
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-primary/10 px-3 py-1 font-heading text-[11px] font-semibold text-primary transition hover:bg-primary/20"
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
                <h3 className="tamil mb-4 font-heading text-lg font-bold uppercase tracking-wide text-white">
                  {t('bySubject')}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {data.bySubject.map((s) => (
                    <div key={s.key} className="rounded-xl bg-white/5 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="tamil font-body text-sm text-white/85">{s.key}</span>
                        <span className="font-heading text-sm font-bold text-white">
                          {s.accuracy}%{' '}
                          <span className="text-white/40">({s.correct}/{s.attempted})</span>
                        </span>
                      </div>
                      <ProgressBar
                        percent={s.accuracy}
                        color={s.accuracy >= 75 ? '#16a34a' : s.accuracy >= 50 ? '#FFC107' : '#FF5722'}
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
                <h3 className="tamil mb-3 flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-white">
                  <TrendingUp size={18} className="text-green-400" /> {t('strengths')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {strong.map((s) => (
                    <span
                      key={s.key}
                      className="tamil rounded-full bg-green-500/20 px-3 py-1.5 font-heading text-sm font-semibold text-green-300"
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
    <div className="rounded-2xl bg-white/8 p-4 text-center">
      <div className="mb-1 flex items-center justify-center text-accent">{icon}</div>
      <div className="font-heading text-xl font-bold text-white">{value}</div>
      <div className="tamil font-body text-[11px] uppercase tracking-wide text-white/50">{label}</div>
    </div>
  )
}
