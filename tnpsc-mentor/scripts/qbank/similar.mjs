/**
 * "Other questions TNPSC has asked about the same thing."
 *
 * The question pages used to end with three siblings picked by their position
 * in the topic list — which is to say, arbitrarily. A page about a disease
 * showed whatever happened to sit next to it. This picks the three that are
 * actually about the same subject matter, and prefers them from other papers,
 * because "they asked this again in another exam" is the thing worth knowing.
 *
 * Two signals, one scoring path:
 *
 *   WORDS. Classic tf-idf over the stem (never the options: a question whose
 *   options are four state names would otherwise "match" every other question
 *   whose options are four state names, which is how the first draft decided
 *   that a Governor question belonged with a Carnatic music one).
 *
 *   CONCEPTS. Words alone cannot tell that Dengue and Pellagra are both
 *   diseases, and with only ~390 General Science questions in the bank there is
 *   not enough text for that to emerge statistically. So a small lexicon maps
 *   the families TNPSC returns to — diseases, vitamins, dynasties, writs,
 *   schemes — onto a token of their own. A shared concept then scores exactly
 *   like a shared rare word, through the same code.
 *
 * The lexicon is seeded by hand and checked against the bank: `conceptReport()`
 * prints how many questions each family tags, and build.mjs logs it, so a
 * family that has stopped matching anything is visible rather than silently
 * inert.
 */

const WORD = /[^a-z0-9஀-௿]+/g
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKC').replace(WORD, ' ').trim()

/**
 * Crude suffix stripping, enough to make 'disease' and 'diseases' one token.
 * Nothing downstream ever shows these strings to a reader, so an over-eager
 * stem costs a little precision and can never surface as a typo on a page.
 */
function stem(w) {
  if (!/^[a-z]+$/.test(w)) return w // leaves Tamil, and anything with digits, alone
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1)
  return w
}

/**
 * The furniture of a question paper. These words say which exam board wrote the
 * paper, never what the question is about, and they are frequent enough that
 * leaving them in makes every "match the following" look like every other one.
 */
const STOP = new Set(
  `the and for are was were which what when whom whose that this these those with from into onto upon
   about above below under over between among during given statement statements correct incorrect true
   false none both only also such same other another any some each every assertion reason list lists
   match matched matching matches pair pairs code codes answer answers option options choose select
   identify find using use used follow followed following column columns arrange chronological order
   have been being does did not nor but his her its their they them than then there here
   one two three four five six seven eight nine ten first second third fourth fifth sixth
   explain explained respect regard regarding consider sentence word words meaning means underlined
   blank fill year years date month day time place name named called known mentioned related associated
   part parts type types kind kinds group groups set sets number numbers most least more less best worst
   main major minor general correctly wrong right below above state states india indian government
   national central line lines will shall figure site source value values result results example
   examples reference referred reads read says said point points case cases term terms

   கண்டறிக எது யார் என்னும் என்று பொருத்துக என்ற செய்க சரியான எழுதுக உள்ள தெரிவு ஒரு கீழே
   தேர்க தேர்வு தேர்ந்தெடு ஒன்று கீழ்க்காணும் என்பது பொருத்தி தொகுப்பிலிருந்து விடையைத்
   தேர்ந்தெடுக்க எனும் தருக எனக் எந்த பின்வருவனவற்றுள் உரிய யாது எவ்வகை பொருந்தாத என்பதன்
   குறிப்பிடுக எவை விடையினைத் என்பதைத் குறிக்கும் பெயர் இரண்டு வரும் கொண்டு நூல் நூலை`
    .split(/\s+/)
    .filter(Boolean)
    .map(stem),
)

/**
 * The families TNPSC keeps coming back to.
 *
 * A family is a concept name and the words that mean it. Terms are stemmed on
 * load, so write them however reads best. Keep them SPECIFIC: 'cell' would tag
 * a prison question and a battery question along with the biology, and a
 * concept that fires on unrelated questions is worse than no concept, because
 * it scores as hard as a rare shared word.
 */
const CONCEPTS = {
  disease: `disease illness infection infectious epidemic pandemic virus viral bacteria bacterial fungal
    dengue malaria cholera typhoid tuberculosis leprosy polio poliomyelitis measles smallpox chickenpox
    jaundice rabies tetanus plague influenza pneumonia filariasis filaria elephantiasis diphtheria
    hepatitis diabetes cancer asthma anaemia anemia goitre goiter rickets scurvy beriberi pellagra
    kwashiorkor marasmus nictalopia immunization immunisation vaccine vaccination antibody antigen
    mantoux chikungunya aids
    chicken+pox small+pox night+blindness foot+and+mouth swine+flu bird+flu dengue+fever
    blue+baby minamata itai black+foot`,
  vitamin: `vitamin riboflavin thiamine pyridoxine cyanocobalamine niacin ascorbic calciferol tocopherol
    retinol deficiency malnutrition nutrient nutrition`,
  // Deliberately NOT a 'human body' family. Blood, brain and skin are their own
  // words and recur as themselves, so a concept adds nothing — while a question
  // that lists four diseases AND the organs they attack would be pulled toward
  // every question mentioning blood, which is how this went wrong the first time.
  hormone: `hormone endocrine thyroid pituitary adrenal insulin pancreas secretion gland`,
  plant: `photosynthesis chlorophyll stomata pollination germination xylem phloem transpiration
    root stem leaf flower seed fruit crop fertilizer fertiliser manure horticulture`,
  physics: `velocity acceleration momentum friction gravity gravitational newton inertia refraction
    reflection lens mirror wavelength frequency optic magnet magnetic electric electricity current
    voltage resistance circuit radioactivity isotope`,
  chemistry: `acid alkali alkaline oxidation reduction catalyst compound molecule atom atomic valency
    hydrogen oxygen nitrogen carbon sulphur sulfur chloride sodium calcium potassium metal alloy ore
    galena bauxite corrosion electrolysis`,
  // Not a bare 'solar': the bank's solar questions are mostly solar POWER, and
  // tagging them astronomy put a photovoltaic plant next to the asteroid belt.
  space: `planet satellite orbit asteroid comet galaxy telescope isro nasa rocket
    chandrayaan mangalyaan spacecraft astronaut solar+system solar+eclipse lunar+eclipse`,

  constitution: `constitution constitutional article schedule preamble amendment fundamental directive
    principle duty duties citizenship federal secular sovereign republic`,
  parliament: `parliament lok rajya sabha legislature legislative assembly bill ordinance quorum speaker
    session budget motion`,
  judiciary: `judiciary judicial supreme court high court judge justice writ habeas mandamus certiorari
    quo warranto prohibition tribunal litigation verdict`,
  executive: `president governor minister ministry cabinet prime chief secretary bureaucracy
    appointment impeachment`,
  localbody: `panchayat panchayati municipality municipal corporation village local gram sabha ward
    decentralisation decentralization`,
  election: `election electoral voter voting franchise constituency ballot nomination poll psephology`,
  commission: `commission committee council board authority chairman recommendation report tribunal
    ombudsman lokpal lokayukta`,

  freedom: `freedom independence swaraj satyagraha boycott swadeshi nationalist congress league
    revolt rebellion mutiny massacre partition quit nonviolence ahimsa`,
  dynasty: `chola pandya chera pallava maurya gupta mughal sultanate vijayanagar satavahana kushan
    harappa indus dynasty empire emperor king ruler reign kingdom throne`,
  colonial: `british company colonial viceroy governorgeneral residency annexation doctrine lapse
    treaty charter regulation madras bombay calcutta presidency`,
  socialreform: `reform reformer renaissance widow sati untouchability caste movement periyar
    ambedkar missionary society samaj mission awakening`,

  river: `river tributary basin delta confluence dam reservoir canal irrigation waterfall catchment
    cauvery kaveri ganga ganges yamuna godavari krishna narmada brahmaputra vaigai thamirabarani`,
  climate: `monsoon rainfall climate cyclone drought flood temperature humidity atmosphere wind
    season precipitation`,
  landform: `mountain hill plateau plain valley ghats peak range coast coastal island peninsula
    soil erosion`,
  forest: `forest wildlife sanctuary reserve biosphere tiger elephant biodiversity conservation
    endangered ecology ecosystem environment pollution`,
  population: `population census density literacy migration urbanisation urbanization demographic
    birth death growth`,

  scheme: `scheme yojana mission abhiyan programme pension subsidy beneficiary welfare insurance
    employment guarantee housing nutrition midday`,
  planning: `plan planning niti aayog target investment outlay sector industrialisation
    industrialization liberalisation liberalization privatisation privatization globalisation`,
  money: `bank banking rupee currency inflation deflation repo credit loan deposit taxation
    income revenue fiscal monetary gdp budget`,
  poverty: `poverty unemployment inequality wage labour labor worker employment livelihood`,

  literature: `poet poem verse literature epic kavya anthology sangam kural thirukkural thiruvalluvar
    commentary grammar prosody`,
  award: `award prize honour honor medal trophy laureate nobel bharat padma`,
  sport: `olympic asian commonwealth tournament championship cricket hockey athlete medal stadium`,
}

/** Stemmed lookup: token -> the concept(s) it signals. */
const CONCEPT_OF = new Map()
/** Terms written with a '+' are phrases: 'chicken+pox' matches "chicken pox". */
const CONCEPT_PHRASES = []
for (const [name, terms] of Object.entries(CONCEPTS)) {
  for (const raw of terms.split(/\s+/).filter(Boolean)) {
    if (raw.includes('+')) {
      CONCEPT_PHRASES.push({ name, phrase: raw.split('+').join(' ') })
      continue
    }
    const t = stem(raw)
    if (!CONCEPT_OF.has(t)) CONCEPT_OF.set(t, [])
    if (!CONCEPT_OF.get(t).includes(name)) CONCEPT_OF.get(t).push(name)
  }
}

/** A concept token is namespaced so it can never collide with a real word. */
const conceptToken = (name) => `~${name}`

/**
 * The stem's content words, and how many terms of each concept family it uses.
 *
 * The count matters: a question naming four diseases is more about diseases
 * than one that says "disease" once, and weighting by it is what keeps a
 * question that merely mentions a symptom from outranking the real match.
 */
function tokensOf(q) {
  const text = norm(q.question_text)
  const words = text
    .split(' ')
    .filter((w) => w.length > 3 && !/^\d+$/.test(w))
    .map(stem)
    .filter((w) => !STOP.has(w))

  const set = new Set(words)
  const concepts = new Map()
  const bump = (name, key) => {
    let hit = concepts.get(name)
    if (!hit) concepts.set(name, (hit = new Set()))
    hit.add(key)
  }
  for (const w of set) {
    for (const c of CONCEPT_OF.get(w) ?? []) bump(c, w)
  }
  for (const { name, phrase } of CONCEPT_PHRASES) {
    if (text.includes(phrase)) bump(name, phrase)
  }
  return { words: set, concepts: new Map([...concepts].map(([k, v]) => [k, v.size])) }
}

/**
 * How much of the bank each concept family actually tags.
 * @returns {{name:string, questions:number}[]} busiest first
 */
export function conceptReport(rows) {
  const count = new Map(Object.keys(CONCEPTS).map((c) => [c, 0]))
  for (const q of rows) {
    for (const name of tokensOf(q).concepts.keys()) count.set(name, count.get(name) + 1)
  }
  return [...count.entries()]
    .map(([name, questions]) => ({ name, questions }))
    .sort((a, b) => b.questions - a.questions)
}

/** Words this common say nothing about subject matter, whatever their idf. */
const DF_SHARE_CAP = 0.03
/** A shared word at least this rare is on its own enough to call two questions alike. */
const MIN_IDF = 5.2
/** ...otherwise they need this many shared words between them. */
const MIN_TERMS = 3
/**
 * What one shared concept is worth. Held above MIN_IDF on purpose: a family is
 * curated, so two questions landing in the same one is a stronger statement
 * than two questions happening to share a word, and it must not be hostage to
 * how many questions the family happens to tag.
 */
const CONCEPT_W = 6
/** Postings longer than this are scanned for nothing; nothing legitimate is. */
const POST_CAP = 600

/**
 * For every question, the questions most about the same thing.
 *
 * @param {object[]} rows questions, each carrying `id`, `question_text`, a
 *   `_unit` (from resolveUnit) and a `_paper`
 * @param {object} [opts]
 * @param {number} [opts.perQuestion=3] how many to keep
 * @param {Map<string, object[]>} [opts.exclude] repeat clusters, so the same
 *   question is not offered as "similar" to itself in another paper — it has
 *   its own notice, and a near-duplicate teaches nothing new here
 * @returns {Map<string, object[]>} question id -> its matches, best first
 */
export function findSimilar(rows, { perQuestion = 3, exclude } = {}) {
  const df = new Map()
  const docs = []
  for (const q of rows) {
    const { words, concepts } = tokensOf(q)
    // Two signals is enough, and a concept counts as one — "The best source of
    // vitamin D is" comes down to the single word 'vitamin' once the furniture
    // is removed, and it is exactly the kind of question this exists to pair up.
    if (words.size + concepts.size < 2) continue
    for (const w of words) df.set(w, (df.get(w) ?? 0) + 1)
    docs.push({ q, words, concepts })
  }
  const N = docs.length
  if (!N) return new Map()

  const cap = Math.round(N * DF_SHARE_CAP)
  const idf = (w) => Math.log(N / (df.get(w) ?? N))
  const weightOf = (w) => (w.startsWith('~') ? CONCEPT_W : idf(w))

  // Weighted term vectors, minus the words too common to carry a subject.
  const vecs = docs.map((d) => {
    const v = new Map()
    let ss = 0
    const put = (w, x) => {
      v.set(w, x)
      ss += x * x
    }
    for (const w of d.words) {
      if ((df.get(w) ?? 0) > cap) continue
      put(w, idf(w))
    }
    // Four disease names say "this is a disease question" far louder than one.
    for (const [name, hits] of d.concepts) put(conceptToken(name), CONCEPT_W * Math.sqrt(hits))
    return { q: d.q, v, len: Math.sqrt(ss) || 1 }
  })
  const byId = new Map(vecs.map((d) => [d.q.id, d]))

  const post = new Map()
  for (const d of vecs) {
    for (const w of d.v.keys()) {
      if (!post.has(w)) post.set(w, [])
      post.get(w).push(d)
    }
  }

  const unitOf = (q) => q._unit?.key ?? ''
  const paperOf = (q) => q._paper?.slug ?? ''

  const out = new Map()
  for (const d of vecs) {
    const banned = new Set((exclude?.get(d.q.id) ?? []).map((x) => x.id))
    const terms = [...d.v.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)

    const acc = new Map()
    for (const [w] of terms) {
      const p = post.get(w)
      if (!p || p.length > POST_CAP) continue
      for (const o of p) {
        // Same subject only. Without it a Tamil comprehension question and a
        // biology one pair up on 'brain' and the section looks broken.
        if (o.q.id === d.q.id || banned.has(o.q.id) || unitOf(o.q) !== unitOf(d.q)) continue
        let a = acc.get(o.q.id)
        if (!a) acc.set(o.q.id, (a = { mass: 0, words: [] }))
        a.mass += d.v.get(w) * d.v.get(w)
        a.words.push(w)
      }
    }

    const scored = []
    for (const [id, a] of acc) {
      const sharesConcept = a.words.some((w) => w.startsWith('~'))
      if (!sharesConcept && Math.max(...a.words.map(weightOf)) < MIN_IDF && a.words.length < MIN_TERMS) {
        continue
      }
      const o = byId.get(id)
      // Divided by the OTHER question's weight, so a short question wholly about
      // Cholas beats a long one that mentions them once — even when the long one
      // shares a rarer word. Square-rooted, or a three-word question wins
      // everything simply for being short.
      scored.push({ q: o.q, s: a.mass / Math.sqrt(o.len) })
    }
    if (!scored.length) continue

    const mine = paperOf(d.q)
    scored.sort((a, b) => (paperOf(b.q) !== mine) - (paperOf(a.q) !== mine) || b.s - a.s)
    out.set(d.q.id, scored.slice(0, perQuestion).map((x) => x.q))
  }
  return out
}
