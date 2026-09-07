import { useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import {
  INTENT_CLASS,
  SOURCE_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  type LeadSource,
  type LeadStatus,
} from '../../lib/crm'
import type { CrmQueue } from '../../lib/api'

/** Statuses worth filtering a working queue by. 'new' is omitted for the pool
 *  (everything there is new) but kept elsewhere. */
const STATUSES: LeadStatus[] = [
  'new',
  'in_progress',
  'follow_up',
  'converted',
  'not_interested',
  'unreachable',
  'invalid',
]

const SOURCES: LeadSource[] = ['signup', 'import', 'manual', 'backfill']

interface QueueFiltersProps {
  queue: CrmQueue
}

/**
 * Narrows a queue by what the lead SAID (the superadmin-defined answer
 * categories), by pipeline status, and by where the lead came from.
 *
 * Filtering happens on the server, so these narrow the whole queue and its
 * count — not merely the page already on screen, which on a long list would
 * quietly lie about how much work is left.
 *
 * Collapsed to a single row by default: an agent working a queue wants leads on
 * screen, not chrome. The active-filter count stays visible on the toggle so a
 * narrowed queue can never be mistaken for an empty one.
 */
export default function QueueFilters({ queue }: QueueFiltersProps) {
  const intents = useCrmStore((s) => s.intents)
  const filters = useCrmStore((s) => s.filters)
  const setFilter = useCrmStore((s) => s.setFilter)
  const clearFilters = useCrmStore((s) => s.clearFilters)
  const [open, setOpen] = useState(false)

  const active = [filters.status, filters.intent, filters.source].filter(Boolean).length

  const toggle = (key: 'status' | 'intent' | 'source', value: string) =>
    setFilter({ [key]: filters[key] === value ? null : value }, queue)

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`btn btn-sm ${active ? 'btn-soft' : 'btn-ghost'} px-3 py-2 text-xs`}
        >
          <SlidersHorizontal size={14} />
          Filter
          {active > 0 && (
            <span className="rounded-pill bg-brand px-1.5 py-0.5 text-2xs font-bold text-white">
              {active}
            </span>
          )}
          <ChevronDown
            size={13}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* The active filters stay readable with the panel shut, so what is
            being hidden is never a mystery. */}
        {active > 0 && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {filters.status && (
              <Pill
                label={STATUS_LABEL[filters.status]}
                className={STATUS_CLASS[filters.status]}
                onClear={() => setFilter({ status: null }, queue)}
              />
            )}
            {filters.intent && (
              <Pill
                label={
                  filters.intent === 'none'
                    ? 'No answer yet'
                    : (intents.find((i) => i.id === filters.intent)?.label ?? 'Answer')
                }
                className={
                  filters.intent === 'none'
                    ? 'bg-tint text-ink2'
                    : INTENT_CLASS[
                        intents.find((i) => i.id === filters.intent)?.color ?? 'slate'
                      ]
                }
                onClear={() => setFilter({ intent: null }, queue)}
              />
            )}
            {filters.source && (
              <Pill
                label={SOURCE_LABEL[filters.source as LeadSource]}
                className="bg-tint text-ink2"
                onClear={() => setFilter({ source: null }, queue)}
              />
            )}
            <button
              type="button"
              onClick={() => clearFilters(queue)}
              className="font-body text-2xs text-ink2 underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="card mt-2 space-y-3 p-3 animate-fadeInFast">
          <Group title="What they said">
            <Chip
              label="No answer yet"
              on={filters.intent === 'none'}
              tone="bg-tint text-ink2"
              onClick={() => toggle('intent', 'none')}
            />
            {intents.map((i) => (
              <Chip
                key={i.id}
                label={i.label}
                on={filters.intent === i.id}
                tone={INTENT_CLASS[i.color]}
                onClick={() => toggle('intent', i.id)}
              />
            ))}
          </Group>

          <Group title="Status">
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={STATUS_LABEL[s]}
                on={filters.status === s}
                tone={STATUS_CLASS[s]}
                onClick={() => toggle('status', s)}
              />
            ))}
          </Group>

          <Group title="Source">
            {SOURCES.map((s) => (
              <Chip
                key={s}
                label={SOURCE_LABEL[s]}
                on={filters.source === s}
                tone="bg-tint text-ink2"
                onClick={() => toggle('source', s)}
              />
            ))}
          </Group>
        </div>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-heading text-2xs font-semibold uppercase tracking-[0.14em] text-ink2">
        {title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  label,
  on,
  tone,
  onClick,
}: {
  label: string
  on: boolean
  tone: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`press rounded-pill px-3 py-1.5 font-heading text-2xs font-semibold transition-all ${
        on ? 'bg-brand-gradient text-white shadow-brand' : tone
      }`}
    >
      {label}
    </button>
  )
}

function Pill({
  label,
  className,
  onClear,
}: {
  label: string
  className: string
  onClear: () => void
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-heading text-2xs font-semibold ${className}`}
    >
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove the ${label} filter`}>
        <X size={11} />
      </button>
    </span>
  )
}
