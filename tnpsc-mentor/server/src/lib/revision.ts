// Topic-revision helpers shared by the test-submit and revision routes.
//
// The "study gate": after a low-scoring topic test the re-test is locked until
// the learner has had STUDY_AWAKE_HOURS of *awake* time to study — the sleep
// window (SLEEP_START..SLEEP_END, IST) does not count toward it. The unlock
// instant is computed here (pure ms arithmetic, fixed IST offset, no DST) and
// stored on the row, so the DB never does timezone math and no cron is needed.

export const STUDY_AWAKE_HOURS = 12
export const SLEEP_START = 23 // 23:00 IST — sleep begins
export const SLEEP_END = 7 //   07:00 IST — sleep ends
/**
 * Pass mark. A topic test scoring AT or BELOW this needs revision (40% counts);
 * only a score ABOVE it clears the topic.
 */
export const REVISION_PASS_MARK = 40

const IST_OFFSET_MIN = 330 // Asia/Kolkata = UTC+5:30, no DST
const MIN = 60_000
const DAY_MIN = 24 * 60
const SLEEP_START_MIN = SLEEP_START * 60 // 1380
const SLEEP_END_MIN = SLEEP_END * 60 //    420

/**
 * Returns the instant the re-test unlocks: `fromMs` plus STUDY_AWAKE_HOURS of
 * awake time, skipping the nightly sleep window in IST. Walks the IST wall-clock
 * forward, consuming only awake minutes and jumping over sleep, then converts
 * back to UTC.
 */
export function computeAvailableAt(fromMs: number): Date {
  let remaining = STUDY_AWAKE_HOURS * 60 // awake minutes still to accrue
  let cursor = fromMs + IST_OFFSET_MIN * MIN // walk in the IST wall-clock domain

  // Guard against pathological input; the loop below always makes forward
  // progress (each branch either jumps or consumes >0 minutes), so this is just
  // a backstop.
  let guard = 0
  while (remaining > 0 && guard++ < 64) {
    const dayStart = cursor - mod(cursor, DAY_MIN * MIN)
    const minuteOfDay = mod(cursor, DAY_MIN * MIN) / MIN

    if (minuteOfDay < SLEEP_END_MIN) {
      // Pre-dawn sleep → jump to 07:00 today (no time accrued).
      cursor = dayStart + SLEEP_END_MIN * MIN
    } else if (minuteOfDay >= SLEEP_START_MIN) {
      // Night sleep → jump to 07:00 tomorrow.
      cursor = dayStart + DAY_MIN * MIN + SLEEP_END_MIN * MIN
    } else {
      // Awake: accrue up to the start of tonight's sleep.
      const untilSleep = SLEEP_START_MIN - minuteOfDay
      const chunk = Math.min(untilSleep, remaining)
      cursor += chunk * MIN
      remaining -= chunk
    }
  }

  return new Date(cursor - IST_OFFSET_MIN * MIN)
}

/** Positive, wrap-safe modulo. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** The scope fields that define a "topic" — what we regenerate similar tests from. */
export interface RevisionScope {
  category?: string | null
  group_type?: string | null
  subject?: string | null
  standard?: number | string | null
  topic?: string | null
  unit?: string | null
  question_type?: string | null
  ca_type?: string | null
  ca_month?: string | null
  ca_topic?: string | null
  aptitude_type?: string | null
  aptitude_topic?: string | null
  difficulty?: string | null
}

// Order matters: topic_key is a positional join, so the same scope always hashes
// to the same key (dedupe) regardless of object key ordering.
const SCOPE_FIELDS: (keyof RevisionScope)[] = [
  'category', 'group_type', 'subject', 'standard', 'topic', 'unit',
  'question_type', 'ca_type', 'ca_month', 'ca_topic', 'aptitude_type',
  'aptitude_topic', 'difficulty',
]

/** A stable, human-debuggable key for a topic scope (used for dedupe upserts). */
export function buildTopicKey(scope: RevisionScope): string {
  return SCOPE_FIELDS.map((f) => {
    const v = scope[f]
    return v === null || v === undefined || v === '' ? '' : String(v)
  }).join('|')
}

/** Only the scope fields, cleaned — stored on the row to regenerate tests. */
export function buildScopeConfig(scope: RevisionScope): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of SCOPE_FIELDS) {
    const v = scope[f]
    if (v !== null && v !== undefined && v !== '') out[f] = v
  }
  return out
}

/** A readable heading like "History and INM • Feudalism • Match". */
export function buildLabel(scope: RevisionScope): string {
  const parts = [
    scope.subject,
    scope.topic ?? scope.ca_topic ?? scope.aptitude_topic,
    scope.standard != null ? `Std ${scope.standard}` : null,
    prettyType(scope.question_type),
  ].filter((p): p is string => !!p)
  if (parts.length) return parts.join(' • ')
  return scope.category ? prettyCategory(scope.category) : 'Revision'
}

function prettyType(t?: string | null): string | null {
  if (!t) return null
  const map: Record<string, string> = {
    match: 'Match',
    assertion_reason: 'Assertion & Reason',
    statements: 'Statements',
    chronological: 'Chronological',
    direct: 'Direct',
  }
  return map[t] ?? t
}

function prettyCategory(c: string): string {
  const map: Record<string, string> = {
    pyq: 'Previous Year',
    samacheer: 'Samacheer',
    current_affairs: 'Current Affairs',
    aptitude: 'Aptitude',
    subject: 'Subject Practice',
  }
  return map[c] ?? c
}

/**
 * A topic test is eligible for revision only if it has a concrete topical scope
 * (a subject / topic / CA topic / aptitude topic). Full group mocks, which span
 * many subjects with no single topic, are excluded.
 */
export function isRevisable(scope: RevisionScope): boolean {
  return !!(scope.subject || scope.topic || scope.ca_topic || scope.aptitude_topic)
}
