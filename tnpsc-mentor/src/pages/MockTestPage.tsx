import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, Minus } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

interface MockPreset {
  id: string
  title: string
  questions: number
  minutes: number
  negative: number // mark deducted per wrong
}

// Approximate TNPSC objective patterns (scaled for practice).
const PRESETS: MockPreset[] = [
  { id: 'g1', title: 'Group 1 Prelims', questions: 100, minutes: 90, negative: 0 },
  { id: 'g2', title: 'Group 2 / 2A', questions: 100, minutes: 90, negative: 0 },
  { id: 'g4', title: 'Group 4 & VAO', questions: 100, minutes: 90, negative: 0 },
  { id: 'quick', title: 'Quick Mock (25 Q)', questions: 25, minutes: 25, negative: 0 },
]

export default function MockTestPage() {
  const navigate = useNavigate()
  const { t } = useT()

  const start = (p: MockPreset) => {
    const config: QuizConfig = {
      category: 'pyq',
      mock: true,
      mockQuestionCount: p.questions,
      mockDurationSeconds: p.minutes * 60,
      negativeMark: p.negative,
      label: `${t('mockTest')} · ${p.title}`,
    }
    navigate('/quiz', { state: config })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-3 text-center">
          <YellowBadge>{t('mockTests')}</YellowBadge>
        </div>
        <p className="tamil mb-8 text-center font-body text-sm text-white/55">{t('fullLength')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => start(p)}
              className="rounded-3xl bg-white p-5 text-left shadow-pill transition hover:-translate-y-1 hover:shadow-card"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText size={22} />
                </span>
                <span className="font-heading text-lg font-bold text-navytext">{p.title}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag>
                  <FileText size={12} /> {p.questions} Q
                </Tag>
                <Tag>
                  <Clock size={12} /> {p.minutes} min
                </Tag>
                {p.negative > 0 && (
                  <Tag>
                    <Minus size={12} /> {p.negative} {t('negMarking')}
                  </Tag>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  )
}
