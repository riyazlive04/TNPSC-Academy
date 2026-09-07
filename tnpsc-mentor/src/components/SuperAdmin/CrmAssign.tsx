import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Loader2, UserPlus, Users } from 'lucide-react'
import Spinner from '../UI/Spinner'
import { api, type CrmAgentRow } from '../../lib/api'
import { toast } from '../../store/toastStore'
import { STATUS_CLASS, STATUS_LABEL, formatPhone, type Lead } from '../../lib/crm'

/**
 * Hand leads to an agent, in bulk.
 *
 * The endpoint for this shipped with the CRM and had no interface, so the
 * "a supervisor can also assign" half of the assignment model was unreachable —
 * leads could only ever be self-claimed from the shared pool. This is the
 * missing half: pick a queue, tick the leads, choose an agent.
 *
 * Also the way the book leaves the building (CSV), which is supervisor-only:
 * handing over every contact detail at once is a different act from an agent
 * opening one lead to call it.
 */
export default function CrmAssign() {
  const [agents, setAgents] = useState<CrmAgentRow[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [agentId, setAgentId] = useState('')
  const [queue, setQueue] = useState<'pool' | 'all'>('pool')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([api.crm.agents(), api.crm.leads({ queue, limit: 100 })])
      .then(([a, l]) => {
        setAgents(a)
        setLeads(l.leads)
        setPicked(new Set())
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Could not load leads to assign.')
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [queue])

  const allPicked = leads.length > 0 && picked.size === leads.length
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const assign = async (to: string | null) => {
    if (picked.size === 0) return
    setBusy(true)
    try {
      const { assigned } = await api.crm.assign([...picked], to)
      toast.success(
        to
          ? `${assigned} lead${assigned === 1 ? '' : 's'} assigned.`
          : `${assigned} lead${assigned === 1 ? '' : 's'} returned to the shared queue.`
      )
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign those leads.')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setBusy(true)
    try {
      const csv = await api.crm.exportCsv()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const agentLabel = useMemo(
    () => (a: CrmAgentRow) => `${a.full_name ?? a.email} · ${a.open_leads} open`,
    []
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg-wrap">
          {(['pool', 'all'] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQueue(q)}
              className={`seg text-xs ${queue === q ? 'seg-active' : ''}`}
            >
              {q === 'pool' ? 'Unclaimed' : 'Every lead'}
            </button>
          ))}
        </div>
        <button onClick={() => void exportCsv()} disabled={busy} className="btn btn-sm btn-ghost ml-auto">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {agents.length === 0 && !loading && (
        <p className="card p-4 font-body text-sm text-ink2">
          No telecaller accounts yet — set a user&apos;s role to Telecaller in the Users tab first.
        </p>
      )}

      {/* Action bar. Sticky so a long tick-list never leaves the agent picker
          off screen. */}
      {picked.size > 0 && (
        <div className="sticky top-2 z-10 card flex flex-wrap items-center gap-2 p-3 shadow-card">
          <span className="font-heading text-xs font-semibold text-ink">
            {picked.size} selected
          </span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="input-soft w-auto flex-1 py-2 text-sm"
          >
            <option value="">Choose an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {agentLabel(a)}
              </option>
            ))}
          </select>
          <button
            onClick={() => void assign(agentId)}
            disabled={busy || !agentId}
            className="btn btn-sm btn-brand"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Assign
          </button>
          <button onClick={() => void assign(null)} disabled={busy} className="btn btn-sm btn-ghost">
            Return to pool
          </button>
        </div>
      )}

      {loading ? (
        <Spinner className="mx-auto my-10" />
      ) : leads.length === 0 ? (
        <p className="card p-6 text-center font-body text-sm text-ink2">Nothing here to assign.</p>
      ) : (
        <>
          <button
            onClick={() => setPicked(allPicked ? new Set() : new Set(leads.map((l) => l.id)))}
            className="btn btn-sm btn-ghost px-3 py-1.5 text-2xs"
          >
            <Check size={13} /> {allPicked ? 'Clear selection' : `Select all ${leads.length}`}
          </button>

          <ul className="space-y-1.5">
            {leads.map((l) => {
              const on = picked.has(l.id)
              return (
                <li key={l.id}>
                  <label
                    className={`card flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                      on ? 'border-brand/50 bg-tint-violet/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(l.id)}
                      className="h-4 w-4 shrink-0 accent-violet-600"
                      aria-label={`Select ${l.full_name ?? 'lead'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-medium text-ink">
                        {l.full_name?.trim() || formatPhone(l.phone) || 'Unnamed lead'}
                      </p>
                      <p className="truncate font-body text-2xs tabular-nums text-ink2">
                        {formatPhone(l.phone) || 'No phone'}
                        {l.assigned_name ? ` · with ${l.assigned_name}` : ' · unclaimed'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${STATUS_CLASS[l.status]}`}
                    >
                      {STATUS_LABEL[l.status]}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {leads.length >= 100 && (
            <p className="flex items-center gap-1.5 font-body text-2xs text-ink2">
              <Users size={12} /> Showing the first 100. Assign these, then reload for more.
            </p>
          )}
        </>
      )}
    </section>
  )
}
