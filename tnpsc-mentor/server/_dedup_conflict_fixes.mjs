/**
 * Fix 6 verified answer-key errors found while resolving near-duplicate 'outer' bank groups.
 * All are admin-only content (never shown to students directly), non-pyq (in scope per user
 * directive). Two are pure correct_answer field fixes (explanation already stated the right
 * answer in prose); four also need the explanation text corrected since it asserted the wrong
 * fact outright. The Cripps Mission and Sangam conflicts are deliberately excluded — genuinely
 * ambiguous / subjective, left for human review.
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

const FIXES = [
  // answer-only fixes (explanation already correct)
  { idPrefix: '6f61501a', correct_answer: 'B' }, // Homophones — explanation already says "correct answer is Homophones"
  { idPrefix: 'db7409fc', correct_answer: 'C' }, // Troposphere — explanation already says "correct answer is C - Troposphere"

  // answer + explanation fixes
  { idPrefix: '9471e9fd', correct_answer: 'B',
    explanation: "Disguised unemployment refers to a situation where more people are employed than necessary, particularly in agriculture, where labour is often underutilised. In India, this is common due to the traditional nature of farming and reliance on family labour. The reason given — that rural literacy is increasing — is also true; India's rural literacy rate has been rising steadily over the decades. However, rising literacy does not directly cause or explain disguised unemployment; the two are true but unrelated trends. Therefore, both (A) and (R) are true, but (R) is not the correct explanation of (A) — option B.",
    explanation_ta: 'மறைக்கப்பட்ட வேலைவாய்ப்பு என்பது தேவையானதைவிட அதிக மனிதர்கள் பணியில் ஈடுபட்டிருக்கும் நிலை; குறிப்பாக வேளாண்மையில் தொழிலாளர்கள் முழுமையாகப் பயன்படுத்தப்படாதது பொதுவானது. இந்தியாவில் குடும்பத் தொழிலாளர்களைச் சார்ந்த பாரம்பரிய விவசாய முறையால் இது காணப்படுகிறது. கொடுக்கப்பட்ட காரணம் — கிராமப்புற எழுத்தறிவு அதிகரிப்பு — என்பதும் உண்மையே; பல ஆண்டுகளாக இந்தியாவின் கிராமப்புற எழுத்தறிவு விகிதம் படிப்படியாக உயர்ந்து வருகிறது. எனினும், எழுத்தறிவு அதிகரிப்பு மறைக்கப்பட்ட வேலைவாய்ப்பை நேரடியாக ஏற்படுத்துவதோ விளக்குவதோ இல்லை; இவை இரண்டும் உண்மையான ஆனால் தொடர்பற்ற போக்குகள். எனவே, (A) மற்றும் (R) இரண்டும் உண்மை, ஆனால் (R) என்பது (A)-க்குச் சரியான விளக்கம் அல்ல — தேர்வு B.' },

  { idPrefix: 'ec5970b9', correct_answer: 'C',
    explanation: "The question describes words that have similar sound AND similar spelling, but different meaning — this is the definition of Homonyms. For example, 'bat' (a flying mammal) and 'bat' (used in cricket) are spelled and pronounced identically but mean different things. This is different from Homophones, which sound alike but are spelled differently and mean different things (e.g. 'flower' and 'flour'). Therefore, the correct answer is Homonyms — option C.",
    explanation_ta: "இக்கேள்வி ஒலியிலும் எழுத்துக்கூட்டிலும் ஒத்திருந்து, பொருளில் வேறுபடும் சொற்களைப் பற்றியது — இதுவே Homonyms (பன்முகச் சொற்கள்) என வரையறுக்கப்படுகிறது. எடுத்துக்காட்டாக, 'bat' (பறக்கும் விலங்கு) மற்றும் 'bat' (கிரிக்கெட்டில் பயன்படுத்தப்படும் மட்டை) ஆகியவை எழுத்திலும் ஒலியிலும் ஒரே மாதிரி இருந்தாலும் வெவ்வேறு பொருள் தருகின்றன. இது Homophones-இலிருந்து வேறுபட்டது; அவை ஒலியில் ஒத்திருந்தும் எழுத்துக்கூட்டில் வேறுபட்டு, வெவ்வேறு பொருள் தரும் (எ.கா. 'flower' மற்றும் 'flour'). எனவே, சரியான விடை Homonyms — தேர்வு C." },

  { idPrefix: 'fb8d803e', correct_answer: 'B',
    explanation: "The Indian National Congress boycotted the First Round Table Conference (November 1930 – January 1931), and Gandhi was in prison at the time. Following the Gandhi-Irwin Pact of March 1931, Gandhi attended the Second Round Table Conference (September–December 1931) as the sole representative of the Congress. He did not attend the Third Round Table Conference, as he was imprisoned again by then. Therefore, statement II — the Second Round Table Conference only — is correct, making option B the correct choice.",
    explanation_ta: 'இந்திய தேசிய காங்கிரஸ் முதல் வட்டமேசை மாநாட்டை (நவம்பர் 1930 – ஜனவரி 1931) புறக்கணித்தது; அப்போது காந்தி சிறையில் இருந்தார். 1931 மார்ச்சில் நடந்த காந்தி-இர்வின் ஒப்பந்தத்தைத் தொடர்ந்து, காங்கிரஸின் ஒரே பிரதிநிதியாக காந்தி இரண்டாம் வட்டமேசை மாநாட்டில் (செப்டம்பர்–டிசம்பர் 1931) கலந்துகொண்டார். மூன்றாம் வட்டமேசை மாநாட்டில் அவர் கலந்துகொள்ளவில்லை, ஏனெனில் அப்போது மீண்டும் சிறையில் இருந்தார். எனவே, கூற்று II — இரண்டாம் வட்டமேசை மாநாடு மட்டும் — சரியானது; தேர்வு B.' },

  { idPrefix: '8aa2c409', correct_answer: 'D',
    explanation: "The Right to Information is recognised as both a Fundamental Right and a Legal Right. The Supreme Court, in cases such as Raj Narain v. State of U.P. and PUCL v. Union of India, has held that the right to information flows from the fundamental right to freedom of speech and expression under Article 19(1)(a) and the right to life under Article 21. It was additionally codified and made enforceable as a statutory (legal) right through the Right to Information Act, 2005. Therefore, RTI is both a Fundamental Right and a Legal Right — option D.",
    explanation_ta: 'தகவல் அறியும் உரிமை, அடிப்படை உரிமையாகவும் சட்ட உரிமையாகவும் அங்கீகரிக்கப்பட்டுள்ளது. ராஜ் நாராயண் எதிர் உத்தரப் பிரதேச மாநிலம் மற்றும் PUCL எதிர் இந்திய ஒன்றியம் போன்ற வழக்குகளில், தகவல் அறியும் உரிமை என்பது அரசியலமைப்பின் 19(1)(அ) பிரிவின் கீழான பேச்சு சுதந்திரம் மற்றும் கருத்து வெளியீட்டு உரிமை மற்றும் 21வது பிரிவின் கீழான வாழ்வுரிமை ஆகியவற்றிலிருந்து பெறப்படுவதாக உச்ச நீதிமன்றம் தீர்ப்பளித்துள்ளது. தகவல் அறியும் உரிமைச் சட்டம், 2005 மூலம் இது ஒரு சட்டரீதியான (legal) உரிமையாகவும் நடைமுறைப்படுத்தத்தக்கதாக்கப்பட்டது. எனவே, RTI அடிப்படை உரிமையும் சட்ட உரிமையும் ஆகும் — தேர்வு D.' },

  { idPrefix: '28ad3e10', correct_answer: 'C',
    explanation: "The Right to Information in India is recognised as both a Fundamental Right and a Legal Right. It flows from the fundamental right to freedom of speech and expression under Article 19(1)(a) and the right to life under Article 21 of the Constitution, as held by the Supreme Court in several landmark judgments. It was also given statutory (legal) force and made enforceable through the Right to Information Act, 2005. Therefore, RTI is both a Fundamental Right and a Legal Right — option C.",
    explanation_ta: 'இந்தியாவில் தகவல் அறியும் உரிமை, அடிப்படை உரிமையாகவும் சட்ட உரிமையாகவும் அங்கீகரிக்கப்பட்டுள்ளது. இது அரசியலமைப்பின் 19(1)(அ) பிரிவின் கீழான பேச்சு சுதந்திரம் மற்றும் கருத்து வெளியீட்டு உரிமை மற்றும் 21வது பிரிவின் கீழான வாழ்வுரிமை ஆகியவற்றிலிருந்து பெறப்படுகிறது என பல முக்கிய தீர்ப்புகளில் உச்ச நீதிமன்றம் கூறியுள்ளது. மேலும், தகவல் அறியும் உரிமைச் சட்டம், 2005 மூலம் இதற்கு சட்டரீதியான வலு அளிக்கப்பட்டு நடைமுறைப்படுத்தத்தக்கதாக்கப்பட்டது. எனவே, RTI அடிப்படை உரிமையும் சட்ட உரிமையும் ஆகும் — தேர்வு C.' },
]

console.log(`=== CONFLICT FIXES ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
const { rows: found } = await c.query(
  `select id::text as id from questions where ${FIXES.map((_, i) => `id::text like $${i + 1}`).join(' or ')}`,
  FIXES.map((f) => f.idPrefix + '%')
)
console.log(`matched ${found.length} of ${FIXES.length} target rows`)
if (found.length !== FIXES.length) { console.error('MISMATCH — aborting'); await c.end(); process.exit(1) }

const { rows: backupRows } = await c.query(
  `select * from questions where ${FIXES.map((_, i) => `id::text like $${i + 1}`).join(' or ')}`,
  FIXES.map((f) => f.idPrefix + '%')
)
writeFileSync('_dedup_conflict_fixes_backup.json', JSON.stringify(backupRows, null, 1))
console.log(`backed up ${backupRows.length} rows to server/_dedup_conflict_fixes_backup.json`)

if (!WRITE) { console.log('DRY RUN — no changes made.'); await c.end(); process.exit(0) }

let updated = 0
for (const f of FIXES) {
  if (f.explanation) {
    const res = await c.query(
      `update questions set correct_answer=$1, explanation=$2, explanation_ta=$3 where id::text like $4`,
      [f.correct_answer, f.explanation, f.explanation_ta, f.idPrefix + '%']
    )
    updated += res.rowCount
  } else {
    const res = await c.query(`update questions set correct_answer=$1 where id::text like $2`, [f.correct_answer, f.idPrefix + '%'])
    updated += res.rowCount
  }
}
console.log(`fixed rows: ${updated}`)
await c.end()
