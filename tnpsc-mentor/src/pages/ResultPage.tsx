import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import {
  BookOpen,
  CheckCircle2,
  Crown,
  FileDown,
  GraduationCap,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import RewardOverlay, { type DailyReward } from '../components/RewardOverlay'
import ResultCard from '../components/Quiz/ResultCard'
import CircularProgress from '../components/UI/CircularProgress'
import SectionHeader from '../components/UI/SectionHeader'
import { formatTime } from '../components/UI/Timer'
import { describeConfig } from '../lib/fetchQuestions'
import { addBookmark, fetchBookmarkIds, removeBookmark } from '../lib/bookmarks'
import { scoreByTopic, weakAreas, fetchUserAnalytics } from '../lib/analytics'
import { fetchHabit } from '../lib/habit'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, type Badge, type GameStats } from '../lib/achievements'
import { isHiddenBadge, SHOW_GOALS } from '../lib/features'
import { GROUP_SUBJECTS, subjectName } from '../lib/constants'
import { assetsFor } from '../lib/assets'
import { exitFullscreen } from '../lib/proctor'
import { trackViewResult } from '../lib/tracking'
import { formatDuration, msUntil } from '../lib/revisionTime'
import { pdfWatermark } from '../lib/pdfWatermark'
import { useAuth } from '../hooks/useAuth'
import { api, isApiConfigured, type PdfQuota } from '../lib/api'
import { useProgressStore } from '../store/progressStore'
import { usePremiumStore } from '../store/premiumStore'
import { toast } from '../store/toastStore'
import { useT } from '../lib/i18n'
import type { GroupType, Question, ResultPayload, TestAnswer } from '../types'

type ReviewFilter = 'all' | 'wrong' | 'correct' | 'flagged'

/** Bucket a question by how the user answered it (for the review filter). */
function classifyAnswer(answer?: TestAnswer): 'correct' | 'wrong' | 'skipped' {
  if (!answer?.selected_answer) return 'skipped'
  return answer.is_correct ? 'correct' : 'wrong'
}

/** Animate a number from 0 → target (ease-out cubic) for the score count-up.
 * Snaps straight to the value under prefers-reduced-motion. */
function useCountUp(target: number, ms = 900): number {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) {
      setN(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduce])
  return n
}

export default function ResultPage({ previewPayload }: { previewPayload?: ResultPayload } = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const { user, profile } = useAuth()
  const claim = useProgressStore((s) => s.claim)
  const claimDaily = useProgressStore((s) => s.claimDaily)
  const claimGoalMet = useProgressStore((s) => s.claimGoalMet)
  const payload = previewPayload ?? (location.state as ResultPayload | null)

  // Report the result view to analytics once per finished test. Skipped for the
  // admin preview (no real payload / not a genuine attempt).
  useEffect(() => {
    if (previewPayload || !payload) return
    trackViewResult({
      category: payload.config?.category,
      scorePercentage: payload.scorePercentage,
      passed: payload.passed80,
    })
    // Fire only when a distinct test's result is shown.
  }, [previewPayload, payload?.sessionId, payload?.scorePercentage]) // eslint-disable-line react-hooks/exhaustive-deps

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set())
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  // PDF download is open to everyone (once a test is ≥80% attempted); premium is
  // unlimited and free users are capped. The quota tells us how many downloads a
  // free user has left. premiumStore is still refreshed for the rest of the app.
  const { premium, loaded: premiumLoaded, refresh: refreshPremium } = usePremiumStore()
  const [quota, setQuota] = useState<PdfQuota | null>(null)
  useEffect(() => {
    if (!premiumLoaded) refreshPremium()
  }, [premiumLoaded, refreshPremium])
  useEffect(() => {
    if (isApiConfigured) api.pdfQuota().then(setQuota).catch(() => {})
  }, [])
  const [rewards, setRewards] = useState<{
    leveledTo: number | null
    newBadges: Badge[]
    daily: DailyReward | null
    goalDone: boolean
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
        // Omit the date so the store uses its IST day-boundary, matching the streak logic.
        const dc = claimDaily()
        if (dc.granted) daily = { points: dc.points, streak: h.currentStreak }
      }

      // Daily-goal completion - celebrate only the test that crossed the line
      // (today's count includes this test; subtracting it must land below goal),
      // and only once per IST day via the store latch.
      const crossedGoal =
        SHOW_GOALS &&
        h.questionsToday >= h.dailyGoal &&
        h.questionsToday - payload.totalQuestions < h.dailyGoal
      const goalDone = crossedGoal && claimGoalMet()

      if (res.newBadges.length || res.leveledTo != null || daily || goalDone) {
        setRewards({
          leveledTo: res.leveledTo,
          newBadges: all.filter((b) => res.newBadges.includes(b.id)),
          daily,
          goalDone,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payload, user, profile, claim, claimDaily, claimGoalMet])

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

  // Score count-up - driven from the (possibly null) payload so the hooks run
  // unconditionally, before the guard below.
  const animCorrect = useCountUp(payload?.correct ?? 0)
  const animPct = useCountUp(payload?.scorePercentage ?? 0)

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

  const label = describeConfig(config, lang)
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const attendancePct = totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0

  // The explanation PDF unlocks once the test is at least 80% attempted;
  // otherwise we just nudge them to finish more of it.
  const canUnlockPdf = totalQuestions > 0 && attempted / totalQuestions >= 0.8
  // Download is open to everyone now. Premium is unlimited; free users get a
  // capped number (quota.remaining). `null` remaining = unlimited (premium) or
  // quota not yet known (preview / not loaded → treated as allowed).
  const isPremium = quota?.premium ?? premium
  const remainingDownloads = quota?.remaining ?? null
  const outOfDownloads = !isPremium && remainingDownloads !== null && remainingDownloads <= 0
  // Quota is "ready" once fetched, or immediately in preview mode (no backend).
  const quotaReady = quota !== null || !isApiConfigured
  // A free user who has used up their downloads is nudged to upgrade.
  const promptUpgrade = () => {
    toast.info(t('pdfFreeLimitReached'))
    navigate('/profile')
  }
  const downloadExplanationPdf = async () => {
    if (downloadingPdf || outOfDownloads) return
    setDownloadingPdf(true)
    try {
      // Reserve a slot server-side first (premium = unlimited; free = capped).
      // Skip the call in preview mode where there's no backend.
      if (isApiConfigured) {
        const result = await api.recordPdfDownload()
        setQuota(result)
        if (!result.allowed) {
          promptUpgrade()
          return
        }
      }
      // Lazy-load the heavy jspdf/html2canvas chunk only when the user actually
      // exports - keeps it out of the result page's initial bundle.
      const { generateExplanationPdf } = await import('../lib/explanationPdf')
      await generateExplanationPdf({
        questions,
        label,
        title: 'Explanation Sheet',
        lang,
        // Personalised watermark: the downloader's name + phone so a shared/
        // leaked sheet is traceable to whoever generated it.
        watermark: pdfWatermark(profile),
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

  const verdictKey =
    scorePercentage >= 80 ? 'verdictGreat' : scorePercentage >= 50 ? 'verdictGood' : 'verdictKeepGoing'

  const handleRetry = () => {
    // A proctored mock/marathon/vettri paper (mockKind set) must re-run the REAL
    // fixed paper through its instructions + fullscreen flow — that path re-fetches
    // the actual paper, charges credits at start, and records the attempt against
    // the correct exam. Routing it to /quiz instead would serve a random practice
    // sample (category is the 'pyq' placeholder) and burn a capped attempt on it.
    if (config.mockKind) {
      navigate('/mock/instructions', { state: config, replace: true })
    } else {
      navigate('/quiz', { state: config, replace: true })
    }
  }

  // Optimistic bookmark toggle - revert the local set if the write fails.
  const toggleBookmark = async (questionId: string) => {
    const saved = bookmarkIds.has(questionId)
    setBookmarkIds((prev) => {
      const next = new Set(prev)
      if (saved) next.delete(questionId)
      else next.add(questionId)
      return next
    })
    try {
      await (saved ? removeBookmark(questionId) : addBookmark(questionId))
    } catch {
      setBookmarkIds((prev) => {
        const next = new Set(prev)
        if (saved) next.add(questionId)
        else next.delete(questionId)
        return next
      })
    }
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-8">
        {/* Score moment - one of the three gradient beats (design-system.md).
            The single elevated element: circular ring + score count-up + verdict,
            with a restrained fade/draw celebration (no confetti). */}
        <section className="hero-panel relative overflow-hidden p-6 animate-fadeIn sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
            style={{ backgroundSize: '18px 18px' }}
          />
          <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
            <CircularProgress
              value={scorePercentage}
              size={140}
              stroke={11}
              trackClassName="text-white/20"
              progressClassName="text-white"
            >
              <div className="flex flex-col items-center">
                <span className="font-display text-3xl font-bold leading-none text-white">{animPct}%</span>
                <span className="mt-1 font-body text-[11px] uppercase tracking-wide text-white/70">
                  {t('scoreLabel')}
                </span>
              </div>
            </CircularProgress>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[13px] font-medium uppercase tracking-[0.14em] text-white/70">
                {t('testCompleteLabel')}
              </p>
              <div className="mt-2 font-display text-[32px] font-bold leading-none tracking-tight text-white sm:text-4xl">
                {animCorrect}
                <span className="text-white/50"> / {totalQuestions}</span>
              </div>
              <p className="tamil mt-2 font-display text-base font-semibold text-white/90">
                {t(verdictKey)}
              </p>
              <p className="tamil mt-1 truncate font-body text-sm text-white/60">{label}</p>
            </div>
          </div>
          {/* Stat strip on the gradient, separated by translucent hairlines. */}
          <div className="relative mt-6 flex items-stretch border-t border-white/15 pt-5">
            <HeroStat label={t('accuracy')} value={`${accuracy}%`} />
            <HeroStat label={t('attended')} value={`${attempted}/${totalQuestions}`} divider />
            <HeroStat label={t('timeTaken')} value={formatTime(timeTakenSeconds)} divider />
          </div>
        </section>

        {/* First-test bonus - awarded once ever, right when the user's first
            completed test was graded. Celebrated loudly so the reward lands. */}
        {payload.firstTestBonus && (
          <div className="mt-6 flex items-start gap-3 rounded-card border border-primary/30 bg-tint-violet/50 p-4">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="tamil font-heading text-sm font-bold text-ink">
                {t('firstTestBonusTitle')}
              </p>
              <p className="tamil mt-1 font-body text-sm text-ink2">
                {t('firstTestBonusBody1')}
                <span className="font-heading font-bold text-primary">
                  {' '}+{payload.firstTestBonus.amount}{' '}
                </span>
                {t('firstTestBonusBody2')}
              </p>
            </div>
          </div>
        )}

        {/* Topic-revision outcome: a low score was saved to study & retry, or a
            re-test passed and cleared the topic. */}
        {payload.revision?.enqueued && (
          <div className="mt-6 flex items-start gap-3 rounded-card border border-gold/40 bg-gold/10 p-4">
            <GraduationCap size={20} className="mt-0.5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="tamil font-heading text-sm font-bold text-ink">{t('revSavedTitle')}</p>
              <p className="tamil mt-1 font-body text-sm text-ink2">
                {t('revSavedBody')}
                {payload.revision.available_at
                  ? ` (~${formatDuration(msUntil(payload.revision.available_at))})`
                  : ''}{' '}
                - {t('revSavedSleep')}
              </p>
              <button onClick={() => navigate('/revision')} className="btn-ghost mt-2.5 px-4 py-2 text-sm">
                {t('revGoToRevision')}
              </button>
            </div>
          </div>
        )}
        {payload.revision?.cleared && (
          <div className="mt-6 flex items-start gap-3 rounded-card border border-mint/40 bg-mint/10 p-4">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-mint" />
            <div className="min-w-0">
              <p className="tamil font-heading text-sm font-bold text-ink">{t('revClearedNoticeTitle')}</p>
              <p className="tamil mt-1 font-body text-sm text-ink2">{t('revClearedNoticeBody')}</p>
              <button onClick={() => navigate('/revision')} className="btn-ghost mt-2.5 px-4 py-2 text-sm">
                {t('revGoToRevision')}
              </button>
            </div>
          </div>
        )}

        {/* Body - two intentional columns on desktop: summary | review. */}
        <div className="mt-8 lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-8 lg:items-start">
          {/* LEFT - summary */}
          <div className="space-y-6">
            {/* Explanation unlock status - inline, no card */}
            <div className="flex items-start gap-2.5">
              {pdfUnlocked ? (
                <>
                  <BookOpen size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                  <p className="font-body text-sm text-muted">
                    {t('youAttended')} {attendancePct}% - {t('explanationsUnlockedMsg')}
                  </p>
                </>
              ) : (
                <>
                  <Lock size={18} className="mt-0.5 flex-shrink-0 text-accent" />
                  <p className="font-body text-sm font-medium text-accent">
                    {t('unlockExplanationsMsg')} {t('youAttended')} {attendancePct}%.
                  </p>
                </>
              )}
            </div>

            {/* Net marks (mock tests with negative marking) */}
            {netMarks !== null && (
              <div className="flex items-center justify-between gap-3 border-y border-line py-3">
                <span className="tamil font-body text-sm text-muted">
                  {t('negMarking')} ({negMark}/wrong)
                </span>
                <span className="font-display text-lg font-bold text-primary">
                  {netMarks} <span className="font-body font-normal text-muted">/ {totalQuestions}</span>
                </span>
              </div>
            )}

            {/* Focus areas - a flat hairline list, not cards */}
            {focus.length > 0 && (
              <section>
                <SectionHeader title={t('focusAreas')} />
                <p className="tamil mb-1 mt-1 font-body text-[13px] text-muted">{t('focusHint')}</p>
                <div className="divide-y divide-line">
                  {focus.map((f) => {
                    const asset = assetsFor(f.key)
                    return (
                      <div key={f.key} className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="tamil font-display text-[15px] font-semibold text-ink">
                            {subjectName(f.key, lang)}
                          </span>
                          <span className="font-display text-sm font-bold text-accent">
                            {f.accuracy}%{' '}
                            <span className="font-body font-normal text-muted">
                              ({f.correct}/{f.attempted})
                            </span>
                          </span>
                        </div>
                        <p className="tamil mt-1.5 font-body text-[13px] leading-relaxed text-muted">
                          {lang === 'ta' ? asset.tipTa : asset.tip}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {asset.links.slice(0, 2).map((l) => (
                            <a
                              key={l.url}
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-body text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
                            >
                              {t('learnThis')}: {l.label} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => navigate('/revision')} className="btn-soft mt-4 w-full px-5 py-3 text-sm">
                  {t('practiceMistakes')} →
                </button>
              </section>
            )}
          </div>

          {/* RIGHT - per-question review */}
          <div className="mt-8 lg:mt-0">
            <SectionHeader title={t('questionBreakdown')} />

            {/* Explanation PDF - open to everyone once the test is ≥80% attempted.
                Premium is unlimited; free users get a capped number of downloads
                and are nudged to upgrade once they run out. */}
            <div className="mt-3">
              {!canUnlockPdf ? (
                <div className="flex items-center gap-2 rounded-field border border-line bg-card px-4 py-2.5 font-body text-xs text-muted">
                  <FileDown size={14} className="flex-shrink-0 text-muted" />
                  <span className="tamil">{t('pdfWhenComplete')}</span>
                </div>
              ) : !quotaReady ? (
                <div className="flex items-center justify-center rounded-field border border-line bg-card px-4 py-2.5">
                  <Loader2 size={14} className="animate-spin text-muted" />
                </div>
              ) : outOfDownloads ? (
                <button
                  onClick={promptUpgrade}
                  className="btn-brand press flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
                >
                  <Crown size={16} /> {t('pdfUpgradeForMore')}
                </button>
              ) : (
                <>
                  <button
                    onClick={downloadExplanationPdf}
                    disabled={downloadingPdf}
                    className="btn-soft flex w-full items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-60"
                  >
                    {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                    {downloadingPdf ? t('preparingPdf') : t('downloadExplanations')}
                  </button>
                  {!isPremium && remainingDownloads !== null && (
                    <p className="tamil mt-1.5 text-center font-body text-xs text-muted">
                      {remainingDownloads} {t('freeDownloadsLeft')}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Review filter - attended questions only (correct / wrong / flagged) */}
            <div className="mb-3 mt-3 flex flex-wrap gap-2">
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
                    'rounded-pill px-3.5 py-1.5 font-heading text-xs font-semibold transition-colors',
                    reviewFilter === key
                      ? 'bg-brand-gradient text-white'
                      : 'border border-line bg-card text-muted hover:border-primary/40 hover:text-ink',
                  ].join(' ')}
                >
                  {lbl} <span className="opacity-70">({count})</span>
                </button>
              ))}
            </div>

            {/* The list scrolls within its own bounded area so the score and
                filters stay in view. overscroll-contain stops the scroll from
                chaining to the page (also avoids iOS Safari rubber-banding). */}
            <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto overscroll-contain pr-1 lg:max-h-[74vh]">
              {reviewItems.length === 0 ? (
                <p className="rounded-card border border-line bg-card px-4 py-6 text-center font-body text-sm text-muted">
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
                    // Daily CA questions aren't rows of the main bank, so the
                    // bookmarks table can't reference them — hide the control
                    // (an undefined `bookmarked` drops the button entirely).
                    bookmarked={config.caDailyId ? undefined : bookmarkIds.has(q.id)}
                    onToggleBookmark={
                      user && !config.caDailyId ? () => toggleBookmark(q.id) : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions - the single primary pill + a quiet retry, full width below. */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
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
          goalDone={rewards.goalDone}
          onClose={() => setRewards(null)}
        />
      )}
    </>
  )
}

/** A single metric in the score hero's stat strip - white-on-gradient, with a
 * translucent hairline divider before all but the first. */
function HeroStat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={`flex-1 ${divider ? 'border-l border-white/15 pl-4' : 'pr-4'}`}>
      <div className="font-display text-xl font-bold leading-none text-white">{value}</div>
      <div className="tamil mt-2 font-body text-[12px] uppercase tracking-wide text-white/65">{label}</div>
    </div>
  )
}
