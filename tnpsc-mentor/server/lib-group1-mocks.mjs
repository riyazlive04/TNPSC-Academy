// ─── Group 1 mock papers: parser JSON → `questions` row shape ────────────────
// The three 200-Q papers authored in c:/Users/mas20/Desktop/work/parser/Group1/mock
// carry a richer schema than the original six mocks (per-option bilingual
// explanations, an author-assigned difficulty of Very Hard/Hard/Medium, a
// free-text question_type and a `unit` code). This module maps that onto the
// columns `questions` actually has, and is imported by both the loader and its
// dry-run/verification path so what gets inspected is exactly what gets written.

/**
 * The `source_url` stamped on every row this loader writes. It is the marker
 * that tells these papers apart from the original six (loaded as
 * 'tnpsc-official'), which is what lets the swap know exactly which rows still
 * need moving — so a run interrupted part way through resumes correctly instead
 * of shifting the papers a second time. Do not change it casually.
 */
export const SOURCE_URL = 'tnpsc-mentors-original'

/**
 * Paper → the mock_exams slot it is loaded into. These three take slots 4/5/6,
 * which the original six-paper set occupies today — so the load is a SWAP, not
 * an overwrite: the papers currently in 4/5/6 move up to 7/8/9 first (see
 * ARCHIVE_MOVES) and these are written into the vacated slots. No question row
 * is ever deleted.
 */
export const MOCK_SETS = [
  { file: 'mock01', set: 4, examId: 'exam4' },
  { file: 'mock02', set: 5, examId: 'exam5' },
  { file: 'mock03', set: 6, examId: 'exam6' },
]

/**
 * The papers being displaced, and where they move to. This is an UPDATE of
 * existing rows, never a delete-and-reinsert: keeping each question's `id`
 * means every bookmark, SRS card, seen-questions entry and recorded answer
 * that points at it stays valid and simply follows the question to its new
 * exam.
 *
 * `external_id` has a UNIQUE index and the incoming papers claim M4-/M5-/M6-,
 * so the outgoing ids must be renamed out of the way in the same statement —
 * M4-GS-001 → M7-GS-001, M6-REA-010 → M9-REA-010. Every existing id matches
 * ^M[456]- (verified), so the section suffix is preserved untouched.
 */
export const ARCHIVE_MOVES = [
  { from: 4, to: 7, examId: 'exam7' },
  { from: 5, to: 8, examId: 'exam8' },
  { from: 6, to: 9, examId: 'exam9' },
]

/**
 * The exams this load makes visible: ONLY the three freshly loaded papers.
 *
 * The displaced ones (exam7/8/9) stay hidden. They have always been
 * enabled=false and moving them to a new slot number is not a reason to expose
 * them — they are the weakest papers in the bank (up to 81% of their answers on
 * option A, and options are never shuffled at serve time), so they are parked
 * until they are worth showing. Switch them on from the superadmin Mock Exams
 * tab whenever that changes.
 *
 * Net effect on students: six visible exams, exam1-3 plus these three.
 *
 * Enabling is guarded on the question count, so a short paper is never exposed.
 */
export const ENABLE_EXAM_IDS = MOCK_SETS.map((m) => m.examId)

/**
 * The ONE mock exam that is free to take. Everything else is tier='paid' and
 * shows the lock in the picker.
 *
 * `tier` is a separate control from `enabled`: enabled decides whether an exam
 * appears at all, tier decides whether opening it needs a paid plan. The
 * loader asserts this split rather than assuming it, because the live catalog
 * can be edited from the superadmin console and had drifted — a second exam was
 * open to everyone.
 */
export const FREE_EXAM_ID = 'exam1'

/**
 * Syllabus unit code → the `unit` label already used by the existing six mocks.
 * Keeping the exact strings matters: any grouping by unit has to fold the new
 * papers in with the old ones rather than start a parallel set of labels.
 */
const UNIT_LABEL = {
  U1: 'Unit I: General Science',
  U2: 'Unit II: Geography of India',
  U3: 'Unit III: History, Culture of India, and Indian National Movement',
  U4: 'Unit IV: Indian Polity',
  U5: 'Unit V: Indian Economy and Development Administration in Tamil Nadu',
  U6: 'Unit VI: History, Culture, Heritage and Socio-Political Movements of Tamil Nadu',
  B1: 'Part B: Aptitude and Mental Ability',
  B2: 'Part B: Aptitude and Mental Ability',
}

/** Units that map to exactly one subject in the existing bank's vocabulary. */
const UNIT_SUBJECT = {
  U2: 'Geography',
  U3: 'History and INM',
  U4: 'Polity',
  B1: 'Aptitude',
  B2: 'Reasoning',
}

// U1/U5/U6 are split across several subjects in the existing bank, so they are
// classified per question from the author's `subject_concept` + `source_ref`.
// The regexes are ordered — first match wins — and every branch ends at a label
// that already exists in the bank, never a new one.

/** U1 General Science → Physics / Chemistry / Biology. */
const SCIENCE_RULES = [
  [/cell|organ|skelet|digest|circulat|respirat|endocrin|classific|invertebr|phyl|disease|hered|mendel|genetic|food chain|trophic|environment|wildlife|conserv|plant|animal|health|hygiene|blood|muscle|nutrition|photosynth/i, 'Biology'],
  [/chemistr|acid|base|salt|valenc|atomic structure|mixture|element|compound|gypsum|epsom|plaster|phenol|neutralis|neutraliz|metal|periodic table|carbon|molecul/i, 'Chemistry'],
  [/heat|temperatur|magnet|measur|electric|force|motion|light|sound|shadow|reflect|pressure|friction|energy|unit|velocity|speed|nuclear|universe|space|astronom|geocentric|heliocentric|charge|circuit|optical/i, 'Physics'],
]

/** U5 → 'Development Administration in TN' vs 'Indian Economy'. */
const DEV_ADMIN_RE =
  /development administration|tamil nadu|tamilnadu|\bTN\b|panchayat|local (body|bodies|government|self)|municipal|corporation|district administration|collector|welfare scheme|noon meal|midday meal|self-help group|\bSHG\b|e-governance|e-sevai|public distribution|\bPDS\b|amma |chief minister'?s? |right to information|citizen'?s charter|grievance|bureaucra|civil service|administrative reform|good governance|social (welfare|justice)|women empowerment|dravidian model/i

/** U6 → 'History Culture Heritage of TN' vs 'Tamil Nadu History'. */
const TN_CULTURE_RE =
  /culture|heritage|literatur|sangam (literature|poet|work)|thirukkural|thirukural|kural|temple|architect|sculpt|bronze|dance|music|art\b|painting|festival|tolkappiyam|silappadikaram|manimekalai|bhakti|alvar|nayanmar|saiva|vaishnav|epigraph|inscription|coin|numismat|language|tamil script|folk|drama|theatre/i

/**
 * Free-text `question_type` → the app's controlled vocabulary
 * ('match' | 'assertion_reason' | 'chronological' | 'statements' | 'direct').
 * Only 'match' is functional — it asks QuestionStem to try the List I/List II
 * grid renderer, which falls back to the plain layout when the text is not a
 * two-list match, so tagging it is safe. Order matters: an "Assertion-Reason"
 * item also contains the word "statement" in some of the author's labels.
 */
export function mapQuestionType(raw) {
  const s = String(raw ?? '').toLowerCase()
  if (!s) return null
  if (s.includes('assertion')) return 'assertion_reason'
  if (/match|pair/.test(s)) return 'match'
  if (/chronolog|sequen|ordering/.test(s)) return 'chronological'
  if (/statement/.test(s)) return 'statements'
  return 'direct'
}

/** Author difficulty → the `questions` check constraint (easy|medium|hard). */
export function mapDifficulty(raw) {
  return /medium/i.test(String(raw ?? '')) ? 'medium' : 'hard'
}

/** The subject label for one record, in the existing bank's vocabulary. */
export function subjectFor(rec) {
  const fixed = UNIT_SUBJECT[rec.unit]
  if (fixed) return fixed
  const hay = `${rec.subject_concept ?? ''} ${rec.source_ref ?? ''}`
  if (rec.unit === 'U1') {
    for (const [re, label] of SCIENCE_RULES) if (re.test(hay)) return label
    return 'Physics'
  }
  if (rec.unit === 'U5') return DEV_ADMIN_RE.test(hay) ? 'Development Administration in TN' : 'Indian Economy'
  if (rec.unit === 'U6') return TN_CULTURE_RE.test(hay) ? 'History Culture Heritage of TN' : 'Tamil Nadu History'
  return 'General Studies'
}

/**
 * Drop the author's correctness marker from the winning option's explanation.
 * The app already shows which option was right, and its own stripCorrectPrefix
 * (src/types/index.ts) does not match this "✅ CORRECT —" form.
 */
function stripCorrectMarker(text) {
  return (
    String(text ?? '')
      // The tick, then the marker phrase itself. Two steps because the phrase
      // varies ("CORRECT", "சரியான விடை", "சரியான வரிசை" …) and is sometimes followed by a
      // parenthetical that IS worth keeping ("(this is the incorrectly matched
      // pair)"), so only the marker and its separator come off.
      .replace(/^\s*✅\s*/u, '')
      .replace(/^(CORRECT|சரியான\s+\S+)\s*[—–\-.:]*\s*/iu, '')
      .trim()
  )
}

/** The correct option's explanation, with the author's key takeaway appended. */
function explanationText(perOption, letter, keyConcept, keyLabel) {
  const body = stripCorrectMarker(perOption?.[letter])
  const key = String(keyConcept ?? '').trim()
  if (!body) return key || null
  return key ? `${body}\n\n${keyLabel}: ${key}` : body
}

/** The three losing options, keyed by letter — the `why_wrong` jsonb column. */
function whyWrong(perOption, correct) {
  const out = {}
  for (const l of ['A', 'B', 'C', 'D']) {
    if (l === correct) continue
    const v = String(perOption?.[l] ?? '').trim()
    if (v) out[l] = v
  }
  return Object.keys(out).length ? out : null
}

/**
 * One parser record → one `questions` row. `part` is carried for reporting only
 * (there is no such column; the loader ignores it), and `external_id` is stable
 * and derived, so re-running the load updates in place rather than duplicating.
 */
export function toRow(rec, mockSet) {
  const correct = String(rec.correct_answer_letter ?? '').trim().toUpperCase()
  return {
    mock_set: mockSet,
    external_id: `M${mockSet}-GS-${String(rec.q_no).padStart(3, '0')}`,
    category: 'mock',
    part: rec.part,
    unit: UNIT_LABEL[rec.unit] ?? rec.unit_name ?? null,
    subject: subjectFor(rec),
    topic: rec.subject_concept ?? null,
    question_type: mapQuestionType(rec.question_type),
    difficulty: mapDifficulty(rec.difficulty),

    question_text: rec.question_en,
    option_a: rec.options_en?.A,
    option_b: rec.options_en?.B,
    option_c: rec.options_en?.C,
    option_d: rec.options_en?.D,
    correct_answer: correct,
    explanation: explanationText(rec.explanation_en, correct, rec.key_concept_en, 'Key concept'),
    why_wrong: whyWrong(rec.explanation_en, correct),

    question_text_ta: rec.question_ta ?? null,
    option_a_ta: rec.options_ta?.A ?? null,
    option_b_ta: rec.options_ta?.B ?? null,
    option_c_ta: rec.options_ta?.C ?? null,
    option_d_ta: rec.options_ta?.D ?? null,
    explanation_ta: explanationText(
      rec.explanation_ta,
      correct,
      rec.key_concept_ta,
      'முக்கியக் கருத்து'
    ),
    why_wrong_ta: whyWrong(rec.explanation_ta, correct),
  }
}

/**
 * Everything that would make a row unusable in the app. Returned as a list of
 * human-readable problems so the dry run can refuse to load a bad paper rather
 * than half-writing one.
 */
export function validateRow(row, rec) {
  const problems = []
  const need = (v, name) => {
    if (!String(v ?? '').trim()) problems.push(`${name} is empty`)
  }
  need(row.question_text, 'question_text')
  need(row.question_text_ta, 'question_text_ta')
  for (const l of ['a', 'b', 'c', 'd']) {
    need(row[`option_${l}`], `option_${l}`)
    need(row[`option_${l}_ta`], `option_${l}_ta`)
  }
  if (!['A', 'B', 'C', 'D'].includes(row.correct_answer)) {
    problems.push(`correct_answer is "${row.correct_answer}"`)
  }
  need(row.explanation, 'explanation')
  need(row.explanation_ta, 'explanation_ta')
  // The winning option must not also be listed as a wrong one.
  if (row.why_wrong && row.why_wrong[row.correct_answer]) {
    problems.push('why_wrong contains the correct letter')
  }
  // Four distinct options — a duplicated option makes the key ambiguous.
  const opts = ['a', 'b', 'c', 'd'].map((l) => String(row[`option_${l}`] ?? '').trim())
  if (new Set(opts).size !== 4) problems.push('duplicate English options')
  const optsTa = ['a', 'b', 'c', 'd'].map((l) => String(row[`option_${l}_ta`] ?? '').trim())
  if (new Set(optsTa).size !== 4) problems.push('duplicate Tamil options')
  if (rec && Number(rec.q_no) !== Number(String(row.external_id).slice(-3))) {
    problems.push('external_id does not match q_no')
  }
  return problems
}
