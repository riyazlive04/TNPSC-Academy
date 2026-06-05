import { useLanguageStore, type Lang } from '../store/languageStore'

// ─── UI string catalogue ────────────────────────────────────────────────────
// Each key maps to an English + Tamil label. For the bilingual ('both') mode we
// show "English / தமிழ்". Question CONTENT stays in English until a Tamil
// question source is added; this catalogue covers interface chrome only.

type Entry = { en: string; ta: string }

const STRINGS = {
  // Brand / common
  appName: { en: 'TNPSC MENTOR', ta: 'TNPSC வழிகாட்டி' },
  signOut: { en: 'Sign out', ta: 'வெளியேறு' },
  home: { en: 'Home', ta: 'முகப்பு' },
  admin: { en: 'Admin', ta: 'நிர்வாகி' },
  back: { en: 'Back', ta: 'பின்செல்' },
  loading: { en: 'Loading…', ta: 'ஏற்றுகிறது…' },

  // Language screen
  chooseLanguage: { en: 'Choose Your Language', ta: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்' },
  languageHint: {
    en: 'You can change this anytime from the top bar.',
    ta: 'மேல் பட்டியில் இருந்து இதை எப்போது வேண்டுமானாலும் மாற்றலாம்.',
  },
  langEnglish: { en: 'English', ta: 'ஆங்கிலம்' },
  langTamil: { en: 'Tamil', ta: 'தமிழ்' },
  langBoth: { en: 'English + Tamil', ta: 'ஆங்கிலம் + தமிழ்' },
  langEnglishDesc: { en: 'Interface in English', ta: 'இடைமுகம் ஆங்கிலத்தில்' },
  langTamilDesc: { en: 'Interface in Tamil', ta: 'இடைமுகம் தமிழில்' },
  langBothDesc: { en: 'Bilingual interface', ta: 'இருமொழி இடைமுகம்' },
  continueBtn: { en: 'Continue', ta: 'தொடரவும்' },

  // Test Arena
  testArena: { en: 'Test Arena', ta: 'தேர்வு அரங்கம்' },
  welcome: { en: 'Welcome', ta: 'வரவேற்கிறோம்' },
  chooseCategory: { en: 'Choose a category to begin.', ta: 'தொடங்க ஒரு பிரிவைத் தேர்ந்தெடுக்கவும்.' },
  hoverPreview: {
    en: "Hover a category to preview what's inside",
    ta: 'உள்ளே என்ன இருக்கிறது என்பதைக் காண பிரிவின் மீது நகர்த்தவும்',
  },
  insideSection: { en: 'Inside this section', ta: 'இந்தப் பிரிவில்' },
  adminModeNote: {
    en: 'Admin mode: picking any category shows the full question bank (with answers) instead of a timed test.',
    ta: 'நிர்வாக முறை: எந்தப் பிரிவையும் தேர்ந்தெடுத்தால் நேரத் தேர்வுக்குப் பதிலாக முழு வினாத் தொகுப்பு (விடைகளுடன்) காட்டப்படும்.',
  },

  // Category titles
  pyqTitle: { en: 'PREVIOUS YEAR QUESTION PAPERS', ta: 'முந்தைய ஆண்டு வினாத்தாள்கள்' },
  samacheerTitle: { en: 'SAMACHEER BASED', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsTitle: { en: 'CURRENT AFFAIRS', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeTitle: { en: 'APTITUDE TOPIC WISE', ta: 'திறன் தலைப்பு வாரியாக' },

  // Section badges
  pyqBadge: { en: 'Previous Year Question Paper', ta: 'முந்தைய ஆண்டு வினாத்தாள்' },
  samacheerBadge: { en: 'Samacheer Based', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsBadge: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeBadge: { en: 'Aptitude', ta: 'திறன் அறிவு' },
  questionBank: { en: 'Question Bank', ta: 'வினாத் தொகுப்பு' },

  // Steps / selectors
  step1Group: { en: 'Step 1 — Select Group', ta: 'படி 1 — குழுவைத் தேர்ந்தெடுக்கவும்' },
  step2Subject: { en: 'Step 2 — Select Subject', ta: 'படி 2 — பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step1Subject: { en: 'Step 1 — Select Subject', ta: 'படி 1 — பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step2Standard: { en: 'Step 2 — Select Standard', ta: 'படி 2 — வகுப்பைத் தேர்ந்தெடுக்கவும்' },
  step3Topic: { en: 'Step 3 — Select Topic', ta: 'படி 3 — தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  step1Category: { en: 'Step 1 — Select Category', ta: 'படி 1 — பிரிவைத் தேர்ந்தெடுக்கவும்' },
  step2Topic: { en: 'Step 2 — Select Topic', ta: 'படி 2 — தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  selectMonth: { en: 'Select Month', ta: 'மாதத்தைத் தேர்ந்தெடுக்கவும்' },
  topicWise: { en: 'Topic Wise', ta: 'தலைப்பு வாரியாக' },
  monthWise: { en: 'Month Wise', ta: 'மாத வாரியாக' },
  numerics: { en: 'Numerics', ta: 'எண் கணிதம்' },
  reasoning: { en: 'Reasoning', ta: 'பகுத்தறிவு' },

  // Quiz
  question: { en: 'Question', ta: 'வினா' },
  of: { en: 'of', ta: '/' },
  attempted: { en: 'Attempted', ta: 'முயற்சித்தவை' },
  flagged: { en: 'Flagged', ta: 'குறிக்கப்பட்டவை' },
  prev: { en: 'Prev', ta: 'முந்தைய' },
  next: { en: 'Next', ta: 'அடுத்து' },
  flag: { en: 'Flag', ta: 'குறி' },
  submitTest: { en: 'Submit Test', ta: 'தேர்வைச் சமர்ப்பி' },
  quit: { en: 'Quit', ta: 'வெளியேறு' },
  explanation: { en: 'Explanation', ta: 'விளக்கம்' },
  preparingTest: { en: 'Preparing your test…', ta: 'உங்கள் தேர்வு தயாராகிறது…' },
  min15: {
    en: 'Please spend at least 15 seconds on this question.',
    ta: 'இந்த வினாவில் குறைந்தது 15 வினாடிகள் செலவிடவும்.',
  },

  // Result
  testComplete: { en: 'Test Complete', ta: 'தேர்வு முடிந்தது' },
  accuracy: { en: 'Accuracy', ta: 'துல்லியம்' },
  attended: { en: 'Attended', ta: 'முயற்சித்தவை' },
  timeTaken: { en: 'Time Taken', ta: 'எடுத்த நேரம்' },
  questionBreakdown: { en: 'Question Breakdown', ta: 'வினா விவரம்' },
  retryTest: { en: 'Retry Test', ta: 'மீண்டும் முயற்சி' },
  downloadPdf: { en: 'Download Explanation PDF', ta: 'விளக்க PDF பதிவிறக்கம்' },
  pdfLockedMsg: {
    en: 'Attempt at least 80% of questions to unlock explanations.',
    ta: 'விளக்கங்களைத் திறக்க குறைந்தது 80% வினாக்களை முயற்சிக்கவும்.',
  },

  // Empty / errors
  noQuestions: {
    en: 'No questions are available for this selection yet.',
    ta: 'இந்தத் தேர்வுக்கு இன்னும் வினாக்கள் இல்லை.',
  },
} as const

export type StringKey = keyof typeof STRINGS

/** Translate a key for a given language. 'both' shows "EN / TA". */
export function translate(key: StringKey, lang: Lang | null): string {
  const entry: Entry = STRINGS[key]
  const l = lang ?? 'en'
  if (l === 'ta') return entry.ta
  if (l === 'both') return entry.en === entry.ta ? entry.en : `${entry.en} / ${entry.ta}`
  return entry.en
}

/** Hook returning a `t()` bound to the current language + the raw lang. */
export function useT() {
  const lang = useLanguageStore((s) => s.lang)
  const t = (key: StringKey) => translate(key, lang)
  return { t, lang: lang ?? 'en' }
}
