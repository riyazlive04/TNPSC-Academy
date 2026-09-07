import { useEffect, useMemo, useState } from 'react'
import {
  BellOff,
  BellRing,
  Clock,
  Inbox,
  LogOut,
  Phone,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LeadCard from '../components/Crm/LeadCard'
import LeadSheet from '../components/Crm/LeadSheet'
import NewLeadPopup from '../components/Crm/NewLeadPopup'
import QueueFilters from '../components/Crm/QueueFilters'
import MyStats from '../components/Crm/MyStats'
import WorkspaceSwitch from '../components/Layout/WorkspaceSwitch'
import Spinner from '../components/UI/Spinner'
import ErrorState from '../components/UI/ErrorState'
import { Skeleton } from '../components/UI/Skeleton'
import { useCrmStore } from '../store/crmStore'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import type { CrmQueue } from '../lib/api'
import { formatDuration, type Lead } from '../lib/crm'
import { PAGE_SIZE } from '../store/crmStore'

/**
 * The telecaller lead desk (/crm).
 *
 * Mobile-first because that is how it is used: an agent with a phone in one
 * hand, working a queue. Everything above the fold is either a number that tells
 * them how they're doing today or a lead they can dial in one tap. The desktop
 * layout is the same page with more of it visible at once — no separate view.
 *
 * Four queues, in the order an agent actually works them:
 *   New        the shared pool — unclaimed leads, newest first, each with a
 *              live response timer counting up until someone calls
 *   My leads   what they've claimed
 *   Follow-ups callbacks coming due (their own; a supervisor sees everyone's)
 *   Search     the whole book, by name / phone / email
 */

const QUEUES: { id: CrmQueue; label: string; icon: typeof Inbox }[] = [
  { id: 'pool', label: 'New', icon: Inbox },
  { id: 'mine', label: 'My leads', icon: UserCheck },
  { id: 'followups', label: 'Follow-ups', icon: Clock },
  { id: 'all', label: 'Search', icon: Search },
]

/** New vs old, in the words an agent uses. */
const AGE_TABS = [
  { id: '', label: 'All', icon: Layers },
  { id: 'fresh', label: 'New', icon: Sparkles },
  { id: 'backlog', label: 'Backlog', icon: Hourglass },
]

export default function CrmPage() {
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const {
    ready,
    error,
    init,
    reset,
    queues,
    loadQueue,
    metrics,
    today,
    agentName,
    supervisor,
    search,
    setSearch,
    refreshCounts,
    sound,
    setSound,
    clearFilters,
    setFilter,
    goToPage,
  } = useCrmStore()

  const [queue, setQueue] = useState<CrmQueue>('pool')
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')

  // Open the desk once, and tear the arrival watcher down when the agent
  // navigates away (or signs out) so it isn't polling from a dead screen.
  useEffect(() => {
    void init()
    return () => reset()
  }, [init, reset])

  // Each queue loads the first time it's opened; switching back is instant.
  //
  // Depends on the LOADED FLAG, never on `queues` itself. Depending on the
  // object meant every store write re-ran this effect, and `loaded` stays false
  // for the whole round-trip — so it re-fired on its own `loading: true` write
  // and hit the API 42 times in one second. Selecting the boolean means the
  // effect only re-runs when the answer actually changes.
  const queueLoaded = useCrmStore((s) => s.queues[queue].loaded)
  useEffect(() => {
    if (ready && !queueLoaded) void loadQueue(queue)
  }, [ready, queue, queueLoaded, loadQueue])

  const filters = useCrmStore((s) => s.filters)
  const current = queues[queue]
  const hasSearch = queue === 'all'
  const filtered = Boolean(filters.status || filters.intent || filters.source)

  // Switching queue drops the filters. They are shared state, and a status
  // carried into the New queue (which the server already pins to status=new)
  // contradicts itself and returns nothing — an empty screen with no visible
  // cause.
  const pickQueue = (next: CrmQueue) => {
    if (next === queue) return
    if (filters.status || filters.intent || filters.source) clearFilters(next)
    setQueue(next)
  }

  const runSearch = () => {
    setSearch(searchDraft.trim())
    void loadQueue('all', { force: true })
  }

  const refresh = () => {
    void loadQueue(queue, { force: true })
    void refreshCounts()
  }

  const askForAlerts = async () => {
    if (typeof Notification === 'undefined') {
      toast.info('This browser has no desktop notifications — the chime still works.')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') toast.success('Desktop alerts on.')
    else toast.info('Desktop alerts stay off. The popup and chime still fire.')
  }

  const stats = useMemo(
    () => [
      { label: 'Calls today', value: today?.calls ?? 0, icon: Phone, tone: 'bg-tint-violet text-primary' },
      { label: 'Logged', value: today?.outcomes ?? 0, icon: UserCheck, tone: 'bg-skysoft text-sky' },
      { label: 'Converted', value: today?.conversions ?? 0, icon: TrendingUp, tone: 'bg-mintsoft text-correct' },
      { label: 'Unclaimed', value: metrics.unclaimed ?? 0, icon: Inbox, tone: 'bg-goldsoft text-gold' },
    ],
    [today, metrics]
  )

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <ErrorState error={new Error(error)} onRetry={() => void init()} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold leading-tight text-ink">Lead desk</h1>
            <p className="truncate font-body text-2xs text-ink2">
              {agentName ?? 'Telecaller'}
              {supervisor && ' · supervisor view'}
            </p>
          </div>
          {/* Same control, same place, as the student shell's header. */}
          <WorkspaceSwitch active="crm" />
          <button
            onClick={() => setSound(!sound)}
            className="icon-btn h-9 w-9"
            aria-label={sound ? 'Mute the arrival chime' : 'Unmute the arrival chime'}
            title={sound ? 'Arrival chime on' : 'Arrival chime off'}
          >
            {sound ? <BellRing size={17} /> : <BellOff size={17} />}
          </button>
          <button onClick={refresh} className="icon-btn h-9 w-9" aria-label="Refresh">
            <RefreshCw size={17} className={current.loading ? 'animate-spin' : undefined} />
          </button>
          <button
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
            className="icon-btn h-9 w-9"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>

        {/* Today's numbers — the agent's own scoreboard, counted from the
            contact-link taps rather than anything they have to self-report. */}
        <div className="mx-auto max-w-3xl overflow-x-auto px-4 pb-3">
          <div className="flex min-w-max gap-2">
            {stats.map((s) => (
              <div key={s.label} className="card flex items-center gap-2.5 px-3 py-2">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${s.tone}`}>
                  <s.icon size={15} />
                </span>
                <div>
                  <p className="font-display text-base font-bold leading-none tabular-nums text-ink">
                    {s.value}
                  </p>
                  <p className="font-body text-2xs leading-tight text-ink2">{s.label}</p>
                </div>
              </div>
            ))}
            {metrics.median_response_secs != null && (
              <div className="card flex items-center gap-2.5 px-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-tint text-ink2">
                  <Clock size={15} />
                </span>
                <div>
                  <p className="font-display text-base font-bold leading-none tabular-nums text-ink">
                    {formatDuration(metrics.median_response_secs)}
                  </p>
                  <p className="font-body text-2xs leading-tight text-ink2">Median response</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Queue tabs ────────────────────────────────────────────────── */}
        <nav className="mx-auto max-w-3xl overflow-x-auto px-4 pb-2.5" aria-label="Lead queues">
          <div className="seg-wrap min-w-max">
            {QUEUES.map((q) => {
              const on = queue === q.id
              const badge =
                q.id === 'pool'
                  ? metrics.unclaimed
                  : q.id === 'followups'
                    ? metrics.follow_ups_due
                    : undefined
              return (
                <button
                  key={q.id}
                  onClick={() => pickQueue(q.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`seg flex items-center gap-1.5 ${on ? 'seg-active' : ''}`}
                >
                  <q.icon size={14} />
                  {q.label}
                  {!!badge && (
                    <span className="rounded-pill bg-brand/15 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-brand">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* ─── The queue ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">
        {hasSearch && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              runSearch()
            }}
            className="mb-4 flex gap-2"
          >
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name, phone or email"
              className="input-soft flex-1 text-sm"
              inputMode="search"
              aria-label="Search leads"
            />
            <button type="submit" className="btn btn-brand px-4">
              <Search size={16} />
            </button>
          </form>
        )}

        {/* New vs old. The pool is where it matters: 682 backfilled rows would
            otherwise sit indistinguishably among the signups that came in
            this morning. */}
        {(queue === 'pool' || queue === 'all') && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="seg-wrap">
              {AGE_TABS.map((tab) => {
                const on = (filters.age ?? '') === tab.id
                return (
                  <button
                    key={tab.id || 'all'}
                    onClick={() => setFilter({ age: tab.id || null }, queue)}
                    aria-current={on ? 'page' : undefined}
                    className={`seg flex items-center gap-1.5 text-xs ${on ? 'seg-active' : ''}`}
                  >
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {queue === 'mine' && <MyStats />}

        <QueueFilters queue={queue} />

        {current.loading && current.leads.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : current.leads.length === 0 ? (
          <EmptyQueue
            queue={queue}
            searched={hasSearch && Boolean(search)}
            filtered={filtered}
            onClearFilters={() => useCrmStore.getState().clearFilters(queue)}
          />
        ) : (
          <>
            <div className="space-y-3">
              {current.leads.map((lead: Lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  claimable={queue === 'pool'}
                  showDue={queue === 'followups'}
                  onOpen={(l) => setOpenLeadId(l.id)}
                />
              ))}
            </div>

            <Pager
              page={current.page}
              total={current.total}
              loading={current.loading}
              onGo={(p) => goToPage(queue, p)}
            />
          </>
        )}
      </main>

      {openLeadId && <LeadSheet leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      <NewLeadPopup />

      {/* Desktop alerts are opt-in and browser-gated, so this sits out of the
          way until the agent asks for it. The in-page popup + chime work
          regardless — this only adds the OS-level banner for a background tab. */}
      {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
        <button
          onClick={() => void askForAlerts()}
          className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-sm rounded-pill bg-ink px-4 py-3 font-heading text-xs font-semibold text-canvas shadow-hero"
        >
          <BellRing size={14} className="mr-1.5 inline" />
          Turn on desktop alerts for new leads
        </button>
      )}
    </div>
  )
}

function EmptyQueue({
  queue,
  searched,
  filtered,
  onClearFilters,
}: {
  queue: CrmQueue
  searched: boolean
  filtered: boolean
  onClearFilters: () => void
}) {
  // A queue emptied by a filter is a completely different message from a queue
  // that is genuinely clear — telling an agent "every lead has been picked up"
  // when three are hidden behind a chip would be a lie they act on.
  if (filtered) {
    return (
      <div className="grid place-items-center px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-hero bg-tint">
          <Users size={26} className="text-ink2" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold text-ink">No leads match</h2>
        <p className="mt-1 max-w-xs font-body text-sm leading-relaxed text-ink2">
          Nothing in this queue matches the filters you have on.
        </p>
        <button onClick={onClearFilters} className="btn btn-sm btn-ghost mt-4">
          Clear filters
        </button>
      </div>
    )
  }

  const copy: Record<CrmQueue, { title: string; body: string }> = {
    pool: {
      title: 'Queue is clear',
      body: 'Every new lead has been picked up. The next signup will pop up here the moment it lands.',
    },
    mine: {
      title: 'Nothing claimed yet',
      body: 'Claim a lead from the New queue and it will show up here with its full history.',
    },
    followups: {
      title: 'No callbacks due',
      body: 'Follow-ups you schedule while logging a call appear here as they come due.',
    },
    all: {
      title: searched ? 'No matches' : 'Search the book',
      body: searched
        ? 'Nothing matched that name, number or email.'
        : 'Look up any lead by name, phone number or email.',
    },
  }
  const { title, body } = copy[queue]
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-hero bg-tint-violet">
        <Users size={26} className="text-primary" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-xs font-body text-sm leading-relaxed text-ink2">{body}</p>
    </div>
  )
}

/**
 * Page navigation for a queue. "Load more" was wrong here: it grows one endless
 * list, gives no sense of position in 682 leads, and offers no way back to
 * where you were. A pager states how big the queue is and lets an agent move
 * through it deliberately.
 */
function Pager({
  page,
  total,
  loading,
  onGo,
}: {
  page: number
  total: number
  loading: boolean
  onGo: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (total <= PAGE_SIZE) return null

  const from = page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Lead pages">
      <button
        onClick={() => onGo(page - 1)}
        disabled={page === 0 || loading}
        className="btn btn-sm btn-ghost px-3"
        aria-label="Previous page"
      >
        <ChevronLeft size={15} />
        <span className="hidden sm:inline">Previous</span>
      </button>

      <p className="font-body text-2xs tabular-nums text-ink2">
        <span className="font-heading font-semibold text-ink">
          {from}–{to}
        </span>{' '}
        of {total}
        <span className="hidden sm:inline">
          {' '}· page {page + 1} of {pages}
        </span>
      </p>

      <button
        onClick={() => onGo(page + 1)}
        disabled={page >= pages - 1 || loading}
        className="btn btn-sm btn-ghost px-3"
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={15} />
      </button>
    </nav>
  )
}
