import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Clock, Copy, ListChecks, Maximize2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { enterFullscreen } from '../lib/proctor'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

const QUESTION_OPTIONS = [10, 20, 30, 50]
const MINUTE_OPTIONS = [10, 15, 20, 30, 45]

/**
 * Proctored pre-test screen for practice quizzes (Subject Practice, PYQ, Current
 * Affairs, Aptitude, Revision). Lets the aspirant choose how many questions and
 * how long, shows the exam rules with a mandatory confirmation, then requests
 * full-screen and hands off to the quiz engine (/quiz) with `proctored: true`.
 * Reached via router state from useStartTest — a direct/refresh hit with no
 * config bounces back to the Test Arena.
 */
export default function QuizInstructionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const config = location.state as QuizConfig | null

  const [agreed, setAgreed] = useState(false)
  const [count, setCount] = useState(20)
  const [minutes, setMinutes] = useState(20)

  useEffect(() => {
    if (!config) navigate('/test-arena', { replace: true })
  }, [config, navigate])

  if (!config) return null

  const begin = async () => {
    if (!agreed) return
    // Request full-screen on this user gesture; the quiz engine enforces it
    // where supported and degrades to visibility proctoring on phones.
    await enterFullscreen()
    navigate('/quiz', {
      state: {
        ...config,
        proctored: true,
        questionCount: count,
        durationSeconds: minutes * 60,
      } as QuizConfig,
    })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="mb-3 text-center">
          <YellowBadge>{t('examInstructions')}</YellowBadge>
        </div>
        {config.label && (
          <p className="mb-6 text-center font-heading text-lg font-semibold text-ink">
            {config.label}
          </p>
        )}

        {/* Setup: number of questions */}
        <div className="card mb-4 p-5">
          <h3 className="tamil mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
            {t('numQuestions')}
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {QUESTION_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={count === n ? 'chip chip-active' : 'chip'}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Setup: time limit */}
        <div className="card mb-6 p-5">
          <h3 className="tamil mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
            {t('timeLimitMin')}
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {MINUTE_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={minutes === m ? 'chip chip-active' : 'chip'}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="card mb-6 space-y-4 p-5">
          <Rule icon={<Maximize2 size={18} />} text={t('instrFullscreen')} />
          <Rule icon={<Clock size={18} />} text={t('instrTimer')} />
          <Rule icon={<ListChecks size={18} />} text={t('instrQuizNav')} />
          <Rule icon={<Copy size={18} />} text={t('instrNoCopy')} />
          <Rule icon={<AlertTriangle size={18} />} text={t('instrViolations')} />
        </div>

        {/* Confirmation */}
        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
          <span className="tamil font-body text-sm text-ink">{t('instrConfirm')}</span>
        </label>

        <button onClick={begin} disabled={!agreed} className="btn-brand btn-lg w-full">
          <Maximize2 size={18} /> {t('enterFullscreen')}
        </button>
      </div>
    </AppLayout>
  )
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      <p className="tamil font-body text-sm text-ink">{text}</p>
    </div>
  )
}
