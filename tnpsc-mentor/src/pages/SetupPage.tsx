import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { saveGoals } from '../lib/habit'
import { useT } from '../lib/i18n'

const GROUPS = [
  { value: 'Group1', label: 'Group 1' },
  { value: 'Group2_2A', label: 'Group 2 / 2A' },
  { value: 'Group4_VAO', label: 'Group 4 & VAO' },
]

export default function SetupPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const { t } = useT()

  const [group, setGroup] = useState(profile?.target_group ?? 'Group1')
  const [examDate, setExamDate] = useState(profile?.exam_date ?? '')
  const [goal, setGoal] = useState(profile?.daily_goal ?? 20)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    await saveGoals(user.id, {
      target_group: group,
      exam_date: examDate || null,
      daily_goal: Number(goal) || 20,
    })
    await fetchProfile(user.id)
    setSaving(false)
    navigate('/test-arena', { replace: true })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <YellowBadge>{t('setupTitle')}</YellowBadge>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-secondary/30 p-6 shadow-card backdrop-blur">
          <div className="mb-5 flex justify-center text-accent">
            <Target size={36} />
          </div>

          <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
            {t('targetGroup')}
          </label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="input-pill mb-4 appearance-none"
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
            {t('examDate')}
          </label>
          <input
            type="date"
            value={examDate ?? ''}
            onChange={(e) => setExamDate(e.target.value)}
            className="input-pill mb-4"
          />

          <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
            {t('dailyGoalQ')}
          </label>
          <input
            type="number"
            min={5}
            max={200}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="input-pill mb-6"
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? '…' : t('saveContinue')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/test-arena')}
            className="mt-3 w-full font-heading text-sm font-semibold uppercase tracking-wide text-white/60 transition hover:text-accent"
          >
            {t('skip')}
          </button>
        </form>
      </div>
    </AppLayout>
  )
}
