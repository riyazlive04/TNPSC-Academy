// Builds a small NDJSON that stands in for the real export, so the generator can
// be exercised without touching the database. It deliberately includes the cases
// that have broken things before: a Tamil-only stem, LaTeX in an aptitude stem, a
// figure question, a pair of identical options, a missing correct_answer, and a
// subject that maps to no unit. It also carries rows OUTSIDE the published scope
// (an 'outer' row, a 'current_affairs' row) so the build's scope guard is
// exercised every time and not only in production.
//
//   node scripts/qbank/make-fixture.mjs && node scripts/qbank/build.mjs --src server/_qbank/fixture.ndjson --out qbank-sample

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = resolve(ROOT, 'server/_qbank/fixture.ndjson')

let seq = 0
const id = () => {
  seq++
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
}

const q = (o) => ({
  id: id(),
  category: 'pyq',
  group_type: 'Group1', year: 2024, standard: null,
  ca_month: null, ca_year: null, ca_type: null, ca_topic: null,
  aptitude_type: null, aptitude_topic: null,
  subject: null, topic: null, question_type: 'factual', external_id: null,
  difficulty: 'medium', source_tag: null,
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', explanation: null, why_wrong: null,
  question_text_ta: null, option_a_ta: null, option_b_ta: null, option_c_ta: null, option_d_ta: null,
  explanation_ta: null,
  images: null, option_images: null,
  ...o,
})

const rows = []

// ── Polity: the ordinary case, fully bilingual, with why_wrong ──────────────
rows.push(
  q({
    subject: 'Polity', topic: 'Fundamental Rights',
    question_text: 'Which Article of the Indian Constitution abolishes untouchability?',
    question_text_ta: 'இந்திய அரசியலமைப்பின் எந்த உறுப்புரை தீண்டாமையை ஒழிக்கிறது?',
    option_a: 'Article 15', option_b: 'Article 17', option_c: 'Article 19', option_d: 'Article 21',
    option_a_ta: 'உறுப்புரை 15', option_b_ta: 'உறுப்புரை 17',
    option_c_ta: 'உறுப்புரை 19', option_d_ta: 'உறுப்புரை 21',
    correct_answer: 'B',
    explanation:
      'Article 17 abolishes untouchability and forbids its practice in any form. It is one of the few ' +
      'Fundamental Rights enforceable against private individuals, not only the State.\n\n' +
      'Parliament gave it teeth through the Protection of Civil Rights Act, 1955.',
    explanation_ta:
      'உறுப்புரை 17 தீண்டாமையை ஒழித்து, அதை எந்த வடிவத்திலும் கடைப்பிடிப்பதைத் தடை செய்கிறது.',
    why_wrong: {
      A: 'Article 15 bars discrimination on grounds of religion, race, caste, sex or place of birth — a wider rule, not the untouchability one.',
      C: 'Article 19 is the set of six freedoms, including speech and assembly.',
      D: 'Article 21 protects life and personal liberty.',
    },
  }),
  q({
    subject: 'Polity', topic: 'Fundamental Rights',
    question_text: 'The Right to Education was inserted into the Constitution by which amendment?',
    option_a: '84th Amendment', option_b: '86th Amendment', option_c: '91st Amendment', option_d: '93rd Amendment',
    correct_answer: 'B',
    explanation: 'The 86th Amendment Act, 2002 inserted Article 21A, making free and compulsory education for children aged 6 to 14 a Fundamental Right.',
  }),
  q({
    subject: 'Polity', topic: 'Union Executive',
    question_text: 'Who administers the oath of office to the President of India?',
    option_a: 'The Prime Minister', option_b: 'The Vice-President',
    option_c: 'The Chief Justice of India', option_d: 'The Speaker of the Lok Sabha',
    correct_answer: 'C',
    explanation: 'Article 60 requires the oath to be administered by the Chief Justice of India, or in their absence the senior-most judge of the Supreme Court available.',
  }),
)

// ── Aptitude with LaTeX, and a figure question ──────────────────────────────
rows.push(
  q({
    category: 'pyq', year: 2022, aptitude_type: 'numerics', aptitude_topic: 'Simplification',
    subject: 'Aptitude',
    question_text: 'Simplify: $\\dfrac{3}{4} + \\dfrac{5}{6} - \\dfrac{1}{3}$',
    option_a: '$\\dfrac{5}{4}$', option_b: '$\\dfrac{4}{3}$', option_c: '$\\dfrac{17}{12}$', option_d: '$\\dfrac{3}{2}$',
    correct_answer: 'A',
    explanation: 'Take the LCM of 4, 6 and 3, which is 12. Then $\\dfrac{9}{12} + \\dfrac{10}{12} - \\dfrac{4}{12} = \\dfrac{15}{12} = \\dfrac{5}{4}$.',
    difficulty: 'easy',
  }),
  q({
    category: 'pyq', year: 2022, aptitude_type: 'reasoning', aptitude_topic: 'Dice',
    subject: 'Reasoning',
    question_text: 'From the two positions of the dice shown, which number is opposite to 3?',
    option_a: '1', option_b: '2', option_c: '5', option_d: '6',
    correct_answer: 'C',
    images: ['https://db.tnpscmentors.in/storage/v1/object/public/question-images/aptitude/dice-sample.png'],
    explanation: 'The faces 1, 2, 4 and 6 all appear adjacent to 3 across the two views, so the only face left for the opposite side is 5.',
  }),
  q({
    category: 'pyq', year: 2022, aptitude_type: 'numerics', aptitude_topic: 'Percentage',
    subject: 'Aptitude',
    question_text: 'A sum grows from $400 to $500. By what percentage did it grow?',
    option_a: '20%', option_b: '25%', option_c: 'step', option_d: '125%',
    correct_answer: 'B',
    explanation: 'The increase is 100 on a base of 400, so $\\dfrac{100}{400} \\times 100 = 25\\%$.',
  }),
)

// ── A past paper, with a group and a year ───────────────────────────────────
rows.push(
  q({
    category: 'pyq', group_type: 'Group1', year: 2024,
    subject: 'History Culture Heritage of TN', topic: 'Sangam Age',
    question_text: 'The Sangam work "Tolkappiyam" is primarily a treatise on which subject?',
    question_text_ta: '"தொல்காப்பியம்" என்ற சங்க நூல் முதன்மையாக எந்தப் பொருள் பற்றியது?',
    option_a: 'Grammar and poetics', option_b: 'Medicine', option_c: 'Astronomy', option_d: 'Statecraft',
    correct_answer: 'A',
    explanation: 'Tolkappiyam is the oldest extant Tamil grammar, covering orthography, morphology and poetics (eluttu, sol and porul).',
  }),
  q({
    category: 'pyq2', group_type: 'Group2_2A', year: 2023,
    subject: 'Indian Economy', topic: 'Five Year Plans',
    question_text: 'Which Five Year Plan is known as the Gadgil Yojana?',
    option_a: 'Second', option_b: 'Third', option_c: 'Fourth', option_d: 'Fifth',
    correct_answer: 'B',
    explanation: 'The Third Five Year Plan (1961-66) is called the Gadgil Yojana after D. R. Gadgil, then Deputy Chairman of the Planning Commission.',
  }),
)

rows.push(
  q({
    category: 'pyq4', group_type: 'Group4', year: 2024,
    subject: 'General Science', topic: 'Measurement',
    question_text: 'The SI unit of electric current is',
    option_a: 'Volt', option_b: 'Ampere', option_c: 'Ohm', option_d: 'Watt',
    correct_answer: 'B',
    explanation: 'The ampere is one of the seven SI base units, defined since 2019 by fixing the elementary charge.',
    why_wrong: { A: 'The volt measures potential difference.', C: 'The ohm measures resistance.', D: 'The watt measures power.' },
  }),
  // Tamil only: slugify() has no transliteration, so this must fall back to the
  // row id rather than producing an empty URL.
  q({
    category: 'pyq2', group_type: 'Group2_2A', year: 2024,
    subject: 'History Culture Heritage of TN', topic: 'Tamil Literature',
    question_text: 'திருக்குறளை எழுதியவர் யார்?',
    question_text_ta: 'திருக்குறளை எழுதியவர் யார்?',
    option_a: 'திருவள்ளுவர்', option_b: 'இளங்கோவடிகள்', option_c: 'கம்பர்', option_d: 'ஔவையார்',
    correct_answer: 'A',
    explanation_ta: 'திருக்குறள் திருவள்ளுவரால் எழுதப்பட்ட அறநூல்; இது முப்பால் என்றும் அழைக்கப்படுகிறது.',
  }),
)

// ── Current affairs ─────────────────────────────────────────────────────────
rows.push(
  q({
    category: 'current_affairs', subject: 'Current Affairs',
    ca_month: 'August 2026', ca_year: 2026, ca_type: 'topic_wise', ca_topic: 'Science & Technology',
    question_text: 'Which organisation launched the Chandrayaan-4 sample-return mission?',
    option_a: 'NASA', option_b: 'ISRO', option_c: 'CNSA', option_d: 'JAXA',
    correct_answer: 'B',
    explanation: 'Chandrayaan-4 is an ISRO mission, planned as India\'s first lunar sample-return attempt.',
  }),
)

// ── The admin-only "outer" bank, and a subject that maps to no unit ─────────
rows.push(
  q({
    category: 'outer', subject: 'Biology', topic: 'Human Physiology',
    question_text: 'Which vitamin is synthesised in the human skin on exposure to sunlight?',
    option_a: 'Vitamin A', option_b: 'Vitamin B12', option_c: 'Vitamin C', option_d: 'Vitamin D',
    correct_answer: 'D',
    explanation: 'Ultraviolet-B light converts 7-dehydrocholesterol in the skin into cholecalciferol, which is vitamin D3.',
  }),
  q({
    category: 'outer', subject: 'Tamil Literature', topic: 'Bhakti Literature',
    question_text: 'Who composed the Thiruvasagam?',
    option_a: 'Manikkavasagar', option_b: 'Appar', option_c: 'Sundarar', option_d: 'Sambandar',
    correct_answer: 'A',
    explanation: 'Thiruvasagam is the work of Manikkavasagar, forming the eighth Thirumurai of the Saiva canon.',
  }),
)

// ── Defective rows the build must hold back ─────────────────────────────────
rows.push(
  q({
    subject: 'Polity', topic: 'Fundamental Rights',
    question_text: 'Which of the following is a Fundamental Duty?',
    option_a: 'To protect public property', option_b: 'To protect public property',
    option_c: 'To pay taxes', option_d: 'To vote in every election',
    correct_answer: 'A',
  }),
  q({
    subject: 'Geography', topic: 'Rivers',
    question_text: 'Which is the longest river wholly within India?',
    option_a: 'Godavari', option_b: 'Narmada', option_c: 'Krishna', option_d: 'Mahanadi',
    correct_answer: null,
  }),
  q({ subject: 'Geography', topic: 'Rivers', question_text: 'Short?', option_a: 'a', option_b: 'b' }),
)

// ── Enough Geography/Science rows to make listings and pagers real ──────────
const filler = [
  ['Geography', 'Rivers', 'Which river is known as the Dakshina Ganga?', ['Godavari', 'Kaveri', 'Krishna', 'Tungabhadra'], 'A',
    'The Godavari, the second-longest river in India, is called the Dakshina Ganga — the Ganga of the South.'],
  ['Geography', 'Rivers', 'The Hirakud Dam is built across which river?', ['Mahanadi', 'Godavari', 'Narmada', 'Tapti'], 'A',
    'Hirakud, in Odisha, spans the Mahanadi and is among the longest earthen dams in the world.'],
  ['Geography', 'Climate', 'Which wind brings the bulk of Tamil Nadu\'s annual rainfall?', ['South-West monsoon', 'North-East monsoon', 'Westerlies', 'Trade winds'], 'B',
    'Tamil Nadu is in the rain-shadow of the South-West monsoon and takes most of its rain from the retreating North-East monsoon, between October and December.'],
  ['Geography', 'Climate', 'The Western Ghats cause which type of rainfall?', ['Convectional', 'Cyclonic', 'Orographic', 'Frontal'], 'C',
    'Air forced to rise over the Ghats cools and condenses, which is orographic or relief rainfall.'],
  ['Biology', 'Human Physiology', 'Which blood group is the universal donor?', ['A', 'B', 'AB', 'O negative'], 'D',
    'O negative red cells carry neither A nor B antigens nor the Rh D antigen, so they can be given to any recipient in an emergency.'],
  ['Physics', 'Light', 'The bending of light as it passes from air into water is called', ['Reflection', 'Refraction', 'Diffraction', 'Dispersion'], 'B',
    'Light changes speed when it crosses into a denser medium, and that change of speed bends its path — refraction.'],
  ['Chemistry', 'Acids and Bases', 'The pH of a neutral solution at 25 degrees Celsius is', ['0', '7', '14', '1'], 'B',
    'At 25 degrees Celsius water dissociates so that the hydrogen-ion concentration is 10 to the power minus 7 moles per litre, giving pH 7.'],
  ['History and INM', 'Freedom Movement', 'Who founded the Indian National Congress in 1885?', ['A. O. Hume', 'Dadabhai Naoroji', 'W. C. Bonnerjee', 'Surendranath Banerjee'], 'A',
    'A retired British civil servant, Allan Octavian Hume, convened the first session in Bombay in December 1885; W. C. Bonnerjee presided over it.'],
  ['History and INM', 'Freedom Movement', 'The Quit India Movement began in which year?', ['1930', '1935', '1942', '1945'], 'C',
    'The All India Congress Committee passed the Quit India resolution in Bombay on 8 August 1942.'],
  ['Indian Economy', 'Banking', 'Who regulates monetary policy in India?', ['SEBI', 'NITI Aayog', 'Reserve Bank of India', 'Ministry of Finance'], 'C',
    'The Reserve Bank of India sets the policy rate through its Monetary Policy Committee under the amended RBI Act.'],
]
// One pass per paper, so every paper page has a believable number of questions
// and the pagers have something to page through.
const PAPERS = [
  { category: 'pyq', group_type: 'Group1', year: 2025 },
  { category: 'pyq', group_type: 'Group1', year: 2024 },
  { category: 'pyq', group_type: 'Group1', year: 2022 },
  { category: 'pyq2', group_type: 'Group2_2A', year: 2024 },
  { category: 'pyq2', group_type: 'Group2_2A', year: 2023 },
  { category: 'pyq4', group_type: 'Group4', year: 2024 },
]
for (let i = 0; i < PAPERS.length; i++) {
  for (const [subject, topic, text, opts, ans, exp] of filler) {
    rows.push(
      q({
        ...PAPERS[i],
        subject, topic,
        question_text: i === 0 ? text : `${text} (variant ${i + 1})`,
        option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
        correct_answer: ans,
        explanation: exp,
      }),
    )
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
console.log(`Wrote ${rows.length} fixture rows to ${OUT}`)
