// ─── Core domain types ──────────────────────────────────────────────────────

import type { StringKey } from '../lib/i18n'

/**
 * A language-neutral piece of a test heading. Producers emit these instead of a
 * baked string so describeConfig() can resolve them against the CURRENT language
 * at render time - the heading then follows the EN/தமிழ்/both toggle live,
 * instead of freezing whichever language was active when the test was set up.
 */
export type QuizLabelSeg =
  | string // literal, language-neutral (e.g. "PYQ", a month name)
  | { t: StringKey } // a translation key
  | { subject: string } // subject name, resolved via subjectName(lang)
  | { topic: string } // topic name, resolved via topicName(lang)

/** A single Thirukkural couplet with all renderings + classical commentaries. */
export interface Kural {
  kural_no: number
  paal_no: number
  paal_ta: string
  paal_en: string
  iyal_no: number
  iyal_ta: string
  iyal_en: string
  adhigaram_no: number
  adhigaram_ta: string
  adhigaram_en: string
  adhigaram_translit: string
  line1_ta: string
  line2_ta: string
  transliteration: string
  couplet_en: string
  translation_en: string
  explanation_en: string
  urai_mu_varadarajan: string
  urai_solomon_pappaiya: string
  urai_mu_karunanidhi: string
}

export type Category =
  | 'pyq'
  // Group 2 / 2A previous-year bank (separate from the Group 1 'pyq' bank).
  | 'pyq2'
  // Group 4 / VAO previous-year bank. Same section-wise shape as 'pyq2'; both
  // are driven by the PYQ_GROUPS registry in lib/constants.
  | 'pyq4'
  | 'samacheer'
  | 'current_affairs'
  | 'aptitude'
  | 'outer'
  | 'subject'
  // Thirukkural quiz - a client-side bank (questions bundled with the app and
  // graded in the browser); it never touches the server question pipeline.
  | 'thirukural'
// The five question styles testable in the Subject Practice flow.
export type SubjectQType = 'chronological' | 'match' | 'assertion_reason' | 'statements' | 'direct'
export type GroupType = 'Group1' | 'Group2_2A' | 'Group4_VAO'
// Most banks are 4-option (A-D). A few imported sets (e.g. the IndiaBix analogy
// reasoning bank) carry a 5th option E - `option_e` is null on every 4-option
// row, and optionLetters() only surfaces E when that row actually has it.
export type AnswerLetter = 'A' | 'B' | 'C' | 'D' | 'E'
export type Difficulty = 'easy' | 'medium' | 'hard'
// Role hierarchy: superadmin ⊃ admin ⊃ user. A superadmin inherits every admin
// ability (the DB `is_admin()` check is widened to include it) and additionally
// owns the platform console (metrics, user management, feedback inbox).
export type UserRole = 'user' | 'admin' | 'superadmin'

export interface Question {
  id: string
  category: Category
  group_type?: GroupType
  year?: number
  standard?: number
  ca_month?: string
  ca_year?: number
  // 'day_wise' rows come from the daily CA drop (ca_daily_questions), served
  // only by the daily-test endpoints — never by the main bank sampler.
  ca_type?: 'topic_wise' | 'month_wise' | 'day_wise'
  ca_topic?: string
  // numerics/reasoning are the practice-bank types; data_interpretation +
  // general_studies come from the GOV (TNPSC Group I Mains) bank.
  aptitude_type?: 'numerics' | 'reasoning' | 'data_interpretation' | 'general_studies'
  aptitude_topic?: string
  subject?: string
  // Broad unit/section grouping above topic. Used by the "Outer" subject banks
  // (e.g. unit 'Polity', topic 'Fundamental Rights').
  unit?: string
  topic?: string
  // Subject Practice style tag (chronological / match / assertion_reason / …).
  question_type?: string
  // Short provenance marker (e.g. 'TU') - rendered as a small badge when set.
  source_tag?: string | null
  // Whether the question is shown to students. false = hidden from quizzes/
  // revision but still visible in the admin bank. Only populated on admin reads.
  active?: boolean
  question_text: string
  // Ordered public URLs of figures that belong to the question stem (diagrams
  // for dice/seating/figure-counting items). Hosted in the Supabase Storage
  // `question-images` bucket; rendered with the question, never gated.
  images?: string[] | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // Per-option figures (letter → public image URL) for image-option questions
  // (e.g. non-verbal "pick the next figure"). When a letter has one, its option
  // button renders the figure; letters without one fall back to their text.
  option_images?: Partial<Record<AnswerLetter, string>> | null
  // Optional 5th option - present only on 5-option imports (analogy reasoning
  // bank). Null/absent on every standard 4-option question.
  option_e?: string | null
  // Answer/explanation columns are NOT delivered to the client during a quiz
  // (they're stripped server-side). They're only populated for the admin bank
  // and merged in after a result is graded - hence optional.
  correct_answer?: AnswerLetter
  explanation?: string
  // Optional YouTube video URL for the explanation. Set by admins; rendered as an
  // embedded player wherever the explanation shows. Delivered via the same gated
  // RPCs as `explanation` (never shipped with un-attempted quiz questions).
  explanation_video_url?: string | null
  // Per-option rationale: for each WRONG option letter, why it is incorrect.
  // Powers the targeted "your answer is wrong because…" feedback.
  why_wrong?: Partial<Record<AnswerLetter, string>> | null
  // Tamil counterpart of why_wrong (per wrong option), when available.
  why_wrong_ta?: Partial<Record<AnswerLetter, string>> | null
  difficulty?: Difficulty
  // Provenance of a scraped/imported question (admin-only; never shown to users).
  source_url?: string | null
  // Optional Tamil content (bilingual-ready). When present and the user's
  // language is Tamil/both, the UI renders these instead of/alongside English.
  question_text_ta?: string | null
  option_a_ta?: string | null
  option_b_ta?: string | null
  option_c_ta?: string | null
  option_d_ta?: string | null
  option_e_ta?: string | null
  explanation_ta?: string | null
}

export interface TestSession {
  id: string
  user_id: string
  category: string
  group_type?: string
  subject?: string
  standard?: number
  ca_month?: string
  ca_type?: string
  aptitude_type?: string
  aptitude_topic?: string
  total_questions: number
  attempted: number
  correct: number
  score_percentage: number
  pdf_unlocked: boolean
  passed_80_percent: boolean
  time_limit_seconds: number
  time_taken_seconds?: number
  started_at: string
  completed_at?: string
  status: 'in_progress' | 'completed' | 'abandoned'
}

export interface TestAnswer {
  question_id: string
  selected_answer: AnswerLetter
  // Unknown until the server grades the submission (the client has no answer key).
  is_correct?: boolean
  time_spent_seconds: number
  flagged?: boolean
}

// Per-question result returned by the `submit_test` RPC. correct_answer /
// explanation fields are only present when the attendance gate (>=25%) unlocked
// them. NOTE: the `passed_80*` field names are historical - the gate is 25%.
export interface GradedResult {
  question_id: string
  selected_answer: AnswerLetter | null
  is_correct: boolean
  correct_answer?: AnswerLetter | null
  explanation?: string | null
  explanation_ta?: string | null
  explanation_video_url?: string | null
  why_wrong?: Partial<Record<AnswerLetter, string>> | null
}

// Shape of the whole `submit_test` RPC response.
export interface SubmitResult {
  session_id: string
  total: number
  attempted: number
  correct: number
  score_percentage: number
  passed_80: boolean
  unlocked: boolean
  results: GradedResult[]
  /** Set by the API's topic-revision hook (see server/routes/tests.ts). */
  revision?: RevisionInfo
  /** Set once ever, when this submit graded the user's FIRST completed test. */
  first_test_bonus?: { amount: number; balance: number }
}

// ─── Topic revision (study-gate + similar-question re-tests) ────────────────

export type RevisionStatus = 'locked' | 'available' | 'cleared'

/** The summary the submit response carries so the Result page can react. */
export interface RevisionInfo {
  /** A low-scoring topic test was saved (or re-saved) to Revisions. */
  enqueued?: boolean
  /** A passing re-attempt cleared an existing revision. */
  cleared?: boolean
  status?: RevisionStatus
  /** ISO instant the re-test unlocks (awake-hours aware). */
  available_at?: string
  label?: string
}

/** One saved topic revision (list_revision_topics row + derived status). */
export interface RevisionTopic {
  id: string
  topic_key: string
  config: QuizConfig
  label: string | null
  first_score: number
  last_score: number
  best_score: number
  attempts: number
  available_at: string
  cleared_at: string | null
  last_session_id: string | null
  created_at: string
  status: RevisionStatus
}

export interface RevisionSubjectStat {
  subject: string
  count: number
  avg_score: number
}

export interface RevisionFocusItem {
  id: string
  label: string | null
  last_score: number
  best_score: number
  attempts: number
  status: RevisionStatus
}

/** Pure-logic aggregates for the revision dashboard (revision_analytics RPC). */
export interface RevisionAnalytics {
  total: number
  cleared: number
  pending: number
  available_now: number
  locked: number
  total_attempts: number
  avg_last_score: number
  avg_best_score: number
  improvement: number
  by_subject: RevisionSubjectStat[]
  focus: RevisionFocusItem[]
}

export interface QuizConfig {
  category: Category
  group_type?: string
  subject?: string
  standard?: number
  topic?: string
  /**
   * Broad unit/section filter (the `questions.unit` column). Used by the PYQ
   * History selector to scope a test to one period - 'ancient' | 'medieval' |
   * 'modern' (the 214 History PYQs are tagged this way).
   */
  unit?: string
  /** Group 2 PYQ: scope a test to one exam year (omit for "All years"). */
  year?: number
  /** Subject Practice: restrict to one question style (omit for "Mixed"). */
  question_type?: SubjectQType
  /** Difficulty filter (easy/medium/hard) - used by subject/topic mock tests. */
  difficulty?: Difficulty
  ca_month?: string
  ca_type?: string
  ca_topic?: string
  aptitude_type?: string
  aptitude_topic?: string
  /**
   * Free-form heading, used when the label has no structured equivalent (mock
   * blueprint titles, daily/weekly drills, "Outer Questions"). For flows built
   * from subject/topic/type, prefer `labelParts` so the heading stays reactive
   * to the language toggle.
   */
  label?: string
  /**
   * Language-neutral heading segments (joined with " · "), resolved against the
   * current language by describeConfig(). Takes precedence over `label`.
   */
  labelParts?: QuizLabelSeg[]
  /** Mock-test mode: mixed questions, fixed duration, optional negative marking. */
  mock?: boolean
  mockQuestionCount?: number
  mockDurationSeconds?: number
  /** Practice quiz: user-chosen number of questions (caps the random pool). */
  questionCount?: number
  /**
   * Size of the available question pool for this config, when the originating
   * picker page already knows it (e.g. the PYQ/Subject counts shown on its
   * cards). Lets the pre-test setup screen render the slider bound instantly
   * instead of flashing a "counting…" state while it re-fetches.
   */
  availableCount?: number
  /** Practice quiz: user-chosen time limit in seconds (overrides the per-question default). */
  durationSeconds?: number
  /** Negative mark per wrong answer (e.g. 0.33 for -1/3). 0 = none. */
  negativeMark?: number
  /** For mock mode: restrict the random pool to `category` (e.g. daily CA). */
  scopeToCategory?: boolean
  /** Daily Current-Affairs challenge - completing it grants the daily reward. */
  daily?: boolean
  /** Weekly Current-Affairs consolidation drill. */
  weekly?: boolean
  /**
   * New-user Starter Challenge: the fixed hard mixed paper (every question
   * style + aptitude) served by /api/questions/starter-test instead of the
   * generic sampler.
   */
  starter?: boolean
  /**
   * Proctored mock-test mode. When set, the quiz runs through the dedicated
   * OMR-style engine (fullscreen, question palette, violation tracking) instead
   * of the regular timed quiz. `mockKind` distinguishes a full group-pattern
   * exam from a single subject/topic drill.
   */
  proctored?: boolean
  mockKind?: 'group' | 'subject' | 'exam' | 'series' | 'vettri'
  /** Which TNPSC group blueprint a group mock follows (2024/2025 pattern). */
  mockGroup?: GroupType
  /** A fixed full mock exam id ('exam1'..'exam6') when mockKind === 'exam'. */
  mockExamId?: string
  /** A scheduled test-series id ('test1'..'test13', or 'g2rb1'..'g2rb10' for
   *  Rank Booster) when mockKind === 'series'. */
  seriesTestId?: string
  /** Which test-series product `seriesTestId` belongs to. Defaults server-side
   *  to 'g1_marathon' when omitted, so this can stay unset for the original
   *  Test Marathon flow. */
  seriesKey?: 'g1_marathon' | 'g2a_rankbooster'
  /** A Vettri Nichayam exam id ('vettri1'..'vettri13') when mockKind === 'vettri'. */
  vettriExamId?: string
  /** Set when this quiz is a revision re-test (gates similar-question fetch). */
  revision?: boolean
  /** The revision_topics row id, threaded back through submit so a pass clears it. */
  revisionId?: string
  /**
   * Daily Current-Affairs test: the publishing materials row id of a superadmin-
   * approved daily set. Its questions live in `ca_daily_questions` (outside the
   * main bank), so this routes the draw AND the grading through
   * /api/ca-questions/daily/* instead of the generic quiz pipeline.
   */
  caDailyId?: string
  /** The daily set's day (YYYY-MM-DD) — heading + result copy only. */
  caDailyDate?: string
  /** Thirukkural quiz: the chosen adhigaram number (omitted = all chapters). */
  tkAdhigaram?: number
  /** Thirukkural quiz: the chosen question format (omitted = mixed). */
  tkFormat?: string
}

// ─── Mock-test blueprint (group-exam patterns) ──────────────────────────────

/** One subject slot in a group-exam blueprint (label + how many questions). */
export interface MockSlot {
  label: string
  count: number
}

/** A full group-exam template following the TNPSC 2024/2025 pattern. */
export interface MockBlueprint {
  id: GroupType
  title: string
  totalQuestions: number
  durationMinutes: number
  negativeMark: number
  slots: MockSlot[]
}

// ─── Full mock exams (fixed, named papers; tier + admin-enabled gated) ───────

/** One exam as seen by a student: access state + attempts already used. */
export interface MockExam {
  id: string
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  tier: 'free' | 'paid'
  /** True when the user can't start it yet (paid exam, not premium). */
  locked: boolean
  lockReason: 'premium' | null
  attemptsUsed: number
  attemptsMax: number
}

/** One exam row in the superadmin console (all exams, incl. disabled). */
export interface MockExamAdmin {
  id: string
  mock_set: number
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  tier: 'free' | 'paid'
  enabled: boolean
  sort_order: number
  /** Questions actually loaded for this set (should be total_questions). */
  loaded_questions: number
}

// ─── Vettri Nichayam bank (fixed paid 13-exam set, unlimited attempts) ───────

/** One Vettri exam as seen by a student. Whole bank is bundle-gated, no attempt cap. */
export interface VettriExam {
  id: string
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  /** True when the user hasn't unlocked the bundle (not premium/vettri). */
  locked: boolean
  lockReason: 'vettri' | null
}

/** One Vettri exam row in the superadmin console (all exams, incl. disabled). */
export interface VettriExamAdmin {
  id: string
  vettri_set: number
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  enabled: boolean
  sort_order: number
  /** Questions actually loaded for this set (should be total_questions). */
  loaded_questions: number
}

// ─── Test Series (scheduled Group 1 "Test Marathon 2026" papers) ─────────────

/** One scheduled test as seen by a student: access + schedule + attempts. */
export interface TestSeriesItem {
  id: string
  title: string
  title_ta: string | null
  unit_label: string | null
  unit_label_ta: string | null
  subjects_label: string | null
  subjects_label_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  /** Unlock date 'YYYY-MM-DD' (IST), or null. */
  scheduled_date: string | null
  /** 'free' = the try-before-you-enroll trial paper (open to everyone);
   *  'paid' = needs a paid bundle. */
  tier: 'free' | 'paid'
  /** True when the user can't start it yet (not premium, or before its date). */
  locked: boolean
  /** Why it's locked: 'premium' (whole series is paid) or 'date' (not yet open). */
  lockReason: 'premium' | 'date' | null
  attemptsUsed: number
  attemptsMax: number
}

/** One completed Test Marathon attempt (for the analytics tab). */
export interface TestSeriesAttempt {
  id: string
  test_id: string
  title: string
  title_ta: string | null
  unit_label: string | null
  unit_label_ta: string | null
  /** Score % as graded by the server. */
  score: number
  total: number
  correct: number | null
  attempted: number | null
  time_taken_seconds: number | null
  submitted_at: string | null
}

/** One graded answer, reduced to what the weak-area aggregation needs. */
export interface TestSeriesAnswerStat {
  is_correct: boolean | null
  subject: string | null
  topic: string | null
  /** Derived bucket: 'match' | 'assertion' | 'statement' | 'aptitude' | 'factual'. */
  qtype: string
}

/** Raw payload from GET /api/questions/test-series/analytics. */
export interface TestSeriesAnalyticsResponse {
  attempts: TestSeriesAttempt[]
  answers: TestSeriesAnswerStat[]
}

/** One test row in the superadmin console (all tests, incl. disabled). */
export interface TestSeriesAdmin {
  id: string
  test_set: number
  title: string
  title_ta: string | null
  unit_label: string | null
  subjects_label: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  scheduled_date: string | null
  enabled: boolean
  open_override: 'auto' | 'open' | 'closed'
  sort_order: number
  tier: 'free' | 'paid'
  /** Questions actually loaded for this set (should be total_questions). */
  loaded_questions: number
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  gender?: string
  target_group?: string
  role?: UserRole
  exam_date?: string | null
  daily_goal?: number | null
  /** Preferred UI language. Account-bound so it follows the user across devices
   * and is set ONCE at onboarding; changeable later from the Profile page. */
  language?: DisplayLang | null
  /** Profile picture URL - set from Google on Google sign-in; null otherwise. */
  avatar_url?: string | null
  /** Whether TOTP two-factor auth is active (admin/superadmin only). The
   * secret and backup codes themselves never leave the server. */
  totp_enabled?: boolean
}

// ─── Result payload passed via router state to /result ──────────────────────

export interface ResultPayload {
  config: QuizConfig
  questions: Question[]
  answers: Record<string, TestAnswer>
  totalQuestions: number
  attempted: number
  correct: number
  scorePercentage: number
  pdfUnlocked: boolean
  passed80: boolean
  timeLimitSeconds: number
  timeTakenSeconds: number
  sessionId?: string
  /** Topic-revision outcome of this test, surfaced as a notice on the Result page. */
  revision?: RevisionInfo
  /** First-completed-test credit reward, celebrated on the Result page. */
  firstTestBonus?: { amount: number; balance: number }
}

// The four options every bank has. Use optionLetters(q) when rendering so a
// 5th option (E) is included only for the questions that actually carry one.
export const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

/**
 * The answer letters to render for a specific question: always A-D, plus E when
 * the question has non-empty `option_e`. This keeps standard 4-option questions
 * from showing a blank fifth choice while letting 5-option items render in full.
 */
export function optionLetters(q: Question): AnswerLetter[] {
  return q.option_e != null && String(q.option_e).trim() !== '' ? [...LETTERS, 'E'] : LETTERS
}

export function optionText(q: Question, letter: AnswerLetter): string {
  switch (letter) {
    case 'A':
      return q.option_a
    case 'B':
      return q.option_b
    case 'C':
      return q.option_c
    case 'D':
      return q.option_d
    case 'E':
      return q.option_e ?? ''
  }
}

function optionTextTa(q: Question, letter: AnswerLetter): string | null | undefined {
  switch (letter) {
    case 'A':
      return q.option_a_ta
    case 'B':
      return q.option_b_ta
    case 'C':
      return q.option_c_ta
    case 'D':
      return q.option_d_ta
    case 'E':
      return q.option_e_ta
  }
}

export type DisplayLang = 'en' | 'ta' | 'both'

/**
 * Returns the question text to render for the given UI language. Falls back to
 * English when Tamil content isn't available. For 'both' it stacks EN + TA.
 */
export function displayQuestion(q: Question, lang: DisplayLang): string {
  const ta = q.question_text_ta?.trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${q.question_text}\n${ta}`
  return q.question_text
}

// ─── Match (List I / List II) parsing ───────────────────────────────────────
// "Match the following" questions store both lists inline in question_text as
// newline-separated lines, e.g.
//   <preamble>
//   List I (Extremity)
//   (a) Eastern extremity        ← subject style: (a)-(d)
//   ...
//   List II (Place)
//   1. Hills of Anaimalai        ← 1.-4.
//   ...
//   Select the correct match.    ← optional trailing prompt
// (current-affairs style uses "List I:" with A.-D. labels.) Rendering this as a
// single pre-wrapped blob stacks the two lists vertically; parsing it lets the
// UI lay List I and List II out side-by-side like the printed exam paper.

export interface MatchItem {
  /** Raw label token, e.g. 'a' or 'A' or '1'. */
  label: string
  text: string
}
export interface MatchList {
  /** Full header line as authored, e.g. 'List I (Extremity)'. */
  header: string
  items: MatchItem[]
}
export interface ParsedMatch {
  preamble: string
  listI: MatchList
  listII: MatchList
  /** Trailing prompt after List II, e.g. 'Select the correct match.'. */
  trailing: string
}

// Real questions label their two lists in many ways: List I = (a)-(d) with List
// II = 1-4, the reverse (1-4 with List II = (p)-(s)/(A)-(D)), "Column A/B", Tamil
// "பட்டியல்/நிரல்/பத்தி", items one-per-line or several inline on one row, and
// sometimes a side-by-side "(a) X    1. Y" layout. parseMatchQuestion therefore
// tries (1) a header-anchored pass - find the two list headers and take whatever
// labelled items sit under each, regardless of label family - then (2) the
// side-by-side single-line layout, then (3) the older letter-run/number-run
// heuristic. The first pass that yields two lists of >=2 items wins; everything
// else falls back to plain text.

// A label token inside an item: roman (ii-iv), a single letter, 1-2 digits, or a
// Tamil vowel. Single letter (not {1,2}) so a word like "Ma" can't look like one.
const MATCH_LABEL = String.raw`[ivxlcdm]{2,4}|[IVXLCDM]{2,4}|[A-Za-z]|\d{1,2}|[அ-ஔ]`

// Matches each "(label) text" item on a line. An item ends where the next one
// begins - a parenthesised label after a single space ("(a) X (b) Y") or a bare
// label after two+ spaces ("1. X  2. Y") - so multiple inline items split apart
// while a parenthesised word inside the text (e.g. "(steered)") does not.
const MATCH_ITEM_G = new RegExp(
  String.raw`\(?\s*(${MATCH_LABEL})\s*[).]\s+(.+?)(?=\s+\(\s*(?:${MATCH_LABEL})\s*\)|\s{2,}\(?\s*(?:${MATCH_LABEL})\s*[).]\s|$)`,
  'g',
)

// Single item line (run-based fallback): letters → List I, numbers → List II.
const MATCH_ITEM = /^\(?\s*([ivxlcdm]{1,4}|[IVXLCDM]{1,4}|[A-Za-z]{1,2}|\d{1,2}|[அ-ஔ])\s*[).]\s*(.+)$/

// Header words that introduce a list, in English and Tamil. "List II" is tried
// before "List I" via the (II|I|…) alternation so the longer token wins; "A"/"B"
// cover "Column A"/"Column B" (mapped to List I/List II).
const LIST_KEYWORDS = String.raw`List|Column|பட்டியல்|நெடுவரிசை|நிரல்|பத்தி`
const MATCH_HEADER = new RegExp(String.raw`^(${LIST_KEYWORDS})\s*[-–]?\s*(II|I|2|1|A|B)\b(.*)$`, 'i')

/** A line that is a prompt/instruction ("Match the following…"), not a header. */
const isMatchPrompt = (s: string): boolean =>
  /\b(match|following|select|correct|codes|given below|use:|பொருத்த|தேர்ந்தெடு)\b/i.test(s)

// A line enumerating answer codes ("(A) 1-P, 2-Q, 3-R, 4-S") rather than a list
// item - we stop collecting List II items once we reach it.
const isMatchCodeLine = (s: string): boolean =>
  /[A-Za-z0-9]\s*[-–—]\s*[A-Za-z0-9]\s*[,;]/.test(s) ||
  /(\b[A-Za-z0-9]\s*[-–—]\s*[A-Za-z0-9]\b[^A-Za-z0-9]*){3,}/.test(s)

interface ParsedHeader {
  which: 'I' | 'II'
  /** Original header for display, e.g. "List I", "Column A", "பட்டியல் II (City)". */
  label: string
  /** Inline item text trailing the header, e.g. the "(A) Maltose …" after "List I:". */
  rest: string
}
function parseListHeader(line: string): ParsedHeader | null {
  const m = line.match(MATCH_HEADER)
  if (!m) return null
  const tok = m[2].toUpperCase()
  const which = tok === 'II' || tok === '2' || tok === 'B' ? 'II' : 'I'
  let rest = (m[3] ?? '').replace(/^\s*:\s*/, '')
  // A parenthesised annotation right after the header ("List I (Person)") - but
  // not a lone item label like "(A)", which the {1,40} length guard excludes.
  let annotation = ''
  const am = rest.match(/^\(([A-Za-z][^)]{1,40})\)\s*:?\s*(.*)$/)
  if (am) {
    annotation = am[1].trim()
    rest = am[2]
  }
  const label = `${m[1]} ${m[2]}`.replace(/\s+/g, ' ') + (annotation ? ` (${annotation})` : '')
  return { which, label, rest: rest.trim() }
}

function extractMatchItems(text: string): MatchItem[] {
  const items: MatchItem[] = []
  let m: RegExpExecArray | null
  MATCH_ITEM_G.lastIndex = 0
  while ((m = MATCH_ITEM_G.exec(text))) items.push({ label: m[1], text: m[2].trim() })
  return items
}

// Collect the labelled items for one list: any leftover text on the header line,
// then following lines until an answer-code line or a non-item (prose) line.
function collectMatchRegion(leftover: string, lines: string[], from: number, to: number): MatchItem[] {
  const items: MatchItem[] = []
  if (leftover.trim()) items.push(...extractMatchItems(leftover.trim()))
  for (let i = from; i < to; i++) {
    const ln = lines[i]
    if (!ln) continue
    if (isMatchCodeLine(ln)) break
    const got = extractMatchItems(ln)
    if (got.length) items.push(...got)
    else if (items.length) break // a prose line after the items ends the list
  }
  return items
}

/**
 * Primary pass: two list headers ("List I"/"List II", "Column A"/"Column B",
 * Tamil equivalents) each followed by >=2 labelled items, regardless of whether a
 * list uses letters, numbers, P-S or Tamil labels.
 */
function parseHeaderAnchoredMatch(lines: string[]): ParsedMatch | null {
  let iI = -1
  let iII = -1
  let hI: ParsedHeader | undefined
  let hII: ParsedHeader | undefined
  for (let i = 0; i < lines.length; i++) {
    const h = parseListHeader(lines[i])
    if (!h) continue
    if (h.which === 'I' && iI < 0) {
      iI = i
      hI = h
    } else if (h.which === 'II' && iII < 0) {
      iII = i
      hII = h
    }
  }
  if (iI < 0 || iII < 0 || iII <= iI || !hI || !hII) return null
  const listI = collectMatchRegion(hI.rest, lines, iI + 1, iII)
  let end = lines.length
  for (let i = iII + 1; i < lines.length; i++) {
    if (isMatchCodeLine(lines[i])) {
      end = i
      break
    }
  }
  const listII = collectMatchRegion(hII.rest, lines, iII + 1, end)
  if (listI.length < 2 || listII.length < 2) return null
  return {
    preamble: lines.slice(0, iI).join(' ').trim(),
    listI: { header: hI.label, items: listI },
    listII: { header: hII.label, items: listII },
    trailing: '',
  }
}

/**
 * Side-by-side pass: each line carries a List I item and its List II counterpart,
 * split by a pipe, 2+ spaces or a spaced dash - e.g. "(a) Corn    1. Cotyledon"
 * or "1. Scheme - a. Purpose". `reversed` handles the number-then-letter order.
 * The required label-with-")"/"." after the separator stops a hyphen inside item
 * text (e.g. "Heart-lung machine") from splitting the line. Returns null when
 * fewer than two rows match or the List II labels aren't distinct.
 */
function parseSideBySideMatch(lines: string[], reversed: boolean): ParsedMatch | null {
  const l1 = reversed ? String.raw`\d{1,2}` : String.raw`[A-Za-z]{1,4}|[அ-ஔ]`
  const l2 = reversed ? String.raw`[A-Za-z]{1,2}|[அ-ஔ]` : String.raw`\d{1,2}`
  const re = new RegExp(
    String.raw`^\(?\s*(${l1})\s*[).]\s+(.+?)\s*(?:\||\s{2,}|\s[-–—]\s)\s*\(?\s*(${l2})\s*[).]\s+(.+?)\s*$`,
  )
  const rowIdx: number[] = []
  const listI: MatchItem[] = []
  const listII: MatchItem[] = []
  for (let idx = 0; idx < lines.length; idx++) {
    const m = lines[idx].match(re)
    if (!m) continue
    rowIdx.push(idx)
    listI.push({ label: m[1], text: m[2].trim() })
    listII.push({ label: m[3], text: m[4].trim() })
  }
  if (listI.length < 2) return null
  const labels = listII.map((i) => i.label)
  if (new Set(labels).size !== labels.length) return null

  const first = rowIdx[0]
  const last = rowIdx[rowIdx.length - 1]
  // A header is the line directly above the first row, when it isn't a row or a
  // prompt sentence. Split it into the two column headers.
  let headerLine = -1
  if (first > 0 && !lines[first - 1].match(re) && !isMatchPrompt(lines[first - 1])) {
    headerLine = first - 1
  }
  let hI = ''
  let hII = ''
  if (headerLine >= 0) {
    const parts = lines[headerLine]
      .split(/\s*\|\s*|\s{2,}|\s+[-–—]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    hI = parts[0] ?? lines[headerLine]
    hII = parts[1] ?? ''
  }
  const preEnd = headerLine >= 0 ? headerLine : first
  return {
    preamble: lines.slice(0, preEnd).join(' ').trim(),
    listI: { header: hI, items: listI },
    listII: { header: hII, items: listII },
    trailing: lines.slice(last + 1).join(' ').trim(),
  }
}

interface ClassifiedLine {
  label: string
  text: string
}
function classifyMatchLine(line: string): ClassifiedLine | null {
  const m = line.match(MATCH_ITEM)
  if (!m) return null
  return { label: m[1], text: m[2].trim() }
}

// ─── Label families ─────────────────────────────────────────────────────────
// A list is labelled from ONE family, and the paper picks the family freely:
// (a)-(d), 1-4, (i)-(iv), (p)-(s), Tamil vowels. Either list can use any of
// them, in either order — an earlier version assumed "letters first, then
// numbers" and silently fell back to plain text on everything else (numbers
// first, or a roman-numeral second list, both common in the PYQ banks).

type MatchFamily = 'num' | 'roman' | 'alpha' | 'tamil'
const MATCH_FAMILIES: MatchFamily[] = ['num', 'roman', 'alpha', 'tamil']
const TAMIL_VOWELS = 'அஆஇஈஉஊஎஏஐஒஓஔ'
const ROMAN_DIGITS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }

/** Value of a roman numeral ('iv' → 4), or null if it isn't one. */
function romanValue(s: string): number | null {
  if (!/^[ivxlcdm]{1,4}$/i.test(s)) return null
  const d = s.toLowerCase().split('').map((ch) => ROMAN_DIGITS[ch])
  let total = 0
  for (let i = 0; i < d.length; i++) total += d[i] < d[i + 1] ? -d[i] : d[i]
  return total > 0 ? total : null
}

/** The label's position within a family, or null when it doesn't belong to it. */
function ordinalIn(family: MatchFamily, label: string): number | null {
  switch (family) {
    case 'num':
      return /^\d{1,2}$/.test(label) ? Number(label) : null
    case 'roman':
      return romanValue(label)
    case 'alpha': {
      if (!/^[A-Za-z]$/.test(label)) return null
      return label.toLowerCase().charCodeAt(0) - 96
    }
    case 'tamil': {
      const i = TAMIL_VOWELS.indexOf(label)
      return i < 0 ? null : i + 1
    }
  }
}

/**
 * Every family in which these labels form a consecutive run ((a)(b)(c),
 * (ii)(iii)(iv), 3-4-5…), paired with the run's starting ordinal. A label can
 * belong to several families at once — 'i' is both roman 1 and the 9th letter,
 * 'c' both roman 100 and the 3rd — so the caller picks between the candidates
 * rather than committing per label.
 */
function familiesOf(labels: string[]): { family: MatchFamily; start: number }[] {
  const out: { family: MatchFamily; start: number }[] = []
  for (const family of MATCH_FAMILIES) {
    const ords = labels.map((l) => ordinalIn(family, l))
    if (ords.some((o) => o === null)) continue
    const nums = ords as number[]
    if (nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)) out.push({ family, start: nums[0] })
  }
  return out
}

/** Do these labels read as ONE list (a single consecutive run in some family)? */
function isSingleList(labels: string[]): boolean {
  return familiesOf(labels).length > 0
}

/**
 * Where a single block of labels breaks into two lists, or -1. The two halves
 * must each be a consecutive run, and must either use different families
 * ((a)-(d) then (i)-(iv)) or restart the numbering (1-4 then 1-4). Splits are
 * tried from the balanced midpoint outwards, so an ambiguous block splits the
 * way the paper prints it — evenly.
 */
function findListSplit(labels: string[]): number {
  const n = labels.length
  if (n < 4) return -1
  const order = Array.from({ length: n - 3 }, (_, i) => i + 2).sort(
    (a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2)
  )
  for (const k of order) {
    for (const a of familiesOf(labels.slice(0, k))) {
      for (const b of familiesOf(labels.slice(k))) {
        if (a.family !== b.family || b.start <= a.start) return k
      }
    }
  }
  return -1
}

// A fill-in-the-blank stem ("1. Ring her ____ and tell her") followed by the
// word bank ((a) out (b) in …) has the shape of a two-list match but is not one.
// The blank itself is the tell, and it is one no real match item carries.
const FILL_IN_BLANK = /_{3,}/

/**
 * Fallback pass for header-less bodies. The two lists are contiguous runs of
 * labelled items in ANY two label families, in either order — (a)-(d) then
 * (1)-(4), 1-4 then a-d, (a)-(d) then (i)-(iv). They may be separated by a
 * plain line, which becomes that list's header ("Schedule"/"Awarder"), or run
 * straight on from each other, in which case the block is split where the
 * family or the numbering restarts. A full prompt sentence is the preamble,
 * not a header.
 */
function parseRunBasedMatch(lines: string[]): ParsedMatch | null {
  if (lines.length < 5) return null
  const cls = lines.map(classifyMatchLine)

  // Maximal contiguous runs of labelled item lines.
  const runs: { start: number; end: number }[] = []
  for (let i = 0; i < cls.length; i++) {
    if (!cls[i]) continue
    const start = i
    while (i + 1 < cls.length && cls[i + 1]) i++
    runs.push({ start, end: i })
  }
  const usable = runs.filter((r) => r.end - r.start + 1 >= 2)
  if (!usable.length) return null

  const labelsOf = (r: { start: number; end: number }) =>
    cls.slice(r.start, r.end + 1).map((c) => c!.label)
  const itemsOf = (from: number, to: number): MatchItem[] =>
    cls.slice(from, to + 1).map((c) => ({ label: c!.label, text: c!.text }))

  let a: { from: number; to: number }
  let b: { from: number; to: number }

  if (usable.length >= 2) {
    // Two runs with something between them (a header line, or a prompt).
    const [r1, r2] = usable
    if (!isSingleList(labelsOf(r1)) || !isSingleList(labelsOf(r2))) return null
    a = { from: r1.start, to: r1.end }
    b = { from: r2.start, to: r2.end }
  } else {
    // One unbroken block holding both lists back-to-back.
    const r = usable[0]
    const k = findListSplit(labelsOf(r))
    if (k < 0) return null
    a = { from: r.start, to: r.start + k - 1 }
    b = { from: r.start + k, to: r.end }
  }

  const listIItems = itemsOf(a.from, a.to)
  const listIIItems = itemsOf(b.from, b.to)
  if (listIItems.length < 2 || listIIItems.length < 2) return null
  if (listIItems.some((i) => FILL_IN_BLANK.test(i.text))) return null

  const headerAbove = (start: number): number =>
    start > 0 && !cls[start - 1] && !isMatchPrompt(lines[start - 1]) ? start - 1 : -1
  const hI = headerAbove(a.from)
  const hII = headerAbove(b.from)

  return {
    preamble: lines.slice(0, hI >= 0 ? hI : a.from).join(' ').trim(),
    listI: { header: hI >= 0 ? lines[hI] : '', items: listIItems },
    listII: { header: hII >= 0 ? lines[hII] : '', items: listIIItems },
    trailing: lines.slice(b.to + 1).join(' ').trim(),
  }
}

// The separator in an already-paired line: a spaced dash or a pipe. Spacing is
// required so a hyphenated term ("Heart-lung machine") is never a split point.
const PAIR_SEP = /\s+[-–—]\s+|\s*\|\s*/

/**
 * Last pass: the pairs are already made, one per line — "(1) NHRC – 1993",
 * "(i) Hematite Ore - Oxide of iron". These are the "which pair is wrongly
 * matched?" items, and the paper prints them as two columns like any other
 * match, so we lay them out that way instead of dropping to a flat paragraph.
 * The right-hand column carries no label of its own (the left one numbers the
 * row), and a header line above splits on the same separator.
 */
function parsePairedMatch(lines: string[]): ParsedMatch | null {
  const listI: MatchItem[] = []
  const listII: MatchItem[] = []
  const rowIdx: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = classifyMatchLine(lines[i])
    if (!m) {
      if (rowIdx.length) break // the run of pairs has ended
      continue
    }
    const at = m.text.search(PAIR_SEP)
    const sep = m.text.match(PAIR_SEP)
    if (at <= 0 || !sep) return null // an item line that isn't a pair → not this shape
    const left = m.text.slice(0, at).trim()
    const right = m.text.slice(at + sep[0].length).trim()
    if (!left || !right) return null
    rowIdx.push(i)
    listI.push({ label: m.label, text: left })
    listII.push({ label: '', text: right })
  }
  if (listI.length < 3) return null // 2 rows is too thin to be sure of the shape
  if (!isSingleList(listI.map((i) => i.label))) return null
  if (listI.some((i) => FILL_IN_BLANK.test(i.text))) return null

  // A header directly above the first pair, itself split by the separator
  // ("Commission – Year of Establishment"). A prompt sentence is the preamble.
  const first = rowIdx[0]
  let hI = ''
  let hII = ''
  let headerLine = -1
  if (first > 0 && !isMatchPrompt(lines[first - 1])) {
    const parts = lines[first - 1].split(PAIR_SEP).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 2) {
      headerLine = first - 1
      ;[hI, hII] = parts
    }
  }
  return {
    preamble: lines.slice(0, headerLine >= 0 ? headerLine : first).join(' ').trim(),
    listI: { header: hI, items: listI },
    listII: { header: hII, items: listII },
    trailing: lines.slice(rowIdx[rowIdx.length - 1] + 1).join(' ').trim(),
  }
}

/**
 * Parse a "Match the following" question body into its two lists, trying the
 * header-anchored, side-by-side and run-based passes in turn. Returns null when
 * the text isn't a recognisable two-list match (callers then fall back to plain
 * text). Operates on a single language's raw text - for bilingual display, call
 * once per language string.
 */
export function parseMatchQuestion(text: string | null | undefined): ParsedMatch | null {
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    parseHeaderAnchoredMatch(lines) ||
    parseSideBySideMatch(lines, false) ||
    parseSideBySideMatch(lines, true) ||
    parseRunBasedMatch(lines) ||
    parsePairedMatch(lines)
  )
}

/** Format a parsed match label for display: letters as "(a)", numbers as "1.". */
export function formatMatchLabel(label: string): string {
  return /^\d+$/.test(label) ? `${label}.` : `(${label})`
}

/** Same fallback logic for an individual option. */
export function displayOption(q: Question, letter: AnswerLetter, lang: DisplayLang): string {
  const en = optionText(q, letter)
  const ta = optionTextTa(q, letter)?.toString().trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${en} / ${ta}`
  return en
}

/** Explanation with the same fallback. */
/**
 * Strip a leading correctness marker ("Correct." / "சரி.") that prefixes many
 * stored explanations - it's redundant since the option is already shown as the
 * answer, and reads awkwardly under the "Explanation:" label.
 */
function stripCorrectPrefix(text: string): string {
  return text.replace(/^\s*(correct|சரி)\s*[.:\---]\s*/i, '')
}

export function displayExplanation(q: Question, lang: DisplayLang): string {
  const en = stripCorrectPrefix(q.explanation ?? '')
  const ta = stripCorrectPrefix(q.explanation_ta?.trim() ?? '')
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${en}\n${ta}`
  return en
}

/** Why a specific (wrong) option is incorrect, if we have it. */
export function whyWrongFor(q: Question, letter: AnswerLetter): string {
  const reason = q.why_wrong?.[letter]
  return reason ? reason.trim() : ''
}
