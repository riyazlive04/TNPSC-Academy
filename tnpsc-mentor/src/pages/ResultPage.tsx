import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  FileDown,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  Target,
  Timer as TimerIcon,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import RewardOverlay, { type DailyReward } from '../components/RewardOverlay'
import ResultCard from '../components/Quiz/ResultCard'
import { formatTime } from '../components/UI/Timer'
import { describeConfig } from '../lib/fetchQuestions'
import { addBookmark, fetchBookmarkIds, removeBookmark } from '../lib/bookmarks'
import { scoreByTopic, weakAreas, fetchUserAnalytics } from '../lib/analytics'
import { fetchHabit } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type Badge, type GameStats } from '../lib/achievements'
import { isHiddenBadge } from '../lib/features'
import { GROUP_SUBJECTS, subjectName } from '../lib/constants'
import { assetsFor } from '../lib/assets'
import { generateQuestionBankPdf } from '../lib/pdfGenerator'
import { exitFullscreen } from '../lib/proctor'
import { useAuth } from '../hooks/useAuth'
import { useProgressStore } from '../store/progressStore'
import { useT } from '../lib/i18n'
import type { GroupType, Question, ResultPayload, TestAnswer } from '../types'

type ReviewFilter = 'all' | 'wrong' | 'correct' | 'flagged'

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

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set())
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [rewards, setRewards] = useState<{
    leveledTo: number | null
    newBadges: Badge[]
    daily: DailyReward | null
  } | null>(null)

  // Guard - no result data means a direct visit; bounce home.
  useEffect(() => {
    if (!payload) navigate('/test-arena', { replace: true })
  }, [payload, navigate])

  // The test is over once results are shown - make sure we're never left stuck
  // in full-screen, regardless of which path (submit / auto-submit / abandon /
  // violation) ended the test.
  useEffect(() => {
    void exitFullscreen()
  }, [])

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
      const unlockedIds = all
        .filter((b) => b.unlocked && !isHiddenBadge(b.id))
        .map((b) => b.id)
      const level = levelInfo(
        computeXp({ totalCorrect: stats.correct, totalQuestions: stats.questions, testsTaken: stats.tests })
      ).level
      const res = claim(unlockedIds, level)

      // Daily-challenge reward - granted at most once per calendar day.
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

  // The full questions-with-explanations PDF unlocks only when EVERY question was
  // attempted (a completely-attended test); otherwise we just nudge them to it.
  const fullyAttended = totalQuestions > 0 && attempted === totalQuestions
  const downloadExplanationPdf = async () => {
    if (downloadingPdf) return
    setDownloadingPdf(true)
    try {
      await generateQuestionBankPdf({
        questions,
        label,
        title: 'Explanation Sheet',
        lang,
        watermark: 'TNPSC MENTOR',
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Post-test focus areas (weak topics in THIS test) + negative-marking net score.
  const focus = weakAreas(scoreByTopic(questions, answers), 60).slice(0, 5)
  const wrong = attempted - correct
  const negMark = config.negativeMark ?? 0
  const netMarks = negMark > 0 ? Math.max(0, +(correct - wrong * negMark).toFixed(2)) : null

  // Review filter: keep original question numbers while showing a subset.
  // Unattended (skipped) questions are never shown - only ones the user answered.
  const isAttended = (q: Question) => classifyAnswer(answers[q.id]) !== 'skipped'
  const flaggedCount = questions.filter((q) => isAttended(q) && answers[q.id]?.flagged).length
  const reviewItems: { q: Question; index: number }[] = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => isAttended(q))
    .filter(({ q }) => {
      if (reviewFilter === 'all') return true
      if (reviewFilter === 'flagged') return Boolean(answers[q.id]?.flagged)
      return classifyAnswer(answers[q.id]) === reviewFilter
    })

  const scoreColor =
    scorePercentage >= 80 ? '#16A34A' : scorePercentage >= 50 ? '#B7791F' : '#E5484D'

  const handleRetry = () => {
    navigate('/quiz', { state: config, replace: true })
  }

  // Optimistic bookmark toggle - revert the local set if the write fails.
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
            {t('testCompleteLabel')}
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
            <Stat icon={<Target size={16} />} label={t('accuracy')} value={`${accuracy}%`} />
            <Stat
              icon={<CheckCircle2 size={16} />}
              label={t('attended')}
              value={`${attempted}/${totalQuestions}`}
            />
            <Stat
              icon={<TimerIcon size={16} />}
              label={t('timeTaken')}
              value={formatTime(timeTakenSeconds)}
            />
          </div>
        </div>

        {/* Explanation unlock status - explanations are shown inline in the
            review below; there is no downloadable document. */}
        <div className="card mb-5 p-5">
          {pdfUnlocked ? (
            <div className="flex items-center justify-center gap-2 text-center">
              <BookOpen size={18} className="text-brand" />
              <p className="font-body text-sm text-ink2">
                {t('youAttended')} {attendancePct}% - {t('explanationsUnlockedMsg')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-coralsoft">
                <Lock size={24} className="text-coral" />
              </div>
              <p className="font-body text-sm font-medium text-coral">
                {t('unlockExplanationsMsg')} {t('youAttended')} {attendancePct}%.
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
                  <div key={f.key} className="rounded-2xl border border-line bg-card p-3.5 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="tamil font-heading text-sm font-bold text-navytext">
                        {subjectName(f.key, lang)}
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

        {/* Full explanation PDF - unlocked only when every question was attempted */}
        {fullyAttended ? (
          <button
            onClick={downloadExplanationPdf}
            disabled={downloadingPdf}
            className="btn-soft mb-3 w-full px-5 py-3 text-sm disabled:opacity-60"
          >
            {downloadingPdf ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileDown size={16} />
            )}
            {downloadingPdf ? t('preparingPdf') : t('downloadExplanations')}
          </button>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-tint px-4 py-2.5 font-body text-xs text-ink2">
            <FileDown size={14} className="flex-shrink-0 text-ink2" />
            <span className="tamil">{t('pdfWhenComplete')}</span>
          </div>
        )}

        {/* Review filter - attended questions only (correct / wrong / flagged) */}
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ['all', t('filterAll'), attempted],
              ['wrong', t('filterWrong'), wrong],
              ['correct', t('filterCorrect'), correct],
              ['flagged', t('filterFlagged'), flaggedCount],
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

        {/* The question list scrolls within its own bounded area so the score,
            filters and action buttons stay in view instead of the whole page
            growing tall. overscroll-contain stops the scroll from chaining to
            the page once the list hits its top/bottom. */}
        <div className="mb-8 flex max-h-[65vh] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
          {reviewItems.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center font-body text-sm text-ink2">
              {t('noFilterQuestions')}
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
            <RefreshCw size={18} /> {t('retryTest')}
          </button>
          <button onClick={() => navigate('/test-arena')} className="btn-brand flex-1 px-6 py-3.5">
            <Home size={18} /> {t('testArena')}
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
