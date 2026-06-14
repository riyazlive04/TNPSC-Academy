import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  Home,
  Lock,
  RefreshCw,
  Target,
  Timer as TimerIcon,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import RewardOverlay, { type DailyReward } from '../components/RewardOverlay'
import ResultCard from '../components/Quiz/ResultCard'
import { formatTime } from '../components/UI/Timer'
import { generateExplanationPdf } from '../lib/pdfGenerator'
import { describeConfig } from '../lib/fetchQuestions'
import { addBookmark, fetchBookmarkIds, removeBookmark } from '../lib/bookmarks'
import { scoreByTopic, weakAreas, fetchUserAnalytics } from '../lib/analytics'
import { fetchHabit } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type Badge, type GameStats } from '../lib/achievements'
import { GROUP_SUBJECTS } from '../lib/constants'
import { assetsFor } from '../lib/assets'
import { useAuth } from '../hooks/useAuth'
import { useProgressStore } from '../store/progressStore'
import { useT } from '../lib/i18n'
import type { GroupType, Question, ResultPayload, TestAnswer } from '../types'

type ReviewFilter = 'all' | 'wrong' | 'skipped' | 'correct' | 'flagged'

/** Bucket a question by how the user answered it (for the review filter). */
function classifyAnswer(answer?: TestAnswer): 'correct' | 'wrong' | 'skipped' {
  if (!answer?.selected_answer) return 'skipped'
  return answer.is_correct ? 'correct' : 'wrong'
}

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const { user, profile } = useAuth()
  const claim = useProgressStore((s) => s.claim)
  const claimDaily = useProgressStore((s) => s.claimDaily)
  const payload = location.state as ResultPayload | null

  const [generating, setGenerating] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set())
  const [rewards, setRewards] = useState<{
    leveledTo: number | null
    newBadges: Badge[]
    daily: DailyReward | null
  } | null>(null)

  // Guard — no result data means a direct visit; bounce home.
  useEffect(() => {
    if (!payload) navigate('/test-arena', { replace: true })
  }, [payload, navigate])

  // After this test is saved, check for newly-earned level-ups / badges and
  // celebrate them once.
  const claimedRef = useRef(false)
  useEffect(() => {
    if (!payload || !user || claimedRef.current) return
    claimedRef.current = true
    let cancelled = false
    ;(async () => {
      const [a, h] = await Promise.all([
        fetchUserAnalytics(user.id),
        fetchHabit(user.id, profile?.daily_goal ?? 20, profile?.exam_date ?? null),
      ])
      if (cancelled) return
      const group = (profile?.target_group as GroupType) || 'Group1'
      const stats: GameStats = {
        tests: a.overview.testsTaken,
        questions: a.overview.totalQuestions,
        correct: a.overview.totalCorrect,
        bestScore: a.overview.bestScore,
        avgAccuracy: a.overview.avgAccuracy,
        minutes: a.overview.totalTimeMinutes,
        longestStreak: h.longestStreak,
        currentStreak: h.currentStreak,
        subjects: a.bySubject.length,
        totalSubjects: (GROUP_SUBJECTS[group] ?? []).length,
      }
      const all = computeBadges(stats)
      const unlockedIds = all.filter((b) => b.unlocked).map((b) => b.id)
      const level = levelInfo(
        computeXp({ totalCorrect: stats.correct, totalQuestions: stats.questions, testsTaken: stats.tests })
      ).level
      const res = claim(unlockedIds, level)

      // Daily-challenge reward — granted at most once per calendar day.
      let daily: DailyReward | null = null
      if (payload.config.daily) {
        const today = new Date().toISOString().slice(0, 10)
        const dc = claimDaily(today)
        if (dc.granted) daily = { points: dc.points, streak: h.currentStreak }
      }

      if (res.newBadges.length || res.leveledTo != null || daily) {
        setRewards({
          leveledTo: res.leveledTo,
          newBadges: all.filter((b) => res.newBadges.includes(b.id)),
          daily,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payload, user, profile, claim, claimDaily])

  // Load which of these questions are already bookmarked (for the toggle state).
  useEffect(() => {
    if (!payload || !user) return
    let cancelled = false
    fetchBookmarkIds()
      .then((ids) => !cancelled && setBookmarkIds(ids))
      .catch(() => {}) // non-critical; bookmarks just start unfilled
    return () => {
      cancelled = true
    }
  }, [payload, user])

  if (!payload) return null

  const {
    config,
    questions,
    answers,
    totalQuestions,
    attempted,
    correct,
    scorePercentage,
    pdfUnlocked,
    timeTakenSeconds,
  } = payload

  const label = describeConfig(config)
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const attendancePct = totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0

  // Post-test focus areas (weak topics in THIS test) + negative-marking net score.
  const focus = weakAreas(scoreByTopic(questions, answers), 60).slice(0, 5)
  const wrong = attempted - correct
  const negMark = config.negativeMark ?? 0
  const netMarks = negMark > 0 ? Math.max(0, +(correct - wrong * negMark).toFixed(2)) : null

  // Review filter: keep original question numbers while showing a subset.
  const flaggedCount = questions.filter((q) => answers[q.id]?.flagged).length
  const reviewItems: { q: Question; index: number }[] = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => {
      if (reviewFilter === 'all') return true
      if (reviewFilter === 'flagged') return Boolean(answers[q.id]?.flagged)
      return classifyAnswer(answers[q.id]) === reviewFilter
    })

  const scoreColor =
    scorePercentage >= 80 ? '#16A34A' : scorePercentage >= 50 ? '#B7791F' : '#E5484D'

  const handleDownload = async () => {
    if (!pdfUnlocked) return
    setGenerating(true)
    try {
      await generateExplanationPdf({
        config,
        questions,
        answers,
        scorePercentage,
        correct,
        total: totalQuestions,
        label,
        lang,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleRetry = () => {
    navigate('/quiz', { state: config, replace: true })
  }

  // Optimistic bookmark toggle — revert the local set if the write fails.
  const toggleBookmark = async (questionId: string) => {
    const saved = bookmarkIds.has(questionId)
    setBookmarkIds((prev) => {
      const next = new Set(prev)
      saved ? next.delete(questionId) : next.add(questionId)
      return next
    })
    try {
      await (saved ? removeBookmark(questionId) : addBookmark(questionId))
    } catch {
      setBookmarkIds((prev) => {
        const next = new Set(prev)
        saved ? next.add(questionId) : next.delete(questionId)
        return next
      })
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Score hero */}
        <div className="card mb-5 p-6 text-center sm:p-8">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
            Test complete
          </p>

          <div className="mt-3 font-heading text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            {correct}
            <span className="text-3xl font-medium text-ink2/40"> / {totalQuestions}</span>
          </div>
          <p className="tamil mt-1 font-body text-sm text-ink2">{label}</p>

          <div className="mx-auto mt-5 max-w-[260px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${scorePercentage}%`, backgroundColor: scoreColor }}
              />
            </div>
            <div className="mt-2 font-heading text-sm font-semibold" style={{ color: scoreColor }}>
              {scorePercentage}%
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={<Target size={16} />} label="Accuracy" value={`${accuracy}%`} />
            <Stat
              icon={<CheckCircle2 size={16} />}
              label="Attended"
              value={`${attempted}/${totalQuestions}`}
            />
            <Stat
              icon={<TimerIcon size={16} />}
              label="Time"
              value={formatTime(timeTakenSeconds)}
            />
          </div>
        </div>

        {/* PDF section */}
        <div className="card mb-5 p-5">
          {pdfUnlocked ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-body text-sm text-ink2">
                You attended {attendancePct}% — explanations unlocked.
              </p>
              <button
                onClick={handleDownload}
                disabled={generating}
                className="btn-gold w-full px-7 py-3.5 text-base sm:w-auto"
              >
                <Download size={20} />
                {generating ? 'Generating…' : 'Download Explanation PDF'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-coralsoft">
                <Lock size={24} className="text-coral" />
              </div>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-line px-7 py-3 font-heading text-base font-bold text-ink2/50"
              >
                <Lock size={18} /> Download Explanation PDF
              </button>
              <p className="font-body text-sm font-medium text-coral">
                Attempt at least 80% of questions to unlock explanations. You
                attended {attendancePct}%.
              </p>
            </div>
          )}
        </div>

        {/* Net marks (mock tests with negative marking) */}
        {netMarks !== null && (
          <div className="mb-5 rounded-2xl bg-brand-soft p-4 text-center">
            <span className="font-body text-sm text-ink2">
              {t('negMarking')} ({negMark}/wrong):{' '}
            </span>
            <span className="font-heading text-xl font-extrabold text-brand">
              {netMarks} {t('of')} {totalQuestions}
            </span>
          </div>
        )}

        {/* Focus areas from this test + learn links */}
        {focus.length > 0 && (
          <section className="mb-6">
            <h3 className="tamil mb-1 font-heading text-lg font-extrabold tracking-tight text-ink">
              {t('focusAreas')}
            </h3>
            <p className="tamil mb-3 font-body text-sm text-ink2">{t('focusHint')}</p>
            <div className="flex flex-col gap-2.5">
              {focus.map((f) => {
                const asset = assetsFor(f.key)
                return (
                  <div key={f.key} className="rounded-2xl bg-white p-3.5 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="tamil font-heading text-sm font-bold text-navytext">
                        {f.key}
                      </span>
                      <span className="font-heading text-sm font-bold text-warn">
                        {f.accuracy}% ({f.correct}/{f.attempted})
                      </span>
                    </div>
                    <p className="tamil mt-1.5 font-body text-xs leading-relaxed text-navytext/70">
                      {lang === 'ta' ? asset.tipTa : asset.tip}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {asset.links.slice(0, 2).map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-primary/10 px-3 py-1 font-heading text-[11px] font-semibold text-primary transition hover:bg-primary/20"
                        >
                          {t('learnThis')}: {l.label} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => navigate('/revision')} className="btn-soft mt-3 w-full px-5 py-3 text-sm">
              {t('practiceMistakes')} →
            </button>
          </section>
        )}

        {/* Per-question breakdown */}
        <h3 className="mb-3 font-heading text-lg font-extrabold tracking-tight text-ink">
          {t('questionBreakdown')}
        </h3>

        {/* Review filter — jump straight to wrong / skipped / flagged questions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ['all', 'All', totalQuestions],
              ['wrong', 'Wrong', wrong],
              ['skipped', 'Skipped', totalQuestions - attempted],
              ['correct', 'Correct', correct],
              ['flagged', 'Flagged', flaggedCount],
            ] as [ReviewFilter, string, number][]
          ).map(([key, lbl, count]) => (
            <button
              key={key}
              onClick={() => setReviewFilter(key)}
              className={[
                'rounded-full px-3.5 py-1.5 font-heading text-xs font-semibold transition',
                reviewFilter === key
                  ? 'bg-brand-gradient text-white'
                  : 'border border-line bg-card text-ink2 hover:border-brand-ring',
              ].join(' ')}
            >
              {lbl} <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-col gap-3">
          {reviewItems.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center font-body text-sm text-ink2">
              No {reviewFilter} questions in this test.
            </p>
          ) : (
            reviewItems.map(({ q, index }) => (
              <ResultCard
                key={q.id}
                question={q}
                index={index}
                answer={answers[q.id]}
                showExplanation={pdfUnlocked}
                bookmarked={bookmarkIds.has(q.id)}
                onToggleBookmark={user ? () => toggleBookmark(q.id) : undefined}
              />
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={handleRetry} className="btn-ghost flex-1 px-6 py-3.5">
            <RefreshCw size={18} /> Retry Test
          </button>
          <button onClick={() => navigate('/test-arena')} className="btn-brand flex-1 px-6 py-3.5">
            <Home size={18} /> Test Arena
          </button>
        </div>
      </div>

      {rewards && (
        <RewardOverlay
          leveledTo={rewards.leveledTo}
          newBadges={rewards.newBadges}
          daily={rewards.daily}
          onClose={() => setRewards(null)}
        />
      )}
    </AppLayout>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-lg bg-tint text-ink2">
        {icon}
      </div>
      <div className="font-heading text-base font-semibold text-ink">{value}</div>
      <div className="font-body text-[11px] uppercase tracking-wide text-ink2">{label}</div>
    </div>
  )
}
