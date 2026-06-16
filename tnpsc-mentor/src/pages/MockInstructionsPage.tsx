import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Copy, FileText, Maximize2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { mockBlueprint } from '../lib/constants'
import { enterFullscreen } from '../lib/proctor'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

/**
 * Pre-test instructions screen for a proctored mock. Shows exam rules and a
 * mandatory confirmation checkbox; "Begin Test" requests full-screen and hands
 * off to the OMR engine (/mock/quiz). Reached only via router state from the
 * mock picker — a direct/refresh hit with no config bounces back to /mock.
 */
export default function MockInstructionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const config = location.state as QuizConfig | null

  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (!config?.proctored) navigate('/mock', { replace: true })
  }, [config, navigate])

  if (!config?.proctored) return null

  const blueprint = config.mockKind === 'group' ? mockBlueprint(config.mockGroup) : undefined
  const totalQ = config.mockQuestionCount ?? blueprint?.totalQuestions ?? 0
  const minutes = Math.round((config.mockDurationSeconds ?? 0) / 60)

  const begin = async () => {
    if (!agreed) return
    // Request full-screen before handing off; the quiz engine enforces it where
    // supported. On phones (no Fullscreen API) this is a no-op and the quiz
    // falls back to visibility/blur proctoring — see lib/proctor.ts.
    await enterFullscreen()
    navigate('/mock/quiz', { state: config })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate('/mock')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('mockTests')}
        </button>

        <div className="mb-3 text-center">
          <YellowBadge>{t('examInstructions')}</YellowBadge>
        </div>
        <p className="mb-6 text-center font-heading text-lg font-semibold text-ink">{config.label}</p>

        {/* Exam summary */}
        <div className="mb-6 flex flex-wrap justify-center gap-3">
          <Stat icon={<FileText size={16} />} value={`${totalQ}`} label="Questions" />
          <Stat icon={<Clock size={16} />} value={`${minutes}`} label="Minutes" />
        </div>

        {/* Blueprint breakdown (group exams only) */}
        {blueprint && (
          <div className="card mb-6 p-5">
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-ink2">
              {t('questionDistribution')}
            </h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {blueprint.slots.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg bg-tint px-3 py-2 font-body text-sm text-ink"
                >
                  <span>{s.label}</span>
                  <span className="font-heading font-semibold text-brand">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card mb-6 space-y-4 p-5">
          <Rule icon={<Maximize2 size={18} />} text={t('instrFullscreen')} />
          <Rule icon={<Clock size={18} />} text={t('instrTimer')} />
          <Rule icon={<FileText size={18} />} text={t('instrPalette')} />
          <Rule icon={<Copy size={18} />} text={t('instrNoCopy')} />
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

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5">
      <span className="text-brand">{icon}</span>
      <span className="font-heading text-lg font-bold text-ink">{value}</span>
      <span className="font-body text-xs uppercase tracking-wide text-ink2">{label}</span>
    </div>
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
