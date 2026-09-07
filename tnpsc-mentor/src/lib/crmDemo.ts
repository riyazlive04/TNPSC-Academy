// ─── CRM preview fixture ─────────────────────────────────────────────────────
// An in-memory stand-in for /api/crm, used ONLY by the existing DEV "UI-preview
// mode" — the one ProtectedRoute already documents, where an unset VITE_API_URL
// means there is no backend to authenticate against and every page is browsable.
//
// It exists because the lead desk is the one screen that cannot be judged from
// an empty state: the response timers have to be ticking, the queues have to
// have something in them, and a lead has to actually arrive for the popup to be
// worth reviewing.
//
// This module is reached through a single dynamic import in api.ts's request(),
// so Vite splits it into its own chunk that a configured build never fetches.
// Nothing here runs when VITE_API_URL is set.

import type { CrmAgentDay, CrmIntent, ImportRow, Lead, LeadInteraction } from './crm'
import { tenDigit } from './crm'

const AGENT_ID = 'demo-agent'
const AGENT_NAME = 'Preview Agent'

const mins = (n: number) => n * 60_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const soon = (ms: number) => new Date(Date.now() + ms).toISOString()

let idSeq = 0
const nextId = () => `demo-${++idSeq}`

// ─── Intent taxonomy (mirrors what crm.sql seeds) ────────────────────────────
const intents: CrmIntent[] = [
  ['Interested — will buy', 'ஆர்வம் — வாங்குவார்', 'interested', 'emerald', 10, 34],
  ['Wants a call back', 'மீண்டும் அழைக்கச் சொன்னார்', 'callback', 'amber', 20, 51],
  ['Purchased', 'வாங்கிவிட்டார்', 'converted', 'violet', 30, 12],
  ['Price is too high', 'விலை அதிகம்', 'not_interested', 'rose', 40, 27],
  ['Preparing on their own', 'சொந்தமாகப் படிக்கிறார்', 'not_interested', 'rose', 50, 9],
  ['Not answering', 'பதில் இல்லை', 'unreachable', 'slate', 60, 63],
  ['Wrong / invalid number', 'தவறான எண்', 'unreachable', 'slate', 70, 8],
  ['Just exploring the app', 'செயலியைப் பார்க்கிறார்', 'neutral', 'sky', 80, 19],
].map(([label, label_ta, outcome, color, sort_order, uses]) => ({
  id: nextId(),
  label: label as string,
  label_ta: label_ta as string,
  outcome: outcome as CrmIntent['outcome'],
  color: color as CrmIntent['color'],
  sort_order: sort_order as number,
  active: true,
  created_at: ago(mins(60 * 24 * 30)),
  uses: uses as number,
}))

const intentByLabel = (label: string) => intents.find((i) => i.label === label)

// ─── Leads ───────────────────────────────────────────────────────────────────
function lead(p: Partial<Lead> & { full_name: string; phone: string }): Lead {
  return {
    id: nextId(),
    user_id: null,
    whatsapp: p.phone,
    email: null,
    city: null,
    target_group: null,
    source: 'signup',
    source_detail: null,
    status: 'new',
    intent_id: null,
    assigned_to: null,
    assigned_at: null,
    first_response_at: null,
    first_response_secs: null,
    last_contacted_at: null,
    next_follow_up_at: null,
    attempts: 0,
    notes: null,
    created_at: ago(mins(3)),
    updated_at: ago(mins(3)),
    assigned_name: null,
    intent_label: null,
    intent_color: null,
    premium: false,
    premium_until: null,
    vettri: false,
    vettri_until: null,
    do_not_call: false,
    dnc_reason: null,
    dnc_at: null,
    ...p,
    // Imported/backfilled rows signed up long ago but reached the DESK just
    // now — the same split the real backfill writes.
    entered_at:
      p.entered_at ??
      (p.source && p.source !== 'signup' ? ago(mins(45)) : (p.created_at ?? ago(mins(3)))),
  } as Lead
}

// Spread across the SLA bands on purpose, so the timer's whole colour range is
// visible at a glance: fresh (<5m) → amber (<15m) → orange (<1h) → red.
const leads: Lead[] = [
  lead({
    full_name: 'Kavitha Ramesh',
    phone: '9840112233',
    email: 'kavitha.r@example.com',
    city: 'Coimbatore',
    target_group: 'Group2_2A',
    user_id: 'u-1',
    created_at: ago(mins(1.5)),
  }),
  lead({
    full_name: 'Muthu Selvam',
    phone: '9791445566',
    email: 'muthu.s@example.com',
    city: 'Madurai',
    target_group: 'Group4_VAO',
    user_id: 'u-2',
    created_at: ago(mins(9)),
  }),
  lead({
    // Already paying — the badge exists so nobody pitches her premium.
    premium: true,
    premium_until: soon(mins(60 * 24 * 62)),
    full_name: 'Priya Dharshini',
    phone: '9600778899',
    email: 'priya.d@example.com',
    city: 'Chennai',
    target_group: 'Group1',
    user_id: 'u-3',
    created_at: ago(mins(38)),
  }),
  lead({
    full_name: 'Arun Kumar',
    phone: '9445220011',
    city: 'Salem',
    source: 'import',
    source_detail: 'Aug ad leads',
    created_at: ago(mins(190)),
  }),
  lead({
    full_name: 'Deepa Lakshmi',
    phone: '9962334455',
    city: 'Trichy',
    source: 'import',
    source_detail: 'Aug ad leads',
    created_at: ago(mins(320)),
  }),

  // Already being worked by the preview agent — these show the frozen timer.
  lead({
    vettri: true,
    vettri_until: soon(mins(60 * 24 * 26)),
    full_name: 'Suresh Babu',
    phone: '9498221100',
    email: 'suresh.b@example.com',
    city: 'Erode',
    target_group: 'Group2_2A',
    user_id: 'u-6',
    status: 'follow_up',
    assigned_to: AGENT_ID,
    assigned_name: AGENT_NAME,
    assigned_at: ago(mins(120)),
    first_response_at: ago(mins(120)),
    first_response_secs: 154,
    last_contacted_at: ago(mins(120)),
    next_follow_up_at: soon(mins(90)),
    attempts: 2,
    intent_id: intentByLabel('Wants a call back')!.id,
    intent_label: 'Wants a call back',
    intent_color: 'amber',
    notes: 'Salary comes in on the 5th — asked to call back after that.',
    created_at: ago(mins(300)),
  }),
  lead({
    full_name: 'Nandhini Ravi',
    phone: '9080665544',
    email: 'nandhini@example.com',
    city: 'Tirunelveli',
    status: 'in_progress',
    assigned_to: AGENT_ID,
    assigned_name: AGENT_NAME,
    assigned_at: ago(mins(60)),
    first_response_at: ago(mins(60)),
    first_response_secs: 87,
    last_contacted_at: ago(mins(45)),
    attempts: 1,
    intent_id: intentByLabel('Interested — will buy')!.id,
    intent_label: 'Interested — will buy',
    intent_color: 'emerald',
    created_at: ago(mins(400)),
  }),
  lead({
    full_name: 'Vignesh M',
    phone: '9345889977',
    status: 'follow_up',
    assigned_to: AGENT_ID,
    assigned_name: AGENT_NAME,
    assigned_at: ago(mins(1500)),
    first_response_at: ago(mins(1500)),
    first_response_secs: 640,
    next_follow_up_at: ago(mins(45)), // overdue, so the queue shows both directions
    attempts: 3,
    source: 'import',
    source_detail: 'July webinar',
    created_at: ago(mins(2000)),
  }),
  lead({
    premium: true,
    premium_until: soon(mins(60 * 24 * 40)),
    vettri: true,
    vettri_until: soon(mins(60 * 24 * 15)),
    full_name: 'Anitha Selvi',
    phone: '9791003322',
    email: 'anitha@example.com',
    status: 'converted',
    assigned_to: AGENT_ID,
    assigned_name: AGENT_NAME,
    first_response_at: ago(mins(2800)),
    first_response_secs: 96,
    attempts: 2,
    intent_id: intentByLabel('Purchased')!.id,
    intent_label: 'Purchased',
    intent_color: 'violet',
    created_at: ago(mins(3000)),
  }),
  lead({
    full_name: 'Karthik R',
    phone: '9500447788',
    status: 'not_interested',
    assigned_to: AGENT_ID,
    assigned_name: AGENT_NAME,
    first_response_at: ago(mins(4000)),
    first_response_secs: 210,
    attempts: 1,
    intent_id: intentByLabel('Price is too high')!.id,
    intent_label: 'Price is too high',
    intent_color: 'rose',
    created_at: ago(mins(4200)),
  }),
]

const history = new Map<string, LeadInteraction[]>()

function log(leadId: string, item: Partial<LeadInteraction>): void {
  const rows = history.get(leadId) ?? []
  rows.unshift({
    id: nextId(),
    kind: 'outcome',
    channel: 'call',
    intent_id: null,
    status_after: null,
    notes: null,
    duration_secs: null,
    created_at: new Date().toISOString(),
    agent_id: AGENT_ID,
    agent_name: AGENT_NAME,
    intent_label: null,
    intent_color: null,
    ...item,
  } as LeadInteraction)
  history.set(leadId, rows)
}

// A little back-story on the leads that have already been worked.
log(leads[5].id, { kind: 'click', channel: 'call', created_at: ago(mins(300)) })
log(leads[5].id, {
  kind: 'outcome',
  intent_id: intentByLabel('Wants a call back')!.id,
  intent_label: 'Wants a call back',
  intent_color: 'amber',
  status_after: 'follow_up',
  notes: 'Salary comes in on the 5th — asked to call back after that.',
  duration_secs: 205,
  created_at: ago(mins(120)),
})
log(leads[6].id, { kind: 'click', channel: 'whatsapp', created_at: ago(mins(60)) })

pushActivity(leads[5], 'Wants a call back', 'amber', 'follow_up', 'Salary comes in on the 5th - asked to call back after that.', mins(120))
pushActivity(leads[6], 'Interested — will buy', 'emerald', 'in_progress', 'Wants the Group 2 package. Sending the payment link.', mins(58))
pushActivity(leads[8], 'Purchased', 'violet', 'converted', 'Paid for Premium.', mins(210))
pushActivity(leads[9], 'Price is too high', 'rose', 'not_interested', 'Asked whether there is a monthly plan.', mins(340))
pushActivity(leads[7], 'Not answering', 'slate', 'unreachable', 'Third attempt, rings out.', mins(430))

const today = { calls: 14, whatsapps: 6, emails: 1, outcomes: 11, conversions: 2, leads_touched: 13 }

/** Per-category count of answers recorded today, so the console breakdown has
 *  something that actually moves. Seeded to add up to `today.outcomes`. */
const loggedToday = new Map<string, number>([
  [intentByLabel('Wants a call back')!.id, 4],
  [intentByLabel('Interested — will buy')!.id, 3],
  [intentByLabel('Not answering')!.id, 2],
  [intentByLabel('Price is too high')!.id, 1],
  [intentByLabel('Purchased')!.id, 1],
])

interface ActivityRow {
  id: string
  created_at: string
  lead_id: string
  lead_name: string | null
  lead_phone: string | null
  agent_name: string | null
  intent_label: string | null
  intent_color: string | null
  status_after: string | null
  notes: string | null
}

/** The console's live feed, newest first. */
const activity: ActivityRow[] = []

function pushActivity(
  l: Lead,
  intentLabel: string | null,
  intentColor: string | null,
  status: string | null,
  notes: string | null,
  whenMs = 0
): void {
  activity.unshift({
    id: nextId(),
    created_at: whenMs ? ago(whenMs) : new Date().toISOString(),
    lead_id: l.id,
    lead_name: l.full_name,
    lead_phone: l.phone,
    agent_name: AGENT_NAME,
    intent_label: intentLabel,
    intent_color: intentColor,
    status_after: status,
    notes,
  })
}

// ─── Simulated arrivals ──────────────────────────────────────────────────────
// The popup is the part that most needs to be seen rather than described, so
// preview mode conjures a lead a few seconds after the desk opens and then
// every so often, exactly as the real 10s poll would surface one.
const ARRIVALS = [
  { full_name: 'Sathish Kumar', phone: '9840556677', city: 'Chennai', target_group: 'Group2_2A' },
  { full_name: 'Revathi P', phone: '9600991122', city: 'Thanjavur', target_group: 'Group4_VAO' },
  { full_name: 'Gokul Anand', phone: '9445667788', city: 'Vellore', target_group: 'Group1' },
]
let arrivalIdx = 0
let firstPollAt = 0

function dueArrivals(): Lead[] {
  const now = Date.now()
  if (!firstPollAt) firstPollAt = now
  const elapsed = now - firstPollAt
  // ~8s after opening, then roughly every 45s.
  const wanted = Math.min(ARRIVALS.length, Math.floor((elapsed - 8_000) / 45_000) + 1)
  if (wanted <= arrivalIdx) return []
  const out: Lead[] = []
  while (arrivalIdx < wanted) {
    const a = ARRIVALS[arrivalIdx++]
    const fresh = lead({ ...a, created_at: new Date().toISOString(), user_id: `u-new-${arrivalIdx}` })
    leads.unshift(fresh)
    out.push(fresh)
  }
  return out
}

/** Every so often an off-screen "other agent" records an answer, so the
 *  console's feed and breakdown visibly move while being watched - the only way
 *  to judge whether "live" actually reads as live. */
const AMBIENT = [
  { label: 'Interested — will buy', color: 'emerald', status: 'in_progress', note: 'Asked for the fee structure on WhatsApp.' },
  { label: 'Wants a call back', color: 'amber', status: 'follow_up', note: 'In class right now - call after 6pm.' },
  { label: 'Not answering', color: 'slate', status: 'unreachable', note: 'Second attempt, no response.' },
  { label: 'Just exploring the app', color: 'sky', status: 'in_progress', note: 'Downloaded yesterday, still comparing.' },
]
let ambientAt = 0
let ambientIdx = 0

function ambientAnswers(): void {
  const now = Date.now()
  if (!ambientAt) {
    ambientAt = now
    return
  }
  if (now - ambientAt < 20_000) return // roughly one every 20s of watching
  ambientAt = now

  const a = AMBIENT[ambientIdx++ % AMBIENT.length]
  const pool = leads.filter((l) => l.status !== 'converted')
  const l = pool[(ambientIdx * 3) % pool.length]
  if (!l) return

  const intent = intentByLabel(a.label)
  if (intent) {
    loggedToday.set(intent.id, (loggedToday.get(intent.id) ?? 0) + 1)
    l.intent_id = intent.id
    l.intent_label = intent.label
    l.intent_color = intent.color
  }
  l.status = a.status as Lead['status']
  today.outcomes += 1
  pushActivity(l, a.label, a.color, a.status, a.note)
}

// ─── Routing ─────────────────────────────────────────────────────────────────

const byId = (id: string) => leads.find((l) => l.id === id)

function touch(l: Lead): void {
  l.updated_at = new Date().toISOString()
}

function stopTimer(l: Lead): void {
  if (!l.first_response_at) {
    l.first_response_at = new Date().toISOString()
    l.first_response_secs = Math.max(
      0,
      Math.round((Date.now() - Date.parse(l.created_at)) / 1000)
    )
  }
}

function queueOf(queue: string): Lead[] {
  if (queue === 'pool') {
    return leads
      .filter((l) => !l.assigned_to && l.status === 'new')
      .sort((a, b) => Date.parse(b.entered_at) - Date.parse(a.entered_at))
  }
  if (queue === 'mine') {
    return leads
      .filter((l) => l.assigned_to === AGENT_ID)
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
  }
  if (queue === 'followups') {
    return leads
      .filter(
        (l) =>
          l.next_follow_up_at &&
          !['converted', 'not_interested', 'invalid'].includes(l.status) &&
          Date.parse(l.next_follow_up_at) <= Date.now() + 24 * 3600_000
      )
      .sort((a, b) => Date.parse(a.next_follow_up_at!) - Date.parse(b.next_follow_up_at!))
  }
  return [...leads].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

function metrics() {
  const by_status: Record<string, number> = {}
  for (const l of leads) by_status[l.status] = (by_status[l.status] ?? 0) + 1
  const done = leads.filter((l) => l.first_response_secs != null).map((l) => l.first_response_secs!)
  done.sort((a, b) => a - b)
  const by_intent = intents
    .map((i) => ({
      id: i.id,
      label: i.label,
      color: i.color,
      outcome: i.outcome,
      active: i.active,
      leads: leads.filter((l) => l.intent_id === i.id).length,
      logged_today: loggedToday.get(i.id) ?? 0,
    }))
    .filter((i) => i.active || i.leads > 0)
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label))

  return {
    total: leads.length,
    unclaimed: queueOf('pool').length,
    new_today: leads.filter((l) => Date.now() - Date.parse(l.created_at) < 86_400_000).length,
    awaiting_first_contact: leads.filter((l) => !l.first_response_at).length,
    follow_ups_due: queueOf('followups').length,
    converted: leads.filter((l) => l.status === 'converted').length,
    calls_today: today.calls,
    median_response_secs: done.length ? done[Math.floor(done.length / 2)] : null,
    by_status,
    by_intent,
    logged_today: today.outcomes,
  }
}

const OUTCOME_TO_STATUS: Record<string, Lead['status']> = {
  interested: 'in_progress',
  callback: 'follow_up',
  converted: 'converted',
  not_interested: 'not_interested',
  unreachable: 'unreachable',
  neutral: 'in_progress',
}

interface DemoOpts {
  method?: string
  body?: unknown
  query?: Record<string, unknown>
}

/** Serve one /api/crm call from memory. Throws on a path preview mode
 *  deliberately doesn't cover, so the gap is visible rather than silent. */
export async function handleCrmDemo<T>(path: string, opts: DemoOpts = {}): Promise<T> {
  // A touch of latency, so loading states are exercised rather than skipped.
  await new Promise((r) => setTimeout(r, 90))

  const method = opts.method ?? 'GET'
  const body = (opts.body ?? {}) as Record<string, unknown>
  const q = (opts.query ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()
  const seg = path.replace(/^\/api\/crm\/?/, '').split('/')
  const out = (v: unknown) => v as T

  // ── bootstrap ──
  if (seg[0] === 'bootstrap') {
    return out({
      agent: { id: AGENT_ID, full_name: AGENT_NAME, email: 'preview@local', role: 'telecaller', avatar_url: null },
      supervisor: true,
      intents: intents.filter((i) => i.active),
      metrics: metrics(),
      sla: { target_mins: 5, warn_mins: 15, breach_mins: 60 },
      today,
      now,
    })
  }

  // ── stats ──
  if (seg[0] === 'stats') {
    const days = Math.max(1, Number(q.days) || 7)
    const stats: CrmAgentDay[] = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - i * 86_400_000)
      const wobble = (i * 7) % 9
      return {
        agent_id: AGENT_ID,
        agent_name: AGENT_NAME,
        agent_email: 'preview@local',
        day_ist: d.toISOString().slice(0, 10),
        calls: 18 - wobble,
        whatsapps: 9 - (wobble % 5),
        emails: i % 3,
        outcomes: 14 - (wobble % 6),
        conversions: (i % 4 === 0 ? 3 : 1),
        leads_touched: 16 - (wobble % 7),
        avg_response_secs: 120 + wobble * 25,
      }
    })
    return out({ stats })
  }

  // ── intents (superadmin panel) ──
  if (seg[0] === 'intents' && seg[1] === 'all') return out({ intents })
  if (seg[0] === 'admin' && seg[1] === 'intents') {
    const id = seg[2]
    if (method === 'POST') {
      const created: CrmIntent = {
        id: nextId(),
        label: String(body.label ?? 'New category'),
        label_ta: (body.labelTa as string) || null,
        outcome: (body.outcome as CrmIntent['outcome']) ?? 'neutral',
        color: (body.color as CrmIntent['color']) ?? 'slate',
        sort_order: Number(body.sortOrder) || intents.length * 10,
        active: true,
        created_at: now,
        uses: 0,
      }
      intents.push(created)
      return out({ intent: created })
    }
    const target = intents.find((i) => i.id === id)
    if (!target) throw new Error('Intent not found.')
    if (method === 'PATCH') {
      if ('label' in body) target.label = String(body.label)
      if ('labelTa' in body) target.label_ta = (body.labelTa as string) || null
      if ('outcome' in body) target.outcome = body.outcome as CrmIntent['outcome']
      if ('color' in body) target.color = body.color as CrmIntent['color']
      if ('active' in body) target.active = Boolean(body.active)
      return out({ intent: target })
    }
    if (method === 'DELETE') {
      if ((target.uses ?? 0) > 0) {
        target.active = false
        return out({ retired: true, intent: target })
      }
      intents.splice(intents.indexOf(target), 1)
      return out({ retired: false })
    }
  }

  // ── admin: roster / import / backfill / assign ──
  if (seg[0] === 'admin' && seg[1] === 'agents') {
    return out({
      agents: [
        {
          id: AGENT_ID,
          full_name: AGENT_NAME,
          email: 'preview@local',
          phone: null,
          role: 'telecaller',
          created_at: ago(mins(60 * 24 * 20)),
          calls_today: today.calls,
          whatsapps_today: today.whatsapps,
          outcomes_today: today.outcomes,
          conversions_today: today.conversions,
          open_leads: queueOf('mine').filter(
            (l) => !['converted', 'not_interested', 'invalid'].includes(l.status)
          ).length,
        },
      ],
    })
  }
  if (seg[0] === 'admin' && seg[1] === 'import') {
    const rows = (body.rows as ImportRow[]) ?? []
    let inserted = 0
    let updated = 0
    for (const r of rows) {
      const phone = tenDigit(r.phone)
      if (!phone) continue
      if (leads.some((l) => l.phone === phone)) {
        updated++
        continue
      }
      leads.unshift(
        lead({
          full_name: r.name ?? 'Imported lead',
          phone,
          email: r.email ?? null,
          city: r.city ?? null,
          source: 'import',
          source_detail: (body.batch as string) || null,
          created_at: now,
        })
      )
      inserted++
    }
    return out({ inserted, updated, invalid: rows.length - inserted - updated, duplicateInFile: 0 })
  }
  if (seg[0] === 'admin' && seg[1] === 'activity') {
    ambientAnswers()
    const since = q.since ? Date.parse(String(q.since)) : 0
    const rows = since ? activity.filter((a) => Date.parse(a.created_at) > since) : activity
    return out({ activity: rows.slice(0, Number(q.limit) || 40), now })
  }
  if (seg[0] === 'admin' && seg[1] === 'backfill') return out({ created: 0 })
  if (seg[0] === 'admin' && seg[1] === 'assign') return out({ assigned: 0 })

  // ── leads ──
  if (seg[0] === 'leads') {
    if (seg[1] === 'incoming') return out({ leads: dueArrivals(), now })

    if (!seg[1]) {
      const all = queueOf(String(q.queue ?? 'pool'))
      const term = String(q.search ?? '').toLowerCase().trim()
      let filtered = term
        ? all.filter((l) =>
            [l.full_name, l.phone, l.email].some((v) => (v ?? '').toLowerCase().includes(term))
          )
        : all
      if (q.status) filtered = filtered.filter((l) => l.status === q.status)
      if (q.source) filtered = filtered.filter((l) => l.source === q.source)
      if (q.intent === 'none') filtered = filtered.filter((l) => !l.intent_id)
      else if (q.intent) filtered = filtered.filter((l) => l.intent_id === q.intent)
      if (String(q.queue ?? 'pool') !== 'all') filtered = filtered.filter((l) => !l.do_not_call)
      if (q.age === 'fresh') filtered = filtered.filter((l) => l.source === 'signup')
      else if (q.age === 'backlog') filtered = filtered.filter((l) => l.source !== 'signup')
      if (q.plan === 'free') filtered = filtered.filter((l) => !l.premium && !l.vettri)
      else if (q.plan === 'paid') filtered = filtered.filter((l) => l.premium || l.vettri)
      else if (q.plan === 'premium') filtered = filtered.filter((l) => l.premium)
      else if (q.plan === 'vettri') filtered = filtered.filter((l) => l.vettri)
      const offset = Number(q.offset) || 0
      const limit = Number(q.limit) || 50
      return out({ leads: filtered.slice(offset, offset + limit), total: filtered.length, now })
    }

    const target = byId(seg[1])
    if (!target) throw new Error('Lead not found.')

    if (!seg[2] && method === 'GET') {
      return out({ lead: target, history: history.get(target.id) ?? [], now })
    }

    if (!seg[2] && method === 'PATCH') {
      if ('fullName' in body) target.full_name = (body.fullName as string) || null
      if ('phone' in body) target.phone = tenDigit(body.phone as string) || null
      if ('whatsapp' in body) target.whatsapp = tenDigit(body.whatsapp as string) || null
      if ('email' in body) target.email = (body.email as string) || null
      if ('city' in body) target.city = (body.city as string) || null
      touch(target)
      return out({ lead: target })
    }

    if (seg[2] === 'claim') {
      target.assigned_to = AGENT_ID
      target.assigned_name = AGENT_NAME
      target.assigned_at = now
      target.status = 'in_progress'
      touch(target)
      log(target.id, { kind: 'system', channel: 'system', notes: 'Claimed from the pool' })
      return out({ lead: target })
    }

    if (seg[2] === 'dnc') {
      const on = body.on !== false
      target.do_not_call = on
      target.dnc_reason = on ? ((body.reason as string) || null) : null
      target.dnc_at = on ? now : null
      if (on) {
        target.status = 'invalid'
        target.next_follow_up_at = null
      }
      touch(target)
      log(target.id, {
        kind: 'system',
        channel: 'system',
        notes: on ? 'Marked do-not-call' : 'Do-not-call lifted',
      })
      return out({ lead: target })
    }

    if (seg[2] === 'release') {
      target.assigned_to = null
      target.assigned_name = null
      target.assigned_at = null
      target.status = 'new'
      touch(target)
      return out({ lead: target })
    }

    if (seg[2] === 'click') {
      const channel = String(body.channel ?? 'call') as LeadInteraction['channel']
      target.attempts += 1
      target.last_contacted_at = now
      if (!target.assigned_to) {
        target.assigned_to = AGENT_ID
        target.assigned_name = AGENT_NAME
      }
      if (target.status === 'new') target.status = 'in_progress'
      stopTimer(target)
      touch(target)
      log(target.id, { kind: 'click', channel })
      if (channel === 'call') today.calls += 1
      if (channel === 'whatsapp') today.whatsapps += 1
      return out({ lead: target })
    }

    if (seg[2] === 'log') {
      const intent = intents.find((i) => i.id === body.intentId)
      const status =
        (body.status as Lead['status']) ||
        (intent ? OUTCOME_TO_STATUS[intent.outcome] : undefined) ||
        target.status
      target.status = status
      target.intent_id = intent?.id ?? target.intent_id
      target.intent_label = intent?.label ?? target.intent_label
      target.intent_color = intent?.color ?? target.intent_color
      if (body.notes) {
        const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        const line = `[${stamp}] ${body.notes as string}`
        target.notes = target.notes ? `${target.notes}
${line}` : line
      }
      target.next_follow_up_at = (body.nextFollowUpAt as string) ?? null
      target.last_contacted_at = now
      if (!target.assigned_to) {
        target.assigned_to = AGENT_ID
        target.assigned_name = AGENT_NAME
      }
      stopTimer(target)
      touch(target)
      log(target.id, {
        kind: 'outcome',
        intent_id: intent?.id ?? null,
        intent_label: intent?.label ?? null,
        intent_color: intent?.color ?? null,
        status_after: status,
        notes: (body.notes as string) || null,
      })
      today.outcomes += 1
      if (intent) loggedToday.set(intent.id, (loggedToday.get(intent.id) ?? 0) + 1)
      if (status === 'converted') today.conversions += 1
      pushActivity(
        target,
        intent?.label ?? null,
        intent?.color ?? null,
        status,
        (body.notes as string) || null
      )
      return out({ lead: target })
    }
  }

  throw new Error(`Preview mode doesn't cover ${method} ${path}`)
}
