import { ChevronRight, MapPin, Repeat2, UserPlus } from 'lucide-react'
import ContactActions from './ContactActions'
import ResponseTimer from './ResponseTimer'
import { nowMs, useCrmStore } from '../../store/crmStore'
import {
  INTENT_CLASS,
  PLAN_CLASS,
  PLAN_LABEL,
  leadPlan,
  SOURCE_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  dueLabel,
  formatPhone,
  relativeTime,
  type Lead,
} from '../../lib/crm'

interface LeadCardProps {
  lead: Lead
  /** Shows the Claim button — the shared pool only. */
  claimable?: boolean
  /** Shows when the follow-up is due instead of when the lead arrived. */
  showDue?: boolean
  onOpen: (lead: Lead) => void
}

/**
 * One lead in a queue. Built thumb-first: the whole card opens the detail sheet,
 * but the contact links sit in their own row so the common action (dial) is one
 * tap from the list and never behind a navigation.
 */
export default function LeadCard({ lead, claimable, showDue, onOpen }: LeadCardProps) {
  const claim = useCrmStore((s) => s.claim)
  const agentId = useCrmStore((s) => s.agentId)
  const now = nowMs()

  const name = lead.full_name?.trim() || formatPhone(lead.phone) || 'Unnamed lead'
  const mine = lead.assigned_to === agentId
  const plan = leadPlan(lead)

  return (
    <article className="card interactive p-4">
      <button
        type="button"
        onClick={() => onOpen(lead)}
        className="focus-ring flex w-full items-start gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-ink">{name}</h3>
            {/* Already a customer? The single most important thing to know
                before dialling — pitching premium to somebody who bought it
                last week is the fastest way to lose them. */}
            {plan !== 'free' && (
              <span
                className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-bold uppercase tracking-wide ${PLAN_CLASS[plan]}`}
              >
                {PLAN_LABEL[plan]}
              </span>
            )}
            <ResponseTimer lead={lead} />
          </div>

          <p className="mt-0.5 font-body text-sm tabular-nums text-ink2">
            {formatPhone(lead.phone) || 'No phone on file'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${STATUS_CLASS[lead.status]}`}
            >
              {STATUS_LABEL[lead.status]}
            </span>
            {lead.intent_label && (
              <span
                className={`rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${INTENT_CLASS[lead.intent_color ?? 'slate']}`}
              >
                {lead.intent_label}
              </span>
            )}
            <span className="rounded-pill bg-tint px-2 py-0.5 font-heading text-2xs font-medium text-ink2">
              {SOURCE_LABEL[lead.source]}
            </span>
            {lead.city && (
              <span className="inline-flex items-center gap-1 font-body text-2xs text-ink2">
                <MapPin size={11} /> {lead.city}
              </span>
            )}
            {lead.attempts > 0 && (
              <span
                className="inline-flex items-center gap-1 font-body text-2xs text-ink2"
                title={`${lead.attempts} contact attempt${lead.attempts === 1 ? '' : 's'}`}
              >
                <Repeat2 size={11} /> {lead.attempts}
              </span>
            )}
          </div>

          <p className="mt-1.5 font-body text-2xs text-ink2/80">
            {showDue && lead.next_follow_up_at
              ? `Follow up ${dueLabel(lead.next_follow_up_at, now)}`
              : `Arrived ${relativeTime(lead.created_at, now)}`}
            {lead.assigned_name && !mine && ` · ${lead.assigned_name}`}
          </p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-ink2/50" />
      </button>

      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ContactActions lead={lead} />
        </div>
        {claimable && (
          <button
            type="button"
            onClick={() => void claim(lead.id)}
            className="btn btn-sm btn-ghost flex-none px-3 py-2.5 text-xs"
            title="Take this lead off the shared queue"
          >
            <UserPlus size={14} />
            Claim
          </button>
        )}
      </div>
    </article>
  )
}
