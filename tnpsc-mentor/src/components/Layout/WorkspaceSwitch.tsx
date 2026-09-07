import { useNavigate } from 'react-router-dom'
import { GraduationCap, Headphones } from 'lucide-react'
import { useT } from '../../lib/i18n'

interface WorkspaceSwitchProps {
  /** Which workspace is on screen right now. */
  active: 'crm' | 'student'
}

/**
 * The two-mode switch a telecaller lives in: **CRM** and **Student**.
 *
 * They hold one account with two jobs — work the lead queue, and use the app
 * they are selling (to learn it, and to walk a lead through it mid-call). A
 * pair of one-way buttons made that a guess about where you'd end up; a
 * segmented control shows both destinations and which one you are in, so the
 * switch is a statement of fact rather than a leap.
 *
 * Rendered in BOTH headers — the student shell and the desk — so the control
 * sits in the same place whichever side you are on, and is only ever shown to
 * accounts that can actually reach both.
 */
export default function WorkspaceSwitch({ active }: WorkspaceSwitchProps) {
  const navigate = useNavigate()
  const { t } = useT()

  const items = [
    { id: 'crm' as const, to: '/crm', icon: Headphones, label: t('leadDesk') },
    { id: 'student' as const, to: '/test-arena', icon: GraduationCap, label: t('studentApp') },
  ]

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-xl bg-tint p-0.5"
      role="group"
      aria-label={t('workspace')}
    >
      {items.map(({ id, to, icon: Icon, label }) => {
        const on = active === id
        return (
          <button
            key={id}
            onClick={() => !on && navigate(to)}
            aria-current={on ? 'page' : undefined}
            title={label}
            className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-heading text-xs font-semibold transition-colors ${
              on ? 'bg-card text-brand shadow-pill' : 'text-ink2 hover:text-ink'
            }`}
          >
            <Icon size={14} />
            {/* The label is the point on a desktop; on a phone the icons carry
                it and the header has no room for two words. */}
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
