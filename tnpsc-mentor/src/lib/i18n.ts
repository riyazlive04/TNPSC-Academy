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

  // Insights / analytics
  insights: { en: 'My Insights', ta: 'என் பகுப்பாய்வு' },
  insightsTitle: { en: 'Performance Insights', ta: 'செயல்திறன் பகுப்பாய்வு' },
  testsTaken: { en: 'Tests Taken', ta: 'எடுத்த தேர்வுகள்' },
  avgAccuracy: { en: 'Avg Accuracy', ta: 'சராசரி துல்லியம்' },
  bestScore: { en: 'Best Score', ta: 'சிறந்த மதிப்பெண்' },
  studyTime: { en: 'Study Time', ta: 'படிப்பு நேரம்' },
  focusAreas: { en: 'Focus Areas', ta: 'கவனம் தேவைப்படும் பகுதிகள்' },
  focusHint: {
    en: 'These topics need work — revise and re-attempt them next.',
    ta: 'இந்தத் தலைப்புகளில் கவனம் தேவை — மீள்பார்வை செய்து மீண்டும் முயற்சிக்கவும்.',
  },
  strengths: { en: 'Your Strengths', ta: 'உங்கள் பலங்கள்' },
  bySubject: { en: 'By Subject', ta: 'பாடம் வாரியாக' },
  accuracyTrend: { en: 'Accuracy Trend', ta: 'துல்லிய போக்கு' },
  noData: {
    en: 'Take a few tests and your insights will appear here.',
    ta: 'சில தேர்வுகளை எடுத்தால் உங்கள் பகுப்பாய்வு இங்கே தோன்றும்.',
  },
  learnThis: { en: 'Learn this', ta: 'இதைக் கற்க' },
  studyTip: { en: 'Study Tip', ta: 'படிப்புக் குறிப்பு' },
  resources: { en: 'Free resources', ta: 'இலவச வளங்கள்' },

  // Revision
  revision: { en: 'Revision', ta: 'மீள்பார்வை' },
  revisionTitle: { en: 'Smart Revision', ta: 'திறன்மிகு மீள்பார்வை' },
  dueToday: { en: 'Due today', ta: 'இன்று செய்ய வேண்டியவை' },
  startRevision: { en: 'Start Revision', ta: 'மீள்பார்வையைத் தொடங்கு' },
  practiceMistakes: { en: 'Practice your mistakes', ta: 'தவறுகளைப் பயிற்சி செய்' },
  revisionEmpty: {
    en: 'Nothing due. Finish a test — wrong & flagged questions come here for spaced revision.',
    ta: 'எதுவும் இல்லை. ஒரு தேர்வை முடியுங்கள் — தவறான & குறித்த வினாக்கள் மீள்பார்வைக்கு இங்கே வரும்.',
  },
  allCaughtUp: { en: 'All caught up! 🎉', ta: 'அனைத்தும் முடிந்தது! 🎉' },

  // Mock tests
  mockTest: { en: 'Mock Test', ta: 'மாதிரித் தேர்வு' },
  mockTests: { en: 'Mock Tests', ta: 'மாதிரித் தேர்வுகள்' },
  fullLength: { en: 'Full-length exam simulation', ta: 'முழு நீள தேர்வு உருவகப்படுத்துதல்' },
  negMarking: { en: 'Negative marking', ta: 'எதிர்மறை மதிப்பெண்' },
  startMock: { en: 'Start Mock', ta: 'மாதிரித் தேர்வைத் தொடங்கு' },

  // Habit layer
  dayStreak: { en: 'Day Streak', ta: 'நாள் தொடர்ச்சி' },
  dailyGoal: { en: 'Daily Goal', ta: 'தினசரி இலக்கு' },
  goalDone: { en: "Today's goal complete! 🎉", ta: 'இன்றைய இலக்கு முடிந்தது! 🎉' },
  questionsToday: { en: 'questions today', ta: 'இன்று வினாக்கள்' },
  daysToExam: { en: 'days to exam', ta: 'தேர்வுக்கு நாட்கள்' },
  setExamDate: { en: 'Set your exam date & goal', ta: 'உங்கள் தேர்வு தேதி & இலக்கை அமைக்கவும்' },
  daily: { en: 'Daily Current Affairs', ta: 'தினசரி நடப்பு நிகழ்வுகள்' },
  dailyCta: { en: "Today's 10-question current-affairs drill", ta: 'இன்றைய 10-வினா நடப்பு நிகழ்வுப் பயிற்சி' },

  // Setup / onboarding
  setupTitle: { en: 'Set Your Target', ta: 'உங்கள் இலக்கை அமைக்கவும்' },
  targetGroup: { en: 'Target Group', ta: 'இலக்கு குழு' },
  examDate: { en: 'Exam Date', ta: 'தேர்வு தேதி' },
  dailyGoalQ: { en: 'Daily question goal', ta: 'தினசரி வினா இலக்கு' },
  saveContinue: { en: 'Save & Continue', ta: 'சேமித்துத் தொடரவும்' },
  skip: { en: 'Skip', ta: 'தவிர்' },

  // Percentile + syllabus
  yourRank: { en: 'Your Standing', ta: 'உங்கள் நிலை' },
  aheadOf: { en: 'ahead of', ta: 'முந்தியுள்ளீர்கள்' },
  ofAspirants: { en: 'of aspirants', ta: 'விண்ணப்பதாரர்களில்' },
  syllabusCoverage: { en: 'Syllabus Coverage', ta: 'பாடத்திட்ட பரப்பளவு' },
  covered: { en: 'covered', ta: 'முடிந்தது' },
  notStarted: { en: 'Not started', ta: 'தொடங்கவில்லை' },
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
