import { readFileSync, writeFileSync } from 'node:fs'

const groups = JSON.parse(readFileSync('_dedup_v2_outer_part3.json', 'utf8'))

// Build a lookup: any row id -> group index, so decisions are keyed by a row id
// present in that group (self-verifying, immune to index-numbering mistakes).
const idToGroupIdx = new Map()
groups.forEach((g, idx) => g.rows.forEach(r => idToGroupIdx.set(r.id, idx)))

const DECISIONS = new Array(groups.length).fill(null)

function resolveIdx(anyRowId) {
  const idx = idToGroupIdx.get(anyRowId)
  if (idx === undefined) throw new Error(`row id not found in any group: ${anyRowId}`)
  return idx
}

function fp(anyRowId, notes) {
  const idx = resolveIdx(anyRowId)
  if (DECISIONS[idx]) throw new Error(`double-decided idx ${idx}`)
  DECISIONS[idx] = { classification: 'false_positive', notes, keep_id: null, rewrites: [] }
}
function dup(keepId, notes, rewrites) {
  const idx = resolveIdx(keepId)
  // sanity: every rewrite id must belong to the same group as keepId
  for (const rw of rewrites) {
    if (idToGroupIdx.get(rw.id) !== idx) throw new Error(`rewrite id ${rw.id} not in same group as keep id ${keepId}`)
  }
  if (DECISIONS[idx]) throw new Error(`double-decided idx ${idx}`)
  DECISIONS[idx] = { classification: 'true_duplicate', notes, keep_id: keepId, rewrites }
}

// ================= false positives =================
fp('b9135e30-fabe-46bc-8d7b-f6264e3a7e2b', "Different words tested for grammatical-note classification: 'பாண்டம் பாண்டமாக' (reduplication, அடுக்குத்தொடர்) vs 'வாயிலும் சன்னலும்' (எண்ணும்மை conjunction). DB correct_answer differs (D vs A), confirming these are two distinct grammar facts, not the same question reworded.")
fp('5f592f44-72a5-4754-b37c-7d5958672ee2', "Three distinct தளை (metrical foot) rules tested via three different சீர் pairs (மா முன் நேர் / விள முன் நிரை / காய் முன் நேர்), each with its own correct classification (A, B, C respectively per DB). Same template, different grammatical facts.")
fp('617ec1a1-1cfd-442b-b17c-c6e9017a1878', "Different specific word-pairs tested for 'which plant-base term is wrong' (தாள்/தண்டு/கோல்/தூறு vs தட்டு/கழி/கழை/அடி); DB correct_answer differs (D vs C). Different facts, false positive.")
fp('0cfae9c6-20e9-4c1f-8f41-df569ccd525a', "Different words tested for இலக்கணக்குறிப்பு (தடக்கை vs மூதூர்); DB correct_answer differs (A vs D), confirming distinct facts.")
fp('672375f2-70f4-4525-88b9-bc9aad480022', "Four different words (ஊழ் ஊழ் / வளர்வானம் / செந்தீ / வாரா) each testing a distinct grammar classification; DB correct_answer is different for all four rows (A,B,C,D).")
fp('dfc8b7fd-918f-4bfd-b26b-3d89e88f1da7', "Both rows are assertion-style ('கூற்று I/II') questions about how many types வினா (interrogative sentences) is classified into, but the specific statements and item-lists in I/II differ substantially between the two rows, and DB correct_answer differs (D vs A). Note: row efc1b1ae's statement II has an internal defect (says 'எட்டு'/8 while listing only 6 items) — likely a separate text-quality issue worth a look, but not treated as a duplicate here since the tested statement-pairs are genuinely different content.")
fp('fdedb1aa-eea7-47ec-9287-c0fcf9f7363e', "Four different திணை categories (குறிஞ்சி/முல்லை/மருதம்/நெய்தல்), each with its own பெரும்பொழுது/சிறுபொழுது pairing as a distinct fact; DB correct_answer differs across all four rows (A,B,C,D).")
fp('34d41fdc-987a-4d30-96c0-467e001a037e', "Different கருப்பொருள் categories entirely (மரம்/tree-species matching vs யாழ்/lute-type matching) with completely different List-II content; DB correct_answer differs (B vs C).")
fp('d3130f31-be9f-4694-867c-d4b0f05b909f', "Different List-II content for the வெண்பா/ஆசிரியப்பா/கலிப்பா/வஞ்சிப்பா matching (types-count vs sound/rhythm-type); DB correct_answer differs (D vs B). Genuinely different facts about the same four பா types.")
fp('d794b043-1174-4af7-9fea-007016395f63', "Matching question about சீர்/அசை/வாய்ப்பாடு with mostly different சீர் items in List-I (only item A overlaps); DB correct_answer differs (B vs D). Different facts.")
fp('89e628c8-fe1f-4926-a1d5-2b20abba4b6b', "Three different பகுபத உறுப்பிலக்கண விகுதிகள் (ஆன்/ஆள்/து), each a distinct grammatical suffix with its own classification; DB correct_answer differs across all three rows (A,B,C).")
fp('96e5fb04-37a8-4966-83a7-a571b9c0dab9', "Same 3-item list but asked once for Tamil-language collections and once for Kannada-language collections by the same composer (இளையராஜா) — different underlying facts (different correct subset for each language); DB correct_answer content differs (1,2 vs '3 மட்டும்').")
fp('c9ec630b-c225-4033-a7a4-77e039d215b7', "Different word groups tested for இலக்கணக்குறிப்பு (தடந்தேர்/மாமதலை vs நவில்க/உதவுக/கொள்க/தருக/சொல்லுக); DB correct_answer differs (C vs D).")
fp('73bb31fc-7cdd-425b-95c8-9e9c3d81a39a', "Two different awards given to நர்த்தகி நடராஜ் ('சிறந்த கலைஞர்' vs 'ஏ கிரேடு'); DB correct_answer differs (A vs C) — different facts about different awards.")
fp('02b88bd3-546b-4c87-8055-98e627336007', "Two different awarding bodies for நர்த்தகி நடராஜ் (தமிழக அரசு விருது vs இந்திய அரசு விருது); DB correct_answer differs (B vs D) — different facts.")
fp('ab7eafcf-fa2b-4e02-b3e3-44d7ca76e7c8', "Asks about two different aspects of திரு.வி.க's education (who taught him தமிழ் vs who taught him சைவ நூல்கள்); DB correct_answer differs (B vs C), consistent with these being two different teachers/facts, not the same fact reworded.")
fp('21cf5417-1761-47d4-98b1-d53016f7986c', "PLACEHOLDER_WILL_BE_OVERWRITTEN") // will be replaced by dup() below; keep for lint safety then removed
DECISIONS[resolveIdx('21cf5417-1761-47d4-98b1-d53016f7986c')] = null // undo placeholder so dup() can claim it
fp('6a82f625-3541-432a-a7fe-bea5f9317642', "Same 3-different-people structure but each row asks about a different person entirely (பின்னத்தூர் நாராயணசாமி / சோமசுந்தர பாரதியார் / வ.சுப.மாணிக்கம்), each with a different திண்ணைப்பள்ளிக்கூடம் answer; DB correct_answer differs across all three (C, D, B).")
fp('17833c71-586e-408f-9afd-0aeb9e0699ef', "Different books tested (which எட்டுத்தொகை book does NOT discuss புறம் vs which book discusses BOTH அகம் and புறம்); DB correct_answer differs (D vs C) — different facts about different books.")
fp('f7be2fc0-8a07-45a1-8278-7b2a5d3bdad7', "Row 2 has a much larger, different statement set (5 statements covering different Sangam-literature classification points) than row 1 (2 statements); DB correct_answer differs (B vs D). Different scope, not a duplicate.")
fp('1d996812-592e-4e2b-babe-f10a2c056ca7', "Four different நரம்பு (string) counts (21/17/7/16) for யாழ் (lute) types, each a distinct fact; DB correct_answer differs across all four rows (A,B,D,C).")
fp('abb5042d-af77-47fd-94b5-5c9122fca09b', "Three different மெய்ப்பாடு terms (நகை/உவகை/மருட்கை) from Tolkappiyam's list of 8, each with a distinct meaning; DB correct_answer differs across all three rows (D,A,B).")
fp('ca3e40e6-934f-4c74-bb3e-3332329d002c', "Different words from the same poem asked about (வரம் vs சாபம் symbolism in 'திட்டம்'); DB correct_answer differs (C vs D) — different facts.")
fp('287c8b57-27f8-4bf9-8ca2-14e39c78d43e', "PLACEHOLDER") // temp, will be undone
DECISIONS[resolveIdx('287c8b57-27f8-4bf9-8ca2-14e39c78d43e')] = null
fp('e491dacd-e08a-43e5-bd5c-4ecae134828a', "PLACEHOLDER")
DECISIONS[resolveIdx('e491dacd-e08a-43e5-bd5c-4ecae134828a')] = null
fp('f27db3c6-37f9-4974-9efa-3ffb1acd83d5', "Different chromosome-shape definitions (centromere at proximal end/rod-shaped = Telocentric vs centromere near centre forming unequal arms/J-or-L-shaped = Submetacentric); DB correct_answer differs (A vs C). Two distinct definitions from the same vocabulary set.")
fp('391a01c9-3719-4a74-8904-7c58490f2aef', "Different chromosome configurations (22+XX vs 22+XY) each mapping to a different genetic term (Homogametic vs Heterogametic); DB correct_answer differs (A vs B). Different facts sharing vocabulary.")
fp('729fa6f8-56a9-42e8-b578-6014249f1864', "Different fertilising-sperm scenarios (Y-bearing -> male vs X-bearing -> female) with opposite correct outcomes; DB correct_answer differs (B vs A). Different facts, not duplicates.")
fp('e49fdf7a-7ca1-4269-b8d0-ba276bdeb50b', "Different sperm-pairing scenarios for fertilization outcome (X+X -> 44+XX vs X+Y -> 44+XY); DB correct_answer differs (B vs A). Different facts.")
fp('ba195d86-aebf-4771-a10c-3d400d37e3e1', "Different question direction (how chromosomes form a female child vs a male child) with different correct mechanisms; DB correct_answer differs (A vs B). Different facts.")
fp('4f4950ae-328b-4d61-aa18-517f0f9acf33', "PLACEHOLDER")
DECISIONS[resolveIdx('4f4950ae-328b-4d61-aa18-517f0f9acf33')] = null
fp('af78c880-675e-4af9-9a5d-012a01b2130a', "Same 4 option texts and the same 'correct' option text ('Storage of water and nutrients'), but the two rows ask about two different scopes — plant cell vacuoles (large central vacuole, primary storage/turgor role) vs animal cell vacuoles (small, mainly transient storage) — a legitimate compare-and-contrast pair on the syllabus, not a reworded duplicate of the same fact.")
fp('dd85c80b-caef-4b77-b7ee-5cbb2d28fd55', "Three different food-chain relationships (animals that eat secondary consumers / eat plants / eat primary consumers), each mapping to a different trophic-level term; DB correct_answer differs across all three rows (C,A,B).")
fp('1b16364f-7c89-41a0-a5c6-655d9c824435', "Complementary vocabulary pair (biotic vs abiotic factor definitions) — different terms, different correct option text, not a duplicate of the same fact.")
fp('1d4c9117-289e-4417-a37f-1177fa82c40a', "Different stages of wastewater treatment (primary treatment's purpose vs tertiary treatment's purpose), each with its own distinct definition; both landed on option-letter C but the correct option TEXT differs completely between the two rows ('settle heavy solids...' vs 'remove inorganic constituents...').")
fp('c93cb795-16d3-4211-a83a-d2e0cf4ec43b', "Three different biosphere reserves (Nanda Devi/Nokrek/Manas) each located in a different state; DB correct_answer differs across all three rows (A,B,C).")
fp('9a3fdae2-8507-4a23-88da-83001a277a2d', "Two different national parks (Gulf of Mannar Marine NP vs Guindy NP) in different districts; DB correct_answer differs (B vs A).")
fp('6977cccf-ffb2-451b-962e-2677945d723a', "Two different AQI bands ('Unhealthy' 151-200 vs 'Very Unhealthy' 201-300) — different facts on the same numeric scale; DB correct_answer differs (D vs C) and the correct option text differs.")
fp('dc74d636-d395-444a-ad4f-9426ae069c21', "Complementary vocabulary pair (flora vs fauna definitions) — different terms, different facts.")
fp('9a74b58f-154a-4d77-9773-ab124e685010', "PLACEHOLDER")
DECISIONS[resolveIdx('9a74b58f-154a-4d77-9773-ab124e685010')] = null
fp('5aae5ebb-5dae-44dc-8af4-1a0e7e34b5a8', "Different words from the same Kambaramayanam couplet asked about (அன்னவன் vs அமலன் — refer to different characters, Guhan and Rama respectively per DB); DB correct_answer differs (B vs C).")
fp('db8c26f2-8c01-4b6e-aec3-2d458bebd9e0', "Different words from the same Thirukkural couplet (அல்இடத்து vs செல்இடத்து), each with a distinct meaning; DB correct_answer differs (B vs A).")
fp('ba196187-c755-4829-be8c-3bea0e91034c', "Different words from the same verse ('நால்' vs 'இரண்டு'), each referring to a different classical text; DB correct_answer differs (C vs D).")
fp('3358ae03-4260-4723-b0d9-750f379baf8b', "Different words from the same verse (உடுபதி=moon vs இரவி=sun), opposite meanings; DB correct_answer differs (A vs B).")
fp('48c275f1-7c22-4b1e-b9e1-6208eff6c5b5', "Different words tested for அளபெடை classification (வெரீஇய vs உழாஅது), each a distinct grammar fact; DB correct_answer differs (A vs B).")
fp('4ee90b97-8f3f-47c9-b56f-4961ca3cdc7d', "Different words from the same Thirukkural couplet (ஊங்கும் vs அல்லல்), each with a distinct meaning, and the option sets are not even identical (option C differs between rows: நட்பு vs துன்பம்); DB correct_answer differs (B vs C).")
fp('802b9a22-549e-4860-a992-90388baf1737', "Different words from the same verse (உததி=sea vs கூவல்=well), different meanings; DB correct_answer differs (B vs A).")
fp('5728c596-34ae-43d1-a715-46048b620104', "PLACEHOLDER")
DECISIONS[resolveIdx('5728c596-34ae-43d1-a715-46048b620104')] = null

// ================= true duplicates =================
dup('e6365eea-4ad6-481a-87b5-ce25ce591b66',
  "Identical Kambaramayanam-quote question and identical options/answer (A). The only difference is the blank marker at the end of the question ('_______?' vs a malformed '-?'). Row e6365eea uses the clean underscore-blank convention; row 8ebcf5c1's '-?' ending is a formatting artifact. Keeping e6365eea, rewriting 8ebcf5c1 into a different Tamil Nadu Murugan-shrine geography fact (same தமிழ்/10th-Std classification).",
  [{
    id: '8ebcf5c1-faf3-4a91-b0b8-4220c3120284',
    question_text: "முருகப் பெருமானின் ஆறுபடை வீடுகளுள் மதுரை நகருக்கு அருகில் (சுமார் 8 கி.மீ. தொலைவில்) அமைந்துள்ளது எது?",
    question_text_ta: "முருகப் பெருமானின் ஆறுபடை வீடுகளுள் மதுரை நகருக்கு அருகில் (சுமார் 8 கி.மீ. தொலைவில்) அமைந்துள்ளது எது?",
    option_a: "திருச்செந்தூர்", option_b: "திருப்பரங்குன்றம்", option_c: "பழநி", option_d: "சுவாமிமலை",
    option_a_ta: "திருச்செந்தூர்", option_b_ta: "திருப்பரங்குன்றம்", option_c_ta: "பழநி", option_d_ta: "சுவாமிமலை",
    correct_answer: 'B',
    explanation: "முருகப் பெருமானின் ஆறுபடை வீடுகளுள் ஒன்றான திருப்பரங்குன்றம், மதுரை நகருக்கு அருகில் (சுமார் 8 கி.மீ. தொலைவில்) அமைந்துள்ளது. இங்கு முருகன், இந்திரன் மகள் தேவசேனையை (தெய்வானையை) மணந்த கோலத்தில் காட்சி தருகிறார். நக்கீரர் இயற்றிய 'திருமுருகாற்றுப்படை' இத்தலத்தை முதன்மையான படை வீடாகப் போற்றுகிறது. பிற ஐந்து படை வீடுகள் திருச்செந்தூர் (தூத்துக்குடி), பழநி (திண்டுக்கல்), சுவாமிமலை (தஞ்சாவூர் அருகில்), திருத்தணி (திருவள்ளூர்), பழமுதிர்சோலை (மதுரை அருகில் இருந்தாலும் திருப்பரங்குன்றத்தை விட தொலைவில்) ஆகும்.",
    explanation_ta: "முருகப் பெருமானின் ஆறுபடை வீடுகளுள் ஒன்றான திருப்பரங்குன்றம், மதுரை நகருக்கு அருகில் (சுமார் 8 கி.மீ. தொலைவில்) அமைந்துள்ளது. இங்கு முருகன், இந்திரன் மகள் தேவசேனையை (தெய்வானையை) மணந்த கோலத்தில் காட்சி தருகிறார். நக்கீரர் இயற்றிய 'திருமுருகாற்றுப்படை' இத்தலத்தை முதன்மையான படை வீடாகப் போற்றுகிறது. பிற ஐந்து படை வீடுகள் திருச்செந்தூர் (தூத்துக்குடி), பழநி (திண்டுக்கல்), சுவாமிமலை (தஞ்சாவூர் அருகில்), திருத்தணி (திருவள்ளூர்), பழமுதிர்சோலை (மதுரை அருகில் இருந்தாலும் திருப்பரங்குன்றத்தை விட தொலைவில்) ஆகும்.",
  }])

dup('87101ea8-303f-450b-8b10-bde473b5719c',
  "The two statement-analysis questions are textually near-identical (row f5627729 has a redundant extra word 'அவற்றின்' inserted before 'அவ்வெழுத்து' plus an extra comma) and both have DB correct_answer C. Same underlying grammar rule, same scenario, same answer — keeping the cleaner row 87101ea8, rewriting f5627729 into a different, well-established Tamil-script fact (letter counts) at the same தமிழ்/12th-Std classification.",
  [{
    id: 'f5627729-2087-4384-b1a1-0eaa3ec508f5',
    question_text: "கூற்றுகளை ஆராய்க.\n1. தமிழ் மொழியில் உயிர் எழுத்துக்களின் எண்ணிக்கை 12 ஆகும்.\n2. உயிர், மெய், உயிர்மெய் மற்றும் ஆய்தம் ஆகிய அனைத்தும் சேர்ந்து தமிழில் மொத்த எழுத்துக்களின் எண்ணிக்கை 247 ஆகும்.",
    question_text_ta: "கூற்றுகளை ஆராய்க.\n1. தமிழ் மொழியில் உயிர் எழுத்துக்களின் எண்ணிக்கை 12 ஆகும்.\n2. உயிர், மெய், உயிர்மெய் மற்றும் ஆய்தம் ஆகிய அனைத்தும் சேர்ந்து தமிழில் மொத்த எழுத்துக்களின் எண்ணிக்கை 247 ஆகும்.",
    option_a: "1 மட்டும் சரி", option_b: "2 மட்டும் சரி", option_c: "இரண்டும் சரி", option_d: "இரண்டும் தவறு",
    option_a_ta: "1 மட்டும் சரி", option_b_ta: "2 மட்டும் சரி", option_c_ta: "இரண்டும் சரி", option_d_ta: "இரண்டும் தவறு",
    correct_answer: 'C',
    explanation: "தமிழ் மொழியில் 12 உயிர் எழுத்துக்களும் (அ, ஆ, இ, ஈ ... ஔ), 18 மெய் எழுத்துக்களும் (க் முதல் ன் வரை) உள்ளன. இவை இரண்டும் இணைந்து உருவாகும் உயிர்மெய் எழுத்துக்கள் 12 × 18 = 216. இவற்றுடன் தனிச்சிறப்பு எழுத்தான ஆய்தம் (ஃ) ஒன்றையும் சேர்த்தால், தமிழில் மொத்த எழுத்துக்களின் எண்ணிக்கை 12 + 18 + 216 + 1 = 247 ஆகும். எனவே கூற்று 1 மற்றும் கூற்று 2 இரண்டுமே சரியானவை.",
    explanation_ta: "தமிழ் மொழியில் 12 உயிர் எழுத்துக்களும் (அ, ஆ, இ, ஈ ... ஔ), 18 மெய் எழுத்துக்களும் (க் முதல் ன் வரை) உள்ளன. இவை இரண்டும் இணைந்து உருவாகும் உயிர்மெய் எழுத்துக்கள் 12 × 18 = 216. இவற்றுடன் தனிச்சிறப்பு எழுத்தான ஆய்தம் (ஃ) ஒன்றையும் சேர்த்தால், தமிழில் மொத்த எழுத்துக்களின் எண்ணிக்கை 12 + 18 + 216 + 1 = 247 ஆகும். எனவே கூற்று 1 மற்றும் கூற்று 2 இரண்டுமே சரியானவை.",
  }])

dup('cd3c37dc-e897-490f-ae7f-a2c50620ae87',
  "Same real-world fact (India's National Disaster Management Authority — the Disaster Management Act envisaging it was enacted 23 December 2005, verified via web search against Wikipedia/DrishtiIAS/NDMA.gov.in) tested from two near-identical angles; both rows' DB correct_answer already point to 2005-12-23 (no conflict). Row cd3c37dc uses the complete/official name 'தேசிய பேரிடர் மேலாண்மை ஆணையம்' (National DMA) while row 21cf5417 omits 'தேசிய' (National) — keeping the more precise/complete cd3c37dc, rewriting 21cf5417 into a different, verified civics fact (NGT establishment year) at the same தமிழ்/12th-Std classification.",
  [{
    id: '21cf5417-1761-47d4-98b1-d53016f7986c',
    question_text: "இந்தியாவின் தேசிய பசுமை தீர்ப்பாயம் (National Green Tribunal) எந்த ஆண்டு நிறுவப்பட்டது?",
    question_text_ta: "இந்தியாவின் தேசிய பசுமை தீர்ப்பாயம் (National Green Tribunal) எந்த ஆண்டு நிறுவப்பட்டது?",
    option_a: "2008", option_b: "2009", option_c: "2010", option_d: "2012",
    option_a_ta: "2008", option_b_ta: "2009", option_c_ta: "2010", option_d_ta: "2012",
    correct_answer: 'C',
    explanation: "இந்தியாவின் தேசிய பசுமை தீர்ப்பாயம் (National Green Tribunal - NGT), தேசிய பசுமை தீர்ப்பாயச் சட்டம், 2010-ன் (National Green Tribunal Act, 2010) அடிப்படையில் 2010ஆம் ஆண்டு அக்டோபர் மாதம் 18ஆம் தேதி நிறுவப்பட்டது. சுற்றுச்சூழல் பாதுகாப்பு, வனங்கள், உயிரின வளம் மற்றும் இயற்கை வளங்கள் தொடர்பான வழக்குகளை விரைவாகத் தீர்ப்பதற்காக, சிறப்புத் தொழில்நுட்ப அறிவுடன் இந்த தீர்ப்பாயம் உருவாக்கப்பட்டது.",
    explanation_ta: "இந்தியாவின் தேசிய பசுமை தீர்ப்பாயம் (National Green Tribunal - NGT), தேசிய பசுமை தீர்ப்பாயச் சட்டம், 2010-ன் (National Green Tribunal Act, 2010) அடிப்படையில் 2010ஆம் ஆண்டு அக்டோபர் மாதம் 18ஆம் தேதி நிறுவப்பட்டது. சுற்றுச்சூழல் பாதுகாப்பு, வனங்கள், உயிரின வளம் மற்றும் இயற்கை வளங்கள் தொடர்பான வழக்குகளை விரைவாகத் தீர்ப்பதற்காக, சிறப்புத் தொழில்நுட்ப அறிவுடன் இந்த தீர்ப்பாயம் உருவாக்கப்பட்டது.",
  }])

dup('1413b562-6be0-440a-ba33-07f2acb08595',
  "Same real-world fact (Wangari Maathai founded the Green Belt Movement in Kenya in 1977) tested from two complementary angles (asking for the year vs asking for the person, given the other); both rows' DB correct_answer already agree (1977 / Wangari Maathai, no conflict). Row 1413b562 (asking for the year, with plain year options) is cleaner; row 3eef8d03's person-options include fabricated-looking distractor names ('ஜிதுநாத்', 'நாதுநாத் ஜிட்டா') which are low quality. Keeping 1413b562, rewriting 3eef8d03 into a different, verified environmental-movement fact at the same தமிழ்/12th-Std classification.",
  [{
    id: '3eef8d03-ef56-4cc1-ae41-c4813d07bdbf',
    question_text: "நர்மதா பச்சாவோ ஆந்தோலன் (Narmada Bachao Andolan) என்ற சுற்றுச்சூழல் இயக்கத்தை 1985ஆம் ஆண்டு தொடங்கியவர் யார்?",
    question_text_ta: "நர்மதா பச்சாவோ ஆந்தோலன் (Narmada Bachao Andolan) என்ற சுற்றுச்சூழல் இயக்கத்தை 1985ஆம் ஆண்டு தொடங்கியவர் யார்?",
    option_a: "மேதா பட்கர்", option_b: "அருந்ததி ராய்", option_c: "சுனிதா நாராயண்", option_d: "வந்தனா சிவா",
    option_a_ta: "மேதா பட்கர்", option_b_ta: "அருந்ததி ராய்", option_c_ta: "சுனிதா நாராயண்", option_d_ta: "வந்தனா சிவா",
    correct_answer: 'A',
    explanation: "நர்மதா ஆற்றின் மீது கட்டப்படும் சர்தார் சரோவர் போன்ற பெரிய அணைகளால் இடம்பெயரும் மக்களின் உரிமைகளுக்காகவும், சுற்றுச்சூழல் பாதுகாப்பிற்காகவும் 1985ஆம் ஆண்டு மேதா பட்கர் (Medha Patkar) தலைமையில் நர்மதா பச்சாவோ ஆந்தோலன் இயக்கம் தொடங்கப்பட்டது. இது இந்தியாவின் முக்கிய சுற்றுச்சூழல்/சமூக இயக்கங்களில் ஒன்றாகும்; 1993இல் உலக வங்கி நர்மதா திட்டத்திற்கான கடனை திரும்பப் பெற்றதற்கு இந்த இயக்கமே முக்கியக் காரணமாக அமைந்தது.",
    explanation_ta: "நர்மதா ஆற்றின் மீது கட்டப்படும் சர்தார் சரோவர் போன்ற பெரிய அணைகளால் இடம்பெயரும் மக்களின் உரிமைகளுக்காகவும், சுற்றுச்சூழல் பாதுகாப்பிற்காகவும் 1985ஆம் ஆண்டு மேதா பட்கர் (Medha Patkar) தலைமையில் நர்மதா பச்சாவோ ஆந்தோலன் இயக்கம் தொடங்கப்பட்டது. இது இந்தியாவின் முக்கிய சுற்றுச்சூழல்/சமூக இயக்கங்களில் ஒன்றாகும்; 1993இல் உலக வங்கி நர்மதா திட்டத்திற்கான கடனை திரும்பப் பெற்றதற்கு இந்த இயக்கமே முக்கியக் காரணமாக அமைந்தது.",
  }])

dup('287c8b57-27f8-4bf9-8ca2-14e39c78d43e',
  "Both rows test the identical set of 4 vitamin<->deficiency-disease pairings (Vit B/Beriberi, Vit C/Scurvy, Vit D/Rickets, Vit A/Night-blindness), just with List-I and List-II transposed between the two rows; both DB correct_answer already resolve to the same real-world-correct mapping (verified), so no conflict. Row cf509c77's Tamil fields contain a mixed-script corruption artifact — Devanagari characters 'अन्ध' embedded inside the Tamil word for 'night blindness' ('இரவு अन्धத் தன்மை') in both question_text_ta and explanation_ta — while row 287c8b57's Tamil is clean ('இரவு பார்வை குறைபாடு'). Keeping the clean 287c8b57, rewriting the corrupted cf509c77 into a different, verified mineral-deficiency fact set at the same Zoology/Nutrition classification.",
  [{
    id: 'cf509c77-617d-47c4-9d34-8492013f2f00',
    question_text: "Match List-I (Mineral) with List-II (Deficiency disorder) and select your answer using the codes given below:\n\nList I:\nA) Iron\nB) Iodine\nC) Calcium\nD) Zinc\n\nList II:\n1) Anaemia\n2) Goitre\n3) Osteoporosis\n4) Growth retardation\n\nSelect the correct matching code:",
    question_text_ta: "பட்டியல்-I (தாது உப்பு) ஐ பட்டியல்-II (குறைபாட்டு நோய்) உடன் சரியாகப் பொருத்தி கீழே கொடுக்கப்பட்டுள்ள குறியீட்டைப் பயன்படுத்தி சரியான விடையைத் தேர்ந்தெடுக்கவும்:\n\nபட்டியல் I:\nA) இரும்பு\nB) அயோடின்\nC) கால்சியம்\nD) துத்தநாகம்\n\nபட்டியல் II:\n1) இரத்த சோகை (Anaemia)\n2) தைராய்டு வீக்கம் (Goitre)\n3) எலும்பு புரையோட்டம் (Osteoporosis)\n4) வளர்ச்சிக் குன்றல் (Growth retardation)\n\nசரியான பொருத்தக் குறியீட்டைத் தேர்ந்தெடுக்கவும்:",
    option_a: "A-1, B-2, C-3, D-4", option_b: "A-2, B-1, C-4, D-3", option_c: "A-3, B-4, C-1, D-2", option_d: "A-4, B-3, C-2, D-1",
    option_a_ta: "A-1, B-2, C-3, D-4", option_b_ta: "A-2, B-1, C-4, D-3", option_c_ta: "A-3, B-4, C-1, D-2", option_d_ta: "A-4, B-3, C-2, D-1",
    correct_answer: 'A',
    explanation: "Iron deficiency causes anaemia (reduced haemoglobin/red blood cell production). Iodine deficiency causes goitre (enlargement of the thyroid gland). Long-term calcium deficiency causes osteoporosis (weak, brittle bones). Zinc deficiency causes growth retardation, especially in children, along with impaired immune function. Hence the correct matching is A-1, B-2, C-3, D-4.",
    explanation_ta: "இரும்புச் சத்துக் குறைபாடு இரத்த சோகையை (Anaemia) ஏற்படுத்துகிறது (சிவப்பு அணுக்கள்/ஹீமோகுளோபின் உற்பத்தி குறைவதால்). அயோடின் குறைபாடு தைராய்டு சுரப்பியின் வீக்கத்தை (Goitre) ஏற்படுத்துகிறது. கால்சியம் நீண்டகாலக் குறைபாடு எலும்புகள் மெலிந்து பலவீனமடையும் எலும்பு புரையோட்டத்தை (Osteoporosis) ஏற்படுத்துகிறது. துத்தநாகக் (Zinc) குறைபாடு, குறிப்பாகக் குழந்தைகளில், வளர்ச்சிக் குன்றலையும் நோய் எதிர்ப்பாற்றல் குறைவையும் ஏற்படுத்துகிறது. எனவே சரியான பொருத்தம் A-1, B-2, C-3, D-4 ஆகும்.",
  }])

dup('dbc24b86-1968-4c9b-98f6-893248e99abc',
  "Same real-world fact (Vitamin A deficiency causes night blindness, verified) tested twice with different option layouts; both DB correct_answer resolve to Vitamin A (no conflict). Row e491dacd's options are bare letters ('C','D','E','A') without the word 'Vitamin', which is confusing/ambiguous formatting, and its Tamil fields contain corruption artifacts (broken mixed-script word 'retiனாவில்' for 'retina', and a stray non-sequitur phrase 'இன்றத்தமிழில்' in the explanation). Row dbc24b86's options are clearly labelled ('Vitamin A/B/K/E') and its Tamil is clean apart from one minor formatting glitch. Keeping dbc24b86, rewriting e491dacd into a different, verified vitamin-deficiency fact (Vitamin K and blood clotting) at the same Zoology/Human Diseases classification.",
  [{
    id: 'e491dacd-e08a-43e5-bd5c-4ecae134828a',
    question_text: "Deficiency of which vitamin leads to impaired blood clotting and an increased tendency to bleed?",
    question_text_ta: "எந்த வைட்டமின் குறைபாடு, இரத்தம் உறைதல் பாதிக்கப்பட்டு அதிக இரத்தப்போக்கு ஏற்படும் நிலைக்கு வழிவகுக்கும்?",
    option_a: "Vitamin B12", option_b: "Vitamin K", option_c: "Vitamin A", option_d: "Vitamin E",
    option_a_ta: "வைட்டமின் B12", option_b_ta: "வைட்டமின் K", option_c_ta: "வைட்டமின் A", option_d_ta: "வைட்டமின் E",
    correct_answer: 'B',
    explanation: "Vitamin K is essential for the liver's synthesis of several blood clotting factors (including prothrombin). A deficiency of Vitamin K impairs the blood clotting process, leading to easy bruising and prolonged or excessive bleeding. Green leafy vegetables are a rich dietary source of Vitamin K.",
    explanation_ta: "இரத்தம் உறைவதற்குத் தேவையான பல உறைதல் காரணிகளை (ப்ரோத்ரோம்பின் உட்பட) கல்லீரல் உற்பத்தி செய்ய வைட்டமின் K இன்றியமையாதது. வைட்டமின் K குறைபாடு இரத்தம் உறையும் செயல்முறையைப் பாதித்து, எளிதில் காயங்கள் ஏற்படுதல் மற்றும் அதிகமான/நீடித்த இரத்தப்போக்கு ஏற்படுவதற்கு வழிவகுக்கும். கீரை வகைகள் போன்ற பச்சிலைக் காய்கறிகள் வைட்டமின் K-வின் சிறந்த மூலமாகும்.",
  }])

dup('7523bf2d-10fe-4bae-8e1e-2e1855780306',
  "Same question ('which of the following is a complex tissue') with the same 4 options (just reordered) and the same real-world-correct answer, Xylem (verified: Xylem and Phloem are the complex tissues in plants, composed of multiple cell types; Parenchyma/Collenchyma/Sclerenchyma are simple tissues); both DB correct_answer already point to Xylem (no conflict). Row 7523bf2d is filed under the correct subject (Botany) for a plant-tissue question and its Tamil explanation correctly uses 'நீர்' for water, whereas row 4f4950ae is mis-filed under Zoology and its Tamil explanation uses the incorrect/nonsensical word 'ஊர்ஜிதம்' where 'நீர்' (water) was meant — a translation error. Keeping 7523bf2d, rewriting 4f4950ae into a different, verified animal-tissue fact fitting its own Zoology classification.",
  [{
    id: '4f4950ae-328b-4d61-aa18-517f0f9acf33',
    question_text: "Which of the following is classified as a connective tissue in the human body?",
    question_text_ta: "மனித உடலில் பின்வருவனவற்றுள் எது இணைப்புத் திசுவாக (connective tissue) வகைப்படுத்தப்படுகிறது?",
    option_a: "Skeletal muscle", option_b: "Cartilage", option_c: "Nervous tissue", option_d: "Epithelium",
    option_a_ta: "எலும்புத் தசை (Skeletal muscle)", option_b_ta: "குருத்தெலும்பு (Cartilage)", option_c_ta: "நரம்புத் திசு (Nervous tissue)", option_d_ta: "மேல்தோல் திசு (Epithelium)",
    correct_answer: 'B',
    explanation: "Cartilage is a type of connective tissue in the human body. Connective tissues (which also include bone, blood, tendons, ligaments, and adipose/fat tissue) function to bind, support, and protect other tissues and organs. In contrast, skeletal muscle is muscular tissue, nervous tissue transmits electrical impulses, and epithelium covers body surfaces and lines cavities — these make up the other three of the four basic animal tissue types.",
    explanation_ta: "குருத்தெலும்பு (Cartilage) மனித உடலில் ஒரு இணைப்புத் திசு (connective tissue) ஆகும். இணைப்புத் திசுக்களில் எலும்பு, இரத்தம், தசைநாண், தசைப்பிணைப்பு, கொழுப்புத் திசு ஆகியவையும் அடங்கும்; இவை பிற திசுக்களையும் உறுப்புகளையும் இணைத்தல், தாங்குதல், பாதுகாத்தல் ஆகிய பணிகளைச் செய்கின்றன. இதற்கு மாறாக, எலும்புத் தசை என்பது தசைத் திசு (muscular tissue), நரம்புத் திசு மின் தூண்டல்களைக் கடத்துகிறது, மேல்தோல் திசு உடலின் மேற்பரப்புகளையும் குழிவுகளையும் மூடுகிறது — இவை விலங்கு அடிப்படைத் திசுக்களின் நான்கு வகைகளில் மற்ற மூன்று வகைகளாகும்.",
  }])

dup('44a7dc96-ec0f-427c-bc68-d24aec7ed893',
  "Same question and same 4 options with the same DB correct_answer (A, 'National Rural Development Programme'); the only difference is a typo — row 9a74b58f has 'Jawahar Rozgr Yojana' (missing a letter) and 'Self-employment', while row 44a7dc96 has the correctly spelled 'Jawahar Rozgar Yojana' and 'Self employment', and this typo carries into 9a74b58f's Tamil option text too. Keeping the correctly-spelled 44a7dc96, rewriting 9a74b58f into a different, verified Indian rural-employment-scheme fact (MGNREGA's 100-day guarantee, verified via web search) at the same Economy classification (preserving its own topic 'Structure of Indian Economy and Employment Generation').",
  [{
    id: '9a74b58f-154a-4d77-9773-ab124e685010',
    question_text: "Under the Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA), how many days of guaranteed wage employment per financial year is provided to every rural household whose adult members volunteer for unskilled manual work?",
    question_text_ta: "மகாத்மா காந்தி தேசிய கிராமப்புற வேலைவாய்ப்பு உறுதிச் சட்டத்தின் (MGNREGA) கீழ், திறமையற்ற உடல் உழைப்புப் பணிக்குத் தன்னார்வத்துடன் முன்வரும் வயது வந்த உறுப்பினர்களைக் கொண்ட ஒவ்வொரு கிராமப்புற குடும்பத்திற்கும் ஒரு நிதியாண்டில் எத்தனை நாட்கள் உறுதியான ஊதிய வேலைவாய்ப்பு வழங்கப்படுகிறது?",
    option_a: "90 days", option_b: "100 days", option_c: "120 days", option_d: "150 days",
    option_a_ta: "90 நாட்கள்", option_b_ta: "100 நாட்கள்", option_c_ta: "120 நாட்கள்", option_d_ta: "150 நாட்கள்",
    correct_answer: 'B',
    explanation: "The Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA), 2005 guarantees every rural household whose adult members volunteer to do unskilled manual work at least 100 days of wage employment in a financial year. This scheme aims to enhance livelihood security in rural areas and is a legal entitlement, not a discretionary scheme.",
    explanation_ta: "மகாத்மா காந்தி தேசிய கிராமப்புற வேலைவாய்ப்பு உறுதிச் சட்டம் (MGNREGA), 2005, திறமையற்ற உடல் உழைப்புப் பணிக்குத் தன்னார்வத்துடன் முன்வரும் வயது வந்த உறுப்பினர்களைக் கொண்ட ஒவ்வொரு கிராமப்புற குடும்பத்திற்கும் ஒரு நிதியாண்டில் குறைந்தபட்சம் 100 நாட்கள் ஊதிய வேலைவாய்ப்பை உறுதி செய்கிறது. கிராமப்புறங்களில் வாழ்வாதார பாதுகாப்பை மேம்படுத்துவதே இத்திட்டத்தின் நோக்கமாகும்; இது ஒரு தன்னிச்சையான திட்டமல்ல, சட்டப்பூர்வ உரிமையாகும்.",
  }])

dup('4891f341-899d-4133-abb5-4195a08b1bba',
  "Textually identical statement-set about V.D. Savarkar (all four statements true) with the same DB correct_answer (D) in both rows; the only differences are a mismatched quote-mark style in row 5728c596 (opening curly quote paired with a straight closing quote around the book title) and an English-Tamil code-mixing artifact in its Tamil translation ('ஊக்குவிக்க purposesக்கு' — an English word with a Tamil suffix glued on). Row 4891f341's Tamil is clean throughout. Keeping 4891f341, rewriting 5728c596 into a different, verified Indian revolutionary-movement fact (the 1929 Central Legislative Assembly bombing, verified via web search) at the same Indian National Movement classification (preserving its own topic 'Revolutionary Movement in India').",
  [{
    id: '5728c596-34ae-43d1-a715-46048b620104',
    question_text: "Who accompanied Bhagat Singh in throwing bombs inside the Central Legislative Assembly in Delhi on 8 April 1929?",
    question_text_ta: "1929ஆம் ஆண்டு ஏப்ரல் 8ஆம் தேதி டெல்லியிலுள்ள மத்திய சட்டமன்றத்தில் பகத் சிங்குடன் இணைந்து குண்டுகளை வீசியவர் யார்?",
    option_a: "Batukeshwar Dutt", option_b: "Sukhdev", option_c: "Rajguru", option_d: "Chandrashekhar Azad",
    option_a_ta: "படுகேஸ்வர் தத்", option_b_ta: "சுக்தேவ்", option_c_ta: "ராஜ்குரு", option_d_ta: "சந்திரசேகர் ஆசாத்",
    correct_answer: 'A',
    explanation: "On 8 April 1929, Bhagat Singh, along with Batukeshwar Dutt, threw two low-intensity bombs inside the Central Legislative Assembly in Delhi to protest the Public Safety Bill and the Trade Disputes Bill, shouting 'Inquilab Zindabad'. Both deliberately made no attempt to escape and were arrested on the spot. Sukhdev and Rajguru were fellow revolutionaries later tried and executed with Bhagat Singh in the Lahore Conspiracy Case, but were not present at this bombing; Chandrashekhar Azad was a senior HSRA leader not involved in this specific act.",
    explanation_ta: "1929ஆம் ஆண்டு ஏப்ரல் 8ஆம் தேதி, பொதுப் பாதுகாப்பு மசோதா மற்றும் தொழிற் தகராறு மசோதாவை எதிர்த்து, பகத் சிங்கும் படுகேஸ்வர் தத்தும் இணைந்து டெல்லி மத்திய சட்டமன்றத்தில் இரு குறைந்த வலிமையுள்ள குண்டுகளை வீசி, 'இன்குலாப் ஜிந்தாபாத்' என்று முழக்கமிட்டனர். இருவரும் தப்பிக்க முயலாமல் அப்போதே கைது செய்யப்பட்டனர். சுக்தேவும் ராஜ்குருவும் பின்னர் லாகூர் சதி வழக்கில் பகத் சிங்குடன் சேர்ந்து தூக்கிலிடப்பட்ட சக புரட்சியாளர்கள் ஆவர், ஆனால் இக்குறிப்பிட்ட குண்டு வீச்சின் போது அவர்கள் அங்கு இருக்கவில்லை; சந்திரசேகர் ஆசாத் இந்துஸ்தான் சோசலிச குடியரசுக் கழகத்தின் (HSRA) மூத்த தலைவராக இருந்தாலும் இந்தச் செயலில் ஈடுபடவில்லை.",
  }])

// ================= assemble & write =================
const missing = []
groups.forEach((g, idx) => { if (!DECISIONS[idx]) missing.push({ idx, sig: g.sig }) })
if (missing.length) {
  console.error('MISSING DECISIONS for groups:', JSON.stringify(missing, null, 1))
  throw new Error(`${missing.length} groups have no decision`)
}

const out = groups.map((g, idx) => {
  const d = DECISIONS[idx]
  const entry = {
    sig: g.sig,
    classification: d.classification,
    notes: d.notes,
    keep_id: d.keep_id,
    rewrites: d.rewrites,
  }
  if (d.classification === 'conflict') entry.conflict_details = d.notes
  return entry
})

writeFileSync('_dedup_outer_batch3.json', JSON.stringify(out, null, 1))
console.log('wrote _dedup_outer_batch3.json with', out.length, 'entries')
const counts = {}
out.forEach(e => { counts[e.classification] = (counts[e.classification] || 0) + 1 })
console.log(counts)
