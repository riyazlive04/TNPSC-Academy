import { useEffect, useRef } from 'react'
import { BellRing, Phone, UserPlus, X } from 'lucide-react'
import ResponseTimer from './ResponseTimer'
import { useFocusTrap } from '../UI/useFocusTrap'
import { useCrmStore } from '../../store/crmStore'
import { formatPhone, telLink, SOURCE_LABEL } from '../../lib/crm'

/**
 * The interrupt: a lead just arrived and nobody has called them yet.
 *
 * It is a modal on purpose. A toast in the corner is exactly what a telecaller
 * mid-list does not notice, and the whole value of an inbound signup decays in
 * minutes — the response timer starts counting the moment this appears. The two
 * ways out are both a decision: dial now (which claims the lead and logs the
 * attempt in one tap), or leave it in the shared queue for someone else.
 *
 * If several land at once they stack: dismissing one reveals the next, with the
 * remaining count shown so the agent knows what's behind it.
 */
export default function NewLeadPopup() {
  const incoming = useCrmStore((s) => s.incoming)
  const dismiss = useCrmStore((s) => s.dismissIncoming)
  const claim = useCrmStore((s) => s.claim)
  const logClick = useCrmStore((s) => s.logClick)
  const panelRef = useRef<HTMLDivElement>(null)

  const lead = incoming[0] ?? null
  useFocusTrap(Boolean(lead), panelRef)

  useEffect(() => {
    if (!lead) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(lead.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lead, dismiss])

  if (!lead) return null

  const tel = telLink(lead.phone)
  const queued = incoming.length - 1

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm animate-fadeInFast"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="A new lead has arrived"
        tabIndex={-1}
        className="w-full max-w-sm overflow-hidden rounded-hero bg-card shadow-hero animate-slideUp"
      >
        <div className="hero-panel px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-white/20">
              <BellRing size={20} className="animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-2xs font-semibold uppercase tracking-[0.16em] text-white/75">
                New lead
              </p>
              <p className="truncate font-display text-lg font-bold">
                {lead.full_name?.trim() || formatPhone(lead.phone) || 'Unnamed lead'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-sm tabular-nums text-ink">
              {formatPhone(lead.phone) || 'No phone on file'}
            </p>
            <ResponseTimer lead={lead} />
          </div>
          <p className="mt-1 font-body text-2xs text-ink2">
            {SOURCE_LABEL[lead.source]}
            {lead.target_group ? ` · ${lead.target_group}` : ''}
            {lead.city ? ` · ${lead.city}` : ''}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {tel ? (
              <a
                href={tel}
                onClick={() => {
                  void logClick(lead, 'call')
                  dismiss(lead.id)
                }}
                className="btn-brand btn-wrap w-full py-3"
              >
                <Phone size={17} /> Call now
              </a>
            ) : (
              <button
                onClick={() => {
                  void claim(lead.id)
                  dismiss(lead.id)
                }}
                className="btn-brand btn-wrap w-full py-3"
              >
                <UserPlus size={17} /> Claim this lead
              </button>
            )}
            <button
              onClick={() => dismiss(lead.id)}
              className="btn btn-ghost btn-wrap w-full py-2.5 text-sm"
            >
              <X size={15} /> Leave in the queue
            </button>
          </div>

          {queued > 0 && (
            <p className="mt-3 text-center font-body text-2xs text-ink2">
              {queued} more waiting behind this one
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
