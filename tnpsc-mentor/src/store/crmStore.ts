import { create } from 'zustand'
import { api, isApiConfigured, ApiError, type CrmQueue } from '../lib/api'
import { startPolling } from '../lib/poll'
import type {
  Channel,
  CrmIntent,
  CrmPipelineMetrics,
  CrmTodayStats,
  Lead,
  LeadStatus,
} from '../lib/crm'
import { track } from '../lib/tracking'
import { toast } from './toastStore'

/**
 * The telecaller desk's state. One store owns all four queues, the intent
 * taxonomy, the agent's own counters, and the arrival watcher that raises the
 * "new lead" popup.
 *
 * Two things are deliberately centralised here rather than left to components:
 *
 *  • The CLOCK. Every response-timer on the page ticks off `nowMs()`, which is
 *    the server's clock plus the elapsed time since we last heard from it. A
 *    telecaller's phone being ten minutes fast must not be able to make an SLA
 *    look met (or blow one that wasn't).
 *  • CONTACT-CLICK LOGGING. The Call/WhatsApp/Email buttons all go through
 *    `logClick`, so the daily-volume number can never drift from what the UI
 *    actually offered.
 */

/** How often the desk asks whether a lead has arrived. Short on purpose: the
 *  whole feature is about answering a fresh signup while they're still holding
 *  the phone. `startPolling` freezes this entirely on a backgrounded tab. */
export const CRM_POLL_MS = 10_000

/** Newest-first arrival cursor overlap. The poll asks for leads created after
 *  (cursor − this), and dedupes by id, so a row committed a hair either side of
 *  a response boundary is never missed. */
const CURSOR_OVERLAP_MS = 5_000

/** `intent: 'none'` is its own filter — leads with no answer recorded yet, which
 *  is the pile an agent most often needs to find. */
export interface CrmFilters {
  status: LeadStatus | null
  intent: string | null
  source: string | null
}

const NO_FILTERS: CrmFilters = { status: null, intent: null, source: null }

interface QueueState {
  leads: Lead[]
  total: number
  loading: boolean
  loaded: boolean
}

const EMPTY_QUEUE: QueueState = { leads: [], total: 0, loading: false, loaded: false }

interface CrmState {
  ready: boolean
  error: string | null
  agentId: string | null
  agentName: string | null
  supervisor: boolean
  intents: CrmIntent[]
  metrics: CrmPipelineMetrics
  today: CrmTodayStats | null

  /** serverNow − clientNow at the last response. See nowMs(). */
  skewMs: number

  queues: Record<CrmQueue, QueueState>
  search: string
  /** Queue filters. Applied server-side, so they narrow the whole queue rather
   *  than just the page already loaded. */
  filters: CrmFilters

  /** Unclaimed leads that arrived while the desk was open, oldest first. The
   *  head of this queue is what the popup shows. */
  incoming: Lead[]
  /** Arrival cursor, and every id already raised, so nothing pops twice. */
  cursor: string
  popped: Set<string>
  /** Whether the arrival chime is on (per-device; agents share a room). */
  sound: boolean

  init: () => Promise<void>
  loadQueue: (queue: CrmQueue, opts?: { append?: boolean }) => Promise<void>
  setSearch: (q: string) => void
  /** Narrow the current queue by status / answer category / source. Merges into
   *  the existing filters; pass null to clear one. */
  setFilter: (patch: Partial<CrmFilters>, queue: CrmQueue) => void
  clearFilters: (queue: CrmQueue) => void
  refreshCounts: () => Promise<void>

  claim: (leadId: string) => Promise<Lead | null>
  release: (leadId: string) => Promise<void>
  logClick: (lead: Lead, channel: Channel) => Promise<void>
  logOutcome: (
    leadId: string,
    input: {
      intentId?: string | null
      notes?: string
      status?: LeadStatus
      durationSecs?: number | null
      nextFollowUpAt?: string | null
    }
  ) => Promise<Lead | null>

  dismissIncoming: (leadId: string) => void
  setSound: (on: boolean) => void
  reset: () => void
}

/** Fold an updated lead back into every queue that holds it, and drop it from
 *  the ones it no longer belongs in (a claimed lead leaves the shared pool). */
function applyLead(queues: Record<CrmQueue, QueueState>, lead: Lead, agentId: string | null) {
  const next = {} as Record<CrmQueue, QueueState>
  for (const key of Object.keys(queues) as CrmQueue[]) {
    const q = queues[key]
    const has = q.leads.some((l) => l.id === lead.id)
    let leads = has ? q.leads.map((l) => (l.id === lead.id ? lead : l)) : q.leads

    if (key === 'pool' && lead.assigned_to) {
      leads = leads.filter((l) => l.id !== lead.id)
    }
    if (key === 'mine') {
      if (lead.assigned_to === agentId && !has) leads = [lead, ...leads]
      if (lead.assigned_to !== agentId) leads = leads.filter((l) => l.id !== lead.id)
    }
    if (key === 'followups' && !lead.next_follow_up_at) {
      leads = leads.filter((l) => l.id !== lead.id)
    }
    next[key] = leads === q.leads ? q : { ...q, leads, total: q.total + (leads.length - q.leads.length) }
  }
  return next
}

export const useCrmStore = create<CrmState>((set, get) => ({
  ready: false,
  error: null,
  agentId: null,
  agentName: null,
  supervisor: false,
  intents: [],
  metrics: {},
  today: null,
  skewMs: 0,
  queues: { pool: EMPTY_QUEUE, mine: EMPTY_QUEUE, followups: EMPTY_QUEUE, all: EMPTY_QUEUE },
  search: '',
  filters: NO_FILTERS,
  incoming: [],
  cursor: new Date().toISOString(),
  popped: new Set<string>(),
  sound: readSoundPref(),

  init: async () => {
    // In DEV with no API configured, the client serves /api/crm from a fixture
    // (see api.ts's request()), so the desk still boots — with the arrival
    // watcher running, which is the point. Only a misconfigured PRODUCTION
    // build bails out here.
    if (!isApiConfigured && !import.meta.env.DEV) {
      set({ ready: true })
      return
    }
    try {
      const data = await api.crm.bootstrap()
      set({
        ready: true,
        error: null,
        agentId: data.agent?.id ?? null,
        agentName: data.agent?.full_name ?? null,
        supervisor: data.supervisor,
        intents: data.intents,
        metrics: data.metrics,
        today: data.today,
        skewMs: Date.parse(data.now) - Date.now(),
        cursor: data.now,
      })
      startIncomingWatch()
    } catch (e) {
      set({
        ready: true,
        error: e instanceof Error ? e.message : 'Could not open the lead desk.',
      })
    }
  },

  loadQueue: async (queue, opts = {}) => {
    const current = get().queues[queue]
    const offset = opts.append ? current.leads.length : 0
    set((s) => ({ queues: { ...s.queues, [queue]: { ...current, loading: true } } }))
    try {
      const { status, intent, source } = get().filters
      const { leads, total, now } = await api.crm.leads({
        queue,
        search: queue === 'all' ? get().search : undefined,
        status: status ?? undefined,
        intent: intent ?? undefined,
        source: source ?? undefined,
        offset,
        limit: 50,
      })
      set((s) => ({
        skewMs: Date.parse(now) - Date.now(),
        queues: {
          ...s.queues,
          [queue]: {
            leads: opts.append ? [...current.leads, ...leads] : leads,
            total,
            loading: false,
            loaded: true,
          },
        },
      }))
    } catch (e) {
      set((s) => ({
        queues: { ...s.queues, [queue]: { ...current, loading: false, loaded: true } },
        error: e instanceof Error ? e.message : 'Could not load leads.',
      }))
    }
  },

  setSearch: (q) => set({ search: q }),

  setFilter: (patch, queue) => {
    set((s) => ({ filters: { ...s.filters, ...patch } }))
    // Filtering server-side means the loaded page is now the wrong set, and
    // `total` with it — refetch from the top rather than filtering in place.
    void get().loadQueue(queue)
  },

  clearFilters: (queue) => {
    set({ filters: NO_FILTERS })
    void get().loadQueue(queue)
  },

  refreshCounts: async () => {
    try {
      const data = await api.crm.bootstrap()
      set({
        metrics: data.metrics,
        today: data.today,
        intents: data.intents,
        skewMs: Date.parse(data.now) - Date.now(),
      })
    } catch {
      /* the counters are a nicety; a failed refresh must not break the desk */
    }
  },

  claim: async (leadId) => {
    try {
      const { lead } = await api.crm.claim(leadId)
      set((s) => ({
        queues: applyLead(s.queues, lead, s.agentId),
        incoming: s.incoming.filter((l) => l.id !== leadId),
      }))
      void get().refreshCounts()
      return lead
    } catch (e) {
      // 409 = another agent got there first. Not an error the agent did
      // anything wrong — correct their board and say so plainly.
      if (e instanceof ApiError && e.status === 409) {
        const lead = (e.data as { lead?: Lead })?.lead
        if (lead) set((s) => ({ queues: applyLead(s.queues, lead, s.agentId) }))
        set((s) => ({ incoming: s.incoming.filter((l) => l.id !== leadId) }))
        toast.info(`${lead?.assigned_name ?? 'Another agent'} already took this lead.`)
        return null
      }
      toast.error(e instanceof Error ? e.message : 'Could not claim this lead.')
      return null
    }
  },

  release: async (leadId) => {
    try {
      const { lead } = await api.crm.release(leadId)
      set((s) => ({ queues: applyLead(s.queues, lead, s.agentId) }))
      void get().refreshCounts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not release this lead.')
    }
  },

  logClick: async (lead, channel) => {
    // Optimistic: the dialer is already opening, so the card must not sit there
    // looking un-actioned while the round-trip lands.
    const optimistic: Lead = {
      ...lead,
      attempts: lead.attempts + 1,
      last_contacted_at: new Date(nowMs()).toISOString(),
      assigned_to: lead.assigned_to ?? get().agentId,
      status: lead.status === 'new' ? 'in_progress' : lead.status,
      first_response_at: lead.first_response_at ?? new Date(nowMs()).toISOString(),
      first_response_secs:
        lead.first_response_secs ??
        Math.max(0, Math.round((nowMs() - Date.parse(lead.created_at)) / 1000)),
    }
    set((s) => ({
      queues: applyLead(s.queues, optimistic, s.agentId),
      incoming: s.incoming.filter((l) => l.id !== lead.id),
      today: s.today
        ? {
            ...s.today,
            calls: s.today.calls + (channel === 'call' ? 1 : 0),
            whatsapps: s.today.whatsapps + (channel === 'whatsapp' ? 1 : 0),
            emails: s.today.emails + (channel === 'email' ? 1 : 0),
          }
        : s.today,
    }))

    // GA4/Meta alongside the DB row: the database is the source of truth for
    // agent volume, this is for the same funnel dashboards the rest of the app
    // reports into.
    track('crm_contact_click', { channel, lead_source: lead.source, lead_status: lead.status })

    try {
      const { lead: saved } = await api.crm.logClick(lead.id, channel)
      set((s) => ({ queues: applyLead(s.queues, saved, s.agentId) }))
    } catch {
      // The call itself already happened; a lost log line is not worth an alarm
      // in the agent's face mid-conversation. The next queue load re-syncs.
    }
  },

  logOutcome: async (leadId, input) => {
    try {
      const { lead } = await api.crm.logOutcome(leadId, input)
      set((s) => ({
        queues: applyLead(s.queues, lead, s.agentId),
        today: s.today
          ? {
              ...s.today,
              outcomes: s.today.outcomes + 1,
              conversions: s.today.conversions + (lead.status === 'converted' ? 1 : 0),
            }
          : s.today,
      }))
      track('crm_outcome_logged', { status: lead.status })
      void get().refreshCounts()
      return lead
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save this call.')
      return null
    }
  },

  dismissIncoming: (leadId) =>
    set((s) => ({ incoming: s.incoming.filter((l) => l.id !== leadId) })),

  setSound: (on) => {
    writeSoundPref(on)
    set({ sound: on })
  },

  reset: () => {
    stopIncomingWatch()
    set({
      ready: false,
      error: null,
      agentId: null,
      agentName: null,
      supervisor: false,
      intents: [],
      metrics: {},
      today: null,
      queues: { pool: EMPTY_QUEUE, mine: EMPTY_QUEUE, followups: EMPTY_QUEUE, all: EMPTY_QUEUE },
      filters: NO_FILTERS,
      incoming: [],
      popped: new Set<string>(),
    })
  },
}))

/**
 * The clock every response timer runs off: the server's, carried forward. Read
 * it fresh on each tick — never cache it into a component's state.
 */
export function nowMs(): number {
  return Date.now() + useCrmStore.getState().skewMs
}

// ─── The arrival watcher ─────────────────────────────────────────────────────
// A short poll rather than a socket: the desk is a handful of staff on one
// page, `startPolling` stops dead on a hidden tab, and the endpoint answers
// "nothing new" from an index almost every time. That buys real-time-feeling
// arrival with no new infrastructure on the box.

let stopPoll: (() => void) | null = null

function startIncomingWatch(): void {
  if (stopPoll) return
  stopPoll = startPolling(() => void checkIncoming(), CRM_POLL_MS)
}

function stopIncomingWatch(): void {
  stopPoll?.()
  stopPoll = null
}

async function checkIncoming(): Promise<void> {
  const { cursor, popped } = useCrmStore.getState()
  try {
    const since = new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString()
    const { leads, now } = await api.crm.incoming(since)

    const fresh = leads.filter((l) => !popped.has(l.id))
    if (fresh.length === 0) {
      useCrmStore.setState({ cursor: now, skewMs: Date.parse(now) - Date.now() })
      return
    }

    const nextPopped = new Set(popped)
    for (const l of fresh) nextPopped.add(l.id)

    useCrmStore.setState((s) => ({
      cursor: now,
      skewMs: Date.parse(now) - Date.now(),
      popped: nextPopped,
      incoming: [...s.incoming, ...fresh],
      // Put them at the top of the shared pool straight away, so the queue
      // behind the popup is already correct when the agent dismisses it.
      queues: {
        ...s.queues,
        pool: s.queues.pool.loaded
          ? {
              ...s.queues.pool,
              leads: [...fresh].reverse().concat(s.queues.pool.leads),
              total: s.queues.pool.total + fresh.length,
            }
          : s.queues.pool,
      },
      metrics: {
        ...s.metrics,
        unclaimed: (s.metrics.unclaimed ?? 0) + fresh.length,
        new_today: (s.metrics.new_today ?? 0) + fresh.length,
      },
    }))

    announce(fresh.length)
  } catch {
    // Offline or a blip: keep the cursor where it is so nothing is skipped when
    // the connection comes back.
  }
}

/** Chime + a desktop notification (when the agent has already allowed them). */
function announce(count: number): void {
  if (useCrmStore.getState().sound) chime()
  track('crm_lead_arrived', { count })

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(count === 1 ? 'New lead' : `${count} new leads`, {
        body: 'A fresh signup is waiting for a call.',
        tag: 'crm-lead',
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch {
      /* some browsers throw when constructing outside a SW — the chime stands in */
    }
  }
}

/** A two-note chime, synthesised rather than shipped as an audio file — it must
 *  never be the reason a lead notification is late behind a download. */
function chime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.3)
    }
    play(880, 0)
    play(1174.7, 0.14)
    setTimeout(() => void ctx.close(), 800)
  } catch {
    /* autoplay policy or no WebAudio — the popup itself is still the signal */
  }
}

// ─── Sound preference (per device) ───────────────────────────────────────────
const SOUND_KEY = 'crm.sound'

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeSoundPref(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* private mode — the choice just doesn't survive a reload */
  }
}
