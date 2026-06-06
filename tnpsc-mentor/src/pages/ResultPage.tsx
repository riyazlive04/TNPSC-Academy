import { useEffect, useState } from 'react'
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
import ResultCard from '../components/Quiz/ResultCard'
import { formatTime } from '../components/UI/Timer'
import { generateExplanationPdf } from '../lib/pdfGenerator'
import { describeConfig } from '../lib/fetchQuestions'
import { scoreByTopic, weakAreas } from '../lib/analytics'
import { assetsFor } from '../lib/assets'
import { useT } from '../lib/i18n'
import type { ResultPayload } from '../types'

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const payload = location.state as ResultPayload | null

  const [generating, setGenerating] = useState(false)

  // Guard — no result data means a direct visit; bounce home.
  useEffect(() => {
    if (!payload) navigate('/test-arena', { replace: true })
  }, [payload, navigate])

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

  const scoreColor =
    scorePercentage >= 80 ? '#16a34a' : scorePercentage >= 50 ? '#FFC107' : '#FF5722'

  const handleDownload = () => {
    if (!pdfUnlocked) return
    setGenerating(true)
    try {
      generateExplanationPdf({
        config,
        questions,
        answers,
        scorePercentage,
        correct,
        total: totalQuestions,
        label,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleRetry = () => {
    navigate('/quiz', { state: config, replace: true })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Score hero */}
        <div className="mb-6 rounded-3xl bg-white p-6 text-center shadow-card sm:p-8">
          <p className="mb-1 font-heading text-sm font-bold uppercase tracking-widest text-secondary">
            Test Complete
          </p>
          <p className="mb-4 font-body text-sm text-navytext/60">{label}</p>

          <div className="mb-2 font-heading text-5xl font-bold text-navytext sm:text-6xl">
            {correct} <span className="text-3xl text-navytext/40">/ {totalQuestions}</span>
          </div>

          <div
            className="mx-auto mb-5 inline-flex items-center rounded-full px-5 py-2 font-heading text-xl font-bold text-white"
            style={{ backgroundColor: scoreColor }}
          >
            {scorePercentage}%
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat
              icon={<Target size={18} />}
              label="Accuracy"
              value={`${accuracy}%`}
            />
            <Stat
              icon={<CheckCircle2 size={18} />}
              label="Attended"
              value={`${attempted}/${totalQuestions}`}
            />
            <Stat
              icon={<TimerIcon size={18} />}
              label="Time Taken"
              value={formatTime(timeTakenSeconds)}
            />
          </div>
        </div>

        {/* PDF section */}
        <div className="mb-6 rounded-3xl bg-secondary/30 p-5 shadow-card backdrop-blur">
          {pdfUnlocked ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-body text-sm text-white/80">
                🎉 You attended {attendancePct}% of the questions — explanations are
                unlocked!
              </p>
              <button
                onClick={handleDownload}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                <Download size={20} />
                {generating ? 'Generating…' : 'Download Explanation PDF'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Lock size={24} className="text-white/70" />
              </div>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white/20 px-7 py-3 font-heading text-lg font-bold uppercase tracking-wide text-white/50"
              >
                <Lock size={18} /> Download Explanation PDF
              </button>
              <p className="font-body text-sm text-warn">
                Attempt at least 80% of questions to unlock explanations. You
                attended {attendancePct}%.
              </p>
            </div>
          )}
        </div>

        {/* Net marks (mock tests with negative marking) */}
        {netMarks !== null && (
          <div className="mb-6 rounded-2xl bg-white/8 p-4 text-center">
            <span className="font-body text-sm text-white/60">
              {t('negMarking')} ({negMark}/wrong):{' '}
            </span>
            <span className="font-heading text-xl font-bold text-accent">
              {netMarks} {t('of')} {totalQuestions}
            </span>
          </div>
        )}

        {/* Focus areas from this test + learn links */}
        {focus.length > 0 && (
          <section className="mb-6">
            <h3 className="tamil mb-1 font-heading text-lg font-bold uppercase tracking-wide text-white">
              {t('focusAreas')}
            </h3>
            <p className="tamil mb-3 font-body text-sm text-white/55">{t('focusHint')}</p>
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
            <button
              onClick={() => navigate('/revision')}
              className="mt-3 w-full rounded-full bg-white/10 px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/20"
            >
              {t('practiceMistakes')} →
            </button>
          </section>
        )}

        {/* Per-question breakdown */}
        <h3 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-white">
          {t('questionBreakdown')}
        </h3>
        <div className="mb-8 flex flex-col gap-3">
          {questions.map((q, i) => (
            <ResultCard
              key={q.id}
              question={q}
              index={i}
              answer={answers[q.id]}
              showExplanation={pdfUnlocked}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleRetry}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-heading font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5"
          >
            <RefreshCw size={18} /> Retry Test
          </button>
          <button
            onClick={() => navigate('/test-arena')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-heading font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5"
          >
            <Home size={18} /> Test Arena
          </button>
        </div>
      </div>
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
    <div className="rounded-2xl bg-primary/5 p-3">
      <div className="mb-1 flex items-center justify-center text-secondary">{icon}</div>
      <div className="font-heading text-base font-bold text-navytext">{value}</div>
      <div className="font-body text-[11px] uppercase tracking-wide text-navytext/50">
        {label}
      </div>
    </div>
  )
}
