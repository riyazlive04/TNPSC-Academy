// ─── The shape the public question archive is organised in ───────────────────
// The archive follows the TNPSC Group 1 2026 PRELIMINARY paper: the same eight
// subject units, in the same order, carrying the same per-unit question weights
// that src/lib/answerKeyGroups.ts publishes on the answer-key pages. Keeping
// one source of truth for those names matters for search — a visitor who found
// the answer-key page and a visitor who found a single question should see the
// same vocabulary, and Google should see one consistent site, not two.
//
// `subject` in the questions table was never normalised to these eight names
// (it grew bank by bank: 'History and INM', 'Biology', 'Polity', …), so each
// unit carries an alias list and resolveUnit() maps a row onto a unit. Anything
// that matches nothing lands in UNIT_OTHER and the build prints it — an
// unmapped subject is a bug in this file, not a reason to drop the questions.
//
// The archive covers Group 2 / 2A and Group 4 as well, and those papers have
// sections the Group 1 prelims syllabus does not: a Tamil paper and an English
// paper. They get units of their own with no 2026 weight, the same way current
// affairs does — a student searching 'tnpsc group 2 tamil questions' is looking
// for a real thing, and burying 2,300 language questions in a catch-all would
// waste them.

/** Weights are the 2026 prelims paper's own; they sum to 200. */
export const UNITS = [
  {
    key: 'indian-polity',
    en: 'Indian Polity',
    ta: 'இந்திய அரசியலமைப்பு',
    weight: 44,
    aliases: ['polity', 'indian polity', 'indian constitution', 'constitution', 'civics'],
  },
  {
    key: 'tamil-nadu-history',
    en: 'Tamil Nadu History, Culture & Socio-Political Movements',
    ta: 'தமிழ்நாட்டின் வரலாறு, பண்பாடு & சமூக-அரசியல் இயக்கங்கள்',
    weight: 44,
    aliases: [
      'history culture heritage of tn',
      'history culture and heritage of tn',
      'tamil nadu history',
      'tn history',
      'tamilnadu history',
      'history culture heritage of tamilnadu',
      'socio political movements',
      'tamil society',
      // Group 2 / 4 general-studies sections file heritage questions under a
      // bare 'Culture', and this unit is the one that carries culture.
      'culture',
    ],
  },
  {
    key: 'economy',
    en: 'Indian Economy & Development Administration in TN',
    ta: 'இந்தியப் பொருளாதாரம் & தமிழக வளர்ச்சி நிர்வாகம்',
    weight: 36,
    aliases: [
      'indian economy',
      'economy',
      'economics',
      'development administration of tamilnadu',
      'development administration of tn',
      'development administration',
    ],
  },
  {
    key: 'indian-history',
    en: 'Indian History & National Movement',
    ta: 'இந்திய வரலாறு & தேசிய இயக்கம்',
    weight: 26,
    aliases: [
      'history and inm',
      'history and indian national movement',
      'indian history',
      'history',
      'indian national movement',
      'inm',
    ],
  },
  {
    key: 'general-science',
    en: 'General Science',
    ta: 'பொது அறிவியல்',
    weight: 13,
    aliases: [
      'general science',
      'science',
      'biology',
      'physics',
      'chemistry',
      'botany',
      'zoology',
      'science and technology',
    ],
  },
  {
    key: 'geography',
    en: 'Geography of India',
    ta: 'இந்தியப் புவியியல்',
    weight: 11,
    aliases: ['geography', 'indian geography', 'geography of india', 'physical geography'],
  },
  {
    key: 'aptitude',
    en: 'Aptitude',
    ta: 'திறனறிவு',
    weight: 19,
    aliases: ['aptitude', 'numerics', 'numerical aptitude', 'maths', 'mathematics', 'quantitative aptitude'],
  },
  {
    key: 'reasoning',
    en: 'Reasoning',
    ta: 'தருக்க அறிவு',
    weight: 7,
    aliases: ['reasoning', 'logical reasoning', 'mental ability', 'verbal reasoning'],
  },
]

/** Current affairs sits outside the eight units — the 2026 paper spreads it
 *  across them rather than giving it a weight of its own, but the bank keeps it
 *  as one body of questions and students search it that way. */
export const UNIT_CURRENT_AFFAIRS = {
  key: 'current-affairs',
  en: 'Current Affairs',
  ta: 'நடப்பு நிகழ்வுகள்',
  weight: null,
  aliases: ['current affairs', 'current_affairs', 'ca', 'current affairs and gk', 'gk'],
}

/** The Tamil paper of Group 2 / 2A and Group 4. Not a Group 1 prelims unit, so
 *  it carries no 2026 weight, but it is 1,392 questions people search for. */
export const UNIT_TAMIL = {
  key: 'tamil',
  en: 'Tamil',
  ta: 'தமிழ்',
  weight: null,
  aliases: ['tamil', 'tamil language', 'pothu tamil', 'general tamil'],
}

/** The English paper of Group 2 / 2A. */
export const UNIT_ENGLISH = {
  key: 'english',
  en: 'English',
  ta: 'ஆங்கிலம்',
  weight: null,
  aliases: ['english', 'english language', 'general english'],
}

/** Last resort so no question is ever silently dropped. The build fails loudly
 *  (prints every subject that landed here) rather than publishing a page nobody
 *  can find their way to. */
export const UNIT_OTHER = {
  key: 'general-studies',
  en: 'General Studies',
  ta: 'பொதுப் படிப்பு',
  weight: null,
  aliases: [],
}

export const ALL_UNITS = [...UNITS, UNIT_TAMIL, UNIT_ENGLISH, UNIT_CURRENT_AFFAIRS, UNIT_OTHER]

/**
 * Subjects that say nothing. The Group 2 and Group 4 banks file ~1,375 rows
 * under a bare 'General Studies', but their `topic` carries the real subject —
 * 'History', 'Polity', 'Economics', 'Physics' and so on, which are exactly the
 * names the units already know. So for these, the topic decides.
 */
const GENERIC_SUBJECTS = new Set(['general studies', 'general knowledge', 'gk', 'general', 'others'])

const BY_ALIAS = new Map()
for (const unit of [...UNITS, UNIT_TAMIL, UNIT_ENGLISH, UNIT_CURRENT_AFFAIRS]) {
  for (const alias of unit.aliases) BY_ALIAS.set(alias, unit)
  BY_ALIAS.set(normalise(unit.en), unit)
}

export function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Which unit a question belongs under.
 *
 * `aptitude_type` is checked first and for EVERY category, not just the
 * aptitude bank. 'Aptitude' and 'Reasoning' are two separate units in the paper
 * but share one `subject` value, so a row saying subject='Aptitude' and
 * aptitude_type='reasoning' is a reasoning question — and the previous-year
 * banks are full of them. Trusting `subject` first put 109 reasoning questions
 * under Aptitude and left the Reasoning unit empty.
 *
 * Then `subject`; then, when the subject is one that says nothing, `topic`;
 * then `ca_topic` for current-affairs rows that never got a subject.
 */
export function resolveUnit(row) {
  const t = normalise(row.aptitude_type)
  if (t === 'reasoning') return UNITS.find((u) => u.key === 'reasoning')
  if (t === 'numerics') return UNITS.find((u) => u.key === 'aptitude')

  const subject = normalise(row.subject)
  const bySubject = BY_ALIAS.get(subject)
  if (bySubject) return bySubject

  if (GENERIC_SUBJECTS.has(subject)) {
    const byTopic = BY_ALIAS.get(normalise(row.topic))
    if (byTopic) return byTopic
  }

  if (row.category === 'current_affairs' || row.ca_month || row.ca_topic) return UNIT_CURRENT_AFFAIRS
  return UNIT_OTHER
}

/** URL-safe slug. Tamil is transliteration-free, so a Tamil-only string
 *  collapses to '' — callers fall back to the row id for those. */
export function slugify(s, maxLen = 80) {
  const out = String(s ?? '')
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (out.length <= maxLen) return out
  // Cut on a word boundary so the slug stays readable.
  return out.slice(0, maxLen).replace(/-[^-]*$/, '')
}
