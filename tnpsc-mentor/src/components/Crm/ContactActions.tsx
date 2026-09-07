import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import {
  mailLink,
  telLink,
  whatsappLink,
  whatsappOpener,
  type Channel,
  type Lead,
} from '../../lib/crm'

interface ContactActionsProps {
  lead: Lead
  /** `row` is the three-button strip on a card; `stacked` is the detail sheet. */
  variant?: 'row' | 'stacked'
}

/**
 * The click-to-action strip: one tap opens the device's own dialer, WhatsApp, or
 * mail client. These are real anchors, not buttons that call `window.open` —
 * that is what lets Android and iOS hand `tel:` straight to the phone app, and
 * what makes long-press ("copy number", "add contact") work the way an agent
 * expects.
 *
 * Every tap also files a `crm_interactions` row before the handoff. That row is
 * the source of truth for each agent's daily call volume, which is why it is
 * fired here by the link itself rather than left to the agent to log: an
 * attempt that never connected is still an attempt, and it still needs
 * counting. The write is deliberately not awaited — the dialer must open on the
 * same tap, not after a round-trip.
 */
export default function ContactActions({ lead, variant = 'row' }: ContactActionsProps) {
  const logClick = useCrmStore((s) => s.logClick)

  const tel = telLink(lead.phone)
  const wa = whatsappLink(lead.whatsapp ?? lead.phone, whatsappOpener(lead))
  const mail = mailLink(lead.email)

  const record = (channel: Channel) => () => {
    void logClick(lead, channel)
  }

  const stacked = variant === 'stacked'
  const base = stacked
    ? 'btn btn-wrap flex-1 py-3 text-sm'
    : 'btn btn-sm flex-1 min-w-0 py-2.5 text-xs'

  return (
    <div className={`flex items-center gap-2 ${stacked ? 'flex-wrap' : ''}`}>
      {tel ? (
        <a
          href={tel}
          onClick={record('call')}
          className={`${base} bg-brand-gradient text-white shadow-brand hover:brightness-110`}
          aria-label={`Call ${lead.full_name ?? 'this lead'}`}
        >
          <Phone size={stacked ? 17 : 14} />
          Call
        </a>
      ) : (
        <span className={`${base} cursor-not-allowed bg-tint text-ink2/60`} aria-disabled="true">
          <Phone size={stacked ? 17 : 14} />
          No number
        </span>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={record('whatsapp')}
          className={`${base} bg-mintsoft text-correct hover:brightness-95`}
          aria-label={`WhatsApp ${lead.full_name ?? 'this lead'}`}
        >
          <MessageCircle size={stacked ? 17 : 14} />
          WhatsApp
        </a>
      )}

      {mail && (
        <a
          href={mail}
          onClick={record('email')}
          className={`${base} btn-ghost ${stacked ? '' : 'flex-none px-3'}`}
          aria-label={`Email ${lead.full_name ?? 'this lead'}`}
        >
          <Mail size={stacked ? 17 : 14} />
          {stacked && 'Email'}
        </a>
      )}
    </div>
  )
}
