// ─── Free-tier per-topic gate key (client mirror of server/src/lib/freeGate.ts) ─
// Free users get ONE test per topic on PYQ (Group 1 & 2) and Current Affairs;
// premium/vettri are unlimited. The server ENFORCES this (403 at /quiz); this
// mirror only lets a picker pre-render a lock pill by computing a row's key and
// checking it against the used-keys list from GET /questions/topic-access. Keep
// this byte-for-byte in sync with the server so pills match the actual 403.

/** Fields a picker passes; a subset of QuizConfig. */
export interface GateConfigLike {
  category?: string
  subject?: string
  topic?: string
  ca_topic?: string
  ca_month?: string
  /** Present on CA configs; not part of the key, but accepted so callers can
   *  pass the same object to both the gate check and startTest. */
  ca_type?: string
  aptitude_type?: string
  mock?: boolean
}

const GATED_CATEGORIES = new Set(['pyq', 'pyq2', 'pyq4', 'current_affairs'])

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/** Normalized topic key, or null when the config isn't a gated per-topic test. */
export function deriveGateKey(cfg: GateConfigLike | null | undefined): string | null {
  if (!cfg) return null
  const category = str(cfg.category)
  if (!category || !GATED_CATEGORIES.has(category)) return null
  if (cfg.mock === true) return null

  const subject = str(cfg.subject)
  const topic = str(cfg.topic)
  const caTopic = str(cfg.ca_topic)
  const caMonth = str(cfg.ca_month)
  const aptitudeType = str(cfg.aptitude_type)

  if (category === 'pyq') return subject ? `pyq:${subject}` : null
  // The section-wise groups key on section + sub-type, so one free test is
  // granted per sub-type rather than per whole section.
  if (category === 'pyq2' || category === 'pyq4') {
    if (!subject) return null
    return `${category}:${subject}:${topic ?? aptitudeType ?? 'all'}`
  }
  const leaf = topic ?? caTopic
  if (caMonth) return leaf ? `ca:m:${caMonth}:${leaf}` : `ca:m:${caMonth}`
  if (leaf) return `ca:t:${leaf}`
  return 'ca:all'
}
