// ─── Free-tier per-topic gate key derivation ─────────────────────────────────
// Free users may take ONE test per topic on PYQ (Group 1 & 2) and Current Affairs;
// premium OR vettri holders are unlimited. `test_sessions` only stores coarse keys
// (category/subject/ca_month), so we normalize the quiz config into a single
// `gate_key` string that IS recorded (free_test_usage) and checked. This function
// is the single source of truth for that key — mirrored byte-for-byte on the client
// (src/lib/freeGate.ts) so lock pills line up with the server's 403.

/** Categories subject to the one-free-test-per-topic gate. */
export const GATED_CATEGORIES = new Set(['pyq', 'pyq2', 'current_affairs'])

type Cfg = Record<string, unknown> | null | undefined

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/**
 * Normalized topic key for a quiz config, or null when the config isn't a gated
 * per-topic test (wrong category, a mock/group-exam/weekly flow, or missing the
 * identifying field). A null key means "don't gate this request".
 */
export function deriveGateKey(cfg: Cfg): string | null {
  if (!cfg) return null
  const category = str((cfg as Record<string, unknown>).category)
  if (!category || !GATED_CATEGORIES.has(category)) return null

  // Group-exam / weekly-revision mock flows are a separate, separately-gated
  // surface — never fold them into the per-topic gate.
  const c = cfg as Record<string, unknown>
  if (c.mock === true || c.mock === 'true') return null

  const subject = str(c.subject)
  const topic = str(c.topic)
  const caTopic = str(c.ca_topic)
  const caMonth = str(c.ca_month)
  const aptitudeType = str(c.aptitude_type)

  if (category === 'pyq') {
    // Group 1: one test per subject (Geography, Polity, …).
    return subject ? `pyq:${subject}` : null
  }
  if (category === 'pyq2') {
    // Group 2: subject = section; topic = sub-type; aptitude_type for Aptitude.
    // Year is intentionally ignored — a sub-type across years is one "topic".
    if (!subject) return null
    return `pyq2:${subject}:${topic ?? aptitudeType ?? 'all'}`
  }
  // current_affairs: month-wise keys on the month (+ topic within it); topic-wise
  // keys on the topic; a generic all-CA test keys on a single bucket.
  const leaf = topic ?? caTopic
  if (caMonth) return leaf ? `ca:m:${caMonth}:${leaf}` : `ca:m:${caMonth}`
  if (leaf) return `ca:t:${leaf}`
  return 'ca:all'
}
