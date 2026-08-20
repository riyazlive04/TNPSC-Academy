import { useState } from 'react'
import { Loader2, Mail, MessageCircle, Phone, Send, X } from 'lucide-react'
import { api, type ReportReporter } from '../../lib/api'
import { toast } from '../../store/toastStore'

/**
 * Contact buttons for one student who reported a question, so a superadmin can
 * clarify an unclear report. Two kinds of channel:
 *
 *  - Mail / WhatsApp / call are plain links the OS or browser hands to the
 *    right app, need no backend.
 *  - "Send in-app" opens the same shared thread as the Users-tab conversation
 *    view (api.superadmin.messages) — the student sees it in their bell and
 *    can reply in-app from their own Messages page.
 *
 * Rendered only where `reporters` is populated, i.e. the superadmin console —
 * plain admins triage anonymously and never see contact details.
 */
export default function ContactReporter({ reporter }: { reporter: ReportReporter }) {
  const [composing, setComposing] = useState(false)

  // Prefill enough context that the student knows which report this is about
  // without the admin having to retype it.
  const subject = `About the question you reported`
  const intro = reporter.name ? `Hi ${reporter.name.split(' ')[0]},` : 'Hi,'
  const quoted = reporter.reason ? `\n\nYou wrote: "${reporter.reason}"` : ''
  const mailBody = `${intro}\n\nThanks for reporting a question in TNPSC Mentors.${quoted}\n\nCould you tell us a bit more so we can fix it?\n\n— TNPSC Mentors`
  const waText = `${intro} about the question you reported in TNPSC Mentors${
    reporter.reason ? ` ("${reporter.reason}")` : ''
  } — could you tell us a bit more so we can fix it?`

  // wa.me needs digits only; Indian numbers are stored with and without +91.
  const waNumber = reporter.phone?.replace(/\D/g, '').replace(/^0+/, '') ?? ''
  const waHref = waNumber
    ? `https://wa.me/${waNumber.length === 10 ? `91${waNumber}` : waNumber}?text=${encodeURIComponent(waText)}`
    : null

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {reporter.email && (
          <ContactLink
            href={`mailto:${reporter.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`}
            icon={<Mail size={12} />}
            label="Email"
          />
        )}
        {waHref && (
          <ContactLink href={waHref} icon={<MessageCircle size={12} />} label="WhatsApp" />
        )}
        {reporter.phone && (
          <ContactLink href={`tel:${reporter.phone}`} icon={<Phone size={12} />} label="Call" />
        )}
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 font-body text-2xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
        >
          <Send size={12} /> Send in-app
        </button>
        {!reporter.email && !reporter.phone && (
          <span className="font-body text-2xs text-ink2">No email or phone on this account</span>
        )}
      </div>

      {composing && <MessageComposer reporter={reporter} onClose={() => setComposing(false)} />}
    </>
  )
}

function ContactLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 font-body text-2xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
    >
      {icon} {label}
    </a>
  )
}

/** Compose + send the first message in this student's thread. Tamil copy is
 *  optional (blank = English reaches everyone, matching the broadcast
 *  composer). Lands in the same shared thread the Users-tab conversation
 *  view reads from — see api.superadmin.messages. */
function MessageComposer({
  reporter,
  onClose,
}: {
  reporter: ReportReporter
  onClose: () => void
}) {
  const [body, setBody] = useState(
    reporter.reason
      ? `You reported: "${reporter.reason}". Could you tell us a bit more so we can fix it?`
      : 'Could you tell us a bit more about the question you reported, so we can fix it?'
  )
  const [bodyTa, setBodyTa] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!body.trim()) {
      toast.error('A message is required.')
      return
    }
    setSending(true)
    try {
      await api.superadmin.messages.send(reporter.user_id, {
        body: body.trim(),
        body_ta: bodyTa.trim() || undefined,
      })
      toast.success(`Message sent to ${reporter.name || 'the student'}.`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Send a message"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-ink">
            Message {reporter.name || 'student'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-1 text-ink2 transition hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <Field label="Message" value={body} onChange={setBody} textarea />
        <Field label="Message (Tamil, optional)" value={bodyTa} onChange={setBodyTa} textarea />

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-line px-3 py-1.5 font-body text-xs font-semibold text-ink2 transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-body text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
}) {
  const cls =
    'focus-ring mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 font-body text-sm text-ink outline-none transition hover:border-brand/40'
  return (
    <label className="mb-2 block">
      <span className="font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
        {label}
      </span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  )
}
