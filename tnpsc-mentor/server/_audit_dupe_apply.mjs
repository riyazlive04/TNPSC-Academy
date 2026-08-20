/**
 * Resolve 10 duplicate groups (12 rows to rewrite) found during the full aptitude-bank
 * audit — these slipped past the earlier signature-based dedup pass because they weren't
 * flagged by that heuristic, but per-row inspection during the audit confirmed them as
 * genuine content duplicates (all individually correct, no math errors). Same policy as
 * before: keep the row with more student history, rewrite the other into a fresh, verified,
 * different problem on the same skill.
 */
import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

const WRITE = process.argv.includes('--write')
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const REWRITES = [
  { id: 'b7d85f5a-1494-4296-95c6-aaef71b1133c',
    question_text: 'Two coins are tossed together. What is the probability of getting at least one head?',
    question_text_ta: 'இரண்டு நாணயங்கள் ஒன்றாகச் சுண்டப்படுகின்றன. குறைந்தது ஒரு head கிடைப்பதற்கான நிகழ்தகவு என்ன?',
    option_a: '$\\dfrac{3}{4}$', option_b: '$\\dfrac{1}{4}$', option_c: '$\\dfrac{1}{2}$', option_d: '$\\dfrac{1}{8}$',
    correct_answer: 'A',
    explanation: 'Given:\nS = {HH, HT, TH, TT}, n(S) = 4\nWorking:\nFormula: P(at least one head) = 1 - P(no heads)\nP(no heads) = P(TT) = 1/4\nP(at least one head) = 1 - 1/4 = 3/4\nAsked:\nProbability of at least one head\n= 3/4\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nS = {HH, HT, TH, TT}, n(S) = 4\nசெயல்முறை:\nசூத்திரம்: P(குறைந்தது ஒரு head) = 1 - P(head இல்லை)\nP(head இல்லை) = P(TT) = 1/4\nP(குறைந்தது ஒரு head) = 1 - 1/4 = 3/4\nகேட்டது:\nகுறைந்தது ஒரு head கிடைப்பதற்கான நிகழ்தகவு\n= 3/4\nவிடை (A)' },
  { id: '369bf481-6cb8-4228-99f6-0bca2091beeb',
    question_text: 'If the cost of 8 pens is Rs. 96, find the cost of 12 pens.',
    question_text_ta: '8 பேனாக்களின் விலை Rs. 96 எனில், 12 பேனாக்களின் விலையைக் காண்க.',
    option_a: 'Rs. 144', option_b: 'Rs. 120', option_c: 'Rs. 108', option_d: 'Rs. 132',
    correct_answer: 'A',
    explanation: 'Given:\nCost of 8 pens = Rs. 96\nWorking:\nCost of 1 pen = 96/8 = 12\nCost of 12 pens = 12 × 12 = 144\nAsked:\nCost of 12 pens = Rs. 144\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n8 பேனாக்களின் விலை = Rs. 96\nசெயல்முறை:\n1 பேனாவின் விலை = 96/8 = 12\n12 பேனாக்களின் விலை = 12 × 12 = 144\nகேட்டது:\n12 பேனாக்களின் விலை = Rs. 144\nவிடை (A)' },
  { id: '5ec888a6-1540-44f9-804b-f8666997e2b4',
    question_text: 'The cost of 18 tables is Rs. 9,000. How many such tables can be purchased for Rs. 15,000?',
    question_text_ta: '18 மேசைகளின் விலை Rs. 9,000. Rs. 15,000-க்கு இதுபோன்ற எத்தனை மேசைகளை வாங்க முடியும்?',
    option_a: '30 tables', option_b: '25 tables', option_c: '20 tables', option_d: '27 tables',
    correct_answer: 'A',
    explanation: 'Given:\nCost of 18 tables = Rs. 9,000\nAmount available = Rs. 15,000\nWorking:\nCost of 1 table = 9000/18 = 500\nNumber of tables = 15000/500 = 30\nAsked:\nNumber of tables for Rs. 15,000 = 30\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n18 மேசைகளின் விலை = Rs. 9,000\nகிடைக்கும் தொகை = Rs. 15,000\nசெயல்முறை:\n1 மேசையின் விலை = 9000/18 = 500\nமேசைகளின் எண்ணிக்கை = 15000/500 = 30\nகேட்டது:\nRs. 15,000-க்கு மேசைகளின் எண்ணிக்கை = 30\nவிடை (A)' },
  { id: 'c5989dfb-ac43-4b13-8070-32c631e4bfa7',
    question_text: 'Three bells at a factory ring at intervals of 24, 36 and 54 seconds respectively. If they all ring together at 9:00 a.m., after how many seconds will they next ring together?',
    question_text_ta: 'ஒரு தொழிற்சாலையில் மூன்று மணிகள் முறையே 24, 36 மற்றும் 54 வினாடிகளுக்கு ஒருமுறை ஒலிக்கின்றன. அவை காலை 9:00 மணிக்கு ஒன்றாக ஒலித்தால், எத்தனை வினாடிகளுக்குப் பிறகு அடுத்து ஒன்றாக ஒலிக்கும்?',
    option_a: '216', option_b: '180', option_c: '270', option_d: '324',
    correct_answer: 'A',
    explanation: 'Given:\nRing intervals: 24, 36, 54 seconds\nWorking:\nFormula: they ring together again after the L.C.M of the intervals\n24 = 2×2×2×3\n36 = 2×2×3×3\n54 = 2×3×3×3\nL.C.M = 2×2×2×3×3×3 = 216\nAsked:\nTime after which all ring together = 216 seconds\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஒலிக்கும் இடைவெளிகள்: 24, 36, 54 வினாடிகள்\nசெயல்முறை:\nசூத்திரம்: இடைவெளிகளின் மீ.சி.ம க்குப் பிறகு அவை மீண்டும் ஒன்றாக ஒலிக்கும்\n24 = 2×2×2×3\n36 = 2×2×3×3\n54 = 2×3×3×3\nமீ.சி.ம = 2×2×2×3×3×3 = 216\nகேட்டது:\nஅனைத்தும் ஒன்றாக ஒலிக்கும் நேரம் = 216 வினாடிகள்\nவிடை (A)' },
  { id: 'b96e760e-c358-4762-b3fe-8ba81d76699d',
    question_text: 'Three machines in a workshop beep at intervals of 45, 60 and 75 seconds respectively. If they all beep together at 10:00 a.m., at what time will they next beep together?',
    question_text_ta: 'ஒரு பட்டறையில் மூன்று இயந்திரங்கள் முறையே 45, 60 மற்றும் 75 வினாடிகளுக்கு ஒருமுறை பீப் ஒலி எழுப்புகின்றன. அவை காலை 10:00 மணிக்கு ஒன்றாக ஒலித்தால், எந்த நேரத்தில் மீண்டும் ஒன்றாக ஒலிக்கும்?',
    option_a: '10:15 a.m.', option_b: '10:10 a.m.', option_c: '10:20 a.m.', option_d: '10:12 a.m.',
    correct_answer: 'A',
    explanation: 'Given:\nBeep intervals = 45, 60, 75 seconds; machines beep together at 10:00 a.m.\nWorking:\nTime to beep together again = L.C.M of the intervals\n45 = 3×3×5\n60 = 2×2×3×5\n75 = 3×5×5\nL.C.M = 2×2×3×3×5×5 = 900 seconds\n900 ÷ 60 = 15 minutes\n10:00 a.m. + 15 minutes = 10:15 a.m.\nAsked:\nTime the machines beep together again\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஒலிக்கும் இடைவெளிகள் = 45, 60, 75 வினாடிகள்; இயந்திரங்கள் காலை 10:00 மணிக்கு ஒன்றாக ஒலிக்கின்றன\nசெயல்முறை:\nமீண்டும் ஒன்றாக ஒலிக்கும் நேரம் = இடைவெளிகளின் மீ.சி.ம\n45 = 3×3×5\n60 = 2×2×3×5\n75 = 3×5×5\nமீ.சி.ம = 2×2×3×3×5×5 = 900 வினாடிகள்\n900 ÷ 60 = 15 நிமிடங்கள்\n10:00 a.m. + 15 நிமிடங்கள் = 10:15 a.m.\nகேட்டது:\nஇயந்திரங்கள் மீண்டும் ஒன்றாக ஒலிக்கும் நேரம்\nவிடை (A)' },
  { id: '1dc0c379-6bdb-4e5e-b098-763308f9a6e5',
    question_text: 'Three fire alarms in a building sound at intervals of 18, 24 and 30 minutes respectively. If they all sound together now, after how many minutes will they next sound together?',
    question_text_ta: 'ஒரு கட்டிடத்தில் மூன்று தீ எச்சரிக்கை மணிகள் முறையே 18, 24 மற்றும் 30 நிமிடங்களுக்கு ஒருமுறை ஒலிக்கின்றன. அவை அனைத்தும் இப்போது ஒன்றாக ஒலித்தால், எத்தனை நிமிடங்களுக்குப் பிறகு அடுத்து ஒன்றாக ஒலிக்கும்?',
    option_a: '360', option_b: '180', option_c: '270', option_d: '90',
    correct_answer: 'A',
    explanation: 'Given:\nAlarm intervals: 18, 24, 30 minutes\nWorking:\n18 = 2×3×3\n24 = 2×2×2×3\n30 = 2×3×5\nL.C.M = 2×2×2×3×3×5 = 360 minutes\nAsked:\nTime after which all sound together\n= 360 minutes\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஎச்சரிக்கை மணி இடைவெளிகள்: 18, 24, 30 நிமிடங்கள்\nசெயல்முறை:\n18 = 2×3×3\n24 = 2×2×2×3\n30 = 2×3×5\nமீ.சி.ம = 2×2×2×3×3×5 = 360 நிமிடங்கள்\nகேட்டது:\nஅனைத்தும் ஒன்றாக ஒலிக்கும் நேரம்\n= 360 நிமிடங்கள்\nவிடை (A)' },
  { id: '366fd959-ac3d-4601-ab48-7682a2367d97',
    question_text: 'The population of a town is 48,000. 45% of them are men, 30% are women and the rest are children. Find the number of men and children.',
    question_text_ta: 'ஒரு நகரத்தின் மக்கள் தொகை 48,000. அவர்களில் 45% ஆண்கள், 30% பெண்கள், மீதமுள்ளவர்கள் குழந்தைகள். ஆண்கள் மற்றும் குழந்தைகளின் எண்ணிக்கையைக் கண்டறியவும்.',
    option_a: '21600 & 12000', option_b: '14400 & 21600', option_c: '21600 & 14400', option_d: '12000 & 21600',
    correct_answer: 'A',
    explanation: 'Given:\nTotal population = 48,000\nMen = 45%, Women = 30%, Children = rest\nWorking:\nMen = 45/100 × 48000 = 21600\nChildren % = 100 - 45 - 30 = 25%\nChildren = 25/100 × 48000 = 12000\nAsked:\nMen = 21600 and Children = 12000\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மக்கள் தொகை = 48,000\nஆண்கள் = 45%, பெண்கள் = 30%, மீதம் குழந்தைகள்\nசெயல்முறை:\nஆண்கள் = 45/100 × 48000 = 21600\nகுழந்தைகள் % = 100 - 45 - 30 = 25%\nகுழந்தைகள் = 25/100 × 48000 = 12000\nகேட்டது:\nஆண்கள் = 21600 மற்றும் குழந்தைகள் = 12000\nவிடை (A)' },
  { id: 'a43bd9f0-3afc-41a0-9622-9379ecd018dc',
    question_text: 'The price of a laptop is decreased from Rs. 50,000 to Rs. 42,000. Find the percentage of decrease.',
    question_text_ta: 'ஒரு laptop-இன் விலை Rs. 50,000-லிருந்து Rs. 42,000-ஆகக் குறைக்கப்பட்டது. குறைப்பின் சதவீதத்தைக் காண்க.',
    option_a: '16%', option_b: '14%', option_c: '20%', option_d: '18%',
    correct_answer: 'A',
    explanation: 'Given:\nOriginal price = Rs. 50,000\nNew price = Rs. 42,000\nWorking:\nDecrease = 50000 - 42000 = 8000\nDecrease % = 8000/50000 × 100 = 16%\nAsked:\nPercentage of decrease = 16%\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஅசல் விலை = Rs. 50,000\nபுதிய விலை = Rs. 42,000\nசெயல்முறை:\nகுறைவு = 50000 - 42000 = 8000\nகுறைப்பு % = 8000/50000 × 100 = 16%\nகேட்டது:\nகுறைப்பின் சதவீதம் = 16%\nவிடை (A)' },
  { id: '07ae6028-52d2-423d-9549-ad1dd9825dc3',
    question_text: 'There are 400 students in a school. 92 students like kabaddi. What is the percentage of students who like kabaddi?',
    question_text_ta: 'ஒரு பள்ளியில் 400 மாணவர்கள் உள்ளனர். 92 மாணவர்கள் கபடி விரும்புகின்றனர். கபடி விரும்பும் மாணவர்களின் சதவீதம் என்ன?',
    option_a: '23%', option_b: '25%', option_c: '20%', option_d: '27.6%',
    correct_answer: 'A',
    explanation: 'Given:\nTotal students = 400\nStudents who like kabaddi = 92\nWorking:\nPercentage = 92/400 × 100 = 23\nAsked:\nPercentage of students who like kabaddi\n= 23%\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மாணவர்கள் = 400\nகபடி விரும்பும் மாணவர்கள் = 92\nசெயல்முறை:\nசதவீதம் = 92/400 × 100 = 23\nகேட்டது:\nகபடி விரும்பும் மாணவர்களின் சதவீதம்\n= 23%\nவிடை (A)' },
  { id: 'b66c0f41-b424-4754-a747-136d51af25e7',
    question_text: 'There are 400 students in a school. 68 students like volleyball. What is the percentage of students who like volleyball?',
    question_text_ta: 'ஒரு பள்ளியில் 400 மாணவர்கள் உள்ளனர். 68 மாணவர்கள் கைப்பந்து (volleyball) விரும்புகின்றனர். கைப்பந்து விரும்பும் மாணவர்களின் சதவீதம் என்ன?',
    option_a: '17%', option_b: '15%', option_c: '20%', option_d: '22%',
    correct_answer: 'A',
    explanation: 'Given:\nTotal students = 400\nStudents who like volleyball = 68\nWorking:\nPercentage = 68/400 × 100 = 17\nAsked:\nPercentage of students who like volleyball\n= 17%\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மாணவர்கள் = 400\nகைப்பந்து விரும்பும் மாணவர்கள் = 68\nசெயல்முறை:\nசதவீதம் = 68/400 × 100 = 17\nகேட்டது:\nகைப்பந்து விரும்பும் மாணவர்களின் சதவீதம்\n= 17%\nவிடை (A)' },
  { id: 'ea987b69-d0b9-4f2c-9a53-a62c94cb6593',
    question_text: 'Find the compound interest on Rs. 8,000 for 1 year at 10% per annum, compounded half-yearly.',
    question_text_ta: 'அரையாண்டுக்கு ஒரு முறை வட்டி அசலுடன் சேர்க்கப்பட்டால், ரூ. 8,000 ஆனது 1 ஆண்டில் 10% வட்டி விகிதத்தில் எவ்வளவு கூட்டு வட்டியைத் தரும்?',
    option_a: 'Rs. 820', option_b: 'Rs. 800', option_c: 'Rs. 840', option_d: 'Rs. 880',
    correct_answer: 'A',
    explanation: 'Given:\nP = Rs. 8,000\nr = 10% per annum, compounded half-yearly\nn = 1 year = 2 half-years\nWorking:\nHalf-yearly rate = 10/2 = 5%\nA = 8000 × (1 + 5/100)^2 = 8000 × (1.05)^2 = 8000 × 1.1025 = 8820\nCI = A - P = 8820 - 8000 = 820\nAsked:\nCompound Interest = Rs. 820\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nP = ரூ. 8,000\nr = ஆண்டுக்கு 10%, அரையாண்டு கூட்டல்\nn = 1 ஆண்டு = 2 அரையாண்டுகள்\nசெயல்முறை:\nஅரையாண்டு வட்டி = 10/2 = 5%\nA = 8000 × (1 + 5/100)^2 = 8000 × 1.1025 = 8820\nகூட்டு வட்டி = A - P = 8820 - 8000 = 820\nகேட்டது:\nகூட்டு வட்டி = ரூ. 820\nவிடை (A)' },
  { id: 'a3c7a607-955e-450c-919c-db72b2ede2c2',
    question_text: 'Eight men can complete a work in 15 days. After the third day, 4 more men joined them. How many days will they take to complete the remaining work?',
    question_text_ta: '8 ஆட்கள் ஒரு வேலையை 15 நாட்களில் முடிக்க முடியும். மூன்றாவது நாளுக்குப் பிறகு, மேலும் 4 ஆட்கள் அவர்களுடன் சேர்ந்தனர். மீதமுள்ள வேலையை முடிக்க அவர்கள் எத்தனை நாட்கள் எடுத்துக்கொள்வார்கள்?',
    option_a: '8 days', option_b: '6 days', option_c: '10 days', option_d: '7 days',
    correct_answer: 'A',
    explanation: 'Given:\n8 men finish the work in 15 days, so total work = 8 × 15 = 120 man-days\nFirst 3 days done by 8 men; then 4 more join, making 12 men\nWorking:\nFormula: total man-days is constant\nWork in first 3 days = 3 × 8 = 24 man-days\nRemaining work = 120 - 24 = 96 man-days\nLet remaining days = x, worked by 12 men\n12 × x = 96\nx = 8 days\nAsked:\nDays for 12 men to finish remaining work = 8\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n8 ஆட்கள் வேலையை 15 நாட்களில் முடிக்கின்றனர், எனவே மொத்த வேலை = 8 × 15 = 120 ஆள்-நாட்கள்\nமுதல் 3 நாட்கள் 8 ஆட்களால் செய்யப்பட்டது; பின்னர் மேலும் 4 பேர் சேர்ந்து 12 ஆட்கள் ஆகின்றனர்\nசெயல்முறை:\nசூத்திரம்: மொத்த ஆள்-நாட்கள் மாறிலி\nமுதல் 3 நாட்களின் வேலை = 3 × 8 = 24 ஆள்-நாட்கள்\nமீதமுள்ள வேலை = 120 - 24 = 96 ஆள்-நாட்கள்\nமீதமுள்ள நாட்கள் = x, 12 ஆட்களால் செய்யப்படுகிறது\n12 × x = 96\nx = 8 நாட்கள்\nகேட்டது:\n12 ஆட்கள் மீதமுள்ள வேலையை முடிக்கும் நாட்கள் = 8\nவிடை (A)' },
]

console.log(`=== AUDIT-DUPE APPLY ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
console.log(`rewrites planned: ${REWRITES.length}`)

const ids = REWRITES.map((r) => r.id)
const { rows: existing } = await c.query('select id::text as id from questions where id::text = any($1)', [ids])
const existingSet = new Set(existing.map((r) => r.id))
const missing = ids.filter((id) => !existingSet.has(id))
if (missing.length) { console.error('MISSING:', missing); await c.end(); process.exit(1) }
console.log(`all ${ids.length} target ids verified present.`)

const { rows: backupRows } = await c.query('select * from questions where id::text = any($1)', [ids])
writeFileSync('_audit_dupe_backup.json', JSON.stringify(backupRows, null, 1))
console.log(`backed up ${backupRows.length} rows to server/_audit_dupe_backup.json`)

if (!WRITE) { console.log('DRY RUN — no changes made.'); await c.end(); process.exit(0) }

let updated = 0
for (const r of REWRITES) {
  const res = await c.query(
    `update questions set question_text=$1, question_text_ta=$2,
       option_a=$3, option_b=$4, option_c=$5, option_d=$6,
       correct_answer=$7, explanation=$8, explanation_ta=$9
     where id::text=$10`,
    [r.question_text, r.question_text_ta, r.option_a, r.option_b, r.option_c, r.option_d,
      r.correct_answer, r.explanation, r.explanation_ta, r.id]
  )
  updated += res.rowCount
}
console.log(`rewritten rows: ${updated}`)
await c.end()
