import { normalizeMobile } from './msg91.js'

// ─── CRM pure logic ──────────────────────────────────────────────────────────
// The decision-making inside routes/crm.ts, lifted out so it can be tested
// without an HTTP server or a database. These are the parts that were verified
// only by hand against production, which is exactly the kind of correctness
// that does not survive the next refactor.

export const LEAD_STATUSES = [
  'new',
  'in_progress',
  'follow_up',
  'converted',
  'not_interested',
  'unreachable',
  'invalid',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const CHANNELS = ['call', 'whatsapp', 'email', 'sms', 'note'] as const
export type Channel = (typeof CHANNELS)[number]

export const LEAD_SOURCES = ['signup', 'import', 'manual', 'backfill'] as const

/** Bare 10-digit Indian mobile, or '' when the input isn't one. Shared with the
 *  DB trigger's own normalisation so signup leads and imports dedupe together. */
export function tenDigit(raw: unknown): string {
  return normalizeMobile(String(raw ?? ''))
}

/** A UTC epoch as its IST (UTC+5:30, no DST) calendar date, 'YYYY-MM-DD' —
 *  the shape crm_interactions.day_ist is stored in. */
export function istDate(epochMs: number): string {
  return new Date(epochMs + 330 * 60_000).toISOString().slice(0, 10)
}

export function cleanText(raw: unknown, max = 500): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return s.slice(0, max)
}

/**
 * Strip the characters that would let a search term rewrite a PostgREST filter.
 *
 * `.or()` takes a filter STRING, so the term is interpolated into query syntax
 * rather than bound as a parameter. A comma ends one condition and starts
 * another; parentheses group; quotes and backslash escape. Dots stay — they are
 * only structural BEFORE the operator, so an email still searches correctly —
 * and `%` stays because it is just an ilike wildcard.
 */
export function safeFilterTerm(raw: string): string {
  return raw.replace(/[,()"\\]/g, '').trim()
}

/** What logging an intent does to the lead's pipeline status. */
export const OUTCOME_TO_STATUS: Record<string, LeadStatus> = {
  interested: 'in_progress',
  callback: 'follow_up',
  converted: 'converted',
  not_interested: 'not_interested',
  unreachable: 'unreachable',
  neutral: 'in_progress',
}

/**
 * Append a dated line to a lead's running note.
 *
 * The lead note is a summary several agents contribute to over months, so a new
 * call has to add to it rather than replace it — overwriting silently erased
 * what the previous caller learned. Trimmed from the FRONT when it outgrows the
 * cap, because the newest note is the one that matters.
 */
export function appendNote(previous: string | null, addition: string, when = new Date()): string {
  const stamp = when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const line = `[${stamp}] ${addition}`
  const joined = previous ? `${previous}\n${line}` : line
  return joined.length <= 4000 ? joined : joined.slice(-4000)
}

/** Seconds between a lead reaching the desk and its first contact. Uses
 *  entered_at, so a backfilled account that signed up in June is not recorded
 *  as a three-month response. */
export function firstResponseSecs(
  lead: { created_at?: string | null; entered_at?: string | null },
  nowMs: number
): number {
  const base = Date.parse(String(lead.entered_at ?? lead.created_at ?? ''))
  if (!Number.isFinite(base)) return 0
  return Math.max(0, Math.round((nowMs - base) / 1000))
}

/** One CSV cell. Everything is quoted: names contain commas, notes contain
 *  quotes, and a phone number must not be re-interpreted by a spreadsheet. */
export function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}
