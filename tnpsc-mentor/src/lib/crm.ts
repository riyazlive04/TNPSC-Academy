// ─── Telecaller CRM helpers ──────────────────────────────────────────────────
// Shared vocabulary for the lead desk: the wire types, the click-to-action link
// builders, and the response-timer maths. Kept out of the components so the
// page, the popup and the superadmin panel all agree on what "overdue" means.

import type { LucideIcon } from 'lucide-react'
import { Phone, MessageCircle, Mail, StickyNote, Settings2 } from 'lucide-react'

// ─── Wire types ──────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'in_progress'
  | 'follow_up'
  | 'converted'
  | 'not_interested'
  | 'unreachable'
  | 'invalid'

export type LeadSource = 'signup' | 'import' | 'manual' | 'backfill'

export type IntentOutcome =
  | 'interested'
  | 'callback'
  | 'converted'
  | 'not_interested'
  | 'unreachable'
  | 'neutral'

export type IntentColor = 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate'

export type Channel = 'call' | 'whatsapp' | 'email' | 'sms' | 'note'

export interface CrmIntent {
  id: string
  label: string
  label_ta: string | null
  outcome: IntentOutcome
  color: IntentColor
  sort_order: number
  active: boolean
  created_at?: string
  /** Superadmin list only: how many interactions reference this category. */
  uses?: number
}

export interface Lead {
  id: string
  user_id: string | null
  full_name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  city: string | null
  target_group: string | null
  source: LeadSource
  source_detail: string | null
  status: LeadStatus
  intent_id: string | null
  assigned_to: string | null
  assigned_at: string | null
  first_response_at: string | null
  first_response_secs: number | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  attempts: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined on the way out by the server.
  assigned_name?: string | null
  intent_label?: string | null
  intent_color?: IntentColor | null
  /** What this lead has ALREADY paid for. Only leads that are app accounts can
   *  carry a plan; a cold-list row has no account and reads as free. */
  premium?: boolean
  premium_until?: string | null
  vettri?: boolean
  vettri_until?: string | null
}

/** The one-word answer to "have they already bought something?" */
export type LeadPlan = 'premium' | 'vettri' | 'both' | 'free'

export function leadPlan(lead: Pick<Lead, 'premium' | 'vettri'>): LeadPlan {
  if (lead.premium && lead.vettri) return 'both'
  if (lead.premium) return 'premium'
  if (lead.vettri) return 'vettri'
  return 'free'
}

export const PLAN_LABEL: Record<LeadPlan, string> = {
  premium: 'Premium',
  vettri: 'Vettri',
  both: 'Premium + Vettri',
  free: 'Free',
}

export const PLAN_CLASS: Record<LeadPlan, string> = {
  premium: 'bg-goldsoft text-gold',
  vettri: 'bg-tint-violet text-primary',
  both: 'bg-goldsoft text-gold',
  free: 'bg-tint text-ink2',
}

export interface LeadInteraction {
  id: string
  kind: 'click' | 'outcome' | 'system'
  channel: Channel | 'system'
  intent_id: string | null
  status_after: LeadStatus | null
  notes: string | null
  duration_secs: number | null
  created_at: string
  agent_id: string | null
  agent_name: string | null
  intent_label: string | null
  intent_color: IntentColor | null
}

export interface CrmAgentDay {
  agent_id: string
  agent_name: string | null
  agent_email: string | null
  day_ist: string
  calls: number
  whatsapps: number
  emails: number
  outcomes: number
  conversions: number
  leads_touched: number
  avg_response_secs: number | null
}

export interface CrmTodayStats {
  calls: number
  whatsapps: number
  emails: number
  outcomes: number
  conversions: number
  leads_touched: number
}

/** One answer category with how many leads sit on it, and how often it was
 *  recorded today — the second is what moves while a shift is calling. */
export interface IntentBreakdown {
  id: string
  label: string
  color: IntentColor
  outcome: IntentOutcome
  active: boolean
  leads: number
  logged_today: number
}

export interface CrmPipelineMetrics {
  total?: number
  unclaimed?: number
  new_today?: number
  awaiting_first_contact?: number
  follow_ups_due?: number
  converted?: number
  calls_today?: number
  logged_today?: number
  median_response_secs?: number | null
  by_status?: Partial<Record<LeadStatus, number>>
  by_intent?: IntentBreakdown[]
}

// ─── Click-to-action links ───────────────────────────────────────────────────
// The whole point of the desk on a phone: one tap goes straight to the dialer or
// WhatsApp, no copy-paste. Numbers are stored bare 10-digit; the links add the
// country code, which is what the native handlers expect.

const COUNTRY_CODE = '91'

/** Bare 10-digit Indian mobile, or '' when the input isn't one. Mirrors the
 *  server's normalizeMobile() so a number typed on the desk lands in the same
 *  shape the dedupe index keys on. */
export function tenDigit(raw: string | null | undefined): string {
  const cleaned = String(raw ?? '').replace(/[\s\-()]/g, '')
  const m = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/)
  return m ? m[1] : ''
}

/** Pretty form for display: 98765 43210. Falls back to the raw string. */
export function formatPhone(raw: string | null | undefined): string {
  const ten = tenDigit(raw)
  if (!ten) return String(raw ?? '')
  return `${ten.slice(0, 5)} ${ten.slice(5)}`
}

export function telLink(phone: string | null | undefined): string | null {
  const ten = tenDigit(phone)
  return ten ? `tel:+${COUNTRY_CODE}${ten}` : null
}

/**
 * wa.me deep link. On a phone this opens the WhatsApp app directly; on desktop
 * it opens WhatsApp Web. `text` pre-fills the first message so an agent isn't
 * typing the same opener forty times a day.
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const ten = tenDigit(phone)
  if (!ten) return null
  const suffix = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${COUNTRY_CODE}${ten}${suffix}`
}

export function mailLink(email: string | null | undefined): string | null {
  const value = String(email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null
}

/** The opener WhatsApp pre-fills. Uses the lead's first name when we have one. */
export function whatsappOpener(lead: Pick<Lead, 'full_name'>): string {
  const first = (lead.full_name ?? '').trim().split(/\s+/)[0]
  const hello = first ? `Hi ${first}` : 'Hi'
  return `${hello}, this is the TNPSC Mentors team. You recently signed up with us — can I help you get started with your preparation?`
}

// ─── The response timer ──────────────────────────────────────────────────────
// "How long has this lead been waiting for its first call?" A fresh signup is
// warmest in the first few minutes, so the desk shows a live clock and escalates
// its colour as it runs. Thresholds are in seconds.

export const SLA_TARGET_SECS = 5 * 60 // green below this — the goal
export const SLA_WARN_SECS = 15 * 60 // amber up to here
export const SLA_BREACH_SECS = 60 * 60 // red past here

export type SlaLevel = 'fresh' | 'warn' | 'late' | 'breached' | 'done'

export interface SlaState {
  level: SlaLevel
  /** Seconds waited: live if still uncontacted, frozen once first contact landed. */
  seconds: number
  /** True while the clock is still running (nobody has called yet). */
  running: boolean
}

/**
 * Where a lead stands against the response target. `nowMs` is passed in rather
 * than read here so a ticking component drives every card off one clock — and
 * so the page can run off SERVER time, which a telecaller's device clock being
 * minutes out must not be able to fake.
 */
export function slaState(lead: Lead, nowMs: number): SlaState {
  const created = Date.parse(lead.created_at)
  if (lead.first_response_at || lead.first_response_secs != null) {
    const seconds =
      lead.first_response_secs ??
      Math.max(0, Math.round((Date.parse(lead.first_response_at!) - created) / 1000))
    return { level: 'done', seconds, running: false }
  }
  const seconds = Math.max(0, Math.round((nowMs - created) / 1000))
  const level: SlaLevel =
    seconds < SLA_TARGET_SECS
      ? 'fresh'
      : seconds < SLA_WARN_SECS
        ? 'warn'
        : seconds < SLA_BREACH_SECS
          ? 'late'
          : 'breached'
  return { level, seconds, running: true }
}

/** m:ss under an hour, then h:mm, then a day count. Built for a narrow chip. */
export function formatDuration(totalSecs: number): string {
  const s = Math.max(0, Math.round(totalSecs))
  if (s < 3600) {
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }
  if (s < 86_400) {
    const h = Math.floor(s / 3600)
    return `${h}h ${Math.floor((s % 3600) / 60)}m`
  }
  return `${Math.floor(s / 86_400)}d`
}

/** Colour classes for the timer chip, keyed by how urgent it has become. */
export const SLA_CLASS: Record<SlaLevel, string> = {
  fresh: 'bg-mintsoft text-correct',
  warn: 'bg-goldsoft text-gold',
  late: 'bg-accentwarmsoft text-accentwarm',
  breached: 'bg-errorsoft text-error',
  done: 'bg-tint text-ink2',
}

// ─── Presentation tables ─────────────────────────────────────────────────────

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  follow_up: 'Follow up',
  converted: 'Converted',
  not_interested: 'Not interested',
  unreachable: 'Unreachable',
  invalid: 'Invalid',
}

export const STATUS_CLASS: Record<LeadStatus, string> = {
  new: 'bg-tint-violet text-primary',
  in_progress: 'bg-skysoft text-sky',
  follow_up: 'bg-goldsoft text-gold',
  converted: 'bg-mintsoft text-correct',
  not_interested: 'bg-errorsoft text-error',
  unreachable: 'bg-tint text-ink2',
  invalid: 'bg-tint text-ink2',
}

export const SOURCE_LABEL: Record<LeadSource, string> = {
  signup: 'App signup',
  import: 'Cold list',
  manual: 'Added by hand',
  backfill: 'Existing user',
}

export const OUTCOME_LABEL: Record<IntentOutcome, string> = {
  interested: 'Interested',
  callback: 'Call back later',
  converted: 'Converted',
  not_interested: 'Not interested',
  unreachable: 'Could not reach',
  neutral: 'No strong signal',
}

/** Chip colours for the superadmin-defined intent categories. */
export const INTENT_CLASS: Record<IntentColor, string> = {
  violet: 'bg-tint-violet text-primary',
  emerald: 'bg-mintsoft text-correct',
  amber: 'bg-goldsoft text-gold',
  rose: 'bg-errorsoft text-error',
  sky: 'bg-skysoft text-sky',
  slate: 'bg-tint text-ink2',
}

export const INTENT_COLORS: IntentColor[] = ['violet', 'emerald', 'amber', 'rose', 'sky', 'slate']

export const CHANNEL_ICON: Record<Channel | 'system', LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  sms: MessageCircle,
  note: StickyNote,
  system: Settings2,
}

/** "3m ago" / "2h ago" / "5 Sep" — compact enough for a list row. */
export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—'
  const diff = Math.round((nowMs - Date.parse(iso)) / 1000)
  if (!Number.isFinite(diff)) return '—'
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** "in 2h" / "3h overdue" — for the follow-up queue, where both directions matter. */
export function dueLabel(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—'
  const diff = Math.round((Date.parse(iso) - nowMs) / 1000)
  if (!Number.isFinite(diff)) return '—'
  if (diff <= 0) return `${formatDuration(-diff)} overdue`
  return `in ${formatDuration(diff)}`
}

/**
 * A `<input type="datetime-local">` value for `date`, in the browser's own
 * timezone. `toISOString()` would hand the control a UTC wall-clock, which on a
 * phone set to IST reads back 5½ hours early.
 */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// ─── CSV parsing (cold-lead import) ──────────────────────────────────────────

export interface ImportRow {
  name?: string
  phone?: string
  whatsapp?: string
  email?: string
  city?: string
  targetGroup?: string
}

/** Header aliases accepted in an uploaded list, so a superadmin doesn't have to
 *  rename columns before importing a vendor's file. */
const CSV_ALIASES: Record<string, keyof ImportRow> = {
  name: 'name',
  'full name': 'name',
  fullname: 'name',
  student: 'name',
  phone: 'phone',
  mobile: 'phone',
  'phone number': 'phone',
  'mobile number': 'phone',
  contact: 'phone',
  number: 'phone',
  whatsapp: 'whatsapp',
  'whatsapp number': 'whatsapp',
  wa: 'whatsapp',
  email: 'email',
  'email id': 'email',
  mail: 'email',
  city: 'city',
  district: 'city',
  town: 'city',
  group: 'targetGroup',
  'target group': 'targetGroup',
  exam: 'targetGroup',
}

/** Split one CSV line, honouring quoted fields (a name with a comma in it). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/**
 * Parse a pasted/uploaded CSV into import rows. A file with no recognisable
 * header is treated as headerless and read positionally as name, phone, email —
 * the shape most bought lists arrive in.
 */
export function parseLeadCsv(text: string): { rows: ImportRow[]; skipped: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { rows: [], skipped: 0 }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const mapped = header.map((h) => CSV_ALIASES[h])
  const hasHeader = mapped.some(Boolean)
  const body = hasHeader ? lines.slice(1) : lines

  const rows: ImportRow[] = []
  let skipped = 0
  for (const line of body) {
    const cells = splitCsvLine(line)
    const row: ImportRow = {}
    if (hasHeader) {
      mapped.forEach((key, i) => {
        if (key && cells[i]) row[key] = cells[i]
      })
    } else {
      // Positional fallback: find the cell that looks like a phone number rather
      // than trusting column order, then read a name and an email around it.
      const phoneIdx = cells.findIndex((c) => tenDigit(c))
      if (phoneIdx >= 0) row.phone = cells[phoneIdx]
      row.name = cells.find((c, i) => i !== phoneIdx && /[a-z]/i.test(c) && !c.includes('@'))
      row.email = cells.find((c) => c.includes('@'))
    }
    if (!tenDigit(row.phone)) {
      skipped++
      continue
    }
    rows.push(row)
  }
  return { rows, skipped }
}
