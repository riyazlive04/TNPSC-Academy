import type { GroupType, MockBlueprint } from '../types'
import type { Lang } from '../store/languageStore'

// ─── Subject display names (English → Tamil) ────────────────────────────────
// The question bank stores subjects in English. This map lets the pickers and
// test labels show Tamil subject names when the user has chosen Tamil. Keyed by
// the exact English strings used across the subject / PYQ banks; unknown names
// fall through to English unchanged.
export const SUBJECT_NAME_TA: Record<string, string> = {
  Physics: 'இயற்பியல்',
  Chemistry: 'வேதியியல்',
  Biology: 'உயிரியல்',
  'General Science': 'பொது அறிவியல்',
  Geography: 'புவியியல்',
  History: 'வரலாறு',
  'History and INM': 'வரலாறு மற்றும் இந்திய தேசிய இயக்கம்',
  'Indian National Movement': 'இந்திய தேசிய இயக்கம்',
  Polity: 'அரசியலமைப்பு',
  Economy: 'பொருளியல்',
  'Indian Economy': 'இந்தியப் பொருளாதாரம்',
  'Tamil Nadu Administration': 'தமிழ்நாடு நிர்வாகம்',
  'Development Administration of TamilNadu': 'தமிழ்நாடு வளர்ச்சி நிர்வாகம்',
  'History, Culture & Heritage of TN': 'தமிழ்நாட்டின் வரலாறு, பண்பாடு & பாரம்பரியம்',
  'History Culture Heritage of TN': 'தமிழ்நாட்டின் வரலாறு, பண்பாடு & பாரம்பரியம்',
  'History, Culture, Heritage': 'வரலாறு, பண்பாடு, பாரம்பரியம்',
  Tamil: 'தமிழ்',
  English: 'ஆங்கிலம்',
  'Current Affairs': 'நடப்பு நிகழ்வுகள்',
  Aptitude: 'திறனாய்வு மற்றும் மனக்கணக்கு',
}

/** A subject name in the chosen language: Tamil for 'ta', "EN / TA" for 'both',
 *  English otherwise. Unknown subjects return unchanged. */
export function subjectName(name: string, lang: Lang | null): string {
  const ta = SUBJECT_NAME_TA[name]
  if (!ta) return name
  if (lang === 'ta') return ta
  if (lang === 'both') return `${name} / ${ta}`
  return name
}

// ─── Topic display names (English → Tamil) ──────────────────────────────────
// The Subject Practice bank has a fixed set of ~100 syllabus topics (plus the
// sub-group headings). They're stored in English; this map shows them in Tamil.
// PYQ's per-question micro-topics are NOT here, so they fall through to English.
export const TOPIC_NAME_TA: Record<string, string> = {
  '06th-Std': '6ஆம் வகுப்பு',
  'Acids, Base and Salts': 'அமிலங்கள், காரங்கள் மற்றும் உப்புகள்',
  'Agricultural Pattern': 'வேளாண் முறை',
  Budget: 'பட்ஜெட்',
  Citizenship: 'குடியுரிமை',
  'Classification of Living Organism': 'உயிரினங்களின் வகைப்பாடு',
  'Constitution of India': 'இந்திய அரசியலமைப்பு',
  'Development of Press in Modern India': 'நவீன இந்தியாவில் பத்திரிகை வளர்ச்சி',
  'Directive Principles of State Policy': 'அரசின் வழிகாட்டு நெறிமுறைகள்',
  'e-Governance in TN': 'தமிழ்நாட்டில் மின்-ஆளுகை',
  'Economic Committees': 'பொருளாதாரக் குழுக்கள்',
  'Economic Reforms': 'பொருளாதார சீர்திருத்தங்கள்',
  'Education & Health Systems': 'கல்வி & சுகாதார அமைப்புகள்',
  Election: 'தேர்தல்',
  'Electricity and Magnetism': 'மின்சாரம் மற்றும் காந்தவியல்',
  'Electronics and Communications': 'மின்னணுவியல் மற்றும் தொடர்பு',
  'Elements and Compounds': 'தனிமங்கள் மற்றும் சேர்மங்கள்',
  'Environment and Ecology': 'சுற்றுச்சூழல் மற்றும் சூழலியல்',
  'Everyday application of the basic principles of Mechanics':
    'இயக்கவியலின் அடிப்படைக் கோட்பாடுகளின் அன்றாடப் பயன்பாடு',
  Evolution: 'பரிணாமம்',
  'Evolution of Indian Constitution': 'இந்திய அரசியலமைப்பின் பரிணாமம்',
  'Fertilizers and Pesticides': 'உரங்கள் மற்றும் பூச்சிக்கொல்லிகள்',
  'Figures of Speech': 'அணி இலக்கணம்',
  'Finance Commission': 'நிதி ஆணையம்',
  'Five Year Plan Models-An Assessment': 'ஐந்தாண்டுத் திட்ட மாதிரிகள் - மதிப்பீடு',
  'Forest and Wildlife': 'காடு மற்றும் வனவிலங்குகள்',
  'Fundamental Rights': 'அடிப்படை உரிமைகள்',
  'Gandhi & Early Movements': 'காந்தி & ஆரம்பகால இயக்கங்கள்',
  'General Scientific Laws': 'பொது அறிவியல் விதிகள்',
  Genetics: 'மரபியல்',
  'Geography of TN & its Impact on Economic Growth':
    'தமிழ்நாட்டின் புவியியல் & பொருளாதார வளர்ச்சியில் அதன் தாக்கம்',
  'Government Schemes': 'அரசுத் திட்டங்கள்',
  Grammar: 'இலக்கணம்',
  'Grammar and Comprehension': 'இலக்கணம் மற்றும் விளக்கம்',
  'Growth of Jainism and Buddhism': 'சமணம் மற்றும் பௌத்தத்தின் வளர்ச்சி',
  'Health and Hygiene': 'சுகாதாரம் மற்றும் தூய்மை',
  'History of Tamil society': 'தமிழ்ச் சமூகத்தின் வரலாறு',
  'Human Development Indicators': 'மனித மேம்பாட்டுக் குறியீடுகள்',
  'Human Diseases': 'மனித நோய்கள்',
  'Human rights charter': 'மனித உரிமைகள் சாசனம்',
  'Indian Freedom Struggle': 'இந்திய சுதந்திரப் போராட்டம்',
  'Indian National Congress': 'இந்திய தேசிய காங்கிரஸ்',
  'Indus Valley Civilization (2500 - 1800 BC)': 'சிந்து சமவெளி நாகரிகம் (கி.மு. 2500 - 1800)',
  'Industrial growth': 'தொழில் வளர்ச்சி',
  'Judiciary in India': 'இந்தியாவில் நீதித்துறை',
  'Local Governments': 'உள்ளாட்சி அமைப்புகள்',
  Location: 'அமைவிடம்',
  'Main Concepts of Life Science': 'உயிரியலின் முக்கியக் கருத்துகள்',
  'Mechanics and Properties of Matter': 'இயக்கவியல் மற்றும் பொருளின் பண்புகள்',
  'Monsoon, Rainfall, Weather and Climate': 'பருவமழை, மழை, வானிலை மற்றும் காலநிலை',
  'Natural Calamity': 'இயற்கைப் பேரிடர்',
  'Nature of Universe': 'பேரண்டத்தின் இயல்பு',
  'Nuclear Physics and Laser': 'அணுக்கரு இயற்பியல் மற்றும் லேசர்',
  Nutrition: 'ஊட்டச்சத்து',
  'Other Topics': 'பிற தலைப்புகள்',
  Others: 'பிற',
  'Partition of India and Independence': 'இந்தியப் பிரிவினை மற்றும் சுதந்திரம்',
  'Petroleum Products': 'பெட்ரோலியப் பொருட்கள்',
  'Physical Features': 'இயற்கை அமைப்புகள்',
  Physiology: 'உடலியக்கவியல்',
  'Planning Commission and Niti Ayog': 'திட்டக்குழு மற்றும் நிதி ஆயோக்',
  'Political Institution Established before Congress':
    'காங்கிரஸுக்கு முன் நிறுவப்பட்ட அரசியல் அமைப்புகள்',
  'Political Parties & Welfare Schemes': 'அரசியல் கட்சிகள் & நலத்திட்டங்கள்',
  'Population Density and Distribution': 'மக்கள்தொகை அடர்த்தி மற்றும் பரவல்',
  'Post - Mauryan Period': 'மௌரியருக்குப் பிந்தைய காலம்',
  'Pre Historic Tamilagam & Archaeological': 'தொல்பழங்கால தமிழகம் & தொல்லியல்',
  'Preamble to the Constitution': 'அரசியலமைப்பின் முகவுரை',
  'Public Finance': 'பொது நிதி',
  'Quit India Movement': 'வெள்ளையனே வெளியேறு இயக்கம்',
  'Regional Powers during Mughal Period': 'முகலாயர் காலத்தில் பிராந்திய சக்திகள்',
  'Reserve Bank of India': 'இந்திய ரிசர்வ் வங்கி',
  'Revolution of 1857': '1857 புரட்சி',
  'Rivers in India': 'இந்தியாவின் ஆறுகள்',
  'Role of Tamilnadu in freedom struggle': 'சுதந்திரப் போராட்டத்தில் தமிழ்நாட்டின் பங்கு',
  'Rule of Law': 'சட்டத்தின் ஆட்சி',
  'Rural welfare oriented programmes': 'கிராம நலன் சார்ந்த திட்டங்கள்',
  'Social And Religious Movements In The Nineteenth Century':
    'பத்தொன்பதாம் நூற்றாண்டின் சமூக மற்றும் சமய இயக்கங்கள்',
  'Social Geography': 'சமூகப் புவியியல்',
  'Social Justice & Harmony': 'சமூக நீதி & நல்லிணக்கம்',
  'Socio Political movements in Tamil Nadu': 'தமிழ்நாட்டில் சமூக-அரசியல் இயக்கங்கள்',
  'Soil, Minerals and Natural Resources': 'மண், கனிமங்கள் மற்றும் இயற்கை வளங்கள்',
  'Sources of revenue': 'வருவாய் ஆதாரங்கள்',
  'State Executive': 'மாநில நிறைவேற்று அதிகாரம்',
  'State Legislature': 'மாநில சட்டமன்றம்',
  'Structure of Indian Economy and Employment Generation':
    'இந்தியப் பொருளாதாரத்தின் கட்டமைப்பு மற்றும் வேலைவாய்ப்பு உருவாக்கம்',
  'The Coming of Islam': 'இஸ்லாத்தின் வருகை',
  'The Coming of The Europeans': 'ஐரோப்பியர்களின் வருகை',
  'The Gupta Dynasty (AD 320 - 550)': 'குப்த வம்சம் (கி.பி. 320 - 550)',
  'The Mauryan Empire (321 - 289 BC)': 'மௌரியப் பேரரசு (கி.மு. 321 - 289)',
  'The Mughal Dynasty (1526 - 1540 and 1555 - 1857)':
    'முகலாய வம்சம் (1526 - 1540 மற்றும் 1555 - 1857)',
  'The Pre-Historic Period': 'தொல்பழங்காலம்',
  'The Southern Dynasties': 'தென்னக வம்சங்கள்',
  'The Vardhanas (AD 550 - 647)': 'வர்தனர்கள் (கி.பி. 550 - 647)',
  'The Vedic Period- the Aryans': 'வேத காலம் - ஆரியர்கள்',
  'Transport and Communication': 'போக்குவரத்து மற்றும் தொடர்பு',
  'Union Executive': 'மத்திய நிறைவேற்று அதிகாரம்',
  'Union Legislature': 'மத்திய சட்டமன்றம்',
  'Union, State and Union Territory': 'மத்திய, மாநில மற்றும் யூனியன் பிரதேசம்',
  'Viceroys of India': 'இந்தியாவின் வைஸ்ராய்கள்',
  'Water Resources': 'நீர் வளங்கள்',
  // Sub-group headings (from SUBJECT_TOPIC_GROUPS) + the auto "More" bucket.
  'Core Economics': 'அடிப்படைப் பொருளியல்',
  'Economic Development': 'பொருளாதார வளர்ச்சி',
  'Physical Geography': 'இயற்கைப் புவியியல்',
  'Human Geography': 'மானிடப் புவியியல்',
  More: 'மேலும்',
  // ── Aptitude · Numerics ──
  'AP, GP and Special Series': 'கூட்டுத்தொடர், பெருக்குத்தொடர் & சிறப்புத் தொடர்கள்',
  'Area And Volume': 'பரப்பளவு மற்றும் கன அளவு',
  'Average, Mean Median Mode': 'சராசரி, இடைநிலை, முகடு',
  'Compound Interest': 'கூட்டு வட்டி',
  'LCM and HCF': 'மீ.சி.ம மற்றும் மீ.பொ.வ',
  Percentage: 'சதவீதம்',
  'Profit And Loss': 'லாபம் மற்றும் நட்டம்',
  'Ratio And Proportion': 'விகிதம் மற்றும் விகிதாசாரம்',
  'Simple Interest': 'தனி வட்டி',
  Simplification: 'எளிமைப்படுத்துதல்',
  'Surds And Indices': 'மூலங்கள் மற்றும் அடுக்குகள்',
  'Time, Work , Speed And Distance': 'நேரம், வேலை, வேகம் மற்றும் தூரம்',
  // ── Aptitude · Reasoning ──
  'Alphabet Series': 'எழுத்துத் தொடர்',
  Analogy: 'ஒப்புமை',
  'Clock Problems': 'கடிகாரக் கணக்குகள்',
  'Coding Decoding': 'குறியீடு - மறைகுறியீடு',
  'Date Problems': 'தேதிக் கணக்குகள்',
  'Dice Problems': 'பகடைக் கணக்குகள்',
  'Direction Based': 'திசை சார்ந்தவை',
  'Mathematical Operators': 'கணிதச் செயற்குறிகள்',
  'No Of Figures': 'உருவங்களின் எண்ணிக்கை',
  'Number Series': 'எண் தொடர்',
  Puzzles: 'புதிர்கள்',
  'Seating Arangement': 'இருக்கை அமைப்பு',
  // ── Current Affairs themes ──
  Economy: 'பொருளாதாரம்',
  Environment: 'சுற்றுச்சூழல்',
  'Important Days': 'முக்கிய நாட்கள்',
  International: 'சர்வதேசம்',
  Miscellaneous: 'இதர',
  National: 'தேசியம்',
  'Personalities, Awards and Events': 'பிரபலங்கள், விருதுகள் மற்றும் நிகழ்வுகள்',
  'Reports and Indices': 'அறிக்கைகள் மற்றும் குறியீடுகள்',
  'Science and Technology': 'அறிவியல் மற்றும் தொழில்நுட்பம்',
  Sports: 'விளையாட்டு',
  States: 'மாநிலங்கள்',
  'Tamil Nadu': 'தமிழ்நாடு',
}

/** A topic (or sub-group heading) in the chosen language. Unknown topics — e.g.
 *  PYQ's per-question labels — return unchanged. */
export function topicName(name: string, lang: Lang | null): string {
  const ta = TOPIC_NAME_TA[name]
  if (!ta) return name
  if (lang === 'ta') return ta
  if (lang === 'both') return `${name} / ${ta}`
  return name
}

// ─── Groups for Previous Year Question Papers ───────────────────────────────

export interface GroupDef {
  id: GroupType
  label: string
}

export const GROUPS: GroupDef[] = [
  { id: 'Group1', label: 'GROUP 1' },
  { id: 'Group2_2A', label: 'GROUP 2/2A' },
  { id: 'Group4_VAO', label: 'GROUP 4 & VAO' },
]

// General-Studies subjects (the full TNPSC GS syllabus, shared by all groups).
// Questions are tagged by subject; a question shows under any group whose
// syllabus includes its subject (subject-membership, not a stored group_type).
export const SUBJECTS: string[] = [
  'History and INM',
  'Polity',
  'Geography',
  'History Culture Heritage of TN',
  'Development Administration of TamilNadu',
  'General Science',
  'Biology',
  'Physics',
  'Chemistry',
  'Indian Economy',
  'Current Affairs',
  'Aptitude',
]

// Language papers (qualifying papers for Group 2/2A and Group 4 & VAO).
export const LANGUAGE_SUBJECTS: string[] = ['General Tamil', 'General English']

// Subjects that have actual PYQ data loaded (category='pyq'). No group step needed.
export const PYQ_SUBJECTS: string[] = [
  'History and INM',
  'Polity',
  'Geography',
  'History Culture Heritage of TN',
  'Development Administration of TamilNadu',
  'Biology',
  'Physics',
  'Chemistry',
  'Indian Economy',
]

// Per-group subject availability. Group 1 = full GS; Group 2/4 add the
// General Tamil / General English qualifying papers.
export const GROUP_SUBJECTS: Record<GroupType, string[]> = {
  Group1: [...SUBJECTS],
  Group2_2A: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
  Group4_VAO: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
}

// ─── Outer question bank (subject-wise, Type=outer) ─────────────────────────
// `subject` labels exactly as stored in the DB for category='outer' rows. Drive
// the per-subject chips on the admin Outer-questions view.
export const OUTER_SUBJECTS: string[] = [
  'History',
  'Indian National Movement',
  'Polity',
  'Geography',
  'Economy',
  'History, Culture, Heritage',
  'Tamil Nadu Administration',
  'Botany',
  'Zoology',
  'Physics',
  'Chemistry',
  'Current Affairs',
  'English',
  'தமிழ்',
]

// ─── Subject Practice syllabus order ────────────────────────────────────────
// The Subject Practice picker (category='subject') shows subjects then topics.
// By default the API returns them alphabetically; these structures re-order them
// to follow the official TNPSC syllabus split-up (Unit I → VI) instead. Strings
// must match the DB `subject` / `topic` values exactly. Anything not listed here
// falls to the end alphabetically, so unmapped topics are never hidden.

// Subjects in syllabus sequence: Gen. Science (Phy/Chem/Bio) → Geography →
// History → INM → Polity → Economy → TN Admin → TN History & Culture.
export const SUBJECT_PRACTICE_ORDER: string[] = [
  'Physics',
  'Chemistry',
  'Biology',
  'Geography',
  'History',
  'Indian National Movement',
  'Polity',
  'Economy',
  'Tamil Nadu Administration',
  'History, Culture & Heritage of TN',
]

// Per-subject topic order, following each unit's syllabus listing (History &
// INM are chronological; others follow the PDF's sub-point sequence).
export const SUBJECT_TOPIC_ORDER: Record<string, string[]> = {
  Physics: [
    'Nature of Universe',
    'General Scientific Laws',
    'Mechanics and Properties of Matter',
    'Force, Motion and Energy',
    'Everyday application of the basic principles of Mechanics',
    'Electricity and Magnetism',
    'Light, Sound and Heat',
    'Nuclear Physics and Laser',
    'Electronics and Communications',
  ],
  Chemistry: [
    'Elements and Compounds',
    'Acids, Base and Salts',
    'Petroleum Products',
    'Fertilizers and Pesticides',
  ],
  Biology: [
    'Main Concepts of Life Science',
    'Classification of Living Organism',
    'Evolution',
    'Genetics',
    'Physiology',
    'Nutrition',
    'Health and Hygiene',
    'Human Diseases',
    'Environment and Ecology',
  ],
  Geography: [
    'Location',
    'Physical Features',
    'Monsoon, Rainfall, Weather and Climate',
    'Water Resources',
    'Rivers in India',
    'Soil, Minerals and Natural Resources',
    'Forest and Wildlife',
    'Agricultural Pattern',
    'Transport and Communication',
    'Population Density and Distribution',
    'Social Geography',
    'Natural Calamity',
    'Other Topics',
  ],
  History: [
    'The Pre-Historic Period',
    'Indus Valley Civilization (2500 - 1800 BC)',
    'The Vedic Period- the Aryans',
    'Growth of Jainism and Buddhism',
    'The Mauryan Empire (321 - 289 BC)',
    'Post - Mauryan Period',
    'The Gupta Dynasty (AD 320 - 550)',
    'The Vardhanas (AD 550 - 647)',
    'The Southern Dynasties',
    'The Coming of Islam',
    'Regional Powers during Mughal Period',
    'The Mughal Dynasty (1526 - 1540 and 1555 - 1857)',
    'The Coming of The Europeans',
    'British East India Company And The British Rule',
    'Social And Religious Movements In The Nineteenth Century',
    'Viceroys of India',
    'Indian Freedom Struggle',
    'Other Topics',
  ],
  'Indian National Movement': [
    'Revolution of 1857',
    'Political Institution Established before Congress',
    'Indian National Congress',
    'Social and Religious Movement',
    'Development of Press in Modern India',
    'Gandhi & Early Movements',
    'Revolutionary Movement in India',
    'Quit India Movement',
    'Evolution of Indian Constitution',
    'Partition of India and Independence',
  ],
  Polity: [
    'Constitution of India',
    'Preamble to the Constitution',
    'Union, State and Union Territory',
    'Citizenship',
    'Fundamental Rights',
    'Directive Principles of State Policy',
    'Union Legislature',
    'Union Executive',
    'State Legislature',
    'State Executive',
    'Local Governments',
    'Election',
    'Judiciary in India',
    'Rule of Law',
    'Human rights charter',
    'Other Topics',
  ],
  Economy: [
    'Nature of Indian Economy',
    'Five Year Plan Models-An Assessment',
    'Planning Commission and Niti Ayog',
    'Sources of revenue',
    'Reserve Bank of India',
    'Fiscal Policy and Monetary Policy',
    'Finance Commission',
    'Structure of Indian Economy and Employment Generation',
    'Land reforms and Agriculture',
    'Industrial growth',
    'Rural welfare oriented programmes',
    'Social problems',
    'Budget',
    'Public Finance',
    'Economic Reforms',
    'Economic Committees',
    'Government Schemes',
    'Other Topics',
  ],
  'Tamil Nadu Administration': [
    'Human Development Indicators',
    'Political Parties & Welfare Schemes',
    'Social Justice & Harmony',
    'Education & Health Systems',
    'Geography of TN & its Impact on Economic Growth',
    'e-Governance in TN',
  ],
  'History, Culture & Heritage of TN': [
    'Pre Historic Tamilagam & Archaeological',
    'History of Tamil society',
    'Tamil Literature Sangam Age to Contemporary Times',
    'Thirukkural',
    'Role of Tamilnadu in freedom struggle',
    'Socio Political movements in Tamil Nadu',
  ],
}

// Optional sub-grouping for the topic step. Subjects listed here render their
// topics under labelled sub-headings (the syllabus splits Geography into Physical
// and Human Geography); subjects not listed stay a flat syllabus-ordered list.
export interface TopicGroup {
  heading: string
  topics: string[]
}

export const SUBJECT_TOPIC_GROUPS: Record<string, TopicGroup[]> = {
  Economy: [
    {
      heading: 'Core Economics',
      topics: [
        'Nature of Indian Economy',
        'Five Year Plan Models-An Assessment',
        'Planning Commission and Niti Ayog',
        'Sources of revenue',
        'Reserve Bank of India',
        'Fiscal Policy and Monetary Policy',
        'Finance Commission',
        'Budget',
        'Public Finance',
        'Economic Reforms',
        'Economic Committees',
      ],
    },
    {
      heading: 'Economic Development',
      topics: [
        'Structure of Indian Economy and Employment Generation',
        'Land reforms and Agriculture',
        'Industrial growth',
        'Rural welfare oriented programmes',
        'Social problems',
        'Government Schemes',
      ],
    },
  ],
  Geography: [
    {
      heading: 'Physical Geography',
      topics: [
        'Location',
        'Physical Features',
        'Monsoon, Rainfall, Weather and Climate',
        'Water Resources',
        'Rivers in India',
        'Soil, Minerals and Natural Resources',
        'Forest and Wildlife',
        'Agricultural Pattern',
      ],
    },
    {
      heading: 'Human Geography',
      topics: [
        'Transport and Communication',
        'Social Geography',
        'Population Density and Distribution',
        'Natural Calamity',
        'Other Topics',
      ],
    },
  ],
}

// Split `topics` into the configured sub-groups (preserving the incoming order
// within each group). Topics not in any group are collected under a trailing
// "More" heading so nothing is ever dropped. Returns a single null-headed group
// when `groups` is undefined (the flat, ungrouped case).
export function groupTopics(
  topics: string[],
  groups: TopicGroup[] | undefined
): { heading: string | null; topics: string[] }[] {
  if (!groups || groups.length === 0) return [{ heading: null, topics }]
  const present = new Set(topics)
  const used = new Set<string>()
  const out: { heading: string | null; topics: string[] }[] = []
  for (const g of groups) {
    const ts = g.topics.filter((t) => present.has(t))
    ts.forEach((t) => used.add(t))
    if (ts.length) out.push({ heading: g.heading, topics: ts })
  }
  const leftover = topics.filter((t) => !used.has(t))
  if (leftover.length) out.push({ heading: 'More', topics: leftover })
  return out
}

// Sort `items` by their position in `order`; entries not in `order` sink to the
// end and are sorted alphabetically among themselves. Pure (returns a new array).
export function bySyllabusOrder(items: string[], order: string[] | undefined): string[] {
  if (!order || order.length === 0) return [...items].sort((a, b) => a.localeCompare(b))
  const rank = new Map(order.map((s, i) => [s, i]))
  return [...items].sort((a, b) => {
    const ra = rank.has(a) ? (rank.get(a) as number) : Number.MAX_SAFE_INTEGER
    const rb = rank.has(b) ? (rank.get(b) as number) : Number.MAX_SAFE_INTEGER
    return ra !== rb ? ra - rb : a.localeCompare(b)
  })
}

// ─── Samacheer standards ────────────────────────────────────────────────────

export const STANDARDS = [6, 7, 8, 9, 10]
export const standardLabel = (n: number) => `${n}TH`

// ─── Aptitude ───────────────────────────────────────────────────────────────

export const NUMERICS_TOPICS: string[] = [
  'Simplification',
  'Profit and Loss',
  'Percentage',
  'Ratio and Proportion',
  'LCM & HCF',
  'Area and Volume',
  'Simple Interest & Compound Interest',
  'Time and Work',
  'A.P & G.P',
  'Square Root & Cube Root',
  'Surds',
  'Logs and Exponents',
]

export const REASONING_TOPICS: string[] = [
  'Logical Number Series',
  'Logical Alphabet Series',
  'Alpha-Numeric Reasoning',
  'Analogy',
  'Dice',
  'Puzzles',
  'No of Figures',
  'Mathematical Operators',
]

// ─── Current Affairs ────────────────────────────────────────────────────────

export interface MonthDef {
  slug: string
  label: string
  year: number
}

export const CA_MONTHS: MonthDef[] = [
  { slug: 'july-2025', label: 'July 2025', year: 2025 },
  { slug: 'august-2025', label: 'August 2025', year: 2025 },
  { slug: 'september-2025', label: 'September 2025', year: 2025 },
  { slug: 'october-2025', label: 'October 2025', year: 2025 },
  { slug: 'november-2025', label: 'November 2025', year: 2025 },
  { slug: 'december-2025', label: 'December 2025', year: 2025 },
  { slug: 'january-2026', label: 'January 2026', year: 2026 },
  { slug: 'february-2026', label: 'February 2026', year: 2026 },
  { slug: 'march-2026', label: 'March 2026', year: 2026 },
  { slug: 'april-2026', label: 'April 2026', year: 2026 },
  { slug: 'may-2026', label: 'May 2026', year: 2026 },
  { slug: 'june-2026', label: 'June 2026', year: 2026 },
]

// Default topic categories shown when the DB has no curated topics yet.
export const CA_TOPIC_CATEGORIES: string[] = [
  'Science & Technology',
  'Sports',
  'Economy & Finance',
  'Government Schemes',
  'International Affairs',
  'Awards & Honours',
  'Appointments',
  'Environment',
  'Defence',
  'Tamil Nadu',
]

// Human-friendly label for a group id.
export function groupLabel(id?: string): string {
  return GROUPS.find((g) => g.id === id)?.label ?? id ?? ''
}

// ─── Mock-test blueprints (TNPSC 2024 / 2025 group patterns) ─────────────────
// Subject-wise question distribution per group exam. The `slots` counts here
// MUST match the GROUP_SLOTS table in server/src/routes/questions.ts - the UI
// renders these for the pre-test breakdown; the server pulls the real questions.

export const MOCK_BLUEPRINTS: MockBlueprint[] = [
  {
    id: 'Group1',
    title: 'Group 1 Prelims',
    totalQuestions: 100,
    durationMinutes: 90,
    negativeMark: 0,
    slots: [
      { label: 'History & INM', count: 15 },
      { label: 'Polity', count: 12 },
      { label: 'Geography', count: 12 },
      { label: 'General Science', count: 15 },
      { label: 'Economy', count: 10 },
      { label: 'TN History & Culture', count: 10 },
      { label: 'TN Administration', count: 6 },
      { label: 'Current Affairs', count: 10 },
      { label: 'Aptitude', count: 10 },
    ],
  },
  // Group 2 / 2A Prelims and Group 4 & VAO are intentionally not offered — the
  // app currently ships Group 1 only. (Their server-side GROUP_SLOTS remain, so
  // these can be re-enabled by restoring the blueprint entries.)
]

export function mockBlueprint(id?: string): MockBlueprint | undefined {
  return MOCK_BLUEPRINTS.find((b) => b.id === id)
}
