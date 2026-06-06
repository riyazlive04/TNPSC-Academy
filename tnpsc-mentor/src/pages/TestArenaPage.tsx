import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  GraduationCap,
  Newspaper,
  Calculator,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  FileText,
  Flame,
  CalendarClock,
  Target,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import ProgressBar from '../components/UI/ProgressBar'
import { useAuth } from '../hooks/useAuth'
import { fetchHabit, type HabitState } from '../lib/habit'
import { useT, type StringKey } from '../lib/i18n'

interface ArenaCard {
  to: string
  titleKey: StringKey
  icon: React.ReactNode
  /** preview lines shown in the hover tooltip */
  preview: string[]
}

const CARDS: ArenaCard[] = [
  {
    to: '/test-arena/pyq',
    titleKey: 'pyqTitle',
    icon: <BookOpen size={32} />,
    preview: ['Group 1', 'Group 2 / 2A', 'Group 4 & VAO', '10 subjects each'],
  },
  {
    to: '/test-arena/samacheer',
    titleKey: 'samacheerTitle',
    icon: <GraduationCap size={32} />,
    preview: ['Subject → Standard', '6th · 7th · 8th · 9th · 10th', 'Topic-wise tests'],
  },
  {
    to: '/test-arena/current-affairs',
    titleKey: 'currentAffairsTitle',
    icon: <Newspaper size={32} />,
    preview: ['Month Wise (Aug 2025 – Jun 2026)', 'Topic Wise', 'Updated monthly'],
  },
  {
    to: '/test-arena/aptitude',
    titleKey: 'aptitudeTitle',
    icon: <Calculator size={32} />,
    preview: ['Numerics — 12 topics', 'Reasoning — 8 topics'],
  },
]

export default function TestArenaPage() {
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const { t } = useT()
  const [hovered, setHovered] = useState<string | null>(null)
  const [habit, setHabit] = useState<HabitState | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null)
      .then((h) => !cancelled && setHabit(h))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, profile?.daily_goal, profile?.exam_date])

  const needsSetup = profile && !profile.exam_date

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <YellowBadge>{t('testArena')}</YellowBadge>
          <p className="tamil font-body text-sm text-white/60">
            {t('welcome')}
            {profile?.full_name ? `, ${profile.full_name}` : ''}. {t('chooseCategory')}
          </p>
        </div>

        {isAdmin && (
          <div className="mx-auto mb-6 mt-4 flex max-w-xl items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-center">
            <ShieldCheck size={18} className="flex-shrink-0 text-accent" />
            <p className="tamil font-body text-sm text-white/80">{t('adminModeNote')}</p>
          </div>
        )}

        {/* Habit strip: streak · daily goal · exam countdown */}
        {habit && (
          <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
              <Flame size={22} className="flex-shrink-0 text-orange-400" />
              <div>
                <div className="font-heading text-xl font-bold text-white">{habit.currentStreak}</div>
                <div className="tamil font-body text-[11px] uppercase tracking-wide text-white/50">
                  {t('dayStreak')}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white/8 px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="tamil flex items-center gap-1.5 font-heading text-[11px] uppercase tracking-wide text-white/60">
                  <Target size={13} /> {t('dailyGoal')}
                </span>
                <span className="font-heading text-xs font-bold text-white">
                  {habit.questionsToday}/{habit.dailyGoal}
                </span>
              </div>
              <ProgressBar
                percent={Math.min(100, (habit.questionsToday / Math.max(1, habit.dailyGoal)) * 100)}
                color={habit.goalMetToday ? '#16a34a' : '#FFC107'}
                height={6}
              />
            </div>
            {habit.daysToExam != null ? (
              <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
                <CalendarClock size={22} className="flex-shrink-0 text-accent" />
                <div>
                  <div className="font-heading text-xl font-bold text-white">
                    {Math.max(0, habit.daysToExam)}
                  </div>
                  <div className="tamil font-body text-[11px] uppercase tracking-wide text-white/50">
                    {t('daysToExam')}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => navigate('/setup')}
                className="flex items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent/20"
              >
                <CalendarClock size={16} /> {t('setExamDate')}
              </button>
            )}
          </div>
        )}

        {needsSetup && (
          <div className="mx-auto mt-3 max-w-2xl text-center">
            <button
              onClick={() => navigate('/setup')}
              className="tamil font-heading text-sm font-semibold uppercase tracking-wide text-accent transition hover:text-white"
            >
              {t('setExamDate')} →
            </button>
          </div>
        )}

        {/* Hover note from the design reference */}
        <p className="tamil mb-6 mt-6 text-center font-heading text-xs uppercase tracking-widest text-white/40">
          {t('hoverPreview')}
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div
              key={card.to}
              className="relative"
              onMouseEnter={() => setHovered(card.to)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                onClick={() => navigate(card.to)}
                className="flex w-full items-center gap-4 rounded-3xl bg-white px-6 py-6 text-left shadow-pill transition-all duration-200 hover:-translate-y-1 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {card.icon}
                </span>
                <span className="tamil font-heading text-lg font-bold leading-tight text-navytext">
                  {t(card.titleKey)}
                </span>
              </button>

              {/* Hover preview tooltip */}
              {hovered === card.to && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 animate-pop rounded-2xl bg-navytext p-4 text-left shadow-card">
                  <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-navytext" />
                  <p className="tamil mb-2 font-heading text-xs font-bold uppercase tracking-wide text-accent">
                    {t('insideSection')}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {card.preview.map((line) => (
                      <li
                        key={line}
                        className="flex items-center gap-2 font-body text-sm text-white/85"
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick access — study loop */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink
            icon={<Newspaper size={18} />}
            label={t('daily')}
            onClick={() => navigate('/daily')}
          />
          <QuickLink
            icon={<TrendingUp size={18} />}
            label={t('insights')}
            onClick={() => navigate('/insights')}
          />
          <QuickLink
            icon={<RefreshCw size={18} />}
            label={t('revision')}
            onClick={() => navigate('/revision')}
          />
          <QuickLink
            icon={<FileText size={18} />}
            label={t('mockTests')}
            onClick={() => navigate('/mock')}
          />
        </div>
      </div>
    </AppLayout>
  )
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-white/10"
    >
      <span className="text-accent">{icon}</span>
      <span className="tamil">{label}</span>
    </button>
  )
}
