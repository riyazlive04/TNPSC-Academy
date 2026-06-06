// Learning assets shown when a weak area is detected. Two lawful kinds:
//   1. Links to genuinely FREE, official/government study material.
//   2. Short ORIGINAL bilingual "focus tips" written for this app (not copied
//      from any copyrighted source).
// We never republish third-party coaching content; we link out to it instead.

export interface AssetLink {
  label: string
  url: string
  kind: 'official' | 'textbook' | 'reference' | 'video'
}

export interface SubjectAsset {
  /** short original study tip (English) */
  tip: string
  /** short original study tip (Tamil) */
  tipTa: string
  links: AssetLink[]
}

// Free, official, broadly-useful resources for every subject.
const COMMON: AssetLink[] = [
  { label: 'Samacheer Kalvi textbooks (free, TN Govt)', url: 'https://www.tnschools.gov.in/', kind: 'textbook' },
  { label: 'Official TNPSC syllabus', url: 'https://www.tnpsc.gov.in/english/syllabus.html', kind: 'official' },
]

const SUBJECT_ASSETS: Record<string, SubjectAsset> = {
  'History and INM': {
    tip: 'Build a timeline of the Indian freedom movement — link each event to its leaders, sessions and acts. Dates + cause→effect win marks.',
    tipTa: 'இந்திய சுதந்திரப் போராட்டத்தின் கால வரிசையை உருவாக்குங்கள் — ஒவ்வொரு நிகழ்வையும் தலைவர்கள், மாநாடுகள், சட்டங்களுடன் இணைக்கவும்.',
    links: [
      { label: 'NCERT History textbooks (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  Polity: {
    tip: 'Anchor on the Constitution: Parts, key Articles, Fundamental Rights vs DPSP, and the amendment process. Practise Article-number recall.',
    tipTa: 'அரசியலமைப்பை அடிப்படையாகக் கொள்ளுங்கள்: பகுதிகள், முக்கிய சட்டப்பிரிவுகள், அடிப்படை உரிமைகள் vs வழிகாட்டு நெறிமுறைகள், திருத்த நடைமுறை.',
    links: [
      { label: 'NCERT Political Science (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  'History Culture Heritage of TN': {
    tip: 'Focus on Tamil dynasties (Chola, Chera, Pandya, Pallava), Sangam literature, temples, and TN social-reform movements.',
    tipTa: 'தமிழ் வம்சங்கள் (சோழர், சேரர், பாண்டியர், பல்லவர்), சங்க இலக்கியம், கோயில்கள், தமிழக சமூக சீர்திருத்த இயக்கங்களில் கவனம் செலுத்துங்கள்.',
    links: COMMON,
  },
  'Development Administration of TamilNadu': {
    tip: 'Learn TN welfare schemes, e-governance initiatives, and human-development indicators with their launch years and target groups.',
    tipTa: 'தமிழக நலத்திட்டங்கள், மின்-ஆளுகை முயற்சிகள், மனித மேம்பாட்டுக் குறியீடுகளை அவற்றின் தொடக்க ஆண்டுகளுடன் கற்றுக்கொள்ளுங்கள்.',
    links: COMMON,
  },
  Biology: {
    tip: 'Master human physiology systems, plant biology, nutrition/diseases and ecology. Diagrams + labelled parts retain best.',
    tipTa: 'மனித உடலியக்க அமைப்புகள், தாவரவியல், ஊட்டச்சத்து/நோய்கள், சூழலியலில் தேர்ச்சி பெறுங்கள்.',
    links: [
      { label: 'NCERT Biology (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  Physics: {
    tip: 'Revise units & measurement, motion, light, electricity, and modern physics. Practise formula-based numericals daily.',
    tipTa: 'அலகுகள் & அளவீடு, இயக்கம், ஒளி, மின்சாரம், நவீன இயற்பியலை மீள்பார்வை செய்யுங்கள். தினமும் சூத்திரக் கணக்குகளைப் பயிற்சி செய்யுங்கள்.',
    links: [
      { label: 'NCERT Physics (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  Chemistry: {
    tip: 'Focus on periodic table trends, acids/bases/salts, metals & non-metals, and everyday chemistry. Learn common compounds & uses.',
    tipTa: 'தனிம வரிசை போக்குகள், அமிலம்/காரம்/உப்பு, உலோகங்கள் & அலோகங்கள், அன்றாட வேதியியலில் கவனம் செலுத்துங்கள்.',
    links: [
      { label: 'NCERT Chemistry (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  'Indian Economy': {
    tip: 'Cover planning, banking & RBI, budget/taxation, agriculture, and key indicators (GDP, inflation). Connect schemes to outcomes.',
    tipTa: 'திட்டமிடல், வங்கி & ரிசர்வ் வங்கி, பட்ஜெட்/வரிவிதிப்பு, விவசாயம், முக்கிய குறியீடுகள் (GDP, பணவீக்கம்) ஆகியவற்றைக் கற்றுக்கொள்ளுங்கள்.',
    links: [
      { label: 'NCERT Economics (free PDF)', url: 'https://ncert.nic.in/textbook.php', kind: 'textbook' },
      ...COMMON,
    ],
  },
  'Current Affairs': {
    tip: 'Make a daily 15-minute habit: national + TN news, awards, sports, schemes and appointments. Revise monthly digests before the exam.',
    tipTa: 'தினமும் 15 நிமிட பழக்கம்: தேசிய + தமிழக செய்திகள், விருதுகள், விளையாட்டு, திட்டங்கள், நியமனங்கள்.',
    links: [
      { label: 'PIB (Press Information Bureau)', url: 'https://pib.gov.in/', kind: 'reference' },
      ...COMMON,
    ],
  },
  Aptitude: {
    tip: 'Drill one topic a day, learn shortcuts, and time every set. Speed comes from spaced repetition of solved patterns.',
    tipTa: 'தினம் ஒரு தலைப்பைப் பயிற்சி செய்யுங்கள், குறுக்குவழிகளைக் கற்றுக்கொள்ளுங்கள், ஒவ்வொரு தொகுப்பையும் நேரம் கணக்கிடுங்கள்.',
    links: COMMON,
  },
}

const DEFAULT_ASSET: SubjectAsset = {
  tip: 'Revise the core concepts of this topic, then re-attempt a focused set. Track which sub-areas trip you up and drill those first.',
  tipTa: 'இந்தத் தலைப்பின் அடிப்படைக் கருத்துகளை மீள்பார்வை செய்து, கவனம் செலுத்திய தொகுப்பை மீண்டும் முயற்சிக்கவும்.',
  links: COMMON,
}

/** Look up assets for a subject/topic key (falls back to a sensible default). */
export function assetsFor(key: string): SubjectAsset {
  if (SUBJECT_ASSETS[key]) return SUBJECT_ASSETS[key]
  // try a loose match (topic strings sometimes equal subject names)
  const hit = Object.keys(SUBJECT_ASSETS).find(
    (k) => key.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(key.toLowerCase())
  )
  return hit ? SUBJECT_ASSETS[hit] : DEFAULT_ASSET
}
