import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import {
  requireAuth,
  requireCrmStaff,
  requireSuperadmin,
  type AuthedRequest,
} from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { normalizeMobile } from '../lib/msg91.js'

// ─── Telecaller CRM ──────────────────────────────────────────────────────────
// The lead desk behind /crm. Every route here is staff-only (telecaller, admin
// or superadmin); the taxonomy/import/reporting half additionally requires a
// superadmin. Reads and writes use the service-role client — crm_* tables have
// RLS on with no policies, so this server is their only door (see crm.sql).

const router = Router()
router.use(requireAuth, requireCrmStaff)

/** True for the supervisors, who see every agent's desk rather than just theirs. */
function isSupervisor(req: AuthedRequest): boolean {
  return req.role === 'admin' || req.role === 'superadmin'
}

const LEAD_COLUMNS =
  'id, user_id, full_name, phone, whatsapp, email, city, target_group, source, source_detail, ' +
  'status, intent_id, assigned_to, assigned_at, first_response_at, first_response_secs, ' +
  'last_contacted_at, next_follow_up_at, attempts, notes, created_at, updated_at'

const LEAD_STATUSES = [
  'new',
  'in_progress',
  'follow_up',
  'converted',
  'not_interested',
  'unreachable',
  'invalid',
] as const
type LeadStatus = (typeof LEAD_STATUSES)[number]

const CHANNELS = ['call', 'whatsapp', 'email', 'sms', 'note'] as const
type Channel = (typeof CHANNELS)[number]

/** Bare 10-digit Indian mobile, or '' when the input isn't one. Shared with the
 *  DB trigger's own normalisation so signup leads and imports dedupe together. */
function tenDigit(raw: unknown): string {
  return normalizeMobile(String(raw ?? ''))
}

/** A UTC epoch as its IST (UTC+5:30, no DST) calendar date, 'YYYY-MM-DD' —
 *  the shape crm_interactions.day_ist is stored in. */
function istDate(epochMs: number): string {
  return new Date(epochMs + 330 * 60_000).toISOString().slice(0, 10)
}

function cleanText(raw: unknown, max = 500): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return s.slice(0, max)
}

/**
 * PostgREST rows come back untyped here (this project has no generated DB
 * types), so everything below works in plain records and casts once at the
 * boundary rather than sprinkling `as` across every handler.
 */
type Row = Record<string, unknown>

const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : [])
const asRow = (data: unknown): Row => (data ?? {}) as Row

/** Attach each lead's agent + intent labels without an N+1 of round-trips. */
async function decorate(rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return rows

  const agentIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
  const intentIds = [...new Set(rows.map((r) => r.intent_id).filter(Boolean))] as string[]

  const agents = agentIds.length
    ? asRows(
        (await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', agentIds)).data
      )
    : []
  const intents = intentIds.length
    ? asRows(
        (await supabaseAdmin.from('crm_intents').select('id, label, outcome, color').in('id', intentIds))
          .data
      )
    : []

  const agentById = new Map(agents.map((a) => [String(a.id), a]))
  const intentById = new Map(intents.map((i) => [String(i.id), i]))

  // What each lead has already paid for. Only leads that ARE accounts can have
  // a plan; a cold-list row has no user_id and stays 'free'. One RPC for the
  // whole page rather than a query per lead.
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const planByUser = new Map<string, Row>()
  if (userIds.length) {
    const { data } = await supabaseAdmin.rpc('crm_lead_plans', { p_ids: userIds })
    for (const row of asRows(data)) planByUser.set(String(row.user_id), row)
  }

  return rows.map((r) => {
    const intent = intentById.get(String(r.intent_id))
    const plan = r.user_id ? planByUser.get(String(r.user_id)) : undefined
    return {
      ...r,
      assigned_name: (agentById.get(String(r.assigned_to))?.full_name as string | null) ?? null,
      intent_label: (intent?.label as string | null) ?? null,
      intent_color: (intent?.color as string | null) ?? null,
      premium: Boolean(plan?.premium),
      premium_until: (plan?.premium_until as string | null) ?? null,
      vettri: Boolean(plan?.vettri),
      vettri_until: (plan?.vettri_until as string | null) ?? null,
    }
  })
}

// ─── GET /api/crm/bootstrap ──────────────────────────────────────────────────
// Everything the desk needs on open, in one round-trip: who I am, the intent
// taxonomy, the pipeline counters, and my own numbers for today. Also returns
// `now` so the client's response timers tick off SERVER time — a telecaller's
// phone clock being minutes out must not fake an SLA.
router.get(
  '/bootstrap',
  asyncH(async (req: AuthedRequest, res) => {
    const [profile, intents, metrics, mine] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', req.userId!)
        .maybeSingle(),
      supabaseAdmin
        .from('crm_intents')
        .select('id, label, label_ta, outcome, color, sort_order, active')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      req.db!.rpc('crm_pipeline_metrics'),
      req.db!.rpc('crm_agent_stats', { p_agent: req.userId }),
    ])

    if (intents.error) return sendDbError(res, intents.error)

    const today = ((mine.data ?? []) as Record<string, unknown>[])[0] ?? null

    res.json({
      agent: profile.data ?? null,
      supervisor: isSupervisor(req),
      intents: intents.data ?? [],
      metrics: metrics.data ?? {},
      today: today && {
        calls: Number(today.calls ?? 0),
        whatsapps: Number(today.whatsapps ?? 0),
        emails: Number(today.emails ?? 0),
        outcomes: Number(today.outcomes ?? 0),
        conversions: Number(today.conversions ?? 0),
        leads_touched: Number(today.leads_touched ?? 0),
      },
      now: new Date().toISOString(),
    })
  })
)

// ─── GET /api/crm/leads ──────────────────────────────────────────────────────
// One page of a queue.
//   queue=pool       unclaimed and still 'new' — the shared inbox, newest first
//   queue=mine       assigned to me, open statuses first
//   queue=followups  mine (or anyone's, for a supervisor) coming due
//   queue=all        everything, for search
router.get(
  '/leads',
  asyncH(async (req: AuthedRequest, res) => {
    const queue = String(req.query.queue ?? 'pool')
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 50, 1), 200)
    const offset = Math.max(Math.trunc(Number(req.query.offset)) || 0, 0)
    const search = cleanText(req.query.search, 80)
    const status = String(req.query.status ?? '')

    let q = supabaseAdmin.from('crm_leads').select(LEAD_COLUMNS, { count: 'exact' })

    if (queue === 'pool') {
      q = q.is('assigned_to', null).eq('status', 'new').order('created_at', { ascending: false })
    } else if (queue === 'mine') {
      q = q.eq('assigned_to', req.userId!).order('updated_at', { ascending: false })
    } else if (queue === 'followups') {
      q = q
        .not('next_follow_up_at', 'is', null)
        .lte('next_follow_up_at', new Date(Date.now() + 24 * 3600_000).toISOString())
        .not('status', 'in', '("converted","not_interested","invalid")')
        .order('next_follow_up_at', { ascending: true })
      // An agent's follow-ups are their own; supervisors see the whole board.
      if (!isSupervisor(req)) q = q.eq('assigned_to', req.userId!)
    } else {
      q = q.order('created_at', { ascending: false })
    }

    if ((LEAD_STATUSES as readonly string[]).includes(status)) q = q.eq('status', status)

    // Filter by the answer the lead gave. 'none' is its own meaningful filter —
    // "claimed but nothing recorded yet" is the pile an agent most needs to
    // find, and it can't be expressed by picking a category.
    const intent = cleanText(req.query.intent, 64)
    if (intent === 'none') q = q.is('intent_id', null)
    else if (intent) q = q.eq('intent_id', intent)

    const source = String(req.query.source ?? '')
    if (['signup', 'import', 'manual', 'backfill'].includes(source)) q = q.eq('source', source)

    // Plan filtering can't be a column predicate — entitlement is derived from
    // the payments table (see crm_lead_plans), not stored on the lead. Resolve
    // the matching user ids first and constrain the query to them. 'free' is
    // the one an agent actually works: everyone with nothing to lose by being
    // pitched.
    const plan = String(req.query.plan ?? '')
    if (['premium', 'vettri', 'paid', 'free'].includes(plan)) {
      const { data: paidRows } = await supabaseAdmin
        .from('payments')
        .select('user_id, notes, created_at')
        .eq('status', 'paid')
        .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      const premiumIds = new Set<string>()
      const vettriIds = new Set<string>()
      for (const row of asRows(paidRows)) {
        const planName = (row.notes as { plan?: string } | null)?.plan
        const age = Date.now() - Date.parse(String(row.created_at))
        const days = age / 86_400_000
        const id = String(row.user_id)
        if (planName === 'premium_annual' && days <= 90) premiumIds.add(id)
        if (planName === 'vettri_nichayam' && days <= 60) vettriIds.add(id)
        if (planName === 'vettri_month' && days <= 30) vettriIds.add(id)
      }
      const match =
        plan === 'premium' ? premiumIds
        : plan === 'vettri' ? vettriIds
        : new Set([...premiumIds, ...vettriIds])

      if (plan === 'free') {
        // Everyone who is NOT in the paid set. Expressed as "no user_id at all
        // (a cold-list row) OR a user id outside the paid set".
        const ids = [...match]
        if (ids.length) q = q.or(`user_id.is.null,user_id.not.in.(${ids.join(',')})`)
      } else if (match.size === 0) {
        return res.json({ leads: [], total: 0, now: new Date().toISOString() })
      } else {
        q = q.in('user_id', [...match])
      }
    }
    if (search) {
      // `.or()` takes a PostgREST filter STRING, so the term is interpolated
      // into query syntax rather than bound as a parameter. A comma would end
      // one condition and start another, and parentheses/quotes/backslash are
      // its grouping and escaping syntax — any of them lets a search term
      // rewrite the filter. Strip exactly those. Dots stay: they are only
      // structural BEFORE the operator, so an email searches correctly, and %
      // stays because it is just an ilike wildcard.
      const safe = search.replace(/[,()"\\]/g, '').trim()
      const digits = search.replace(/[^0-9]/g, '')
      const terms: string[] = []
      if (safe) terms.push(`full_name.ilike.%${safe}%`, `email.ilike.%${safe}%`)
      if (digits) terms.push(`phone.ilike.%${digits}%`, `whatsapp.ilike.%${digits}%`)
      // An all-punctuation search matches nothing rather than everything.
      if (terms.length === 0) return res.json({ leads: [], total: 0, now: new Date().toISOString() })
      q = q.or(terms.join(','))
    }

    const { data, error, count } = await q.range(offset, offset + limit - 1)
    if (error) return sendDbError(res, error)

    res.json({ leads: await decorate(asRows(data)), total: count ?? 0, now: new Date().toISOString() })
  })
)

// ─── GET /api/crm/leads/incoming?since=ISO ───────────────────────────────────
// The "a new lead just arrived" poll. Returns only leads created since the
// cursor that are still unclaimed, so a lead someone already picked up never
// pops on another agent's screen. Cheap enough to run every few seconds.
router.get(
  '/leads/incoming',
  asyncH(async (req: AuthedRequest, res) => {
    const sinceRaw = String(req.query.since ?? '')
    const since = Number.isNaN(Date.parse(sinceRaw))
      ? new Date(Date.now() - 5 * 60_000).toISOString()
      : new Date(sinceRaw).toISOString()

    const { data, error } = await supabaseAdmin
      .from('crm_leads')
      .select(LEAD_COLUMNS)
      .gt('created_at', since)
      .is('assigned_to', null)
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(20)
    if (error) return sendDbError(res, error)

    // The overwhelmingly common answer is "nothing new". Tell the audit trail
    // to skip those so it stays a record of who looked at whose phone number,
    // rather than a log of a timer firing.
    if ((data ?? []).length === 0) res.locals.auditSkip = true

    res.json({ leads: await decorate(asRows(data)), now: new Date().toISOString() })
  })
)

// ─── GET /api/crm/leads/:id ──────────────────────────────────────────────────
// One lead plus its full interaction timeline.
router.get(
  '/leads/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { data: lead, error } = await supabaseAdmin
      .from('crm_leads')
      .select(LEAD_COLUMNS)
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!lead) return res.status(404).json({ error: 'Lead not found.' })

    const { data: rows } = await supabaseAdmin
      .from('crm_interactions')
      .select('id, kind, channel, intent_id, status_after, notes, duration_secs, created_at, agent_id')
      .eq('lead_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const history = asRows(rows)
    const agentIds = [...new Set(history.map((h) => h.agent_id).filter(Boolean))] as string[]
    const intentIds = [...new Set(history.map((h) => h.intent_id).filter(Boolean))] as string[]

    const agents = agentIds.length
      ? asRows((await supabaseAdmin.from('profiles').select('id, full_name').in('id', agentIds)).data)
      : []
    const intents = intentIds.length
      ? asRows(
          (await supabaseAdmin.from('crm_intents').select('id, label, color').in('id', intentIds)).data
        )
      : []
    const agentById = new Map(agents.map((a) => [String(a.id), a.full_name as string | null]))
    const intentById = new Map(intents.map((i) => [String(i.id), i]))

    const [decorated] = await decorate([asRow(lead)])

    res.json({
      lead: decorated,
      history: history.map((h) => {
        const intent = intentById.get(String(h.intent_id))
        return {
          ...h,
          agent_name: agentById.get(String(h.agent_id)) ?? null,
          intent_label: (intent?.label as string | null) ?? null,
          intent_color: (intent?.color as string | null) ?? null,
        }
      }),
      now: new Date().toISOString(),
    })
  })
)

// ─── POST /api/crm/leads/:id/claim ───────────────────────────────────────────
// Take a lead out of the shared pool. Conditional on it still being unclaimed,
// so two agents tapping Claim at the same moment can't both win it — the loser
// gets a 409 and the row back so their list can correct itself.
router.post(
  '/leads/:id/claim',
  asyncH(async (req: AuthedRequest, res) => {
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('crm_leads')
      .update({ assigned_to: req.userId, assigned_at: now, status: 'in_progress' })
      .eq('id', req.params.id)
      .is('assigned_to', null)
      .select(LEAD_COLUMNS)
      .maybeSingle()
    if (error) return sendDbError(res, error)

    if (!data) {
      const { data: current } = await supabaseAdmin
        .from('crm_leads')
        .select(LEAD_COLUMNS)
        .eq('id', req.params.id)
        .maybeSingle()
      if (!current) return res.status(404).json({ error: 'Lead not found.' })
      const [decorated] = await decorate([asRow(current)])
      return res.status(409).json({ error: 'already_claimed', lead: decorated })
    }

    await supabaseAdmin.from('crm_interactions').insert({
      lead_id: req.params.id,
      agent_id: req.userId,
      kind: 'system',
      channel: 'system',
      notes: 'Claimed from the pool',
    })

    const [decorated] = await decorate([asRow(data)])
    res.json({ lead: decorated })
  })
)

// ─── POST /api/crm/leads/:id/release ─────────────────────────────────────────
// Hand a lead back to the pool. An agent may release only their own.
router.post(
  '/leads/:id/release',
  asyncH(async (req: AuthedRequest, res) => {
    let q = supabaseAdmin
      .from('crm_leads')
      .update({ assigned_to: null, assigned_at: null, status: 'new' })
      .eq('id', req.params.id)
    if (!isSupervisor(req)) q = q.eq('assigned_to', req.userId!)

    const { data, error } = await q.select(LEAD_COLUMNS).maybeSingle()
    if (error) return sendDbError(res, error)
    if (!data) return res.status(403).json({ error: 'This lead is not yours to release.' })

    const [decorated] = await decorate([asRow(data)])
    res.json({ lead: decorated })
  })
)

// ─── POST /api/crm/leads/:id/click ───────────────────────────────────────────
// Fired by the tel: / wa.me / mailto: links themselves. This is the event that
// makes "calls today per agent" countable without trusting anyone to log every
// attempt, AND it is what stops the response timer: the first click of any
// channel stamps first_response_at.
router.post(
  '/leads/:id/click',
  asyncH(async (req: AuthedRequest, res) => {
    const channel = String(req.body?.channel ?? 'call') as Channel
    if (!(CHANNELS as readonly string[]).includes(channel)) {
      return res.status(400).json({ error: 'Unknown channel.' })
    }

    const { data: lead, error } = await supabaseAdmin
      .from('crm_leads')
      .select('id, created_at, first_response_at, attempts, assigned_to, status')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!lead) return res.status(404).json({ error: 'Lead not found.' })

    const now = new Date()
    const patch: Record<string, unknown> = {
      last_contacted_at: now.toISOString(),
      attempts: Number(lead.attempts ?? 0) + 1,
    }

    // Stop the clock on the first contact attempt, whatever the channel.
    if (!lead.first_response_at) {
      patch.first_response_at = now.toISOString()
      patch.first_response_secs = Math.max(
        0,
        Math.round((now.getTime() - new Date(lead.created_at as string).getTime()) / 1000)
      )
    }
    // Dialling an unclaimed lead claims it — the agent is plainly working it,
    // and leaving it in the pool invites a second agent to call the same person.
    if (!lead.assigned_to) {
      patch.assigned_to = req.userId
      patch.assigned_at = now.toISOString()
    }
    if (lead.status === 'new') patch.status = 'in_progress'

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('crm_leads')
      .update(patch)
      .eq('id', req.params.id)
      .select(LEAD_COLUMNS)
      .maybeSingle()
    if (upErr) return sendDbError(res, upErr)

    await supabaseAdmin.from('crm_interactions').insert({
      lead_id: req.params.id,
      agent_id: req.userId,
      kind: 'click',
      channel,
    })

    const [decorated] = await decorate([asRow(updated)])
    res.json({ lead: decorated })
  })
)

// ─── POST /api/crm/leads/:id/log ─────────────────────────────────────────────
// The agent's outcome: which intent the lead expressed, free notes, an optional
// call duration and a follow-up time. The intent's own `outcome` drives the new
// lead status unless the agent picked one explicitly.
const OUTCOME_TO_STATUS: Record<string, LeadStatus> = {
  interested: 'in_progress',
  callback: 'follow_up',
  converted: 'converted',
  not_interested: 'not_interested',
  unreachable: 'unreachable',
  neutral: 'in_progress',
}

router.post(
  '/leads/:id/log',
  asyncH(async (req: AuthedRequest, res) => {
    const intentId = cleanText(req.body?.intentId, 64)
    const notes = cleanText(req.body?.notes, 2000)
    const explicitStatus = String(req.body?.status ?? '')
    const durationRaw = Math.trunc(Number(req.body?.durationSecs))
    const durationSecs =
      Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(durationRaw, 4 * 3600) : null
    const followUpRaw = String(req.body?.nextFollowUpAt ?? '')
    const nextFollowUpAt = Number.isNaN(Date.parse(followUpRaw))
      ? null
      : new Date(followUpRaw).toISOString()

    if (!intentId && !notes && !explicitStatus) {
      return res.status(400).json({ error: 'Pick an intent or write a note.' })
    }

    const { data: lead, error } = await supabaseAdmin
      .from('crm_leads')
      .select('id, created_at, first_response_at, assigned_to')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!lead) return res.status(404).json({ error: 'Lead not found.' })

    // Resolve the intent so an agent can't post an id that doesn't exist (or is
    // retired) and so its outcome can drive the status.
    let intent: { id: string; outcome: string } | null = null
    if (intentId) {
      const { data } = await supabaseAdmin
        .from('crm_intents')
        .select('id, outcome')
        .eq('id', intentId)
        .eq('active', true)
        .maybeSingle()
      if (!data) return res.status(400).json({ error: 'Unknown intent category.' })
      intent = data
    }

    const status: LeadStatus | null = (LEAD_STATUSES as readonly string[]).includes(explicitStatus)
      ? (explicitStatus as LeadStatus)
      : intent
        ? (OUTCOME_TO_STATUS[intent.outcome] ?? 'in_progress')
        : null

    const now = new Date()
    const patch: Record<string, unknown> = {
      last_contacted_at: now.toISOString(),
      next_follow_up_at: nextFollowUpAt,
    }
    if (status) patch.status = status
    if (intent) patch.intent_id = intent.id
    if (notes) patch.notes = notes
    // Logging an outcome is a contact too — if the agent dialled from their own
    // handset rather than the link, this still stops the clock.
    if (!lead.first_response_at) {
      patch.first_response_at = now.toISOString()
      patch.first_response_secs = Math.max(
        0,
        Math.round((now.getTime() - new Date(lead.created_at as string).getTime()) / 1000)
      )
    }
    if (!lead.assigned_to) {
      patch.assigned_to = req.userId
      patch.assigned_at = now.toISOString()
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('crm_leads')
      .update(patch)
      .eq('id', req.params.id)
      .select(LEAD_COLUMNS)
      .maybeSingle()
    if (upErr) return sendDbError(res, upErr)

    const { error: insErr } = await supabaseAdmin.from('crm_interactions').insert({
      lead_id: req.params.id,
      agent_id: req.userId,
      kind: 'outcome',
      channel: 'call',
      intent_id: intent?.id ?? null,
      status_after: status,
      notes,
      duration_secs: durationSecs,
    })
    if (insErr) return sendDbError(res, insErr)

    const [decorated] = await decorate([asRow(updated)])
    res.json({ lead: decorated })
  })
)

// ─── PATCH /api/crm/leads/:id ────────────────────────────────────────────────
// Correct the contact details a lead reads out on the call (a better number, a
// spelling, the city). Contact fields only — status and assignment move through
// their own endpoints so every change of ownership leaves a trail.
router.patch(
  '/leads/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const patch: Record<string, unknown> = {}
    if ('fullName' in (req.body ?? {})) patch.full_name = cleanText(req.body.fullName, 120)
    if ('email' in (req.body ?? {})) patch.email = cleanText(req.body.email, 200)
    if ('city' in (req.body ?? {})) patch.city = cleanText(req.body.city, 80)
    if ('notes' in (req.body ?? {})) patch.notes = cleanText(req.body.notes, 2000)
    if ('phone' in (req.body ?? {})) {
      const ten = tenDigit(req.body.phone)
      if (req.body.phone && !ten) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' })
      patch.phone = ten || null
    }
    if ('whatsapp' in (req.body ?? {})) {
      const ten = tenDigit(req.body.whatsapp)
      if (req.body.whatsapp && !ten) return res.status(400).json({ error: 'Enter a valid 10-digit WhatsApp number.' })
      patch.whatsapp = ten || null
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('crm_leads')
      .update(patch)
      .eq('id', req.params.id)
      .select(LEAD_COLUMNS)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!data) return res.status(404).json({ error: 'Lead not found.' })

    const [decorated] = await decorate([asRow(data)])
    res.json({ lead: decorated })
  })
)

// ─── GET /api/crm/stats ──────────────────────────────────────────────────────
// Daily volume. A telecaller sees only their own rows (the RPC enforces that
// server-side too); a supervisor sees every agent.
router.get(
  '/stats',
  asyncH(async (req: AuthedRequest, res) => {
    const days = Math.min(Math.max(Math.trunc(Number(req.query.days)) || 7, 1), 90)
    // crm_interactions.day_ist is an IST calendar day, so the window has to be
    // IST too — a UTC-derived "today" is yesterday's date for the five and a
    // half hours after midnight in India, which is exactly when a late shift
    // would check its own numbers and find them missing.
    const now = Date.now()
    const to = istDate(now)
    const from = istDate(now - (days - 1) * 24 * 3600_000)

    const { data, error } = await req.db!.rpc('crm_agent_stats', {
      p_from: from,
      p_to: to,
      p_agent: isSupervisor(req) ? (cleanText(req.query.agent, 64) ?? null) : req.userId,
    })
    if (error) return sendDbError(res, error)
    res.json({ stats: data ?? [] })
  })
)

// ════════════════════════════════════════════════════════════════════════════
// Superadmin half: the intent taxonomy, cold-lead import, assignment, backfill.
// ════════════════════════════════════════════════════════════════════════════
const admin = Router()
admin.use(requireSuperadmin)

// ─── GET/POST/PATCH/DELETE /api/crm/intents ──────────────────────────────────
// The customizable intent categories the whole desk logs against.
router.get(
  '/intents/all',
  requireSuperadmin,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('crm_intents')
      .select('id, label, label_ta, outcome, color, sort_order, active, created_at')
      .order('sort_order', { ascending: true })
    if (error) return sendDbError(res, error)

    // Usage counts, so a superadmin can see which categories are actually
    // earning their place before retiring one.
    const { data: used } = await supabaseAdmin.from('crm_interactions').select('intent_id')
    const counts = new Map<string, number>()
    for (const row of used ?? []) {
      const id = row.intent_id as string | null
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }

    res.json({
      intents: (data ?? []).map((i) => ({ ...i, uses: counts.get(i.id) ?? 0 })),
    })
  })
)

const INTENT_OUTCOMES = [
  'interested',
  'callback',
  'converted',
  'not_interested',
  'unreachable',
  'neutral',
]
const INTENT_COLORS = ['violet', 'emerald', 'amber', 'rose', 'sky', 'slate']

function intentPatch(body: Record<string, unknown>): Record<string, unknown> | string {
  const patch: Record<string, unknown> = {}
  if ('label' in body) {
    const label = cleanText(body.label, 60)
    if (!label) return 'A label is required.'
    patch.label = label
  }
  if ('labelTa' in body) patch.label_ta = cleanText(body.labelTa, 80)
  if ('outcome' in body) {
    const outcome = String(body.outcome ?? '')
    if (!INTENT_OUTCOMES.includes(outcome)) return `Unknown outcome: ${outcome}`
    patch.outcome = outcome
  }
  if ('color' in body) {
    const color = String(body.color ?? '')
    if (!INTENT_COLORS.includes(color)) return `Unknown color: ${color}`
    patch.color = color
  }
  if ('sortOrder' in body) patch.sort_order = Math.trunc(Number(body.sortOrder)) || 0
  if ('active' in body) patch.active = Boolean(body.active)
  return patch
}

admin.post(
  '/intents',
  asyncH(async (req: AuthedRequest, res) => {
    const patch = intentPatch(req.body ?? {})
    if (typeof patch === 'string') return res.status(400).json({ error: patch })
    if (!patch.label) return res.status(400).json({ error: 'A label is required.' })

    const { data, error } = await supabaseAdmin
      .from('crm_intents')
      .insert(patch)
      .select('id, label, label_ta, outcome, color, sort_order, active, created_at')
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ intent: { ...data, uses: 0 } })
  })
)

admin.patch(
  '/intents/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const patch = intentPatch(req.body ?? {})
    if (typeof patch === 'string') return res.status(400).json({ error: patch })
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('crm_intents')
      .update(patch)
      .eq('id', req.params.id)
      .select('id, label, label_ta, outcome, color, sort_order, active, created_at')
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!data) return res.status(404).json({ error: 'Intent not found.' })
    res.json({ intent: data })
  })
)

// Deleting an intent that has already been logged against would blank the
// history (the FK is ON DELETE SET NULL), so a used category is retired
// (active=false) instead — it stays readable on old interactions but stops
// being offered on the form.
admin.delete(
  '/intents/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { count } = await supabaseAdmin
      .from('crm_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('intent_id', req.params.id)

    if ((count ?? 0) > 0) {
      const { data, error } = await supabaseAdmin
        .from('crm_intents')
        .update({ active: false })
        .eq('id', req.params.id)
        .select('id, label, label_ta, outcome, color, sort_order, active, created_at')
        .maybeSingle()
      if (error) return sendDbError(res, error)
      return res.json({ retired: true, intent: data })
    }

    const { error } = await supabaseAdmin.from('crm_intents').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ retired: false })
  })
)

// ─── POST /api/crm/admin/import ──────────────────────────────────────────────
// Bulk cold-lead import. Takes already-parsed rows (the console parses the CSV
// in the browser) and upserts on phone, so re-importing a list that overlaps an
// earlier batch — or a number that already signed up — updates rather than
// duplicating. Reports what happened per row.
admin.post(
  '/import',
  asyncH(async (req: AuthedRequest, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null
    if (!rows) return res.status(400).json({ error: 'rows must be an array.' })
    if (rows.length > 2000) return res.status(400).json({ error: 'Import at most 2000 rows at a time.' })
    const batch = cleanText(req.body?.batch, 80)

    const seen = new Set<string>()
    const valid: Record<string, unknown>[] = []
    let invalid = 0
    let duplicateInFile = 0

    for (const raw of rows as Record<string, unknown>[]) {
      const phone = tenDigit(raw.phone)
      if (!phone) {
        invalid++
        continue
      }
      if (seen.has(phone)) {
        duplicateInFile++
        continue
      }
      seen.add(phone)
      const whatsapp = tenDigit(raw.whatsapp) || phone
      valid.push({
        full_name: cleanText(raw.name ?? raw.full_name, 120),
        phone,
        whatsapp,
        email: cleanText(raw.email, 200),
        city: cleanText(raw.city, 80),
        target_group: cleanText(raw.targetGroup ?? raw.target_group, 40),
        source: 'import',
        source_detail: batch,
      })
    }

    if (valid.length === 0) {
      return res.json({ inserted: 0, updated: 0, invalid, duplicateInFile })
    }

    // Which of these numbers we already hold, so the response can say how many
    // were genuinely new rather than refreshed.
    const { data: existing } = await supabaseAdmin
      .from('crm_leads')
      .select('phone')
      .in('phone', [...seen])
    const already = new Set((existing ?? []).map((r) => r.phone as string))

    // Never overwrite the identity of a lead that is an app account: an import
    // may only fill gaps there. Split the batch accordingly.
    const fresh = valid.filter((v) => !already.has(v.phone as string))
    const { error } = fresh.length
      ? await supabaseAdmin.from('crm_leads').insert(fresh)
      : { error: null }
    if (error) return sendDbError(res, error)

    // Refresh the source tag on the ones we already had, without touching the
    // name/email a signup or an agent supplied.
    if (batch && already.size) {
      await supabaseAdmin
        .from('crm_leads')
        .update({ source_detail: batch })
        .in('phone', [...already])
        .eq('source', 'import')
    }

    res.json({
      inserted: fresh.length,
      updated: already.size,
      invalid,
      duplicateInFile,
    })
  })
)

// ─── POST /api/crm/admin/assign ──────────────────────────────────────────────
// Hand leads to an agent (or back to the pool with agentId=null).
admin.post(
  '/assign',
  asyncH(async (req: AuthedRequest, res) => {
    const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : []
    const agentId = req.body?.agentId ? String(req.body.agentId) : null
    if (leadIds.length === 0) return res.status(400).json({ error: 'Pick at least one lead.' })
    if (leadIds.length > 500) return res.status(400).json({ error: 'Assign at most 500 leads at a time.' })

    if (agentId) {
      const { data: agent } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', agentId)
        .maybeSingle()
      if (!agent) return res.status(404).json({ error: 'Agent not found.' })
      if (!['telecaller', 'admin', 'superadmin'].includes(agent.role as string)) {
        return res.status(400).json({ error: 'That account is not a telecaller.' })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('crm_leads')
      .update({
        assigned_to: agentId,
        assigned_at: agentId ? new Date().toISOString() : null,
        ...(agentId ? {} : { status: 'new' }),
      })
      .in('id', leadIds)
      .select('id')
    if (error) return sendDbError(res, error)
    res.json({ assigned: data?.length ?? 0 })
  })
)

// ─── GET /api/crm/admin/agents ───────────────────────────────────────────────
// The telecaller roster with today's volume and each agent's open workload.
admin.get(
  '/agents',
  asyncH(async (req: AuthedRequest, res) => {
    const { data: agents, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at')
      .in('role', ['telecaller'])
      .order('full_name', { ascending: true })
    if (error) return sendDbError(res, error)

    const { data: stats } = await req.db!.rpc('crm_agent_stats')
    const byAgent = new Map(
      ((stats ?? []) as Record<string, unknown>[]).map((s) => [String(s.agent_id), s])
    )

    const { data: openLeads } = await supabaseAdmin
      .from('crm_leads')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .not('status', 'in', '("converted","not_interested","invalid")')
    const openByAgent = new Map<string, number>()
    for (const row of openLeads ?? []) {
      const id = row.assigned_to as string
      openByAgent.set(id, (openByAgent.get(id) ?? 0) + 1)
    }

    res.json({
      agents: (agents ?? []).map((a) => {
        const s = byAgent.get(a.id) ?? {}
        return {
          ...a,
          calls_today: Number((s as Record<string, unknown>).calls ?? 0),
          whatsapps_today: Number((s as Record<string, unknown>).whatsapps ?? 0),
          outcomes_today: Number((s as Record<string, unknown>).outcomes ?? 0),
          conversions_today: Number((s as Record<string, unknown>).conversions ?? 0),
          open_leads: openByAgent.get(a.id) ?? 0,
        }
      }),
    })
  })
)

// ─── GET /api/crm/admin/activity?since=ISO ───────────────────────────────────
// The live feed behind the console: every answer a lead has given, newest
// first, as the telecallers record them.
//
// `since` makes it incremental — the console polls with the timestamp of the
// newest row it already holds, so a dashboard left open all afternoon keeps
// asking for "anything after this" rather than re-reading the day. Omit it for
// the initial page.
admin.get(
  '/activity',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 40, 1), 200)
    const sinceRaw = String(req.query.since ?? '')
    const since = Number.isNaN(Date.parse(sinceRaw)) ? null : new Date(sinceRaw).toISOString()

    let q = supabaseAdmin
      .from('crm_interactions')
      .select('id, lead_id, agent_id, kind, channel, intent_id, status_after, notes, created_at')
      // Clicks are volume, not answers. The feed is about what leads SAID, so
      // it carries logged outcomes only — the counters cover dialling.
      .eq('kind', 'outcome')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (since) q = q.gt('created_at', since)

    const { data, error } = await q
    if (error) return sendDbError(res, error)

    const rows = asRows(data)
    // Nothing new is the common answer while a shift is quiet — don't file an
    // audit row for a timer tick (see auditAdmin's auditSkip).
    if (rows.length === 0) {
      res.locals.auditSkip = true
      return res.json({ activity: [], now: new Date().toISOString() })
    }

    const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[]
    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter(Boolean))] as string[]
    const intentIds = [...new Set(rows.map((r) => r.intent_id).filter(Boolean))] as string[]

    const [leads, agents, intents] = await Promise.all([
      leadIds.length
        ? supabaseAdmin.from('crm_leads').select('id, full_name, phone').in('id', leadIds)
        : Promise.resolve({ data: null }),
      agentIds.length
        ? supabaseAdmin.from('profiles').select('id, full_name').in('id', agentIds)
        : Promise.resolve({ data: null }),
      intentIds.length
        ? supabaseAdmin.from('crm_intents').select('id, label, color').in('id', intentIds)
        : Promise.resolve({ data: null }),
    ])

    const leadById = new Map(asRows(leads.data).map((l) => [String(l.id), l]))
    const agentById = new Map(asRows(agents.data).map((a) => [String(a.id), a]))
    const intentById = new Map(asRows(intents.data).map((i) => [String(i.id), i]))

    res.json({
      activity: rows.map((r) => {
        const lead = leadById.get(String(r.lead_id))
        const intent = intentById.get(String(r.intent_id))
        return {
          id: r.id,
          created_at: r.created_at,
          lead_id: r.lead_id,
          lead_name: (lead?.full_name as string | null) ?? null,
          lead_phone: (lead?.phone as string | null) ?? null,
          agent_name: (agentById.get(String(r.agent_id))?.full_name as string | null) ?? null,
          intent_label: (intent?.label as string | null) ?? null,
          intent_color: (intent?.color as string | null) ?? null,
          status_after: r.status_after,
          notes: r.notes,
        }
      }),
      now: new Date().toISOString(),
    })
  })
)

// ─── POST /api/crm/admin/backfill ────────────────────────────────────────────
// File leads for accounts that signed up before the CRM existed. Windowed on
// purpose — see crm_backfill_leads()'s note about burying the fresh queue.
admin.post(
  '/backfill',
  asyncH(async (req: AuthedRequest, res) => {
    const days = Math.min(Math.max(Math.trunc(Number(req.body?.days)) || 30, 1), 3650)
    const { data, error } = await req.db!.rpc('crm_backfill_leads', { p_days: days })
    if (error) return sendDbError(res, error)
    res.json({ created: Number(data ?? 0) })
  })
)

router.use('/admin', admin)

export default router
