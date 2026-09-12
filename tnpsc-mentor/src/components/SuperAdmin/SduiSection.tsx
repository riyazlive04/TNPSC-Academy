// ─── Superadmin: server-driven UI layouts ────────────────────────────────────
// Where a layout is written, previewed and published. The preview matters more
// than it looks: it renders through the SAME renderer, registry and context the
// app uses, so what an author sees here is what a device draws — a JSON editor
// without one is how you end up publishing a broken banner to 40,000 phones and
// finding out from a support message.
//
// Publishing is deliberately two steps (save, then Publish) and every live row
// can be paused, which is the rollback: the next launch falls back to the UI
// baked into the build. See docs/SDUI.md.

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Eye, Loader2, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { api, type SduiLayoutRow } from '../../lib/api'
import { sanitizeLayout } from '../../lib/sdui/validate'
import { useSduiContext } from '../../lib/sdui/context'
import SduiRenderer from '../Sdui/SduiRenderer'
import ConfirmDialog from '../UI/ConfirmDialog'
import { toast } from '../../store/toastStore'

/** A starting point that exercises the common pieces, so a new author has
 *  something shaped correctly to edit rather than a blank box. */
const STARTER = JSON.stringify(
  {
    nodes: [
      {
        type: 'banner',
        key: 'promo',
        props: {
          icon: 'rocket',
          tint: 'coral',
          title: { en: 'Group 1 Mock Test Pack', ta: 'குரூப் 1 மாதிரித் தேர்வுத் தொகுப்பு' },
          subtitle: { en: '6 full papers · ₹399', ta: '6 முழுத் தாள்கள் · ₹399' },
          cta: { en: 'View the pack', ta: 'தொகுப்பைப் பார்' },
        },
        when: { field: 'mock_pack', op: 'falsy' },
        action: { kind: 'navigate', to: '/mock-test-pack' },
      },
    ],
  },
  null,
  2
)

export default function SduiSection() {
  const [rows, setRows] = useState<SduiLayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SduiLayoutRow | null>(null)

  const ctx = useSduiContext()
  const current = rows.find((r) => r.id === selected) ?? null

  useEffect(() => {
    void (async () => {
      try {
        setRows(await api.sduiLayouts.list())
      } catch {
        toast.error('Could not load layouts.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Parse as the author types so the preview and the local problem list stay
  // live. Server validation still runs on save — this is the fast feedback,
  // not the authority.
  const parsed = useMemo(() => {
    if (!draft.trim()) return null
    try {
      const obj = JSON.parse(draft) as { nodes?: unknown[] }
      const { layout, droppedTypes } = sanitizeLayout({ ...obj, key: current?.key ?? 'preview', revision: 0 })
      return { layout, droppedTypes, error: null as string | null }
    } catch (e) {
      return { layout: null, droppedTypes: [], error: (e as Error).message }
    }
  }, [draft, current?.key])

  const select = (row: SduiLayoutRow) => {
    setSelected(row.id)
    setDraft(JSON.stringify(row.layout ?? { nodes: [] }, null, 2))
    setProblems([])
  }

  const save = async (extra: Partial<SduiLayoutRow> = {}) => {
    if (!current) return
    setBusy(true)
    setProblems([])
    try {
      const body: Record<string, unknown> = { ...extra }
      if (!('active' in extra)) body.layout = JSON.parse(draft)
      const updated = await api.sduiLayouts.update(current.id, body)
      setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)))
      toast.success(extra.active === true ? 'Published.' : extra.active === false ? 'Paused.' : 'Saved.')
    } catch (e) {
      const err = e as { data?: { problems?: string[] }; message?: string }
      setProblems(err.data?.problems ?? [err.message ?? 'Could not save.'])
      toast.error('Could not save — see the problems below.')
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    const key = newKey.trim()
    if (!key) return
    setBusy(true)
    try {
      const row = await api.sduiLayouts.create({
        key,
        title: null,
        platform: 'all',
        min_app_version: null,
        max_app_version: null,
        rollout_percent: 100,
        layout: JSON.parse(STARTER),
        notes: null,
      })
      setRows((r) => [row, ...r])
      select(row)
      setCreating(false)
      setNewKey('')
    } catch (e) {
      toast.error((e as Error).message || 'Could not create.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await api.sduiLayouts.remove(pendingDelete.id)
      setRows((r) => r.filter((x) => x.id !== pendingDelete.id))
      if (selected === pendingDelete.id) setSelected(null)
    } catch {
      toast.error('Could not delete.')
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Screen layouts</h2>
          <p className="mt-1 max-w-xl font-body text-sm leading-relaxed text-muted">
            Arrange a region of the app from here instead of through a store review. A slot with
            nothing published renders the screen built into the app, and pausing a live layout puts
            it straight back — see docs/SDUI.md.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-brand px-4 py-2 text-sm">
          <Plus size={15} /> New layout
        </button>
      </header>

      {creating && (
        <div className="card space-y-3 p-4">
          <label className="block font-body text-sm text-ink2">
            Slot key
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="home.banners"
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm text-ink"
            />
          </label>
          <p className="font-body text-xs text-muted">
            Regions inside a built-in screen: <code>home.top</code>, <code>home.banners</code>,{' '}
            <code>home.footer</code>. A key starting <code>screen.</code> becomes a whole screen at{' '}
            <code>/s/&lt;name&gt;</code> with no route of its own.
          </p>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="btn-brand px-4 py-2 text-sm">
              Create draft
            </button>
            <button onClick={() => setCreating(false)} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* ── The list ── */}
        <div className="space-y-2">
          {!rows.length && (
            <p className="font-body text-sm text-muted">
              Nothing published. Every slot is showing the app's built-in screen.
            </p>
          )}
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => select(row)}
              className={`focus-ring w-full rounded-card border p-3 text-left transition ${
                selected === row.id ? 'border-brand bg-tint-violet/40' : 'border-line bg-card'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink">
                  {row.key}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-body text-2xs font-semibold ${
                    row.active ? 'bg-mint/15 text-mint' : 'bg-line text-muted'
                  }`}
                >
                  {row.active ? 'live' : 'draft'}
                </span>
              </div>
              <div className="mt-1 font-body text-xs text-muted">
                r{row.revision} · {row.platform}
                {row.min_app_version ? ` · ≥${row.min_app_version}` : ''}
                {row.rollout_percent < 100 ? ` · ${row.rollout_percent}%` : ''}
              </div>
            </button>
          ))}
        </div>

        {/* ── The editor + preview ── */}
        {current ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => save()}
                disabled={busy}
                className="btn-brand px-4 py-2 text-sm disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
              </button>
              {current.active ? (
                <button
                  onClick={() => save({ active: false })}
                  disabled={busy}
                  className="btn-soft px-4 py-2 text-sm"
                >
                  <Pause size={15} /> Pause
                </button>
              ) : (
                <button
                  onClick={() => save({ active: true })}
                  disabled={busy}
                  className="btn-accent px-4 py-2 text-sm"
                >
                  <Play size={15} /> Publish
                </button>
              )}
              <button
                onClick={() => setPendingDelete(current)}
                className="btn-ghost px-3 py-2 text-sm text-coral"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Targeting. The version window is the guard that keeps a layout
                naming a newer component away from older installs. */}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="font-body text-xs text-ink2">
                Platform
                <select
                  value={current.platform}
                  onChange={(e) => void save({ platform: e.target.value as SduiLayoutRow['platform'] })}
                  className="mt-1 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
                >
                  <option value="all">all</option>
                  <option value="android">android</option>
                  <option value="ios">ios</option>
                  <option value="web">web</option>
                </select>
              </label>
              <label className="font-body text-xs text-ink2">
                Min app version
                <input
                  defaultValue={current.min_app_version ?? ''}
                  onBlur={(e) => void save({ min_app_version: e.target.value })}
                  placeholder="2.0.7"
                  className="mt-1 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="font-body text-xs text-ink2">
                Rollout %
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={current.rollout_percent}
                  onBlur={(e) => void save({ rollout_percent: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <label className="font-body text-xs font-semibold uppercase tracking-wide text-ink2">
                  Layout JSON
                </label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  rows={22}
                  className="mt-1 w-full rounded-card border border-line bg-card p-3 font-mono text-xs leading-relaxed text-ink"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-ink2">
                  <Eye size={13} /> Preview (as you, right now)
                </label>
                <div className="mt-1 min-h-[200px] space-y-3 rounded-card border border-line bg-canvas p-4">
                  {parsed?.layout ? (
                    <SduiRenderer layout={parsed.layout} ctx={ctx} />
                  ) : (
                    <p className="font-body text-sm text-muted">
                      {parsed?.error ? 'Not valid JSON yet.' : 'Nothing to draw.'}
                    </p>
                  )}
                </div>
                <p className="mt-2 font-body text-xs text-muted">
                  Conditions are evaluated against YOUR account, so a node aimed at free users
                  won't appear here if you're paid.
                </p>
                {parsed?.droppedTypes.length ? (
                  <p className="mt-2 flex items-start gap-1.5 font-body text-xs text-coral">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    Unknown components dropped: {parsed.droppedTypes.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>

            {problems.length > 0 && (
              <div className="rounded-card border border-coral/40 bg-coral/5 p-3">
                <p className="flex items-center gap-1.5 font-heading text-sm font-semibold text-coral">
                  <AlertTriangle size={15} /> Not published — fix these first
                </p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-ink2">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="font-body text-sm text-muted">Pick a layout to edit, or create one.</p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this layout?"
        message={
          pendingDelete?.active
            ? `${pendingDelete.key} is LIVE. Pausing it is the safer rollback — deleting loses the record of what was published.`
            : `Delete the draft ${pendingDelete?.key ?? ''}?`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
