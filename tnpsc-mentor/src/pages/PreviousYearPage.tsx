import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import PillButton from '../components/UI/PillButton'
import { GROUPS, GROUP_SUBJECTS, groupLabel } from '../lib/constants'
import type { GroupType } from '../types'
import { useStartTest } from '../hooks/useStartTest'

export default function PreviousYearPage() {
  const navigate = useNavigate()
  const startTest = useStartTest()
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null)

  const subjects = selectedGroup ? GROUP_SUBJECTS[selectedGroup] : []

  const handleSubject = (subject: string) => {
    if (!selectedGroup) return
    startTest({
      category: 'pyq',
      group_type: selectedGroup,
      subject,
      label: `PYQ · ${groupLabel(selectedGroup)} · ${subject}`,
    })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> Test Arena
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>Previous Year Question Paper</YellowBadge>
        </div>

        {/* Row 1 — group selection */}
        <section className="mb-8">
          <h3 className="mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
            Step 1 — Select Group
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {GROUPS.map((g) => (
              <PillButton
                key={g.id}
                active={selectedGroup === g.id}
                onClick={() => setSelectedGroup(g.id)}
              >
                {g.label}
              </PillButton>
            ))}
          </div>
        </section>

        {/* Row 2 — subjects (only when a group is selected) */}
        {selectedGroup && (
          <section className="animate-fadeIn">
            <h3 className="mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
              Step 2 — Select Subject ({groupLabel(selectedGroup)})
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {subjects.map((subject) => (
                <PillButton
                  key={subject}
                  size="sm"
                  onClick={() => handleSubject(subject)}
                >
                  {subject.toUpperCase()}
                </PillButton>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
